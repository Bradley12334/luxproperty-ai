// Supabase-backed auth store — accounts persist across sessions
// Uses public.users table; no Supabase Auth SDK (we manage passwords ourselves)

import { supabase } from "./supabase";

export interface User {
  id: string;
  name: string;
  email: string;
  plan: "explorer" | "professional" | "investor";
  joinedAt: string;
}

type Listener = () => void;

// In-memory session (survives re-renders; lost on page reload — user must sign in again)
let currentUser: User | null = null;
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

  // Check if email already taken
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", key)
    .maybeSingle();

  if (existing) return { ok: false, error: "An account with this email already exists." };

  // Insert new user
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
  notify();
  return { ok: true };
}

// ─── Sign Out ────────────────────────────────────────────────────────────────
export function signOut() {
  currentUser = null;
  notify();
}
