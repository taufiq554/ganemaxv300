export type AseanCountryCode = 'ID' | 'SG' | 'MY' | 'TH' | 'VN' | 'PH';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  expired_at: string | null;
  license_plan?: string | null;
  plain_password?: string | null;
  preferred_region?: AseanCountryCode;
  max_accounts?: number;
  max_threads?: number;
  device_limit?: number;
  created_at: string;
}

export interface ShopeeAccount {
  id: string;
  user_id: string;
  nickname: string;
  username: string;
  region?: AseanCountryCode;
  email?: string;
  phone?: string;
  password?: string;
  cookies: string;
  created_at?: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  full_address: string;
  country?: AseanCountryCode;
  postal_code?: string;
  is_default?: boolean;
  created_at?: string;
}

export interface TargetUrl {
  id: string;
  user_id: string;
  title: string;
  url: string;
  region?: AseanCountryCode;
  currency?: string;
  variant?: string;
  model_id?: string;
  target_price: number;
  is_active?: boolean;
  created_at?: string;
}

export interface ProxyMesh {
  id: string;
  user_id: string;
  host: string;
  port: number | string;
  region?: AseanCountryCode;
  status?: 'active' | 'dead' | 'checking';
  latency_ms?: number;
  last_checked?: string;
  created_at?: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  title: string;
  target_time: string;
  is_active?: boolean;
  created_at?: string;
}

export interface ShopeePayment {
  id?: string;
  user_id: string;
  payment_method: string;
  custom_voucher_code?: string;
  shopeepay_pin?: string;
  auto_ongkir: string;
  auto_discount: string;
  payment_fallback: string;
  telegram_token?: string;
  telegram_chat_id?: string;
  updated_at?: string;
}

export interface OrderHistoryItem {
  id: string;
  user_id: string;
  order_sn: string;
  product_name: string;
  price: number;
  payment_method: string;
  speed_ms: number;
  checkout_time: string;
  created_at?: string;
}

export interface BotLogItem {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface BotStats {
  attempts: number;
  success: number;
  speed_ms: number;
  saved_amount: number;
}

export interface BotSettings {
  botMode: 'turbo' | 'stealth' | 'ai';
  threadCount: number;
  pollRate: number;
  smartFallback: string;
  preFireJitter: number;
  multiAccMode: 'single' | 'all';
  userAgentPreset: string;
  capSolverApiKey: string;
  executionMode: 'aggressive' | 'balanced' | 'conservative';
  maxRetry: number;
  retryDelay: number;
  whitelist: string;
  blacklist: string;
  notifySuccess: boolean;
  notifyError: boolean;
  notifyRateLimit: boolean;
  /** Buka Shopee sekian ms sebelum detik 0 (kompensasi waktu buka app) */
  openLeadMs?: number;
  /** app = masuk aplikasi Shopee (Android), browser = buka di browser */
  openMode?: 'app' | 'browser';
  soundAlert?: boolean;
  vibrateAlert?: boolean;
}

export type AnnouncementType = 'info' | 'promo' | 'warning' | 'maintenance';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  is_active: boolean;
  pinned?: boolean;
  cta_label?: string;
  cta_url?: string;
  starts_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RevenueEntry {
  id: string;
  user_id?: string | null;
  username?: string | null;
  plan?: string | null;
  amount: number;
  type: 'new' | 'renewal' | 'upgrade' | 'manual';
  method?: string;
  note?: string;
  paid_at: string;
  created_by?: string;
  created_at?: string;
}

export type AppTab = 'dashboard' | 'targets' | 'engine' | 'analytics' | 'admin';

export type EnginePhase = 'idle' | 'sync' | 'warm' | 'armed' | 'fire' | 'done' | 'error';
