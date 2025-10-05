import { Alert } from "antd";
import { useSystem } from "../store/system";
import React from "react";
import type { CSSProperties } from "react";

export const OfflineBanner: React.FC = () => {
  const { backendOnline, lastCheck } = useSystem();
  if (backendOnline) return null;
  const bannerStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4000,
    padding: "0 16px",
    background: "linear-gradient(135deg, rgba(225, 29, 72, 0.3) 0%, rgba(244, 63, 94, 0.2) 60%, rgba(236, 72, 153, 0.25) 100%)",
    backdropFilter: "blur(12px)"
  };
  return (
    <div style={bannerStyle}>
      <Alert
        type="error"
        banner
        message={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              gap: 16,
              color: "#f8fafc",
              fontWeight: 500,
              textShadow: "0 1px 6px rgba(15, 23, 42, 0.35)"
            }}
          >
            <span>Backend API unreachable (connection refused). Retrying in background…</span>
            {lastCheck && (
              <span style={{ fontSize: 11, opacity: 0.85 }}>
                Last check: {new Date(lastCheck).toLocaleTimeString()}
              </span>
            )}
          </div>
        }
        style={{
          borderRadius: 12,
          border: "1px solid rgba(248, 113, 113, 0.35)",
          background: "rgba(30, 41, 59, 0.78)",
          color: "#f1f5f9"
        }}
      />
    </div>
  );
};
