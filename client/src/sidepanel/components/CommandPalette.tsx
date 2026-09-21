import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { getTasks, saveTasks, getPomodoroState, savePomodoroState } from '../../services/storage';
import { parseTaskWithAI } from '../../services/api';

export const CommandPalette: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: any) => void;
}> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsProcessing(true);
    const q = query.trim().toLowerCase();

    try {
      // 1. Navigation Commands
      if (q === '/tabs') {
        onNavigate('tabs');
        onClose();
        return;
      }
      if (q === '/focus') {
        onNavigate('pomodoro');
        onClose();
        return;
      }
      if (q === '/tasks') {
        onNavigate('tasks');
        onClose();
        return;
      }

      // 2. Start Focus Session directly: /focus [Task Name]
      if (q.startsWith('/focus ')) {
        const taskName = query.substring(7).trim();
        const pState = await getPomodoroState();
        await savePomodoroState({ ...pState, taskName, isRunning: true, mode: 'WORK', timeRemaining: 25 * 60, duration: 25 * 60 });
        onNavigate('pomodoro');
        onClose();
        return;
      }

      // 3. Default: Add Task using AI
      const task = await parseTaskWithAI(query);
      const existing = await getTasks();
      await saveTasks([task, ...existing]);
      onNavigate('tasks');
      onClose();

    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/80"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <form onSubmit={handleCommand} className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <Terminal className="w-4 h-4 text-zinc-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isProcessing}
            placeholder="Type a command or add a task..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 font-medium disabled:opacity-50"
          />
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
          ) : (
            <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded">
              Enter
            </kbd>
          )}
        </form>

        <div className="px-2 py-3">
          <div className="px-2 pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Suggestions
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded">/focus [task]</span>
              <span>Start a focus session</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded">[text]</span>
              <span>Add as AI task</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded">/tabs</span>
              <span>Go to Tab Manager</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
