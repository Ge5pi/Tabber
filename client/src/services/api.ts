import { TabInfo, TaskItem, DistractionCheckResult, VisionAnalysisResponse, DetectedTask, ProcessedTask } from '../types';
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
  contextUrl: string = '',
  existingTasks: Array<{ id: string; title: string; description?: string }> = []
): Promise<TaskItem & { action?: 'CREATE' | 'MERGE'; target_task_id?: string | null }> => {
  const baseUrl = await getBackendUrl();
  const endpoint = `${baseUrl}/api/parse-task`;
  console.log(`[TabAI Client] Parsing task text: "${text.substring(0, 30)}..." | Existing tasks: ${existingTasks.length}`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        contextUrl,
        existingTasks: existingTasks.map(t => ({ id: t.id, title: t.title, description: t.description || '' }))
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }

    const data = await res.json();
    console.log(`[TabAI Client] Parsed task response (action: ${data.action || 'CREATE'}, source: ${data.source || 'unknown'}):`, data);

    const newUuid = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      id: data.target_task_id || newUuid,
      title: data.title || text.substring(0, 50),
      category: data.category || 'General',
      priority: data.priority || 'medium',
      estimateMinutes: data.estimateMinutes || 15,
      completed: false,
      createdAt: new Date().toISOString(),
      deadline: data.deadline || null,
      contextUrl,
      originalText: data.description || text,
      action: data.action || 'CREATE',
      target_task_id: data.target_task_id || null
    };
  } catch (err: any) {
    console.error(`❌ [TabAI Client Error] Task parsing failed: ${err.message || err}. Using client fallback.`);
    const newUuid = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: newUuid,
      title: text.length > 60 ? text.substring(0, 60) + '...' : text,
      category: 'Quick Note',
      priority: 'medium',
      estimateMinutes: 15,
      completed: false,
      createdAt: new Date().toISOString(),
      contextUrl,
      originalText: text,
      action: 'CREATE',
      target_task_id: null
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
  existingTasks: Array<{ id: string; title: string; description?: string; deadline?: string | null }> = []
): Promise<{ processed_tasks: ProcessedTask[]; tasks?: DetectedTask[]; source?: string }> => {
  const baseUrl = await getBackendUrl();
  const endpoint = `${baseUrl}/api/tasks/extract`;
  console.log(`📡 [CASCADE TASK SCANNER API] Sending POST request to ${endpoint} | Domain: ${domain} | Snippet: ${text.length} chars | Existing Tasks: ${existingTasks.length}`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        url,
        domain,
        existingTasks: existingTasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          deadline: t.deadline || null
        })),
        existingTaskTitles: existingTasks.map(t => t.title)
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }

    const data = await res.json();
    console.log(`[TabAI Client] Extracted/Reconciled ${data.processed_tasks?.length || data.tasks?.length || 0} tasks from server.`);
    return data;
  } catch (err: any) {
    console.error(`❌ [TabAI Client Error] Task extraction failed: ${err.message || err}`);
    return {
      processed_tasks: [
        {
          action: 'CREATE',
          target_task_id: null,
          title: text.trim().substring(0, 50),
          description: text.substring(0, 100),
          deadline: null,
          priority: 'medium',
          action_type: 'todo',
          actions: []
        }
      ],
      source: 'client-fallback'
    };
  }
};
