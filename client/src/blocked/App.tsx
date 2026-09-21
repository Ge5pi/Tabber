import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { getPomodoroState } from '../services/storage';
import { PomodoroState } from '../types';

export const App: React.FC = () => {
  const [blockedUrl, setBlockedUrl] = useState('');
  const [reason, setReason] = useState('');
  const [pState, setPState] = useState<PomodoroState | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBlockedUrl(params.get('url') || 'Distracting Webpage');
    setReason(params.get('reason') || 'AI Focus Guard flagged this site as distracting during active focus session.');

    getPomodoroState().then(setPState);
    const interval = setInterval(() => {
      getPomodoroState().then(setPState);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCloseTab = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.getCurrent((tab) => {
        if (tab && tab.id) {
          chrome.tabs.remove(tab.id);
        }
      });
    } else {
      window.history.back();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Dynamic Glowing Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-lg w-full glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl relative z-10 text-center space-y-6">
        {/* Shield Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-rose-600 to-amber-500 flex items-center justify-center mx-auto shadow-xl shadow-rose-500/20">
          <ShieldAlert className="w-8 h-8 text-white animate-pulse" />
        </div>

        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Focus Guard Active
          </h1>
          <p className="text-xs text-rose-400 font-medium mt-1">This site was blocked to keep you focused.</p>
        </div>

        {/* URL and Reason Box */}
        <div className="glass-card p-4 rounded-2xl border border-slate-800/80 text-left space-y-2">
          <div className="text-[11px] font-semibold text-slate-400">Target URL</div>
          <div className="text-xs font-mono text-indigo-300 truncate bg-slate-900/80 p-2 rounded-lg border border-slate-800">
            {blockedUrl}
          </div>

          <div className="text-[11px] font-semibold text-slate-400 pt-2">AI Reason</div>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
            {reason}
          </p>
        </div>

        {/* Pomodoro Timer Banner */}
        {pState && pState.mode === 'WORK' && (
          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-left">
              <Clock className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {pState.taskName || 'Focus Session'}
                </div>
                <div className="text-[10px] text-slate-400">Time remaining in current session</div>
              </div>
            </div>

            <div className="text-xl font-black font-mono text-indigo-300">
              {formatTime(pState.timeRemaining)}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleCloseTab}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Work (Close Tab)</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>TabAI - Powered by Gemini AI</span>
        </div>
      </div>
    </div>
  );
};
