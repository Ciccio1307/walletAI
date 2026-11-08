import { afterAll, describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Must be set before backup.js (and its db.js) is imported: never touch the
// real server/walletai.db from tests.
const tempDir = mkdtempSync(join(tmpdir(), 'walletai-backup-test-'));
process.env.DATABASE_PATH = join(tempDir, 'test.db');
process.env.LOG_LEVEL = 'error';
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_GIST_ID = 'test-gist';

const {
  encryptBackup, decryptBackup, readBackupContent,
  restoreBackup, saveBackup, isBackupBlocked,
} = await import('../server/utils/backup.js');
const db = (await import('../server/db.js')).default;

afterAll(() => {
  vi.unstubAllGlobals();
  db.close();
  rmSync(tempDir, { recursive: true, force: true });
});

const SECRET = 'test-backup-key-with-enough-entropy';
const SNAPSHOT = { version: 2, users: [{ id: 1, password_hash: '$2a$12$abc' }], transactions: [] };

describe('backup encryption', () => {
  it('cifra senza lasciare dati in chiaro e decifra correttamente', () => {
    const content = encryptBackup(JSON.stringify(SNAPSHOT), SECRET);
    expect(content).not.toContain('password_hash');
    expect(content).not.toContain('$2a$12$abc');
    expect(readBackupContent(content, SECRET)).toEqual(SNAPSHOT);
  });

  it('usa salt e IV diversi a ogni backup', () => {
    const a = JSON.parse(encryptBackup('x', SECRET));
    const b = JSON.parse(encryptBackup('x', SECRET));
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('rifiuta una chiave sbagliata', () => {
    const envelope = JSON.parse(encryptBackup('x', SECRET));
    expect(() => decryptBackup(envelope, 'chiave-sbagliata')).toThrow();
  });

  it('rifiuta un backup manomesso', () => {
    const envelope = JSON.parse(encryptBackup(JSON.stringify(SNAPSHOT), SECRET));
    const data = Buffer.from(envelope.data, 'base64');
    data[0] ^= 1;
    envelope.data = data.toString('base64');
    expect(() => decryptBackup(envelope, SECRET)).toThrow();
  });

  it('accetta ancora i vecchi backup in chiaro', () => {
    expect(readBackupContent(JSON.stringify(SNAPSHOT), SECRET)).toEqual(SNAPSHOT);
    expect(readBackupContent(JSON.stringify(SNAPSHOT), undefined)).toEqual(SNAPSHOT);
  });

  it('segnala un backup cifrato senza chiave', () => {
    const content = encryptBackup('{}', SECRET);
    expect(() => readBackupContent(content, undefined)).toThrow(/BACKUP_KEY/);
  });
});

describe('restore fallito', () => {
  it('sospende i backup per non sovrascrivere il Gist con un DB vuoto', async () => {
    const encrypted = encryptBackup(JSON.stringify(SNAPSHOT), SECRET);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: { 'walletai_backup.json': { content: encrypted } } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.BACKUP_KEY; // misconfigured deploy: key missing

    await restoreBackup();
    expect(isBackupBlocked()).toBe(true);

    fetchMock.mockClear();
    await saveBackup();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
