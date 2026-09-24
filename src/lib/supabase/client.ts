import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://apcxwxnkntegbkimsmty.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwY3h3eG5rbnRlZ2JraW1zbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTY3NDgsImV4cCI6MjEwNTgzMjc0OH0.cd29RFE4mDJISbwsee3xC0l2SdSntHxekNaS38lEPM4';

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
