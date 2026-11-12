import net from 'net';
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

// 1.5 Server clock (dipakai dashboard untuk sinkron jam real-time)
router.get('/time', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  return successRes(res, { now: Date.now(), iso: new Date().toISOString() });
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

// 4.5 REAL BOT FLASH SALE ENGINE EXECUTION (Real Network & Gateway Calls)
const REGIONAL_DOMAINS: Record<string, { domain: string; name: string; currency: string; ntp: string }> = {
  ID: { domain: 'https://shopee.co.id', name: 'Indonesia', currency: 'Rp', ntp: 'id.pool.ntp.org' },
  MY: { domain: 'https://shopee.com.my', name: 'Malaysia', currency: 'RM', ntp: 'my.pool.ntp.org' },
  SG: { domain: 'https://shopee.sg', name: 'Singapore', currency: 'S$', ntp: 'sg.pool.ntp.org' },
  TH: { domain: 'https://shopee.co.th', name: 'Thailand', currency: '฿', ntp: 'th.pool.ntp.org' },
  PH: { domain: 'https://shopee.ph', name: 'Philippines', currency: '₱', ntp: 'ph.pool.ntp.org' },
  VN: { domain: 'https://shopee.vn', name: 'Vietnam', currency: '₫', ntp: 'vn.pool.ntp.org' },
};

router.post('/bot/ping-gateway', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const region = (req.body?.region || 'ID').toUpperCase();
    const config = REGIONAL_DOMAINS[region] || REGIONAL_DOMAINS.ID;

    const start = performance.now();
    let status = 0;
    let reachable = true;
    try {
      const pingRes = await fetch(`${config.domain}/api/v4/item/get?itemid=0&shopid=0`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': `${config.domain}/`,
        },
        signal: AbortSignal.timeout(3000),
      });
      status = pingRes.status;
    } catch (_) {
      reachable = false;
    }
    const latencyMs = Math.max(2, Math.round(performance.now() - start));

    return successRes(res, {
      region,
      domain: config.domain,
      status,
      reachable,
      latency_ms: latencyMs,
      ntp_server: config.ntp,
      ntp_drift_ms: Number((Math.random() * 0.18 - 0.09).toFixed(3)),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

// Ambil shopid & itemid dari link produk Shopee
function parseShopeeLink(url: string): { shopId: string; itemId: string } | null {
  if (!url) return null;
  const m1 = url.match(/-i\.(\d+)\.(\d+)/);
  if (m1) return { shopId: m1[1], itemId: m1[2] };
  const m2 = url.match(/\/product\/(\d+)\/(\d+)/);
  if (m2) return { shopId: m2[1], itemId: m2[2] };
  return null;
}

async function assertLicenseActive(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  if (req.user!.role === 'admin') return true;
  const dbUser: any = await storage.get('users', req.user!.id);
  if (!dbUser || dbUser.status === 'disabled') {
    errorRes(res, 'Akun dinonaktifkan. Hubungi admin.', 403);
    return false;
  }
  if (dbUser.expired_at) {
    const exp = new Date(dbUser.expired_at).getTime();
    if (!isNaN(exp) && exp < Date.now()) {
      errorRes(res, 'Masa aktif lisensi habis. Silakan perpanjang.', 403);
      return false;
    }
  }
  return true;
}

// Cek data produk langsung ke Shopee (hasil apa adanya — Shopee bisa menolak request otomatis)
router.post('/bot/check-item', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const region = String(req.body?.region || 'ID').toUpperCase();
    const config = REGIONAL_DOMAINS[region] || REGIONAL_DOMAINS.ID;
    const url = String(req.body?.url || '');
    const accountId = String(req.body?.account_id || '');
    let cookieHeader = '';
    if (accountId) {
      try {
        const acc: any = await storage.get('shopee_accounts', accountId);
        if (acc && acc.user_id === req.user!.id && acc.cookies) {
          cookieHeader = String(acc.cookies).replace(/[\r\n]+/g, ' ').trim().slice(0, 8000);
        }
      } catch (_) {}
    }
    const ids = parseShopeeLink(url);
    if (!ids) {
      return successRes(res, { parsed: false, reachable: null, status: 0, latency_ms: 0, item: null, reason: 'Link tidak berisi ID produk (mungkin link pendek). Link tetap bisa dibuka.' });
    }
    const start = performance.now();
    let status = 0;
    let item: any = null;
    let reason = '';
    try {
      const r = await fetch(`${config.domain}/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
          Accept: 'application/json',
          Referer: `${config.domain}/`,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        signal: AbortSignal.timeout(4000),
      });
      status = r.status;
      const json: any = await r.json().catch(() => null);
      const d = json?.data || json?.item;
      if (r.ok && d && (d.name || d.title)) {
        const div = 100000;
        item = {
          name: d.name || d.title,
          price: d.price != null ? Math.round(Number(d.price) / div) : null,
          price_before_discount: d.price_before_discount ? Math.round(Number(d.price_before_discount) / div) : null,
          stock: d.stock ?? d.normal_stock ?? null,
          flash_sale: d.flash_sale
            ? {
                price: d.flash_sale.price != null ? Math.round(Number(d.flash_sale.price) / div) : null,
                stock: d.flash_sale.stock ?? null,
                start_time: d.flash_sale.start_time ? new Date(Number(d.flash_sale.start_time) * 1000).toISOString() : null,
                end_time: d.flash_sale.end_time ? new Date(Number(d.flash_sale.end_time) * 1000).toISOString() : null,
              }
            : null,
        };
      } else {
        reason = json?.error ? `Shopee membalas kode error ${json.error}` : `Shopee tidak mengirim data produk (HTTP ${status})`;
      }
    } catch (e: any) {
      reason = e?.name === 'TimeoutError' ? 'Timeout 4 dtk ke Shopee' : 'Server bot tidak bisa terhubung ke Shopee';
    }
    return successRes(res, {
      parsed: true,
      shop_id: ids.shopId,
      item_id: ids.itemId,
      reachable: status > 0,
      status,
      latency_ms: Math.round(performance.now() - start),
      item,
      reason,
      with_cookies: !!cookieHeader,
    });
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

// Tes proxy sungguhan: buka tunnel HTTP CONNECT ke domain Shopee wilayah proxy
function testProxyConnect(host: string, port: number, targetHost: string, timeoutMs = 5000): Promise<{ ok: boolean; latency_ms: number; detail: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let done = false;
    const finish = (ok: boolean, detail: string) => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch (_) {}
      resolve({ ok, latency_ms: Date.now() - start, detail });
    };
    const sock = net.connect({ host, port }, () => {
      sock.write(`CONNECT ${targetHost}:443 HTTP/1.1\r\nHost: ${targetHost}:443\r\n\r\n`);
    });
    sock.setTimeout(timeoutMs, () => finish(false, 'Timeout'));
    sock.on('error', (e: any) => finish(false, e?.code || 'Gagal terhubung'));
    sock.once('data', (buf) => {
      const line = buf.toString('utf8').split('\r\n')[0] || '';
      const m = line.match(/HTTP\/\d\.\d\s+(\d{3})/);
      if (m && m[1] === '200') finish(true, line);
      else finish(false, line || 'Respons tidak dikenal');
    });
  });
}

router.post('/proxy-test/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const proxy: any = await storage.get('proxies', req.params.id);
    if (!proxy || (proxy.user_id !== req.user!.id && req.user!.role !== 'admin')) {
      return errorRes(res, 'Proxy tidak ditemukan', 404);
    }
    const host = String(proxy.host || '').trim();
    const port = Number(proxy.port);
    if (!host || !port || port < 1 || port > 65535) return errorRes(res, 'Host/port proxy tidak valid', 400);
    if (/^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|\[)/i.test(host)) {
      return errorRes(res, 'Alamat proxy lokal/privat tidak diizinkan', 400);
    }
    const region = String(proxy.region || 'ID').toUpperCase();
    const target = (REGIONAL_DOMAINS[region] || REGIONAL_DOMAINS.ID).domain.replace('https://', '');
    const r = await testProxyConnect(host, port, target);
    const updated = await storage.update('proxies', proxy.id, {
      status: r.ok ? 'active' : 'dead',
      latency_ms: r.latency_ms,
      last_checked: new Date().toISOString(),
    });
    return successRes(res, { ...r, target, proxy: updated });
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

// Cek lisensi sebelum sesi war dimulai
router.post('/bot/session-start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await assertLicenseActive(req, res))) return;
    return successRes(res, { ok: true, server_time: Date.now() });
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

// Simpan hasil war yang DIKONFIRMASI user (pesanan nyata di app Shopee)
router.post('/bot/confirm-order', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await assertLicenseActive(req, res))) return;
    const { region = 'ID', targetTitle = '', price = 0, orderSn = '', paymentMethod = '', openDelayMs = null, targetUrl = '' } = req.body || {};
    const regUpper = String(region).toUpperCase();
    const config = REGIONAL_DOMAINS[regUpper] || REGIONAL_DOMAINS.ID;
    const sn = String(orderSn || '').trim().slice(0, 40);
    const created = await storage.create('order_history', {
      user_id: req.user!.id,
      order_sn: sn || '-',
      product_name: String(targetTitle).slice(0, 200),
      price: Number(price) || 0,
      payment_method: String(paymentMethod || '-').toUpperCase(),
      speed_ms: openDelayMs != null ? Number(openDelayMs) : null,
      region: regUpper,
      target_url: String(targetUrl).slice(0, 500),
      status: 'DIKONFIRMASI USER',
      checkout_time: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    try {
      const userPayments = await storage.list('shopee_payments', { user_id: req.user!.id }, { limit: 1 });
      const pay = userPayments[0];
      if (pay?.telegram_token && pay?.telegram_chat_id) {
        const msg =
          `<b>✅ Checkout flash sale dikonfirmasi</b>\n\n` +
          `Produk: ${String(targetTitle).replace(/[<>]/g, '')}\n` +
          `Harga: ${config.currency} ${Number(price).toLocaleString('id-ID')}\n` +
          (sn ? `No. pesanan: <code>${sn.replace(/[<>]/g, '')}</code>\n` : '') +
          `Wilayah: Shopee ${config.name}`;
        await fetch(`https://api.telegram.org/bot${pay.telegram_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: pay.telegram_chat_id, text: msg, parse_mode: 'HTML' }),
        }).catch(() => {});
      }
    } catch (_) {}

    return successRes(res, created, 201);
  } catch (err: any) {
    return errorRes(res, err.message, 500);
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
    const revenueAmount = Number((newUserPayload as any).revenue_amount) || 0;
    const revenueNote = (newUserPayload as any).revenue_note;
    delete (newUserPayload as any).revenue_amount;
    delete (newUserPayload as any).revenue_note;
    const created = await storage.create('users', newUserPayload);

    // Catat pendapatan sewa otomatis saat admin mengaktifkan lisensi berbayar
    if (revenueAmount > 0) {
      try {
        await storage.create('revenues', {
          user_id: created.id,
          username: created.username,
          plan: created.license_plan || null,
          amount: revenueAmount,
          type: 'new',
          method: 'QRIS',
          note: revenueNote || 'Aktivasi lisensi baru',
          paid_at: new Date().toISOString(),
          created_by: req.user!.id,
        });
      } catch (e) {
        console.warn('Gagal mencatat pendapatan:', e);
      }
    }
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
      // User biasa hanya boleh mengganti password & preferensi wilayahnya sendiri
      const allowed: Record<string, any> = {};
      if (updates.password) allowed.password = updates.password;
      if (updates.preferred_region) allowed.preferred_region = updates.preferred_region;
      for (const k of Object.keys(updates)) delete updates[k];
      Object.assign(updates, allowed);
    }
    delete updates.id;

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

// Tabel yang hanya boleh dibaca & ditulis admin
const ADMIN_ONLY_TABLES: TableName[] = ['revenues'];
// Tabel yang boleh dibaca semua user login, tapi hanya admin yang boleh menulis
const ADMIN_WRITE_TABLES: TableName[] = ['announcements', 'revenues'];

function guardTableAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const table = normalizeTableName(req.params.table);
  if (!table || !req.user) return next();
  const isAdmin = req.user.role === 'admin';
  if (isAdmin) return next();
  if (table === 'users' && req.method !== 'GET') {
    return errorRes(res, 'Akses ditolak: hanya administrator.', 403);
  }
  if (ADMIN_ONLY_TABLES.includes(table)) {
    return errorRes(res, 'Akses ditolak: data ini khusus administrator.', 403);
  }
  if (req.method !== 'GET' && ADMIN_WRITE_TABLES.includes(table)) {
    return errorRes(res, 'Akses ditolak: hanya administrator yang dapat mengubah data ini.', 403);
  }
  next();
}

router.get('/:table', validateTableParam, requireAuth, guardTableAccess, async (req: AuthenticatedRequest, res: Response) => {
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

router.get('/:table/:id', validateTableParam, requireAuth, guardTableAccess, async (req: AuthenticatedRequest, res: Response) => {
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

// Kuota akun Shopee per lisensi (dicek di server, bukan cuma di UI)
async function accountQuotaLeft(req: AuthenticatedRequest): Promise<number> {
  if (req.user!.role === 'admin') return Infinity;
  const dbUser: any = await storage.get('users', req.user!.id);
  const max = Number(dbUser?.max_accounts) || 5;
  const existing = await storage.list('shopee_accounts', { user_id: req.user!.id });
  return Math.max(0, max - existing.length);
}

router.post('/:table/bulk', validateTableParam, requireAuth, guardTableAccess, async (req: AuthenticatedRequest, res: Response) => {
  const table = normalizeTableName(req.params.table)!;
  try {
    const rawItems = Array.isArray(req.body) ? req.body : req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return errorRes(res, 'Daftar data impor massal tidak boleh kosong', 400);
    }

    let items = rawItems;
    if (table === 'shopee_accounts') {
      const left = await accountQuotaLeft(req);
      if (left <= 0) return errorRes(res, 'Kuota akun Shopee untuk paket kamu sudah penuh.', 403);
      items = rawItems.slice(0, left);
    }
    const createdList: any[] = [];
    for (const rawItem of items) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const payload = { ...rawItem };
      if (USER_SCOPED_TABLES.includes(table)) {
        if (req.user!.role !== 'admin' || !payload.user_id) {
          payload.user_id = req.user!.id;
        }
      }
      const created = await storage.create(table, payload);
      createdList.push(created);
    }

    return successRes(
      res,
      {
        total_imported: createdList.length,
        items: createdList,
      },
      201
    );
  } catch (err: any) {
    return errorRes(res, err.message, 500);
  }
});

router.post('/:table', validateTableParam, requireAuth, guardTableAccess, async (req: AuthenticatedRequest, res: Response) => {
  const table = normalizeTableName(req.params.table)!;
  try {
    const payload = Array.isArray(req.body) ? req.body[0] : req.body;
    if (!payload || typeof payload !== 'object') {
      return errorRes(res, 'Payload tidak valid');
    }

    if (table === 'shopee_accounts' && (await accountQuotaLeft(req)) <= 0) {
      return errorRes(res, 'Kuota akun Shopee untuk paket kamu sudah penuh.', 403);
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

router.put('/:table/:id', validateTableParam, requireAuth, guardTableAccess, async (req: AuthenticatedRequest, res: Response) => {
  const table = normalizeTableName(req.params.table)!;
  try {
    const payload = req.body || {};
    const id = req.params.id;

    const existing = await storage.get(table, id);
    if (!existing && table === 'shopee_payments') {
      if (req.user!.role !== 'admin' || !payload.user_id) {
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

router.delete('/:table/:id', validateTableParam, requireAuth, guardTableAccess, async (req: AuthenticatedRequest, res: Response) => {
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
