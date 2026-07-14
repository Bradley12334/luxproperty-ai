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
): Promise<{ ok: boolean; user?: ApiUser; error?: string }> {
  try {
    const res = await fetch(`/api/auth-email?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Something went wrong. Please try again." };
    return { ok: true, user: data.user as ApiUser };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

type Listener = () => void;

const SESSION_KEY = "lux_session";

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

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUser(): User | null {
  return currentUser;
}

// Re-validate session against Supabase on app load (plan may have changed)
export async function restoreSession(): Promise<void> {
  const cached = loadSession();
  if (!cached) return;

  // Reads non-sensitive columns only. password_hash is revoked from the anon role,
  // so it is not selectable from the browser at all — by design.
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, plan, bonus_investor_brief, email_verified, must_reset_password, created_at")
    .eq("id", cached.id)
    .maybeSingle();

  if (error || !data) {
    // Session invalid — clear it
    clearSession();
    currentUser = null;
    notify();
    return;
  }

  // Update with latest state from DB (catches Stripe-triggered upgrades,
  // email verification completed in another tab, etc.)
  currentUser = {
    id: data.id,
    name: data.name,
    email: data.email,
    plan: data.plan as User["plan"],
    bonusInvestorBrief: !!data.bonus_investor_brief,
    emailVerified: !!data.email_verified,
    mustResetPassword: !!data.must_reset_password,
    joinedAt: data.created_at,
  };
  saveSession(currentUser);
  notify();
}

/** Applies an authenticated user returned by the server. */
function setUser(user: User) {
  currentUser = user;
  saveSession(currentUser);
  notify();
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

  setUser(result.user);

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

  setUser(result.user);
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
  setUser(result.user);
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
  notify();
}
