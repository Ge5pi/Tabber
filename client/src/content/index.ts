import { parseTaskWithAI, extractTasksFromTextAI } from '../services/api';
import { extractVisibleTextFromDOM, getVisibleViewportMediaDataUrls } from './domParser';
import { validateContentForTasks, hashText, isSnippetAlreadyProcessed, markSnippetProcessed } from '../services/gatekeeper';
import { getTasks } from '../services/storage';

console.log('[TabAI Content Script] Cascade Task Scanner loaded on:', window.location.href);

// Allowed Whitelist Domains (Gmail, Slack, Telegram, Jira, Notion, Trello)
const WHITELISTED_DOMAINS = [
  'gmail.com',
  'mail.google.com',
  'slack.com',
  'app.slack.com',
  'telegram.org',
  'web.telegram.org',
  'atlassian.net',
  'jira',
  'notion.so',
  'notion.site',
  'trello.com',
  'localhost'
];

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let floatingButton: HTMLButtonElement | null = null;

function isDomainWhitelisted(): boolean {
  const currentHost = window.location.hostname.toLowerCase();
  return WHITELISTED_DOMAINS.some(domain => currentHost.includes(domain));
}

// === CASCADE TASK SCANNER ENGINE ===
async function runCascadeTaskScanner() {
  if (!isDomainWhitelisted()) {
    return;
  }

  console.log('[TabAI Task Scanner] User inactive for 4s. Starting Cascade Pipeline...');

  // Step 1: Deep DOM & Shadow DOM text extraction
  const domText = extractVisibleTextFromDOM(document.body);

  // Step 2: Offscreen Document OCR for Viewport Canvas/Images
  const mediaDataUrls = getVisibleViewportMediaDataUrls();
  let ocrTexts: string[] = [];

  if (mediaDataUrls.length > 0 && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    console.log(`[TabAI Task Scanner] Found ${mediaDataUrls.length} viewport canvas/images. Sending to Offscreen OCR...`);
    for (const dataUrl of mediaDataUrls) {
      try {
        const response: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'PERFORM_OFFSCREEN_OCR', payload: { dataUrl } }, resolve);
        });
        if (response && response.success && response.text) {
          ocrTexts.push(response.text);
        }
      } catch {
        // Ignore OCR timeouts
      }
    }
  }

  const combinedText = [domText, ...ocrTexts].join('\n').trim();

  if (!combinedText) {
    return;
  }

  // Step 3: Local Gatekeeper Filter
  const passesGatekeeper = validateContentForTasks(combinedText);
  if (!passesGatekeeper) {
    console.log('🛡️ [TabAI Gatekeeper] Content rejected. No task signals found. Aborting network call.');
    return;
  }

  // Step 4: Hash Check to prevent redundant API calls
  const snippetHash = hashText(combinedText);
  const alreadyProcessed = await isSnippetAlreadyProcessed(snippetHash);
  if (alreadyProcessed) {
    console.log(`♻️ [TabAI Cache] Snippet hash ${snippetHash} already processed. Skipping duplicate scan.`);
    return;
  }

  // Step 5: Backend API Submission
  const existingTasks = await getTasks();
  const existingTaskTitles = existingTasks.map(t => t.title);

  console.log('%c📡 [CASCADE TASK SCANNER] Request sent to server!', 'color: #6366f1; font-weight: bold; font-size: 14px;', {
    domain: window.location.hostname,
    url: window.location.href,
    snippetLength: combinedText.length,
    existingTasksCount: existingTaskTitles.length,
    timestamp: new Date().toLocaleTimeString()
  });
  await markSnippetProcessed(snippetHash);

  const result = await extractTasksFromTextAI(combinedText, window.location.href, window.location.hostname, existingTaskTitles);

  if (result && result.tasks && result.tasks.length > 0) {
    console.log('%c✨ [CASCADE TASK SCANNER SUCCESS] Extracted tasks:', 'color: #10b981; font-weight: bold; font-size: 13px;', result.tasks);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'TASKS_EXTRACTED_EVENT', payload: { tasks: result.tasks, url: window.location.href } });
    }
  } else {
    console.log('%cℹ️ [CASCADE TASK SCANNER] No tasks returned from snippet.', 'color: #9ca3af;');
  }
}

// Schedule scanner with 4-second inactivity debounce
function resetInactivityTimer() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    runCascadeTaskScanner();
  }, 4000);
}

// 1. Event Listeners for User Activity
window.addEventListener('scroll', resetInactivityTimer, { passive: true });
window.addEventListener('keyup', resetInactivityTimer, { passive: true });
window.addEventListener('mousemove', resetInactivityTimer, { passive: true });

// 2. MutationObserver for DOM mutations
const observer = new MutationObserver(() => {
  resetInactivityTimer();
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

// Start initial 4-second timer
resetInactivityTimer();

// === FLOATING SELECTION TASK WIDGET (Shadow DOM Isolated) ===
let widgetContainer: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;

function removeFloatingWidget() {
  if (widgetContainer && widgetContainer.parentNode) {
    widgetContainer.parentNode.removeChild(widgetContainer);
    widgetContainer = null;
    shadowRoot = null;
    floatingButton = null;
  }
}

function showToast(message: string, isError = false) {
  const toast = document.createElement('div');
  toast.innerText = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '2147483647',
    padding: '10px 16px',
    borderRadius: '8px',
    background: isError ? '#18181b' : '#000000',
    color: isError ? '#ef4444' : '#ffffff',
    border: isError ? '1px solid #ef4444' : '1px solid #3f3f46',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    fontWeight: '500',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
    transition: 'all 0.2s ease',
    pointerEvents: 'none'
  });

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

function handleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    removeFloatingWidget();
    return;
  }

  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 3) {
    removeFloatingWidget();
    return;
  }

  try {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      removeFloatingWidget();
      return;
    }

    if (!widgetContainer) {
      widgetContainer = document.createElement('div');
      widgetContainer.id = 'tabai-floating-widget-root';
      Object.assign(widgetContainer.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '0px',
        height: '0px',
        zIndex: '2147483647',
        pointerEvents: 'none'
      });

      shadowRoot = widgetContainer.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        .tabai-floating-btn {
          position: fixed;
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background-color: #000000;
          color: #ffffff;
          border: 1px solid #3f3f46;
          border-radius: 6px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
          user-select: none;
          white-space: nowrap;
        }
        .tabai-floating-btn:hover {
          background-color: #18181b;
          border-color: #71717a;
        }
        .tabai-floating-btn:active {
          transform: scale(0.97);
        }
        .tabai-floating-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `;
      shadowRoot.appendChild(style);

      floatingButton = document.createElement('button');
      floatingButton.className = 'tabai-floating-btn';
      floatingButton.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>+ AI Task</span>
      `;

      floatingButton.onclick = async (event) => {
        event.stopPropagation();
        event.preventDefault();

        if (!floatingButton) return;
        floatingButton.innerHTML = `<span>Saving...</span>`;
        floatingButton.disabled = true;

        try {
          const task = await parseTaskWithAI(selectedText, window.location.href);

          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'ADD_TASK', payload: task }, () => {
              showToast(`✓ Task added: "${task.title}"`);
            });
          } else {
            showToast(`✓ Task added: "${task.title}"`);
          }
        } catch (err) {
          showToast('Failed to create AI Task', true);
        } finally {
          removeFloatingWidget();
          window.getSelection()?.removeAllRanges();
        }
      };

      shadowRoot.appendChild(floatingButton);
      (document.body || document.documentElement).appendChild(widgetContainer);
    }

    const topPos = Math.max(10, rect.top - 38);
    const leftPos = Math.max(10, Math.min(window.innerWidth - 110, rect.left + rect.width / 2 - 45));

    if (floatingButton) {
      floatingButton.style.top = `${topPos}px`;
      floatingButton.style.left = `${leftPos}px`;
    }
  } catch (err) {
    removeFloatingWidget();
  }
}

// Event Listeners for Text Selection
document.addEventListener('mouseup', (e) => {
  if (widgetContainer && e.target instanceof Node && widgetContainer.contains(e.target)) {
    return;
  }
  setTimeout(handleSelectionChange, 10);
});

document.addEventListener('mousedown', (e) => {
  if (widgetContainer && e.target instanceof Node && widgetContainer.contains(e.target)) {
    return;
  }
  if (widgetContainer) {
    removeFloatingWidget();
  }
});

