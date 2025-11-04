/**
 * LLM Provider Manager Page
 * 
 * Configure AI providers (OpenAI, Anthropic, Gemini, Grok, local models)
 */

import React, { useState } from 'react';
import { useConfiguration } from '../../context/ConfigurationContext';
import { TextInput } from '../../components/forms/TextInput';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { SelectDropdown, SelectOption } from '../../components/forms/SelectDropdown';
import { TextArea } from '../../components/forms/TextArea';

export const ProvidersPage: React.FC = () => {
  const { providers, createProvider, updateProvider, deleteProvider, testProvider, loading } = useConfiguration();

  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ providerId: number; success: boolean; message: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    provider_type: '',
    api_endpoint: '',
    model_name: '',
    api_key: '',
    config_json: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const providerTypeOptions: SelectOption[] = [
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'grok', label: 'xAI Grok' },
    { value: 'openai', label: 'OpenAI GPT' },
    { value: 'anthropic', label: 'Anthropic Claude' },
    { value: 'local', label: 'Local (Ollama)' },
    { value: 'custom', label: 'Custom API' },
  ];

  // Open modal for create/edit
  const openModal = (providerId?: number) => {
    if (providerId) {
      const provider = providers.find(p => p.id === providerId);
      if (provider) {
        setFormData({
          name: provider.name,
          provider_type: provider.provider_type,
          api_endpoint: provider.api_endpoint,
          model_name: provider.model_name || '',
          api_key: '', // Don't populate for security
          config_json: provider.config_json || '',
          is_active: provider.is_active,
        });
        setEditingProvider(providerId);
      }
    } else {
      setFormData({
        name: '',
        provider_type: '',
        api_endpoint: '',
        model_name: '',
        api_key: '',
        config_json: '',
        is_active: true,
      });
      setEditingProvider(null);
    }
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProvider(null);
    setFormData({
      name: '',
      provider_type: '',
      api_endpoint: '',
      model_name: '',
      api_key: '',
      config_json: '',
      is_active: true,
    });
    setErrors({});
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = 'Provider name is required';
    }

    if (!formData.provider_type) {
      newErrors.provider_type = 'Provider type is required';
    }

    if (!formData.api_endpoint) {
      newErrors.api_endpoint = 'API endpoint is required';
    } else {
      try {
        new URL(formData.api_endpoint);
      } catch {
        newErrors.api_endpoint = 'Invalid URL format';
      }
    }

    if (formData.config_json) {
      try {
        JSON.parse(formData.config_json);
      } catch {
        newErrors.config_json = 'Invalid JSON format';
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

      const providerData: any = {
        name: formData.name,
        provider_type: formData.provider_type,
        api_endpoint: formData.api_endpoint,
        model_name: formData.model_name || null,
        is_active: formData.is_active,
      };

      // Only include config_json if it's not empty
      if (formData.config_json && formData.config_json.trim()) {
        providerData.config_json = formData.config_json;
      }

      // Only include API key if it's been entered
      if (formData.api_key) {
        providerData.api_key = formData.api_key;
      }

      if (editingProvider) {
        await updateProvider(editingProvider, providerData);
      } else {
        await createProvider(providerData);
      }

      closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  // Test provider connection
  const handleTest = async (providerId: number) => {
    try {
      setTesting(providerId);
      setTestResult(null);
      const result = await testProvider(providerId);
      setTestResult({ providerId, ...result });
    } catch (error) {
      setTestResult({
        providerId,
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setTesting(null);
    }
  };

  // Delete provider
  const handleDelete = async (providerId: number, providerName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${providerName}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteProvider(providerId);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete provider');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">AI Providers</h1>
          <p className="text-gray-400 mt-1">
            Configure the AI models that power your trading bots
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Provider
        </button>
      </div>

      {/* Providers List */}
      {providers.length === 0 ? (
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
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No Providers Configured</h3>
          <p className="text-gray-500 mb-6">
            Add your first AI provider to start creating trading bots
          </p>
          <button
            onClick={() => openModal()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Add Your First Provider
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-100">{provider.name}</h3>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-300">
                      {provider.provider_type}
                    </span>
                    {!provider.is_active && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{provider.api_endpoint}</p>
                  {provider.model_name && (
                    <p className="text-gray-500 text-sm">Model: {provider.model_name}</p>
                  )}

                  {/* Test Result */}
                  {testResult && testResult.providerId === provider.id && (
                    <div
                      className={`mt-3 p-3 rounded-lg text-sm ${
                        testResult.success
                          ? 'bg-green-900/20 border border-green-500 text-green-300'
                          : 'bg-red-900/20 border border-red-500 text-red-300'
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-6">
                  <button
                    onClick={() => openModal(provider.id)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleTest(provider.id)}
                    disabled={testing === provider.id}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {testing === provider.id ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id, provider.name)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6 space-y-4">
              <h2 className="text-2xl font-bold text-gray-100">
                {editingProvider ? 'Edit Provider' : 'Add New Provider'}
              </h2>

              <TextInput
                label="Provider Name"
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder="Gemini 2.5 Flash"
                error={errors.name}
                required
              />

              <SelectDropdown
                label="Provider Type"
                value={formData.provider_type}
                onChange={(value) => setFormData({ ...formData, provider_type: value })}
                options={providerTypeOptions}
                error={errors.provider_type}
                required
              />

              <TextInput
                label="API Endpoint"
                value={formData.api_endpoint}
                onChange={(value) => setFormData({ ...formData, api_endpoint: value })}
                placeholder="https://api.example.com/v1/chat/completions"
                error={errors.api_endpoint}
                required
                type="url"
              />

              <TextInput
                label="Model Name"
                value={formData.model_name}
                onChange={(value) => setFormData({ ...formData, model_name: value })}
                placeholder="gemini-2.5-flash"
                helperText="Optional: Specific model identifier"
              />

              <PasswordInput
                label="API Key"
                value={formData.api_key}
                onChange={(value) => setFormData({ ...formData, api_key: value })}
                placeholder={editingProvider ? 'Leave blank to keep current key' : 'Enter API key'}
                helperText={editingProvider ? 'Enter a new key only if you want to update it' : 'This will be encrypted and stored securely'}
              />

              <TextArea
                label="Configuration JSON"
                value={formData.config_json}
                onChange={(value) => setFormData({ ...formData, config_json: value })}
                placeholder='{"temperature": 0.7, "max_tokens": 1000}'
                error={errors.config_json}
                helperText="Optional: Additional configuration as JSON"
                rows={3}
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
                  Active (available for use by bots)
                </label>
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
                  {saving ? 'Saving...' : editingProvider ? 'Save Changes' : 'Add Provider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

