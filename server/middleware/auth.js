import jwt from 'jsonwebtoken';
import db from '../db.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // A refresh token must never be usable as an access token.
    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Token non valido' });
    }

    // Verifies the user still exists and that tokens were not revoked
    // (password change / logout increments token_version).
    const user = db.prepare('SELECT token_version FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Token non valido' });

    const tokenVersion = Number(payload.ver ?? 0);
    if (tokenVersion !== Number(user.token_version ?? 0)) {
      return res.status(401).json({ error: 'Sessione scaduta' });
    }

    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token non valido' });
  }
}
