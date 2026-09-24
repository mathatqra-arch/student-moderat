import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabaseAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://apcxwxnkntegbkimsmty.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwY3h3eG5rbnRlZ2JraW1zbXR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDI1Njc0OCwiZXhwIjoyMTA1ODMyNzQ4fQ.PfjahE-jksd2KLK6nIYgf1mx13QIbmIlHMI2c_t-x60";

  return createClient(supabaseUrl, supabaseKey);
}

// GET: List all API Keys
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_preview, created_at, last_used_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ keys: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Generate a new API Key for ChatGPT
export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "يرجى كتابة اسم للمفتاح (مثل: مفتاح شات جي بي تي الشخصي)" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // Generate random secret API Key with prefix 'bmp_key_'
    const rawRandom = crypto.randomBytes(24).toString("hex");
    const fullKeyValue = `bmp_key_${rawRandom}`;
    const keyPreview = `bmp_key_...${fullKeyValue.slice(-6)}`;

    const { data, error } = await supabase
      .from("api_keys")
      .insert([
        {
          name: name.trim(),
          key_preview: keyPreview,
          key_value: fullKeyValue,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      apiKey: fullKeyValue,
      keyData: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Revoke/Delete API Key
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "معرف المفتاح مطلوب" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: "تم إلغاء المفتاح بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
