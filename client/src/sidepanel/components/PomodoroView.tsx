import React, { useState, useEffect } from 'react';
import { PomodoroState, TaskItem } from '../../types';
import { getPomodoroState, savePomodoroState, getTasks } from '../../services/storage';
import { Play, Pause, RotateCcw, ShieldCheck, ShieldAlert, Target } from 'lucide-react';

export const PomodoroView: React.FC = () => {
  const [state, setState] = useState<PomodoroState>({
    mode: 'WORK',
    isRunning: false,
    timeRemaining: 25 * 60,
    duration: 25 * 60,
    taskName: '',
    totalSessions: 0
  });
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);

  const loadState = async () => {
    const current = await getPomodoroState();
    setState(current);
    const tasksList = await getTasks();
    setAllTasks(tasksList.filter(t => !t.completed));
  };

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleTimer = async () => {
    const nextState = { ...state, isRunning: !state.isRunning };
    setState(nextState);
    await savePomodoroState(nextState);
  };

  const handleResetTimer = async () => {
    const resetTime = state.mode === 'WORK' ? 25 * 60 : 5 * 60;
    const nextState = {
      ...state,
      isRunning: false,
      timeRemaining: resetTime,
      duration: resetTime
    };
    setState(nextState);
    await savePomodoroState(nextState);
  };

  const handleTaskNameChange = async (name: string) => {
    const nextState = { ...state, taskName: name };
    setState(nextState);
    await savePomodoroState(nextState);
  };

  const handleSwitchMode = async (mode: 'WORK' | 'BREAK') => {
    const duration = mode === 'WORK' ? 25 * 60 : 5 * 60;
    const nextState = {
      ...state,
      mode,
      isRunning: false,
      timeRemaining: duration,
      duration
    };
    setState(nextState);
    await savePomodoroState(nextState);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(100, Math.max(0, ((state.duration - state.timeRemaining) / state.duration) * 100));

  return (
    <div className="p-4 space-y-4 pb-12">
      {/* Mode Selector Pill */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => handleSwitchMode('WORK')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            state.mode === 'WORK'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🎯 Focus Session (25m)
        </button>
        <button
          onClick={() => handleSwitchMode('BREAK')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            state.mode === 'BREAK'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ☕ Break Time (5m)
        </button>
      </div>

      {/* Main Clock Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center space-y-4 relative overflow-hidden">
        {/* Background Radial Glow */}
        <div
          className={`absolute inset-0 opacity-20 pointer-events-none transition-all ${
            state.mode === 'WORK' ? 'bg-indigo-600 blur-3xl' : 'bg-emerald-600 blur-3xl'
          }`}
        />

        <div className="relative">
          <div className="text-5xl font-black font-mono tracking-wider text-white">
            {formatTime(state.timeRemaining)}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                state.mode === 'WORK' ? 'bg-indigo-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Focus Task Picker & Custom Input */}
        <div className="space-y-2 text-left pt-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              <span>Current Focus Task</span>
            </label>
            {allTasks.length > 0 && (
              <span className="text-[10px] text-indigo-400 font-semibold">
                {allTasks.length} task{allTasks.length > 1 ? 's' : ''} available
              </span>
            )}
          </div>

          {/* Task Picker Dropdown */}
          {allTasks.length > 0 && (
            <select
              value={allTasks.some(t => t.title === state.taskName) ? state.taskName : ''}
              onChange={(e) => {
                if (e.target.value) handleTaskNameChange(e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 focus:outline-none focus:border-indigo-500 font-medium transition-colors"
            >
              <option value="">📋 -- Select from Tasks List --</option>
              {allTasks.map((t) => (
                <option key={t.id} value={t.title}>
                  {t.title} {t.estimateMinutes ? `(${t.estimateMinutes}m)` : ''} {t.priority ? `[${t.priority.toUpperCase()}]` : ''}
                </option>
              ))}
            </select>
          )}

          {/* Custom / Selected Task Input */}
          <input
            type="text"
            placeholder={allTasks.length > 0 ? "Or edit / type custom task..." : "What task are you working on right now?"}
            value={state.taskName}
            onChange={(e) => handleTaskNameChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Timer Controls */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={handleToggleTimer}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${
              state.isRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                : state.mode === 'WORK'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            {state.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{state.isRunning ? 'Pause' : 'Start Focus'}</span>
          </button>

          <button
            onClick={handleResetTimer}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Smart Blocker Status Indicator */}
      <div className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
        state.mode === 'WORK' && state.isRunning
          ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
          : 'bg-slate-900/60 border-slate-800 text-slate-400'
      }`}>
        {state.mode === 'WORK' && state.isRunning ? (
          <ShieldAlert className="w-5 h-5 text-indigo-400 animate-pulse shrink-0" />
        ) : (
          <ShieldCheck className="w-5 h-5 text-slate-500 shrink-0" />
        )}
        <div className="text-xs">
          <div className="font-semibold text-slate-200">
            {state.mode === 'WORK' && state.isRunning ? 'Smart Blocker Active' : 'Smart Blocker Idle'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {state.mode === 'WORK' && state.isRunning
              ? 'AI monitors visited URLs and blocks distracting sites during focus.'
              : 'Start a focus session to automatically block distracting URLs.'}
          </div>
        </div>
      </div>

      {/* Session Stats */}
      <div className="glass-card p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400">Completed Sessions Today</span>
        <span className="font-bold text-indigo-400 text-sm">{state.totalSessions} 🏆</span>
      </div>
    </div>
  );
};
