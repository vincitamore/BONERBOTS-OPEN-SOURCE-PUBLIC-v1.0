/**
 * Bot Editor Page
 * 
 * Create or edit a trading bot with comprehensive configuration options
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConfiguration, Bot } from '../../context/ConfigurationContext';
import { TextInput } from '../../components/forms/TextInput';
import { SelectDropdown, SelectOption } from '../../components/forms/SelectDropdown';
import { PromptEditor } from '../../components/forms/PromptEditor';

export const BotEditorPage: React.FC = () => {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { bots, providers, createBot, updateBot, loading } = useConfiguration();

  const isEditMode = botId !== 'new';
  const existingBot = isEditMode ? bots.find(b => b.id === botId) : null;

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    prompt: '',
    provider_id: '',
    trading_mode: 'paper' as 'paper' | 'real',
    avatar_image: null as string | null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Load existing bot data in edit mode
  useEffect(() => {
    if (isEditMode && existingBot) {
      setFormData({
        id: existingBot.id,
        name: existingBot.name,
        prompt: existingBot.prompt,
        provider_id: existingBot.provider_id.toString(),
        trading_mode: existingBot.trading_mode,
        avatar_image: existingBot.avatar_image || null,
      });
      setAvatarPreview(existingBot.avatar_image || null);
    }
  }, [isEditMode, existingBot]);

  // Handle avatar image upload
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors({ ...errors, avatar_image: 'Please select a valid image file' });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors({ ...errors, avatar_image: 'Image must be smaller than 2MB' });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData({ ...formData, avatar_image: base64String });
      setAvatarPreview(base64String);
      setErrors({ ...errors, avatar_image: '' });
    };
    reader.readAsDataURL(file);
  };

  // Clear avatar
  const handleClearAvatar = () => {
    setFormData({ ...formData, avatar_image: null });
    setAvatarPreview(null);
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.id && !isEditMode) {
      newErrors.id = 'Bot ID is required';
    } else if (!isEditMode && !/^[a-zA-Z0-9_-]+$/.test(formData.id)) {
      newErrors.id = 'Bot ID must contain only letters, numbers, hyphens, and underscores';
    } else if (!isEditMode && bots.some(b => b.id === formData.id)) {
      newErrors.id = 'A bot with this ID already exists';
    }

    if (!formData.name) {
      newErrors.name = 'Bot name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Bot name must be 100 characters or less';
    }

    if (!formData.prompt) {
      newErrors.prompt = 'Trading prompt is required';
    } else if (formData.prompt.length < 10) {
      newErrors.prompt = 'Prompt must be at least 10 characters';
    } else if (formData.prompt.length > 10000) {
      newErrors.prompt = 'Prompt must be 10,000 characters or less';
    }

    if (!formData.provider_id) {
      newErrors.provider_id = 'AI provider is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save handler
  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      setSaving(true);

      if (isEditMode) {
        // Build updates object, omitting null values
        const updates: any = {
          name: formData.name,
          prompt: formData.prompt,
          provider_id: parseInt(formData.provider_id),
          trading_mode: formData.trading_mode,
        };
        
        // Only include avatar_image if it's not null
        if (formData.avatar_image !== null) {
          updates.avatar_image = formData.avatar_image;
        }
        
        await updateBot(botId!, updates);
      } else {
        // Build creation object, omitting null values
        const botData: any = {
          id: formData.id,
          name: formData.name,
          prompt: formData.prompt,
          provider_id: parseInt(formData.provider_id),
          trading_mode: formData.trading_mode,
        };
        
        // Only include avatar_image if it's not null
        if (formData.avatar_image !== null) {
          botData.avatar_image = formData.avatar_image;
        }
        
        await createBot(botData);
      }

      navigate('/config/bots');
    } catch (error) {
      console.error('Failed to save bot:', error);
      alert(error instanceof Error ? error.message : 'Failed to save bot. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Provider options
  const providerOptions: SelectOption[] = providers
    .filter(p => p.is_active)
    .map(p => ({
      value: p.id,
      label: `${p.name} (${p.provider_type})`,
    }));

  const tradingModeOptions: SelectOption[] = [
    { value: 'paper', label: 'Paper Trading (Simulated)' },
    { value: 'real', label: 'Live Trading (Real Money)' },
  ];

  if (loading && !existingBot && isEditMode) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading bot...</div>
      </div>
    );
  }

  if (isEditMode && !existingBot) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          Bot not found. Please check the bot ID and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">
            {isEditMode ? 'Edit Bot' : 'Create New Bot'}
          </h1>
          <p className="text-gray-400 mt-1">
            {isEditMode
              ? `Modify the configuration for "${existingBot?.name}"`
              : 'Configure a new AI trading bot with custom personality and strategy'}
          </p>
        </div>
        <button
          onClick={() => navigate('/config/bots')}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Form */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-100 border-b border-gray-700 pb-2">
            Basic Information
          </h2>

          {!isEditMode && (
            <TextInput
              label="Bot ID"
              value={formData.id}
              onChange={(value) => setFormData({ ...formData, id: value })}
              placeholder="bot_aggressive_trader"
              error={errors.id}
              required
              helperText="Unique identifier for this bot. Cannot be changed later. Use lowercase letters, numbers, hyphens, and underscores only."
            />
          )}

          <TextInput
            label="Bot Name"
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            placeholder="Aggressive Day Trader"
            error={errors.name}
            required
            helperText="Display name for this bot (1-100 characters)"
          />

          {/* Avatar Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">
              Bot Avatar
            </label>
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="flex-shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-24 h-24 rounded-full border-2 border-gray-600 object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-2 border-gray-600 bg-gray-700 flex items-center justify-center text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-upload"
                />
                <div className="flex gap-2">
                  <label
                    htmlFor="avatar-upload"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer transition-colors inline-block"
                  >
                    {avatarPreview ? 'Change Avatar' : 'Upload Avatar'}
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleClearAvatar}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg font-medium transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Optional. Upload a custom avatar image (max 2MB, JPG/PNG/GIF). If not provided, a default avatar will be used.
                </p>
                {errors.avatar_image && (
                  <p className="text-xs text-red-400">{errors.avatar_image}</p>
                )}
              </div>
            </div>
          </div>

          <SelectDropdown
            label="Trading Mode"
            value={formData.trading_mode}
            onChange={(value) => setFormData({ ...formData, trading_mode: value as 'paper' | 'real' })}
            options={tradingModeOptions}
            error={errors.trading_mode}
            required
            helperText={
              formData.trading_mode === 'paper'
                ? 'Paper trading uses simulated funds for testing strategies'
                : '⚠️ Live trading uses real money. Ensure your strategy is well-tested before enabling.'
            }
          />
        </div>

        {/* AI Configuration */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-100 border-b border-gray-700 pb-2">
            AI Provider
          </h2>

          <SelectDropdown
            label="LLM Provider"
            value={formData.provider_id}
            onChange={(value) => setFormData({ ...formData, provider_id: value })}
            options={providerOptions}
            placeholder="Select an AI provider..."
            error={errors.provider_id}
            required
            helperText="Choose which AI model will power this bot's decision-making"
          />

          {providerOptions.length === 0 && (
            <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="font-medium text-yellow-400">No AI Providers Available</div>
                  <div className="text-yellow-300 text-sm mt-1">
                    You need to configure at least one AI provider before creating a bot.{' '}
                    <button
                      onClick={() => navigate('/config/providers')}
                      className="underline hover:text-yellow-200"
                    >
                      Go to Provider Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trading Prompt */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-100 border-b border-gray-700 pb-2">
              Trading Strategy Prompt
            </h2>
            <p className="text-gray-400 text-sm mt-2">
              Define your bot's personality, risk tolerance, and trading strategy. The AI will make decisions based on this prompt.
            </p>
          </div>

          <PromptEditor
            label="Strategy Prompt"
            value={formData.prompt}
            onChange={(value) => setFormData({ ...formData, prompt: value })}
            error={errors.prompt}
            required
            helperText="Describe your bot's trading personality, risk preferences, market outlook, and decision-making approach (10-10,000 characters)"
            height="500px"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
          <button
            onClick={() => navigate('/config/bots')}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || providerOptions.length === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Bot'}
          </button>
        </div>
      </div>
    </div>
  );
};

