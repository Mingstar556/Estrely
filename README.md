# Estrely — Intelligent Luxury AI Companion

An advanced, emotionally intelligent AI companion powered by Google Gemini, Multi-AI orchestration, and real-time Google web search integration. Designed with a signature obsidian & gold luxury aesthetic and responsive across PC and mobile platforms.

---

## Key Features

- **Multi-AI Orchestrator with Search**: Combines primary Gemini models with real-time web search fallback for up-to-date knowledge and uninterrupted availability.
- **Youthful & Energetic Persona**: Lively teen voice persona with speech synthesis (`1.08x` rate, `1.18x` pitch) and natural conversational flow.
- **Guest Account Mode**: Instant exploration without signing in. Ephemeral in-memory chat session with zero database storage and a clear privacy warning modal.
- **Full PWA (Progressive Web App)**: Installable directly on iPhone (Safari) and Android (Chrome) with standalone display, home screen icon, and offline asset caching via service worker (`sw.js`).
- **Luxury Obsidian & Gold UI**: Dynamic constellation stardust canvas, glassmorphism panels, glowing avatars, markdown syntax highlighting, and smooth streaming typewriter effect.
- **Privacy & Cookie Consent**: Built-in luxury privacy notice with essential cookie and session storage controls.
- **Mobile React Native Client**: Complete Expo app with tab navigation, guest mode, starter prompt cards, and quick message actions (Copy & Listen).

---

## Architecture

- **Web Client (`pc/`)**: Pure responsive HTML5, CSS3 glassmorphism, modern Vanilla JavaScript, PWA service worker.
- **Mobile Client (`mobile/`)**: React Native & Expo with bottom tabs, native stack, and safe area insets.
- **AI & Backend Engine (`server/python/`)**: Python Flask API, SQLite database, Multi-AI orchestrator, Google Search service, AES-256 message encryption, token guard.
- **API / WebSocket Gateway (`server/node/`)**: Node.js Express & Socket.IO server for real-time duplex streaming.

---

## Quick Start

### 1. Environment Configuration
```bash
cp .env.example .env
# Add your GEMINI_API_KEY and other configuration values
```

### 2. Initialize Database
```bash
python database/init_db.py
```

### 3. Start Python Backend (Serves API and Web Frontend)
```bash
cd server/python
pip install -r requirements.txt
python app.py
```
*The web app will be accessible at `http://localhost:5000` (or `http://0.0.0.0:5000`).*

### 4. Optional: Start Node.js WebSocket Gateway
```bash
cd server/node
npm install
npm start
```

### 5. Run Mobile App (Expo)
```bash
cd mobile
npm install
npx expo start
```
*Scan the QR code with the Expo Go app on iOS or Android.*

---

## Public Deployment

### Deploy to Render / Railway / Cloud VPS
1. Connect this GitHub repository to [Render](https://render.com) or [Railway](https://railway.app).
2. Set root directory to `server/python`.
3. Set build command to `pip install -r requirements.txt`.
4. Set start command to `gunicorn app:app --bind 0.0.0.0:$PORT` (or `python app.py`).
5. Add environment variables: `GEMINI_API_KEY`, `JWT_SECRET`, `PYTHON_PORT=5000`.
6. Access your public HTTPS URL on any PC or phone browser!

### Install as an App on Phones (PWA)
- **iPhone (Safari)**: Open your URL → Tap Share → Tap **"Add to Home Screen"**.
- **Android (Chrome)**: Open your URL → Tap **⋮** → Tap **"Install App"**.

---

## Security & Privacy

- Full JWT token authentication with bcrypt password hashing
- Client-side and server-side input sanitization
- Zero database storage for guest sessions
- AES-256 encrypted message payloads
- Rate limiting and token quota monitoring

---

## License

Proprietary — All Rights Reserved
