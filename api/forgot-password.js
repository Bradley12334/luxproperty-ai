// Vercel Serverless Function — Forgot Password
// Generates a reset token, stores in Supabase, emails a reset link via Resend

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email required" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const key = email.toLowerCase().trim();

  // Check user exists
  const { data: user } = await supabase
    .from("users")
    .select("id, name")
    .eq("email", key)
    .maybeSingle();

  // Always return success to prevent email enumeration
  if (!user) {
    return res.status(200).json({ ok: true });
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour

  // Store token
  await supabase.from("password_reset_tokens").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
  });

  const resetUrl = `https://luxproperty.ai/#/reset-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Reset your password</title></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding-bottom:32px;text-align:center;">
            <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#B8860B;font-weight:600;">LUXPROPERTY.AI</p>
          </td>
        </tr>
        <tr>
          <td style="background:#1A1612;border-radius:12px;padding:40px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#FAF8F4;">Reset your password</p>
            <p style="margin:0 0 28px;font-size:15px;color:#9A9490;line-height:1.6;">
              Hi ${user.name}, we received a request to reset your LuxProperty.ai password. Click the button below — this link expires in 1 hour.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td align="center">
                <a href="${resetUrl}" style="display:inline-block;background:#B8860B;color:#FAF8F4;text-decoration:none;font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;">
                  Reset Password
                </a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9A9490;">
              If you didn't request this, you can safely ignore this email. Your password won't change.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9A9490;">LuxProperty AI Ltd · Company No. 17158079</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LuxProperty.ai <welcome@luxproperty.ai>",
      to: [key],
      subject: "Reset your LuxProperty.ai password",
      html,
    }),
  });

  return res.status(200).json({ ok: true });
}
