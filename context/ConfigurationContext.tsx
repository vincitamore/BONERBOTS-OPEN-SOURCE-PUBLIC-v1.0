/**
 * Configuration Context
 * 
 * Centralized state management for all configuration data:
 * - Bots
 * - LLM Providers
 * - Wallets
 * - System Settings
 * - API calls to backend
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

// ============================================================================
// TYPES
// ============================================================================

export interface Bot {
  id: string;
  name: string;
  prompt: string;
  provider_id: number;
  provider_name?: string;
  provider_type?: string;
  trading_mode: 'paper' | 'real';
  is_active: boolean;
  is_paused: boolean;
  avatar_image?: string | null; // Base64 encoded image
  created_at: string;
  updated_at: string;
}

export interface LLMProvider {
  id: number;
  name: string;
  provider_type: 'openai' | 'anthropic' | 'gemini' | 'grok' | 'local' | 'custom';
  api_endpoint: string;
  model_name: string | null;
  api_key_encrypted: string | null;
  config_json: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: number;
  bot_id: string;
  exchange: string;
  api_key_encrypted: string;
  api_secret_encrypted: string;
  wallet_address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  paper_bot_initial_balance: number;
  live_bot_initial_balance: number;
  turn_interval_ms: number;
  refresh_interval_ms: number;
  minimum_trade_size_usd: number;
  symbol_cooldown_ms: number;
  trading_symbols: string[];
  broadcast_password?: string;
  max_bots: number;
  max_positions_per_bot: number;
  data_retention_days: number;
  session_timeout_hours: number;
  max_login_attempts: number;
  app_name: string;
  app_version: string;
}

interface ConfigurationContextType {
  // State
  bots: Bot[];
  providers: LLMProvider[];
  wallets: Wallet[];
  settings: SystemSettings | null;
  loading: boolean;
  error: string | null;

  // Bot operations
  fetchBots: () => Promise<void>;
  createBot: (botData: Partial<Bot>) => Promise<Bot>;
  updateBot: (botId: string, updates: Partial<Bot>) => Promise<Bot>;
  deleteBot: (botId: string) => Promise<void>;
  pauseBot: (botId: string, paused: boolean) => Promise<Bot>;
  resetBot: (botId: string) => Promise<void>;

  // Provider operations
  fetchProviders: () => Promise<void>;
  createProvider: (providerData: Partial<LLMProvider>) => Promise<LLMProvider>;
  updateProvider: (providerId: number, updates: Partial<LLMProvider>) => Promise<LLMProvider>;
  deleteProvider: (providerId: number) => Promise<void>;
  testProvider: (providerId: number) => Promise<{ success: boolean; message: string }>;

  // Wallet operations
  fetchWallets: (botId?: string) => Promise<void>;
  createWallet: (walletData: Partial<Wallet> & { api_key: string; api_secret: string }) => Promise<Wallet>;
  updateWallet: (walletId: number, updates: Partial<Wallet>) => Promise<Wallet>;
  deleteWallet: (walletId: number) => Promise<void>;

  // Settings operations
  fetchSettings: () => Promise<void>;
  updateSetting: (key: string, value: any) => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ConfigurationContext = createContext<ConfigurationContextType | undefined>(undefined);

// ============================================================================
// API BASE URL
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = `${API_BASE_URL}/api/v2`;

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export const ConfigurationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to include auth header
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });

  // ============================================================================
  // BOT OPERATIONS
  // ============================================================================

  const fetchBots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/bots`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Authentication required');
        throw new Error('Failed to fetch bots');
      }
      const data = await response.json();
      setBots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createBot = useCallback(async (botData: Partial<Bot>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/bots`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(botData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create bot');
      }
      const newBot = await response.json();
      setBots(prev => [...prev, newBot]);
      return newBot;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const updateBot = useCallback(async (botId: string, updates: Partial<Bot>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/bots/${botId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const errorData = await response.json();
        // Show detailed validation errors if available
        if (errorData.details && Array.isArray(errorData.details)) {
          const detailsMsg = errorData.details.map((d: any) => `${d.field}: ${d.message}`).join(', ');
          console.error('Validation errors:', errorData.details);
          throw new Error(`${errorData.error}: ${detailsMsg}`);
        }
        throw new Error(errorData.error || 'Failed to update bot');
      }
      const updatedBot = await response.json();
      setBots(prev => prev.map(b => b.id === botId ? updatedBot : b));
      return updatedBot;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const deleteBot = useCallback(async (botId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/bots/${botId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete bot');
      }
      setBots(prev => prev.filter(b => b.id !== botId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const pauseBot = useCallback(async (botId: string, paused: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/bots/${botId}/pause`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ paused }),
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Authentication required');
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pause/unpause bot');
      }
      const updatedBot = await response.json();
      setBots(prev => prev.map(b => b.id === botId ? updatedBot : b));
      return updatedBot;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const resetBot = useCallback(async (botId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/bots/${botId}/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset bot');
      }
      await fetchBots(); // Refresh the bot list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchBots, token]);

  // ============================================================================
  // PROVIDER OPERATIONS
  // ============================================================================

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/providers`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch providers');
      const data = await response.json();
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createProvider = useCallback(async (providerData: Partial<LLMProvider>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/providers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(providerData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Provider creation failed:', errorData);
        
        // Format validation errors for display
        if (errorData.details && Array.isArray(errorData.details)) {
          const validationErrors = errorData.details
            .map((d: any) => `${d.field}: ${d.message}`)
            .join(', ');
          throw new Error(`Validation failed: ${validationErrors}`);
        }
        
        throw new Error(errorData.error || 'Failed to create provider');
      }
      const newProvider = await response.json();
      setProviders(prev => [...prev, newProvider]);
      return newProvider;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const updateProvider = useCallback(async (providerId: number, updates: Partial<LLMProvider>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/providers/${providerId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Provider update failed:', errorData);
        
        // Format validation errors for display
        if (errorData.details && Array.isArray(errorData.details)) {
          const validationErrors = errorData.details
            .map((d: any) => `${d.field}: ${d.message}`)
            .join(', ');
          throw new Error(`Validation failed: ${validationErrors}`);
        }
        
        throw new Error(errorData.error || 'Failed to update provider');
      }
      const updatedProvider = await response.json();
      setProviders(prev => prev.map(p => p.id === providerId ? updatedProvider : p));
      return updatedProvider;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const deleteProvider = useCallback(async (providerId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/providers/${providerId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete provider');
      }
      setProviders(prev => prev.filter(p => p.id !== providerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const testProvider = useCallback(async (providerId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/providers/${providerId}/test`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to test provider');
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ============================================================================
  // WALLET OPERATIONS
  // ============================================================================

  const fetchWallets = useCallback(async (botId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = botId ? `${API_BASE}/wallets?bot_id=${botId}` : `${API_BASE}/wallets`;
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch wallets');
      const data = await response.json();
      setWallets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createWallet = useCallback(async (walletData: Partial<Wallet> & { api_key: string; api_secret: string }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/wallets`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(walletData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create wallet');
      }
      const newWallet = await response.json();
      setWallets(prev => [...prev, newWallet]);
      return newWallet;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const updateWallet = useCallback(async (walletId: number, updates: Partial<Wallet>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/wallets/${walletId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update wallet');
      }
      const updatedWallet = await response.json();
      setWallets(prev => prev.map(w => w.id === walletId ? updatedWallet : w));
      return updatedWallet;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const deleteWallet = useCallback(async (walletId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/wallets/${walletId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete wallet');
      }
      setWallets(prev => prev.filter(w => w.id !== walletId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ============================================================================
  // SETTINGS OPERATIONS
  // ============================================================================

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/settings`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const updateSetting = useCallback(async (key: string, value: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/settings/${key}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update setting');
      }
      await fetchSettings(); // Refresh all settings
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchSettings, token]);

  // ============================================================================
  // INITIAL LOAD
  // ============================================================================

  useEffect(() => {
    fetchBots();
    fetchProviders();
    fetchSettings();
  }, [fetchBots, fetchProviders, fetchSettings]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: ConfigurationContextType = {
    bots,
    providers,
    wallets,
    settings,
    loading,
    error,
    fetchBots,
    createBot,
    updateBot,
    deleteBot,
    pauseBot,
    resetBot,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    testProvider,
    fetchWallets,
    createWallet,
    updateWallet,
    deleteWallet,
    fetchSettings,
    updateSetting,
  };

  return (
    <ConfigurationContext.Provider value={value}>
      {children}
    </ConfigurationContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useConfiguration = () => {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error('useConfiguration must be used within a ConfigurationProvider');
  }
  return context;
};

