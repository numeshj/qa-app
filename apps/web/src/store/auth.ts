import { create } from "zustand";
import { api } from "../api/client";

interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean; // indicates we've attempted to restore session
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  setUser: (u: User | null) => void;
}

export const useAuth = create<AuthState>((set) => {
  const storedUser = (() => {
    try { const raw = localStorage.getItem('user'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  })();
  return {
  user: storedUser,
  loading: false,
  error: null,
  hydrated: !!storedUser || !!localStorage.getItem('accessToken'),
  setUser: (u) => { if (u) localStorage.setItem('user', JSON.stringify(u)); else localStorage.removeItem('user'); set({ user: u }); },
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post("/auth/login", { email, password });
      const { accessToken, refreshToken, user } = res.data.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, loading: false, hydrated: true });
      return true;
    } catch (e: any) {
      set({ error: e.response?.data?.message || "Login failed", loading: false, hydrated: true });
      return false;
    }
  },
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem('user');
    set({ user: null, hydrated: true });
  },
  fetchMe: async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { set({ hydrated: true }); return; }
    try {
      const res = await api.get("/auth/me");
      localStorage.setItem('user', JSON.stringify(res.data.data));
      set({ user: res.data.data, hydrated: true });
    } catch {
      localStorage.removeItem('user');
      set({ user: null, hydrated: true });
    }
  }
};
});
