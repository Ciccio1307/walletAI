<div align="center">
  <img src="public/walletAI_logo.png" alt="WalletAI Logo" width="260"/>

  <h1>WalletAI</h1>
  <p><strong>Personal finance management with AI — locally with Ollama or in the cloud with Groq/OpenRouter.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white" />
    <img src="https://img.shields.io/badge/AI-Ollama%20%7C%20Groq%20%7C%20OpenRouter-black" />
    <img src="https://img.shields.io/badge/Deploy-Netlify%20%2B%20Render-00C7B7?logo=netlify&logoColor=white" />
    <img src="https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa&logoColor=white" />
  </p>

  <p>
    <a href="https://walletaifv.netlify.app"><strong>🌐 Live Demo → walletaifv.netlify.app</strong></a>
  </p>
</div>

---

## What is WalletAI

WalletAI is a full-stack web app for tracking income and expenses naturally: type a phrase like `"sushi 22€ yesterday"` or `"received salary 1200"` and the app automatically understands the amount, category, type, and date.

Parsing works through a **3-level system** that always guarantees a result: it first tries AI, then a keyword dictionary, and finally offers a pre-filled manual form. The AI can run locally with **Ollama** or in the cloud with **Groq** or **OpenRouter** (both free) — same API, just change the URL in `.env`.

---

## Features

### Core
- **Authentication** — registration and login with JWT (7d access + 30d refresh), password hashed with bcrypt
- **Hardened API** — rate limiting on auth endpoints (5 req/min), secure HTTP headers via helmet, strict input validation, Content-Security-Policy
- **3-level AI parsing** — AI (Ollama/Groq/OpenRouter) → keyword dictionary → manual form
- **Multi-transaction parsing** — type `"sushi 22€, taxi 8€, cinema 15€"` and all three are parsed and saved at once
- **Saved templates** — star any input to save it as a quick-access chip for repeated transactions
- **Preview before saving** — shows parsed data with source badge (AI / Auto / Manual) and allows inline corrections before confirming
- **Undo delete** — deleted transactions disappear immediately but are actually removed after 4.5 s; an "Undo" toast lets you cancel

### Finance
- **Savings goals** — create goals with target amount, current savings and optional deadline; automatic month projection based on current savings rate
- **Category budgets** — set monthly spending limits per category; color-coded progress bars (teal → amber → red)
- **Month-over-month delta** — shows % change in spending vs. the previous month
- **Daily rate + forecast** — calculates your daily spending rate and projects total expenses for the end of the month
- **Top spending category** — highlights where most of your monthly budget goes

### Data & Backup
- **CSV export** — download all transactions including account metadata
- **CSV import** — bulk import from a compatible backup file (up to 5 000 rows, transactional)
- **Auto backup via GitHub Gist** — every write is mirrored to a private Gist; on redeploy the database is restored automatically

### UX & Performance
- **PWA** — installable on any device; workbox service worker caches API responses (NetworkFirst) for offline reads
- **Offline banner** — detects connectivity loss and shows a persistent notice
- **Optimistic UI** — new transactions appear instantly without waiting for a server round-trip
- **Server-side search & pagination** — debounced (300 ms) full-text search with AbortController; infinite scroll with 30-item pages
- **Pull-to-refresh** — swipe down on mobile to silently reload
- **Keyboard shortcut** — press `/` anywhere to focus the AI input
- **IntersectionObserver lazy charts** — category and monthly charts animate only when scrolled into view
- **Skeleton loaders** — placeholder cards during initial data fetch
- **Account settings** — change password, delete account (with confirmation)
- **Mobile-first** — bottom navigation bar, 44 px touch targets, safe area for notch/Dynamic Island, `prefers-reduced-motion` support

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite 5 + React Router 6 |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` (synchronous) |
| Authentication | JWT (`jsonwebtoken`) + `bcryptjs` |
| Local AI | Ollama — any LLM model |
| Cloud AI | Groq · OpenRouter (OpenAI-compatible API) |
| Styling | Plain CSS with CSS variables, DM Sans + DM Serif Display |
| PWA | `vite-plugin-pwa` + Workbox |
| Tests | Vitest |
| Deploy | Frontend → Netlify · Backend → Render |

No CSS framework, no UI library.

---

## 3-Level Parsing System

The core of the app. Every level always returns the same object:

```json
{
  "amount": 22,
  "type": "out",
  "description": "sushi",
  "category": "food",
  "date": "02/06/2026",
  "source": "ai | dictionary | manual",
  "confidence": "high | medium | low"
}
```

### Level 1 — AI (Ollama · Groq · OpenRouter)
Calls the `/v1/chat/completions` endpoint (OpenAI-compatible format) with an adaptive timeout: **3 s** for local Ollama, **8 s** for cloud services. The prompt is in Italian and expects a pure JSON response. If the call fails or times out → next level.

### Level 2 — Local dictionary
Over **150 Italian keywords** organized by category. The **user's custom keywords** take priority and are checked first. Extracts amount via regex, recognizes Italian dates (`ieri/yesterday`, `lunedì/Monday`, `12/03`…) and builds a clean description by removing stopwords.

### Level 3 — Manual form
If no pattern matches, shows a pre-filled form with the detected amount. Grey "Manual" badge.

---

## Project Structure

```
walletai/
├── server/
│   ├── index.js                  # Express entry point + CSP headers
│   ├── db.js                     # SQLite init + schema migrations
│   ├── middleware/
│   │   └── auth.js               # JWT guard
│   ├── routes/
│   │   ├── auth.js               # /api/auth/* (login, register, change-password, delete account)
│   │   ├── transactions.js       # /api/transactions/* (CRUD, parse, import, search, pagination)
│   │   ├── user.js               # /api/user/* (budget, keywords, category-budgets)
│   │   └── goals.js              # /api/goals/* (savings goals CRUD)
│   └── utils/
│       ├── parser.js             # 3-level parsing cascade
│       ├── dateParser.js         # Italian dates → DD/MM/YYYY
│       ├── sanitize.js           # Input sanitization helpers
│       ├── logger.js             # Structured request logger
│       └── backup.js             # Auto backup/restore via GitHub Gist
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # Router + auth guard + offline banner
│   ├── hooks/
│   │   └── useKeyboardShortcuts.js
│   ├── utils/
│   │   └── api.js                # Centralized apiFetch + token refresh
│   ├── pages/
│   │   ├── LoginPage.jsx         # Sign in / Sign up
│   │   ├── ProfilePage.jsx       # Stats, goals, budgets, account settings, CSV
│   │   └── TransactionsPage.jsx  # List + AI input + search + filters
│   ├── components/
│   │   ├── NavBar.jsx            # Top bar (desktop) + Bottom nav (mobile) + scroll blur
│   │   ├── WalletCard.jsx        # Balance card — animated count-up, forecast, progress bar
│   │   ├── AIInput.jsx           # Text input → multi-tx → preview → confirm/edit + templates
│   │   ├── TransactionList.jsx   # List grouped by date with edit / recurring toggle
│   │   ├── CategoryChart.jsx     # CSS bars by category (lazy IntersectionObserver)
│   │   ├── MonthlyChart.jsx      # CSS chart last 6 months (lazy IntersectionObserver)
│   │   ├── MonthlySummary.jsx    # Collapsible monthly summary
│   │   ├── CategoryBudgets.jsx   # Per-category budget limits + progress bars
│   │   ├── GoalsCard.jsx         # Savings goals with month projection
│   │   ├── AccountSettings.jsx   # Change password + delete account
│   │   ├── KeywordManager.jsx    # Custom keyword CRUD
│   │   ├── OfflineBanner.jsx     # Fixed banner when navigator.onLine = false
│   │   ├── SkeletonCard.jsx      # Placeholder cards during loading
│   │   ├── Toast.jsx             # Global toast with optional action button (undo)
│   │   └── ErrorBoundary.jsx     # React error boundary
│   └── styles/
│       ├── global.css            # CSS variables, reset, base classes
│       └── components.css        # Component styles + responsive + dark mode
├── public/
│   ├── walletAI_logo.png
│   ├── _redirects                # Netlify proxy + SPA fallback rules
│   └── _headers                  # Netlify security headers (CSP, HSTS…)
├── tests/
│   └── parser.test.js            # Vitest unit tests for the parsing cascade
├── index.html
├── vite.config.js                # Dev proxy /api → :3001 + PWA manifest + Workbox
├── vitest.config.js
├── .nvmrc                        # Node.js version pin (v20)
├── .env.example
├── .gitignore
└── package.json
```

---

## Database Schema

```sql
CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT UNIQUE NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  initial_budget REAL DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      REAL NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('in','out')),
  description TEXT,
  category    TEXT,
  date        TEXT,          -- format DD/MM/YYYY
  raw_input   TEXT,          -- original text entered by the user
  source      TEXT CHECK(source IN ('ai','dictionary','manual')),
  confidence  TEXT CHECK(confidence IN ('high','medium','low')),
  recurring   INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_keywords (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword    TEXT NOT NULL,
  category   TEXT NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('in','out')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE category_budgets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  budget_amount REAL NOT NULL,
  UNIQUE(user_id, category)
);

CREATE TABLE goals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  target_amount  REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  deadline       TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Reference

### Auth
| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| POST | `/api/auth/register` | `{ username, email, password, full_name }` | Returns `{ token, user }` |
| POST | `/api/auth/login` | `{ username, password }` | Returns `{ token, refreshToken, user }` |
| POST | `/api/auth/refresh` | `{ refreshToken }` | Returns new `{ token }` |
| GET  | `/api/auth/me` | — (Bearer token) | Returns `{ user }` |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` | Min 8 chars |
| DELETE | `/api/auth/account` | `{ password }` | Deletes all user data |

### Transactions
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST   | `/api/transactions/parse` | Parses text — does not save |
| POST   | `/api/transactions` | Saves a transaction |
| GET    | `/api/transactions` | Plain array; add `?search=&page=&limit=` for paginated `{ data, total, page, pages }` |
| PUT    | `/api/transactions/:id` | Update a transaction |
| DELETE | `/api/transactions/:id` | |
| PATCH  | `/api/transactions/:id/recurring` | Toggle recurring flag |
| POST   | `/api/transactions/import` | Bulk insert up to 5 000 rows (transactional) |

### User
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST   | `/api/user/budget` | `{ initial_budget }` |
| GET    | `/api/user/keywords` | List custom keywords |
| POST   | `/api/user/keywords` | `{ keyword, category, type }` |
| DELETE | `/api/user/keywords/:id` | |
| GET    | `/api/user/category-budgets` | List all budget limits |
| PUT    | `/api/user/category-budgets/:category` | `{ budget_amount }` — upsert |

### Goals
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET    | `/api/goals` | List all savings goals |
| POST   | `/api/goals` | `{ name, target_amount, current_amount, deadline? }` |
| PATCH  | `/api/goals/:id` | `{ current_amount }` — update progress |
| DELETE | `/api/goals/:id` | |

### Health
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET    | `/api/health` | `{ "status": "ok" }` — no auth, used as Render health check |

---

## Running Locally

### 1. Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) installed and running _(optional — you can use Groq/OpenRouter instead)_

```bash
ollama pull qwen2.5:7b
```

### 2. Installation

```bash
git clone https://github.com/Ciccio1307/walletAI.git
cd walletAI
npm install
cp .env.example .env
```

### 3. Environment variables (`.env`)

**With local Ollama:**
```env
JWT_SECRET=a_long_secret_string
PORT=3001
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

**With Groq (free cloud):**
```env
JWT_SECRET=a_long_secret_string
PORT=3001
OLLAMA_URL=https://api.groq.com/openai
OLLAMA_MODEL=llama-3.1-8b-instant
OLLAMA_API_KEY=gsk_your_key   # from console.groq.com
```

### 4. Start

```bash
npm run dev
```

- Frontend → [http://localhost:5173](http://localhost:5173)
- Backend  → [http://localhost:3001](http://localhost:3001)

### 5. Run tests

```bash
npm test
```

---

## Deploy on Netlify + Render

Production architecture:

```
Browser / Mobile
        │
        ▼
https://walletaifv.netlify.app   ← React frontend (Netlify)
        │  /api/* (Netlify proxy)
        ▼
https://walletai-backend.onrender.com  ← Express backend + SQLite (Render)
        │
        ▼
   Groq / OpenRouter           ← Free cloud AI
```

### Step 1 — Get a free AI API key

Choose one of the two providers:

| Provider | Sign up | Recommended model | Free limit |
|----------|---------|-------------------|------------|
| **Groq** | [console.groq.com](https://console.groq.com) | `llama-3.1-8b-instant` | ~14,400 req/day |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | `qwen/qwen-2.5-7b-instruct:free` | free credits |

### Step 2 — Deploy backend on Render

1. Create an account at [render.com](https://render.com)
2. **New → Web Service** → connect your GitHub repository
3. Service settings:
   - **Build command:** `npm install && npm rebuild better-sqlite3`
   - **Start command:** `node server/index.js`
   - **Environment:** Node
   - **Health Check Path:** `/api/health`
4. Add these environment variables in the Render dashboard:

```
JWT_SECRET        = a_long_random_secret_string
PORT              = 3001
NODE_VERSION      = 20
ALLOWED_ORIGIN    = https://YOUR-SITE-NAME.netlify.app

# With Groq:
OLLAMA_URL        = https://api.groq.com/openai
OLLAMA_MODEL      = llama-3.1-8b-instant
OLLAMA_API_KEY    = gsk_...

# Or with OpenRouter:
# OLLAMA_URL      = https://openrouter.ai/api
# OLLAMA_MODEL    = qwen/qwen-2.5-7b-instruct:free
# OLLAMA_API_KEY  = sk-or-...

# Auto backup (optional but recommended — see section below):
GITHUB_TOKEN      = ghp_...
GITHUB_GIST_ID    = (leave empty on first deploy, fill after)
```

5. Click **Deploy** → copy the assigned URL (e.g. `https://walletai-abc123.onrender.com`)

### Step 3 — Update `public/_redirects`

Open `public/_redirects` and replace the backend URL with your Render URL:

```
/api/*  https://walletai-abc123.onrender.com/api/:splat  200
/*      /index.html   200
```

### Step 4 — Deploy frontend on Netlify

1. Create an account at [netlify.com](https://netlify.com)
2. Run `npm run build` locally — this generates the `dist/` folder
3. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Deploy manually**
4. Drag and drop the `dist/` folder into the Netlify dashboard

The `public/_redirects` file (copied into `dist/` by Vite) handles:
- Proxying `/api/*` to the Render backend (no CORS issues)
- SPA redirect (`/*` → `index.html`) for React Router

---

## Persistent Data on Render Free Tier

Render's free tier resets the filesystem on every redeploy. WalletAI solves this with an **automatic GitHub Gist backup**: every write (transaction, keyword, budget) is mirrored to a private Gist; on startup, if the database is empty, the data is restored automatically.

### Setup (one-time)

**1. Create a GitHub Personal Access Token**
- Go to https://github.com/settings/tokens → **Generate new token (classic)**
- Enable only the **`gist`** scope → copy the token

**2. Add to Render environment variables:**
```
GITHUB_TOKEN   = ghp_your_token_here
GITHUB_GIST_ID = (leave empty for now)
```

**3. Deploy.** On first transaction saved, the server logs:
```
[backup] Gist creato — aggiungi a Render: GITHUB_GIST_ID=abc123def456...
```

**4.** Copy that ID and add `GITHUB_GIST_ID` to Render env vars. From now on every redeploy restores the database automatically — no manual steps needed.

> If `GITHUB_TOKEN` is not set the backup is silently skipped and the app works normally.

---

## Compatible AI Models

### Local (Ollama)

| Model | Quality | RAM |
|-------|---------|-----|
| `qwen2.5:7b` | ⭐⭐⭐ Recommended | ~5 GB |
| `llama3.1:8b` | ⭐⭐⭐ | ~6 GB |
| `mistral:7b` | ⭐⭐ | ~5 GB |
| `phi3:mini` | ⭐ Lightweight | ~2 GB |

### Free cloud

| Model | Provider | Notes |
|-------|----------|-------|
| `llama-3.1-8b-instant` | Groq | Very fast, recommended for production |
| `llama-3.3-70b-versatile` | Groq | Best quality, slower |
| `qwen/qwen-2.5-7b-instruct:free` | OpenRouter | Same model as local Ollama |
| `mistralai/mistral-7b-instruct:free` | OpenRouter | Lightweight alternative |

To change the model: edit `OLLAMA_MODEL` in `.env` (local) or in the Render environment variables (production).

---

## Design System

```css
--bg:     #F5F2EE   /* warm background */
--card:   #FFFFFF   /* white cards */
--ink:    #1A1714   /* main text */
--muted:  #7A7570   /* secondary text */
--teal:   #1D9E75   /* green — income and primary actions */
--red:    #C53030   /* red — expenses and errors */
```

Fonts: **DM Sans** (UI) + **DM Serif Display** (numbers and headings) via Google Fonts.

Full dark mode support via `@media (prefers-color-scheme: dark)`.

---

## Supported Categories

| Emoji | Category | Type | Example keywords |
|-------|----------|------|-----------------|
| 🍽️ | food | expense | sushi, pizza, supermarket, bar, breakfast |
| 🚗 | transport | expense | petrol, train, uber, parking, toll |
| 💊 | health | expense | pharmacy, dentist, gym, doctor |
| 🎮 | leisure | expense | netflix, cinema, spotify, videogame |
| 🎁 | gifts | expense | gift, birthday, flowers, christmas |
| 🏠 | home | expense | rent, bill, ikea, internet |
| 🛍️ | shopping | expense | zara, amazon, shoes, phone |
| 💼 | work | expense | course, university, work subscription |
| 💰 | income | income | salary, bank transfer, freelance, refund |
| 📦 | other | expense | everything else |

---

## License

MIT — free to use, modify and distribute.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes.

---

_WalletAI — Personal finance with AI, locally or in the cloud._
