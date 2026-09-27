#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${1:-.}"

mkdir -p "$REPO_DIR/src/app/student" "$REPO_DIR/src/app/admin" "$REPO_DIR/public/icons" "$REPO_DIR/supabase/functions/mcp-full"
cp "$BUNDLE_DIR/src/app/student/page.tsx" "$REPO_DIR/src/app/student/page.tsx"
cp "$BUNDLE_DIR/src/app/admin/page.tsx" "$REPO_DIR/src/app/admin/page.tsx"
cp "$BUNDLE_DIR/src/app/globals.css" "$REPO_DIR/src/app/globals.css"
cp "$BUNDLE_DIR/src/app/layout.tsx" "$REPO_DIR/src/app/layout.tsx"
cp "$BUNDLE_DIR/public/manifest.json" "$REPO_DIR/public/manifest.json"
cp "$BUNDLE_DIR/public/icons/icon-192.png" "$REPO_DIR/public/icons/icon-192.png"
cp "$BUNDLE_DIR/public/icons/icon-512.png" "$REPO_DIR/public/icons/icon-512.png"
cp "$BUNDLE_DIR/supabase/functions/mcp-full/index.ts" "$REPO_DIR/supabase/functions/mcp-full/index.ts"

echo "Applied Student Moderat UI/UX + PWA icon + full-control MCP bundle."
echo "Next: npm install && npm run build"
echo "Then: supabase functions deploy mcp-full"
