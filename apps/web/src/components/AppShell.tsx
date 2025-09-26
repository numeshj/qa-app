import { Layout, Menu } from "antd";
import { LogoutOutlined, DashboardOutlined, BugOutlined, FolderOutlined, ExperimentOutlined } from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useEffect } from "react";

const { Sider, Header, Content } = Layout;

export const AppShell = () => {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const items = [
    { key: "/app", icon: <DashboardOutlined />, label: <Link to="/app">Dashboard</Link> },
    { key: "/app/projects", icon: <FolderOutlined />, label: <Link to="/app/projects">Projects</Link> },
    { key: "/app/test-cases", icon: <ExperimentOutlined />, label: <Link to="/app/test-cases">Test Cases</Link> },
    { key: "/app/defects", icon: <BugOutlined />, label: <Link to="/app/defects">Defects</Link> }
  ];

  useEffect(() => {
    if (!user) nav("/login");
  }, [user, nav]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
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
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
