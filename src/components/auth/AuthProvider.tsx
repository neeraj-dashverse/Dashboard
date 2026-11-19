"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { rememberLoginEmail } from "@/lib/auth/remember-email";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type Role = "admin" | "viewer";
type AuthContextValue = { email: string; role: Role; signOut: () => Promise<void> };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  email,
  role,
  children,
}: {
  email: string;
  role: Role;
  children: ReactNode;
}) {
  useEffect(() => {
    if (email) rememberLoginEmail(email);
  }, [email]);

  const signOut = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return <AuthContext.Provider value={{ email, role, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
