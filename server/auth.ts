import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  role: 'student' | 'admin';
  createdAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  authToken?: string;
}

interface TokenPayload {
  uid: number;
  role: 'student' | 'admin';
  jti: string;
  exp: number;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const revokedTokenIds = new Map<string, number>();

function pruneRevokedTokens(): void {
  const now = Date.now();
  for (const [jti, exp] of revokedTokenIds.entries()) {
    if (exp <= now) {
      revokedTokenIds.delete(jti);
    }
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derivedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

export function isAdminPasscodeEnvConfigured(): boolean {
  return typeof process.env.ADMIN_PASSCODE === 'string' && process.env.ADMIN_PASSCODE.trim().length > 0;
}

export function hasClaimedAdminAccount(): boolean {
  const row = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as
    | { id: number }
    | undefined;
  return Boolean(row);
}

export function signAuthToken(user: { id: number; role: 'student' | 'admin' }): string {
  const payload: TokenPayload = {
    uid: user.id,
    role: user.role,
    jti: crypto.randomBytes(12).toString('hex'),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload || typeof payload.uid !== 'number' || typeof payload.exp !== 'number' || !payload.jti) {
      return null;
    }
    if (payload.exp <= Date.now()) {
      return null;
    }
    if (revokedTokenIds.has(payload.jti)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function revokeAuthToken(token: string): void {
  pruneRevokedTokens();
  const payload = verifyAuthToken(token);
  if (payload) {
    revokedTokenIds.set(payload.jti, payload.exp);
  }
}

export function getUserById(id: number): AuthUser | null {
  const row = db
    .prepare('SELECT id, name, email, username, avatar_url, role, created_at FROM users WHERE id = ?')
    .get(id) as
    | {
        id: number;
        name: string;
        email: string;
        username: string;
        avatar_url: string | null;
        role: 'student' | 'admin';
        created_at: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username,
    avatarUrl: row.avatar_url ?? null,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Your session has expired or is invalid. Please sign in again.' });
    return;
  }

  const user = getUserById(payload.uid);
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }

  req.user = user;
  req.authToken = token;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }
    next();
  });
}
