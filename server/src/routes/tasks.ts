import { Router, Request, Response } from 'express';

export const tasksRouter = Router();

export interface DetectedTask {
  title: string;
  description: string;
  deadline: string | null;
  priority: 'low' | 'medium' | 'high';
  action_type: 'calendar_event' | 'todo' | 'review';
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash-exp',
  'gemini-flash-latest'
];

tasksRouter.post('/extract', async (req: Request, res: Response) => {
  const { text, url, domain, existingTaskTitles } = req.body;

  if (!text || typeof text !== 'string') {
    console.warn('⚠️ [/api/tasks/extract] Text missing in request body');
    return res.status(400).json({ error: 'Text content is required' });
  }

  const existingList = Array.isArray(existingTaskTitles) && existingTaskTitles.length > 0
    ? existingTaskTitles.slice(0, 35).map((t: string) => `- ${t}`).join('\n')
    : 'None';

  console.log(`📡 [CASCADE TASK SCANNER SERVER] Incoming request from ${domain || url || 'web page'} | Text length: ${text.length} chars | Existing tasks count: ${Array.isArray(existingTaskTitles) ? existingTaskTitles.length : 0}`);

  const currentDateTime = new Date().toISOString();

  const prompt = `Page Domain/URL: "${domain || url || 'Web Workspace'}"
Current System Date/Time: ${currentDateTime}

Existing Tasks already in system:
${existingList}

Extracted Text Context:
"""
${text.substring(0, 4000)}
"""

Extract ONLY NEW actionable tasks, to-dos, deadlines, and meetings from this text.
CRITICAL DEDUPLICATION RULE:
- Do NOT extract any tasks that are duplicates, semantic equivalents, or slight rephrasings of ANY existing task listed above under "Existing Tasks already in system".
- Only return tasks that represent genuinely new actions not captured previously.

TEMPORAL CONTEXT RULE:
- Use the "Current System Date/Time" provided above as the absolute baseline for words like "tomorrow", "next week", "today", or "Monday".
- Calculate the exact ISO date for the \`deadline\` field based on this baseline.

Return JSON strictly matching this schema:
{
  "tasks": [
    {
      "title": "Concise task title",
      "description": "Details from text context",
      "deadline": "ISO format YYYY-MM-DDTHH:mm:ss if deadline/date found, else null",
      "priority": "low" | "medium" | "high",
      "action_type": "calendar_event" | "todo" | "review"
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
          console.log(`✅ [Tasks Extract AI Success] Tasks extracted successfully using "${model}"!`);
          const parsed = JSON.parse(rawText);
          return res.json({ tasks: parsed.tasks || [], source: 'gemini' });
        }
      } catch (err) {
        console.error(`❌ [Tasks Extract AI Error on ${model}]:`, err);
      }
    }
  }

  console.log('💡 [/api/tasks/extract] Using heuristic fallback response');
  const cleanTitle = text.trim().split('\n')[0].substring(0, 60);
  return res.json({
    tasks: [
      {
        title: cleanTitle,
        description: text.substring(0, 120),
        deadline: null,
        priority: 'medium',
        action_type: 'todo'
      }
    ],
    source: 'fallback'
  });
});
