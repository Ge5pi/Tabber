export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  domain: string;
  category?: string;
  isDuplicate?: boolean;
  windowId: number;
  active: boolean;
  pinned: boolean;
}

export interface TabGroup {
  name: string;
  category: string;
  tabs: TabInfo[];
  color?: string;
}

export type PomodoroMode = 'WORK' | 'BREAK' | 'IDLE';

export interface PomodoroState {
  mode: PomodoroMode;
  isRunning: boolean;
  timeRemaining: number; // in seconds
  duration: number; // total work duration in seconds
  taskName: string;
  totalSessions: number;
}

export interface TaskItem {
  id: string;
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  estimateMinutes: number;
  completed: boolean;
  createdAt: string;
  contextUrl?: string;
  originalText?: string;
  deadline?: string | null;
  action_type?: 'calendar_event' | 'todo' | 'review';
  actions?: TaskAction[];
  inCalendar?: boolean;
  isFocus?: boolean;
}

export interface DistractionCheckResult {
  isDistracting: boolean;
  reason: string;
  category?: string;
}

export interface TaskAction {
  label: string;
  type: 'calendar_event' | 'todo' | 'review' | 'url_link';
  url?: string;
}

export interface ProcessedTask {
  action: 'CREATE' | 'MERGE';
  target_task_id: string | null;
  title: string;
  description: string;
  deadline: string | null;
  priority?: 'low' | 'medium' | 'high';
  action_type?: 'calendar_event' | 'todo' | 'review';
  actions?: TaskAction[];
}

export interface ExistingTaskInput {
  id: string;
  title: string;
  description?: string;
  deadline?: string | null;
}

export interface DetectedTask {
  title: string;
  description: string;
  deadline: string | null;
  priority: 'low' | 'medium' | 'high';
  action_type: 'calendar_event' | 'todo' | 'review';
  box_2d?: [number, number, number, number] | null; // Normalized 0-1000 or 0-100 coordinates
}

export interface VisionAnalysisResponse {
  summary: string;
  detected_tasks: DetectedTask[];
  source?: string;
}

export interface AutoScanConfig {
  enabled: boolean;
  intervalSeconds: number; // e.g. 15, 30, 60
  lastScanTimestamp?: number;
}

export interface ChromeStorageData {
  pomodoroState?: PomodoroState;
  tasks?: TaskItem[];
  blocklist?: string[];
  backendUrl?: string;
  lastVisionScan?: VisionAnalysisResponse;
  autoScanConfig?: AutoScanConfig;
}
