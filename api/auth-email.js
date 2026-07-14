// Vercel Serverless Function — Auth
// Route by ?action=signup | signin | verify-email | force-reset | forgot | reset | welcome | contact
//
// POST /api/auth-email?action=signup        { name, email, password }
// POST /api/auth-email?action=signin        { email, password }
// POST /api/auth-email?action=verify-email  { token }
// POST /api/auth-email?action=force-reset   { email, currentPassword, newPassword }
// POST /api/auth-email?action=forgot        { email }
// POST /api/auth-email?action=reset         { token, password }
// POST /api/auth-email?action=welcome       { name, email }
//
// ─── WHY SIGN-UP / SIGN-IN ARE SERVER-SIDE ───────────────────────────────────
// They used to run in the BROWSER against the users table with the public anon
// key, comparing passwords in plaintext:
//     if (data.password_hash !== password)
// The column named `password_hash` actually stored the raw password, and the RLS
// policy `users_anon_select USING (true)` let any visitor SELECT every row and
// column — so anyone could read every user's email and password straight out of
// the client. Credentials must never be reachable from the browser, so both flows
// now run here behind the service key, and `password_hash` is revoked from anon.
//
// ─── PASSWORD FORMAT / DUAL-MODE VERIFY ──────────────────────────────────────
// Passwords are bcrypt from now on. Legacy rows may still hold plaintext, so
// verifyPassword() accepts BOTH and transparently re-hashes a legacy password on
// the user's next successful sign-in. That decoupling is what makes the migration
// zero-lockout: this code is correct whether the bulk hash migration has run or
// not, so the deploy and the DB migration can happen in either order.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 6;

// Deliberately pragmatic, not RFC-5322-complete: requires a local part, a single
// @, a dotted domain, and a 2+ char TLD. Rejects the obviously-invalid without
// rejecting legitimate addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

// Cheap, high-value blocklist. Not exhaustive by design — the verification email
// is the real guarantee that an address exists; this just stops the laziest abuse.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com",
  "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc",
  "fakeinbox.com", "mailnesia.com", "tempinbox.com", "spamgourmet.com",
]);

export function validateEmail(raw) {
  const email = String(raw || "").toLowerCase().trim();
  if (!email) return { ok: false, error: "Please enter your email address." };
  if (email.length > 254) return { ok: false, error: "Please enter a valid email address." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  const domain = email.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, error: "Please use a permanent email address — temporary inboxes aren't accepted." };
  }
  return { ok: true, email };
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return { ok: true };
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function isBcrypt(stored) {
  return typeof stored === "string" && stored.startsWith("$2");
}

// Constant-time compare for the legacy plaintext path, so we don't leak the
// password via timing while the migration is still in flight.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a password against whatever is stored, bcrypt or legacy plaintext.
 * On a successful legacy match, upgrades the row to bcrypt in place.
 */
async function verifyPassword(supabase, userId, password, stored) {
  if (isBcrypt(stored)) {
    return bcrypt.compare(password, stored);
  }
  // Legacy plaintext row — verify, then upgrade so it never happens again.
  if (!safeEqual(password, stored)) return false;
  try {
    const upgraded = await hashPassword(password);
    await supabase.from("users").update({ password_hash: upgraded }).eq("id", userId);
    console.log("Upgraded legacy plaintext password to bcrypt for user", userId);
  } catch (err) {
    // Never block a valid sign-in because the upgrade failed.
    console.error("Password rehash failed for", userId, err.message);
  }
  return true;
}

function serviceClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// The shape the client is allowed to see. Never includes password_hash.
function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    plan: row.plan,
    bonusInvestorBrief: !!row.bonus_investor_brief,
    // Absent columns (schema not migrated yet) default to a safe non-blocking
    // state: verified (there is no verification infrastructure pre-migration, so
    // we must not gate purchases on it) and no forced rotation.
    emailVerified: row.email_verified === undefined ? true : !!row.email_verified,
    mustResetPassword: !!row.must_reset_password,
    joinedAt: row.created_at,
  };
}

// ─── SCHEMA-TOLERANT COLUMN HANDLING ─────────────────────────────────────────
// The verification/rotation columns (email_verified, must_reset_password) are
// added by the auth-hardening migration. If that migration has NOT run, selecting
// or inserting them makes PostgREST reject the ENTIRE query (undefined_column),
// which broke sign-in, sign-up and reset for everyone. These helpers try the full
// column set first and transparently fall back to the always-present columns, so
// auth works whether or not the migration has been applied — and self-heals the
// moment it is. `_optionalCols` caches the outcome across warm invocations.
const CORE_COLS = "id, name, email, plan, bonus_investor_brief, password_hash, created_at";
const OPT_COLS = "email_verified, must_reset_password";
const FULL_COLS = `${CORE_COLS}, ${OPT_COLS}`;
let _optionalCols = null; // null=unknown, true=present, false=not migrated yet

function isMissingColumn(error) {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /(email_verified|must_reset_password)/i.test(error.message || "") &&
      /(does not exist|could not find|schema cache|column)/i.test(error.message || "")
  );
}

async function fetchUserBy(supabase, column, value) {
  if (_optionalCols !== false) {
    const { data, error } = await supabase
      .from("users").select(FULL_COLS).eq(column, value).maybeSingle();
    if (!error) { _optionalCols = true; return { data, error: null }; }
    if (!isMissingColumn(error)) return { data: null, error };
    _optionalCols = false; // migration not applied — degrade gracefully
    console.warn("auth: verification columns absent — running in pre-migration mode");
  }
  const { data, error } = await supabase
    .from("users").select(CORE_COLS).eq(column, value).maybeSingle();
  return { data, error };
}

async function insertUserRow(supabase, base) {
  if (_optionalCols !== false) {
    const { data, error } = await supabase
      .from("users").insert({ ...base, email_verified: false }).select(FULL_COLS).single();
    if (!error) { _optionalCols = true; return { data, error: null }; }
    if (!isMissingColumn(error)) return { data: null, error };
    _optionalCols = false;
  }
  return supabase.from("users").insert(base).select(CORE_COLS).single();
}

// Best-effort clear of the rotation flag. Never allowed to fail the caller: the
// password change is the critical operation and must have already succeeded.
async function clearMustReset(supabase, userId) {
  if (_optionalCols === false) return;
  const { error } = await supabase
    .from("users").update({ must_reset_password: false }).eq("id", userId);
  if (error && isMissingColumn(error)) _optionalCols = false;
}

const SITE_URL = "https://www.luxproperty.ai";

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY not set — cannot send email to", to);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "LuxProperty.ai <welcome@luxproperty.ai>", to: [to], subject, html }),
    });
    if (!res.ok) console.error("Resend failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Resend threw:", err.message);
    return false;
  }
}

function emailShell(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;text-align:center;">
          <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#B8860B;font-weight:600;">LUXPROPERTY.AI</p>
        </td></tr>
        <tr><td style="background:#1A1612;border-radius:12px;padding:40px;">${body}</td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9A9490;">LuxProperty AI Ltd · Company No. 17158079</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

function ctaButton(url, label) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td align="center">
    <a href="${url}" style="display:inline-block;background:#B8860B;color:#FAF8F4;text-decoration:none;font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;">${label}</a>
  </td></tr></table>`;
}

async function issueVerificationEmail(supabase, user) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24h
  const { error } = await supabase.from("email_verification_tokens").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
  });
  if (error) {
    console.error("Could not store verification token:", error.message);
    return false;
  }
  const url = `${SITE_URL}/verify-email?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: "Confirm your email — LuxProperty.ai",
    html: emailShell(
      "Confirm your email",
      `<p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#FAF8F4;">Confirm your email</p>
       <p style="margin:0 0 28px;font-size:15px;color:#9A9490;line-height:1.6;">
         Hi ${user.name}, please confirm this address so we can reach you about your account. This link expires in 24 hours.
       </p>
       ${ctaButton(url, "Confirm Email")}
       <p style="margin:0;font-size:12px;color:#9A9490;">If you didn't create a LuxProperty.ai account, you can safely ignore this email.</p>`
    ),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = req.query.action;

  // ── SIGN UP ──────────────────────────────────────────────────────────────
  if (action === "signup") {
    const { name, password } = req.body || {};
    const emailCheck = validateEmail(req.body?.email);
    if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });
    const email = emailCheck.email;

    if (!String(name || "").trim()) {
      return res.status(400).json({ error: "Please enter your name." });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });

    const supabase = serviceClient();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const password_hash = await hashPassword(password);

    const { data, error } = await insertUserRow(supabase, {
      name: String(name).trim(),
      email,
      password_hash,
      plan: "explorer",
    });

    if (error || !data) {
      console.error("signup insert failed:", error?.message);
      return res.status(500).json({ error: "Could not create account. Please try again." });
    }

    // Fire and forget — a failed email must not fail the sign-up.
    issueVerificationEmail(supabase, data).catch(() => {});

    return res.status(200).json({ ok: true, user: publicUser(data) });
  }

  // ── SIGN IN ──────────────────────────────────────────────────────────────
  if (action === "signin") {
    const { password } = req.body || {};
    const email = String(req.body?.email || "").toLowerCase().trim();
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const supabase = serviceClient();

    const { data, error } = await fetchUserBy(supabase, "email", email);

    if (error) {
      console.error("signin lookup failed:", error.message);
      return res.status(500).json({ error: "Could not sign in. Please try again." });
    }

    // Identical response whether the account is missing or the password is wrong —
    // no account enumeration. (The old client said "No account found with this email.")
    const INVALID = "Incorrect email or password.";
    if (!data) return res.status(401).json({ error: INVALID });

    const ok = await verifyPassword(supabase, data.id, password, data.password_hash);
    if (!ok) return res.status(401).json({ error: INVALID });

    return res.status(200).json({ ok: true, user: publicUser(data) });
  }

  // ── VERIFY EMAIL ─────────────────────────────────────────────────────────
  if (action === "verify-email") {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "Verification token required." });

    const supabase = serviceClient();

    const { data: row } = await supabase
      .from("email_verification_tokens")
      .select("user_id, expires_at, used")
      .eq("token", token)
      .maybeSingle();

    if (!row) return res.status(400).json({ error: "Invalid or expired verification link." });
    if (row.used) return res.status(400).json({ error: "This link has already been used. Your email is confirmed — please sign in." });
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: "This verification link has expired. Please request a new one." });
    }

    await supabase.from("users").update({ email_verified: true }).eq("id", row.user_id);
    await supabase.from("email_verification_tokens").update({ used: true }).eq("token", token);

    const { data: user } = await fetchUserBy(supabase, "id", row.user_id);

    return res.status(200).json({ ok: true, user: user ? publicUser(user) : null });
  }

  // ── RESEND VERIFICATION ──────────────────────────────────────────────────
  if (action === "resend-verification") {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const supabase = serviceClient();
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email, email_verified")
      .eq("email", email)
      .maybeSingle();
    // Always report success — never disclose whether the account exists.
    if (user && !user.email_verified) {
      await issueVerificationEmail(supabase, user);
    }
    return res.status(200).json({ ok: true });
  }

  // ── FORCED PASSWORD RESET (compromised-credential rotation) ──────────────
  // For accounts flagged must_reset_password. The user proves ownership with the
  // password they already have, then sets a new one. No email needed, so a
  // compromised password is retired at next sign-in with no mass mailout.
  if (action === "force-reset") {
    const { currentPassword, newPassword } = req.body || {};
    const email = String(req.body?.email || "").toLowerCase().trim();
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });
    if (safeEqual(currentPassword, newPassword)) {
      return res.status(400).json({ error: "Please choose a different password from your current one." });
    }

    const supabase = serviceClient();
    const { data } = await fetchUserBy(supabase, "email", email);

    if (!data) return res.status(401).json({ error: "Incorrect email or password." });

    const ok = await verifyPassword(supabase, data.id, currentPassword, data.password_hash);
    if (!ok) return res.status(401).json({ error: "Incorrect email or password." });

    // Change the password (critical) and clear the rotation flag SEPARATELY, so a
    // missing must_reset_password column can never block the actual password change.
    const password_hash = await hashPassword(newPassword);
    const { error: updErr } = await supabase
      .from("users")
      .update({ password_hash })
      .eq("id", data.id);

    if (updErr) {
      console.error("force-reset update failed:", updErr.message);
      return res.status(500).json({ error: "Could not update your password. Please try again." });
    }
    await clearMustReset(supabase, data.id);

    // Any outstanding reset links are now stale.
    await supabase.from("password_reset_tokens").update({ used: true }).eq("user_id", data.id).eq("used", false);

    return res.status(200).json({
      ok: true,
      user: publicUser({ ...data, must_reset_password: false }),
    });
  }

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

    // NOTE: this used to be `https://luxproperty.ai/#/reset-password?token=...`.
    // wouter is configured for PATH routing (<Router> with no hash hook), so a
    // hash URL resolved to path "/" and rendered the homepage — the reset link
    // never reached the reset page. Must be a real path.
    const resetUrl = `${SITE_URL}/reset-password?token=${token}`;

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

    // Hash it. This previously wrote the raw password straight into the column.
    // The password change and the must_reset_password clear are done SEPARATELY so
    // a missing rotation column (schema not migrated) can't block the reset — which
    // was the bug that made a fresh reset still fail to log in.
    const newHash = await hashPassword(password);

    const { error: updErr } = await supabase
      .from("users")
      .update({ password_hash: newHash })
      .eq("id", resetToken.user_id);

    if (updErr) {
      console.error("reset update failed:", updErr.message);
      return res.status(500).json({ error: "Could not update your password. Please try again." });
    }

    // A completed reset satisfies any forced rotation (best-effort; column may not exist).
    await clearMustReset(supabase, resetToken.user_id);

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

  // ── CONTACT / FEEDBACK ─────────────────────────────────────────────────
  if (action === "contact") {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const OWNER_EMAIL = process.env.OWNER_EMAIL || "bradleyskana@hotmail.com";

    if (!RESEND_API_KEY) {
      console.error("[contact] RESEND_API_KEY not set");
      return res.status(500).json({ error: "Email service not configured" });
    }

    const { name, email, message } = req.body || {};

    // Validation
    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "A valid email address is required" });
    }
    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return res.status(400).json({ error: "Message must be at least 5 characters" });
    }
    if (message.trim().length > 2000) {
      return res.status(400).json({ error: "Message must be under 2000 characters" });
    }

    // Sanitise
    const safeName = name.trim().slice(0, 120).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeEmail = email.trim().slice(0, 254);
    const safeMessage = message.trim().slice(0, 2000).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
    const submittedAt = new Date().toUTCString();

    // Optional: persist to Supabase
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      await supabase.from("contact_submissions").insert({
        name: safeName,
        email: safeEmail,
        message: message.trim().slice(0, 2000),
        submitted_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      // Non-fatal — log and continue to email send
      console.warn("[contact] DB insert failed (non-fatal):", dbErr?.message);
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>New feedback — LuxProperty.ai</title></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding-bottom:24px;text-align:center;">
            <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#B8860B;font-weight:600;">LUXPROPERTY.AI — FEEDBACK</p>
          </td>
        </tr>
        <tr>
          <td style="background:#1A1612;border-radius:12px;padding:36px 40px;">
            <p style="margin:0 0 6px;font-size:18px;font-weight:600;color:#FAF8F4;">New website feedback</p>
            <p style="margin:0 0 24px;font-size:13px;color:#9A9490;">Submitted ${submittedAt}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="border-top:1px solid #2A2420;"></td></tr>
            </table>
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.10em;text-transform:uppercase;color:#B8860B;font-weight:600;">From</p>
            <p style="margin:0 0 20px;font-size:15px;color:#FAF8F4;">${safeName} &lt;<a href="mailto:${safeEmail}" style="color:#B8860B;text-decoration:none;">${safeEmail}</a>&gt;</p>
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.10em;text-transform:uppercase;color:#B8860B;font-weight:600;">Message</p>
            <div style="background:#2A2420;border-radius:8px;padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#FAF8F4;line-height:1.65;">${safeMessage}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9A9490;">LuxProperty AI Ltd · Company No. 17158079</p>
          </td>
        </tr>
      </table>
    </td></tr>
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
          from: "LuxProperty.ai Feedback <welcome@luxproperty.ai>",
          to: [OWNER_EMAIL],
          reply_to: safeEmail,
          subject: `Feedback from ${safeName} — LuxProperty.ai`,
          html,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("[contact] Resend error:", err);
        return res.status(500).json({ error: "Failed to send message" });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[contact] Send error:", err);
      return res.status(500).json({ error: "Failed to send message" });
    }
  }

  return res.status(400).json({ error: "Unknown action. Use ?action=forgot|reset|welcome|contact" });
}
