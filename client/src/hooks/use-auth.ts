import { useState, useEffect } from "react";
import { getUser, subscribe, type User } from "@/lib/authStore";

export function useAuth(): { user: User | null; isSignedIn: boolean } {
  const [user, setUser] = useState<User | null>(getUser());

  useEffect(() => {
    const unsub = subscribe(() => setUser(getUser()));
    return unsub;
  }, []);

  return { user, isSignedIn: user !== null };
}
