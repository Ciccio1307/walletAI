<div align="center">
  <img src="public/walletAI_logo.png" alt="WalletAI Logo" width="260"/>

  <h1>WalletAI</h1>
  <p><strong>Gestione finanze personali con AI — in locale con Ollama o nel cloud con Groq/OpenRouter.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white" />
    <img src="https://img.shields.io/badge/AI-Ollama%20%7C%20Groq%20%7C%20OpenRouter-black" />
    <img src="https://img.shields.io/badge/Deploy-Netlify%20%2B%20Render-00C7B7?logo=netlify&logoColor=white" />
  </p>
</div>

---

## Cos'è WalletAI

WalletAI è un'app web full-stack per tenere traccia di entrate e uscite in modo naturale: scrivi una frase come `"sushi 22€ ieri"` oppure `"ricevuto stipendio 1200"` e l'app capisce automaticamente importo, categoria, tipo e data.

Il parsing avviene tramite un sistema a **3 livelli** che garantisce sempre un risultato: prima tenta con l'AI, poi con un dizionario di parole chiave italiane, infine propone un form manuale pre-compilato. L'AI può girare in locale con **Ollama** o nel cloud con **Groq** o **OpenRouter** (entrambi gratuiti) — stessa API, cambia solo l'URL nel `.env`.

---



## Funzionalità

- **Autenticazione** — registrazione e login con JWT, password hashata con bcrypt
- **Parsing AI a 3 livelli** — AI (Ollama/Groq/OpenRouter) → dizionario → form manuale
- **Preview prima del salvataggio** — mostra i dati interpretati con badge fonte (AI / Auto / Manuale) e permette di correggere prima di confermare
- **Profilo utente** — saldo attuale, budget iniziale modificabile, statistiche mensili
- **Grafici CSS puri** — uscite per categoria e andamento degli ultimi 6 mesi, senza librerie esterne
- **Dizionario personalizzabile** — aggiungi le tue parole chiave con categoria e tipo; vengono controllate per prime
- **Filtri** — tutte le transazioni, solo entrate o solo uscite, con contatore per tab
- **Riepilogo mensile** — navigazione mese per mese con grafico a barre e totali
- **Esporta CSV** — scarica tutte le transazioni in un click
- **Mobile-first** — bottom navigation bar, target di tocco 44 px, nessun zoom involontario su iOS, safe area per notch/Dynamic Island

---

## Tech Stack

| Livello | Tecnologia |
|---------|------------|
| Frontend | React 18 + Vite 5 + React Router 6 |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` (sincrono) |
| Autenticazione | JWT (`jsonwebtoken`) + `bcryptjs` |
| AI in locale | Ollama — qualsiasi modello LLM |
| AI in cloud | Groq · OpenRouter (API OpenAI-compatible) |
| Styling | CSS puro con variabili CSS, DM Sans + DM Serif Display |
| Deploy | Frontend → Netlify · Backend → Render |

Nessun framework CSS, nessuna UI library.

---

## Sistema di Parsing a 3 Livelli

Il cuore dell'app. Ogni livello restituisce sempre lo stesso oggetto:

```json
{
  "amount": 22,
  "type": "out",
  "description": "sushi",
  "category": "cibo",
  "date": "02/06/2026",
  "source": "ai | dictionary | manual",
  "confidence": "high | medium | low"
}
```

### Livello 1 — AI (Ollama · Groq · OpenRouter)
Chiama l'endpoint `/v1/chat/completions` (formato OpenAI-compatible) con un timeout adattivo: **3 s** per Ollama locale, **8 s** per servizi cloud. Il prompt è in italiano e richiede risposta JSON pura. Se la chiamata fallisce o scade → livello successivo.

### Livello 2 — Dizionario locale
Oltre **150 parole chiave italiane** suddivise per categoria. Le **parole chiave personalizzate dell'utente** hanno priorità e vengono controllate per prime. Estrae importo con regex, riconosce date italiane (`ieri`, `lunedì`, `12/03`…) e costruisce una descrizione pulita rimuovendo le stopword.

### Livello 3 — Form manuale
Se nessun pattern corrisponde, mostra un form pre-compilato con l'importo rilevato. Badge grigio "Manuale".

---

## Struttura del Progetto

```
walletai/
├── server/
│   ├── index.js                  # Entry point Express
│   ├── db.js                     # Init SQLite + schema
│   ├── middleware/
│   │   └── auth.js               # Guard JWT
│   ├── routes/
│   │   ├── auth.js               # /api/auth/*
│   │   ├── transactions.js       # /api/transactions/*
│   │   └── user.js               # /api/user/*
│   └── utils/
│       ├── parser.js             # Cascata parsing 3 livelli
│       └── dateParser.js         # Date italiane → DD/MM/YYYY
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # Router + guardia auth
│   ├── utils/
│   │   └── api.js                # apiFetch centralizzato + VITE_API_URL
│   ├── pages/
│   │   ├── LoginPage.jsx         # Accedi / Registrati
│   │   ├── ProfilePage.jsx       # Statistiche + keywords + export CSV
│   │   └── TransactionsPage.jsx  # Lista + AI input + riepilogo
│   ├── components/
│   │   ├── NavBar.jsx            # Top bar (desktop) + Bottom nav (mobile)
│   │   ├── WalletCard.jsx        # Card saldo — sfondo scuro
│   │   ├── AIInput.jsx           # Input testo → preview → conferma/modifica
│   │   ├── TransactionList.jsx   # Lista raggruppata per data
│   │   ├── CategoryChart.jsx     # Barre CSS uscite per categoria
│   │   ├── MonthlyChart.jsx      # Grafico CSS ultimi 6 mesi
│   │   ├── MonthlySummary.jsx    # Riepilogo mensile collassabile
│   │   └── KeywordManager.jsx    # CRUD parole chiave personalizzate
│   └── styles/
│       ├── global.css            # Variabili CSS, reset, classi base
│       └── components.css        # Stili per componente + responsive
├── public/
│   └── walletAI_logo.png
├── index.html
├── vite.config.js                # Proxy /api → :3001 in sviluppo
├── netlify.toml                  # Build config + proxy API + SPA redirect
├── .env.example
├── .gitignore
└── package.json
```

---

## Schema Database

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
  date        TEXT,          -- formato DD/MM/YYYY
  raw_input   TEXT,          -- testo originale inserito dall'utente
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
| Metodo | Endpoint | Body | Risposta |
|--------|----------|------|----------|
| POST | `/api/auth/register` | `{ username, email, password, full_name }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ username, password }` | `{ token, user }` |
| GET  | `/api/auth/me` | — (Bearer token) | `{ user }` |

### Transazioni
| Metodo | Endpoint | Note |
|--------|----------|------|
| POST   | `/api/transactions/parse` | Parsifica il testo — non salva |
| POST   | `/api/transactions` | Salva una transazione |
| GET    | `/api/transactions` | Filtri: `?type=in\|out&month=YYYY-MM` |
| DELETE | `/api/transactions/:id` | |
| GET    | `/api/transactions/summary` | Totali per categoria, mese corrente |

### Utente
| Metodo | Endpoint | Note |
|--------|----------|------|
| POST   | `/api/user/budget` | `{ initial_budget }` |
| GET    | `/api/user/keywords` | Lista parole chiave |
| POST   | `/api/user/keywords` | `{ keyword, category, type }` |
| DELETE | `/api/user/keywords/:id` | |

---

## Avvio in locale

### 1. Prerequisiti

- Node.js 18+
- [Ollama](https://ollama.com) installato e in esecuzione _(opzionale — puoi usare Groq/OpenRouter)_

```bash
ollama pull qwen2.5:7b
```

### 2. Installazione

```bash
git clone https://github.com/tuo-username/walletai.git
cd walletai
npm install
cp .env.example .env
```

### 3. Variabili d'ambiente (`.env`)

**Con Ollama locale:**
```env
JWT_SECRET=una_stringa_segreta_lunga
PORT=3001
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

**Con Groq (cloud gratuito):**
```env
JWT_SECRET=una_stringa_segreta_lunga
PORT=3001
OLLAMA_URL=https://api.groq.com/openai
OLLAMA_MODEL=llama-3.1-8b-instant
OLLAMA_API_KEY=gsk_la_tua_chiave   # da console.groq.com
```

### 4. Avvio

```bash
npm run dev
```

- Frontend → [http://localhost:5173](http://localhost:5173)
- Backend  → [http://localhost:3001](http://localhost:3001)

---

## Deploy su Netlify + Render

L'architettura di produzione:

```
Browser / Cellulare
        │
        ▼
https://walletai.netlify.app   ← frontend React (Netlify)
        │  /api/* (proxy Netlify)
        ▼
https://walletai.onrender.com  ← backend Express + SQLite (Render)
        │
        ▼
   Groq / OpenRouter           ← AI cloud gratuita
```

### Passo 1 — Ottieni una API key AI gratuita

Scegli uno dei due provider:

| Provider | Registrazione | Modello consigliato | Limite free |
|----------|--------------|--------------------|----|
| **Groq** | [console.groq.com](https://console.groq.com) | `llama-3.1-8b-instant` | ~14.400 req/giorno |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | `qwen/qwen-2.5-7b-instruct:free` | crediti gratuiti |

### Passo 2 — Deploy del backend su Render

1. Crea un account su [render.com](https://render.com)
2. **New → Web Service** → connetti il repository GitHub
3. Impostazioni del servizio:
   - **Build command:** `npm install`
   - **Start command:** `node server/index.js`
   - **Environment:** Node
4. Aggiungi queste variabili d'ambiente nel pannello Render:

```
JWT_SECRET        = una_stringa_segreta_lunga_e_casuale
PORT              = 3001
ALLOWED_ORIGIN    = https://NOME-TUO-SITO.netlify.app

# Con Groq:
OLLAMA_URL        = https://api.groq.com/openai
OLLAMA_MODEL      = llama-3.1-8b-instant
OLLAMA_API_KEY    = gsk_...

# Oppure con OpenRouter:
# OLLAMA_URL      = https://openrouter.ai/api
# OLLAMA_MODEL    = qwen/qwen-2.5-7b-instruct:free
# OLLAMA_API_KEY  = sk-or-...
```

5. Clicca **Deploy** → copia l'URL assegnato (es. `https://walletai-abc123.onrender.com`)

> **Nota storage:** sul free tier di Render il disco è persistente ma si azzera ad ogni nuovo deploy da zero. Per dati permanenti considera il piano Starter ($7/mese) o esporta regolarmente il CSV.

### Passo 3 — Configura `netlify.toml`

Apri `netlify.toml` e sostituisci l'URL placeholder con quello del tuo backend Render:

```toml
[[redirects]]
  from   = "/api/*"
  to     = "https://walletai-abc123.onrender.com/api/:splat"
  status = 200
  force  = true
```

### Passo 4 — Deploy del frontend su Netlify

1. Crea un account su [netlify.com](https://netlify.com)
2. **Add new site → Import an existing project** → connetti il repository GitHub
3. Impostazioni build:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Clicca **Deploy site**

Il file `netlify.toml` gestisce automaticamente:
- Il proxy da `/api/*` al backend Render (nessun problema CORS)
- Il redirect SPA (`/*` → `index.html`) per React Router

---

## Modelli AI compatibili

### Locali (Ollama)

| Modello | Qualità | RAM |
|---------|---------|-----|
| `qwen2.5:7b` | ⭐⭐⭐ Consigliato | ~5 GB |
| `llama3.1:8b` | ⭐⭐⭐ | ~6 GB |
| `mistral:7b` | ⭐⭐ | ~5 GB |
| `phi3:mini` | ⭐ Leggero | ~2 GB |

### Cloud gratuiti

| Modello | Provider | Note |
|---------|----------|------|
| `llama-3.1-8b-instant` | Groq | Velocissimo, consigliato in produzione |
| `llama-3.3-70b-versatile` | Groq | Qualità massima, più lento |
| `qwen/qwen-2.5-7b-instruct:free` | OpenRouter | Stesso modello di Ollama locale |
| `mistralai/mistral-7b-instruct:free` | OpenRouter | Alternativa leggera |

Per cambiare modello: modifica `OLLAMA_MODEL` nel `.env` (locale) o nelle variabili d'ambiente Render (produzione).

---

## Design System

```css
--bg:     #F5F2EE   /* sfondo caldo */
--card:   #FFFFFF   /* card bianche */
--ink:    #1A1714   /* testo principale */
--muted:  #7A7570   /* testo secondario */
--teal:   #1D9E75   /* verde — entrate e azioni primarie */
--red:    #C53030   /* rosso — uscite e errori */
```

Font: **DM Sans** (interfaccia) + **DM Serif Display** (numeri e titoli) via Google Fonts.

---

## Categorie supportate

| Emoji | Categoria | Tipo | Esempi parole chiave |
|-------|-----------|------|----------------------|
| 🍽️ | cibo | uscita | sushi, pizza, supermercato, bar, colazione |
| 🚗 | trasporti | uscita | benzina, treno, uber, parcheggio, pedaggio |
| 💊 | salute | uscita | farmacia, dentista, palestra, medico |
| 🎮 | svago | uscita | netflix, cinema, spotify, videogioco |
| 🎁 | regali | uscita | regalo, compleanno, fiori, natale |
| 🏠 | casa | uscita | affitto, bolletta, ikea, internet |
| 🛍️ | shopping | uscita | zara, amazon, scarpe, telefono |
| 💼 | lavoro | uscita | corso, università, abbonamento lavoro |
| 💰 | entrata | entrata | stipendio, bonifico, freelance, rimborso |
| 📦 | altro | uscita | tutto il resto |

---

## Licenza

MIT — libero di usare, modificare e distribuire.

---

## Contribuire

Pull request benvenute. Apri prima una issue per discutere cambiamenti significativi.

---

_WalletAI — Finanze personali con AI, in locale o nel cloud._
