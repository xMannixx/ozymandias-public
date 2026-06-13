import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const AUTH_STORAGE_KEY = "ozy.jwt";
const AUTH_LOGOUT_EVENT = "ozy:auth:logout";
const AUTH_BYPASS = String(import.meta.env.VITE_AUTH_BYPASS ?? "false").toLowerCase() === "true";
const AUTH_BYPASS_TOKEN = "dev-bypass-token";

type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readTokenFromStorage(): string | null {
  if (typeof window === "undefined") {
    return AUTH_BYPASS ? AUTH_BYPASS_TOKEN : null;
  }
  const token = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (token) {
    return token;
  }
  return AUTH_BYPASS ? AUTH_BYPASS_TOKEN : null;
}

export function getToken(): string | null {
  return readTokenFromStorage();
}

export function forceLogout(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (AUTH_BYPASS) {
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [token, setToken] = useState<string | null>(() => readTokenFromStorage());

  useEffect(() => {
    if (!AUTH_BYPASS) {
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, AUTH_BYPASS_TOKEN);
    setToken(AUTH_BYPASS_TOKEN);
  }, []);

  useEffect(() => {
    const onLogout = (): void => setToken(null);
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login: (newToken: string) => {
        window.localStorage.setItem(AUTH_STORAGE_KEY, newToken);
        setToken(newToken);
      },
      logout: () => {
        if (AUTH_BYPASS) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, AUTH_BYPASS_TOKEN);
          setToken(AUTH_BYPASS_TOKEN);
          return;
        }
        forceLogout();
        setToken(null);
      },
    }),
    [token],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
