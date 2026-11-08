import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Must be set before the application (and its db.js) is imported.
const tempDir = mkdtempSync(join(tmpdir(), 'walletai-test-'));
process.env.DATABASE_PATH = join(tempDir, 'test.db');
process.env.JWT_SECRET = 'test_secret_for_walletai_api_tests_1234567890';
process.env.AI_DISABLED = 'true';
process.env.TRUST_PROXY = 'false';
process.env.LOG_LEVEL = 'error';
delete process.env.GITHUB_TOKEN;

const request = (await import('supertest')).default;
const app = (await import('../server/app.js')).default;
const db = (await import('../server/db.js')).default;

const api = request(app);

async function register(username, email) {
  const res = await api.post('/api/auth/register').send({
    username,
    email,
    password: 'password123',
    full_name: 'Test User',
  });
  return res;
}

afterAll(() => {
  try { db.close(); } catch { /* already closed */ }
  rmSync(tempDir, { recursive: true, force: true });
});

describe('API', () => {
  let token;
  let refreshToken;

  it('registra un utente senza esporre la password', async () => {
    const res = await register('tester', 'TESTER@Example.com');
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.token_version).toBeUndefined();
    expect(res.body.user.email).toBe('tester@example.com');
    token = res.body.token;
    refreshToken = res.body.refreshToken;
  });

  it('rifiuta il refresh token come access token', async () => {
    const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${refreshToken}`);
    expect(res.status).toBe(401);
  });

  it('accetta l\'access token su /me', async () => {
    const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('tester');
  });

  it('valida la data e non restituisce 500', async () => {
    const res = await api.post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10, type: 'out', date: '31/02/2026' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/date/i);
  });

  it('normalizza un source non valido invece di generare un 500', async () => {
    const res = await api.post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10, type: 'out', date: '03/11/2026', source: 'hacker' });

    expect(res.status).toBe(201);
    expect(res.body.source).toBe('manual');
  });

  it('analizza il testo usando la data del client', async () => {
    const res = await api.post('/api/transactions/parse')
      .set('Authorization', `Bearer ${token}`)
      .send({ raw_text: "sushi 22€ ieri l'altro", today: '03/11/2026' });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(22);
    expect(res.body.category).toBe('cibo');
    expect(res.body.date).toBe('01/11/2026');
    expect(res.body.source).toBe('dictionary');
  });

  it('rifiuta un testo di parsing troppo lungo', async () => {
    const res = await api.post('/api/transactions/parse')
      .set('Authorization', `Bearer ${token}`)
      .send({ raw_text: 'x'.repeat(501) });

    expect(res.status).toBe(400);
  });

  it('crea una transazione valida', async () => {
    const res = await api.post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 22,
        type: 'out',
        description: 'sushi',
        category: 'CIBO',
        date: '02/11/2026',
        source: 'dictionary',
        confidence: 'medium',
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('cibo');
    expect(res.body.date).toBe('02/11/2026');
  });

  it('restituisce una lista paginata', async () => {
    const res = await api.get('/api/transactions?limit=1&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.pages).toBeGreaterThanOrEqual(2);
  });

  it('filtra per tipo', async () => {
    const res = await api.get('/api/transactions?type=out')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((tx) => tx.type === 'out')).toBe(true);
  });

  it('cerca e filtra i ricorrenti', async () => {
    const search = await api.get('/api/transactions?search=sushi&limit=30&page=1')
      .set('Authorization', `Bearer ${token}`);
    expect(search.status).toBe(200);
    expect(search.body.data.every((tx) => /sushi/i.test(tx.description))).toBe(true);

    const escaped = await api.get('/api/transactions?search=%25&limit=30&page=1')
      .set('Authorization', `Bearer ${token}`);
    expect(escaped.status).toBe(200);
    expect(escaped.body.total).toBe(0);

    const recurring = await api.get('/api/transactions?recurring=1')
      .set('Authorization', `Bearer ${token}`);
    expect(recurring.status).toBe(200);
    expect(recurring.body.every((tx) => tx.recurring === 1)).toBe(true);
  });

  it('importa conservando il flag ricorrente e scartando righe non valide', async () => {
    const res = await api.post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([
        null,
        { amount: 9.99, type: 'out', date: '01/10/2026', category: 'svago', description: 'abbonamento import', recurring: true },
        { amount: -1, type: 'out', date: '01/10/2026' },
      ]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imported: 1, skipped: 2 });

    const list = await api.get('/api/transactions?search=abbonamento%20import')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body[0].recurring).toBe(1);

    // Clean up so later count-based assertions are unaffected.
    await api.delete(`/api/transactions/${list.body[0].id}`).set('Authorization', `Bearer ${token}`);
  });

  it('restituisce statistiche aggregate', async () => {
    const res = await api.get('/api/transactions/stats?today=03/11/2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.counts.all).toBeGreaterThanOrEqual(2);
    expect(res.body.currentMonth.year).toBe(2026);
    expect(res.body.currentMonth.month).toBe(11);
    expect(res.body.months).toHaveLength(6);
    expect(res.body.currentMonth.categories.cibo).toBe(22);
  });

  it('restituisce il riepilogo di un mese', async () => {
    const res = await api.get('/api/transactions/summary?month=2026-11')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-11');
    expect(res.body.out).toBeGreaterThanOrEqual(32);
    expect(res.body.categories.cibo).toBe(22);
  });

  it('valida current_amount degli obiettivi', async () => {
    const res = await api.post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vacanza', target_amount: 1000, current_amount: 'abc' });

    expect(res.status).toBe(400);
  });

  it('crea un obiettivo con deadline ISO', async () => {
    const res = await api.post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Vacanza',
        target_amount: 1000,
        current_amount: 100,
        deadline: '2026-12-31',
      });

    expect(res.status).toBe(201);
    expect(res.body.deadline).toBe('2026-12-31');
    expect(res.body.current_amount).toBe(100);
  });

  it('valida il tipo delle keyword', async () => {
    const res = await api.post('/api/user/keywords')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'tabacchi', category: 'svago', type: 'banana' });

    expect(res.status).toBe(400);
  });

  it('crea una keyword e rifiuta i duplicati', async () => {
    const first = await api.post('/api/user/keywords')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'Tabacchi', category: 'svago', type: 'out' });

    expect(first.status).toBe(201);
    expect(first.body.keyword).toBe('tabacchi');

    const duplicate = await api.post('/api/user/keywords')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'tabacchi', category: 'svago', type: 'out' });

    expect(duplicate.status).toBe(409);
  });

  it('salva e legge i budget per categoria', async () => {
    const put = await api.put('/api/user/category-budgets/cibo')
      .set('Authorization', `Bearer ${token}`)
      .send({ budget_amount: 300 });

    expect(put.status).toBe(200);

    const get = await api.get('/api/user/category-budgets')
      .set('Authorization', `Bearer ${token}`);

    expect(get.status).toBe(200);
    expect(get.body).toEqual([
      expect.objectContaining({ category: 'cibo', budget_amount: 300 }),
    ]);
  });

  it('rifiuta un budget negativo', async () => {
    const res = await api.post('/api/user/budget')
      .set('Authorization', `Bearer ${token}`)
      .send({ initial_budget: -5 });

    expect(res.status).toBe(400);
  });

  it('revoca i token al logout', async () => {
    const user = await register('logout-user', 'logout@example.com');
    expect(user.status).toBe(201);

    const logout = await api.post('/api/auth/logout')
      .set('Authorization', `Bearer ${user.body.token}`);
    expect(logout.status).toBe(200);

    const me = await api.get('/api/auth/me')
      .set('Authorization', `Bearer ${user.body.token}`);
    expect(me.status).toBe(401);

    const refresh = await api.post('/api/auth/refresh')
      .send({ refreshToken: user.body.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('cambia password, revoca i vecchi token e restituisce la nuova coppia', async () => {
    const res = await api.post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'password123', newPassword: 'password456' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();

    const oldToken = await api.get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(oldToken.status).toBe(401);

    token = res.body.token;
    refreshToken = res.body.refreshToken;
  });

  it('elimina l\'account solo con la password corretta', async () => {
    const wrong = await api.delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'sbagliata' });
    expect(wrong.status).toBe(403);

    const res = await api.delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'password456' });
    expect(res.status).toBe(200);

    const me = await api.get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);
  });
});
