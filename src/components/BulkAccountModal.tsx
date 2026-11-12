import React, { useEffect, useMemo, useState } from 'react';
import { X, FileUp, Check, CircleAlert } from 'lucide-react';
import { ShopeeAccount, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES, isAseanCode } from '../constants/asean.ts';
import { useLang } from '../lib/i18n.tsx';

interface BulkAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBulk: (accounts: Partial<ShopeeAccount>[]) => Promise<void>;
  defaultRegion?: AseanCountryCode;
}

interface ParsedAccount {
  nickname: string;
  username: string;
  password?: string;
  pin?: string;
  region: AseanCountryCode;
  cookies?: string;
  isValid: boolean;
  note: string;
}

export const BulkAccountModal: React.FC<BulkAccountModalProps> = ({ isOpen, onClose, onSaveBulk, defaultRegion = 'ID' }) => {
  const { L } = useLang();
  const [rawText, setRawText] = useState('');
  const [targetRegion, setTargetRegion] = useState<AseanCountryCode>(defaultRegion);
  const [mode, setMode] = useState<'pipe' | 'cookies'>('pipe');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRawText('');
      setError(null);
      setTargetRegion(defaultRegion);
    }
  }, [isOpen, defaultRegion]);

  const parsed = useMemo<ParsedAccount[]>(() => {
    if (!rawText.trim()) return [];
    const out: ParsedAccount[] = [];
    for (const raw of rawText.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      if (mode === 'pipe') {
        const parts = (line.includes('|') ? line.split('|') : line.split(',')).map((x) => x.trim());
        const [u = '', pw = '', pin = '', rRaw = ''] = parts;
        const r = isAseanCode(rRaw.toUpperCase()) ? (rRaw.toUpperCase() as AseanCountryCode) : targetRegion;
        let note = L('Siap diimpor', 'Ready');
        let ok = true;
        if (u.length < 3 || pw.length < 4) {
          ok = false;
          note = L('Username min. 3, password min. 4 karakter', 'Username min 3, password min 4 chars');
        } else if (pin && !/^\d{6}$/.test(pin)) {
          ok = false;
          note = L('PIN harus 6 digit', 'PIN must be 6 digits');
        }
        out.push({ nickname: u, username: u, password: pw, pin: pin || undefined, region: r, isValid: ok, note });
      } else {
        let u = `shopee_${out.length + 1}`;
        let cookies = line;
        if (line.includes(';') && !line.startsWith('SPC_')) {
          const i = line.indexOf(';');
          u = line.slice(0, i).trim();
          cookies = line.slice(i + 1).trim();
        }
        const ok = /SPC_(EC|U|ST)=/.test(cookies);
        out.push({ nickname: u, username: u, region: targetRegion, cookies, isValid: ok, note: ok ? L('Cookie sesi terdeteksi', 'Session cookie detected') : L('Cookie belum lengkap', 'Incomplete cookie') });
      }
    }
    return out;
  }, [rawText, mode, targetRegion, L]);

  const valid = parsed.filter((a) => a.isValid);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const template = () =>
    setRawText(
      mode === 'pipe'
        ? `# ${L('Format', 'Format')}: username|password|pin_shopeepay|${L('wilayah', 'region')}\nakun_war_01|PasswordKamu1|123456|ID\nakun_war_02|PasswordKamu2||MY`
        : `# ${L('Satu baris per akun', 'One line per account')}: username; cookies\nakun_war_01; SPC_EC=...; SPC_U=...; SPC_ST=...`
    );

  const submit = async () => {
    if (!valid.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSaveBulk(
        valid.map((a) => ({
          nickname: a.nickname,
          username: a.username,
          password: a.password || '',
          pin: a.pin || '',
          region: a.region,
          cookies: a.cookies || '',
        }))
      );
      onClose();
    } catch (e: any) {
      setError(e?.message || L('Impor gagal.', 'Import failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gx-overlay gx-overlay--center" onClick={() => !busy && onClose()}>
      <div className="gx-dialog" style={{ width: 'min(640px, 100%)' }} role="dialog" aria-modal="true" aria-label={L('Impor akun massal', 'Bulk import accounts')} onClick={(e) => e.stopPropagation()}>
        <div className="gx-dialog__head">
          <span className="gx-qa__icon" style={{ width: 34, height: 34, borderRadius: 11 }}>
            <FileUp size={17} />
          </span>
          <h3>{L('Impor akun massal', 'Bulk import accounts')}</h3>
          <button type="button" className="gx-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose} disabled={busy} aria-label={L('Tutup', 'Close')}>
            <X size={16} />
          </button>
        </div>
        <div className="gx-dialog__body">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="gx-seg" role="group">
              <button type="button" aria-pressed={mode === 'pipe'} onClick={() => setMode('pipe')}>
                username|password|PIN
              </button>
              <button type="button" aria-pressed={mode === 'cookies'} onClick={() => setMode('cookies')}>
                Cookies
              </button>
            </div>
            <select className="gx-select" style={{ width: 'auto' }} value={targetRegion} onChange={(e) => setTargetRegion(isAseanCode(e.target.value) ? e.target.value : 'ID')} aria-label={L('Wilayah default', 'Default region')}>
              {ALL_ASEAN_CODES.map((c) => (
                <option key={c} value={c}>
                  {ASEAN_REGIONS[c].name}
                </option>
              ))}
            </select>
            <button type="button" className="gx-link" onClick={template}>
              {L('Isi contoh format', 'Insert sample format')}
            </button>
          </div>
          <label className="gx-field">
            <span>{L('Tempel daftar akun (satu per baris)', 'Paste accounts (one per line)')}</span>
            <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} style={{ minHeight: 150, fontFamily: 'var(--gx-mono)', fontSize: 12 }} spellCheck={false} />
          </label>
          {parsed.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--gx-line)', borderRadius: 12, padding: '0 12px' }}>
              <ul className="gx-list">
                {parsed.map((a, i) => (
                  <li key={i} className="gx-row" style={{ padding: '8px 0' }}>
                    {a.isValid ? <Check size={15} color="var(--gx-ok)" /> : <CircleAlert size={15} color="var(--gx-bad)" />}
                    <div className="gx-row__main">
                      <div className="gx-row__t" style={{ fontSize: 12.5 }}>
                        {a.username} <span className="gx-muted">· {a.region}</span>
                        {a.pin ? <span className="gx-muted"> · PIN ✓</span> : null}
                      </div>
                      <div className="gx-row__s">{a.note}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <div className="gx-note gx-note--bad">{error}</div>}
        </div>
        <div className="gx-dialog__foot">
          <span className="gx-muted" style={{ fontSize: 12, marginRight: 'auto', alignSelf: 'center' }}>
            {valid.length}/{parsed.length} {L('valid', 'valid')}
          </span>
          <button type="button" className="gx-btn gx-btn--sm" onClick={onClose} disabled={busy}>
            {L('Batal', 'Cancel')}
          </button>
          <button type="button" className="gx-btn gx-btn--sm gx-btn--primary" onClick={submit} disabled={busy || !valid.length}>
            {busy ? L('Mengimpor…', 'Importing…') : L(`Impor ${valid.length} akun`, `Import ${valid.length} accounts`)}
          </button>
        </div>
      </div>
    </div>
  );
};
