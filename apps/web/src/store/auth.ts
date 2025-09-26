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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post("/auth/login", { email, password });
      const { accessToken, refreshToken, user } = res.data.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      set({ user, loading: false });
      return true;
    } catch (e: any) {
      set({ error: e.response?.data?.message || "Login failed", loading: false });
      return false;
    }
  },
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ user: null });
  },
  fetchMe: async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      const res = await api.get("/auth/me");
      set({ user: res.data.data });
    } catch {
      // ignore
    }
  }
}));
