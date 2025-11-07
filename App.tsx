// App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import SpectatorDashboard from './components/SpectatorDashboard';
import ConfigurationWarning from './components/ConfigurationWarning';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfigurationProvider } from './context/ConfigurationContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/Toast';
import { LoginPage } from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RecoverAccountPage from './pages/RecoverAccountPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagementPage from './pages/admin/UserManagementPage';
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import { BotsPage } from './pages/config/BotsPage';
import { BotEditorPage } from './pages/config/BotEditorPage';
import { ProvidersPage } from './pages/config/ProvidersPage';
import { CredentialsPage } from './pages/config/CredentialsPage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { BotDeepDivePage } from './pages/analytics/BotDeepDivePage';
import { AppMode } from './types';
import { isAppConfigured } from './config';

// Admin Route Wrapper - Only accessible by admins
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-500 mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">You do not have permission to access this page.</p>
          <Link to="/dashboard" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Navigation Component
const Navigation: React.FC = () => {
  const location = useLocation();
  const { logout, user, isAdmin } = useAuth();
  
  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const navLinkClass = (path: string) => `
    px-4 py-2 rounded-lg font-medium transition-colors
    ${isActive(path) 
      ? 'bg-blue-600 text-white' 
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }
  `;

  return (
    <nav className="bg-gray-800 border-b border-gray-700 overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-6 max-w-full">
        <div className="flex items-center justify-between gap-2 py-3 min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
            <Link to="/dashboard" className={navLinkClass('/dashboard')}>
              Dashboard
            </Link>
            <Link to="/analytics" className={navLinkClass('/analytics')}>
              Analytics
            </Link>
            <Link to="/leaderboard" className={navLinkClass('/leaderboard')}>
              Leaderboard
            </Link>
            <Link to="/config/bots" className={navLinkClass('/config/bots')}>
              Bots
            </Link>
            <Link to="/config/providers" className={navLinkClass('/config/providers')}>
              AI Providers
            </Link>
            <Link to="/config/credentials" className={navLinkClass('/config/credentials')}>
              API Keys
            </Link>
            {/* Admin-only navigation link */}
            {isAdmin && (
              <Link to="/admin" className={navLinkClass('/admin')}>
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 ml-2 sm:ml-4 shrink-0">
            <Link 
              to="/account"
              className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline"
              title="Account Settings"
            >
              👤 {user?.username}
            </Link>
            <button
              onClick={logout}
              className="px-3 sm:px-4 py-2 text-sm rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Main App Layout
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<AppMode>('spectator');
  const [isPaused, setIsPaused] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'broadcast') {
      setMode('broadcast');
    }
  }, []);

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans overflow-x-hidden">
      <Header 
        isPaused={isPaused} 
        onTogglePause={() => setIsPaused(!isPaused)} 
        mode={mode}
        isBroadcasting={isBroadcasting}
      />
      <Navigation />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-full">
        {children}
      </main>
    </div>
  );
};

// Dashboard Routes Component
const DashboardRoutes: React.FC = () => {
  // Default to broadcast mode for self-hosted instances
  const [mode, setMode] = useState<AppMode>('broadcast');
  const [isPaused, setIsPaused] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Allow switching to spectator mode via URL parameter
    if (params.get('mode') === 'spectator') {
      setMode('spectator');
    }
  }, []);

  const handleBroadcastingChange = (isB: boolean) => {
    setIsBroadcasting(isB);
  };

  // For self-hosted instances, no additional password gate needed (already JWT authenticated)
  if (mode === 'broadcast') {
    return <Dashboard isPaused={isPaused} onBroadcastingChange={handleBroadcastingChange} />;
  }
  
  return <SpectatorDashboard />;
};

// Auth-protected routes wrapper
const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  // Public routes accessible without authentication
  const publicRoutes = ['/login', '/register', '/recover'];
  const isPublicRoute = publicRoutes.includes(location.pathname);

  if (!isAuthenticated && !isPublicRoute) {
    return <LoginPage />;
  }

  if (isAuthenticated && isPublicRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render public routes without authentication
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/recover" element={<RecoverAccountPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Render authenticated routes
  return (
    <ConfigurationProvider>
      <Routes>
        {/* Dashboard Route */}
        <Route path="/dashboard" element={
          <AppLayout>
            <DashboardRoutes />
          </AppLayout>
        } />

        {/* Analytics Routes */}
        <Route path="/analytics" element={
          <AppLayout>
            <AnalyticsPage />
          </AppLayout>
        } />
        <Route path="/analytics/bot/:botId" element={
          <AppLayout>
            <BotDeepDivePage />
          </AppLayout>
        } />

        {/* Leaderboard Route */}
        <Route path="/leaderboard" element={
          <AppLayout>
            <LeaderboardPage />
          </AppLayout>
        } />

        {/* Configuration Routes */}
        <Route path="/config/bots" element={
          <AppLayout>
            <BotsPage />
          </AppLayout>
        } />
        <Route path="/config/bots/:botId" element={
          <AppLayout>
            <BotEditorPage />
          </AppLayout>
        } />
        <Route path="/config/providers" element={
          <AppLayout>
            <ProvidersPage />
          </AppLayout>
        } />
        <Route path="/config/credentials" element={
          <AppLayout>
            <CredentialsPage />
          </AppLayout>
        } />

        {/* Account Settings Route */}
        <Route path="/account" element={
          <AppLayout>
            <AccountSettingsPage />
          </AppLayout>
        } />

        {/* Admin Routes - Only accessible by admins */}
        <Route path="/admin" element={
          <AppLayout>
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          </AppLayout>
        } />
        <Route path="/admin/users" element={
          <AppLayout>
            <AdminRoute>
              <UserManagementPage />
            </AdminRoute>
          </AppLayout>
        } />
        <Route path="/admin/settings" element={
          <AppLayout>
            <AdminRoute>
              <SystemSettingsPage />
            </AdminRoute>
          </AppLayout>
        } />

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ConfigurationProvider>
  );
};

const App: React.FC = () => {
  if (!isAppConfigured) {
    return <ConfigurationWarning />;
  }
  
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AuthenticatedApp />
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
