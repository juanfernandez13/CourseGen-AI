'use client';

import type { V2Stage } from '../types';

const ORDER: V2Stage[] = ['upload', 'review', 'done'];
const LABELS: Record<V2Stage, string> = {
  home:       'home',
  upload:     'upload',
  extracting: 'upload',
  review:     'revisão',
  generating: 'revisão',
  done:       'download',
  error:      'erro',
};

export default function Stepper({ stage, onNavigate }: { stage: V2Stage; onNavigate?: (s: V2Stage) => void }) {
  const visible: V2Stage[] = ['upload', 'review', 'done'];
  const currentIdx = ORDER.indexOf(
    (['extracting', 'upload'].includes(stage)) ? 'upload'
      : (['generating', 'review'].includes(stage)) ? 'review'
      : (['done'].includes(stage)) ? 'done'
      : 'upload',
  );

  return (
    <div
      className="flex h-[38px] items-center gap-2.5 px-6 font-mono-ui text-[11.5px] uppercase"
      style={{ borderBottom: '1px solid var(--line)', letterSpacing: 0.5 }}
    >
      {visible.map((s, i) => {
        const idx = ORDER.indexOf(s);
        const done   = idx < currentIdx;
        const active = idx === currentIdx;
        const click  = done && !!onNavigate;
        return (
          <span key={s} className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={!click}
              onClick={() => click && onNavigate!(s)}
              className="flex items-center gap-1.5 transition-colors"
              style={{
                color:  active ? 'var(--ink)' : done ? 'var(--ink-2)' : 'var(--ink-3)',
                cursor: click ? 'pointer' : 'default',
              }}
            >
              <span
                className="grid h-[14px] w-[14px] place-items-center rounded-full text-[9px] font-bold"
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  color:      active ? 'var(--bg)' : 'var(--ink-3)',
                  border:     active ? 'none' : '1px solid var(--line-2)',
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              {LABELS[s]}
            </button>
            {i < visible.length - 1 && <span style={{ color: 'var(--ink-3)' }}>/</span>}
          </span>
        );
      })}
      <span className="ml-auto" style={{ color: 'var(--ink-3)' }}>esc para cancelar</span>
    </div>
  );
}
