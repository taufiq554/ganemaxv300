import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Flame,
  RefreshCw,
  CircleAlert,
  ImageOff,
  CalendarHeart,
  Wallet,
  ChevronRight,
  Crosshair,
  CalendarClock,
  Radio,
  ExternalLink,
  PackageCheck,
  Info,
  BellRing,
  CircleCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { AseanCountryCode, TargetUrl } from '../../types/index.ts';
import { ASEAN_REGIONS, formatAseanCurrency } from '../../constants/asean.ts';
import { api } from '../../services/api.ts';
import { ServerClock, useTicker } from '../../lib/useServerClock.ts';
import { formatClock, getSessionSlots, pad, splitDuration } from '../../lib/time.ts';
import { isValidHttpUrl } from '../../lib/shopee.ts';
import { useLang } from '../../lib/i18n.tsx';
import { upcomingCampaigns, isToday, Campaign } from '../../lib/campaigns.ts';
import { Ring, SkelList } from './Skeleton.tsx';
import { ProductThumb } from './ProductThumb.tsx';

type Session = { promotion_id: string; name: string; start_time: string; end_time: string | null; type: number };
type Item = {
  item_id: string;
  shop_id: string;
  name: string;
  url: string;
  price: number | null;
  price_before: number | null;
  discount: string;
  stock: number | null;
  sold: number | null;
  image?: string;
};

const Countdown: React.FC<{ clock: ServerClock; epoch: number }> = ({ clock, epoch }) => {
  useTicker(250);
  const d = splitDuration(epoch - clock.now());
  return (
    <span className="gx-mono">
      {pad(d.h)}:{pad(d.m)}:{pad(d.s)}
    </span>
  );
};

interface FlashSalePanelProps {
  region: AseanCountryCode;
  clock: ServerClock;
  armedEpoch: number | null;
  onArm: (a: { epoch: number; label: string }) => void;
  onDisarm: () => void;
  onQuickTarget: (data: Partial<TargetUrl>) => Promise<void>;
  selectedTargetUrl?: string;
  toast: (m: string) => void;
}

/**
 * Kampanye besar Shopee (tanggal kembar & Gajian Sale).
 *
 * Yang bisa dipastikan jauh hari hanya TANGGALNYA — Shopee tidak menerbitkan
 * daftar produk 12.12 berminggu-minggu sebelumnya. Jadi tab ini fokus ke yang
 * nyata: pasang auto-start dari sekarang, dan begitu hari-H tiba, produk asli
 * beserta fotonya diambil langsung dari Shopee.
 */
const MegaEvents: React.FC<{
  region: AseanCountryCode;
  clock: ServerClock;
  armedEpoch: number | null;
  onArm: (a: { epoch: number; label: string }) => void;
  onShowToday: () => void;
}> = ({ region, clock, armedEpoch, onArm, onShowToday }) => {
  const { L, locale } = useLang();
  useTicker(1000);
  const now = clock.now();
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const list = useMemo(() => upcomingCampaigns(region, now, 14).slice(0, 10), [region, Math.floor(now / 3_600_000)]);
  // Kartu utama: event kembar/mega terdekat (Gajian Sale tetap di daftar)
  const hero = list.find((c) => c.tier !== 'payday') || list[0];
  const flashUrl = `${reg.domain.startsWith('http') ? reg.domain : `https://${reg.domain}`}/flash_sale`;

  const sisa = (ms: number) => {
    if (ms <= 0) return L('sedang berlangsung', 'happening now');
    const hari = Math.floor(ms / 86_400_000);
    const jam = Math.floor((ms % 86_400_000) / 3_600_000);
    const menit = Math.floor((ms % 3_600_000) / 60_000);
    if (hari > 0) return L(`${hari} hari ${jam} jam lagi`, `in ${hari}d ${jam}h`);
    if (jam > 0) return L(`${jam} jam ${menit} menit lagi`, `in ${jam}h ${menit}m`);
    return L(`${menit} menit lagi`, `in ${menit}m`);
  };

  const two = (n: number) => String(Math.max(0, n)).padStart(2, '0');
  const parts = (ms: number) => {
    const t = Math.max(0, ms);
    return {
      d: Math.floor(t / 86_400_000),
      h: Math.floor((t % 86_400_000) / 3_600_000),
      m: Math.floor((t % 3_600_000) / 60_000),
      s: Math.floor((t % 60_000) / 1000),
    };
  };

  const arm = (c: Campaign) => {
    onArm({ epoch: c.startsAt, label: `00:00 · ${c.code}` });
  };

  const TIER_ICON = { mega: Flame, twin: CalendarHeart, payday: Wallet } as const;

  return (
    <>
      {hero && (() => {
        const ms = hero.startsAt - now;
        const today = isToday(hero, now);
        const p = parts(ms);
        const armed = armedEpoch === hero.startsAt;
        return (
          <div className={`gx-mega gx-mega--${hero.tier}`}>
            <div className="gx-mega__top">
              <span className="gx-mega__code" aria-hidden="true">
                {hero.code}
              </span>
              <div className="gx-mega__meta">
                <span className="gx-mega__eyebrow">{hero.tier === 'mega' ? L('Event terbesar berikutnya', 'Next mega event') : L('Event berikutnya', 'Next event')}</span>
                <b>{L(hero.nameId, hero.nameEn)}</b>
                <span>
                  {new Intl.DateTimeFormat(locale, { timeZone: reg.timezone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(hero.startsAt))} · 00:00 {reg.timezoneLabel}
                </span>
              </div>
            </div>

            {today ? (
              <div className="gx-mega__live">
                <span className="gx-led gx-led--pulse" /> {L('Sedang berlangsung hari ini', 'Happening today')}
              </div>
            ) : (
              <div className="gx-mega__count" role="timer" aria-label={sisa(ms)}>
                {[
                  [p.d, L('hari', 'days')],
                  [p.h, L('jam', 'hrs')],
                  [p.m, L('menit', 'min')],
                  [p.s, L('detik', 'sec')],
                ].map(([v, lbl]) => (
                  <div key={String(lbl)}>
                    <b>{two(v as number)}</b>
                    <small>{lbl}</small>
                  </div>
                ))}
              </div>
            )}

            <div className="gx-mega__actions">
              {today ? (
                <button type="button" className="gx-btn gx-btn--sm gx-mega__btn" onClick={onShowToday}>
                  <ImageIcon size={14} /> {L('Lihat produk & foto', 'See products & photos')}
                </button>
              ) : (
                <button type="button" className="gx-btn gx-btn--sm gx-mega__btn" onClick={() => arm(hero)} disabled={armed}>
                  <BellRing size={14} /> {armed ? L('Auto-start terpasang', 'Auto-start set') : L('Pasang auto-start 00:00', 'Set auto-start 00:00')}
                </button>
              )}
              <a className="gx-btn gx-btn--sm gx-mega__btn gx-mega__btn--ghost" href={flashUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> {L('Buka Shopee', 'Open Shopee')}
              </a>
            </div>
          </div>
        );
      })()}

      <div className="gx-note">
        <Info size={15} />
        <span>
          {L(
            'Tanggal kampanye ini tetap tiap tahun, jadi auto-start bisa dipasang dari sekarang. Daftar produk & fotonya baru diterbitkan Shopee pada hari-H — tombol "Lihat produk & foto" muncul otomatis saat harinya tiba.',
            'These campaign dates repeat every year, so you can set auto-start now. Shopee only publishes the product list & photos on the day — the "See products & photos" button appears automatically when the day arrives.'
          )}
        </span>
      </div>

      <ul className="gx-list gx-events gx-reveal">
        {list.map((c) => {
          const hariIni = isToday(c, now);
          const Icon = TIER_ICON[c.tier];
          const armed = armedEpoch === c.startsAt;
          return (
            <li key={c.id} className={`gx-row gx-event ${hariIni ? 'gx-event--now' : ''}`}>
              <span className={`gx-event__badge gx-event__badge--${c.tier}`}>
                <Icon size={15} />
              </span>
              <div className="gx-row__main">
                <div className="gx-row__t">
                  {L(c.nameId, c.nameEn)}
                  {c.tier === 'mega' && <span className="gx-tag gx-tag--flash" style={{ marginLeft: 6 }}>MEGA</span>}
                  {hariIni && <span className="gx-tag gx-tag--ok" style={{ marginLeft: 6 }}>{L('HARI INI', 'TODAY')}</span>}
                </div>
                <div className="gx-row__s">
                  {new Intl.DateTimeFormat(locale, { timeZone: reg.timezone, weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(c.startsAt))} · {sisa(c.startsAt - now)}
                </div>
              </div>
              {hariIni ? (
                <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={onShowToday}>
                  {L('Produk', 'Products')}
                </button>
              ) : (
                <button
                  type="button"
                  className={`gx-btn gx-btn--xs ${armed ? '' : 'gx-btn--ghost'}`}
                  onClick={() => arm(c)}
                  disabled={armed}
                  aria-label={L(`Pasang auto-start ${c.nameId}`, `Set auto-start for ${c.nameEn}`)}
                >
                  {armed ? <CircleCheck size={12} /> : <BellRing size={12} />} {armed ? L('Terpasang', 'Set') : L('Jadwalkan', 'Schedule')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <small className="gx-muted">
        {L(
          `Waktu mengikuti zona ${reg.timezoneLabel}. Gajian Sale jatuh tiap tanggal 25.`,
          `Times follow ${reg.timezoneLabel}. Payday Sale falls on the 25th of each month.`
        )}
      </small>
    </>
  );
};


export const FlashSalePanel: React.FC<FlashSalePanelProps> = ({
  region,
  clock,
  armedEpoch,
  onArm,
  onDisarm,
  onQuickTarget,
  selectedTargetUrl,
  toast,
}) => {
  const { L, locale } = useLang();
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const [tab, setTab] = useState<'schedule' | 'events' | 'live'>('schedule');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);

  const [openSession, setOpenSession] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsNote, setItemsNote] = useState('');
  const [browseUrl, setBrowseUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState<string | null>(null);

  // Live flash sale (jadwal diumumkan penjual, jadi waktunya diisi manual)
  const [liveUrl, setLiveUrl] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [liveTitle, setLiveTitle] = useState('');
  const [liveBusy, setLiveBusy] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setNote('');
    const res = await api.flashSessions(region);
    setLoading(false);
    setChecked(true);
    setOpenSession(null);
    setItems([]);
    if (res.success && res.data) {
      setSessions(res.data.sessions || []);
      setNote(
        res.data.ok
          ? (() => {
              // Latensi tidak selalu ada di respons — jangan sampai "undefined ms" tampil
              const lat = typeof res.data.latency_ms === 'number' && isFinite(res.data.latency_ms) ? ` · ${Math.round(res.data.latency_ms)} ms` : '';
              return L(`${res.data.sessions.length} sesi dibaca dari Shopee${lat}`, `${res.data.sessions.length} sessions read from Shopee${lat}`);
            })()
          : res.data.reason || L('Shopee tidak mengirim data sesi.', 'Shopee did not return session data.')
      );
    } else {
      setSessions([]);
      setNote(res.error?.message || L('Gagal menghubungi server bot.', 'Failed to reach the bot server.'));
    }
  }, [region, L]);

  useEffect(() => {
    setSessions([]);
    setChecked(false);
    setNote('');
    setOpenSession(null);
    setItems([]);
  }, [region]);

  const loadItems = async (s: Session) => {
    if (openSession === s.promotion_id) {
      setOpenSession(null);
      return;
    }
    setOpenSession(s.promotion_id);
    setItems([]);
    setItemsNote('');
    setBrowseUrl('');
    if (!s.promotion_id) {
      setItemsNote(L('Sesi ini tidak punya ID promo dari Shopee.', 'This session has no promo ID from Shopee.'));
      return;
    }
    setItemsLoading(true);
    const res = await api.flashItems(region, s.promotion_id, 16);
    setItemsLoading(false);
    if (res.success && res.data) {
      const list = res.data.items || [];
      setItems(list);
      setBrowseUrl(res.data.browse_url || '');
      setItemsNote(
        res.data.ok
          ? list.length > 0 && !list.some((i) => i.image)
            ? L('Shopee tidak mengirim foto untuk sesi ini — nama & harga tetap akurat.', 'Shopee sent no photos for this session — names & prices are still accurate.')
            : ''
          : res.data.reason || L('Daftar produk tidak tersedia.', 'Product list unavailable.')
      );
    } else {
      setItemsNote(res.error?.message || L('Gagal mengambil produk.', 'Failed to fetch products.'));
    }
  };

  const useAsTarget = async (it: Item) => {
    if (!it.url) {
      toast(L('Produk ini tidak punya link dari Shopee', 'This product has no link from Shopee'));
      return;
    }
    setSavingUrl(it.url);
    try {
      await onQuickTarget({
        title: it.name.slice(0, 120),
        url: it.url,
        region,
        currency: reg.currency,
        target_price: it.price ?? 0,
        ...(it.image ? { image_url: it.image } : {}),
      });
      toast(L('Target diperbarui dari flash sale', 'Target set from flash sale'));
    } catch (e: any) {
      toast(e?.message || L('Gagal menyimpan target', 'Failed to save target'));
    } finally {
      setSavingUrl(null);
    }
  };

  const armSession = (s: Session) => {
    const epoch = new Date(s.start_time).getTime();
    if (isNaN(epoch)) return;
    if (armedEpoch != null && Math.abs(armedEpoch - epoch) < 1000) {
      onDisarm();
      return;
    }
    onArm({ epoch, label: formatClock(epoch, reg.timezone).slice(0, 5) });
  };

  const now = clock.now();
  const standardSlots = getSessionSlots(now, reg.flashSaleSchedule, reg.timezone);

  const submitLive = async () => {
    if (!isValidHttpUrl(liveUrl)) {
      toast(L('Link harus diawali https://', 'Link must start with https://'));
      return;
    }
    const epoch = liveTime ? new Date(liveTime).getTime() : NaN;
    setLiveBusy(true);
    try {
      await onQuickTarget({
        title: (liveTitle.trim() || L('Flash sale LIVE Shopee', 'Shopee LIVE flash sale')).slice(0, 120),
        url: liveUrl.trim(),
        region,
        currency: reg.currency,
        target_price: 0,
      });
      if (!isNaN(epoch) && epoch > now + 3000) {
        onArm({ epoch, label: formatClock(epoch, reg.timezone).slice(0, 5) });
        toast(L('Target LIVE disimpan & auto-start dipasang', 'LIVE target saved & auto-start armed'));
      } else {
        toast(L('Target LIVE disimpan. Isi waktu untuk auto-start.', 'LIVE target saved. Set a time to auto-start.'));
      }
      setLiveUrl('');
      setLiveTime('');
      setLiveTitle('');
    } catch (e: any) {
      toast(e?.message || L('Gagal menyimpan target', 'Failed to save target'));
    } finally {
      setLiveBusy(false);
    }
  };

  return (
    <section className="gx-card">
      <div className="gx-card__head">
        <h2 className="gx-card__title">
          <Flame size={16} /> {L('Flash Sale Shopee', 'Shopee Flash Sale')}
        </h2>
        <div className="gx-card__aside">
          <span className="gx-tag">{reg.name}</span>
        </div>
      </div>
      <div className="gx-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="gx-seg gx-seg--3" role="group" aria-label={L('Jenis flash sale', 'Flash sale type')}>
          <button type="button" aria-pressed={tab === 'schedule'} onClick={() => setTab('schedule')}>
            <CalendarClock size={14} /> {L('Jadwal & produk', 'Schedule & products')}
          </button>
          <button type="button" aria-pressed={tab === 'events'} onClick={() => setTab('events')}>
            <CalendarHeart size={14} /> {L('Event besar', 'Mega events')}
          </button>
          <button type="button" aria-pressed={tab === 'live'} onClick={() => setTab('live')}>
            <Radio size={14} /> {L('Shopee LIVE', 'Shopee LIVE')}
          </button>
        </div>

        {tab === 'events' ? (
          <MegaEvents
            region={region}
            clock={clock}
            armedEpoch={armedEpoch}
            onArm={(a) => {
              onArm(a);
              toast(L(`Auto-start ${a.label} dipasang`, `Auto-start ${a.label} set`));
            }}
            onShowToday={() => {
              setTab('schedule');
              loadSessions();
            }}
          />
        ) : tab === 'schedule' ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="gx-btn gx-btn--sm gx-btn--primary" onClick={loadSessions} disabled={loading}>
                {loading ? <Ring size={14} /> : <RefreshCw size={14} />}
                {loading ? L('Mengecek…', 'Checking…') : checked ? L('Cek ulang', 'Check again') : L('Cek flash sale sekarang', 'Check flash sale now')}
              </button>
              {note && sessions.length > 0 && (
                <small className="gx-muted" style={{ flex: '1 1 160px' }}>
                  {note}
                </small>
              )}
            </div>

            {loading && sessions.length === 0 ? (
              <SkelList rows={3} thumb action label={L('Membaca jadwal flash sale dari Shopee', 'Reading flash sale schedule from Shopee')} />
            ) : sessions.length > 0 ? (
              <ul className="gx-list gx-reveal">
                {sessions.map((s) => {
                  const epoch = new Date(s.start_time).getTime();
                  const end = s.end_time ? new Date(s.end_time).getTime() : epoch + 2 * 3600 * 1000;
                  const live = now >= epoch && now < end;
                  const past = now >= end;
                  const armedHere = armedEpoch != null && Math.abs(armedEpoch - epoch) < 1000;
                  const isOpen = openSession === s.promotion_id;
                  return (
                    <li key={s.promotion_id || s.start_time} style={{ borderTop: '1px solid var(--gx-line)' }}>
                      <div className="gx-row" style={{ borderTop: 0 }}>
                        <span className="gx-check__icon" style={live ? { background: 'var(--gx-flash-soft)', color: 'var(--gx-flash)' } : undefined}>
                          <Flame size={14} />
                        </span>
                        <div className="gx-row__main">
                          <div className="gx-row__t">
                            {formatClock(epoch, reg.timezone).slice(0, 5)} {reg.timezoneLabel.split(' ')[0]}
                            {live && <span className="gx-tag gx-tag--flash" style={{ marginLeft: 6, height: 18, fontSize: 10 }}>LIVE</span>}
                            {armedHere && <span className="gx-tag gx-tag--brand" style={{ marginLeft: 6, height: 18, fontSize: 10 }}>AUTO</span>}
                          </div>
                          <div className="gx-row__s">
                            {new Date(epoch).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: reg.timezone })}
                            {' · '}
                            {past ? L('selesai', 'ended') : live ? L('sedang berlangsung', 'ongoing') : <>{L('mulai dalam', 'starts in')} <Countdown clock={clock} epoch={epoch} /></>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button type="button" className="gx-btn gx-btn--xs" onClick={() => loadItems(s)}>
                            {isOpen ? L('Tutup', 'Close') : L('Produk', 'Products')}
                          </button>
                          {!past && (
                            <button type="button" className={`gx-btn gx-btn--xs ${armedHere ? 'gx-btn--primary' : ''}`} onClick={() => armSession(s)} disabled={live}>
                              {armedHere ? L('Batal', 'Cancel') : 'Auto'}
                            </button>
                          )}
                        </div>
                      </div>

                      {isOpen && (
                        <div style={{ padding: '0 0 12px 36px' }}>
                          {itemsLoading ? (
                            <SkelList rows={4} thumb action label={L('Mengambil produk flash sale', 'Fetching flash sale products')} />
                          ) : items.length > 0 ? (
                            <ul className="gx-list gx-reveal">
                              {items.map((it) => {
                                const active = selectedTargetUrl && it.url && selectedTargetUrl === it.url;
                                return (
                                  <li key={it.item_id} className="gx-row gx-row--thumb">
                                    <ProductThumb src={it.image} alt={it.name} />
                                    <div className="gx-row__main">
                                      <div className="gx-row__t" style={{ whiteSpace: 'normal' }}>{it.name}</div>
                                      <div className="gx-row__s">
                                        <b style={{ color: 'var(--gx-flash)' }}>{it.price != null ? formatAseanCurrency(it.price, region) : '-'}</b>
                                        {it.price_before != null && it.price != null && it.price_before > it.price && (
                                          <s style={{ marginLeft: 6 }}>{formatAseanCurrency(it.price_before, region)}</s>
                                        )}
                                        {it.discount ? ` · ${it.discount}` : ''}
                                        {it.stock != null ? ` · ${L('stok', 'stock')} ${it.stock}` : ''}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                      {it.url && (
                                        <a className="gx-iconbtn" style={{ width: 30, height: 30 }} href={it.url} target="_blank" rel="noopener noreferrer" aria-label={L('Buka di Shopee', 'Open in Shopee')}>
                                          <ExternalLink size={13} />
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        className={`gx-btn gx-btn--xs ${active ? '' : 'gx-btn--primary'}`}
                                        onClick={() => useAsTarget(it)}
                                        disabled={savingUrl === it.url || !!active}
                                      >
                                        {active ? <PackageCheck size={12} /> : <Crosshair size={12} />}
                                        {active ? L('Target aktif', 'Active target') : savingUrl === it.url ? L('Menyimpan…', 'Saving…') : L('Jadikan target', 'Set target')}
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <div className="gx-note gx-note--warn" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                              <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <CircleAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>
                                  <b style={{ display: 'block', marginBottom: 2 }}>
                                    {itemsNote || L('Produk tidak tersedia untuk sesi ini.', 'No products available for this session.')}
                                  </b>
                                  {L(
                                    'Daftar produk sesi ini hanya bisa dibuka langsung di Shopee. Buka halamannya, salin link produk incaranmu, lalu tempel di "Target produk".',
                                    'This session\'s product list can only be opened in Shopee. Open the page, copy your product link, then paste it into "Target products".'
                                  )}
                                </span>
                              </span>
                              {browseUrl && (
                                <a className="gx-btn gx-btn--xs gx-btn--primary" style={{ alignSelf: 'flex-start' }} href={browseUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink size={12} /> {L('Buka flash sale di Shopee', 'Open flash sale in Shopee')}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                {checked && (
                  <div className="gx-note gx-note--warn">
                    <CircleAlert size={15} />
                    <span>
                      <b style={{ display: 'block', marginBottom: 2 }}>{note}</b>
                      {L(
                        'Biasanya karena permintaan otomatis ditolak. Pakai jadwal sesi standar di bawah, atau tempel link produk di "Target produk" lalu tekan "Hubungkan".',
                        'Usually the automated request was blocked. Use the standard sessions below, or paste a product link in "Target products" and press "Integrate".'
                      )}
                    </span>
                  </div>
                )}
                <div>
                  <div className="gx-eyebrow" style={{ marginBottom: 8 }}>
                    {L(`Jadwal sesi standar Shopee ${reg.name}`, `Standard Shopee ${reg.name} sessions`)}
                  </div>
                  <div className="gx-chips">
                    {standardSlots.map((sl) => {
                      const armedHere = armedEpoch != null && Math.abs(armedEpoch - sl.epoch) < 1000;
                      return (
                        <button
                          key={sl.label}
                          type="button"
                          className="gx-chip"
                          aria-pressed={armedHere}
                          disabled={sl.status === 'past' || sl.status === 'live'}
                          onClick={() => (armedHere ? onDisarm() : onArm({ epoch: sl.epoch, label: sl.label }))}
                        >
                          {sl.label}
                          {sl.status === 'live' ? ' · LIVE' : armedHere ? ' · AUTO' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="gx-note">
              <Info size={15} />
              <span>
                {L(
                  'Flash sale di Shopee LIVE jadwalnya diumumkan penjual saat siaran, tidak ada di jadwal resmi. Tempel link siaran/produknya dan isi jam mulai — bot akan membukanya tepat waktu.',
                  'Shopee LIVE flash sales are announced by the seller during the stream and are not in the official schedule. Paste the stream/product link and set the start time — the bot will open it right on time.'
                )}
              </span>
            </div>
            <label className="gx-field">
              <span>{L('Link siaran LIVE / produk', 'LIVE stream / product link')}</span>
              <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder={`https://live.${reg.domain.replace('https://', '')}/...`} inputMode="url" />
            </label>
            <div className="gx-formgrid gx-formgrid--2">
              <label className="gx-field">
                <span>{L('Nama (opsional)', 'Name (optional)')}</span>
                <input value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} placeholder={L('Flash sale LIVE toko A', 'Store A LIVE flash sale')} />
              </label>
              <label className="gx-field">
                <span>{L('Jam mulai (opsional)', 'Start time (optional)')}</span>
                <input type="datetime-local" value={liveTime} onChange={(e) => setLiveTime(e.target.value)} />
              </label>
            </div>
            <button type="button" className="gx-btn gx-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={submitLive} disabled={liveBusy || !liveUrl}>
              <Radio size={15} /> {liveBusy ? L('Menyimpan…', 'Saving…') : L('Simpan & pasang auto-start', 'Save & arm auto-start')}
            </button>
            <small className="gx-muted">
              {L('Target LIVE tersimpan di daftar target biasa, jadi bisa dipakai ulang kapan saja.', 'The LIVE target is saved in your normal target list, so you can reuse it anytime.')}
            </small>
          </>
        )}

        <div className="gx-muted" style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChevronRight size={12} /> {L('Data jadwal & produk diambil langsung dari Shopee lewat server GaneMaX.', 'Schedule & product data is fetched directly from Shopee via the GaneMaX server.')}
        </div>
      </div>
    </section>
  );
};
