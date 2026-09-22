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
}

export const api = {
  async get<T = any>(endpoint: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    try {
      const query = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          query.append(k, String(v));
        }
      }
      const qs = query.toString();
      const res = await fetch(`/api/${endpoint}${qs ? '?' + qs : ''}`, {
        headers: getSessionHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        return {
          success: false,
          data: null,
          error: json.error || { message: `HTTP Error ${res.status}` },
        };
      }
      return { success: true, data: json.data ?? json, error: null };
    } catch (err: any) {
      return { success: false, data: null, error: { message: err.message } };
    }
  },

  async post<T = any>(endpoint: string, payload: any): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: getSessionHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        return {
          success: false,
          data: null,
          error: json.error || { message: `HTTP Error ${res.status}` },
        };
      }
      return { success: true, data: json.data ?? json, error: null };
    } catch (err: any) {
      return { success: false, data: null, error: { message: err.message } };
    }
  },

  async put<T = any>(
    endpoint: string,
    id: string,
    payload: any,
    params: Record<string, any> = {}
  ): Promise<ApiResponse<T>> {
    try {
      const query = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          query.append(k, String(v));
        }
      }
      const qs = query.toString();
      const res = await fetch(`/api/${endpoint}/${id}${qs ? '?' + qs : ''}`, {
        method: 'PUT',
        headers: getSessionHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        return {
          success: false,
          data: null,
          error: json.error || { message: `HTTP Error ${res.status}` },
        };
      }
      return { success: true, data: json.data ?? json, error: null };
    } catch (err: any) {
      return { success: false, data: null, error: { message: err.message } };
    }
  },

  async delete(endpoint: string, id: string): Promise<ApiResponse<{ success: boolean; id: string }>> {
    try {
      const res = await fetch(`/api/${endpoint}/${id}`, {
        method: 'DELETE',
        headers: getSessionHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        return {
          success: false,
          data: null,
          error: json.error || { message: `HTTP Error ${res.status}` },
        };
      }
      return { success: true, data: json.data, error: null };
    } catch (err: any) {
      return { success: false, data: null, error: { message: err.message } };
    }
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
