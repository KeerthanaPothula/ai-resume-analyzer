import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User, AuthState } from "../types";
import { authApi } from "../lib/api";

interface AuthContextType extends AuthState {
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    full_name: string;
    password: string;
    role: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

function persistTokens(access: string, refresh: string) {
  localStorage.setItem("token", access);
  localStorage.setItem("refresh_token", refresh);
}

function clearTokens() {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
  });
  const [loading, setLoading] = useState(true);

  // On mount: try to restore session.
  // 1. If a stored access token exists, validate it with /auth/me.
  // 2. If /auth/me returns 401, the axios interceptor in api.ts will automatically
  //    attempt a silent refresh using the stored refresh_token before we even see
  //    the error here — so we only need to handle a total failure.
  useEffect(() => {
    const token = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refresh_token");

    if (!token && !refreshToken) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((res) => {
        setState({
          user: res.data,
          token: localStorage.getItem("token"),
          isAuthenticated: true,
        });
      })
      .catch(() => {
        // Silent refresh failed or no tokens at all
        clearTokens();
        setState({ user: null, token: null, isAuthenticated: false });
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { access_token, refresh_token, user } = res.data;
    persistTokens(access_token, refresh_token);
    setState({ user, token: access_token, isAuthenticated: true });
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      full_name: string;
      password: string;
      role: string;
    }) => {
      // Registration now requires email verification before login is permitted.
      // The backend returns a message + email only — no tokens are issued yet.
      await authApi.register(data);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      // Revoke refresh token server-side
      await authApi.logout();
    } catch {
      // Ignore network errors on logout — clear locally regardless
    }
    clearTokens();
    setState({ user: null, token: null, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}