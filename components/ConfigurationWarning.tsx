// components/ConfigurationWarning.tsx
import React from 'react';
import { API_URL, WS_URL } from '../config';

const ConfigurationWarning: React.FC = () => {
  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl p-8 space-y-6 bg-gray-800/50 rounded-lg shadow-2xl border border-yellow-500/50 text-center">
        <div className="flex justify-center">
          <svg className="h-12 w-12 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-yellow-400">Server Not Running</h1>
        <p className="text-lg text-gray-300">
          Welcome to the BONERBOTS AI Arena (Local Edition)! The application cannot connect to the backend server.
        </p>
        <div className="text-left bg-gray-900/70 p-4 rounded-md border border-gray-700 space-y-3">
          <p className="font-semibold text-white">Please ensure the following:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>The backend server is running (from the <code className="bg-gray-700 text-indigo-300 px-2 py-1 rounded">server/</code> directory)</li>
            <li>Server is accessible at: <code className="bg-gray-700 text-indigo-300 px-2 py-1 rounded">{API_URL}</code></li>
            <li>WebSocket server at: <code className="bg-gray-700 text-indigo-300 px-2 py-1 rounded">{WS_URL}</code></li>
          </ul>
        </div>
        <div className="text-left bg-gray-900/70 p-4 rounded-md border border-gray-700 space-y-2">
          <p className="font-semibold text-white">Quick Start:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>Configure API keys in <code className="bg-gray-700 text-indigo-300 px-2 py-1 rounded">server/.env</code></li>
            <li>Install dependencies: <code className="bg-gray-700 text-indigo-300 px-2 py-1 rounded">cd server && pnpm install</code></li>
            <li>Start the server: <code className="bg-gray-700 text-indigo-300 px-2 py-1 rounded">pnpm start</code></li>
          </ol>
        </div>
        <p className="text-gray-400">
          See the <strong>SETUP.md</strong> file for detailed installation instructions.
        </p>
      </div>
    </div>
  );
};

export default ConfigurationWarning;
