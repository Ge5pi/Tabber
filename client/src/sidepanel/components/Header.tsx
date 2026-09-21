import React, { useState, useEffect } from 'react';
import { LayoutGrid, Timer, CheckSquare, Sparkles, Camera, Settings, CalendarCheck, AlertCircle, X, Key, Activity } from 'lucide-react';
import { getGoogleAuthToken, logoutGoogleAccount, setManualGoogleToken } from '../../services/auth';
import { getStorageData } from '../../services/storage';

export type SidePanelTab = 'tabs' | 'vision' | 'pomodoro' | 'tasks' | 'settings' | 'analytics';

interface HeaderProps {
  activeTab: SidePanelTab;
  setActiveTab: (tab: SidePanelTab) => void;
  isServerOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, isServerOnline }) => {
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authErrorModal, setAuthErrorModal] = useState<string | null>(null);

  useEffect(() => {
    getStorageData<string | null>('google_auth_token', null).then(setGoogleToken);
  }, []);

  const handleGoogleConnect = async () => {
    if (googleToken) {
      await logoutGoogleAccount();
      setGoogleToken(null);
      return;
    }

    setIsAuthenticating(true);
    setAuthErrorModal(null);

    const res = await getGoogleAuthToken(true);
    setIsAuthenticating(false);

    if (res.token) {
      setGoogleToken(res.token);
    } else {
      setAuthErrorModal(res.error || 'Google OAuth2 Client ID is not configured in Chrome Extension manifest.json.');
    }
  };

  const handleEnableDemoMode = async () => {
    const demoToken = 'demo_mode_' + Date.now();
    await setManualGoogleToken(demoToken);
    setGoogleToken(demoToken);
    setAuthErrorModal(null);
  };

  return (
    <>
      <header className="glass-panel sticky top-0 z-50 px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-black dark:bg-white flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-base font-bold text-black dark:text-white">
                Tabber
              </h1>
              <p className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">Vision Copilot</p>
            </div>
          </div>

          {/* Connections Status Badges */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleGoogleConnect}
              disabled={isAuthenticating}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-semibold transition-all ${
                googleToken
                  ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-black dark:text-white'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white'
              }`}
              title={googleToken ? 'Google Calendar Connected (Click to disconnect)' : 'Click to connect Google Calendar'}
            >
              <CalendarCheck className="w-3 h-3" />
              <span>{isAuthenticating ? 'Connecting...' : googleToken ? 'Calendar' : 'Connect'}</span>
            </button>

            <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${isServerOnline ? 'bg-black dark:bg-white' : 'bg-zinc-400'}`}></span>
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">{isServerOnline ? 'AI' : 'Fallback'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 gap-0.5">
          <button
            onClick={() => setActiveTab('tabs')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === 'tabs'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Tabs</span>
          </button>

          <button
            onClick={() => setActiveTab('vision')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === 'vision'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Vision</span>
          </button>

          <button
            onClick={() => setActiveTab('pomodoro')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === 'pomodoro'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Focus</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === 'tasks'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tasks</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`p-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`p-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
            title="Analytics Dashboard"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </nav>
      </header>

      {/* Google Auth Modal / Explanation */}
      {authErrorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-xs w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-left space-y-3 relative shadow-2xl bg-white dark:bg-zinc-900">
            <button
              onClick={() => setAuthErrorModal(null)}
              className="absolute right-3 top-3 text-zinc-400 hover:text-black dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-black dark:text-white font-bold text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>Auth Setup</span>
            </div>

            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Chrome Extension OAuth requires a registered GCP Client ID. You can enable <strong>Quick Direct Link Mode</strong>.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleEnableDemoMode}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-bold"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Enable Direct Sync</span>
              </button>

              <button
                onClick={() => {
                  setAuthErrorModal(null);
                  setActiveTab('settings');
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-zinc-100 text-black hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 text-xs font-semibold border border-zinc-200 dark:border-zinc-700"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Custom Token in Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
