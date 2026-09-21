import { captureCurrentScreen } from './index';
import { analyzeScreenWithAI } from '../services/api';
import { getGoogleAuthToken } from '../services/auth';
import { createCalendarEvent } from '../services/calendar';
import { getTasks, saveTasks, setStorageData, getAutoScanConfig, saveAutoScanConfig } from '../services/storage';
import { TaskItem, VisionAnalysisResponse } from '../types';

let tabActivatedTimeout: ReturnType<typeof setTimeout> | null = null;
let isPerformingScan = false;
const notificationTaskMap = new Map<string, TaskItem>();

export function initBackgroundScheduler() {
  console.log('[TabAI Scheduler] Initializing Live Continuous Vision Auto-Scan...');

  // 1. Create 15-second recurring alarm for active background scanning
  chrome.alarms.create('live_vision_scan', { periodInMinutes: 0.25 });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'live_vision_scan' || alarm.name === 'auto_scan') {
      performContinuousAutoScan();
    }
  });

  // Also run a 5-second interval loop in Service Worker when active
  setInterval(() => {
    performContinuousAutoScan();
  }, 5000);

  // 2. Immediate scan on active tab change (with 2-second debounce)
  chrome.tabs.onActivated.addListener((_activeInfo) => {
    if (tabActivatedTimeout) clearTimeout(tabActivatedTimeout);

    tabActivatedTimeout = setTimeout(() => {
      console.log('[TabAI Scheduler] Active tab changed. Triggering live scan check...');
      performContinuousAutoScan(true);
    }, 2000);
  });

  // 3. Notification button click handler
  if (chrome.notifications && chrome.notifications.onButtonClicked) {
    chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
      if (buttonIndex === 0 && notificationTaskMap.has(notificationId)) {
        const task = notificationTaskMap.get(notificationId)!;
        const authRes = await getGoogleAuthToken(false);
        const result = await createCalendarEvent(authRes.token, {
          title: task.title,
          description: task.originalText || task.title,
          startDateTime: task.deadline || undefined,
          durationMinutes: 30
        });

        if (result.success) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '📅 Google Calendar Updated',
            message: `Added "${task.title}" to your Google Calendar!`
          });
        }
      }
    });
  }
}

async function performContinuousAutoScan(forceTabChange: boolean = false) {
  if (isPerformingScan) return;

  try {
    const config = await getAutoScanConfig();
    
    // Always run Copilot scanner in background regardless of UI toggle

    const now = Date.now();
    const intervalMs = (config.intervalSeconds || 20) * 1000;
    const lastScan = config.lastScanTimestamp || 0;

    // Check if time interval elapsed or active tab changed
    if (!forceTabChange && (now - lastScan) < intervalMs) {
      return;
    }

    isPerformingScan = true;
    console.log('📸 [TabAI Continuous Scan] Capturing screen for live Vision AI analysis...');

    const { imageBase64, url, title } = await captureCurrentScreen();

    // Always update timestamp so timer UI reflects current cycle
    await saveAutoScanConfig({
      ...config,
      lastScanTimestamp: now
    });

    const existing = await getTasks();
    const existingTaskTitles = existing.map((t) => t.title);

    const visionResult: VisionAnalysisResponse = await analyzeScreenWithAI(imageBase64, url, existingTaskTitles);

    // Save scan result
    await setStorageData('lastVisionScan', visionResult);

    if (visionResult && visionResult.detected_tasks && visionResult.detected_tasks.length > 0) {
      console.log(`✨ [TabAI Continuous Scan] Found ${visionResult.detected_tasks.length} tasks on "${title}"`);
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

      for (const task of visionResult.detected_tasks) {
        const isHighPriority = task.priority === 'high';
        const deadlineTime = task.deadline ? new Date(task.deadline).getTime() : 0;
        const isImminentDeadline = deadlineTime > now && (deadlineTime - now) <= twentyFourHoursInMs;

        if (isHighPriority || isImminentDeadline) {
          const newTask: TaskItem = {
            id: `auto_task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: task.title,
            category: 'Live Copilot',
            priority: task.priority,
            estimateMinutes: 30,
            completed: false,
            createdAt: new Date().toISOString(),
            originalText: task.description,
            deadline: task.deadline,
            action_type: task.action_type
          };

          const existing = await getTasks();
          // Avoid duplicate task titles
          if (!existing.some((t) => t.title.toLowerCase() === task.title.toLowerCase())) {
            await saveTasks([newTask, ...existing]);

            const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
            notificationTaskMap.set(notificationId, newTask);

            if (chrome.notifications) {
              chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: isHighPriority ? '⚡ High Priority Task Detected' : '⏰ Upcoming Deadline Detected',
                message: `"${task.title}" - ${task.description}`,
                buttons: [{ title: '📅 Add to Google Calendar' }]
              });
            }
          }
        }
      }
    }
  } catch (err) {
    // Ignore restricted tab errors silently
  } finally {
    isPerformingScan = false;
  }
}
