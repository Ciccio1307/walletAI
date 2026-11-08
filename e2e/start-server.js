// Starts the real API on a throw-away database for end-to-end tests.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'walletai-e2e-'));
process.env.DATABASE_PATH = join(dir, 'e2e.db');
process.env.JWT_SECRET = 'e2e_secret_for_walletai_playwright_tests_123456';
process.env.PORT = process.env.E2E_API_PORT || '3101';
process.env.AI_DISABLED = 'true';
process.env.TRUST_PROXY = 'false';
process.env.LOG_LEVEL = 'warn';
process.env.REGISTER_RATE_LIMIT = '1000';
process.env.ALLOWED_ORIGIN = process.env.E2E_WEB_ORIGIN || 'http://localhost:4174';
delete process.env.GITHUB_TOKEN;

await import('../server/index.js');
