import React, { useState } from 'react';
import { ShopeeAccount, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES } from '../constants/asean.ts';

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
  note?: string;
}

export const BulkAccountModal: React.FC<BulkAccountModalProps> = ({
  isOpen,
  onClose,
  onSaveBulk,
  defaultRegion = 'ID',
}) => {
  const [rawText, setRawText] = useState('');
  const [targetRegion, setTargetRegion] = useState<AseanCountryCode>(defaultRegion);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputMode, setInputMode] = useState<'pipe' | 'cookies'>('pipe');

  if (!isOpen) return null;

  const handleInsertTemplate = () => {
    if (inputMode === 'pipe') {
      setRawText(
        `# Format: username|password|pin_shopeepay|wilayah\n` +
        `user_flashsale_01|RahasiaShopee123!|123456|ID\n` +
        `buyer_turbo_id|AkunJuara999#|888999|ID\n` +
        `sniper_asean_sg|PasswordSg2026@|112233|SG\n` +
        `shopee_hunter_my|KuponFlashMY#1|556677|MY`
      );
    } else {
      setRawText(
        `# Paste Cookie Shopee (satu baris per akun atau JSON session)\n` +
        `username_acc1; SPC_EC=abc123456789xyz; SPC_U=10928374; SPC_T_ID=def456\n` +
        `username_acc2; SPC_EC=987654321cba; SPC_U=20394857; SPC_T_ID=fed654`
      );
    }
  };

  // Parse lines into account records
  const parseAccounts = (): ParsedAccount[] => {
    if (!rawText.trim()) return [];
    const lines = rawText.split('\n');
    const results: ParsedAccount[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      if (inputMode === 'pipe') {
        // Formats: username|pass|pin|region or user,pass,pin,region
        const parts = line.includes('|') ? line.split('|') : line.split(',');
        const u = (parts[0] || '').trim();
        const p = (parts[1] || '').trim();
        const pin = (parts[2] || '').trim();
        const rRaw = (parts[3] || '').trim().toUpperCase();

        const r: AseanCountryCode = (ALL_ASEAN_CODES.includes(rRaw as AseanCountryCode)
          ? (rRaw as AseanCountryCode)
          : targetRegion);

        const isValid = u.length >= 3 && p.length >= 4;
        results.push({
          nickname: u,
          username: u,
          password: p,
          pin: pin || undefined,
          region: r,
          isValid,
          note: !isValid ? 'Username min 3 char, password min 4' : 'Siap diimpor',
        });
      } else {
        // Cookie mode
        let u = `shopee_user_${results.length + 1}`;
        let cookies = line;
        if (line.includes(';') && !line.startsWith('SPC_')) {
          const firstSemi = line.indexOf(';');
          u = line.substring(0, firstSemi).trim();
          cookies = line.substring(firstSemi + 1).trim();
        }
        const isValid = cookies.includes('SPC_') || cookies.length > 20;
        results.push({
          nickname: u,
          username: u,
          region: targetRegion,
          cookies,
          isValid,
          note: isValid ? 'Session Cookie terdeteksi' : 'Format cookie tidak lengkap',
        });
      }
    }
    return results;
  };

  const parsedList = parseAccounts();
  const validList = parsedList.filter((a) => a.isValid);

  const handleExecuteImport = async () => {
    if (validList.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload: Partial<ShopeeAccount>[] = validList.map((item) => ({
        nickname: item.nickname,
        username: item.username,
        password: item.password || '',
        region: item.region,
        cookies: item.cookies || '',
      }));

      await onSaveBulk(payload);
      onClose();
    } catch (err) {
      console.error('Bulk import error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal active">
      <div className="modal-content" style={{ maxWidth: '720px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-file-import text-blue-600"></i>
            <span>Bulk Import Akun Shopee (Multi-Akun Massal)</span>
          </div>
          <button className="close-btn" onClick={onClose} disabled={isSubmitting}>
            &times;
          </button>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Mode Format:</span>
              <button
                type="button"
                className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                  inputMode === 'pipe'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
                onClick={() => setInputMode('pipe')}
              >
                <i className="fa-solid fa-list-check mr-1"></i> Username | Password | PIN
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                  inputMode === 'cookies'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
                onClick={() => setInputMode('cookies')}
              >
                <i className="fa-solid fa-cookie-bite mr-1"></i> Cookie Session (SPC_EC)
              </button>
            </div>

            <button
              type="button"
              onClick={handleInsertTemplate}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <i className="fa-regular fa-lightbulb"></i> Sisipkan Contoh
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <label className="font-semibold">Wilayah Default:</label>
              <select
                value={targetRegion}
                onChange={(e) => setTargetRegion(e.target.value as AseanCountryCode)}
                className="p-1 border border-slate-300 rounded text-xs bg-white font-medium"
              >
                {ALL_ASEAN_CODES.map((code) => {
                  const reg = ASEAN_REGIONS[code];
                  return (
                    <option key={code} value={code}>
                      [{reg.code}] {reg.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <label className="cursor-pointer text-blue-600 hover:underline flex items-center gap-1 font-semibold">
              <i className="fa-solid fa-upload"></i> Unggah File .txt / .csv
              <input type="file" accept=".txt,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="p-4">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Tempelkan Daftar Akun (1 baris per akun):
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={7}
            placeholder={
              inputMode === 'pipe'
                ? `user1|pass123|123456|ID\nuser2|pass456|654321|ID\nuser3|pass789|112233|MY`
                : `user1; SPC_EC=xxxxx; SPC_U=12345\nuser2; SPC_EC=yyyyy; SPC_U=67890`
            }
            className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl bg-slate-900 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Real-time Parsed Preview */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-700">
                Pratinjau Hasil Parsing: {parsedList.length} Akun Terdeteksi ({validList.length} Valid)
              </span>
              {parsedList.length > 0 && validList.length === 0 && (
                <span className="text-rose-600 font-semibold">Format baris belum sesuai</span>
              )}
            </div>

            {parsedList.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                      <th className="p-2 font-bold">#</th>
                      <th className="p-2 font-bold">Username / Nickname</th>
                      <th className="p-2 font-bold">Wilayah</th>
                      <th className="p-2 font-bold">Kredensial</th>
                      <th className="p-2 font-bold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedList.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-slate-100 ${
                          item.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'
                        }`}
                      >
                        <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2 font-semibold text-slate-800">{item.username}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {item.region}
                          </span>
                        </td>
                        <td className="p-2 text-slate-500 font-mono text-[11px]">
                          {item.password ? '••••••••' : item.cookies ? 'Cookie Session' : '-'}
                        </td>
                        <td className="p-2 text-right">
                          {item.isValid ? (
                            <span className="text-emerald-600 font-bold text-[11px] inline-flex items-center gap-1">
                              <i className="fa-solid fa-circle-check"></i> Siap
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold text-[11px] inline-flex items-center gap-1">
                              <i className="fa-solid fa-triangle-exclamation"></i> {item.note}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ width: 'auto' }}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExecuteImport}
            disabled={validList.length === 0 || isSubmitting}
            style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i> Mengimpor {validList.length} Akun...
              </>
            ) : (
              <>
                <i className="fa-solid fa-bolt"></i> Impor Sekarang ({validList.length} Akun)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
