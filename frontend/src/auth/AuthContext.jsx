import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthCtx = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Axios with credentials
export const http = axios.create({ baseURL: API, withCredentials: true, headers: { "Content-Type": "application/json" } });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = guest, object = authenticated
  const [loginOpen, setLoginOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await http.get("/auth/me");
      setUser(data || null);
    } catch (e) { setUser(null); }
  }, []);

  useEffect(() => {
    // If returning from Google OAuth callback, skip /me check — AuthCallback will handle it.
    if (window.location.hash?.includes("session_id=")) { setUser(null); return; }
    refresh();
  }, [refresh]);

  const loginEmail = async (email, password) => {
    const { data } = await http.post("/auth/login", { email, password });
    setUser(data);
    return data;
  };
  const registerEmail = async (email, password, name) => {
    const { data } = await http.post("/auth/register", { email, password, name });
    setUser(data);
    return data;
  };
  const logout = async () => {
    try { await http.post("/auth/logout"); } catch(e){}
    setUser(null);
  };
  const setSessionFromGoogle = async (session_id) => {
    const { data } = await http.post("/auth/session", { session_id });
    setUser(data);
    return data;
  };

  return (
    <AuthCtx.Provider value={{ user, loading: user === undefined, loginEmail, registerEmail, logout, refresh, setSessionFromGoogle, loginOpen, setLoginOpen }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }
