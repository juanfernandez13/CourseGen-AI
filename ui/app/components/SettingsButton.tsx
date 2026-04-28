'use client';

import { useEffect, useState } from 'react';
import SettingsModal from './SettingsModal';
import { getGeminiKey } from '../lib/apiKeys';

export default function SettingsButton() {
  const [open, setOpen]       = useState(false);
  const [hasKey, setHasKey]   = useState<boolean | null>(null);

  useEffect(() => { setHasKey(!!getGeminiKey()); }, []);

  function handleClose() {
    setOpen(false);
    setHasKey(!!getGeminiKey());
  }

  // While SSR/initial render — neutral gear (avoids hydration flash)
  if (hasKey === null) {
    return (
      <>
        <GearOnly onClick={() => setOpen(true)} />
        <SettingsModal open={open} onClose={handleClose} />
      </>
    );
  }

  if (!hasKey) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          title="Adicionar chave do Google Gemini"
          className="group relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors"
          style={{
            background: 'var(--accent-soft)',
            color: 'var(--accent-ink)',
            border: '1px solid var(--primary-ring)',
          }}
        >
          <span
            aria-hidden
            className="relative flex h-1.5 w-1.5"
          >
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
              style={{ background: 'var(--warn)' }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--warn)' }}
            />
          </span>
          <KeyIcon />
          <span>Conectar Gemini</span>
        </button>
        <SettingsModal open={open} onClose={handleClose} />
      </>
    );
  }

  // Key is set — discreet pill with green dot
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Gemini conectado · gerenciar chave"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors hover:bg-(--surface-3)"
        style={{
          color: 'var(--ink-2)',
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
        }}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--ok)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--ok) 22%, transparent)' }}
        />
        <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
          gemini
        </span>
      </button>
      <SettingsModal open={open} onClose={handleClose} />
    </>
  );
}

function GearOnly({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Configurações"
      className="flex h-7 w-7 items-center justify-center rounded-[5px] transition-colors hover:bg-(--surface-3)"
      style={{ color: 'var(--ink-2)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.29 16.96l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  );
}

function KeyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
