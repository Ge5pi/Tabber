import { TabInfo, TaskItem, DistractionCheckResult, VisionAnalysisResponse, DetectedTask } from '../types';
import { getBackendUrl } from './storage';

export const analyzeTabsWithAI = async (tabs: TabInfo[]): Promise<{
  summary: string;
  categories: Array<{ categoryName: string; tabIds: number[]; advice: string }>;
  source?: string;
}> => {
  const baseUrl = await getBackendUrl();
  const endpoint = `${baseUrl}/api/analyze-tabs`;
  console.log(`[TabAI Client] Sending analyzeTabs request to ${endpoint} (${tabs.length} tabs)`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, domain: t.domain })) })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }

    const data = await res.json();
    console.log(`[TabAI Client] Received analyzeTabs response (source: ${data.source || 'unknown'}):`, data);
    return data;
  } catch (err: any) {
    console.error(`❌ [TabAI Client Error] Tab analysis failed: ${err.message || err}. Using client fallback.`);
    const domains = Array.from(new Set(tabs.map(t => t.domain)));
    return {
      summary: `[Fallback] Currently opened ${tabs.length} tabs across ${domains.length} domains.`,
      categories: [
        {
          categoryName: 'Active Work',
          tabIds: tabs.filter(t => !t.isDuplicate).map(t => t.id),
          advice: 'Keep focused on your primary active tabs.'
        }
      ],
      source: 'client-fallback'
    };
  }
};

export const checkDistractionWithAI = async (
  url: string,
  title: string,
  taskDescription: string = ''
): Promise<DistractionCheckResult & { source?: string }> => {
  const baseUrl = await getBackendUrl();
  const endpoint = `${baseUrl}/api/check-distraction`;
  console.log(`[TabAI Client] Checking distraction for URL: ${url}`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title, taskDescription })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }

    const data = await res.json();
    console.log(`[TabAI Client] Distraction result (source: ${data.source || 'unknown'}):`, data);
    return data;
  } catch (err: any) {
    console.error(`❌ [TabAI Client Error] Distraction check failed: ${err.message || err}. Using client fallback.`);
    const lowerUrl = url.toLowerCase();
    const distractionDomains = ['youtube.com', 'facebook.com', 'instagram.com', 'reddit.com', 'twitter.com', 'x.com', 'tiktok.com', 'vk.com'];
    const isDistracting = distractionDomains.some(d => lowerUrl.includes(d));
    return {
      isDistracting,
      reason: isDistracting ? '[Fallback] Site matches popular entertainment domain.' : '[Fallback] Site appears productive.',
      category: isDistracting ? 'Entertainment' : 'Work',
      source: 'client-fallback'
    };
  }
};

export const parseTaskWithAI = async (
  text: string,
  contextUrl: string = ''
): Promise<TaskItem> => {
  const baseUrl = await getBackendUrl();
  const endpoint = `${baseUrl}/api/parse-task`;
  console.log(`[TabAI Client] Parsing task text: "${text.substring(0, 30)}..."`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, contextUrl })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }

    const data = await res.json();
    console.log(`[TabAI Client] Parsed task response (source: ${data.source || 'unknown'}):`, data);

    return {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: data.title || text.substring(0, 50),
      category: data.category || 'General',
      priority: data.priority || 'medium',
      estimateMinutes: data.estimateMinutes || 15,
      completed: false,
      createdAt: new Date().toISOString(),
      deadline: data.deadline || null,
      contextUrl,
      originalText: text
    };
  } catch (err: any) {
    console.error(`❌ [TabAI Client Error] Task parsing failed: ${err.message || err}. Using client fallback.`);
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: text.length > 60 ? text.substring(0, 60) + '...' : text,
      category: 'Quick Note',
      priority: 'medium',
      estimateMinutes: 15,
      completed: false,
      createdAt: new Date().toISOString(),
      contextUrl,
      originalText: text
    };
  }
};

export const analyzeScreenWithAI = async (
  imageBase64: string,
  currentUrl: string,
  existingTaskTitles: string[] = []
): Promise<VisionAnalysisResponse> => {
  const baseUrl = await getBackendUrl();
  const endpoint = `${baseUrl}/api/vision/analyze`;
  console.log(`[TabAI Client] Sending Vision analysis request (${imageBase64.length} chars)`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, currentUrl, existingTaskTitles })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }

    const data = await res.json();
    console.log(`[TabAI Client] Vision Analysis Response:`, data);
    return data;
  } catch (err: any) {
    console.error(`❌ [TabAI Client Error] Vision analysis failed: ${err.message || err}`);
    return {
      summary: '[Fallback] Failed to connect to server Vision API.',
      detected_tasks: [
        {
          title: 'Review Active Webpage',
          description: `Page captured at ${currentUrl}`,
          deadline: null,
          priority: 'medium',
          action_type: 'todo'
        }
      ],
      source: 'client-fallback'
    };
  }
};

export const extractTasksFromTextAI = async (
  text: string,
  url: string,
  domain: string,
  existingTaskTitles: string[] = []
): Promise<{ tasks: DetectedTask[]; source?: string }> => {
  const baseUrl = await getBackendUrl();
  const endpoint = `${baseUrl}/api/tasks/extract`;
  console.log(`📡 [CASCADE TASK SCANNER API] Sending POST request to ${endpoint} | Domain: ${domain} | Snippet: ${text.length} chars | Existing Tasks: ${existingTaskTitles.length}`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, url, domain, existingTaskTitles })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }

    const data = await res.json();
    console.log(`[TabAI Client] Extracted ${data.tasks?.length || 0} tasks from server.`);
    return data;
  } catch (err: any) {
    console.error(`❌ [TabAI Client Error] Task extraction failed: ${err.message || err}`);
    return {
      tasks: [
        {
          title: text.trim().substring(0, 50),
          description: text.substring(0, 100),
          deadline: null,
          priority: 'medium',
          action_type: 'todo'
        }
      ],
      source: 'client-fallback'
    };
  }
};
