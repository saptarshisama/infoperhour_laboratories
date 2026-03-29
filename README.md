# Infoperhour Laboratories v2 — Global Intelligence Dashboard

A real-time, hybrid static/proxy platform tracking global conflicts, aviation, marine traffic, disasters, and geopolitical events.

## 🗄️ Project Architecture

Infoperhour Laboratories v2 uses a **Hybrid Architecture** to maximize performance while securely hiding API keys:
1. **Frontend (Static Site):** HTML/CSS/JS shell. Can be hosted anywhere.
2. **Backend (Proxy):** A lightweight Node.js/Express server that securely fetches API-key protected data (AISStream, ADSB.lol) and bypasses CORS restrictions (RSS News Feeds).

### File Structure
```text
infoperhour_laboratories/
├── index.html        ← Main dashboard UI
├── styles.css        ← Dark-mode design system & animations
├── app.js            ← Main orchestrator, tabs, filters, & map overlays
├── events.js         ← OSINT fetching: Quakes (USGS), Humanitarian (ReliefWeb), Conflict (GDELT), Proxy News
├── map.js            ← Leaflet interactive map setup
├── aviation.js       ← ADSB live military aircraft mapping via proxy
├── marine.js         ← AISStream WebSocket live ships via proxy
├── weather.js        ← Open-Meteo severe weather alerts
├── chat.js           ← Firebase real-time chat module
├── render.yaml       ← Automated cloud deployment config
└── proxy/            ← Node.js Backend Server
    ├── server.js     ← Express server handling REST & SSE streams
    ├── package.json
    └── .env          ← Secure API keys
```

---

## 💻 Local Development

To run Infoperhour Laboratories locally, you need to run **both** the frontend and the proxy server.

### 1. Start the Backend Proxy
Open a terminal and run:
```bash
cd proxy
npm install
node server.js
```
*The proxy will run on `http://localhost:3001`.*

### 2. Start the Frontend Web Server
**Yes, you MUST use a local web server.** If you just double-click `index.html`, your browser will block the scripts from fetching data due to CORS security rules.

You can use the python server you are already using, or `npx`:

**Option A (Python - Recommended if installed):**
```bash
# Run this from the main infoperhour_laboratories folder
python -m http.server 8765
```

**Option B (Node / npx):**
```bash
npx http-server ./ -p 8765
```
*Then open `http://localhost:8765` in your browser.*

---

## 🚀 Cloud Deployment (Render Free Tier)

You can host both the frontend and backend on Render for free using the provided `render.yaml`.

1. **Push to GitHub**: Push this entire project folder to a GitHub repository.
2. **Connect to Render**: Go to [dash.render.com](https://dash.render.com/) → **New** → **Blueprint** → connect your GitHub repository.
3. Render will read `render.yaml` and automatically create two services:
   - `world-monitor-frontend` (Static Site)
   - `world-monitor-proxy` (Web Service)
4. **Environment Variables**: In the Render dashboard, go to the `world-monitor-proxy` service → **Environment** and add:
   - `AISSTREAM_API_KEY` (Get from aisstream.io)
5. **Update Frontend Config**: Once the proxy is live, get its URL (e.g., `https://world-monitor-proxy.onrender.com`) and update `CONFIG.PROXY_URL` at the bottom of `index.html`.

---

## 💬 Firebase Real-Time Chat Setup 

The chat relies on Firebase to allow multi-user interactions. 

### Step 1 — Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `infoperhour-labs` → Continue
3. Disable Google Analytics (optional) → **Create project**

### Step 2 — Enable Realtime Database
1. Left sidebar → **Build** → **Realtime Database** → **Create database**
2. Select **Start in TEST MODE** → choose the closest region → **Enable**

### Step 3 — Get your config & Update `chat.js`
1. Click the **gear icon** → **Project settings**
2. Scroll to **Your apps** → Click `</>` (Web)
3. Register app (name it `infoperhour-web`)
4. Copy the `firebaseConfig` object and paste it into `chat.js` replacing the placeholder:
```javascript
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",      // ← Replace these dummy strings
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  // ...
};
```

### Step 4 — Secure Database Rules
In the Firebase console → Realtime Database → **Rules** tab, paste the following rules and click **Publish**:
```json
{
  "rules": {
    "chat": {
      "messages": { ".read": true, ".write": true },
      "presence": { ".read": true, ".write": true },
      "typing": { ".read": true, ".write": true },
      "users": { ".read": true, ".write": true }
    }
  }
}
```
*(If you do not configure Firebase, `chat.js` will fall back to **Local Mode** where messages are only visible on your own machine.)*

---

## 📊 Integrations & API Limits

| Source | Data | Tier Limit / Notes |
|---------|-----------|-------|
| **AISStream** | Live Marine Traffic (SSE) | Free key required |
| **ADSB.lol** | Live Military Aviation | Free / Open / No Key |
| **GDELT** | Conflict/Political Events | Free API (~15 min delay) |
| **USGS** | Global Earthquakes | Free / No Key |
| **ReliefWeb** | Humanitarian Disasters (UN) | Free / No Key |
| **Open-Meteo** | Severe Weather Alerts | Free / No Key |
| **Google News RSS** | Global Conflict News | Free / Fetched securely via proxy |
| **Firebase** | Chat System | 100 concurrent users / 10 GB/mo |
