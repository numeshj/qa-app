import { useEffect } from "react";
import { useAuth } from "../store/auth";

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, fetchMe, hydrated } = useAuth();
  useEffect(() => { if (!hydrated) fetchMe(); }, [hydrated, fetchMe]);
  if (!hydrated) return null; // optionally a spinner later
  return <>{children}</>;
};
