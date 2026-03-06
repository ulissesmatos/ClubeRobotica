import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { apiLogin, apiRefreshToken, apiLogout, type AdminUser } from "@/api/admin";

// ─── Context type ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  admin: AdminUser | null;
  accessToken: string | null;
  /** true while performing the initial silent token refresh on page load */
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Authenticated fetch: injects Bearer token, auto-refreshes on 401.
   * Use this instead of raw fetch for all admin API calls.
   */
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Keep a ref so authFetch always reads the latest token without stale closures
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = accessToken;

  // ── Silent refresh on mount (restores session from httpOnly cookie) ──────────
  useEffect(() => {
    apiRefreshToken()
      .then((newToken) => {
        if (newToken) {
          setAccessToken(newToken);
          // Fetch admin info
          return fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${newToken}` },
          })
            .then((r) => r.ok ? r.json() : null)
            .then((json) => {
              if (json?.admin) setAdmin(json.admin as AdminUser);
            });
        }
      })
      .catch(() => { /* no session — stay logged out */ })
      .finally(() => setIsInitializing(false));
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const { accessToken: token, admin: adminData } = await apiLogin(email, password);
    setAccessToken(token);
    setAdmin(adminData);
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const token = tokenRef.current;
    if (token) await apiLogout(token).catch(() => {});
    setAccessToken(null);
    setAdmin(null);
  }, []);

  // ── authFetch (auto-refresh on 401) ──────────────────────────────────────────
  const authFetch = useCallback(async (
    input: string,
    init: RequestInit = {}
  ): Promise<Response> => {
    const makeRequest = (token: string | null) =>
      fetch(input, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

    const res = await makeRequest(tokenRef.current);

    if (res.status === 401) {
      // Try to silently refresh the token
      const newToken = await apiRefreshToken();
      if (newToken) {
        setAccessToken(newToken);
        return makeRequest(newToken);
      }
      // Refresh failed — log out
      setAccessToken(null);
      setAdmin(null);
    }

    return res;
  }, []);

  return (
    <AuthContext.Provider
      value={{ admin, accessToken, isInitializing, login, logout, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
