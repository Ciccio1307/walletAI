import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import userRoutes from './routes/user.js';
import { restoreBackup } from './utils/backup.js';

await restoreBackup();

const app = express();
const PORT = process.env.PORT || 3001;

// Su Render le richieste passano da un proxy: serve per avere il vero IP
// del client in req.ip (usato dal rate limiter)
app.set('trust proxy', 1);
app.use(helmet());

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi, riprova tra un minuto' },
});

const ALLOWED = [
  'http://localhost:5173',
  process.env.ALLOWED_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permetti richieste senza origin (curl, mobile app) e origini consentite
    if (!origin || ALLOWED.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloccato: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/user', userRoutes);

app.listen(PORT, () => {
  console.log(`WalletAI server running on http://localhost:${PORT}`);
});
