import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { SymbolSelector } from '../../components/SymbolSelector';

const API_BASE_URL = getApiBaseUrl();

interface SystemSetting {
  key: string;
  value: string;
  description: string;
  type: string;
}

const SystemSettingsPage: React.FC = () => {
  const { token } = useAuth();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/settings/metadata`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load system settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValueChange = (key: string, newValue: any) => {
    setSettings(prevSettings =>
      prevSettings.map(setting => {
        if (setting.key === key) {
          // For JSON type settings, convert value to string representation
          const stringValue = setting.type === 'json' ? JSON.stringify(newValue) : newValue;
          return { ...setting, value: stringValue };
        }
        return setting;
      })
    );
  };

  const handleSave = async () => {
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setSuccessMessage('Settings saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6" style={{ maxWidth: '900px' }}>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="text-gray-400 mt-4">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6" style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">System Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Configure global application settings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSettings}
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Refresh
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {/* Settings List */}
      <div className="space-y-4">
        {settings.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
            No settings found
          </div>
        ) : (
          settings.map((setting) => (
            <div key={setting.key} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-white">{setting.key}</h3>
                <span className="px-2 py-1 bg-gray-700 border border-gray-600 text-gray-300 text-xs rounded">
                  {setting.type}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-3">{setting.description}</p>
              
              {/* Input based on type */}
              {(() => {
                if (setting.key === 'trading_symbols') {
                  return (
                    <SymbolSelector
                      selectedSymbols={(() => {
                        try {
                          const parsed = JSON.parse(setting.value);
                          return Array.isArray(parsed) ? parsed : [];
                        } catch {
                          return [];
                        }
                      })()}
                      onChange={(symbols) => handleValueChange(setting.key, symbols)}
                    />
                  );
                } else if (setting.type === 'boolean') {
                  return (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setting.value === 'true'}
                        onChange={(e) => handleValueChange(setting.key, e.target.checked ? 'true' : 'false')}
                        className="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                      />
                      <span className="text-white text-sm">
                        {setting.value === 'true' ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  );
                } else if (setting.type === 'number') {
                  return (
                    <input
                      type="number"
                      value={setting.value}
                      onChange={(e) => handleValueChange(setting.key, e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  );
                } else if (setting.type === 'text' || setting.type === 'string') {
                  return (
                    <input
                      type="text"
                      value={setting.value}
                      onChange={(e) => handleValueChange(setting.key, e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  );
                } else if (setting.type === 'textarea') {
                  return (
                    <textarea
                      value={setting.value}
                      onChange={(e) => handleValueChange(setting.key, e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
                    />
                  );
                } else {
                  return (
                    <input
                      type="text"
                      value={setting.value}
                      onChange={(e) => handleValueChange(setting.key, e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  );
                }
              })()}
            </div>
          ))
        )}
      </div>

      {/* Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 px-4 py-3 rounded-lg text-sm">
        <p className="font-semibold">Warning:</p>
        <p className="mt-1">Changes to system settings may affect all users. Please ensure you understand the impact before saving.</p>
      </div>
    </div>
  );
};

export default SystemSettingsPage;
