import React, { useState, useEffect } from 'react';
import { Header, SidePanelTab } from './components/Header';
import { TabManagerView } from './components/TabManagerView';
import { VisionScanner } from './VisionScanner';
import { PomodoroView } from './components/PomodoroView';
import { TasksView } from './components/TasksView';
import { SettingsView } from './components/SettingsView';
import { AnalyticsView } from './components/AnalyticsView';
import { CommandPalette } from './components/CommandPalette';
import { getBackendUrl } from '../services/storage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('tasks');
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);

  const checkHealth = async () => {
    try {
      const baseUrl = await getBackendUrl();
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
      setIsServerOnline(res.ok);
    } catch {
      setIsServerOnline(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} isServerOnline={isServerOnline} />

      <CommandPalette 
        isOpen={isCmdPaletteOpen} 
        onClose={() => setIsCmdPaletteOpen(false)} 
        onNavigate={(tab) => setActiveTab(tab as SidePanelTab)}
      />

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'tabs' && <TabManagerView />}
        {activeTab === 'vision' && <VisionScanner onSwitchToFocus={() => setActiveTab('pomodoro')} />}
        {activeTab === 'pomodoro' && <PomodoroView />}
        {activeTab === 'tasks' && <TasksView onSwitchToFocus={() => setActiveTab('pomodoro')} />}
        {activeTab === 'settings' && <SettingsView isServerOnline={isServerOnline} checkHealth={checkHealth} />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </main>
    </div>
  );
};
