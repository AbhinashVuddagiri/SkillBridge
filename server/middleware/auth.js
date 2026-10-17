import jwt from 'jsonwebtoken';
import { dbService } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skillbridge_super_secure_jwt_secret_key_2026_production';

export async function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbService.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found or account removed.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token: ' + err.message });
  }
}

export async function authOptional(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbService.getUserById(decoded.userId);
    if (user) {
      req.user = user;
    }
  } catch (err) {
    // Ignore invalid token for optional auth
  }
  next();
}

export function signToken(user) {
  return jwt.sign(
    { userId: user.id, bridgeAccount: user.bridgeAccount },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}
