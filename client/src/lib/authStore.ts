// Supabase-backed auth store — accounts persist across sessions
// Uses public.users table; session persisted via localStorage on luxproperty.ai

import { supabase } from "./supabase";

export interface User {
  id: string;
  name: string;
  email: string;
  plan: "explorer" | "professional" | "investor";
  bonusInvestorBrief: boolean;
  /** Confirmed via the verification email. Required before subscribing. */
  emailVerified: boolean;
  /** Set on accounts whose password was exposed. Forces a rotation at next sign-in. */
  mustResetPassword: boolean;
  joinedAt: string;
}

/** Shape returned by /api/auth-email (never contains password_hash). */
type ApiUser = User;

async function postAuth(
  action: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; user?: ApiUser; token?: string; error?: string }> {
  try {
    const res = await fetch(`/api/auth-email?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Something went wrong. Please try again." };
    return { ok: true, user: data.user as ApiUser, token: data.token as string | undefined };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

type Listener = () => void;

const SESSION_KEY = "lux_session";
const TOKEN_KEY = "lux_token";

// ─── Session token ───────────────────────────────────────────────────────────
// The server-verifiable identity (HMAC-signed, minted at sign-in). Sent as a
// Bearer header on API calls; the server derives the account from it and never
// trusts a client-supplied userId. A logged-in session that predates this upgrade
// has no token — see restoreSession(), which prompts such users to sign in again.
function loadToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
let currentToken: string | null = loadToken();

/** The signed session token, or null (anonymous / pre-upgrade session). */
export function getToken(): string | null { return currentToken; }

/** Authorization header for API calls — empty object when anonymous. */
export function authHeader(): Record<string, string> {
  return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
}

// A session cached before signed tokens existed (a logged-in user, but no lux_token)
// can no longer authenticate. restoreSession() sets this so the app can show a gentle
// "please sign in again" prompt instead of silently rendering anonymous/locked content.
let reauthRequired = false;
export function needsReauth(): boolean { return reauthRequired; }

// ─── Session helpers ─────────────────────────────────────────────────────────
function saveSession(user: User) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {}
}

function loadSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

// ─── In-memory state ─────────────────────────────────────────────────────────
let currentUser: User | null = loadSession(); // restore from localStorage on load
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Return a void unsubscribe (Set.delete returns boolean, which is not a valid
  // React useEffect destructor — callers return this directly from useEffect).
  return () => { listeners.delete(listener); };
}

export function getUser(): User | null {
  return currentUser;
}

// Re-validate session against Supabase on app load (plan may have changed)
export async function restoreSession(): Promise<void> {
  const cached = loadSession();
  if (!cached) return;

  // SECURITY UPGRADE TRANSITION (clean cut): a session created before signed tokens
  // existed has a cached user but no lux_token, so it can no longer authenticate to
  // the API. Rather than silently degrading them to anonymous/locked content, flag a
  // re-auth prompt and stop. Signing in again mints a token and clears the flag; the
  // cached user is kept so the prompt can greet them by name.
  if (!loadToken()) {
    reauthRequired = true;
    notify();
    return;
  }

  // Reads non-sensitive columns only. password_hash is revoked from the anon role,
  // so it is not selectable from the browser at all — by design.
  //
  // SCHEMA-TOLERANT: email_verified / must_reset_password only exist once the auth
  // migration has run. Selecting a non-existent column makes PostgREST reject the
  // WHOLE query, which previously errored here and wiped the session — logging
  // everyone out on page load. So we try the full set, then fall back to the
  // always-present columns, keeping whatever verification state the session already
  // had. Only a genuine "no such user" clears the session.
  const CORE = "id, name, email, plan, bonus_investor_brief, created_at";
  const full = await supabase
    .from("users")
    .select(`${CORE}, email_verified, must_reset_password`)
    .eq("id", cached.id)
    .maybeSingle();

  let data = full.data as Record<string, unknown> | null;
  let error = full.error;

  if (error) {
    // Likely the optional columns aren't migrated yet — retry with core columns.
    const base = await supabase.from("users").select(CORE).eq("id", cached.id).maybeSingle();
    data = base.data as Record<string, unknown> | null;
    error = base.error;
  }

  if (error) {
    // A real query/transport error (not "row not found"). Do NOT nuke the session
    // over a transient failure — keep the cached user and try again next load.
    return;
  }
  if (!data) {
    // Account genuinely no longer exists.
    clearSession();
    currentUser = null;
    notify();
    return;
  }

  // Update with latest state from DB (catches Stripe-triggered upgrades, etc.).
  // Missing optional columns fall back to the cached value, then to safe defaults.
  currentUser = {
    id: data.id as string,
    name: data.name as string,
    email: data.email as string,
    plan: data.plan as User["plan"],
    bonusInvestorBrief: !!data.bonus_investor_brief,
    emailVerified:
      data.email_verified === undefined ? cached.emailVerified ?? true : !!data.email_verified,
    mustResetPassword:
      data.must_reset_password === undefined ? cached.mustResetPassword ?? false : !!data.must_reset_password,
    joinedAt: data.created_at as string,
  };
  saveSession(currentUser);
  notify();
}

/** Applies an authenticated user returned by the server. */
function setUser(user: User, token?: string | null) {
  currentUser = user;
  saveSession(currentUser);
  if (token !== undefined) {
    currentToken = token;
    if (token) reauthRequired = false; // a fresh token resolves the transition prompt
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }
  notify();
  // Carry-over: the moment a real token lands (sign-up / sign-in / forced reset), claim
  // any anonymous brief so it appears in "My briefs" instead of being lost. Best-effort
  // and idempotent server-side (inlined here rather than importing lib/library to avoid a
  // circular import — library imports authHeader/getToken from this module).
  if (token) claimAnonCarryover(token);
}

/**
 * Link the anonymous soft-gate brief to the now-signed-in account. The server reads the
 * signed HttpOnly `lux_anon` cookie (sent automatically, same-origin) and records it in
 * carried_briefs, then clears the cookie. Fire-and-forget: never blocks or fails auth.
 */
function claimAnonCarryover(token: string) {
  try {
    fetch("/api/my-briefs", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "claim" }),
    }).catch(() => {});
  } catch {}
}

/** Re-reads the signed-in user from the DB (e.g. after email verification). */
export async function refreshUser(): Promise<void> {
  await restoreSession();
}

// ─── Sign Up ────────────────────────────────────────────────────────────────
export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  // Client-side checks are a UX nicety only. The server re-validates everything
  // (format, disposable domains, length, duplicate email) and is the real gate —
  // never trust the browser. See api/auth-email.js ?action=signup.
  const key = email.toLowerCase().trim();
  if (!name.trim()) return { ok: false, error: "Please enter your name." };
  if (!isValidEmailFormat(key)) return { ok: false, error: "Please enter a valid email address." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const result = await postAuth("signup", { name: name.trim(), email: key, password });
  if (!result.ok || !result.user) return { ok: false, error: result.error };

  setUser(result.user, result.token ?? null);

  // Welcome email (fire and forget — the verification email is sent server-side
  // as part of signup and is the one that matters).
  fetch("/api/auth-email?action=welcome", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), email: key }),
  }).catch(() => {});

  return { ok: true };
}

// ─── Sign In ────────────────────────────────────────────────────────────────
// Runs entirely server-side. The password never touches Supabase from the browser,
// and password_hash is not readable by the anon role.
export async function signIn(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; mustResetPassword?: boolean }> {
  const key = email.toLowerCase().trim();
  if (!key || !password) return { ok: false, error: "Please enter your email and password." };

  const result = await postAuth("signin", { email: key, password });
  if (!result.ok || !result.user) return { ok: false, error: result.error };

  setUser(result.user, result.token ?? null);
  return { ok: true, mustResetPassword: result.user.mustResetPassword };
}

// ─── Forced password rotation ───────────────────────────────────────────────
// For accounts flagged must_reset_password (their old password was exposed).
// The user proves ownership with their current password, then sets a new one.
export async function forceResetPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await postAuth("force-reset", {
    email: email.toLowerCase().trim(),
    currentPassword,
    newPassword,
  });
  if (!result.ok || !result.user) return { ok: false, error: result.error };
  setUser(result.user, result.token ?? null);
  return { ok: true };
}

/** Shared with the sign-up form. Mirrors the server regex in api/auth-email.js. */
export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(String(email).toLowerCase().trim());
}


// ─── Clear bonus Investor brief (called after one use) ───────────────────────
export async function clearBonusInvestorBrief(): Promise<void> {
  if (!currentUser) return;
  await supabase
    .from("users")
    .update({ bonus_investor_brief: false })
    .eq("id", currentUser.id);
  currentUser = { ...currentUser, bonusInvestorBrief: false };
  saveSession(currentUser);
  notify();
}

// ─── Sign Out ────────────────────────────────────────────────────────────────
export function signOut() {
  currentUser = null;
  clearSession();
  currentToken = null;
  reauthRequired = false;
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  notify();
}
