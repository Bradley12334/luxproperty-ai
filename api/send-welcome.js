// Vercel Serverless Function — Welcome Email via Resend
// Called from authStore after successful sign-up

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

          <!-- Logo / Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#B8860B;font-weight:600;">
                LUXPROPERTY.AI
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1A1612;border-radius:12px;padding:40px 40px 36px;">

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#FAF8F4;line-height:1.3;">
                Welcome, ${name}.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#9A9490;line-height:1.6;">
                Your LuxProperty.ai account is ready. You now have access to AI-powered property intelligence for the UK market.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr><td style="border-top:1px solid #2A2420;"></td></tr>
              </table>

              <!-- What you get -->
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

              <!-- CTA -->
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

              <!-- Upgrade nudge -->
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

          <!-- Footer -->
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
</html>
  `.trim();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
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
