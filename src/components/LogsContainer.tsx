import React, { useState, useRef, useEffect } from 'react';
import { BotLogItem } from '../types/index.ts';

interface LogsContainerProps {
  logs: BotLogItem[];
  onClearLogs: () => void;
}

export const LogsContainer: React.FC<LogsContainerProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'success') return log.type === 'success' || log.text.includes('BERHASIL');
    if (filter === 'error') return log.type === 'error' || log.text.includes('gagal') || log.text.includes('Gagal');
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
    } else if (log.type === 'error' || text.includes('gagal') || text.includes('Gagal') || text.includes('Error')) {
      tag = 'ERROR';
      tagColor = 'text-rose-400 font-bold';
    } else if (text.includes('NTP') || text.includes('Sync') || text.includes('Detik 0')) {
      tag = 'NTP-SYNC';
      tagColor = 'text-amber-400';
    } else if (text.includes('Socket') || text.includes('Koneksi') || text.includes('Proxy')) {
      tag = 'SOCKET';
      tagColor = 'text-blue-400';
    } else if (text.includes('PIN') || text.includes('ShopeePay')) {
      tag = 'AUTO-PIN';
      tagColor = 'text-indigo-300';
    }

    return { tag, tagColor };
  };

  return (
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

          <button
            type="button"
            className="terminal-tool-btn"
            onClick={handleCopyLogs}
            title="Salin semua log"
          >
            <i className={`fa-solid ${copied ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
          </button>
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
          # Auto PIN Injection: ENABLED | Proxy Mesh: ACTIVE<br />
          -------------------------------------------------------------
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 italic py-4">
            [STANDBY] Menunggu event flash sale... Terminal siap merekam stream transaksi real-time.
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
  );
};
