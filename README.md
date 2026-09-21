# TabAI — Chrome Extension & Focus Guard

**TabAI** is an AI-powered Chrome Extension (Manifest V3) built with **React 19, TypeScript, Vite, Tailwind CSS**, and a **Node.js Express** backend using **Gemini 1.5 Flash API**.

---

## 🌟 Features

1. **Smart Tab Manager**:
   - Lists all open tabs across browser windows.
   - Intelligent domain grouping & duplicate detection.
   - One-click duplicate tab removal (`Remove Duplicates`).
   - AI categorization & workspace overview (`AI Categorize`).

2. **Pomodoro & Focus Guard (Smart Blocker)**:
   - 25m Focus / 5m Break timer.
   - Intercepts tab navigation during active focus sessions.
   - AI evaluates target URLs against your active task.
   - Automatically redirects distracting pages to a sleek `blocked.html` focus screen.

3. **Content Script AI Task Creation**:
   - Highlight any text on any webpage to reveal a floating **`+ AI Task`** button.
   - Converts selected snippet into a structured task (Title, Category, Priority, Estimate).
   - Saved directly to Chrome Storage and synced with Side Panel.

---

## 📁 Repository Structure

```
tabai/
├── extension/          # Chrome Extension (Vite + React + TS + Tailwind)
│   ├── manifest.json   # Manifest V3 configuration
│   ├── src/
│   │   ├── sidepanel/  # React Side Panel UI
│   │   ├── background/ # Background Service Worker
│   │   ├── content/    # Content Script (Text selection task widget)
│   │   └── blocked/    # Focus Guard Blocked page
│   └── dist/           # Compiled extension output (load in Chrome)
└── server/             # Node.js Express Backend
    └── src/
        └── index.js    # Express server & Gemini API endpoints
```

---

## 🚀 Quick Start Guide

### Step 1: Start Node.js Express Backend

```bash
cd server
npm install

# Optional: Add Gemini API Key for AI features
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

npm start
```
*Server will start listening on `http://localhost:3000`.*

---

### Step 2: Build Chrome Extension

```bash
cd extension
npm install
npm run build
```
*This compiles TypeScript and builds the extension into `extension/dist`.*

---

### Step 3: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle at top right).
3. Click **Load unpacked**.
4. Select the `extension/dist` directory.
5. Click the **TabAI** puzzle piece / extension icon to open the Side Panel!

---

## 🛠 Tech Stack

- **Client**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide React Icons.
- **Backend**: Node.js, Express, Cors, Google Gemini 1.5 Flash REST API.
- **Extension**: Chrome Extension Manifest V3 (Side Panel API, Storage API, Tabs API, Content Scripts).
