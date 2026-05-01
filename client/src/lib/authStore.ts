// Simple in-memory auth store (no localStorage — sandbox policy)
// In production this would talk to a real backend with JWT/sessions

export interface User {
  id: string;
  name: string;
  email: string;
  plan: "explorer" | "professional" | "investor";
  joinedAt: string;
}

type Listener = () => void;

// In-memory "database" of registered users for this session
const registeredUsers: Record<string, { name: string; email: string; password: string; plan: "explorer" }> = {};

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

export function signUp(name: string, email: string, password: string): { ok: boolean; error?: string } {
  const key = email.toLowerCase().trim();
  if (!name.trim()) return { ok: false, error: "Please enter your name." };
  if (!key.includes("@")) return { ok: false, error: "Please enter a valid email address." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (registeredUsers[key]) return { ok: false, error: "An account with this email already exists." };

  registeredUsers[key] = { name: name.trim(), email: key, password, plan: "explorer" };

  currentUser = {
    id: Math.random().toString(36).slice(2),
    name: name.trim(),
    email: key,
    plan: "explorer",
    joinedAt: new Date().toISOString(),
  };
  notify();
  return { ok: true };
}

export function signIn(email: string, password: string): { ok: boolean; error?: string } {
  const key = email.toLowerCase().trim();
  const record = registeredUsers[key];
  if (!record) return { ok: false, error: "No account found with this email." };
  if (record.password !== password) return { ok: false, error: "Incorrect password." };

  currentUser = {
    id: Math.random().toString(36).slice(2),
    name: record.name,
    email: key,
    plan: record.plan,
    joinedAt: new Date().toISOString(),
  };
  notify();
  return { ok: true };
}

export function signOut() {
  currentUser = null;
  notify();
}
