import { Layout, Menu, theme } from "antd";
import { Outlet, Route, Routes, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { AppShell } from "./components/AppShell";
import { AuthGate } from "./components/AuthGate";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

const { Content } = Layout;

const App = () => {
  const {
    token: { colorBgContainer }
  } = theme.useToken();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/app"
        element={
          <AuthGate>
            <AppShell />
          </AuthGate>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<div>Loading...</div>}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route path="dashboard" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
