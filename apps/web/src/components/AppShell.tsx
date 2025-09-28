import { Layout, Menu } from "antd";
import { LogoutOutlined, DashboardOutlined, BugOutlined, FolderOutlined, ExperimentOutlined, FileSearchOutlined } from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

const { Sider, Header, Content } = Layout;

export const AppShell = () => {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const items = [
    { key: "/app", icon: <DashboardOutlined />, label: <Link to="/app">Dashboard</Link> },
    { key: "/app/projects", icon: <FolderOutlined />, label: <Link to="/app/projects">Projects</Link> },
    { key: "/app/test-cases", icon: <ExperimentOutlined />, label: <Link to="/app/test-cases">Test Cases</Link> },
    { key: "/app/defects", icon: <BugOutlined />, label: <Link to="/app/defects">Defects</Link> },
    { key: "/app/audit", icon: <FileSearchOutlined />, label: <Link to="/app/audit">Audit</Link> }
  ];

  // Redirect handled by routing guard outside (AuthGate). If user missing, we can render minimal shell.

  return (
  <Layout style={{ minHeight: "100vh", background: '#f5f7fa' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ color: "white", padding: 16, fontWeight: 600 }}>QA App</div>
        <Menu theme="dark" mode="inline" selectedKeys={[loc.pathname]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", display: "flex", justifyContent: "space-between", paddingInline: 16 }}>
          <div>{user?.email}</div>
          <div style={{ cursor: "pointer" }} onClick={() => { logout(); nav("/login"); }}>
            <LogoutOutlined /> Logout
          </div>
        </Header>
        <Content style={{ margin: 16, background: '#fff', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};
