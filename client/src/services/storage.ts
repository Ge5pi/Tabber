import { PomodoroState, TaskItem, AutoScanConfig } from '../types';

const DEFAULT_POMODORO_STATE: PomodoroState = {
  mode: 'IDLE',
  isRunning: false,
  timeRemaining: 25 * 60,
  duration: 25 * 60,
  taskName: '',
  totalSessions: 0
};

const DEFAULT_AUTO_SCAN_CONFIG: AutoScanConfig = {
  enabled: true,
  intervalSeconds: 20
};

export const getStorageData = async <T>(key: string, defaultValue: T): Promise<T> => {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (result && result[key] !== undefined) {
          resolve(result[key]);
        } else {
          resolve(defaultValue);
        }
      });
    });
  } else {
    // Fallback for standalone dev preview
    const raw = localStorage.getItem(`tabai_${key}`);
    return raw ? JSON.parse(raw) : defaultValue;
  }
};

export const setStorageData = async <T>(key: string, value: T): Promise<void> => {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  } else {
    localStorage.setItem(`tabai_${key}`, JSON.stringify(value));
  }
};

export const getPomodoroState = (): Promise<PomodoroState> => {
  return getStorageData<PomodoroState>('pomodoroState', DEFAULT_POMODORO_STATE);
};

export const savePomodoroState = (state: PomodoroState): Promise<void> => {
  return setStorageData('pomodoroState', state);
};

export const getTasks = (): Promise<TaskItem[]> => {
  return getStorageData<TaskItem[]>('tasks', []);
};

export const saveTasks = (tasks: TaskItem[]): Promise<void> => {
  return setStorageData('tasks', tasks);
};

export const getBackendUrl = async (): Promise<string> => {
  return getStorageData<string>('backendUrl', 'http://localhost:3000');
};

export const getAutoScanConfig = (): Promise<AutoScanConfig> => {
  return getStorageData<AutoScanConfig>('autoScanConfig', DEFAULT_AUTO_SCAN_CONFIG);
};

export const saveAutoScanConfig = (config: AutoScanConfig): Promise<void> => {
  return setStorageData('autoScanConfig', config);
};

export interface AnalyticsData {
  distractionsBlocked: number;
  blockedOverrides?: { url: string; reason: string; timestamp: number }[];
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  distractionsBlocked: 0,
  blockedOverrides: []
};

export const getAnalyticsData = (): Promise<AnalyticsData> => {
  return getStorageData<AnalyticsData>('analyticsData', DEFAULT_ANALYTICS);
};

export const saveAnalyticsData = (data: AnalyticsData): Promise<void> => {
  return setStorageData('analyticsData', data);
};
