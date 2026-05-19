// Vercel Serverless Function — Auth Emails
// Consolidated from: forgot-password.js, reset-password.js, send-welcome.js
// Route by ?action=forgot | reset | welcome
//
// POST /api/auth-email?action=forgot   { email }
// POST /api/auth-email?action=reset    { token, password }
// POST /api/auth-email?action=welcome  { name, email }

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = req.query.action;

  // ── FORGOT PASSWORD ──────────────────────────────────────────────────────
  if (action === "forgot") {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email required" });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const key = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from("users")
      .select("id, name")
      .eq("email", key)
      .maybeSingle();

    // Always return success to prevent email enumeration
    if (!user) return res.status(200).json({ ok: true });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

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
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
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

  // ── RESET PASSWORD ───────────────────────────────────────────────────────
  if (action === "reset") {
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

    await supabase
      .from("users")
      .update({ password_hash: password })
      .eq("id", resetToken.user_id);

    await supabase
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("token", token);

    return res.status(200).json({ ok: true });
  }

  // ── SEND WELCOME EMAIL ───────────────────────────────────────────────────
  if (action === "welcome") {
    const { name, email } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: "Missing name or email" });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set");
      return res.status(500).json({ error: "Email service not configured" });
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to LuxProperty.ai</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#B8860B;font-weight:600;">
                LUXPROPERTY.AI
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#1A1612;border-radius:12px;padding:40px 40px 36px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#FAF8F4;line-height:1.3;">
                Welcome, ${name}.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#9A9490;line-height:1.6;">
                Your LuxProperty.ai account is ready. You now have access to AI-powered property intelligence for the UK market.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr><td style="border-top:1px solid #2A2420;"></td></tr>
              </table>
              <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#B8860B;font-weight:600;">
                What you can do
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2A2420;">
                    <p style="margin:0;font-size:14px;color:#FAF8F4;">Search any UK postcode for market intelligence</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2A2420;">
                    <p style="margin:0;font-size:14px;color:#FAF8F4;">View 5-year price trends powered by Land Registry data</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <p style="margin:0;font-size:14px;color:#FAF8F4;">Get neighbourhood profiles and investment insights</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="https://luxproperty.ai"
                       style="display:inline-block;background:#B8860B;color:#FAF8F4;text-decoration:none;font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;letter-spacing:0.02em;">
                      Start Your First Search
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#2A2420;border-radius:8px;padding:16px 20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:12px;color:#B8860B;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Unlock more</p>
                    <p style="margin:0;font-size:13px;color:#9A9490;line-height:1.5;">
                      Upgrade to Professional or Investor for unlimited briefs, PDF exports, portfolio tracking, and price alerts.
                      <a href="https://luxproperty.ai/#/pricing" style="color:#B8860B;text-decoration:none;"> View plans →</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9A9490;line-height:1.6;">
                LuxProperty AI Ltd · Company No. 17158079<br/>
                <a href="https://luxproperty.ai/#/privacy" style="color:#9A9490;">Privacy Policy</a> ·
                <a href="https://luxproperty.ai/#/terms" style="color:#9A9490;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "LuxProperty.ai <welcome@luxproperty.ai>",
          to: [email],
          subject: `Welcome to LuxProperty.ai, ${name}`,
          html,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Resend error:", err);
        return res.status(500).json({ error: "Failed to send email" });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Send welcome email error:", err);
      return res.status(500).json({ error: "Failed to send email" });
    }
  }

  return res.status(400).json({ error: "Unknown action. Use ?action=forgot|reset|welcome" });
}
