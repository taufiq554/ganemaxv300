import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface SafeUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  status?: string;
  expired_at?: string | null;
  license_plan?: string | null;
  plain_password?: string | null;
  created_at?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  'ganemax-enterprise-sec-token-2026-v2';

/**
 * Secure password hashing using Node.js crypto.scrypt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Constant-time password verification
 * Supports scrypt$ hashes and gracefully handles legacy plaintext migration
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false;

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];
    try {
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const expectedKey = Buffer.from(key, 'hex');
      if (derivedKey.length !== expectedKey.length) return false;
      return crypto.timingSafeEqual(derivedKey, expectedKey);
    } catch {
      return false;
    }
  }

  // Fallback for legacy unhashed passwords during migration
  try {
    const passBuf = Buffer.from(password);
    const storedBuf = Buffer.from(storedHash);
    if (passBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(passBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Issue HMAC-SHA256 signed session token (30-day expiry)
 */
export function createSessionToken(user: SafeUser): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    uid: user.id,
    usr: user.username,
    rol: user.role,
    iat: nowSec,
    exp: nowSec + 30 * 24 * 3600, // 30 days
  };

  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(b64Payload)
    .digest('base64url');

  return `${b64Payload}.${signature}`;
}

/**
 * Verify and decode HMAC-SHA256 session token
 */
export function verifySessionToken(token: string): SafeUser | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [b64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(b64Payload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return null;
    }
    return {
      id: payload.uid,
      username: payload.usr,
      role: payload.rol,
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header or custom header
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const sessionHeader = req.headers['x-session-token'];
  if (sessionHeader && typeof sessionHeader === 'string') {
    return sessionHeader.trim();
  }
  return null;
}

/**
 * Remove sensitive credentials before returning user objects to clients
 */
export function sanitizeUser(user: any): SafeUser {
  if (!user) return user;
  const { password_hash, password, ...safe } = user;
  return safe as SafeUser;
}

/**
 * Express middleware to enforce authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { message: 'Autentikasi dibutuhkan. Silakan login terlebih dahulu.' },
    });
  }

  const user = verifySessionToken(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { message: 'Sesi login tidak valid atau sudah kadaluarsa. Silakan login ulang.' },
    });
  }

  req.user = user;
  next();
}

/**
 * Express middleware to enforce admin role
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      data: null,
      error: { message: 'Akses ditolak: Operasi ini hanya diizinkan untuk akun Administrator.' },
    });
  }
  next();
}
