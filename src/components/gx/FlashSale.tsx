import React, { useCallback, useEffect, useState } from 'react';
import {
  Flame,
  RefreshCw,
  CircleAlert,
  ChevronRight,
  Crosshair,
  CalendarClock,
  Radio,
  ExternalLink,
  PackageCheck,
  Info,
} from 'lucide-react';
import { AseanCountryCode, TargetUrl } from '../../types/index.ts';
import { ASEAN_REGIONS, formatAseanCurrency } from '../../constants/asean.ts';
import { api } from '../../services/api.ts';
import { ServerClock, useTicker } from '../../lib/useServerClock.ts';
import { formatClock, getSessionSlots, pad, splitDuration } from '../../lib/time.ts';
import { isValidHttpUrl } from '../../lib/shopee.ts';
import { useLang } from '../../lib/i18n.tsx';

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
  const [tab, setTab] = useState<'schedule' | 'live'>('schedule');

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
          ? L(`${res.data.sessions.length} sesi dibaca dari Shopee · ${res.data.latency_ms} ms`, `${res.data.sessions.length} sessions read from Shopee · ${res.data.latency_ms} ms`)
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
      setItems(res.data.items || []);
      setBrowseUrl(res.data.browse_url || '');
      setItemsNote(res.data.ok ? '' : res.data.reason || L('Daftar produk tidak tersedia.', 'Product list unavailable.'));
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
        <div className="gx-seg" role="group" aria-label={L('Jenis flash sale', 'Flash sale type')}>
          <button type="button" aria-pressed={tab === 'schedule'} onClick={() => setTab('schedule')}>
            <CalendarClock size={14} /> {L('Jadwal & produk', 'Schedule & products')}
          </button>
          <button type="button" aria-pressed={tab === 'live'} onClick={() => setTab('live')}>
            <Radio size={14} /> {L('Shopee LIVE', 'Shopee LIVE')}
          </button>
        </div>

        {tab === 'schedule' ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="gx-btn gx-btn--sm gx-btn--primary" onClick={loadSessions} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'gx-spin' : ''} />
                {loading ? L('Mengecek…', 'Checking…') : checked ? L('Cek ulang', 'Check again') : L('Cek flash sale sekarang', 'Check flash sale now')}
              </button>
              {note && sessions.length > 0 && (
                <small className="gx-muted" style={{ flex: '1 1 160px' }}>
                  {note}
                </small>
              )}
            </div>

            {sessions.length > 0 ? (
              <ul className="gx-list">
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
                            <div className="gx-muted" style={{ fontSize: 12.5 }}>
                              <RefreshCw size={13} className="gx-spin" /> {L('Mengambil produk flash sale…', 'Fetching flash sale products…')}
                            </div>
                          ) : items.length > 0 ? (
                            <ul className="gx-list">
                              {items.map((it) => {
                                const active = selectedTargetUrl && it.url && selectedTargetUrl === it.url;
                                return (
                                  <li key={it.item_id} className="gx-row">
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
