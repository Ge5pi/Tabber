import { Router, Request, Response } from 'express';

export const visionRouter = Router();

export interface DetectedTask {
  title: string;
  description: string;
  deadline: string | null;
  priority: 'low' | 'medium' | 'high';
  action_type: 'calendar_event' | 'todo' | 'review';
  box_2d?: [number, number, number, number] | null;
}

export interface VisionAnalysisResponse {
  summary: string;
  detected_tasks: DetectedTask[];
  source?: string;
}

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash-exp',
  'gemini-flash-latest'
];

visionRouter.post('/analyze', async (req: Request, res: Response) => {
  const { imageBase64, currentUrl, existingTaskTitles } = req.body;

  if (!imageBase64) {
    console.warn('⚠️ [/api/vision/analyze] Missing imageBase64');
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  // Extract mimeType and strip data URL prefix (e.g. image/png, image/svg+xml)
  let mimeType = 'image/png';
  const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
  if (mimeMatch) {
    mimeType = mimeMatch[1];
  }
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();

  console.log(`📸 [/api/vision/analyze] Analyzing screen capture (${cleanBase64.length} chars base64, mimeType: ${mimeType}) | URL: ${currentUrl || 'N/A'}`);

  const currentDateTime = new Date().toISOString();

  const prompt = `Analyze this screen capture from URL: "${currentUrl || 'unknown'}".
Current System Date/Time: ${currentDateTime}
Extract any actionable tasks, deadlines, calendar events, to-dos, or items that require user review.

IMPORTANT DEDUPLICATION RULE:
The user already has the following tasks tracked: ${existingTaskTitles && existingTaskTitles.length > 0 ? JSON.stringify(existingTaskTitles) : '[]'}
DO NOT generate any tasks that are semantically identical or very similar to these existing tasks.

TEMPORAL CONTEXT RULE:
- Use the "Current System Date/Time" provided above as the absolute baseline for determining relative dates (e.g., "tomorrow", "in 2 hours", "next Friday").
- Calculate the exact ISO date for the \`deadline\` field based on this baseline.

BOUNDING BOX RULE:
- If visual location on screen is evident, specify normalized bounding box coordinates \`box_2d\`: [ymin, xmin, ymax, xmax] in scale 0 to 1000. If uncertain, set null.

Return JSON strictly matching this schema:
{
  "summary": "Brief 1-2 sentence description of what is currently on screen",
  "detected_tasks": [
    {
      "title": "Clear concise task title",
      "description": "Contextual details found on screen",
      "deadline": "ISO format string YYYY-MM-DDTHH:mm:ss if deadline/date found, else null",
      "priority": "low" | "medium" | "high",
      "action_type": "calendar_event" | "todo" | "review",
      "box_2d": [ymin, xmin, ymax, xmax] or null
    }
  ]
}`;

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here') {
    for (const model of GEMINI_MODELS) {
      console.log(`🤖 [Vision AI] Querying model "${model}"...`);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: cleanBase64
                      }
                    },
                    { text: prompt }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2
              }
            })
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`⚠️ [Vision AI Warning] Model "${model}" returned HTTP ${response.status}: ${errText}`);
          continue;
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (rawText) {
          console.log(`✅ [Vision AI Success] Screen analyzed successfully using "${model}"!`);
          const parsed = JSON.parse(rawText);
          return res.json({ ...parsed, source: 'gemini' });
        }
      } catch (err) {
        console.error(`❌ [Vision AI Error on ${model}]:`, err);
      }
    }
  }

  // Fallback if AI not available or error occurred
  console.log('💡 [/api/vision/analyze] Using heuristic fallback response');
  return res.json({
    summary: 'Screen captured successfully. Fallback mode active.',
    detected_tasks: [
      {
        title: 'Review current webpage',
        description: `Inspected page content at ${currentUrl || 'active tab'}`,
        deadline: null,
        priority: 'medium',
        action_type: 'todo'
      }
    ],
    source: 'fallback'
  });
});
