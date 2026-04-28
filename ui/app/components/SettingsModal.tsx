'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getGeminiKey, setGeminiKey, clearGeminiKey, maskKey } from '../lib/apiKeys';
import { checkServerHealth } from '../lib/api';

type Props = { open: boolean; onClose: () => void };

export default function SettingsModal({ open, onClose }: Props) {
  const [stored, setStored]       = useState<string | null>(null);
  const [draft, setDraft]         = useState('');
  const [editing, setEditing]     = useState(false);
  const [reveal, setReveal]       = useState(false);
  const [fallback, setFallback]   = useState<boolean | null>(null);
  const [visible, setVisible]     = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const k = getGeminiKey();
    setStored(k);
    setDraft('');
    setEditing(!k);
    setReveal(false);
    checkServerHealth().then(h => setFallback(h.serverFallbackAvailable));
  }, [open]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  function close() {
    setVisible(false);
    setTimeout(onClose, 160);
  }

  function save() {
    const v = draft.trim();
    if (!v) return;
    setGeminiKey(v);
    setStored(v);
    setDraft('');
    setEditing(false);
    setReveal(false);
  }

  function remove() {
    clearGeminiKey();
    setStored(null);
    setEditing(true);
    setDraft('');
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 160ms ease',
      }}
      onClick={close}
    >
      <div
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-lg"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
          opacity: visible ? 1 : 0,
          transition: 'transform 200ms ease, opacity 200ms ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
              settings · modelos de ia
            </span>
          </div>
          <button
            onClick={close}
            className="grid h-7 w-7 place-items-center rounded-[5px] transition-colors hover:bg-(--surface-3)"
            style={{ color: 'var(--ink-2)' }}
            title="Fechar"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-5">
          <div>
            <h3 className="text-[18px] font-semibold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.3px' }}>
              Chave do Gemini
            </h3>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
              Sua chave fica salva apenas no <span className="font-mono-ui text-[11.5px]">localStorage</span> deste navegador
              e só viaja ao servidor no momento da chamada à IA.
            </p>
          </div>

          {/* Provider card */}
          <div
            className="flex flex-col gap-3 rounded-md p-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="grid h-7 w-7 place-items-center rounded-[5px] text-[12px] font-bold text-white"
                style={{ background: '#4285f4' }}
              >
                G
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>Google Gemini</span>
                  {stored && <Badge tone="ok">conectado</Badge>}
                  {fallback !== null && (
                    fallback
                      ? <Badge tone="default">fallback servidor ativo</Badge>
                      : !stored && <Badge tone="warn">sem fallback</Badge>
                  )}
                </div>
                <div className="mt-0.5 font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                  gemini-2.5-flash · gemini-1.5-pro
                </div>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] underline-offset-2 hover:underline"
                style={{ color: 'var(--ink-3)' }}
              >
                onde encontro? ↗
              </a>
            </div>

            {/* Key input row */}
            <div
              className="flex items-center gap-2 rounded-[5px] px-2.5 py-1.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <span className="font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>API_KEY</span>
              <span className="h-3.5 w-px" style={{ background: 'var(--line)' }} />
              {editing || !stored ? (
                <input
                  type={reveal ? 'text' : 'password'}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="AIza…"
                  autoFocus
                  spellCheck={false}
                  className="flex-1 bg-transparent text-[12.5px] outline-none"
                  style={{
                    color: 'var(--ink)',
                    fontFamily: 'var(--font-mono)',
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') save(); }}
                />
              ) : (
                <span className="flex-1 truncate font-mono-ui text-[12px]" style={{ color: 'var(--ink)' }}>
                  {reveal ? stored : maskKey(stored)}
                </span>
              )}
              <button
                onClick={() => setReveal(r => !r)}
                className="rounded-[3px] px-1.5 py-0.5 font-mono-ui text-[10px] transition-colors hover:bg-(--surface-3)"
                style={{ color: 'var(--ink-3)', border: '1px solid var(--line)' }}
                title={reveal ? 'Ocultar' : 'Mostrar'}
              >
                {reveal ? 'hide' : 'show'}
              </button>
              {stored && !editing && (
                <button
                  onClick={() => { setEditing(true); setDraft(''); }}
                  className="rounded-[3px] px-1.5 py-0.5 font-mono-ui text-[10px]"
                  style={{ color: 'var(--ink)', border: '1px solid var(--line-2)' }}
                >
                  trocar
                </button>
              )}
              {editing && (
                <button
                  onClick={save}
                  disabled={!draft.trim()}
                  className="rounded-[3px] px-2 py-0.5 font-mono-ui text-[10px] transition-colors"
                  style={{
                    color: draft.trim() ? 'var(--accent-ink)' : 'var(--ink-3)',
                    background: draft.trim() ? 'var(--accent-soft)' : 'transparent',
                    border: `1px solid ${draft.trim() ? 'var(--primary-ring)' : 'var(--line)'}`,
                    cursor: draft.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  salvar
                </button>
              )}
              {stored && (
                <button
                  onClick={remove}
                  className="rounded-[3px] px-1.5 py-0.5 font-mono-ui text-[10px] transition-colors"
                  style={{ color: 'var(--danger)' }}
                  title="Remover chave"
                >
                  remover
                </button>
              )}
            </div>
          </div>

          {/* Fallback hint */}
          <div
            className="flex items-start gap-2 rounded-md px-3 py-2.5 text-[11.5px]"
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--primary-ring)',
              color: 'var(--accent-ink)',
            }}
          >
            <span className="font-mono-ui">ⓘ</span>
            <span>
              Sem chave própria, o app usa a <span className="font-mono-ui text-[10.5px]">GEMINI_KEY</span> do servidor (limite compartilhado).
              {fallback === false && (
                <>
                  {' '}
                  <strong style={{ color: 'var(--warn)' }}>O servidor não tem chave configurada</strong>, então uma chave própria é obrigatória.
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'ok' | 'warn' | 'default' }) {
  const styles = tone === 'ok'
    ? { bg: 'rgba(74,222,128,0.10)',  fg: 'var(--ok)',     bd: 'rgba(74,222,128,0.28)' }
    : tone === 'warn'
    ? { bg: 'rgba(251,191,36,0.10)',  fg: 'var(--warn)',   bd: 'rgba(251,191,36,0.28)' }
    : { bg: 'var(--surface-3)',        fg: 'var(--ink-2)', bd: 'var(--line)' };
  return (
    <span
      className="inline-flex items-center rounded-xs px-1.5 py-0.5 font-mono-ui text-[10px] uppercase tracking-[0.06em]"
      style={{ background: styles.bg, color: styles.fg, border: `1px solid ${styles.bd}` }}
    >
      {children}
    </span>
  );
}
