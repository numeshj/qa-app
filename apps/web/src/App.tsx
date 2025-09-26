import { Route, Routes, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { AppShell } from "./components/AppShell";
import { AuthGate } from "./components/AuthGate";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import TestCasesPage from "./pages/TestCasesPage";
import DefectsPage from "./pages/DefectsPage";

const App = () => (
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
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="test-cases" element={<TestCasesPage />} />
      <Route path="defects" element={<DefectsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

export default App;

