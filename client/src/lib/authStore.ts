// Supabase-backed auth store — accounts persist across sessions
// Uses public.users table; session persisted via localStorage on luxproperty.ai

import { supabase } from "./supabase";

export interface User {
  id: string;
  name: string;
  email: string;
  plan: "explorer" | "professional" | "investor";
  joinedAt: string;
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

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, plan, created_at")
    .eq("id", cached.id)
    .maybeSingle();

  if (error || !data) {
    // Session invalid — clear it
    clearSession();
    currentUser = null;
    notify();
    return;
  }

  // Update with latest plan from DB (catches Stripe-triggered upgrades)
  currentUser = {
    id: data.id,
    name: data.name,
    email: data.email,
    plan: data.plan as User["plan"],
    joinedAt: data.created_at,
  };
  saveSession(currentUser);
  notify();
}

// ─── Sign Up ────────────────────────────────────────────────────────────────
export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const key = email.toLowerCase().trim();
  if (!name.trim()) return { ok: false, error: "Please enter your name." };
  if (!key.includes("@")) return { ok: false, error: "Please enter a valid email address." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", key)
    .maybeSingle();

  if (existing) return { ok: false, error: "An account with this email already exists." };

  const { data, error } = await supabase
    .from("users")
    .insert({ name: name.trim(), email: key, password_hash: password, plan: "explorer" })
    .select("id, name, email, plan, created_at")
    .single();

  if (error || !data) {
    console.error("Supabase signUp error:", error);
    return { ok: false, error: "Could not create account. Please try again." };
  }

  currentUser = {
    id: data.id,
    name: data.name,
    email: data.email,
    plan: data.plan as User["plan"],
    joinedAt: data.created_at,
  };
  saveSession(currentUser);
  notify();
  return { ok: true };
}

// ─── Sign In ────────────────────────────────────────────────────────────────
export async function signIn(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const key = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, plan, password_hash, created_at")
    .eq("email", key)
    .maybeSingle();

  if (error) {
    console.error("Supabase signIn error:", error);
    return { ok: false, error: "Could not sign in. Please try again." };
  }
  if (!data) return { ok: false, error: "No account found with this email." };
  if (data.password_hash !== password) return { ok: false, error: "Incorrect password." };

  currentUser = {
    id: data.id,
    name: data.name,
    email: data.email,
    plan: data.plan as User["plan"],
    joinedAt: data.created_at,
  };
  saveSession(currentUser);
  notify();
  return { ok: true };
}

// ─── Sign Out ────────────────────────────────────────────────────────────────
export function signOut() {
  currentUser = null;
  clearSession();
  notify();
}
