import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
  CalendarPlus,
  Dices,
  Import,
  CircleAlert,
} from 'lucide-react';
import { Announcement, AnnouncementType, RevenueEntry, User } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { LICENSE_TIERS, findTier, formatRp, formatRpShort, LicenseTier } from '../../constants/licenses.ts';
import { monthKeyWib, monthLabel, shiftMonth, relativeTimeId } from '../../lib/time.ts';
import { ANNOUNCE_META, AnnouncementCard, isAnnouncementLive, licenseInfo, sortAnnouncements } from './Shell.tsx';

type Section = 'overview' | 'revenue' | 'users' | 'announcements';

interface AdminPanelProps {
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onAnnouncementsChanged: () => void;
  onRunMigration: () => Promise<void>;
  isMigrating: boolean;
  toast: (m: string) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
};

function userState(u: User, now = Date.now()) {
  if (u.status === 'disabled') return 'disabled' as const;
  if (!u.expired_at) return 'active' as const;
  const ms = new Date(u.expired_at).getTime() - now;
  if (isNaN(ms)) return 'active' as const;
  if (ms <= 0) return 'expired' as const;
  if (ms <= 7 * 86_400_000) return 'expiring' as const;
  return 'active' as const;
}

function computeExpiry(tier: LicenseTier, from?: string | null) {
  if (tier.id === 'lifetime') return null;
  const base = from && new Date(from).getTime() > Date.now() ? new Date(from).getTime() : Date.now();
  return new Date(base + tier.days * 86_400_000).toISOString();
}

function accountInfoText(u: User, password?: string) {
  const tier = findTier(u.license_plan);
  const expiry = u.expired_at
    ? new Date(u.expired_at).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB'
    : 'Lifetime (selamanya)';
  return (
    `Halo kak, pembayaran sudah kami terima. Berikut akun bot GaneMaX.Ai kamu:\n\n` +
    `Username : ${u.username}\n` +
    `Password : ${password || u.plain_password || '(sesuai yang dibuat)'}\n` +
    `Paket    : ${tier ? `${tier.short} (${tier.priceRp})` : u.license_plan || '-'}\n` +
    `Aktif s/d: ${expiry}\n` +
    `Batas    : ${u.max_accounts || 5} akun · ${u.max_threads || 8} thread · ${u.device_limit || 3} perangkat\n` +
    `Login    : ${window.location.origin}/app\n\n` +
    `Cara pakai:\n1. Login pakai username & password di atas\n2. Tab Target: tambah link produk, akun Shopee, alamat & pembayaran\n3. Di Beranda pilih sesi (mis. 12:00) lalu tekan "Auto-start"\n\n` +
    `Butuh bantuan? Telegram @mrpangeranz. Selamat war flash sale!`
  );
}

function reminderText(u: User) {
  const lic = licenseInfo(u);
  return (
    `Halo kak ${u.username}, lisensi bot GaneMaX.Ai kamu ${lic.days === 0 ? 'sudah habis' : `tinggal ${lic.days} hari lagi`}.\n` +
    `Biar nggak ketinggalan sesi flash sale berikutnya, perpanjang sekarang ya:\n` +
    LICENSE_TIERS.filter((t) => t.id !== 'lifetime').map((t) => `• ${t.short}: ${t.priceRp}`).join('\n') +
    `\n\nBayar via QRIS lalu kirim bukti ke Telegram @mrpangeranz. Terima kasih!`
  );
}

/* ------------------------------------------------------------------ */
/* Small UI                                                            */
/* ------------------------------------------------------------------ */

const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({
  title,
  onClose,
  children,
  footer,
  wide,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="gx-overlay gx-overlay--center" onClick={onClose}>
      <div className="gx-dialog" style={wide ? { width: 'min(640px, 100%)' } : undefined} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="gx-dialog__head">
          <h3>{title}</h3>
          <button type="button" className="gx-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>
        <div className="gx-dialog__body">{children}</div>
        {footer && <div className="gx-dialog__foot">{footer}</div>}
      </div>
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; delta?: number | null; sub?: string; hero?: boolean; icon?: React.ReactNode }> = ({
  label,
  value,
  delta,
  sub,
  hero,
  icon,
}) => (
  <div className={`gx-card gx-kpi ${hero ? 'gx-kpi--hero' : ''}`}>
    <div className="gx-kpi__k">
      {icon}
      {label}
    </div>
    <div className="gx-kpi__v" title={value}>
      {value}
    </div>
    {delta != null && isFinite(delta) ? (
      <div className={`gx-kpi__d ${delta >= 0 ? 'gx-kpi__d--up' : 'gx-kpi__d--down'}`}>
        {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {delta >= 0 ? '+' : ''}
        {delta.toFixed(0)}% vs bulan lalu
      </div>
    ) : sub ? (
      <div className="gx-kpi__d">{sub}</div>
    ) : null}
  </div>
);

const MonthBars: React.FC<{ series: { key: string; total: number }[]; active: string; onPick: (k: string) => void }> = ({ series, active, onPick }) => {
  const max = Math.max(1, ...series.map((s) => s.total));
  return (
    <div className="gx-bars" role="list" aria-label="Pendapatan per bulan">
      {series.map((s) => (
        <button
          key={s.key}
          type="button"
          role="listitem"
          className={`gx-bar ${s.key === active ? 'gx-bar--active' : ''}`}
          onClick={() => onPick(s.key)}
          title={`${monthLabel(s.key)}: ${formatRp(s.total)}`}
        >
          <div className="gx-bar__col">
            <div className="gx-bar__fill" style={{ height: `${Math.max(2, (s.total / max) * 100)}%` }}>
              {s.key === active && s.total > 0 && <span className="gx-bar__val">{formatRpShort(s.total).replace('Rp ', '')}</span>}
            </div>
          </div>
          <span className="gx-bar__lbl">{monthLabel(s.key, true).split(' ')[0]}</span>
        </button>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, users, setUsers, onAnnouncementsChanged, onRunMigration, isMigrating, toast }) => {
  const [section, setSection] = useState<Section>('overview');
  const [revenues, setRevenues] = useState<RevenueEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const nowMonth = monthKeyWib(Date.now());
  const [month, setMonth] = useState(nowMonth);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [r, a, u] = await Promise.all([api.get<RevenueEntry[]>('revenues'), api.get<Announcement[]>('announcements'), api.get<User[]>('users')]);
    if (r.success && Array.isArray(r.data)) setRevenues(r.data);
    if (a.success && Array.isArray(a.data)) setAnnouncements(a.data);
    if (u.success && Array.isArray(u.data)) setUsers(u.data);
    if (!r.success || !a.success) setLoadError(r.error?.message || a.error?.message || 'Gagal memuat data admin');
    setLoading(false);
  }, [setUsers]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- revenue aggregates ---------- */
  const byMonth = useMemo(() => {
    const m = new Map<string, { total: number; count: number; items: RevenueEntry[] }>();
    for (const r of revenues) {
      const k = monthKeyWib(r.paid_at || r.created_at || '');
      if (k === 'invalid') continue;
      const cur = m.get(k) || { total: 0, count: 0, items: [] };
      cur.total += Number(r.amount) || 0;
      cur.count += 1;
      cur.items.push(r);
      m.set(k, cur);
    }
    return m;
  }, [revenues]);

  const monthStat = (k: string) => byMonth.get(k) || { total: 0, count: 0, items: [] as RevenueEntry[] };
  const cur = monthStat(month);
  const prev = monthStat(shiftMonth(month, -1));
  const delta = prev.total > 0 ? ((cur.total - prev.total) / prev.total) * 100 : null;
  const series = Array.from({ length: 12 }, (_, i) => {
    const k = shiftMonth(month, i - 11);
    return { key: k, total: monthStat(k).total };
  });
  const yearKey = month.slice(0, 4);
  const ytd = Array.from(byMonth.entries())
    .filter(([k]) => k.startsWith(yearKey) && k <= month)
    .reduce((s, [, v]) => s + v.total, 0);
  const allTime = revenues.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  /* ---------- user aggregates ---------- */
  const customers = users.filter((u) => u.role !== 'admin');
  const counts = useMemo(() => {
    const c = { active: 0, expiring: 0, expired: 0, disabled: 0 };
    for (const u of customers) c[userState(u)] += 1;
    return c;
  }, [customers]);

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg);
    } catch {
      toast('Gagal menyalin — izinkan akses clipboard');
    }
  };

  /* ---------- revenue actions ---------- */
  const addRevenue = async (entry: Partial<RevenueEntry>) => {
    const res = await api.post<RevenueEntry>('revenues', { ...entry, created_by: currentUser.id });
    if (res.success && res.data) {
      setRevenues((p) => [res.data!, ...p]);
      return true;
    }
    toast(`Gagal mencatat pendapatan: ${res.error?.message || 'error'}`);
    return false;
  };

  const deleteRevenue = async (r: RevenueEntry) => {
    if (!confirm(`Hapus catatan ${formatRp(r.amount)} (${r.username || '-'})?`)) return;
    const res = await api.delete('revenues', r.id);
    if (res.success) {
      setRevenues((p) => p.filter((x) => x.id !== r.id));
      toast('Catatan pendapatan dihapus');
    } else toast(res.error?.message || 'Gagal menghapus');
  };

  const backfillCandidates = useMemo(() => {
    const has = new Set(revenues.map((r) => r.user_id).filter(Boolean));
    return customers.filter((u) => !has.has(u.id) && findTier(u.license_plan));
  }, [customers, revenues]);

  const runBackfill = async () => {
    const total = backfillCandidates.reduce((s, u) => s + (findTier(u.license_plan)?.price || 0), 0);
    if (
      !confirm(
        `Buat ${backfillCandidates.length} catatan pendapatan dari data user lama (total ${formatRp(total)})?\n\nTanggal memakai tanggal user dibuat, nominal memakai harga paket. Bisa dihapus satu per satu kalau ada yang tidak sesuai.`
      )
    )
      return;
    const items = backfillCandidates.map((u) => {
      const t = findTier(u.license_plan)!;
      return {
        user_id: u.id,
        username: u.username,
        plan: t.id,
        amount: t.price,
        type: 'new',
        method: 'QRIS',
        note: 'Impor otomatis dari data user',
        paid_at: u.created_at || new Date().toISOString(),
        created_by: currentUser.id,
      };
    });
    const res = await api.post<{ items: RevenueEntry[] }>('revenues/bulk', items);
    if (res.success && res.data?.items) {
      setRevenues((p) => [...res.data!.items, ...p]);
      toast(`${res.data.items.length} catatan diimpor`);
    } else toast(res.error?.message || 'Gagal impor');
  };

  const exportCsv = () => {
    const rows = [['Tanggal', 'Username', 'Paket', 'Jenis', 'Metode', 'Nominal', 'Catatan']];
    for (const r of [...cur.items].sort((a, b) => (a.paid_at < b.paid_at ? -1 : 1))) {
      rows.push([
        new Date(r.paid_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        r.username || '',
        findTier(r.plan)?.short || r.plan || '',
        r.type,
        r.method || '',
        String(r.amount),
        (r.note || '').replace(/\n/g, ' '),
      ]);
    }
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pendapatan-ganemax-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- dialogs state ---------- */
  const [revDialog, setRevDialog] = useState(false);
  const [extendUser, setExtendUser] = useState<User | null>(null);
  const [annDialog, setAnnDialog] = useState<Partial<Announcement> | null>(null);

  return (
    <>
      <div className="gx-pagehead">
        <div>
          <h1>Admin</h1>
          <p>Kelola lisensi, pantau pendapatan sewa, dan kirim pengumuman ke semua user.</p>
        </div>
        <div className="gx-pagehead__aside">
          <button type="button" className="gx-btn gx-btn--sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'gx-spin' : ''} /> Muat ulang
          </button>
        </div>
      </div>

      <div className="gx-seg" role="group" aria-label="Bagian admin">
        <button type="button" aria-pressed={section === 'overview'} onClick={() => setSection('overview')}>
          <LayoutGrid size={14} /> Ringkasan
        </button>
        <button type="button" aria-pressed={section === 'revenue'} onClick={() => setSection('revenue')}>
          <Wallet size={14} /> Pendapatan
        </button>
        <button type="button" aria-pressed={section === 'users'} onClick={() => setSection('users')}>
          <Users size={14} /> Pengguna <span className="gx-count-badge">{customers.length}</span>
        </button>
        <button type="button" aria-pressed={section === 'announcements'} onClick={() => setSection('announcements')}>
          <Megaphone size={14} /> Pengumuman <span className="gx-count-badge">{announcements.filter((a) => isAnnouncementLive(a)).length}</span>
        </button>
      </div>

      {loadError && (
        <div className="gx-note gx-note--bad">
          <CircleAlert size={16} />
          <span>
            {loadError}. Kalau pakai Firestore, pastikan rules untuk koleksi <b>revenues</b> & <b>announcements</b> sudah dipublish (lihat firestore.rules).
          </span>
        </div>
      )}

      {/* ================= OVERVIEW ================= */}
      {section === 'overview' && (
        <>
          <div className="gx-kpis">
            <Kpi hero label={`Pendapatan ${monthLabel(nowMonth)}`} value={formatRp(monthStat(nowMonth).total)} delta={
              monthStat(shiftMonth(nowMonth, -1)).total > 0
                ? ((monthStat(nowMonth).total - monthStat(shiftMonth(nowMonth, -1)).total) / monthStat(shiftMonth(nowMonth, -1)).total) * 100
                : null
            } sub={`${monthStat(nowMonth).count} transaksi`} />
            <Kpi label="User aktif" value={String(counts.active + counts.expiring)} sub={`${customers.length} total pembeli`} />
            <Kpi label="Habis ≤ 7 hari" value={String(counts.expiring)} sub="Peluang perpanjangan" />
            <Kpi label="Sudah expired" value={String(counts.expired)} sub={`${counts.disabled} dinonaktifkan`} />
          </div>

          <div className="gx-grid gx-grid--2">
            <section className="gx-card">
              <div className="gx-card__head">
                <h2 className="gx-card__title">Tren pendapatan</h2>
                <div className="gx-card__aside">
                  <button type="button" className="gx-link" onClick={() => setSection('revenue')}>
                    Detail <ChevronRight size={13} />
                  </button>
                </div>
              </div>
              <div className="gx-card__body">
                <MonthBars
                  series={Array.from({ length: 6 }, (_, i) => {
                    const k = shiftMonth(nowMonth, i - 5);
                    return { key: k, total: monthStat(k).total };
                  })}
                  active={nowMonth}
                  onPick={(k) => {
                    setMonth(k);
                    setSection('revenue');
                  }}
                />
                <div className="gx-muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Total tercatat sepanjang waktu: <b className="gx-mono" style={{ color: 'var(--gx-ink)' }}>{formatRp(allTime)}</b>
                </div>
              </div>
            </section>

            <section className="gx-card">
              <div className="gx-card__head">
                <h2 className="gx-card__title">Perlu follow-up</h2>
                <div className="gx-card__aside">
                  <span className="gx-tag gx-tag--warn">{counts.expiring + counts.expired}</span>
                </div>
              </div>
              <div className="gx-card__body">
                {customers.filter((u) => ['expiring', 'expired'].includes(userState(u))).length === 0 ? (
                  <div className="gx-empty">Semua lisensi masih aman.</div>
                ) : (
                  <ul className="gx-list">
                    {customers
                      .filter((u) => ['expiring', 'expired'].includes(userState(u)))
                      .sort((a, b) => new Date(a.expired_at || 0).getTime() - new Date(b.expired_at || 0).getTime())
                      .slice(0, 6)
                      .map((u) => {
                        const lic = licenseInfo(u);
                        return (
                          <li key={u.id} className="gx-row">
                            <span className="gx-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                              {u.username.slice(0, 1)}
                            </span>
                            <div className="gx-row__main">
                              <div className="gx-row__t">{u.username}</div>
                              <div className="gx-row__s">{findTier(u.license_plan)?.short || u.license_plan || '-'}</div>
                            </div>
                            <span className={`gx-tag ${lic.tone === 'bad' ? 'gx-tag--bad' : 'gx-tag--warn'}`}>{lic.label}</span>
                            <button type="button" className="gx-btn gx-btn--xs" onClick={() => copy(reminderText(u), `Pesan pengingat untuk ${u.username} disalin`)}>
                              <Copy size={12} /> Ingatkan
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <section className="gx-card">
            <div className="gx-card__head">
              <h2 className="gx-card__title">Pemeliharaan data</h2>
            </div>
            <div className="gx-card__body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="gx-btn gx-btn--sm" onClick={onRunMigration} disabled={isMigrating}>
                <RefreshCw size={14} className={isMigrating ? 'gx-spin' : ''} /> {isMigrating ? 'Menyinkronkan…' : 'Cek & isi koleksi cloud kosong'}
              </button>
              <span className="gx-muted" style={{ fontSize: 12 }}>
                Aman: hanya mengisi koleksi Firestore yang masih kosong, tidak menimpa data yang sudah ada.
              </span>
            </div>
          </section>
        </>
      )}

      {/* ================= REVENUE ================= */}
      {section === 'revenue' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button type="button" className="gx-iconbtn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Bulan sebelumnya">
                <ChevronLeft size={16} />
              </button>
              <div style={{ minWidth: 150, textAlign: 'center', fontWeight: 800, fontSize: 15 }}>{monthLabel(month)}</div>
              <button type="button" className="gx-iconbtn" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= nowMonth} aria-label="Bulan berikutnya">
                <ChevronRight size={16} />
              </button>
            </div>
            {month !== nowMonth && (
              <button type="button" className="gx-btn gx-btn--xs gx-btn--ghost" onClick={() => setMonth(nowMonth)}>
                Bulan ini
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="gx-btn gx-btn--sm" onClick={exportCsv} disabled={!cur.items.length}>
                <Download size={14} /> CSV
              </button>
              <button type="button" className="gx-btn gx-btn--sm gx-btn--primary" onClick={() => setRevDialog(true)}>
                <Plus size={14} /> Catat pemasukan
              </button>
            </div>
          </div>

          <div className="gx-kpis">
            <Kpi hero label="Pendapatan bulan ini" value={formatRp(cur.total)} delta={delta} sub={prev.total === 0 ? 'Belum ada data bulan lalu' : undefined} />
            <Kpi label="Transaksi" value={String(cur.count)} sub={`${prev.count} bulan lalu`} />
            <Kpi label="Rata-rata / transaksi" value={cur.count ? formatRp(cur.total / cur.count) : '—'} />
            <Kpi label={`Total ${yearKey} (s/d bulan ini)`} value={formatRp(ytd)} />
          </div>

          {backfillCandidates.length > 0 && (
            <div className="gx-note gx-note--warn">
              <Import size={16} />
              <div style={{ flex: 1 }}>
                Ada <b>{backfillCandidates.length} user lama</b> yang belum punya catatan pendapatan (dibuat sebelum fitur ini ada).
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="gx-btn gx-btn--xs" onClick={runBackfill}>
                    Impor sebagai pendapatan
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="gx-grid gx-grid--dash">
            <section className="gx-card">
              <div className="gx-card__head">
                <h2 className="gx-card__title">12 bulan terakhir</h2>
                <div className="gx-card__aside gx-muted" style={{ fontSize: 11.5 }}>
                  klik batang untuk pindah bulan
                </div>
              </div>
              <div className="gx-card__body">
                <MonthBars series={series} active={month} onPick={setMonth} />
              </div>
            </section>
            <section className="gx-card">
              <div className="gx-card__head">
                <h2 className="gx-card__title">Per paket · {monthLabel(month, true)}</h2>
              </div>
              <div className="gx-card__body">
                {cur.total === 0 ? (
                  <div className="gx-empty">Belum ada pemasukan di bulan ini.</div>
                ) : (
                  <div className="gx-hbar">
                    {[...LICENSE_TIERS.map((t) => ({ id: t.id, label: t.short })), { id: '__other', label: 'Lainnya' }].map((t) => {
                      const sum = cur.items
                        .filter((r) => (t.id === '__other' ? !findTier(r.plan) : findTier(r.plan)?.id === t.id))
                        .reduce((s, r) => s + (Number(r.amount) || 0), 0);
                      if (!sum) return null;
                      return (
                        <div key={t.id} className="gx-hbar__row">
                          <span>{t.label}</span>
                          <div className="gx-hbar__track">
                            <span style={{ width: `${(sum / cur.total) * 100}%` }} />
                          </div>
                          <b>{formatRpShort(sum)}</b>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="gx-card">
            <div className="gx-card__head">
              <h2 className="gx-card__title">Transaksi {monthLabel(month)}</h2>
              <div className="gx-card__aside">
                <span className="gx-tag">{cur.count}</span>
              </div>
            </div>
            <div className="gx-card__body">
              {cur.items.length === 0 ? (
                <div className="gx-empty">Tidak ada transaksi. Pemasukan otomatis tercatat saat kamu mengaktifkan atau memperpanjang lisensi user.</div>
              ) : (
                <div className="gx-table-wrap">
                  <table className="gx-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>User</th>
                        <th>Paket</th>
                        <th>Jenis</th>
                        <th className="num">Nominal</th>
                        <th aria-label="Aksi" />
                      </tr>
                    </thead>
                    <tbody>
                      {[...cur.items]
                        .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
                        .map((r) => (
                          <tr key={r.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {new Date(r.paid_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' })}
                              <div className="gx-muted" style={{ fontSize: 11 }}>
                                {new Date(r.paid_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
                              </div>
                            </td>
                            <td>
                              <b>{r.username || '-'}</b>
                              {r.note && <div className="gx-muted" style={{ fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note}</div>}
                            </td>
                            <td>{findTier(r.plan)?.short || r.plan || '-'}</td>
                            <td>
                              <span className={`gx-tag ${r.type === 'new' ? 'gx-tag--brand' : r.type === 'renewal' ? 'gx-tag--ok' : r.type === 'upgrade' ? 'gx-tag--flash' : ''}`}>
                                {r.type === 'new' ? 'Baru' : r.type === 'renewal' ? 'Perpanjang' : r.type === 'upgrade' ? 'Upgrade' : 'Manual'}
                              </span>
                            </td>
                            <td className="num">
                              <b>{formatRp(r.amount)}</b>
                            </td>
                            <td style={{ width: 1 }}>
                              <button type="button" className="gx-iconbtn" style={{ width: 30, height: 30 }} onClick={() => deleteRevenue(r)} aria-label="Hapus">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* ================= USERS ================= */}
      {section === 'users' && (
        <UsersSection
          currentUser={currentUser}
          users={users}
          setUsers={setUsers}
          toast={toast}
          copy={copy}
          onExtend={setExtendUser}
          onRevenueCreated={(r) => setRevenues((p) => [r, ...p])}
          reloadRevenues={async () => {
            const r = await api.get<RevenueEntry[]>('revenues');
            if (r.success && Array.isArray(r.data)) setRevenues(r.data);
          }}
        />
      )}

      {/* ================= ANNOUNCEMENTS ================= */}
      {section === 'announcements' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="gx-muted" style={{ fontSize: 13 }}>
              Pengumuman tampil di Beranda semua user. Yang disematkan tidak bisa ditutup user.
            </span>
            <button
              type="button"
              className="gx-btn gx-btn--sm gx-btn--primary"
              onClick={() => setAnnDialog({ type: 'info', is_active: true, pinned: false, title: '', body: '' })}
            >
              <Plus size={14} /> Buat pengumuman
            </button>
          </div>
          {announcements.length === 0 ? (
            <div className="gx-empty">Belum ada pengumuman.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sortAnnouncements(announcements).map((a) => {
                const live = isAnnouncementLive(a);
                const scheduled = a.is_active && a.starts_at && new Date(a.starts_at).getTime() > Date.now();
                const expired = a.expires_at && new Date(a.expires_at).getTime() < Date.now();
                return (
                  <div key={a.id} className="gx-card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                      <span className={`gx-tag ${live ? 'gx-tag--ok' : scheduled ? 'gx-tag--brand' : expired ? 'gx-tag--warn' : ''}`}>
                        {live ? 'Tayang' : scheduled ? 'Terjadwal' : expired ? 'Kedaluwarsa' : 'Nonaktif'}
                      </span>
                      {a.expires_at && <span className="gx-muted" style={{ fontSize: 11.5 }}>s/d {new Date(a.expires_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="gx-btn gx-btn--xs"
                          onClick={async () => {
                            const res = await api.put<Announcement>('announcements', a.id, { is_active: !a.is_active });
                            if (res.success && res.data) {
                              setAnnouncements((p) => p.map((x) => (x.id === a.id ? res.data! : x)));
                              onAnnouncementsChanged();
                            } else toast(res.error?.message || 'Gagal');
                          }}
                        >
                          {a.is_active ? 'Matikan' : 'Tayangkan'}
                        </button>
                        <button
                          type="button"
                          className="gx-btn gx-btn--xs"
                          title={a.pinned ? 'Lepas sematan' : 'Sematkan'}
                          onClick={async () => {
                            const res = await api.put<Announcement>('announcements', a.id, { pinned: !a.pinned });
                            if (res.success && res.data) {
                              setAnnouncements((p) => p.map((x) => (x.id === a.id ? res.data! : x)));
                              onAnnouncementsChanged();
                            }
                          }}
                        >
                          <Pin size={12} fill={a.pinned ? 'currentColor' : 'none'} />
                        </button>
                        <button type="button" className="gx-btn gx-btn--xs" onClick={() => setAnnDialog(a)} aria-label="Edit">
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          className="gx-btn gx-btn--xs"
                          aria-label="Hapus"
                          onClick={async () => {
                            if (!confirm(`Hapus pengumuman "${a.title}"?`)) return;
                            const res = await api.delete('announcements', a.id);
                            if (res.success) {
                              setAnnouncements((p) => p.filter((x) => x.id !== a.id));
                              onAnnouncementsChanged();
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </div>
                    <AnnouncementCard a={a} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================= DIALOGS ================= */}
      {revDialog && (
        <RevenueDialog
          users={customers}
          onClose={() => setRevDialog(false)}
          onSave={async (e) => {
            const ok = await addRevenue(e);
            if (ok) {
              toast('Pemasukan dicatat');
              setRevDialog(false);
              setMonth(monthKeyWib(e.paid_at || Date.now()));
            }
          }}
        />
      )}

      {extendUser && (
        <ExtendDialog
          user={extendUser}
          onClose={() => setExtendUser(null)}
          onSave={async ({ tier, amount, record, applyLimits }) => {
            const updates: Partial<User> = {
              expired_at: computeExpiry(tier, extendUser.expired_at),
              status: 'active',
              license_plan: tier.id,
            };
            if (applyLimits) {
              updates.max_accounts = tier.maxAccounts;
              updates.max_threads = tier.maxThreads;
              updates.device_limit = tier.deviceLimit;
            }
            const res = await api.put<User>('users', extendUser.id, updates);
            if (!res.success || !res.data) {
              toast(res.error?.message || 'Gagal memperpanjang');
              return;
            }
            setUsers((p) => p.map((u) => (u.id === extendUser.id ? res.data! : u)));
            if (record && amount > 0) {
              const sameTier = findTier(extendUser.license_plan)?.id === tier.id;
              await addRevenue({
                user_id: extendUser.id,
                username: extendUser.username,
                plan: tier.id,
                amount,
                type: sameTier ? 'renewal' : 'upgrade',
                method: 'QRIS',
                note: sameTier ? `Perpanjang ${tier.short}` : `Upgrade ke ${tier.short}`,
                paid_at: new Date().toISOString(),
              });
            }
            toast(`Lisensi ${extendUser.username} diperpanjang`);
            setExtendUser(null);
          }}
        />
      )}

      {annDialog && (
        <AnnouncementDialog
          initial={annDialog}
          onClose={() => setAnnDialog(null)}
          onSave={async (data) => {
            const res = annDialog.id
              ? await api.put<Announcement>('announcements', annDialog.id, data)
              : await api.post<Announcement>('announcements', data);
            if (res.success && res.data) {
              setAnnouncements((p) => (annDialog.id ? p.map((x) => (x.id === annDialog.id ? res.data! : x)) : [res.data!, ...p]));
              onAnnouncementsChanged();
              toast(annDialog.id ? 'Pengumuman diperbarui' : 'Pengumuman diterbitkan');
              setAnnDialog(null);
            } else toast(res.error?.message || 'Gagal menyimpan pengumuman');
          }}
        />
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Users section                                                       */
/* ------------------------------------------------------------------ */

const UsersSection: React.FC<{
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  toast: (m: string) => void;
  copy: (text: string, msg: string) => void;
  onExtend: (u: User) => void;
  onRevenueCreated: (r: RevenueEntry) => void;
  reloadRevenues: () => Promise<void>;
}> = ({ currentUser, users, setUsers, toast, copy, onExtend, reloadRevenues }) => {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired' | 'disabled'>('all');
  const [showForm, setShowForm] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState(LICENSE_TIERS[0].id);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [maxAcc, setMaxAcc] = useState(LICENSE_TIERS[0].maxAccounts);
  const [maxThr, setMaxThr] = useState(LICENSE_TIERS[0].maxThreads);
  const [devLim, setDevLim] = useState(LICENSE_TIERS[0].deviceLimit);
  const [record, setRecord] = useState(true);
  const [amount, setAmount] = useState(LICENSE_TIERS[0].price);
  const [saving, setSaving] = useState(false);

  const pickPlan = (id: string) => {
    setPlan(id);
    const t = findTier(id)!;
    setMaxAcc(t.maxAccounts);
    setMaxThr(t.maxThreads);
    setDevLim(t.deviceLimit);
    setAmount(t.price);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = username.trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(uname)) {
      toast('Username 3–32 karakter: huruf, angka, titik, _ atau -');
      return;
    }
    if (password.trim().length < 6) {
      toast('Password minimal 6 karakter');
      return;
    }
    const tier = findTier(plan)!;
    setSaving(true);
    const pw = password.trim();
    const res = await api.post<User>('users', {
      username: uname,
      password: pw,
      role,
      license_plan: tier.id,
      max_accounts: maxAcc,
      max_threads: maxThr,
      device_limit: devLim,
      expired_at: computeExpiry(tier),
      status: 'active',
      revenue_amount: record && role === 'user' ? amount : 0,
      revenue_note: `Aktivasi ${tier.short}`,
    });
    setSaving(false);
    if (res.success && res.data) {
      setUsers((p) => [res.data!, ...p]);
      copy(accountInfoText(res.data, pw), `User ${uname} dibuat — info akun disalin`);
      setUsername('');
      setPassword('');
      if (record) reloadRevenues();
    } else {
      toast(res.error?.message || 'Gagal membuat user');
    }
  };

  const toggleStatus = async (u: User) => {
    const res = await api.put<User>('users', u.id, { status: u.status === 'active' ? 'disabled' : 'active' });
    if (res.success && res.data) setUsers((p) => p.map((x) => (x.id === u.id ? res.data! : x)));
    else toast(res.error?.message || 'Gagal');
  };

  const remove = async (u: User) => {
    if (!confirm(`Hapus user @${u.username}? Data lisensinya hilang permanen.`)) return;
    const res = await api.delete('users', u.id);
    if (res.success) {
      setUsers((p) => p.filter((x) => x.id !== u.id));
      toast(`@${u.username} dihapus`);
    } else toast(res.error?.message || 'Gagal menghapus');
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users.length, active: 0, expiring: 0, expired: 0, disabled: 0 };
    users.forEach((u) => (c[userState(u)] += 1));
    return c;
  }, [users]);

  const list = users
    .filter((u) => (filter === 'all' ? true : userState(u) === filter))
    .filter((u) => !q || u.username.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const tier = findTier(plan)!;

  return (
    <>
      <section className="gx-card">
        <div className="gx-card__head">
          <h2 className="gx-card__title">
            <UserPlus size={16} /> Aktivasi user baru
          </h2>
          <div className="gx-card__aside">
            <button type="button" className="gx-btn gx-btn--xs" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Tutup' : 'Buka form'}
            </button>
          </div>
        </div>
        {showForm ? (
          <form className="gx-card__body" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="gx-chips" role="group" aria-label="Paket">
              {LICENSE_TIERS.map((t) => (
                <button key={t.id} type="button" className="gx-chip" aria-pressed={plan === t.id} onClick={() => pickPlan(t.id)}>
                  {t.short} · {formatRpShort(t.price)}
                </button>
              ))}
            </div>
            <div className="gx-formgrid gx-formgrid--2">
              <label className="gx-field">
                <span>Username pembeli</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="misal: flashbuyer88" autoComplete="off" required />
              </label>
              <label className="gx-field">
                <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Password
                  <button type="button" className="gx-link" onClick={() => setPassword(genPassword())}>
                    <Dices size={12} /> Acak
                  </button>
                </span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 karakter" autoComplete="off" required />
              </label>
            </div>
            <div className="gx-formgrid gx-formgrid--4">
              <label className="gx-field">
                <span>Maks. akun</span>
                <input type="number" min={1} max={999} value={maxAcc} onChange={(e) => setMaxAcc(Number(e.target.value) || 1)} />
              </label>
              <label className="gx-field">
                <span>Maks. thread</span>
                <input type="number" min={1} max={32} value={maxThr} onChange={(e) => setMaxThr(Number(e.target.value) || 1)} />
              </label>
              <label className="gx-field">
                <span>Perangkat</span>
                <input type="number" min={1} max={99} value={devLim} onChange={(e) => setDevLim(Number(e.target.value) || 1)} />
              </label>
              <label className="gx-field">
                <span>Role</span>
                <select value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')}>
                  <option value="user">User (pembeli)</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label className="gx-switch">
                <input type="checkbox" checked={record && role === 'user'} disabled={role === 'admin'} onChange={(e) => setRecord(e.target.checked)} />
                Catat sebagai pendapatan
              </label>
              {record && role === 'user' && (
                <input
                  className="gx-input gx-mono"
                  style={{ width: 160 }}
                  type="number"
                  min={0}
                  step={1000}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  aria-label="Nominal pendapatan"
                />
              )}
              <span className="gx-muted" style={{ fontSize: 12 }}>
                Aktif s/d {tier.id === 'lifetime' ? 'selamanya' : new Date(Date.now() + tier.days * 86_400_000).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
              </span>
            </div>
            <div>
              <button type="submit" className="gx-btn gx-btn--primary" disabled={saving}>
                <UserPlus size={15} /> {saving ? 'Menyimpan…' : 'Aktifkan & salin info akun'}
              </button>
            </div>
          </form>
        ) : (
          <div className="gx-card__body gx-muted" style={{ fontSize: 12.5 }}>
            Alur: pembeli bayar QRIS → DM Telegram → buat akun di sini → info login otomatis tersalin untuk dikirim.
          </div>
        )}
      </section>

      <section className="gx-card">
        <div className="gx-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--gx-ink-3)' }} />
              <input className="gx-input" style={{ paddingLeft: 34 }} placeholder="Cari username…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari user" />
            </div>
          </div>
          <div className="gx-seg" role="group" aria-label="Filter status">
            {(
              [
                ['all', 'Semua'],
                ['active', 'Aktif'],
                ['expiring', 'Segera habis'],
                ['expired', 'Expired'],
                ['disabled', 'Nonaktif'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {l} <span className="gx-count-badge">{counts[k]}</span>
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="gx-empty">Tidak ada user yang cocok.</div>
          ) : (
            <div className="gx-users">
              {list.map((u) => {
                const lic = licenseInfo(u);
                const st = userState(u);
                const t = findTier(u.license_plan);
                return (
                  <div key={u.id} className="gx-user">
                    <span className="gx-avatar">{u.username.slice(0, 1)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="gx-user__name">
                        {u.username}
                        {u.role === 'admin' && <span className="gx-tag gx-tag--brand">Admin</span>}
                        {st === 'disabled' ? (
                          <span className="gx-tag gx-tag--bad">Nonaktif</span>
                        ) : u.role === 'admin' && !u.expired_at ? null : (
                          <span className={`gx-tag ${lic.tone === 'bad' ? 'gx-tag--bad' : lic.tone === 'warn' ? 'gx-tag--warn' : 'gx-tag--ok'}`}>{lic.label}</span>
                        )}
                      </div>
                      <div className="gx-user__meta">
                        <span>{t?.short || u.license_plan || 'Tanpa paket'}</span>
                        <span>
                          {u.max_accounts ?? 5} akun · {u.max_threads ?? 8} thr · {u.device_limit ?? 3} dev
                        </span>
                        <span className="gx-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          pw: {revealed[u.id] ? u.plain_password || '(tidak tersimpan)' : '••••••'}
                          <button
                            type="button"
                            className="gx-link"
                            onClick={() => setRevealed((p) => ({ ...p, [u.id]: !p[u.id] }))}
                            aria-label={revealed[u.id] ? 'Sembunyikan password' : 'Lihat password'}
                          >
                            {revealed[u.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </span>
                        <span>dibuat {relativeTimeId(u.created_at)}</span>
                      </div>
                    </div>
                    <div className="gx-user__actions">
                      <button type="button" className="gx-btn gx-btn--xs" onClick={() => copy(accountInfoText(u), `Info akun ${u.username} disalin`)} title="Salin info akun">
                        <Copy size={12} /> Info
                      </button>
                      {u.role !== 'admin' && (
                        <button type="button" className="gx-btn gx-btn--xs" onClick={() => onExtend(u)}>
                          <CalendarPlus size={12} /> Perpanjang
                        </button>
                      )}
                      {u.id !== currentUser.id && (
                        <button type="button" className="gx-btn gx-btn--xs" onClick={() => toggleStatus(u)}>
                          {u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      )}
                      {u.id !== currentUser.id && (
                        <button type="button" className="gx-btn gx-btn--xs" onClick={() => remove(u)} aria-label={`Hapus ${u.username}`}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

const ExtendDialog: React.FC<{
  user: User;
  onClose: () => void;
  onSave: (v: { tier: LicenseTier; amount: number; record: boolean; applyLimits: boolean }) => Promise<void>;
}> = ({ user, onClose, onSave }) => {
  const initial = findTier(user.license_plan) || LICENSE_TIERS[0];
  const [tierId, setTierId] = useState(initial.id);
  const tier = findTier(tierId)!;
  const [amount, setAmount] = useState(initial.price);
  const [record, setRecord] = useState(true);
  const [busy, setBusy] = useState(false);
  const changed = tier.id !== initial.id;
  const newExp = computeExpiry(tier, user.expired_at);
  return (
    <Dialog
      title={`Perpanjang @${user.username}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="gx-btn gx-btn--sm" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="gx-btn gx-btn--sm gx-btn--primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave({ tier, amount, record, applyLimits: changed });
              setBusy(false);
            }}
          >
            {busy ? 'Menyimpan…' : 'Perpanjang'}
          </button>
        </>
      }
    >
      <div className="gx-chips">
        {LICENSE_TIERS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="gx-chip"
            aria-pressed={tierId === t.id}
            onClick={() => {
              setTierId(t.id);
              setAmount(t.price);
            }}
          >
            {t.short}
          </button>
        ))}
      </div>
      <div className="gx-note">
        <CalendarPlus size={16} />
        <span>
          Aktif s/d sekarang: <b>{user.expired_at ? new Date(user.expired_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Lifetime'}</b>
          <br />
          Setelah diperpanjang: <b>{newExp ? new Date(newExp).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Lifetime'}</b>
          {changed && (
            <>
              <br />
              Batas ikut paket baru: {tier.maxAccounts} akun · {tier.maxThreads} thread · {tier.deviceLimit} perangkat
            </>
          )}
        </span>
      </div>
      <label className="gx-switch">
        <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} />
        Catat sebagai pendapatan
      </label>
      {record && (
        <label className="gx-field">
          <span>Nominal diterima (Rp)</span>
          <input type="number" min={0} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="gx-mono" />
        </label>
      )}
    </Dialog>
  );
};

const RevenueDialog: React.FC<{
  users: User[];
  onClose: () => void;
  onSave: (e: Partial<RevenueEntry>) => Promise<void>;
}> = ({ users, onClose, onSave }) => {
  const [userId, setUserId] = useState('');
  const [freeName, setFreeName] = useState('');
  const [plan, setPlan] = useState<string>(LICENSE_TIERS[0].id);
  const [amount, setAmount] = useState(LICENSE_TIERS[0].price);
  const [type, setType] = useState<RevenueEntry['type']>('renewal');
  const [date, setDate] = useState(toLocalInput(new Date().toISOString()));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const user = users.find((u) => u.id === userId);
  return (
    <Dialog
      title="Catat pemasukan"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="gx-btn gx-btn--sm" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="gx-btn gx-btn--sm gx-btn--primary"
            disabled={busy || amount <= 0 || (!user && !freeName.trim())}
            onClick={async () => {
              setBusy(true);
              await onSave({
                user_id: user?.id || null,
                username: user?.username || freeName.trim(),
                plan: plan === 'none' ? null : plan,
                amount,
                type,
                method: 'QRIS',
                note: note.trim(),
                paid_at: fromLocalInput(date) || new Date().toISOString(),
              });
              setBusy(false);
            }}
          >
            Simpan
          </button>
        </>
      }
    >
      <label className="gx-field">
        <span>Pembeli</span>
        <select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">— Ketik manual —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username}
            </option>
          ))}
        </select>
      </label>
      {!userId && (
        <label className="gx-field">
          <span>Nama / username</span>
          <input value={freeName} onChange={(e) => setFreeName(e.target.value)} placeholder="misal: buyer dari Telegram" />
        </label>
      )}
      <div className="gx-formgrid gx-formgrid--2">
        <label className="gx-field">
          <span>Paket</span>
          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              const t = findTier(e.target.value);
              if (t) setAmount(t.price);
            }}
          >
            {LICENSE_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.short} ({t.priceRp})
              </option>
            ))}
            <option value="none">Lainnya</option>
          </select>
        </label>
        <label className="gx-field">
          <span>Jenis</span>
          <select value={type} onChange={(e) => setType(e.target.value as RevenueEntry['type'])}>
            <option value="new">Sewa baru</option>
            <option value="renewal">Perpanjangan</option>
            <option value="upgrade">Upgrade</option>
            <option value="manual">Lainnya</option>
          </select>
        </label>
        <label className="gx-field">
          <span>Nominal (Rp)</span>
          <input type="number" min={0} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="gx-mono" />
        </label>
        <label className="gx-field">
          <span>Tanggal bayar</span>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className="gx-field">
        <span>Catatan (opsional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="misal: diskon reseller" />
      </label>
    </Dialog>
  );
};

const AnnouncementDialog: React.FC<{
  initial: Partial<Announcement>;
  onClose: () => void;
  onSave: (a: Partial<Announcement>) => Promise<void>;
}> = ({ initial, onClose, onSave }) => {
  const [title, setTitle] = useState(initial.title || '');
  const [body, setBody] = useState(initial.body || '');
  const [type, setType] = useState<AnnouncementType>(initial.type || 'info');
  const [pinned, setPinned] = useState(!!initial.pinned);
  const [active, setActive] = useState(initial.is_active ?? true);
  const [ctaLabel, setCtaLabel] = useState(initial.cta_label || '');
  const [ctaUrl, setCtaUrl] = useState(initial.cta_url || '');
  const [startsAt, setStartsAt] = useState(toLocalInput(initial.starts_at));
  const [expiresAt, setExpiresAt] = useState(toLocalInput(initial.expires_at));
  const [busy, setBusy] = useState(false);
  const urlOk = !ctaUrl || /^https?:\/\//i.test(ctaUrl);

  const preview: Announcement = {
    id: 'preview',
    title: title || 'Judul pengumuman',
    body,
    type,
    pinned,
    is_active: active,
    cta_label: ctaLabel,
    cta_url: urlOk ? ctaUrl : '',
    created_at: initial.created_at || new Date().toISOString(),
  };

  return (
    <Dialog
      wide
      title={initial.id ? 'Edit pengumuman' : 'Pengumuman baru'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="gx-btn gx-btn--sm" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="gx-btn gx-btn--sm gx-btn--primary"
            disabled={busy || !title.trim() || !urlOk}
            onClick={async () => {
              setBusy(true);
              await onSave({
                title: title.trim(),
                body: body.trim(),
                type,
                pinned,
                is_active: active,
                cta_label: ctaLabel.trim(),
                cta_url: ctaUrl.trim(),
                starts_at: fromLocalInput(startsAt),
                expires_at: fromLocalInput(expiresAt),
              });
              setBusy(false);
            }}
          >
            {initial.id ? 'Simpan' : 'Terbitkan'}
          </button>
        </>
      }
    >
      <div className="gx-seg" role="group" aria-label="Jenis">
        {(Object.keys(ANNOUNCE_META) as AnnouncementType[]).map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
            {ANNOUNCE_META[t].label}
          </button>
        ))}
      </div>
      <label className="gx-field">
        <span>Judul</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="misal: Maintenance server 23:00–23:30 WIB" />
      </label>
      <label className="gx-field">
        <span>Isi</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} placeholder="Tulis detail pengumuman…" />
        <small>{body.length}/600</small>
      </label>
      <div className="gx-formgrid gx-formgrid--2">
        <label className="gx-field">
          <span>Tombol (opsional)</span>
          <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="misal: Gabung saluran" />
        </label>
        <label className="gx-field">
          <span>Link tombol</span>
          <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" />
          {!urlOk && <small style={{ color: 'var(--gx-bad)' }}>Link harus diawali https://</small>}
        </label>
        <label className="gx-field">
          <span>Mulai tayang (opsional)</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="gx-field">
          <span>Berakhir (opsional)</span>
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <label className="gx-switch">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Tayangkan
        </label>
        <label className="gx-switch">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Sematkan (tidak bisa ditutup)
        </label>
      </div>
      <div>
        <div className="gx-eyebrow" style={{ marginBottom: 6 }}>
          Pratinjau
        </div>
        <AnnouncementCard a={preview} />
      </div>
    </Dialog>
  );
};
