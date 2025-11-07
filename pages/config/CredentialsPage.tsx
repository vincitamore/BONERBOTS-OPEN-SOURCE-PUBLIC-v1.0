/**
 * API Key Vault / Credentials Manager
 * 
 * Securely manage exchange API keys and wallet credentials for trading bots
 */

import React, { useState, useEffect } from 'react';
import { useConfiguration } from '../../context/ConfigurationContext';
import { useToast } from '../../context/ToastContext';
import { TextInput } from '../../components/forms/TextInput';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { SelectDropdown, SelectOption } from '../../components/forms/SelectDropdown';

export const CredentialsPage: React.FC = () => {
  const { bots, wallets, fetchWallets, createWallet, updateWallet, deleteWallet, loading } = useConfiguration();
  const { showToast, confirm } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<number | null>(null);
  const [selectedBotFilter, setSelectedBotFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    bot_id: '',
    exchange: '',
    api_key: '',
    api_secret: '',
    wallet_address: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Load wallets on mount and when bot filter changes
  useEffect(() => {
    if (selectedBotFilter === 'all') {
      fetchWallets();
    } else {
      fetchWallets(selectedBotFilter);
    }
  }, [selectedBotFilter, fetchWallets]);

  // Exchange options
  const exchangeOptions: SelectOption[] = [
    { value: 'asterdex', label: 'Asterdex' },
    { value: 'binance', label: 'Binance' },
    { value: 'coinbase', label: 'Coinbase' },
    { value: 'kraken', label: 'Kraken' },
    { value: 'bybit', label: 'Bybit' },
    { value: 'okx', label: 'OKX' },
    { value: 'other', label: 'Other' },
  ];

  // Bot options
  const botOptions: SelectOption[] = bots
    .filter(b => b.is_active)
    .map(b => ({
      value: b.id,
      label: `${b.name} (${b.trading_mode})`,
    }));

  // Open modal for create/edit
  const openModal = (walletId?: number) => {
    if (walletId) {
      const wallet = wallets.find(w => w.id === walletId);
      if (wallet) {
        setFormData({
          bot_id: wallet.bot_id,
          exchange: wallet.exchange,
          api_key: '', // Don't populate for security
          api_secret: '', // Don't populate for security
          wallet_address: wallet.wallet_address || '',
          is_active: wallet.is_active,
        });
        setEditingWallet(walletId);
      }
    } else {
      setFormData({
        bot_id: '',
        exchange: '',
        api_key: '',
        api_secret: '',
        wallet_address: '',
        is_active: true,
      });
      setEditingWallet(null);
    }
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingWallet(null);
    setFormData({
      bot_id: '',
      exchange: '',
      api_key: '',
      api_secret: '',
      wallet_address: '',
      is_active: true,
    });
    setErrors({});
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.bot_id) {
      newErrors.bot_id = 'Bot is required';
    }

    if (!formData.exchange) {
      newErrors.exchange = 'Exchange is required';
    }

    // API key and secret are required for new wallets
    if (!editingWallet) {
      if (!formData.api_key) {
        newErrors.api_key = 'API key is required';
      }
      if (!formData.api_secret) {
        newErrors.api_secret = 'API secret is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save handler
  const handleSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);

      if (editingWallet) {
        const updates: any = {
          exchange: formData.exchange,
          wallet_address: formData.wallet_address || null,
          is_active: formData.is_active,
        };

        // Only include API credentials if they're provided
        if (formData.api_key) {
          updates.api_key = formData.api_key;
        }
        if (formData.api_secret) {
          updates.api_secret = formData.api_secret;
        }

        await updateWallet(editingWallet, updates);
      } else {
        await createWallet({
          bot_id: formData.bot_id,
          exchange: formData.exchange,
          api_key: formData.api_key,
          api_secret: formData.api_secret,
          wallet_address: formData.wallet_address || null,
          is_active: formData.is_active,
        });
      }

      showToast('Credentials saved successfully!', 'success');
      closeModal();
      // Refresh wallets
      if (selectedBotFilter === 'all') {
        await fetchWallets();
      } else {
        await fetchWallets(selectedBotFilter);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save credentials', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete wallet
  const handleDelete = async (walletId: number, botName: string, exchange: string) => {
    const confirmed = await confirm({
      title: 'Delete Credentials',
      message: `Are you sure you want to delete the ${exchange} credentials for "${botName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteWallet(walletId);
      showToast('Credentials deleted successfully.', 'success');
      // Refresh wallets
      if (selectedBotFilter === 'all') {
        await fetchWallets();
      } else {
        await fetchWallets(selectedBotFilter);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete credentials', 'error');
    }
  };

  // Get bot name for a wallet
  const getBotName = (botId: string): string => {
    const bot = bots.find(b => b.id === botId);
    return bot ? bot.name : botId;
  };

  // Filter wallets by selected bot
  const filteredWallets = selectedBotFilter === 'all' 
    ? wallets 
    : wallets.filter(w => w.bot_id === selectedBotFilter);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">API Key Vault</h1>
          <p className="text-gray-400 mt-1">
            Securely manage exchange credentials for your trading bots
          </p>
        </div>
        <button
          onClick={() => openModal()}
          disabled={botOptions.length === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Credentials
        </button>
      </div>

      {/* Warning for bots */}
      {botOptions.length === 0 && (
        <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="font-medium text-yellow-400">No Bots Available</div>
              <div className="text-yellow-300 text-sm mt-1">
                You need to create at least one bot before adding credentials.{' '}
                <a href="/config/bots" className="underline hover:text-yellow-200">
                  Go to Bot Management
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      {botOptions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <label className="text-sm font-medium text-gray-300 block mb-2">Filter by Bot</label>
          <select
            value={selectedBotFilter}
            onChange={(e) => setSelectedBotFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Bots</option>
            {botOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="text-sm text-blue-300">
            <div className="font-medium text-blue-200">Encrypted Storage</div>
            All API keys and secrets are encrypted using AES-256-GCM before being stored. They are only decrypted when needed for trading operations.
          </div>
        </div>
      </div>

      {/* Credentials List */}
      {filteredWallets.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No Credentials Configured</h3>
          <p className="text-gray-500 mb-6">
            {selectedBotFilter === 'all' 
              ? 'Add exchange credentials to enable live trading for your bots'
              : 'No credentials configured for this bot'}
          </p>
          {botOptions.length > 0 && (
            <button
              onClick={() => openModal()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Add Your First Credentials
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredWallets.map((wallet) => {
            const bot = bots.find(b => b.id === wallet.bot_id);
            return (
              <div
                key={wallet.id}
                className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-100">{getBotName(wallet.bot_id)}</h3>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-300">
                        {wallet.exchange}
                      </span>
                      {bot && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          bot.trading_mode === 'paper' 
                            ? 'bg-gray-700 text-gray-400' 
                            : 'bg-green-900/50 text-green-300'
                        }`}>
                          {bot.trading_mode === 'paper' ? 'Paper Trading' : 'Live Trading'}
                        </span>
                      )}
                      {!wallet.is_active && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-900/50 text-orange-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-400">
                      <div>
                        <span className="font-medium">API Key:</span>{' '}
                        <span className="text-gray-500 font-mono">{wallet.api_key_encrypted}</span>
                      </div>
                      {wallet.wallet_address && (
                        <div>
                          <span className="font-medium">Wallet Address:</span>{' '}
                          <span className="text-gray-500 font-mono">{wallet.wallet_address}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Created:</span>{' '}
                        {new Date(wallet.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => openModal(wallet.id)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(wallet.id, getBotName(wallet.bot_id), wallet.exchange)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6 space-y-4">
              <h2 className="text-2xl font-bold text-gray-100">
                {editingWallet ? 'Edit Credentials' : 'Add New Credentials'}
              </h2>

              <SelectDropdown
                label="Bot"
                value={formData.bot_id}
                onChange={(value) => setFormData({ ...formData, bot_id: value })}
                options={botOptions}
                placeholder="Select a bot..."
                error={errors.bot_id}
                required
                disabled={editingWallet !== null}
                helperText={editingWallet ? 'Bot cannot be changed after creation' : 'Which bot will use these credentials?'}
              />

              <SelectDropdown
                label="Exchange"
                value={formData.exchange}
                onChange={(value) => setFormData({ ...formData, exchange: value })}
                options={exchangeOptions}
                placeholder="Select an exchange..."
                error={errors.exchange}
                required
              />

              <PasswordInput
                label="API Key"
                value={formData.api_key}
                onChange={(value) => setFormData({ ...formData, api_key: value })}
                placeholder={editingWallet ? 'Leave blank to keep current key' : 'Enter API key'}
                error={errors.api_key}
                required={!editingWallet}
                helperText={editingWallet ? 'Enter a new key only if you want to update it' : 'This will be encrypted before storage'}
              />

              <PasswordInput
                label="API Secret"
                value={formData.api_secret}
                onChange={(value) => setFormData({ ...formData, api_secret: value })}
                placeholder={editingWallet ? 'Leave blank to keep current secret' : 'Enter API secret'}
                error={errors.api_secret}
                required={!editingWallet}
                helperText={editingWallet ? 'Enter a new secret only if you want to update it' : 'This will be encrypted before storage'}
              />

              <TextInput
                label="Wallet Address (Optional)"
                value={formData.wallet_address}
                onChange={(value) => setFormData({ ...formData, wallet_address: value })}
                placeholder="0x..."
                helperText="Optional: Your wallet address for reference"
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm text-gray-300">
                  Active (credentials will be used for trading)
                </label>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-3 text-sm text-yellow-300">
                ⚠️ <strong>Security Notice:</strong> Only add credentials for exchanges you trust. Enable live trading only when you're confident in your bot's strategy.
              </div>

              <div className="flex justify-between pt-4 border-t border-gray-700">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingWallet ? 'Save Changes' : 'Add Credentials'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

