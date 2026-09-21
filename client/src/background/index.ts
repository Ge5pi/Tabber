import { PomodoroState } from '../types';
import { getPomodoroState, savePomodoroState, getTasks, saveTasks } from '../services/storage';
import { checkDistractionWithAI, analyzeScreenWithAI } from '../services/api';
import { initBackgroundScheduler } from './scheduler';

console.log('[TabAI Background Worker] Service Worker Initialized');

// Initialize 10-minute alarms and active tab listener
initBackgroundScheduler();

// Offscreen Document Lifecycle Helper
async function ensureOffscreenDocument() {
  if (typeof chrome === 'undefined' || !chrome.offscreen || !chrome.offscreen.hasDocument) return;

  try {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (!hasDoc) {
      console.log('[TabAI Background] Creating Offscreen Document for Tesseract Wasm OCR...');
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Local WebAssembly Tesseract OCR text recognition for visible canvases and images'
      });
    }
  } catch (err) {
    console.warn('[TabAI Offscreen Warning]:', err);
  }
}

// 1. Extension Install Lifecycle Setup
chrome.runtime.onInstalled.addListener(() => {
  console.log('[TabAI] Extension Installed/Updated');
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('[TabAI] Failed to set sidePanel behavior:', err);
    });
  }

  getPomodoroState().then((state) => {
    savePomodoroState(state);
  });
});

// Helper: UTF-8 safe base64 encoding for SVG mockups with Cyrillic/Unicode characters
function safeBtoa(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa('<svg></svg>');
  }
}

// Helper: Capture Current Visible Screen with Intelligent System Page Fallback
export async function captureCurrentScreen(): Promise<{ imageBase64: string; url: string; title: string }> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#0f172a"/><text x="400" y="300" fill="#6366f1" font-size="20" font-family="sans-serif" text-anchor="middle">Standalone Preview Mode</text></svg>`;
      return resolve({ imageBase64: `data:image/svg+xml;base64,${safeBtoa(svg)}`, url: 'https://preview.tabai', title: 'Standalone Preview' });
    }

    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#0f172a"/><text x="400" y="300" fill="#6366f1" font-size="20" font-family="sans-serif" text-anchor="middle">No Active Tab</text></svg>`;
        return resolve({ imageBase64: `data:image/svg+xml;base64,${safeBtoa(svg)}`, url: '', title: 'No Tab' });
      }

      const isRestricted = (t: chrome.tabs.Tab) => {
        const u = t.url || t.pendingUrl || '';
        return (
          u.startsWith('chrome://') ||
          u.startsWith('chrome-extension://') ||
          u.startsWith('edge://') ||
          u.startsWith('about:') ||
          u === ''
        );
      };

      let targetTab = tabs.find((t) => t.active);
      if (!targetTab || isRestricted(targetTab)) {
        const webTab = tabs.find((t) => !isRestricted(t));
        if (webTab) targetTab = webTab;
      }

      if (!targetTab || isRestricted(targetTab)) {
        const tabTitle = targetTab?.title || 'System / Extension Page';
        const tabUrl = targetTab?.url || 'chrome://extensions';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
          <rect width="800" height="600" fill="#0f172a"/>
          <text x="400" y="240" fill="#818cf8" font-size="22" font-family="sans-serif" text-anchor="middle" font-weight="bold">${tabTitle.substring(0, 45)}</text>
          <text x="400" y="290" fill="#94a3b8" font-size="14" font-family="sans-serif" text-anchor="middle">${tabUrl.substring(0, 60)}</text>
          <text x="400" y="350" fill="#64748b" font-size="13" font-family="sans-serif" text-anchor="middle">System Page Context - Metadata Analyzed</text>
        </svg>`;
        const base64Svg = `data:image/svg+xml;base64,${safeBtoa(svg)}`;
        return resolve({ imageBase64: base64Svg, url: tabUrl, title: tabTitle });
      }

      chrome.tabs.captureVisibleTab(targetTab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          const tabTitle = targetTab.title || 'Webpage';
          const tabUrl = targetTab.url || '';
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
            <rect width="800" height="600" fill="#0f172a"/>
            <text x="400" y="280" fill="#818cf8" font-size="20" font-family="sans-serif" text-anchor="middle">${tabTitle.substring(0, 45)}</text>
            <text x="400" y="330" fill="#94a3b8" font-size="14" font-family="sans-serif" text-anchor="middle">${tabUrl.substring(0, 60)}</text>
          </svg>`;
          return resolve({ imageBase64: `data:image/svg+xml;base64,${safeBtoa(svg)}`, url: tabUrl, title: tabTitle });
        }

        resolve({ imageBase64: dataUrl, url: targetTab.url || '', title: targetTab.title || '' });
      });
    });
  });
}

// 2. Pomodoro Timer Interval (Runs every 1 second)
setInterval(async () => {
  try {
    const state: PomodoroState = await getPomodoroState();
    if (!state.isRunning) return;

    if (state.timeRemaining > 1) {
      state.timeRemaining -= 1;
      await savePomodoroState(state);
    } else {
      if (state.mode === 'WORK') {
        state.mode = 'BREAK';
        state.timeRemaining = 5 * 60;
        state.duration = 5 * 60;
        state.isRunning = false;
        state.totalSessions += 1;

        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '🎉 Focus Session Completed!',
            message: `Great job! Take a 5 minute break.`
          });
        }
      } else {
        state.mode = 'WORK';
        state.timeRemaining = 25 * 60;
        state.duration = 25 * 60;
        state.isRunning = false;

        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '☕ Break Time Over!',
            message: 'Ready for your next focus session?'
          });
        }
      }
      await savePomodoroState(state);
    }
  } catch (err) {
    // Ignore context invalidation errors
  }
}, 1000);

// 3. Smart Blocker Tab Listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  const currentUrl = changeInfo.url || tab.url;
  if (!currentUrl) return;

  if (
    currentUrl.startsWith('chrome://') ||
    currentUrl.startsWith('chrome-extension://') ||
    currentUrl.startsWith('edge://') ||
    currentUrl.startsWith('about:')
  ) {
    return;
  }

  try {
    const pState = await getPomodoroState();

    if (pState.mode === 'WORK' && pState.isRunning) {
      // Check user custom whitelist from storage first
      const { getStorageData } = await import('../services/storage');
      const customWhitelist = await getStorageData<string[]>('customWhitelist', []);
      const lowerUrl = currentUrl.toLowerCase();
      if (customWhitelist.some((allowed) => allowed.trim() && lowerUrl.includes(allowed.trim().toLowerCase()))) {
        console.log(`🛡️ [Smart Blocker] Domain whitelisted by user settings: ${currentUrl}`);
        return;
      }

      const result = await checkDistractionWithAI(currentUrl, tab.title || '', pState.taskName);

      if (result.isDistracting) {
        const blockedUrl = chrome.runtime.getURL(
          `blocked.html?url=${encodeURIComponent(currentUrl)}&reason=${encodeURIComponent(result.reason)}`
        );
        chrome.tabs.update(tabId, { url: blockedUrl });
        
        // Update analytics
        const { getAnalyticsData, saveAnalyticsData } = await import('../services/storage');
        const analytics = await getAnalyticsData();
        analytics.distractionsBlocked += 1;
        await saveAnalyticsData(analytics);
      }
    }
  } catch (err) {
    console.error('[TabAI Blocker Error]:', err);
  }
});

// 4. Message Router
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ADD_TASK') {
    const item = message.payload;
    getTasks().then(async (tasks) => {
      let updatedTasks = [...tasks];
      const action = item.action || 'CREATE';
      const targetTaskId = item.target_task_id || item.id;

      if (action === 'MERGE' && targetTaskId) {
        const targetIndex = updatedTasks.findIndex(t => t.id === targetTaskId || t.title.toLowerCase() === item.title.toLowerCase());
        if (targetIndex !== -1) {
          const existing = updatedTasks[targetIndex];
          updatedTasks[targetIndex] = {
            ...existing,
            title: item.title || existing.title,
            originalText: item.originalText
              ? `${existing.originalText || ''}\n[Updated context]: ${item.originalText}`.trim()
              : existing.originalText,
            deadline: item.deadline || existing.deadline,
            category: item.category || existing.category,
            priority: item.priority || existing.priority
          };
          await saveTasks(updatedTasks);
          sendResponse({ success: true, action: 'MERGE', count: updatedTasks.length });
          return;
        }
      }

      // CREATE logic (or MERGE fallback if target not found)
      const newUuid = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newTask = {
        id: item.id || newUuid,
        title: item.title,
        category: item.category || 'General',
        priority: item.priority || 'medium',
        estimateMinutes: item.estimateMinutes || 20,
        completed: false,
        createdAt: new Date().toISOString(),
        contextUrl: item.contextUrl,
        originalText: item.originalText,
        deadline: item.deadline || null
      };

      updatedTasks = [newTask, ...updatedTasks];
      await saveTasks(updatedTasks);
      sendResponse({ success: true, action: 'CREATE', count: updatedTasks.length });
    });
    return true;
  }

  if (message.type === 'GET_POMODORO') {
    getPomodoroState().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (message.type === 'ANALYZE_SCREEN_REQUEST') {
    captureCurrentScreen()
      .then(async ({ imageBase64, url, title }) => {
        const result = await analyzeScreenWithAI(imageBase64, url);
        sendResponse({ success: true, data: result, imageBase64, url, title });
      })
      .catch((err: Error) => {
        sendResponse({ success: false, error: err.message || 'Failed to capture screen' });
      });
    return true;
  }

  if (message.type === 'PERFORM_OFFSCREEN_OCR') {
    ensureOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({ type: 'PERFORM_OCR', payload: message.payload }, (res) => {
        sendResponse(res || { success: false, text: '' });
      });
    });
    return true;
  }

  if (message.type === 'TASKS_EXTRACTED_EVENT') {
    const { processed_tasks, tasks } = message.payload;
    const itemsToProcess = (processed_tasks && processed_tasks.length > 0) ? processed_tasks : (tasks || []);

    if (itemsToProcess && Array.isArray(itemsToProcess) && itemsToProcess.length > 0) {
      getTasks().then(async (existingList) => {
        let currentTasks = [...existingList];
        let newCreatedCount = 0;
        let mergedCount = 0;

        for (const item of itemsToProcess) {
          const action = item.action || 'CREATE';
          const targetTaskId = item.target_task_id;

          if (action === 'MERGE' && targetTaskId) {
            const targetIndex = currentTasks.findIndex(t => t.id === targetTaskId || t.title.toLowerCase() === targetTaskId.toLowerCase());

            if (targetIndex !== -1) {
              const existingTask = currentTasks[targetIndex];

              const updatedTask = {
                ...existingTask,
                title: item.title || existingTask.title,
                originalText: item.description
                  ? `${existingTask.originalText || ''}\n[Updated context]: ${item.description}`.trim()
                  : existingTask.originalText,
                deadline: item.deadline || existingTask.deadline,
                action_type: item.action_type || existingTask.action_type,
                actions: item.actions || existingTask.actions || []
              };

              currentTasks[targetIndex] = updatedTask;
              mergedCount++;
              console.log(`🔀 [Background Task Reconciliation] MERGED task ID "${targetTaskId}" -> Updated title: "${updatedTask.title}"`);
            } else {
              const newUuid = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              const newTask = {
                id: newUuid,
                title: item.title,
                category: item.action_type === 'calendar_event' ? 'Calendar' : 'Cascade AI',
                priority: item.priority || 'medium',
                estimateMinutes: 30,
                completed: false,
                createdAt: new Date().toISOString(),
                originalText: item.description,
                deadline: item.deadline,
                action_type: item.action_type,
                actions: item.actions || []
              };
              currentTasks = [newTask, ...currentTasks];
              newCreatedCount++;
            }
          } else {
            const newUuid = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const newTask = {
              id: newUuid,
              title: item.title,
              category: item.action_type === 'calendar_event' ? 'Calendar' : 'Cascade AI',
              priority: item.priority || 'medium',
              estimateMinutes: 30,
              completed: false,
              createdAt: new Date().toISOString(),
              originalText: item.description,
              deadline: item.deadline,
              action_type: item.action_type,
              actions: item.actions || []
            };
            currentTasks = [newTask, ...currentTasks];
            newCreatedCount++;
            console.log(`✨ [Background Task Reconciliation] CREATED new task ID "${newUuid}" -> Title: "${newTask.title}"`);
          }
        }

        if (newCreatedCount > 0 || mergedCount > 0) {
          await saveTasks(currentTasks);
          console.log(`✅ [Background Task Reconciliation Complete] Created: ${newCreatedCount}, Merged: ${mergedCount}. Total tasks now: ${currentTasks.length}`);
        } else {
          console.log(`ℹ️ [Background Task Reconciliation] No storage changes required.`);
        }
      });
    }
    return true;
  }
});
