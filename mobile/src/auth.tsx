import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import * as Application from "expo-application";
import { login as loginRequest, logout as logoutRequest, onSessionExpired } from "./api";
import { sessionStore } from "./session-store";
import type { Account } from "./types";

type AuthValue = { account: Account | null; loading: boolean; login(email: string, password: string): Promise<void>; logout(): Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [account, setAccount] = useState<Account | null>(null), [loading, setLoading] = useState(true);
  useEffect(() => { sessionStore.get().then(session => setAccount(session?.account || null)).finally(() => setLoading(false)); }, []);
  useEffect(() => onSessionExpired(() => setAccount(null)), []);
  const value = useMemo<AuthValue>(() => ({ account, loading,
    async login(email, password) { const session = await loginRequest(email, password, `${Application.applicationName || "Pelada"} ${Application.nativeApplicationVersion || "dev"}`); setAccount(session.account); },
    async logout() { await logoutRequest(); setAccount(null); },
  }), [account, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider ausente."); return value; }
