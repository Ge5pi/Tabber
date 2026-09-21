import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`\n[${new Date().toLocaleTimeString()}] 📥 ${req.method} ${req.url}`);
  next();
});

// Models to try in order (gemini-3.6-flash is recommended for REST generateContent API)
const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash-lite',
  'gemini-2.5-flash'
];

// Helper function to call Gemini API with comprehensive logging
async function callGemini(prompt, systemInstruction = '') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    console.warn('⚠️ [Gemini AI] GEMINI_API_KEY is missing or empty in server/.env file. Using fallback logic.');
    return null;
  }

  for (const model of GEMINI_MODELS) {
    console.log(`🤖 [Gemini AI] Querying model "${model}"... (Prompt length: ${prompt.length} chars)`);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ [Gemini API Warning] Model "${model}" returned HTTP ${response.status}:\n${errorText}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.warn('⚠️ [Gemini API Warning] Response candidates list was empty:', JSON.stringify(data));
        continue;
      }

      console.log(`✅ [Gemini AI Success] Successfully received AI response using model "${model}"!`);
      return JSON.parse(rawText);
    } catch (err) {
      console.error(`❌ [Gemini API Exception on model ${model}]:`, err);
    }
  }

  console.error('❌ [Gemini API Error] All tested Gemini models failed.');
  return null;
}

// Health check endpoint with AI key status
app.get('/api/health', (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyPresent = !!(apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here');

  res.json({
    status: 'ok',
    service: 'TabAI Express Server',
    hasGeminiKey: isKeyPresent,
    apiKeyStatus: isKeyPresent ? `Configured (Length: ${apiKey.length})` : 'MISSING in server/.env',
    timestamp: new Date().toISOString()
  });
});

// Endpoint 1: Analyze Tabs & Grouping
app.post('/api/analyze-tabs', async (req, res) => {
  const { tabs } = req.body;
  if (!tabs || !Array.isArray(tabs)) {
    console.warn('⚠️ [analyze-tabs] Invalid tabs payload');
    return res.status(400).json({ error: 'Invalid tabs payload' });
  }

  console.log(`📊 [analyze-tabs] Analyzing ${tabs.length} tabs...`);

  const prompt = `Analyze these open browser tabs: ${JSON.stringify(tabs)}.
Return a JSON object with schema:
{
  "summary": "Brief 1-2 sentence overview of user's current focus",
  "categories": [
    {
      "categoryName": "Category Name",
      "tabIds": [1, 2],
      "advice": "Actionable suggestion"
    }
  ]
}`;

  const aiResult = await callGemini(prompt, "You are TabAI, an expert tab organization assistant.");

  if (aiResult) {
    console.log('✨ [analyze-tabs] Returning AI result');
    return res.json({ ...aiResult, source: 'gemini' });
  }

  console.log('💡 [analyze-tabs] Using heuristic fallback response');
  const domainGroups = {};
  tabs.forEach(tab => {
    const dom = tab.domain || 'Other';
    if (!domainGroups[dom]) domainGroups[dom] = [];
    domainGroups[dom].push(tab.id);
  });

  const categories = Object.entries(domainGroups).map(([domain, ids]) => ({
    categoryName: domain.toUpperCase(),
    tabIds: ids,
    advice: ids.length > 2 ? `Consider closing redundant tabs on ${domain}` : `Active workspace for ${domain}`
  }));

  return res.json({
    summary: `Organized ${tabs.length} tabs into ${categories.length} domain groups.`,
    categories,
    source: 'fallback'
  });
});

// Endpoint 2: Smart Distraction Checker
app.post('/api/check-distraction', async (req, res) => {
  const { url, title, taskDescription } = req.body;

  if (!url) {
    console.warn('⚠️ [check-distraction] URL parameter missing');
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`🛡️ [check-distraction] Evaluating URL: ${url} | Task: "${taskDescription || 'Focus'}"`);

  const prompt = `Current Task: "${taskDescription || 'General Focus Session'}".
Page URL: "${url}"
Page Title: "${title || ''}"

Is visiting this page distracting or irrelevant to the user's current task?
Return JSON:
{
  "isDistracting": boolean,
  "reason": "Clear explanation of why it is or is not distracting",
  "category": "Social Media | Entertainment | Shopping | News | Work | Study"
}`;

  const aiResult = await callGemini(prompt, "You are a strict Pomodoro focus guard.");

  if (aiResult) {
    console.log(`✨ [check-distraction] AI decision: isDistracting=${aiResult.isDistracting}`);
    return res.json({ ...aiResult, source: 'gemini' });
  }

  console.log('💡 [check-distraction] Using heuristic fallback evaluation');
  const lowerUrl = (url || '').toLowerCase();
  const entertainmentDomains = [
    'youtube.com/watch', 'tiktok.com', 'instagram.com', 'facebook.com',
    'reddit.com', 'twitter.com', 'x.com', 'netflix.com', 'twitch.tv', 'vk.com'
  ];

  const isEntertainment = entertainmentDomains.some(d => lowerUrl.includes(d));

  return res.json({
    isDistracting: isEntertainment,
    reason: isEntertainment
      ? `Distraction guard active: ${new URL(url).hostname} is flagged as entertainment.`
      : `Page matches productive workspace.`,
    category: isEntertainment ? 'Entertainment' : 'Work',
    source: 'fallback'
  });
});

// Endpoint 3: Parse Text into Structured Task
app.post('/api/parse-task', async (req, res) => {
  const { text, contextUrl } = req.body;

  if (!text) {
    console.warn('⚠️ [parse-task] Text missing in request body');
    return res.status(400).json({ error: 'Text content is required' });
  }

  console.log(`📝 [parse-task] Parsing task text: "${text.substring(0, 40)}..."`);

  const prompt = `Selected Text: "${text}"
Context URL: "${contextUrl || ''}"

Extract an actionable task item from this selected text.
Return JSON:
{
  "title": "Concise task title (max 8 words)",
  "category": "Work | Study | Research | Bug | General",
  "priority": "low" | "medium" | "high",
  "estimateMinutes": 15 | 30 | 45 | 60
}`;

  const aiResult = await callGemini(prompt, "You are an AI task extraction assistant.");

  if (aiResult) {
    console.log(`✨ [parse-task] AI task title: "${aiResult.title}"`);
    return res.json({ ...aiResult, source: 'gemini' });
  }

  console.log('💡 [parse-task] Using heuristic fallback task parsing');
  const cleanTitle = text.trim().split('\n')[0].substring(0, 60);
  let priority = 'medium';
  if (text.toLowerCase().includes('urgent') || text.toLowerCase().includes('fix') || text.toLowerCase().includes('asap')) {
    priority = 'high';
  } else if (text.length < 20) {
    priority = 'low';
  }

  return res.json({
    title: cleanTitle + (text.length > 60 ? '...' : ''),
    category: contextUrl?.includes('github') ? 'Bug' : 'Research',
    priority,
    estimateMinutes: 20,
    source: 'fallback'
  });
});

app.listen(PORT, () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyPresent = !!(apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here');

  console.log(`\n🚀 ==================================================`);
  console.log(`🚀 [TabAI Backend Server] Listening on http://localhost:${PORT}`);
  console.log(`🔑 [Gemini API Key]: ${isKeyPresent ? `Configured ✅ (${apiKey.substring(0, 6)}...)` : 'NOT SET ⚠️ (Set GEMINI_API_KEY in server/.env)'}`);
  console.log(`🚀 ==================================================\n`);
});
