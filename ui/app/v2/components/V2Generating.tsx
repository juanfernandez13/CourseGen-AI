'use client';

import { useEffect, useState } from 'react';

type Step = { l: string; status: 'done' | 'active' | 'pending'; pct?: number };

export default function V2Generating({ courseName }: { courseName: string }) {
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(20);

  useEffect(() => {
    const id = setInterval(() => {
      setPct(p => {
        const next = Math.min(95, p + Math.random() * 8);
        if (next >= 95 && phase < 2) setPhase(ph => Math.min(2, ph + 1));
        return next;
      });
    }, 700);
    return () => clearInterval(id);
  }, [phase]);

  const steps: Step[] = [
    { l: 'Validando JSON',                                    status: phase >= 0 ? (phase > 0 ? 'done' : 'active')  : 'pending' },
    { l: 'Gerando XML do curso',                              status: phase >= 1 ? (phase > 1 ? 'done' : 'active')  : 'pending' },
    { l: 'Empacotando .mbz',                                  status: phase >= 2 ? 'active' : 'pending', pct: pct },
    { l: 'Calculando hash sha1',                              status: 'pending' },
  ];

  return (
    <main className="flex flex-col items-center justify-center px-10 py-14 relative overflow-hidden" style={{ minHeight: 'calc(100vh - 48px)' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(129,140,248,0.10), transparent 50%)',
        }}
      />
      <div className="w-full max-w-[600px] relative">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 0 0 4px rgba(129,140,248,0.2)',
              animation: 'blink 1s infinite',
            }}
          />
          <span className="font-mono-ui text-[11px] uppercase" style={{ color: 'var(--ink-2)', letterSpacing: 0.8 }}>
            building · {courseName}
          </span>
        </div>
        <h1 className="text-[32px] font-semibold m-0 mb-2 leading-[1.1]" style={{ letterSpacing: -0.6 }}>
          Empacotando para o Moodle…
        </h1>
        <p className="text-[13.5px] mt-0 mb-6" style={{ color: 'var(--ink-2)' }}>
          Em geral leva 20–40 segundos.
        </p>

        <div
          className="rounded-[8px] px-4 py-4 mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2"
              style={{ borderBottom: i < steps.length - 1 ? '1px solid var(--line)' : 'none' }}
            >
              <div
                className="w-[18px] h-[18px] rounded-full grid place-items-center text-[10px] font-bold"
                style={{
                  background: step.status === 'done'   ? 'var(--ok)'
                            : step.status === 'active' ? 'var(--accent-soft)'
                            :                            'transparent',
                  border:     step.status === 'pending' ? '1px solid var(--line-2)' : 'none',
                  color:      step.status === 'done' ? 'var(--bg)' : 'var(--accent)',
                }}
              >
                {step.status === 'done' && '✓'}
                {step.status === 'active' && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', animation: 'blink 0.9s infinite' }} />
                )}
              </div>
              <div className="flex-1 text-[13px]" style={{ color: step.status === 'pending' ? 'var(--ink-3)' : 'var(--ink)' }}>
                {step.l}
              </div>
              {step.status === 'active' && step.pct != null && (
                <div className="w-[110px] h-1 rounded-[2px] overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                  <div style={{ width: `${step.pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', transition: 'width 300ms ease' }} />
                </div>
              )}
              {step.status === 'done' && <span className="font-mono-ui text-[10px]" style={{ color: 'var(--ink-3)' }}>ok</span>}
            </div>
          ))}
        </div>

        <div className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>
          chamando /api/generate · não feche esta aba
        </div>
      </div>
    </main>
  );
}
