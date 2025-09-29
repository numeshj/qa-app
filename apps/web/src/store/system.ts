import { create } from 'zustand';

interface SystemState {
  backendOnline: boolean;
  lastCheck: number | null;
  setOnline: (online: boolean) => void;
}

export const useSystem = create<SystemState>((set) => ({
  backendOnline: true,
  lastCheck: null,
  setOnline: (online) => set({ backendOnline: online, lastCheck: Date.now() })
}));
