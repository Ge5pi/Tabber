import { TabInfo, TabGroup } from '../types';

export const extractDomain = (urlStr: string): string => {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol === 'chrome:' || parsed.protocol === 'chrome-extension:') {
      return 'Chrome Internal';
    }
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Other';
  }
};

export const normalizeUrl = (urlStr: string): string => {
  try {
    const parsed = new URL(urlStr);
    // Strip trailing slash and URL hash for duplicate matching
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
  } catch {
    return urlStr;
  }
};

export const getAllTabs = async (): Promise<TabInfo[]> => {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    // Dev mock tabs when testing outside extension
    return [
      { id: 1, title: 'GitHub - TabAI Repository', url: 'https://github.com/tabai', domain: 'github.com', windowId: 1, active: true, pinned: false },
      { id: 2, title: 'Google Docs - Product Specs', url: 'https://docs.google.com/document/1', domain: 'docs.google.com', windowId: 1, active: false, pinned: false },
      { id: 3, title: 'YouTube - Relaxing Lofi Hip Hop', url: 'https://youtube.com/watch?v=1', domain: 'youtube.com', windowId: 1, active: false, pinned: false },
      { id: 4, title: 'GitHub - TabAI Repository (Duplicate)', url: 'https://github.com/tabai', domain: 'github.com', isDuplicate: true, windowId: 1, active: false, pinned: false },
      { id: 5, title: 'StackOverflow - React Chrome Extension', url: 'https://stackoverflow.com/questions/123', domain: 'stackoverflow.com', windowId: 1, active: false, pinned: false },
    ];
  }

  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const seenUrls = new Set<string>();
      const processedTabs: TabInfo[] = tabs.map((tab) => {
        const rawUrl = tab.url || tab.pendingUrl || '';
        const normUrl = normalizeUrl(rawUrl);
        const isDup = seenUrls.has(normUrl) && normUrl !== '' && !rawUrl.startsWith('chrome');
        if (normUrl && !rawUrl.startsWith('chrome')) {
          seenUrls.add(normUrl);
        }

        return {
          id: tab.id || 0,
          title: tab.title || 'Untitled Tab',
          url: rawUrl,
          favIconUrl: tab.favIconUrl,
          domain: extractDomain(rawUrl),
          isDuplicate: isDup,
          windowId: tab.windowId,
          active: !!tab.active,
          pinned: !!tab.pinned,
        };
      });

      // Second pass to ensure ALL instances after first are flagged duplicate
      const firstSeenMap = new Map<string, number>();
      processedTabs.forEach((tab) => {
        const norm = normalizeUrl(tab.url);
        if (norm && !tab.url.startsWith('chrome')) {
          if (firstSeenMap.has(norm)) {
            tab.isDuplicate = true;
          } else {
            firstSeenMap.set(norm, tab.id);
          }
        }
      });

      resolve(processedTabs);
    });
  });
};

export const closeTab = async (tabId: number): Promise<void> => {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    await chrome.tabs.remove(tabId);
  }
};

export const closeTabs = async (tabIds: number[]): Promise<void> => {
  if (typeof chrome !== 'undefined' && chrome.tabs && tabIds.length > 0) {
    await chrome.tabs.remove(tabIds);
  }
};

export const deduplicateTabs = async (): Promise<number> => {
  const allTabs = await getAllTabs();
  const duplicateIds = allTabs.filter(t => t.isDuplicate && t.id > 0).map(t => t.id);
  if (duplicateIds.length > 0) {
    await closeTabs(duplicateIds);
  }
  return duplicateIds.length;
};

export const switchToTab = async (tabId: number, windowId: number): Promise<void> => {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    await chrome.tabs.update(tabId, { active: true });
    if (chrome.windows) {
      await chrome.windows.update(windowId, { focused: true });
    }
  }
};

export const groupTabsByDomain = (tabs: TabInfo[]): TabGroup[] => {
  const groupsMap = new Map<string, TabInfo[]>();

  tabs.forEach((tab) => {
    const dom = tab.domain || 'Other';
    if (!groupsMap.has(dom)) {
      groupsMap.set(dom, []);
    }
    groupsMap.get(dom)!.push(tab);
  });

  const result: TabGroup[] = [];
  groupsMap.forEach((tabList, domain) => {
    result.push({
      name: domain,
      category: domain,
      tabs: tabList,
    });
  });

  return result.sort((a, b) => b.tabs.length - a.tabs.length);
};

export const groupTabsInBrowser = async (groups: { name: string, tabIds: number[], color?: string }[]): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabGroups) return;

  for (const group of groups) {
    if (group.tabIds.length === 0) continue;
    try {
      const groupId = await chrome.tabs.group({ tabIds: group.tabIds });
      await chrome.tabGroups.update(groupId, { 
        title: group.name,
        color: (group.color as any) || 'grey'
      });
    } catch (err) {
      console.error('[TabAI] Failed to group tabs:', err);
    }
  }
};
