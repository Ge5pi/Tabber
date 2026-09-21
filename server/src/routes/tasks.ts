import { Router, Request, Response } from 'express';

export const tasksRouter = Router();

export interface ProcessedTaskResponse {
  action: 'CREATE' | 'MERGE';
  target_task_id: string | null;
  title: string;
  description: string;
  deadline: string | null;
  priority?: 'low' | 'medium' | 'high';
  action_type?: 'calendar_event' | 'todo' | 'review';
  actions?: Array<{
    label: string;
    type: 'calendar_event' | 'todo' | 'review' | 'url_link';
    url?: string;
  }>;
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash-exp',
  'gemini-flash-latest'
];

tasksRouter.post('/extract', async (req: Request, res: Response) => {
  const { text, url, domain, existingTasks, existingTaskTitles } = req.body;

  if (!text || typeof text !== 'string') {
    console.warn('⚠️ [/api/tasks/extract] Text missing in request body');
    return res.status(400).json({ error: 'Text content is required' });
  }

  // Support both existingTasks: [{id, title, description, deadline}] and legacy existingTaskTitles
  let formattedExistingTasks = 'None';

  if (Array.isArray(existingTasks) && existingTasks.length > 0) {
    formattedExistingTasks = existingTasks.slice(0, 35).map((t: any) =>
      `- ID: "${t.id}" | Title: "${t.title}" | Description: "${t.description || ''}" | Deadline: "${t.deadline || 'None'}"`
    ).join('\n');
  } else if (Array.isArray(existingTaskTitles) && existingTaskTitles.length > 0) {
    formattedExistingTasks = existingTaskTitles.slice(0, 35).map((t: string, idx: number) =>
      `- ID: "legacy_${idx}" | Title: "${t}"`
    ).join('\n');
  }

  console.log(`📡 [CASCADE TASK SCANNER SERVER] Incoming request from ${domain || url || 'web page'} | Text length: ${text.length} chars | Existing tasks count: ${Array.isArray(existingTasks) ? existingTasks.length : (Array.isArray(existingTaskTitles) ? existingTaskTitles.length : 0)}`);

  const currentDateTime = new Date().toISOString();

  const prompt = `Page Domain/URL: "${domain || url || 'Web Workspace'}"
Current System Date/Time: ${currentDateTime}

Existing Tasks already in system:
${formattedExistingTasks}

Extracted Text Context from Page:
"""
${text.substring(0, 4000)}
"""

You are an expert AI Task Deduplication & Reconciliation Agent (Smart Task Deduplication & Reconciliation).
Analyze the extracted text context for actionable tasks, to-dos, deadlines, and events.
Compare every candidate task SEMANTICALLY against the "Existing Tasks already in system" listed above.

MATCHING & ACTION RULES:
1. SEMANTIC MATCHING (MERGE):
   - Compare by MEANING AND INTENT, NOT exact wording or characters.
   - If a candidate task refers to the same subject, goal, or assignment as an existing task (e.g. "Review PR #142" vs "Approve pull request 142 on Github", "Submit quarterly report" vs "Send Q3 financial report"), mark action as "MERGE".
   - Set "target_task_id" to the EXACT ID of that matched existing task.
   - "title": Generate a single canonical, clean title combining the best details.
   - "description": Enrich and combine the updated/enriched description from both the existing task and the new context.
   - "deadline": Update deadline if new information provides a more accurate or updated date, else keep existing ISO date or null.
   - "actions": List relevant quick actions (e.g. [{"label": "Open PR", "type": "review", "url": "..."}]).

2. NEW TASK (CREATE):
   - If a task represents a genuinely new item not present in existing tasks, mark action as "CREATE".
   - Set "target_task_id" to null.
   - "title": Concise canonical title.
   - "description": Contextual description from text.
   - "deadline": ISO format YYYY-MM-DDTHH:mm:ss if found, else null.
   - "actions": List relevant quick actions.

3. TEMPORAL CONTEXT RULE:
   - Use "Current System Date/Time" (${currentDateTime}) as the absolute baseline for relative terms like "today", "tomorrow", "next Monday".

Return JSON strictly matching this schema:
{
  "processed_tasks": [
    {
      "action": "CREATE" | "MERGE",
      "target_task_id": "string ID if MERGE, else null",
      "title": "Single canonical task title",
      "description": "Updated/enriched description with new context",
      "deadline": "ISO format string YYYY-MM-DDTHH:mm:ss or null",
      "priority": "low" | "medium" | "high",
      "action_type": "calendar_event" | "todo" | "review",
      "actions": [
        {
          "label": "Button Label",
          "type": "calendar_event" | "todo" | "review" | "url_link",
          "url": "Optional URL"
        }
      ]
    }
  ]
}`;

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here') {
    for (const model of GEMINI_MODELS) {
      console.log(`🤖 [Tasks Extract AI] Querying model "${model}"...`);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2
              }
            })
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`⚠️ [Tasks Extract AI Warning] Model "${model}" returned HTTP ${response.status}: ${errText}`);
          continue;
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (rawText) {
          console.log(`✅ [Tasks Extract AI Success] Tasks extracted & reconciled successfully using "${model}"!`);
          const parsed = JSON.parse(rawText);
          const processed = parsed.processed_tasks || parsed.tasks || [];
          
          // Normalize result to ensure action and target_task_id are present
          const normalizedTasks: ProcessedTaskResponse[] = processed.map((pt: any) => ({
            action: (pt.action === 'MERGE' && pt.target_task_id) ? 'MERGE' : 'CREATE',
            target_task_id: pt.target_task_id || null,
            title: pt.title || 'Untitled Task',
            description: pt.description || '',
            deadline: pt.deadline || null,
            priority: pt.priority || 'medium',
            action_type: pt.action_type || 'todo',
            actions: pt.actions || []
          }));

          return res.json({
            processed_tasks: normalizedTasks,
            // Maintain backward compatibility for legacy clients expecting tasks: [...]
            tasks: normalizedTasks.map(t => ({
              title: t.title,
              description: t.description,
              deadline: t.deadline,
              priority: t.priority,
              action_type: t.action_type
            })),
            source: 'gemini'
          });
        }
      } catch (err) {
        console.error(`❌ [Tasks Extract AI Error on ${model}]:`, err);
      }
    }
  }

  console.log('💡 [/api/tasks/extract] Using heuristic fallback response');
  const cleanTitle = text.trim().split('\n')[0].substring(0, 60);
  const fallbackTask: ProcessedTaskResponse = {
    action: 'CREATE',
    target_task_id: null,
    title: cleanTitle,
    description: text.substring(0, 120),
    deadline: null,
    priority: 'medium',
    action_type: 'todo',
    actions: []
  };

  return res.json({
    processed_tasks: [fallbackTask],
    tasks: [
      {
        title: fallbackTask.title,
        description: fallbackTask.description,
        deadline: fallbackTask.deadline,
        priority: fallbackTask.priority,
        action_type: fallbackTask.action_type
      }
    ],
    source: 'fallback'
  });
});
