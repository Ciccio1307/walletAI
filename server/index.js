import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import userRoutes from './routes/user.js';

const app = express();
const PORT = process.env.PORT || 3001;

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

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/user', userRoutes);

app.listen(PORT, () => {
  console.log(`WalletAI server running on http://localhost:${PORT}`);
});
