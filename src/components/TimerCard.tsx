import React, { useState, useEffect, useRef } from 'react';
import { AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS } from '../constants/asean.ts';
import { AseanFlag } from './AseanFlag.tsx';

interface TimerCardProps {
  onTargetReached?: () => void;
  selectedRegion?: AseanCountryCode;
}

export const TimerCard: React.FC<TimerCardProps> = ({
  onTargetReached,
  selectedRegion = 'ID',
}) => {
  const currentRegionInfo = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
  const [targetTime, setTargetTime] = useState<string>('');
  const [timeDisplay, setTimeDisplay] = useState<string>('00:00:00');
  const [msDisplay, setMsDisplay] = useState<string>('.000');
  const [isLiveClock, setIsLiveClock] = useState<boolean>(true);
  const [triggeredNotice, setTriggeredNotice] = useState<boolean>(false);
  const hasTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    hasTriggeredRef.current = false;
    setTriggeredNotice(false);
  }, [targetTime]);

  useEffect(() => {
    let animationFrameId: number;
    const updateClock = () => {
      const now = new Date();
      if (isLiveClock || !targetTime) {
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        setTimeDisplay(`${hh}:${mm}:${ss}`);
        setMsDisplay(`.${ms}`);
      } else {
        const target = new Date(targetTime).getTime();
        const diff = target - now.getTime();
        if (diff <= 0) {
          setTimeDisplay('00:00:00');
          setMsDisplay('.000');
          if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            setTriggeredNotice(true);
            if (onTargetReached) {
              onTargetReached();
            }
          }
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          const ms = diff % 1000;
          setTimeDisplay(
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          );
          setMsDisplay(`.${String(ms).padStart(3, '0')}`);
        }
      }
      animationFrameId = requestAnimationFrame(updateClock);
    };
    animationFrameId = requestAnimationFrame(updateClock);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isLiveClock, targetTime, onTargetReached]);

  const handleResetToLive = () => {
    setIsLiveClock(true);
    setTargetTime('');
    setTriggeredNotice(false);
    hasTriggeredRef.current = false;
  };

  const handleSetQuickTarget = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const mins = String(target.getMinutes()).padStart(2, '0');
    const val = `${year}-${month}-${day}T${hours}:${mins}`;
    setTargetTime(val);
    setIsLiveClock(false);
    setTriggeredNotice(false);
    hasTriggeredRef.current = false;
  };

  return (
    <div className="timer-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <div className="timer-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="fa-solid fa-stopwatch"></i>
          <AseanFlag code={currentRegionInfo.code} size="xs" />
          <span>Flash Sale {currentRegionInfo.name} ({currentRegionInfo.timezoneLabel})</span>
        </div>
        <span
          id="countdownStatusBadge"
          className="badge"
          style={{
            background: triggeredNotice
              ? 'rgba(34, 197, 94, 0.4)'
              : !isLiveClock
              ? 'rgba(245, 158, 11, 0.4)'
              : 'rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 700,
            border: triggeredNotice ? '1px solid #4ade80' : !isLiveClock ? '1px solid #fbbf24' : 'none',
          }}
        >
          {triggeredNotice
            ? 'OTOMATIS DIJALANKAN (TERCAPAI)'
            : isLiveClock
            ? 'LIVE CLOCK'
            : 'COUNTDOWN AUTO-START'}
        </span>
      </div>
      <div className="timer-display" id="timerDisplay">
        {timeDisplay}
        <span className="timer-ms" id="timerMs">
          {msDisplay}
        </span>
      </div>
      {/* Pengatur Tanggal & Jam Target Eksekusi */}
      <div
        style={{
          marginTop: '14px',
          background: 'rgba(0,0,0,0.25)',
          padding: '14px',
          borderRadius: '14px',
          textAlign: 'left',
          marginBottom: '2px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <label
            style={{
              color: '#e0e7ff',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: 0,
            }}
          >
            <i className="fa-solid fa-calendar-days" style={{ color: '#38bdf8' }}></i> Atur Waktu &
            Tanggal Target:
          </label>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              fontSize: '10px',
              padding: '2px 8px',
              border: 'none',
              width: 'auto',
            }}
            onClick={handleResetToLive}
          >
            Live Clock
          </button>
        </div>
        <input
          type="datetime-local"
          value={targetTime}
          onChange={(e) => {
            setTargetTime(e.target.value);
            if (e.target.value) {
              setIsLiveClock(false);
              setTriggeredNotice(false);
              hasTriggeredRef.current = false;
            } else {
              setIsLiveClock(true);
            }
          }}
          style={{
            background: 'rgba(255,255,255,0.95)',
            color: '#0f172a',
            fontSize: '13px',
            fontWeight: 700,
            padding: '8px 12px',
            borderRadius: '10px',
            width: '100%',
            border: 'none',
            outline: 'none',
          }}
        />
        {!isLiveClock && targetTime && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#38bdf8',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>
              Target disetel: {new Date(targetTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. Saat jam tiba, bot otomatis langsung dijalankan di terminal!
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          {currentRegionInfo.flashSaleSchedule.map((timeStr) => (
            <button
              key={timeStr}
              type="button"
              className="btn btn-sm"
              style={{
                background: 'rgba(255,255,255,0.22)',
                color: 'white',
                fontSize: '11px',
                padding: '5px 10px',
                flex: 1,
                minWidth: '58px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => handleSetQuickTarget(timeStr)}
            >
              {timeStr}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
