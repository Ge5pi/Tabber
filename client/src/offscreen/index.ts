import { createWorker } from 'tesseract.js';

console.log('[TabAI Offscreen OCR] Offscreen document loaded for local WebAssembly Tesseract OCR.');

let workerInstance: any = null;

async function getWorker() {
  if (!workerInstance) {
    console.log('[TabAI Offscreen OCR] Initializing Tesseract worker...');
    workerInstance = await createWorker('eng+rus');
  }
  return workerInstance;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PERFORM_OCR') {
    const { dataUrl } = message.payload;
    if (!dataUrl) {
      sendResponse({ success: false, error: 'No image data provided' });
      return true;
    }

    console.log('[TabAI Offscreen OCR] Processing local image OCR via WebAssembly...');

    getWorker()
      .then(async (worker) => {
        const result = await worker.recognize(dataUrl);
        const extractedText = result.data.text ? result.data.text.trim() : '';
        console.log(`✅ [TabAI Offscreen OCR] Recognized ${extractedText.length} chars from image.`);
        sendResponse({ success: true, text: extractedText });
      })
      .catch((err) => {
        console.error('❌ [TabAI Offscreen OCR Error]:', err);
        sendResponse({ success: false, text: '', error: err.message || 'OCR failed' });
      });

    return true; // Keep async response channel open
  }
});
