import {
  User,
  ShopeeAccount,
  Address,
  TargetUrl,
  ProxyMesh,
  Schedule,
  ShopeePayment,
  OrderHistoryItem,
} from '../types/index.ts';

function getSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token =
      localStorage.getItem('shopee_bot_token') ||
      localStorage.getItem('SECURE_APP_TOKEN');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Session-Token'] = token;
    }
    const stored =
      localStorage.getItem('shopee_bot_user') ||
      localStorage.getItem('SECURE_APP_USER');
    if (stored) {
      const user: User = JSON.parse(stored);
      if (user.id) headers['X-User-Id'] = user.id;
      if (user.role) headers['X-User-Role'] = user.role;
    }
  } catch (_) {}
  return headers;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: { message: string } | null;
  /** Kode HTTP (0 = jaringan putus / waktu habis). */
  status?: number;
}

/** Simpan token baru kalau server memperpanjang sesi (header X-Session-Token-Refresh). */
function captureRefresh(res: Response) {
  const t = res.headers.get('X-Session-Token-Refresh');
  if (!t) return;
  try {
    if (localStorage.getItem('shopee_bot_token')) localStorage.setItem('shopee_bot_token', t);
    if (localStorage.getItem('SECURE_APP_TOKEN')) localStorage.setItem('SECURE_APP_TOKEN', t);
  } catch (_) {}
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Satu pintu untuk semua request ke server:
 * - batas waktu (default 15 dtk) supaya tidak pernah menggantung,
 * - coba ulang otomatis saat jaringan putus / server sedang bangun (502/503/504),
 *   hanya untuk request yang aman diulang (GET, PUT, DELETE, atau `retry` eksplisit).
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: any,
  opts: { timeoutMs?: number; retries?: number } = {}
): Promise<ApiResponse<T>> {
  const idempotent = method !== 'POST';
  const retries = opts.retries ?? (idempotent ? 2 : 0);
  const timeoutMs = opts.timeoutMs ?? 15000;
  let last: ApiResponse<T> = { success: false, data: null, error: { message: 'Tidak ada koneksi' }, status: 0 };
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: getSessionHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
      captureRefresh(res);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        last = { success: false, data: null, error: json.error || { message: `HTTP Error ${res.status}` }, status: res.status };
        if ([502, 503, 504].includes(res.status) && attempt < retries) {
          await wait(600 * (attempt + 1));
          continue;
        }
        return last;
      }
      return { success: true, data: (json.data ?? json) as T, error: null, status: res.status };
    } catch (err: any) {
      const aborted = err?.name === 'AbortError';
      last = {
        success: false,
        data: null,
        error: { message: aborted ? 'Server tidak menjawab (waktu habis)' : navigator.onLine === false ? 'Internet terputus' : err?.message || 'Jaringan bermasalah' },
        status: 0,
      };
      if (attempt < retries) {
        await wait(600 * (attempt + 1));
        continue;
      }
      return last;
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}

function withQuery(base: string, params: Record<string, any>) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
  }
  const qs = query.toString();
  return `${base}${qs ? '?' + qs : ''}`;
}

export const api = {
  async get<T = any>(endpoint: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    return request<T>('GET', withQuery(`/api/${endpoint}`, params));
  },

  async post<T = any>(endpoint: string, payload: any, opts?: { timeoutMs?: number; retries?: number }): Promise<ApiResponse<T>> {
    return request<T>('POST', `/api/${endpoint}`, payload, opts);
  },

  async put<T = any>(endpoint: string, id: string, payload: any, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    return request<T>('PUT', withQuery(`/api/${endpoint}/${id}`, params), payload);
  },

  async delete(endpoint: string, id: string): Promise<ApiResponse<{ success: boolean; id: string }>> {
    return request('DELETE', `/api/${endpoint}/${id}`);
  },

  async login(username: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    return api.post<{ user: User; token: string }>('login', { username, password });
  },

  async runMigration(force = false): Promise<ApiResponse<any>> {
    return api.post('migrate', { force });
  },

  async testTelegram(token: string, chatId: string, text: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
        }),
      });
      const json = await res.json();
      return Boolean(json.ok);
    } catch (err) {
      console.error('Telegram test error:', err);
      return false;
    }
  },

  async testProxy(id: string): Promise<ApiResponse<{ ok: boolean; latency_ms: number; detail: string; target: string; proxy: any }>> {
    return api.post(`proxy-test/${id}`, {});
  },

  async flashSessions(region: string): Promise<ApiResponse<{
    ok: boolean;
    region: string;
    latency_ms: number;
    status: number;
    reason: string;
    sessions: { promotion_id: string; name: string; start_time: string; end_time: string | null; type: number }[];
  }>> {
    return api.post('bot/flash-sessions', { region });
  },

  async flashItems(region: string, promotionId: string, limit = 16): Promise<ApiResponse<{
    ok: boolean;
    latency_ms: number;
    status: number;
    reason: string;
    browse_url?: string;
    items: {
      item_id: string;
      shop_id: string;
      name: string;
      url: string;
      price: number | null;
      price_before: number | null;
      discount: string;
      stock: number | null;
      sold: number | null;
      image: string;
    }[];
    with_image?: number;
    image_fields?: string[];
  }>> {
    return api.post('bot/flash-items', { region, promotion_id: promotionId, limit });
  },

  async resolveLink(url: string): Promise<ApiResponse<{ url: string; raw: string; shop_id: string | null; item_id: string | null; resolved: boolean }>> {
    return api.post('bot/resolve-link', { url });
  },

  async checkItem(region: string, url: string, accountId?: string): Promise<ApiResponse<{
    parsed: boolean;
    shop_id?: string;
    item_id?: string;
    reachable: boolean | null;
    status: number;
    latency_ms: number;
    reason?: string;
    with_cookies?: boolean;
    item: null | {
      name: string;
      image?: string;
      price: number | null;
      price_before_discount: number | null;
      stock: number | null;
      flash_sale: null | { price: number | null; stock: number | null; start_time: string | null; end_time: string | null };
    };
  }>> {
    return api.post('bot/check-item', { region, url, account_id: accountId });
  },

  async productImage(url: string, region: string, accountId?: string, force?: boolean): Promise<ApiResponse<{ image: string | null; title: string | null; source: string | null; item_id: string | null; reason?: string }>> {
    return api.post('bot/product-image', { url, region, account_id: accountId, force: !!force });
  },

  async sellProxy(payload: {
    user_id: string;
    stock_id?: string;
    amount?: number;
    method?: string;
    days?: number;
    note?: string;
    manual?: { host: string; port: number | string; username?: string; password?: string; region?: string; label?: string };
  }): Promise<ApiResponse<{ proxy: any; revenue: any; buyer: any }>> {
    return api.post('proxy/sell', payload);
  },

  async pushKey(): Promise<ApiResponse<{ enabled: boolean; public_key: string | null; lead_ms: number }>> {
    return api.get('push/key');
  },

  async pushSubscribe(subscription: any, armEpoch: number | null, armLabel: string): Promise<ApiResponse<{ ok: boolean; lead_ms: number }>> {
    return api.post('push/subscribe', { subscription, arm_epoch: armEpoch, arm_label: armLabel });
  },

  async pushUnsubscribe(endpoint: string): Promise<ApiResponse<{ ok: boolean }>> {
    return api.post('push/unsubscribe', { endpoint });
  },

  async pushTest(endpoint: string): Promise<ApiResponse<{ ok: boolean }>> {
    return api.post('push/test', { endpoint });
  },

  async sessionStart(): Promise<ApiResponse<{ ok: boolean; server_time: number }>> {
    // Aman diulang (hanya mencatat waktu jalan), batas waktu pendek karena dipanggil menjelang sesi
    return api.post('bot/session-start', {}, { timeoutMs: 8000, retries: 2 });
  },

  async confirmOrder(params: {
    region: string;
    targetTitle: string;
    price: number;
    orderSn?: string;
    paymentMethod?: string;
    openDelayMs?: number | null;
    targetUrl?: string;
  }): Promise<ApiResponse<any>> {
    return api.post('bot/confirm-order', params);
  },

  async pingGateway(region = 'ID'): Promise<ApiResponse<{
    region: string;
    domain: string;
    status: number;
    reachable?: boolean;
    latency_ms: number;
    ntp_server: string;
    ntp_drift_ms: number;
    timestamp: string;
  }>> {
    return api.post('bot/ping-gateway', { region });
  },
};

/**
 * Secure server-side AI Multi-Model Caller
 */
export async function askMultiModelAI(userPrompt: string, systemInstruction = ''): Promise<string> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: getSessionHeaders(),
      body: JSON.stringify({
        prompt: userPrompt,
        systemInstruction,
      }),
    });
    const json = await res.json();
    if (json.success && json.data?.content) {
      return json.data.content;
    }
  } catch (e) {
    console.warn('API AI call failed:', e);
  }
  return '⚡ Rekomendasi Bot: Gunakan pre-fire jitter -15ms, ShopeePay PIN otomatis, thread count 10-15, dan polling rate 100ms untuk flash sale Rp 1.000.';
}
