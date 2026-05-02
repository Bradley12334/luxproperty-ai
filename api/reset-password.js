// Vercel Serverless Function — Reset Password
// Validates token and updates password in Supabase

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: "Token and password required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Find valid token
  const { data: resetToken } = await supabase
    .from("password_reset_tokens")
    .select("user_id, expires_at, used")
    .eq("token", token)
    .maybeSingle();

  if (!resetToken) {
    return res.status(400).json({ error: "Invalid or expired reset link." });
  }
  if (resetToken.used) {
    return res.status(400).json({ error: "This reset link has already been used." });
  }
  if (new Date(resetToken.expires_at) < new Date()) {
    return res.status(400).json({ error: "This reset link has expired. Please request a new one." });
  }

  // Update password
  await supabase
    .from("users")
    .update({ password_hash: password })
    .eq("id", resetToken.user_id);

  // Mark token as used
  await supabase
    .from("password_reset_tokens")
    .update({ used: true })
    .eq("token", token);

  return res.status(200).json({ ok: true });
}
