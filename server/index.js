import 'dotenv/config';
import app from './app.js';
import db from './db.js';
import { restoreBackup } from './utils/backup.js';
import { logger } from './utils/logger.js';

const PORT = Number(process.env.PORT) || 3001;

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET mancante: impostalo in .env o nelle variabili d\'ambiente.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  logger.warn('JWT_SECRET è corto: usa una stringa casuale di almeno 32 caratteri.');
}

// The restore is bounded by an 8s timeout inside backup.js, so a slow GitHub
// API can no longer prevent the server from starting.
await restoreBackup();

const server = app.listen(PORT, () => {
  logger.info(`WalletAI server running on http://localhost:${PORT}`);
});

function shutdown(signal) {
  logger.info(`${signal} ricevuto, chiusura in corso…`);
  server.close(() => {
    try {
      db.close();
    } catch (err) {
      logger.warn('[shutdown]', err.message);
    }
    process.exit(0);
  });

  // Do not hang forever on open connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { server };
