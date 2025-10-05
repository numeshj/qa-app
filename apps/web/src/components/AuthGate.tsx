import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Spin } from "antd";
import { useAuth } from "../store/auth";

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { fetchMe, hydrated } = useAuth();
  useEffect(() => { if (!hydrated) fetchMe(); }, [hydrated, fetchMe]);
  if (!hydrated) {
    const loaderStyle: CSSProperties = {
      minHeight: "100vh",
      background: "radial-gradient(circle at 20% 20%, rgba(96, 165, 250, 0.22), transparent 55%), radial-gradient(circle at 80% 0%, rgba(56, 189, 248, 0.24), transparent 60%), linear-gradient(180deg, #0f172a 0%, #111827 65%, #020617 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
      color: "#cbd5f5"
    };

    return (
      <div style={loaderStyle}>
        <Spin size="large" tip="Preparing workspace" />
        <div style={{ fontWeight: 500, letterSpacing: 1 }}>Authenticating session…</div>
      </div>
    );
  }
  return <>{children}</>;
};
