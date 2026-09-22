import express, { Request, Response, NextFunction } from 'express';
import {
  storage,
  normalizeTableName,
  VALID_TABLES,
  TableName,
} from './lib/storage.ts';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  sanitizeUser,
  requireAuth,
  requireAdmin,
  extractToken,
  verifySessionToken,
  AuthenticatedRequest,
  SafeUser,
} from './lib/auth.ts';

const app = express();
app.use(express.json());

function successRes(res: Response, data: any, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    error: null,
  });
}

function errorRes(res: Response, message: string, status = 400) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { message },
  });
}

// Strip leading /api if present (e.g. from direct Vercel routing)
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

function validateTableParam(req: Request, res: Response, next: NextFunction) {
  const table = normalizeTableName(req.params.table);
  if (!table) {
    return errorRes(res, `Tabel tidak valid: ${req.params.table}`, 404);
  }
  next();
}

const router = express.Router();

// 1. Health Check
router.get('/health', async (_req: Request, res: Response) => {
  return successRes(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Ganemax Shopee Flash Sale API',
    storage_provider: storage.getAdapterName(),
    storage_configured: storage.isConfigured(),
    supported_tables: VALID_TABLES,
    version: '3.0.0-firestore-production',
  });
});

// 2. Authentication: Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return errorRes(res, 'Username dan password wajib diisi');
    }

    const users = await storage.list('users', { username: username.trim() });
    if (!users || users.length === 0) {
      return errorRes(res, 'Username atau password salah', 401);
    }

    const user = users[0];
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return errorRes(res, 'Username atau password salah', 401);
    }

    if (user.status === 'disabled') {
      return errorRes(res, 'Akun Anda dinonaktifkan. Hubungi administrator.', 403);
    }

    if (user.expired_at) {
      const expiry = new Date(user.expired_at).getTime();
      if (!isNaN(expiry) && expiry < Date.now()) {
        return errorRes(res, 'Masa aktif lisensi bot Anda telah berakhir. Silakan perpanjang lisensi atau hubungi Telegram @mrpangeranz.', 403);
      }
    }

    if (!user.password_hash.startsWith('scrypt$')) {
      try {
        const upgradedHash = hashPassword(password);
        await storage.update('users', user.id, { password_hash: upgradedHash });
      } catch (upgradeErr) {
        console.warn('Could not auto-upgrade password hash:', upgradeErr);
      }
    }

    const safeUser: SafeUser = sanitizeUser(user);
    const token = createSessionToken(safeUser);

    return successRes(res, {
      user: safeUser,
      token,
    });
  } catch (err: any) {
    return errorRes(res, `Login error: ${err.message}`, 500);
  }
});

// Helper to authenticate migration requests
function authorizeMigration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const migrationSecret = process.env.MIGRATION_SECRET || 'ganemax-migrate-secret-2026';
  const headerSecret = req.headers['x-migration-secret'];
  if (headerSecret && headerSecret === migrationSecret) {
    return next();
  }

  const token = extractToken(req);
  if (token) {
    const user = verifySessionToken(token);
    if (user && user.role === 'admin') {
      req.user = user;
      return next();
    }
  }

  return errorRes(
    res,
    'Akses ditolak: Hanya administrator yang diizinkan menjalankan migrasi database.',
    403
  );
}

// 3. Database Migration / Seeding to Firestore
router.post('/migrate', authorizeMigration, async (req: Request, res: Response) => {
  try {
    const force = Boolean(req.body?.force);
    const report = await storage.migrateAll(force);
    return successRes(res, {
      message: 'Migrasi database berhasil dijalankan',
      storage_provider: storage.getAdapterName(),
      report,
    });
  } catch (err: any) {
    return errorRes(res, `Migration error: ${err.message}`, 500);
  }
});

// 4. SECURE SERVER-SIDE AI PROXY (GANEMAX AI)
const GANEMAX_AI_API_KEY =
  process.env.GANEMAX_AI_API_KEY ||
  'sk-qwen-d820f1281c41421b3a7afcb5fac7fd79290a3c79e30a93c0';
const GANEMAX_AI_BASE_URL = 'https://bandelbanget.xyz/v1/chat/completions';
const GANEMAX_AI_MODEL = 'deepseek-v4-flash';

router.post('/ai', async (req: Request, res: Response) => {
  try {
    const { prompt, systemInstruction } = req.body || {};
    if (!prompt) {
      return errorRes(res, 'Prompt wajib diisi');
    }

    const defaultSystemPrompt =
      'Anda adalah GaneMaX AI, asisten strategi bot Shopee Flash Sale enterprise. Berikan rekomendasi taktis, timing jitter offset (-10ms s/d -20ms), optimasi koneksi Multi-Socket, bypass PIN ShopeePay, dan manajemen rotasi proxy.';
    const systemPrompt = systemInstruction || defaultSystemPrompt;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: String(prompt) },
    ];

    try {
      const response = await fetch(GANEMAX_AI_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GANEMAX_AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: GANEMAX_AI_MODEL,
          messages,
          temperature: 0.6,
          max_tokens: 600,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices[0]?.message?.content) {
          return successRes(res, {
            content: data.choices[0].message.content,
            model: 'GaneMaX AI',
          });
        }
      }
    } catch (_) {
      // Fallback response if network/proxy drops
    }

    return successRes(res, {
      content:
        '⚡ Rekomendasi GaneMaX AI: Aktifkan Multi-Socket Turbo 12 threads, timing offset -15ms sebelum detik 0, injeksi PIN ShopeePay otomatis, dan pastikan target URL sudah diverifikasi di sistem.',
      model: 'GaneMaX AI',
    });
  } catch (err: any) {
    return errorRes(res, `GaneMaX AI error: ${err.message}`, 500);
  }
});

// 5. USER MANAGEMENT (Admin Only)
router.get('/users', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return errorRes(res, 'Akses ditolak: Hanya administrator yang dapat melihat daftar pengguna.', 403);
    }
    const { sort, order, limit, ...otherFilters } = req.query;
    const users = await storage.list('users', otherFilters, {
      sort: sort ? String(sort) : undefined,
      order: order === 'desc' ? 'desc' : 'asc',
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    const sanitized = users.map(sanitizeUser);
    return successRes(res, sanitized);
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.get('/users/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedId = req.params.id;
    if (req.user!.role !== 'admin' && req.user!.id !== requestedId) {
      return errorRes(res, 'Akses ditolak: Anda tidak memiliki izin melihat data pengguna lain.', 403);
    }
    const user = await storage.get('users', requestedId);
    if (!user) {
      return errorRes(res, 'Pengguna tidak ditemukan', 404);
    }
    return successRes(res, sanitizeUser(user));
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.post('/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = req.body || {};
    const rawPass = payload.password || payload.password_hash;
    if (!payload.username || !rawPass) {
      return errorRes(res, 'Username dan password wajib diisi');
    }
    const cleanUsername = String(payload.username).trim();
    const existing = await storage.list('users', { username: cleanUsername });
    if (existing.length > 0) {
      return errorRes(res, 'Username sudah digunakan');
    }

    const hashedPassword = hashPassword(String(rawPass));
    const newUserPayload = {
      ...payload,
      id: payload.id || `usr_${cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      username: cleanUsername,
      password_hash: hashedPassword,
      plain_password: String(rawPass),
      license_plan: payload.license_plan || '1_bulan',
      role: payload.role === 'admin' ? 'admin' : 'user',
      status: payload.status || 'active',
      expired_at: payload.expired_at || null,
    };
    delete (newUserPayload as any).password;
    const created = await storage.create('users', newUserPayload);
    return successRes(res, sanitizeUser(created), 201);
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.put('/users/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = req.params.id;
    const isSelf = req.user!.id === targetId;
    const isAdmin = req.user!.role === 'admin';
    if (!isAdmin && !isSelf) {
      return errorRes(res, 'Akses ditolak: Anda tidak memiliki izin mengubah data pengguna ini.', 403);
    }

    const updates = { ...(req.body || {}) };
    if (!isAdmin) {
      delete updates.role;
      delete updates.status;
      delete updates.expired_at;
    }

    if (updates.password || updates.password_hash) {
      const raw = updates.password || updates.password_hash;
      updates.password_hash = hashPassword(String(raw));
      updates.plain_password = String(raw);
      delete updates.password;
    }

    const updated = await storage.update('users', targetId, updates);
    if (!updated) {
      return errorRes(res, 'Pengguna tidak ditemukan', 404);
    }
    return successRes(res, sanitizeUser(updated));
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user!.id) {
      return errorRes(res, 'Tidak dapat menghapus akun Anda sendiri.', 400);
    }
    const removed = await storage.delete('users', targetId);
    if (!removed) {
      return errorRes(res, 'Pengguna tidak ditemukan', 404);
    }
    return successRes(res, { success: true, id: targetId });
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

// 6. GENERIC DATA TABLES (User-Scoped Isolation)
const USER_SCOPED_TABLES: TableName[] = [
  'shopee_accounts',
  'addresses',
  'target_urls',
  'proxies',
  'schedules',
  'shopee_payments',
  'order_history',
  'logs',
];

router.get('/:table', validateTableParam, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = normalizeTableName(req.params.table)!;
  if (table === 'users') {
    if (req.user!.role !== 'admin') {
      return errorRes(res, 'Akses ditolak: Hanya administrator yang dapat melihat daftar pengguna.', 403);
    }
    const users = await storage.list('users');
    return successRes(res, users.map(sanitizeUser));
  }

  try {
    const { sort, order, limit, single, user_id, ...otherFilters } = req.query;
    const filters: Record<string, any> = { ...otherFilters };

    if (USER_SCOPED_TABLES.includes(table)) {
      if (req.user!.role !== 'admin') {
        filters.user_id = req.user!.id;
      } else if (user_id) {
        filters.user_id = String(user_id);
      }
    }

    const records = await storage.list(table, filters, {
      sort: sort ? String(sort) : undefined,
      order: order === 'desc' ? 'desc' : 'asc',
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });

    if (String(single) === 'true') {
      return successRes(res, records[0] || null);
    }
    return successRes(res, records);
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.get('/:table/:id', validateTableParam, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = normalizeTableName(req.params.table)!;
  try {
    const record = await storage.get(table, req.params.id);
    if (!record) {
      return errorRes(res, 'Data tidak ditemukan', 404);
    }

    if (USER_SCOPED_TABLES.includes(table) && req.user!.role !== 'admin') {
      if (record.user_id && record.user_id !== req.user!.id) {
        return errorRes(res, 'Akses ditolak: Anda tidak memiliki izin melihat data ini.', 403);
      }
    }

    if (table === 'users') {
      return successRes(res, sanitizeUser(record));
    }
    return successRes(res, record);
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.post('/:table', validateTableParam, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = normalizeTableName(req.params.table)!;
  try {
    const payload = Array.isArray(req.body) ? req.body[0] : req.body;
    if (!payload || typeof payload !== 'object') {
      return errorRes(res, 'Payload tidak valid');
    }

    if (USER_SCOPED_TABLES.includes(table)) {
      if (req.user!.role !== 'admin' || !payload.user_id) {
        payload.user_id = req.user!.id;
      }
    }

    const created = await storage.create(table, payload);
    return successRes(res, created, 201);
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.put('/:table/:id', validateTableParam, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = normalizeTableName(req.params.table)!;
  try {
    const payload = req.body || {};
    const id = req.params.id;

    const existing = await storage.get(table, id);
    if (!existing && table === 'shopee_payments') {
      if (req.user!.role !== 'admin') {
        payload.user_id = req.user!.id;
      }
      const inserted = await storage.create(table, payload);
      return successRes(res, inserted);
    }

    if (!existing) {
      return errorRes(res, 'Data tidak ditemukan untuk diperbarui', 404);
    }

    if (USER_SCOPED_TABLES.includes(table) && req.user!.role !== 'admin') {
      if (existing.user_id && existing.user_id !== req.user!.id) {
        return errorRes(res, 'Akses ditolak: Anda tidak memiliki izin mengubah data ini.', 403);
      }
      payload.user_id = req.user!.id;
    }

    const updated = await storage.update(table, id, payload);
    return successRes(res, updated);
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.delete('/:table/:id', validateTableParam, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const table = normalizeTableName(req.params.table)!;
  try {
    const id = req.params.id;
    const existing = await storage.get(table, id);
    if (!existing) {
      return errorRes(res, 'Data tidak ditemukan untuk dihapus', 404);
    }

    if (USER_SCOPED_TABLES.includes(table) && req.user!.role !== 'admin') {
      if (existing.user_id && existing.user_id !== req.user!.id) {
        return errorRes(res, 'Akses ditolak: Anda tidak memiliki izin menghapus data ini.', 403);
      }
    }

    await storage.delete(table, id);
    return successRes(res, { success: true, id });
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

app.use('/api', router);
app.use('/', router);

export default app;
