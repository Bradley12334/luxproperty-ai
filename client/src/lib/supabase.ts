import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://orriompxdyamnvoahbuq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycmlvbXB4ZHlhbW52b2FoYnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NDE4MDEsImV4cCI6MjA5MzIxNzgwMX0.x44M6Mel1nuE08IDL60Y9iaOigulBDH-sRpFvCDVBrY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, // we manage sessions ourselves
});
