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

- **Authentication** — registration and login with JWT, password hashed with bcrypt
- **Hardened API** — rate limiting on auth endpoints (5 req/min, brute-force protection), secure HTTP headers via helmet, strict input validation
- **3-level AI parsing** — AI (Ollama/Groq/OpenRouter) → dictionary → manual form
- **Preview before saving** — shows parsed data with source badge (AI / Auto / Manual) and allows corrections before confirming
- **User profile** — current balance, editable initial budget, monthly statistics
- **Pure CSS charts** — expenses by category and last 6 months trend, no external libraries
- **Customizable dictionary** — add your own keywords with category and type; they are checked first
- **Filters** — all transactions, income only or expenses only, with tab counter
- **Monthly summary** — month-by-month navigation with bar chart and totals
- **CSV export** — download all transactions including account metadata for emergency recovery
- **Auto backup via GitHub Gist** — every write is mirrored to a private Gist; on redeploy the database is restored automatically with zero manual steps
- **Mobile-first** — bottom navigation bar, 44px touch targets, no accidental zoom on iOS, safe area for notch/Dynamic Island

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
│   ├── index.js                  # Express entry point
│   ├── db.js                     # SQLite init + schema
│   ├── middleware/
│   │   └── auth.js               # JWT guard
│   ├── routes/
│   │   ├── auth.js               # /api/auth/*
│   │   ├── transactions.js       # /api/transactions/*
│   │   └── user.js               # /api/user/*
│   └── utils/
│       ├── parser.js             # 3-level parsing cascade
│       ├── dateParser.js         # Italian dates → DD/MM/YYYY
│       └── backup.js             # Auto backup/restore via GitHub Gist
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # Router + auth guard
│   ├── utils/
│   │   └── api.js                # Centralized apiFetch + VITE_API_URL
│   ├── pages/
│   │   ├── LoginPage.jsx         # Sign in / Sign up
│   │   ├── ProfilePage.jsx       # Stats + keywords + CSV export
│   │   └── TransactionsPage.jsx  # List + AI input + summary
│   ├── components/
│   │   ├── NavBar.jsx            # Top bar (desktop) + Bottom nav (mobile)
│   │   ├── WalletCard.jsx        # Balance card — dark background
│   │   ├── AIInput.jsx           # Text input → preview → confirm/edit
│   │   ├── TransactionList.jsx   # List grouped by date
│   │   ├── CategoryChart.jsx     # CSS bars by category
│   │   ├── MonthlyChart.jsx      # CSS chart last 6 months
│   │   ├── MonthlySummary.jsx    # Collapsible monthly summary
│   │   └── KeywordManager.jsx    # Custom keyword CRUD
│   └── styles/
│       ├── global.css            # CSS variables, reset, base classes
│       └── components.css        # Component styles + responsive
├── public/
│   ├── walletAI_logo.png
│   └── _redirects                # Netlify proxy + SPA fallback rules
├── index.html
├── vite.config.js                # Proxy /api → :3001 in development
├── netlify.toml                  # Build config
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
```

---

## API Reference

### Auth
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/register` | `{ username, email, password, full_name }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ username, password }` | `{ token, user }` |
| GET  | `/api/auth/me` | — (Bearer token) | `{ user }` |

### Transactions
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST   | `/api/transactions/parse` | Parses text — does not save |
| POST   | `/api/transactions` | Saves a transaction |
| GET    | `/api/transactions` | Filters: `?type=in\|out&month=YYYY-MM` |
| DELETE | `/api/transactions/:id` | |
| GET    | `/api/transactions/summary` | Totals by category, current month |

### User
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST   | `/api/user/budget` | `{ initial_budget }` |
| GET    | `/api/user/keywords` | List custom keywords |
| POST   | `/api/user/keywords` | `{ keyword, category, type }` |
| DELETE | `/api/user/keywords/:id` | |

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
   - **Health Check Path:** `/api/health` _(optional, recommended)_
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
