import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import userRoutes from './routes/user.js';
import goalRoutes from './routes/goals.js';
import db from './db.js';
import { logger } from './utils/logger.js';

const app = express();

app.disable('x-powered-by');

// On Render requests arrive through a proxy. Set TRUST_PROXY=false when the
// API is exposed directly (local development, custom deployments).
const trustProxy = process.env.TRUST_PROXY;
app.set(
  'trust proxy',
  trustProxy === 'false' ? false : (Number.isFinite(Number(trustProxy)) ? Number(trustProxy) : 1)
);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
}));

app.use(compression());
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
];

app.use(cors({
  origin: (origin, cb) => {
    // Requests without an Origin header (curl, mobile apps) are allowed.
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    const err = new Error('Origine non consentita');
    err.status = 403;
    return cb(err);
  },
  credentials: true,
}));

// Lightweight request log — no query strings, so search terms stay private.
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  const startedAt = Date.now();
  // Captured now: routers rewrite req.path before 'finish' fires.
  const path = req.path;
  res.on('finish', () => {
    logger.info(`${req.method} ${path} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch (err) {
    logger.error('[health]', err.message);
    res.status(503).json({ status: 'error' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/user', userRoutes);
app.use('/api/goals', goalRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

// Centralised error handler: always JSON, never a stack trace to the client.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload troppo grande (massimo 2 MB)' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON non valido' });
  }

  const status = Number(err.status) || 500;
  if (status >= 500) {
    logger.error(`${req.method} ${req.path} —`, err);
  }

  res.status(status).json({
    error: status >= 500 ? 'Errore interno del server' : (err.message || 'Richiesta non valida'),
  });
});

export default app;
