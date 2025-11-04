// App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import SpectatorDashboard from './components/SpectatorDashboard';
import ConfigurationWarning from './components/ConfigurationWarning';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfigurationProvider } from './context/ConfigurationContext';
import { LoginPage } from './pages/LoginPage';
import { BotsPage } from './pages/config/BotsPage';
import { BotEditorPage } from './pages/config/BotEditorPage';
import { ProvidersPage } from './pages/config/ProvidersPage';
import { SettingsPage } from './pages/config/SettingsPage';
import { CredentialsPage } from './pages/config/CredentialsPage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { BotDeepDivePage } from './pages/analytics/BotDeepDivePage';
import { AppMode } from './types';
import { isAppConfigured } from './config';

// Navigation Component
const Navigation: React.FC = () => {
  const location = useLocation();
  const { logout, user } = useAuth();
  
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
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Link to="/dashboard" className={navLinkClass('/dashboard')}>
              Dashboard
            </Link>
            <Link to="/analytics" className={navLinkClass('/analytics')}>
              Analytics
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
            <Link to="/config/settings" className={navLinkClass('/config/settings')}>
              Settings
            </Link>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <span className="text-sm text-gray-400">
              {user?.username}
            </span>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-700 text-white"
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
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans">
      <Header 
        isPaused={isPaused} 
        onTogglePause={() => setIsPaused(!isPaused)} 
        mode={mode}
        isBroadcasting={isBroadcasting}
      />
      <Navigation />
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

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
        <Route path="/config/settings" element={
          <AppLayout>
            <SettingsPage />
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
        <AuthenticatedApp />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
