import db from '../db.js';

const TOKEN = process.env.GITHUB_TOKEN;
let gistId   = process.env.GITHUB_GIST_ID;
const FILENAME = 'walletai_backup.json';

export async function saveBackup() {
  if (!TOKEN) return;
  try {
    const users        = db.prepare('SELECT * FROM users').all();
    const transactions = db.prepare('SELECT * FROM transactions').all();
    const keywords     = db.prepare('SELECT * FROM user_keywords').all();
    const content      = JSON.stringify({ users, transactions, keywords });

    const url    = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
    const method = gistId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'WalletAI backup', public: false, files: { [FILENAME]: { content } } }),
    });

    if (!gistId && res.ok) {
      const data = await res.json();
      gistId = data.id;
      console.log(`[backup] Gist creato — aggiungi a Render: GITHUB_GIST_ID=${gistId}`);
    }
  } catch (err) {
    console.error('[backup] saveBackup error:', err.message);
  }
}

export async function restoreBackup() {
  if (!TOKEN || !gistId) return;
  try {
    const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    if (userCount > 0) return;

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    });
    if (!res.ok) return;

    const data    = await res.json();
    const content = data.files?.[FILENAME]?.content;
    if (!content) return;

    const { users = [], transactions = [], keywords = [] } = JSON.parse(content);

    db.transaction(() => {
      for (const u of users) {
        db.prepare('INSERT OR IGNORE INTO users (id,username,email,password_hash,full_name,initial_budget,created_at) VALUES (?,?,?,?,?,?,?)')
          .run(u.id, u.username, u.email, u.password_hash, u.full_name, u.initial_budget, u.created_at);
      }
      for (const t of transactions) {
        db.prepare('INSERT OR IGNORE INTO transactions (id,user_id,amount,type,description,category,date,raw_input,source,confidence,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
          .run(t.id, t.user_id, t.amount, t.type, t.description, t.category, t.date, t.raw_input, t.source, t.confidence, t.created_at);
      }
      for (const k of keywords) {
        db.prepare('INSERT OR IGNORE INTO user_keywords (id,user_id,keyword,category,type,created_at) VALUES (?,?,?,?,?,?)')
          .run(k.id, k.user_id, k.keyword, k.category, k.type, k.created_at);
      }
    })();

    console.log(`[backup] Ripristinati: ${users.length} utenti, ${transactions.length} transazioni`);
  } catch (err) {
    console.error('[backup] restoreBackup error:', err.message);
  }
}
