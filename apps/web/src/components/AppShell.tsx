import { Layout, Menu, Tag } from "antd";
import {
  LogoutOutlined,
  DashboardOutlined,
  BugOutlined,
  FolderOutlined,
  ExperimentOutlined,
  FileSearchOutlined
} from "@ant-design/icons";
import type { CSSProperties } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useAuth } from "../store/auth";

const { Sider, Header, Content } = Layout;

const appBackgroundStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
  padding: 24,
  display: "flex"
};

const chromeStyle: CSSProperties = {
  flex: 1,
  minHeight: "calc(100vh - 48px)",
  borderRadius: 32,
  overflow: "hidden",
  background: "linear-gradient(160deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.65) 100%)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 40px 80px rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(16px)",
  color: "#e2e8f0"
};

const siderStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)",
  borderRight: "1px solid rgba(148, 163, 184, 0.12)",
  paddingBottom: 16
};

const headerStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(56, 189, 248, 0.12) 100%)",
  borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingInline: 24,
  color: "#e2e8f0",
  backdropFilter: "blur(10px)"
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontWeight: 500
};

const contentContainerStyle: CSSProperties = {
  margin: 24,
  marginBottom: 32,
  background: "linear-gradient(135deg, rgba(226, 232, 240, 0.12) 0%, rgba(148, 163, 184, 0.12) 100%)",
  padding: 24,
  borderRadius: 28,
  border: "1px solid rgba(148, 163, 184, 0.16)",
  boxShadow: "0 24px 45px rgba(15, 23, 42, 0.35)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

export const AppShell = () => {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const items = useMemo(
    () => [
      { key: "/app", icon: <DashboardOutlined />, label: <Link to="/app">Dashboard</Link> },
      { key: "/app/projects", icon: <FolderOutlined />, label: <Link to="/app/projects">Projects</Link> },
      { key: "/app/test-cases", icon: <ExperimentOutlined />, label: <Link to="/app/test-cases">Test Cases</Link> },
      { key: "/app/defects", icon: <BugOutlined />, label: <Link to="/app/defects">Defects</Link> },
      { key: "/app/audit", icon: <FileSearchOutlined />, label: <Link to="/app/audit">Audit</Link> }
    ],
    []
  );

  // Redirect handled by routing guard outside (AuthGate). If user missing, we can render minimal shell.

  return (
    <div style={appBackgroundStyle}>
      <Layout style={chromeStyle}>
        <Sider breakpoint="lg" collapsedWidth="0" style={siderStyle}>
          <div
            style={{
              color: "#f8fafc",
              padding: 20,
              fontWeight: 700,
              letterSpacing: 1,
              fontSize: 18,
              textTransform: "uppercase"
            }}
          >
            QA Console
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[loc.pathname]}
            items={items}
            style={{
              background: "transparent",
              borderRight: "none"
            }}
          />
        </Sider>
        <Layout style={{ background: "transparent" }}>
          <Header style={headerStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                {user?.email ?? "Signed in"}
              </Tag>
            </div>
            <div
              style={{ ...headerActionsStyle, cursor: "pointer" }}
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              <LogoutOutlined />
              <span>Logout</span>
            </div>
          </Header>
          <Content style={contentContainerStyle}>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </div>
  );
};
