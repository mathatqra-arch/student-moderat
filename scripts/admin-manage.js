#!/usr/bin/env node
// ==========================================
// Admin User Management Script
// يدير حسابات الأدمن: إنشاء، تعيين كلمة مرور، عرض القائمة
//
// Usage:
//   node scripts/admin-manage.js create --phone=01040945655 --name="Main Admin" --role=leader --password=Secret123
//   node scripts/admin-manage.js list
//   node scripts/admin-manage.js set-password --phone=01040945655 --password=NewPass123
//   node scripts/admin-manage.js reset --phone=01040945655
// ==========================================

// تحميل متغيرات البيئة من .env.local
const fs = require("node:fs");
const path = require("node:path");
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
  console.log(`📄 Loaded .env.local`);
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY غير مُهيّأ في .env.local");
  process.exit(1);
}

// تحويل رقم مصري إلى E.164
function normalizePhone(phone) {
  const cleaned = phone.replace(/[\s\-()]/g, "").trim();
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("201") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("01") && cleaned.length === 11) return "+2" + cleaned;
  return cleaned;
}

async function supabaseRequest(endpoint, method = "GET", body = null) {
  const headers = {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
    "Content-Type": "application/json",
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${SUPABASE_URL}${endpoint}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function listUsers() {
  console.log("\n📋 قائمة حسابات الأدمن:\n");
  const { data } = await supabaseRequest("/auth/v1/admin/users?page=1&perPage=1000");
  const users = data.users || [];

  if (users.length === 0) {
    console.log("  لا يوجد مستخدمون بعد.\n");
    return;
  }

  console.log("  ┌─ User ID                            ─ Phone            ─ Email                              ─ Created");
  console.log("  ├──────────────────────────────────────────────────────────────────────────────────────────────────");

  for (const u of users) {
    const id = (u.id || "").padEnd(36).substring(0, 36);
    const phone = (u.phone || "—").padEnd(17).substring(0, 17);
    const email = (u.email || "—").padEnd(35).substring(0, 35);
    const created = (u.created_at || "").substring(0, 19);
    console.log(`  │ ${id} │ ${phone} │ ${email} │ ${created}`);
  }
  console.log("");
}

async function createAdmin({ phone, name, role = "assistant", password }) {
  const normalizedPhone = normalizePhone(phone);
  const email = `admin+${Date.now().toString(36)}@batch-platform.local`;

  console.log(`\n🆕 إنشاء حساب أدمن جديد:`);
  console.log(`   الاسم:   ${name}`);
  console.log(`   الهاتف:  ${normalizedPhone}`);
  console.log(`   الدور:   ${role}`);
  console.log(`   كلمة المرور: ${password || "(سيتم توليدها)"}`);

  const actualPassword = password || `Admin${Math.random().toString(36).slice(2, 8)}#2026`;

  // 1. إنشاء user في auth.users
  const { status, data } = await supabaseRequest("/auth/v1/admin/users", "POST", {
    phone: normalizedPhone,
    phone_confirm: true,
    email,
    email_confirm: true,
    password: actualPassword,
    user_metadata: {
      name,
      role,
      full_name: name,
    },
    app_metadata: {
      role: "admin",
      provider: "phone",
    },
  });

  if (status >= 400 || !data.id) {
    console.error(`\n❌ فشل إنشاء المستخدم:`);
    console.error(`   ${JSON.stringify(data)}`);
    process.exit(1);
  }

  console.log(`\n✅ تم إنشاء المستخدم:`);
  console.log(`   User ID: ${data.id}`);
  console.log(`   Phone:   ${data.phone}`);

  // 2. إضافته لجدول team_members
  const { status: tStatus, data: tData } = await supabaseRequest(
    "/rest/v1/team_members",
    "POST",
    {
      user_id: data.id,
      name,
      role,
    }
  );

  if (tStatus >= 400) {
    console.error(`\n⚠️  تم إنشاء المستخدم لكن فشلت إضافته لجدول team_members:`);
    console.error(`   ${JSON.stringify(tData)}`);
    console.error(`\n   أضفه يدوياً:`);
    console.error(`   INSERT INTO team_members (user_id, name, role) VALUES ('${data.id}', '${name}', '${role}');`);
  } else {
    console.log(`✅ تمت إضافته لجدول team_members كـ "${role}"`);
  }

  console.log(`\n🔑 بيانات الدخول:`);
  console.log(`   الهاتف:      ${phone}`);
  console.log(`   كلمة المرور: ${actualPassword}`);
  console.log(`\n⚠️  احفظ كلمة المرور الآن — لن تُعرض مرة أخرى.`);
  console.log("");
}

async function setPassword({ phone, password }) {
  const normalizedPhone = normalizePhone(phone);
  console.log(`\n🔑 تعيين كلمة مرور جديدة لـ ${normalizedPhone}`);

  // ابحث عن المستخدم
  const { data: listData } = await supabaseRequest(
    "/auth/v1/admin/users?page=1&perPage=1000"
  );
  const users = listData.users || [];
  const target = users.find((u) => {
    if (!u.phone) return false;
    const userPhone = u.phone.replace(/^\+/, "");
    const inputPhone = normalizedPhone.replace(/^\+/, "");
    return (
      u.phone === normalizedPhone ||
      userPhone === inputPhone ||
      userPhone === inputPhone.replace(/^\+2/, "")
    );
  });

  if (!target) {
    console.error(`❌ لا يوجد مستخدم بالرقم ${normalizedPhone}`);
    process.exit(1);
  }

  const { status, data } = await supabaseRequest(
    `/auth/v1/admin/users/${target.id}`,
    "PUT",
    { password }
  );

  if (status >= 400) {
    console.error(`❌ فشل: ${JSON.stringify(data)}`);
    process.exit(1);
  }

  console.log(`✅ تم تحديث كلمة المرور بنجاح لـ ${target.phone}`);
  console.log(`   كلمة المرور الجديدة: ${password}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flags = Object.fromEntries(
    args
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v || true];
      })
  );

  switch (command) {
    case "list":
      await listUsers();
      break;
    case "create": {
      const { phone, name, role, password } = flags;
      if (!phone || !name) {
        console.error("❌ phone و name مطلوبان\n   مثال: node scripts/admin-manage.js create --phone=01040945655 --name=\"Main Admin\" --role=leader --password=Secret123");
        process.exit(1);
      }
      await createAdmin({ phone, name, role: role || "assistant", password });
      break;
    }
    case "set-password": {
      const { phone, password } = flags;
      if (!phone || !password) {
        console.error("❌ phone و password مطلوبان");
        process.exit(1);
      }
      if (password.length < 6) {
        console.error("❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        process.exit(1);
      }
      await setPassword({ phone, password });
      break;
    }
    default:
      console.log(`
📚 Admin User Management

Usage:
  node scripts/admin-manage.js list
  node scripts/admin-manage.js create --phone=01040945655 --name="Main Admin" --role=leader --password=Secret123
  node scripts/admin-manage.js set-password --phone=01040945655 --password=NewPassword123

Roles:
  leader     — ليدر رئيسي (صلاحيات كاملة)
  assistant  — مشرف مساعد
`);
      break;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
