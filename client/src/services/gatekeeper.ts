import { getStorageData, setStorageData } from './storage';

// 1. Fast DJB2 String Hashing Function for caching content fragments
export const hashText = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

// 2. Regular Expressions for Time Markers and Task Signatures
const TIME_MARKER_REGEX = new RegExp(
  '(' +
  '\\b\\d{1,2}[\\/\\.-]\\d{1,2}([\\/\\.-]\\d{2,4})?\\b|' + // Dates like 19/09/2026 or 19.09
  '\\b\\d{1,2}:\\d{2}\\b|' +                               // Times like 15:30
  '\\b\\d{1,2}\\s?(am|pm)\\b|' +                           // Times like 3pm, 11 am
  '\\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b|' +
  '\\b(пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)\\b|' +
  '\\b(today|tomorrow|tonight|next week|by friday|by monday)\\b|' +
  '\\b(сегодня|завтра|послезавтра|до конца недели|к пятнице|до понедельника)\\b' +
  ')',
  'i'
);

const TASK_SIGNATURE_REGEX = new RegExp(
  '(' +
  '\\b(todo|to-do|task|deadline|meeting|review|asap|urgent|fix|call|sync|reminder|action item|pr|pull request|jira|trello|issue)\\b|' +
  '\\b(дедлайн|задача|встреча|созвон|ревью|срочно|прислать|нужно сделать|подготовить|проверить|отправить|сделать до|план|напомнить|пароль|оплатить)\\b' +
  ')',
  'i'
);

// 3. Pre-filtering Gatekeeper Validation Utility
export const validateContentForTasks = (text: string): boolean => {
  if (!text || text.trim().length < 10) {
    return false;
  }

  const clean = text.trim();
  const hasTime = TIME_MARKER_REGEX.test(clean);
  const hasTask = TASK_SIGNATURE_REGEX.test(clean);

  // Return true if either time marker or task signature is present
  const isValid = hasTime || hasTask;

  if (isValid) {
    console.log(`🛡️ [Gatekeeper Passed] Found task signals (hasTime=${hasTime}, hasTask=${hasTask}) in snippet: "${clean.substring(0, 40)}..."`);
  } else {
    console.log(`🛡️ [Gatekeeper Blocked] No task signals in snippet (${clean.length} chars). Skipping API request.`);
  }

  return isValid;
};

// 4. Cache Helper to prevent re-processing identical snippets
export const isSnippetAlreadyProcessed = async (snippetHash: string): Promise<boolean> => {
  const processedHashes = await getStorageData<string[]>('processed_text_hashes', []);
  return processedHashes.includes(snippetHash);
};

export const markSnippetProcessed = async (snippetHash: string): Promise<void> => {
  const processedHashes = await getStorageData<string[]>('processed_text_hashes', []);
  // Keep last 200 hashes in storage
  const updated = [snippetHash, ...processedHashes.filter(h => h !== snippetHash)].slice(0, 200);
  await setStorageData('processed_text_hashes', updated);
};
