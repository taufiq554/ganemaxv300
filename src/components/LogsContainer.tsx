import React, { useState, useRef, useEffect } from 'react';
import { BotLogItem } from '../types/index.ts';
import { PythonScriptModal } from './PythonScriptModal.tsx';

interface LogsContainerProps {
  logs: BotLogItem[];
  onClearLogs: () => void;
  isBotRunning?: boolean;
  onStartBot?: () => void;
  onStopBot?: () => void;
  onAddLog?: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  selectedRegion?: string;
}

export const LogsContainer: React.FC<LogsContainerProps> = ({
  logs,
  onClearLogs,
  isBotRunning = false,
  onStartBot,
  onStopBot,
  onAddLog,
  selectedRegion = 'ID',
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [copied, setCopied] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'success') return log.type === 'success' || log.text.includes('BERHASIL') || log.text.includes('200 OK');
    if (filter === 'error') {
      return (
        log.type === 'error' ||
        log.text.includes('gagal') ||
        log.text.includes('Gagal') ||
        log.text.includes('Error') ||
        log.text.includes('HTTP 4') ||
        log.text.includes('HTTP 5') ||
        log.text.includes('ERR_') ||
        log.text.includes('LOCKED') ||
        log.text.includes('TIMEOUT') ||
        log.text.includes('STOCK_OUT') ||
        log.text.includes('CAPTCHA') ||
        log.text.includes('REJECTED')
      );
    }
    return true;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.text}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parseLogLine = (log: BotLogItem) => {
    const text = log.text;
    let tag = 'INFO';
    let tagColor = 'text-sky-400';

    if (log.type === 'success' || text.includes('BERHASIL') || text.includes('200 OK')) {
      tag = 'HTTP-200';
      tagColor = 'text-emerald-400 font-bold';
    } else if (
      log.type === 'error' ||
      text.includes('gagal') ||
      text.includes('Gagal') ||
      text.includes('Error') ||
      text.includes('HTTP 4') ||
      text.includes('HTTP 5') ||
      text.includes('ERR_') ||
      text.includes('ITEM_LOCKED') ||
      text.includes('TIMEOUT') ||
      text.includes('STOCK_OUT') ||
      text.includes('CAPTCHA_TRIGGERED') ||
      text.includes('PAYLOAD_REJECTED')
    ) {
      tag = 'ERROR';
      tagColor = 'text-rose-400 font-bold';
    } else if (text.includes('NTP') || text.includes('Sync') || text.includes('Detik 0')) {
      tag = 'NTP-SYNC';
      tagColor = 'text-amber-400';
    } else if (text.includes('PYTHON') || text.includes('shopee_flash_bot') || text.includes('daemon')) {
      tag = 'PYTHON';
      tagColor = 'text-cyan-400 font-bold';
    } else if (text.includes('WEBDRIVER') || text.includes('ChromeDriver')) {
      tag = 'WEBDRIVER';
      tagColor = 'text-emerald-400';
    } else if (text.includes('SOCKET') || text.includes('Socket') || text.includes('Proxy') || text.includes('Injeksi')) {
      tag = 'SOCKET';
      tagColor = 'text-blue-400';
    } else if (text.includes('PIN') || text.includes('ShopeePay')) {
      tag = 'AUTO-PIN';
      tagColor = 'text-indigo-300';
    }

    return { tag, tagColor };
  };

  return (
    <>
      <div className="terminal-console-container">
        {/* Terminal Titlebar (Authentic CLI) */}
        <div className="terminal-header">
          <div className="terminal-controls">
            <span className="terminal-btn btn-close"></span>
            <span className="terminal-btn btn-min"></span>
            <span className="terminal-btn btn-max"></span>
            <span className="terminal-title">
              root@ganemax-shopee-engine:~# ./bot-core --multisocket=12 --atomic-ntp
            </span>
          </div>

          <div className="terminal-actions">
            {/* Filter Tabs */}
            <div className="terminal-filter-group">
              <button
                type="button"
                className={`terminal-filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                ALL
              </button>
              <button
                type="button"
                className={`terminal-filter-btn ${filter === 'success' ? 'active' : ''}`}
                onClick={() => setFilter('success')}
              >
                SUCCESS [200]
              </button>
              <button
                type="button"
                className={`terminal-filter-btn ${filter === 'error' ? 'active' : ''}`}
                onClick={() => setFilter('error')}
              >
                ERRORS
              </button>
            </div>

            {/* Folder Script Python & WebDriver (Sesuai Permintaan User) */}
            <button
              type="button"
              className="terminal-tool-btn terminal-folder-btn"
              onClick={() => setIsScriptModalOpen(true)}
              title="Buka Folder Script Python, WebDriver & Engine"
            >
              <i className="fa-solid fa-folder-open text-amber-400"></i>
              <span className="terminal-btn-label">Folder Script</span>
            </button>

            {/* Tombol Start / Stop Bot Terintegrasi */}
            {onStartBot && onStopBot && (
              <button
                type="button"
                className={`terminal-tool-btn terminal-exec-btn ${isBotRunning ? 'running' : ''}`}
                onClick={isBotRunning ? onStopBot : onStartBot}
                title={isBotRunning ? 'Hentikan Engine Bot' : 'Jalankan Engine Bot Sekarang'}
              >
                <i className={`fa-solid ${isBotRunning ? 'fa-stop text-rose-400' : 'fa-play text-emerald-400'}`}></i>
                <span className="terminal-btn-label">{isBotRunning ? 'Stop' : 'Start'}</span>
              </button>
            )}

            {/* Copy Logs */}
            <button
              type="button"
              className="terminal-tool-btn"
              onClick={handleCopyLogs}
              title="Salin semua log"
            >
              <i className={`fa-solid ${copied ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
            </button>

            {/* Clear Logs */}
            <button
              type="button"
              className="terminal-tool-btn"
              onClick={onClearLogs}
              title="Bersihkan layar terminal"
            >
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>

        {/* Terminal Output Screen */}
        <div className="terminal-body font-mono">
          <div className="terminal-init-message text-slate-500 mb-2">
            # GaneMaX Multi-Socket Execution Daemon v3.0.0 [Production CLI]<br />
            # Socket Pool: 12 Parallel Threads | Atomic NTP Sync: 11ms<br />
            # Auto PIN Injection: ENABLED | Proxy Mesh: ACTIVE | Python & WebDriver: INTEGRATED<br />
            -------------------------------------------------------------
          </div>

          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 italic py-4">
              [STANDBY] Menunggu event flash sale... Terminal siap merekam stream transaksi real-time. Klik [Start] atau buka [Folder Script] untuk memulai.
            </div>
          ) : (
            filteredLogs.slice(-40).map((log) => {
              const { tag, tagColor } = parseLogLine(log);

              return (
                <div key={log.id} className="terminal-line">
                  <span className="terminal-time">[{log.time}]</span>{' '}
                  <span className={`terminal-tag ${tagColor}`}>[{tag}]</span>{' '}
                  <span className="terminal-msg">{log.text}</span>
                </div>
              );
            })
          )}

          {/* Flashing Cursor at Bottom of Terminal */}
          <div className="terminal-prompt-line">
            <span className="text-emerald-500 font-bold">ganemax@core:~$</span>
            <span className="terminal-cursor">_</span>
          </div>

          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Full Script Python & WebDriver Modal */}
      <PythonScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
        isBotRunning={isBotRunning}
        onStartBot={onStartBot || (() => {})}
        onStopBot={onStopBot || (() => {})}
        onAddLog={onAddLog}
        selectedRegion={selectedRegion}
      />
    </>
  );
};
