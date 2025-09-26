import { useEffect } from "react";
import { useAuth } from "../store/auth";

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, fetchMe } = useAuth();
  useEffect(() => { if (!user) fetchMe(); }, [user, fetchMe]);
  return <>{children}</>;
};
