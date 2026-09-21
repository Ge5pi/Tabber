import React, { useState, useEffect } from 'react';
import { getBackendUrl, setStorageData, getStorageData } from '../../services/storage';
import { setManualGoogleToken } from '../../services/auth';
import { Server, Save, Check, RefreshCw, CalendarCheck, ShieldCheck, ListTodo } from 'lucide-react';

export const SettingsView: React.FC<{ isServerOnline: boolean; checkHealth: () => void }> = ({
  isServerOnline,
  checkHealth
}) => {
  const [url, setUrl] = useState('http://localhost:3000');
  const [googleToken, setGoogleToken] = useState('');
  const [linearToken, setLinearToken] = useState('');
  const [todoistToken, setTodoistToken] = useState('');
  
  const [savedBackend, setSavedBackend] = useState(false);
  const [savedGoogle, setSavedGoogle] = useState(false);
  const [savedIntegrations, setSavedIntegrations] = useState(false);

  useEffect(() => {
    getBackendUrl().then(setUrl);
    getStorageData<string | null>('google_auth_token', '').then((t) => setGoogleToken(t || ''));
    getStorageData<string | null>('linear_auth_token', '').then((t) => setLinearToken(t || ''));
    getStorageData<string | null>('todoist_auth_token', '').then((t) => setTodoistToken(t || ''));
  }, []);

  const handleSaveBackend = async (e: React.FormEvent) => {
    e.preventDefault();
    await setStorageData('backendUrl', url);
    setSavedBackend(true);
    checkHealth();
    setTimeout(() => setSavedBackend(false), 2000);
  };

  const handleSaveGoogleToken = async (e: React.FormEvent) => {
    e.preventDefault();
    await setManualGoogleToken(googleToken);
    setSavedGoogle(true);
    setTimeout(() => setSavedGoogle(false), 2000);
  };

  const handleEnableDirectSync = async () => {
    const demoToken = 'demo_mode_' + Date.now();
    await setManualGoogleToken(demoToken);
    setGoogleToken(demoToken);
    setSavedGoogle(true);
    setTimeout(() => setSavedGoogle(false), 2000);
  };

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    await setStorageData('linear_auth_token', linearToken);
    await setStorageData('todoist_auth_token', todoistToken);
    setSavedIntegrations(true);
    setTimeout(() => setSavedIntegrations(false), 2000);
  };

  return (
    <div className="p-4 space-y-4 pb-12">
      {/* Backend Server Configuration */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Server className="w-4 h-4 text-indigo-400" />
          <span>Express Backend Server</span>
        </div>

        <form onSubmit={handleSaveBackend} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Backend Endpoint URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={checkHealth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Test Server</span>
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              {savedBackend ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedBackend ? 'Saved!' : 'Save URL'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Google Calendar OAuth Configuration */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-200">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            <span>Google Calendar Integration</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            googleToken ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' : 'bg-slate-900 text-slate-400'
          }`}>
            {googleToken ? 'Active' : 'Not Connected'}
          </span>
        </div>

        <form onSubmit={handleSaveGoogleToken} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Google OAuth Token / Custom API Key
            </label>
            <input
              type="text"
              placeholder="Paste Google Access Token or click Direct Sync below"
              value={googleToken}
              onChange={(e) => setGoogleToken(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleEnableDirectSync}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 text-xs font-semibold border border-emerald-500/30"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Enable Direct Sync</span>
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              {savedGoogle ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedGoogle ? 'Saved!' : 'Save Token'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Task Collection Integrations */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <ListTodo className="w-4 h-4 text-purple-400" />
          <span>Task Collection Apps</span>
        </div>

        <form onSubmit={handleSaveIntegrations} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Linear API Key
            </label>
            <input
              type="text"
              placeholder="lin_api_..."
              value={linearToken}
              onChange={(e) => setLinearToken(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Todoist API Token
            </label>
            <input
              type="text"
              placeholder="Todoist personal access token..."
              value={todoistToken}
              onChange={(e) => setTodoistToken(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              {savedIntegrations ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedIntegrations ? 'Saved!' : 'Save Integrations'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Backend Status Box */}
      <div className="glass-card p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
        <div className="font-semibold text-slate-300 flex items-center justify-between">
          <span>Server Connection</span>
          <span className={isServerOnline ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {isServerOnline ? 'Connected (http://localhost:3000)' : 'Offline / Standalone Fallback'}
          </span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Ensure Express TS Server is active (`cd server && npm start`). All Vision screen captures & AI requests stream through <code>{url}</code>.
        </p>
      </div>
    </div>
  );
};
