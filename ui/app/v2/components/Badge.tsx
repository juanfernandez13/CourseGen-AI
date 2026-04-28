'use client';

import { ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'ok' | 'warn' | 'danger';

const TONES: Record<Tone, [string, string, string]> = {
  default: ['var(--surface-3)',           'var(--ink-2)',     'var(--line)'],
  accent:  ['var(--accent-soft)',         'var(--accent-ink)','rgba(129,140,248,0.3)'],
  ok:      ['rgba(74,222,128,0.10)',      'var(--ok)',        'rgba(74,222,128,0.25)'],
  warn:    ['rgba(251,191,36,0.10)',      'var(--warn)',      'rgba(251,191,36,0.25)'],
  danger:  ['rgba(248,113,113,0.10)',     'var(--danger)',    'rgba(248,113,113,0.25)'],
};

export default function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  const [bg, color, border] = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 font-mono-ui text-[10.5px] uppercase"
      style={{ background: bg, color, border: `1px solid ${border}`, letterSpacing: 0.2 }}
    >
      {children}
    </span>
  );
}
