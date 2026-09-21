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
    getTasks().then(async (tasks) => {
      const updatedTasks = [message.payload, ...tasks];
      await saveTasks(updatedTasks);
      sendResponse({ success: true, count: updatedTasks.length });
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
    const { tasks } = message.payload;
    if (tasks && Array.isArray(tasks)) {
      getTasks().then(async (existing) => {
        const getTokens = (str: string) => str.toLowerCase().replace(/[^a-z0-9а-яё\\s]/gi, '').split(/\\s+/).filter(Boolean);
        const isDuplicate = (newTitle: string, existingList: any[]) => {
          const newTokens = getTokens(newTitle);
          if (newTokens.length === 0) return false;
          return existingList.some(t => {
            const existingTokens = getTokens(t.title);
            if (existingTokens.length === 0) return false;
            const intersection = newTokens.filter(token => existingTokens.includes(token) || existingTokens.some(et => et.startsWith(token) || token.startsWith(et)));
            const overlapRatio = intersection.length / Math.min(newTokens.length, existingTokens.length);
            return overlapRatio >= 0.7; // 70% token overlap
          });
        };

        const uniqueTasks: any[] = [];
        for (const t of tasks) {
          if (t.title && !isDuplicate(t.title, [...existing, ...uniqueTasks])) {
            uniqueTasks.push(t);
          }
        }

        if (uniqueTasks.length > 0) {
          const updated = [...uniqueTasks.map(t => ({
            id: `ext_task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: t.title,
            category: t.action_type === 'calendar_event' ? 'Calendar' : 'Cascade AI',
            priority: t.priority || 'medium',
            estimateMinutes: 30,
            completed: false,
            createdAt: new Date().toISOString(),
            originalText: t.description,
            deadline: t.deadline,
            action_type: t.action_type
          })), ...existing];

          await saveTasks(updated);
          console.log(`✨ [Background] Saved ${uniqueTasks.length} new unique tasks (filtered out ${tasks.length - uniqueTasks.length} duplicates).`);
        } else {
          console.log(`ℹ️ [Background] All ${tasks.length} extracted tasks were duplicates of existing tasks. Skipped saving.`);
        }
      });
    }
    return true;
  }
});
