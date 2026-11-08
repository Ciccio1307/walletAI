import db from '../db.js';
import { logger } from './logger.js';

const FILENAME = 'walletai_backup.json';
const REQUEST_TIMEOUT_MS = 8000;

let gistId = process.env.GITHUB_GIST_ID;

function getToken() {
  return process.env.GITHUB_TOKEN;
}

function snapshot() {
  return {
    version: 2,
    saved_at: new Date().toISOString(),
    users: db.prepare('SELECT * FROM users').all(),
    transactions: db.prepare('SELECT * FROM transactions').all(),
    keywords: db.prepare('SELECT * FROM user_keywords').all(),
    category_budgets: db.prepare('SELECT * FROM category_budgets').all(),
    goals: db.prepare('SELECT * FROM goals').all(),
  };
}

async function pushSnapshot() {
  const token = getToken();
  if (!token) return;

  const content = JSON.stringify(snapshot());
  const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
  const method = gistId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      description: 'WalletAI backup',
      public: false,
      files: { [FILENAME]: { content } },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    logger.warn(`[backup] GitHub ha risposto ${res.status}`);
    return;
  }

  if (!gistId) {
    const data = await res.json();
    gistId = data.id;
    logger.info(`[backup] Gist creato — aggiungi a Render: GITHUB_GIST_ID=${gistId}`);
  }
}

// Coalesce rapid writes (multi-transaction saves, imports) into a single
// snapshot, while guaranteeing that a write arriving during a snapshot
// triggers another one before the queue drains.
let inFlight = null;
let dirty = false;

export function saveBackup() {
  if (!getToken()) return Promise.resolve();
  dirty = true;

  if (!inFlight) {
    inFlight = (async () => {
      try {
        // Small debounce: a multi-tx save triggers one snapshot, not N.
        await new Promise((resolve) => setTimeout(resolve, 400));
        while (dirty) {
          dirty = false;
          try {
            await pushSnapshot();
          } catch (err) {
            logger.error('[backup] saveBackup error:', err.message);
          }
        }
      } finally {
        inFlight = null;
      }
    })();
  }

  return inFlight;
}

export async function restoreBackup() {
  const token = getToken();
  if (!token || !gistId) return;

  try {
    const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    if (userCount > 0) return;

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`[backup] restore: GitHub ha risposto ${res.status}`);
      return;
    }

    const data = await res.json();
    const content = data.files?.[FILENAME]?.content;
    if (!content) return;

    const parsed = JSON.parse(content);
    const users = parsed.users || [];
    const transactions = parsed.transactions || [];
    const keywords = parsed.keywords || [];
    const budgets = parsed.category_budgets || [];
    const goals = parsed.goals || [];

    db.transaction(() => {
      for (const u of users) {
        db.prepare('INSERT OR IGNORE INTO users (id,username,email,password_hash,full_name,initial_budget,created_at,token_version) VALUES (?,?,?,?,?,?,?,?)')
          .run(u.id, u.username, u.email, u.password_hash, u.full_name, u.initial_budget, u.created_at, u.token_version ?? 0);
      }
      for (const t of transactions) {
        db.prepare('INSERT OR IGNORE INTO transactions (id,user_id,amount,type,description,category,date,raw_input,source,confidence,created_at,recurring) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(t.id, t.user_id, t.amount, t.type, t.description, t.category, t.date, t.raw_input, t.source, t.confidence, t.created_at, t.recurring ?? 0);
      }
      for (const k of keywords) {
        db.prepare('INSERT OR IGNORE INTO user_keywords (id,user_id,keyword,category,type,created_at) VALUES (?,?,?,?,?,?)')
          .run(k.id, k.user_id, k.keyword, k.category, k.type, k.created_at);
      }
      for (const b of budgets) {
        db.prepare('INSERT OR IGNORE INTO category_budgets (id,user_id,category,budget_amount) VALUES (?,?,?,?)')
          .run(b.id, b.user_id, b.category, b.budget_amount);
      }
      for (const g of goals) {
        db.prepare('INSERT OR IGNORE INTO goals (id,user_id,name,target_amount,current_amount,deadline,created_at) VALUES (?,?,?,?,?,?,?)')
          .run(g.id, g.user_id, g.name, g.target_amount, g.current_amount, g.deadline, g.created_at);
      }
    })();

    logger.info(`[backup] Ripristinati: ${users.length} utenti, ${transactions.length} transazioni, ${budgets.length} budget, ${goals.length} obiettivi`);
  } catch (err) {
    logger.error('[backup] restoreBackup error:', err.message);
  }
}

// Export for tests / diagnostics.
export function getGistId() {
  return gistId;
}
