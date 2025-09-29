import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import TestCasesPage from './pages/TestCasesPage';
import DefectsPage from './pages/DefectsPage';
import AuditPage from './pages/AuditPage';
import { Suspense } from 'react';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [
      { index: true, element: <Suspense fallback={<div>Loading...</div>}><DashboardPage /></Suspense> },
      { path: 'dashboard', element: <Navigate to='/app' replace /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'test-cases', element: <TestCasesPage /> },
      { path: 'defects', element: <DefectsPage /> },
      { path: 'audit', element: <AuditPage /> }
    ]
  },
  { path: '*', element: <Navigate to='/login' replace /> }
], {
  // Cast to any because type defs may lag behind documented future flags
  future: {
    // Opt-in to React Router v7 behaviors early
    v7_startTransition: true,
    v7_relativeSplatPath: true
  } as any
});
