import React, { useState, useEffect } from 'react';
import { VisionAnalysisResponse, DetectedTask, TaskItem, AutoScanConfig } from '../types';
import { getStorageData, setStorageData, getTasks, saveTasks, getAutoScanConfig, saveAutoScanConfig, getPomodoroState, savePomodoroState } from '../services/storage';
import { getGoogleAuthToken } from '../services/auth';
import { createCalendarEvent } from '../services/calendar';
import { Camera, RefreshCw, Calendar, Check, AlertTriangle, Sparkles, Clock, CalendarCheck, Radio, Target } from 'lucide-react';

interface VisionScannerProps {
  onSwitchToFocus?: () => void;
}

export const VisionScanner: React.FC<VisionScannerProps> = ({ onSwitchToFocus }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<VisionAnalysisResponse | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedTaskIds, setSavedTaskIds] = useState<Set<number>>(new Set());
  const [calendarSavedIds, setCalendarSavedIds] = useState<Set<number>>(new Set());
  const [autoScan, setAutoScan] = useState<AutoScanConfig>({ enabled: true, intervalSeconds: 20 });
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  const loadData = async () => {
    const cfg = await getAutoScanConfig();
    setAutoScan(cfg);

    // Only auto-update the UI from background scans if auto-scan UI toggle is enabled
    if (cfg.enabled) {
      const saved = await getStorageData<VisionAnalysisResponse | null>('lastVisionScan', null);
      if (saved) setScanResult(saved);
    }

    if (cfg.lastScanTimestamp) {
      const elapsed = Math.floor((Date.now() - cfg.lastScanTimestamp) / 1000);
      setSecondsAgo(elapsed);
    }
  };

  useEffect(() => {
    loadData();
    // Real-time polling every 2 seconds to update UI continuously
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAutoScan = async () => {
    const nextCfg = { ...autoScan, enabled: !autoScan.enabled };
    setAutoScan(nextCfg);
    await saveAutoScanConfig(nextCfg);
  };

  const handleIntervalChange = async (seconds: number) => {
    const nextCfg = { ...autoScan, intervalSeconds: seconds };
    setAutoScan(nextCfg);
    await saveAutoScanConfig(nextCfg);
  };

  const handleManualScan = () => {
    setIsScanning(true);
    setErrorMessage(null);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'ANALYZE_SCREEN_REQUEST' }, (response) => {
        setIsScanning(false);
        if (!response) {
          setErrorMessage('No response received from Background Worker.');
          return;
        }

        if (response.success && response.data) {
          setScanResult(response.data);
          if (response.imageBase64) setCapturedImage(response.imageBase64);
          setStorageData('lastVisionScan', response.data);
          const now = Date.now();
          saveAutoScanConfig({ ...autoScan, lastScanTimestamp: now });
          setSecondsAgo(0);
        } else {
          setErrorMessage(response.error || 'Failed to scan current screen.');
        }
      });
    } else {
      // Standalone preview mock
      setTimeout(() => {
        setIsScanning(false);
        const mockResult: VisionAnalysisResponse = {
          summary: 'Detected open pull request review and team meeting announcement.',
          detected_tasks: [
            {
              title: 'Review PR #142: Fix memory leak in service worker',
              description: 'Pull request on GitHub waiting for approval',
              deadline: new Date(Date.now() + 86400000).toISOString(),
              priority: 'high',
              action_type: 'review'
            },
            {
              title: 'Weekly Engineering Sync',
              description: 'Calendar invite found on screen for 15:00 UTC',
              deadline: new Date(Date.now() + 3600000 * 3).toISOString(),
              priority: 'medium',
              action_type: 'calendar_event'
            }
          ],
          source: 'standalone-preview'
        };
        setScanResult(mockResult);
      }, 1500);
    }
  };

  const handleSaveToTasks = async (task: DetectedTask, index: number) => {
    const existingTasks = await getTasks();
    const newTask: TaskItem = {
      id: `vision_task_${Date.now()}_${index}`,
      title: task.title,
      category: task.action_type === 'calendar_event' ? 'Calendar' : 'Vision AI',
      priority: task.priority,
      estimateMinutes: 30,
      completed: false,
      createdAt: new Date().toISOString(),
      originalText: task.description,
      deadline: task.deadline,
      action_type: task.action_type
    };

    const updated = [newTask, ...existingTasks];
    await saveTasks(updated);

    const updatedSet = new Set(savedTaskIds);
    updatedSet.add(index);
    setSavedTaskIds(updatedSet);
  };

  const handleAddToCalendar = async (task: DetectedTask, index: number) => {
    const authRes = await getGoogleAuthToken(true);
    const result = await createCalendarEvent(authRes.token, {
      title: task.title,
      description: task.description,
      startDateTime: task.deadline || undefined,
      durationMinutes: 30
    });

    if (result.success) {
      const updatedSet = new Set(calendarSavedIds);
      updatedSet.add(index);
      setCalendarSavedIds(updatedSet);
    }
  };

  const handleSetFocusTask = async (task: DetectedTask, index: number) => {
    // 1. Save to tasks if not saved
    if (!savedTaskIds.has(index)) {
      await handleSaveToTasks(task, index);
    }
    // 2. Set as pomodoro focus task
    const pState = await getPomodoroState();
    await savePomodoroState({ ...pState, taskName: task.title });
    // 3. Switch tab to focus view
    if (onSwitchToFocus) {
      onSwitchToFocus();
    }
  };

  const getPriorityStyle = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'low':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="p-4 space-y-4 pb-12">
      {/* Live Auto-Scan Toggle Panel */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${autoScan.enabled ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${autoScan.enabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{autoScan.enabled ? 'Continuous Live Scan ON' : 'Live Auto-Scan OFF'}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {autoScan.enabled
                  ? `Scanning screen automatically every ${autoScan.intervalSeconds}s`
                  : 'Manual scan mode'}
              </p>
            </div>
          </div>

          {/* Toggle Switch Button */}
          <button
            onClick={handleToggleAutoScan}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
              autoScan.enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start border border-slate-700'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-md" />
          </button>
        </div>

        {/* Interval Selector & Status Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Interval:</span>
            <select
              value={autoScan.intervalSeconds}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              disabled={!autoScan.enabled}
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 text-[11px] focus:outline-none"
            >
              <option value={10}>10s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {secondsAgo !== null && (
              <span className="text-[10px] text-slate-400">
                Last scan: {secondsAgo < 5 ? 'Just now' : `${secondsAgo}s ago`}
              </span>
            )}

            <button
              onClick={handleManualScan}
              disabled={isScanning}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-50 text-[10px] font-semibold text-white transition-all"
            >
              {isScanning ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Camera className="w-3 h-3" />
              )}
              <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Skeleton Loading State */}
      {isScanning && !scanResult && (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 bg-slate-900/80 rounded-xl border border-slate-800" />
          <div className="h-28 bg-slate-900/80 rounded-xl border border-slate-800" />
        </div>
      )}

      {/* Captured Image Preview */}
      {capturedImage && !isScanning && (
        <div className="rounded-xl overflow-hidden border border-slate-800 max-h-32 bg-slate-900">
          <img src={capturedImage} alt="Captured Tab" className="w-full object-cover" />
        </div>
      )}

      {/* Vision Results */}
      {scanResult && (
        <div className="space-y-3">
          {/* Overview Summary */}
          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Live Screen Context Overview</span>
              </div>
              {autoScan.enabled && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  AUTO-UPDATED
                </span>
              )}
            </div>
            <p className="leading-relaxed text-[11px] text-slate-300">{scanResult.summary}</p>
          </div>

          {/* Detected Tasks Header */}
          <div className="text-xs font-semibold text-slate-400 px-1 flex items-center justify-between">
            <span>Detected Tasks ({scanResult.detected_tasks.length})</span>
            {scanResult.source && (
              <span className="text-[10px] text-slate-500 uppercase">{scanResult.source}</span>
            )}
          </div>

          {/* Task Cards List */}
          <div className="space-y-2.5">
            {scanResult.detected_tasks.map((task, index) => (
              <div
                key={index}
                className="p-3.5 rounded-xl glass-card border border-slate-800/80 space-y-2.5 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-100 block leading-snug">
                      {task.title}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      {task.description}
                    </p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase shrink-0 ${getPriorityStyle(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>
                </div>

                {/* Badges and Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px]">
                  <div className="flex items-center gap-2 text-slate-400">
                    {task.deadline ? (
                      <span className="flex items-center gap-1 text-amber-300 bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {new Date(task.deadline).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-500">No deadline</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Set as Focus Button */}
                    <button
                      onClick={() => handleSetFocusTask(task, index)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-[10px] font-semibold transition-all shadow-sm"
                      title="Set as Current Focus Task"
                    >
                      <Target className="w-3 h-3 text-indigo-200" />
                      <span>Focus</span>
                    </button>

                    {/* Add to Calendar Button */}
                    <button
                      onClick={() => handleAddToCalendar(task, index)}
                      disabled={calendarSavedIds.has(index)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 disabled:bg-emerald-950/60 disabled:text-emerald-400 text-white font-semibold transition-all"
                      title="Add to Google Calendar"
                    >
                      {calendarSavedIds.has(index) ? (
                        <>
                          <CalendarCheck className="w-3 h-3 text-emerald-400" />
                          <span>Добавлено ✓</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-3 h-3" />
                          <span>📅 В календарь</span>
                        </>
                      )}
                    </button>

                    {/* Add to Tasks Button */}
                    <button
                      onClick={() => handleSaveToTasks(task, index)}
                      disabled={savedTaskIds.has(index)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-400 text-white font-semibold transition-all"
                    >
                      {savedTaskIds.has(index) ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Task OK</span>
                        </>
                      ) : (
                        <>
                          <span>+ Task</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {scanResult.detected_tasks.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-xs">
                No actionable tasks found on current screen.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
