import React, { useEffect, useState } from 'react';
import { Crosshair, Globe, Plus, Pencil, Trash2, Save, Zap, Square, Send, BellRing, Timer, Info, Link2 } from 'lucide-react';
import { User, TargetUrl, ShopeePayment, BotSettings, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES, formatAseanCurrency } from '../constants/asean.ts';
import { AseanFlag } from './AseanFlag.tsx';
import { api } from '../services/api.ts';
import { parseShopeeLink, isValidHttpUrl, isAndroid } from '../lib/shopee.ts';

interface ControlPanelProps {
  section: 'setup' | 'engine';
  currentUser: User | null;
  targetUrls: TargetUrl[];
  paymentSettings: ShopeePayment | null;
  botSettings: BotSettings;
  isBotRunning: boolean;
  selectedRegion?: AseanCountryCode;
  onSelectRegion?: (code: AseanCountryCode) => void;
  onStartBot: () => void;
  onStopBot: () => void;
  onUpdatePayment: (data: Partial<ShopeePayment>) => Promise<void>;
  onUpdateSettings: (settings: BotSettings) => void;
  onOpenTargetUrlModal: (target?: TargetUrl) => void;
  onDeleteTargetUrl: (id: string) => Promise<void>;
  selectedTargetId: string;
  onSelectTarget: (id: string) => void;
  onRequestNotification: () => void;
}

const Card: React.FC<{ icon: React.ReactNode; title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({ icon, title, aside, children }) => (
  <section className="gx-card">
    <div className="gx-card__head">
      <h2 className="gx-card__title">
        {icon} {title}
      </h2>
      {aside && <div className="gx-card__aside">{aside}</div>}
    </div>
    <div className="gx-card__body">{children}</div>
  </section>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({
  section,
  targetUrls,
  paymentSettings,
  botSettings,
  isBotRunning,
  selectedRegion = 'ID',
  onSelectRegion,
  onStartBot,
  onStopBot,
  onUpdatePayment,
  onUpdateSettings,
  onOpenTargetUrlModal,
  onDeleteTargetUrl,
  selectedTargetId,
  onSelectTarget,
  onRequestNotification,
}) => {
  const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;

  // Telegram (disinkronkan saat data dari server datang)
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tgTest, setTgTest] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');
  useEffect(() => {
    setTgToken(paymentSettings?.telegram_token || '');
    setTgChatId(paymentSettings?.telegram_chat_id || '');
  }, [paymentSettings]);

  const saveTelegram = async () => {
    setSaving(true);
    await onUpdatePayment({ telegram_token: tgToken.trim(), telegram_chat_id: tgChatId.trim() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const testTelegram = async () => {
    setTgTest('sending');
    const ok = await api.testTelegram(tgToken.trim(), tgChatId.trim(), '✅ Notifikasi GaneMaX.Ai terhubung. Hasil war flash sale akan dikirim ke sini.');
    setTgTest(ok ? 'ok' : 'fail');
    setTimeout(() => setTgTest('idle'), 3000);
  };

  const actionBar = (
    <div style={{ display: 'flex', gap: 10 }}>
      {isBotRunning ? (
        <button type="button" className="gx-btn gx-btn--lg gx-btn--danger gx-btn--block" onClick={onStopBot}>
          <Square size={16} fill="currentColor" /> Hentikan sesi
        </button>
      ) : (
        <button type="button" className="gx-btn gx-btn--lg gx-btn--primary gx-btn--block" onClick={onStartBot}>
          <Zap size={18} fill="currentColor" /> Cek & buka Shopee sekarang
        </button>
      )}
    </div>
  );

  if (section === 'setup') {
    return (
      <div className="gx-grid gx-grid--2" style={{ alignItems: 'start' }}>
        <div className="gx-col">
          <Card
            icon={<Crosshair size={16} />}
            title={`Target produk (${targetUrls.length})`}
            aside={
              <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => onOpenTargetUrlModal()}>
                <Plus size={13} /> Tambah
              </button>
            }
          >
            {targetUrls.length === 0 ? (
              <div className="gx-empty">Belum ada target. Salin link produk dari app Shopee (Bagikan → Salin link) lalu tambahkan di sini.</div>
            ) : (
              <ul className="gx-list" role="radiogroup" aria-label="Target aktif">
                {targetUrls.map((t) => {
                  const active = t.id === selectedTargetId;
                  const ids = parseShopeeLink(t.url);
                  const valid = isValidHttpUrl(t.url);
                  return (
                    <li key={t.id} className="gx-row">
                      <input
                        type="radio"
                        name="active-target"
                        checked={active}
                        onChange={() => onSelectTarget(t.id)}
                        aria-label={`Jadikan ${t.title} target aktif`}
                        style={{ accentColor: 'var(--gx-brand)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <div className="gx-row__main" onClick={() => onSelectTarget(t.id)} style={{ cursor: 'pointer' }}>
                        <div className="gx-row__t">{t.title}</div>
                        <div className="gx-row__s">
                          <span style={{ color: 'var(--gx-brand)', fontWeight: 700 }}>
                            {formatAseanCurrency(Number(t.target_price) || 0, ((t.region as AseanCountryCode) || selectedRegion) as AseanCountryCode)}
                          </span>
                          {' · '}
                          <span style={{ color: valid ? (ids ? 'var(--gx-ok)' : 'var(--gx-warn)') : 'var(--gx-bad)' }}>
                            {valid ? (ids ? 'link valid' : 'link pendek') : 'link tidak valid'}
                          </span>
                          {active ? ' · aktif' : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button type="button" className="gx-iconbtn" style={{ width: 32, height: 32 }} onClick={() => onOpenTargetUrlModal(t)} aria-label={`Edit ${t.title}`}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="gx-iconbtn" style={{ width: 32, height: 32 }} onClick={() => onDeleteTargetUrl(t.id)} aria-label={`Hapus ${t.title}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card icon={<Info size={16} />} title="Cara kerja bot">
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--gx-ink-2)', lineHeight: 1.5 }}>
              <li>Login akun Shopee kamu di app Shopee HP ini, isi alamat & saldo/pembayaran di sana.</li>
              <li>Tambah target produk di atas, lalu di Beranda pilih jam sesi dan tekan <b>Auto</b>.</li>
              <li>Bot sinkron jam ke server, cek gateway & data produk, lalu menghitung mundur sampai milidetik.</li>
              <li>Tepat sebelum detik 0, bot membuka produk di Shopee. Kamu tinggal tap <b>Beli Sekarang</b> & bayar.</li>
              <li>Laporkan hasilnya supaya tercatat di riwayat & Telegram.</li>
            </ol>
          </Card>
        </div>

        <div className="gx-col">
          <Card icon={<Send size={16} />} title="Notifikasi Telegram (opsional)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="gx-formgrid gx-formgrid--2">
                <label className="gx-field">
                  <span>Bot token</span>
                  <input value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456:ABC…" autoComplete="off" />
                </label>
                <label className="gx-field">
                  <span>Chat ID</span>
                  <input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="987654321" inputMode="numeric" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="gx-btn gx-btn--primary" onClick={saveTelegram} disabled={saving}>
                  <Save size={15} /> {saving ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Simpan'}
                </button>
                <button type="button" className="gx-btn" onClick={testTelegram} disabled={!tgToken || !tgChatId || tgTest === 'sending'}>
                  <Send size={14} />
                  {tgTest === 'sending' ? 'Mengirim…' : tgTest === 'ok' ? 'Terkirim' : tgTest === 'fail' ? 'Gagal — cek token' : 'Tes kirim'}
                </button>
              </div>
            </div>
          </Card>
          {actionBar}
        </div>
      </div>
    );
  }

  // section === 'engine'
  const lead = Number(botSettings.openLeadMs ?? 800);
  return (
    <div className="gx-grid gx-grid--2" style={{ alignItems: 'start' }}>
      <div className="gx-col">
        <Card icon={<Globe size={16} />} title="Wilayah Shopee">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="gx-chips">
              {ALL_ASEAN_CODES.map((code) => (
                <button key={code} type="button" className="gx-chip" aria-pressed={selectedRegion === code} onClick={() => onSelectRegion?.(code)}>
                  <AseanFlag code={code} size="xs" />
                  {ASEAN_REGIONS[code].name}
                </button>
              ))}
            </div>
            <div className="gx-metrics">
              <div className="gx-metric">
                <div className="gx-metric__k">Domain</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.domain}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Mata uang</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.currency}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Zona waktu</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.timezoneLabel}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Sesi flash sale</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.flashSaleSchedule.join(' · ')}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="gx-col">
        <Card icon={<Timer size={16} />} title="Pengaturan war">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="gx-field">
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                Buka Shopee lebih awal <b className="gx-mono">{lead} ms</b>
              </span>
              <input
                type="range"
                min={0}
                max={3000}
                step={100}
                value={lead}
                onChange={(e) => onUpdateSettings({ ...botSettings, openLeadMs: Number(e.target.value) })}
                style={{ accentColor: 'var(--gx-brand)', minHeight: 0, padding: 0, border: 0 }}
              />
              <small>App Shopee butuh waktu ±0,5–1,5 dtk untuk terbuka. Atur supaya halaman produk muncul pas detik 0.</small>
            </label>
            <label className="gx-field">
              <span>Cara membuka</span>
              <select value={botSettings.openMode || 'app'} onChange={(e) => onUpdateSettings({ ...botSettings, openMode: e.target.value as 'app' | 'browser' })}>
                <option value="app">App Shopee {isAndroid() ? '(langsung masuk app)' : ''}</option>
                <option value="browser">Browser (tab baru)</option>
              </select>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="gx-switch">
                <input type="checkbox" checked={botSettings.soundAlert !== false} onChange={(e) => onUpdateSettings({ ...botSettings, soundAlert: e.target.checked })} />
                Bunyi beep T-3, T-2, T-1 & detik 0
              </label>
              <label className="gx-switch">
                <input type="checkbox" checked={botSettings.vibrateAlert !== false} onChange={(e) => onUpdateSettings({ ...botSettings, vibrateAlert: e.target.checked })} />
                Getar saat detik 0
              </label>
            </div>
            <button type="button" className="gx-btn gx-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={onRequestNotification}>
              <BellRing size={14} /> Izinkan notifikasi browser
            </button>
            <div className="gx-note">
              <Link2 size={15} />
              <span>Login akun Shopee, alamat, dan pembayaran diatur langsung di app Shopee kamu — bot tidak menyimpan password atau PIN.</span>
            </div>
          </div>
        </Card>
        {actionBar}
      </div>
    </div>
  );
};
