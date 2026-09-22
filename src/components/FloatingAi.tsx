import React, { useState, useRef, useEffect } from 'react';
import { askMultiModelAI } from '../services/api.ts';

interface FloatingAiProps {
  onRunAudit?: () => Promise<void>;
}

export const FloatingAi: React.FC<FloatingAiProps> = ({ onRunAudit }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Halo! Saya GaneMaX AI, asisten strategi flash sale Anda. Tanyakan tips sub-milidetik, jitter offset optimal (-15ms), bypass 429 rate limit, atau optimasi Multi-Socket threads.',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (promptToSend?: string) => {
    const prompt = (promptToSend || inputVal).trim();
    if (!prompt || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    setInputVal('');
    setIsLoading(true);

    try {
      const response = await askMultiModelAI(prompt);
      setMessages((prev) => [...prev, { role: 'assistant', text: response }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `⚠️ Gagal menghubungi GaneMaX AI: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        className="modern-ai-fab"
        id="aiFab"
        onClick={() => setIsOpen(!isOpen)}
        title="GaneMaX AI Strategy Assistant"
        aria-label="Buka GaneMaX AI Strategy"
      >
        <span className="modern-ai-glow"></span>
        <i className="fa-solid fa-sparkles"></i>
        <span className="modern-ai-fab-label">GaneMaX AI</span>
      </button>

      {/* Expandable AI Drawer */}
      {isOpen && (
        <div className="modern-ai-drawer active" id="aiDrawer">
          <div className="modern-ai-header">
            <div className="modern-ai-header-left">
              <div className="modern-ai-avatar">
                <img
                  src="/ganemax-logo.jpg"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://files.catbox.moe/pi1r45.jpg';
                  }}
                  alt="GaneMaX AI"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <div className="modern-ai-title">
                  <span>GaneMaX AI Strategy</span>
                  <span className="modern-ai-badge">TURBO</span>
                </div>
                <div className="modern-ai-subtitle">Asisten Cerdas Flash Sale Shopee</div>
              </div>
            </div>
            <button
              className="modern-modal-close"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup AI"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="modern-ai-body" id="aiDrawerBody">
            {/* Quick Prompt Chips */}
            <div className="modern-prompt-chips">
              <button
                type="button"
                className="modern-chip"
                onClick={() => handleSendMessage('Berapa jitter offset optimal untuk flash sale Rp 1.000?')}
              >
                ⚡ Jitter Rp 1.000
              </button>
              <button
                type="button"
                className="modern-chip"
                onClick={() => handleSendMessage('Bagaimana cara bypass error HTTP 429 rate limit Shopee?')}
              >
                🛡️ Bypass Rate Limit
              </button>
              {onRunAudit && (
                <button
                  type="button"
                  className="modern-chip audit"
                  onClick={onRunAudit}
                >
                  🎯 Audit Kesiapan
                </button>
              )}
            </div>

            {/* Chat Messages */}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`modern-chat-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}
              >
                {m.role === 'assistant' && (
                  <div className="bubble-author">
                    <i className="fa-solid fa-brain"></i> GaneMaX AI:
                  </div>
                )}
                <div
                  className="bubble-content"
                  dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br>') }}
                />
              </div>
            ))}
            {isLoading && (
              <div className="modern-chat-bubble assistant loading">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>GaneMaX AI sedang menganalisis strategi flash sale...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Footer */}
          <div className="modern-ai-footer">
            <input
              type="text"
              className="modern-ai-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder="Tanyakan strategi bypass atau optimasi bot..."
            />
            <button
              type="button"
              className="modern-ai-send-btn"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputVal.trim()}
              aria-label="Kirim Pesan"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
