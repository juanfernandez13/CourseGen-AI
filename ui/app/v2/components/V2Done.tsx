'use client';

import { useMemo } from 'react';
import Badge from './Badge';

type Props = {
  json:        string;
  elapsedMs:   number;
  onReset:     () => void;
  onBackHome:  () => void;
};

export default function V2Done({ json, elapsedMs, onReset, onBackHome }: Props) {
  const stats = useMemo(() => {
    try {
      const data = JSON.parse(json);
      const aulas = data?.aulas ?? [];
      return {
        name:     data?.disciplina?.nome   ?? 'curso',
        code:     data?.disciplina?.codigo ?? 'CURSO',
        unidades: aulas.length,
        quizzes:  aulas.filter((a: { quiz?: unknown })   => a.quiz).length,
        tarefas:  aulas.filter((a: { tarefa?: unknown }) => a.tarefa).length,
        foruns:   aulas.filter((a: { forum?: unknown })  => a.forum).length,
      };
    } catch {
      return { name: 'curso', code: 'CURSO', unidades: 0, quizzes: 0, tarefas: 0, foruns: 0 };
    }
  }, [json]);

  const filename = `${stats.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mbz`;
  const elapsedStr = `${Math.max(1, Math.round(elapsedMs / 1000))}s`;

  return (
    <main className="flex flex-col items-center justify-center px-10 py-14 relative overflow-hidden" style={{ minHeight: 'calc(100vh - 48px)' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 20%, rgba(129,140,248,0.15), transparent 40%), radial-gradient(circle at 70% 80%, rgba(167,139,250,0.12), transparent 40%)',
        }}
      />
      <div className="w-full max-w-[680px] relative">
        <div className="flex items-center gap-2.5 mb-4">
          <Badge tone="ok">build · ok</Badge>
          <span className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>
            concluído em {elapsedStr}
          </span>
        </div>
        <h1 className="text-[38px] font-semibold m-0 leading-[1.05]" style={{ letterSpacing: -0.8 }}>
          Build pronto.<br />
          <span style={{ color: 'var(--ink-3)' }}>{filename}</span>
        </h1>

        <div
          className="mt-7 rounded-[8px] overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <div
            className="flex items-center gap-3.5 px-4.5 py-3.5"
            style={{ borderBottom: '1px solid var(--line)' }}
          >
            <div
              className="w-9 h-11 rounded-[4px] grid place-items-center text-[9px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', letterSpacing: 1 }}
            >
              MBZ
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-medium">{filename}</div>
              <div className="font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                {stats.name} · moodle 2.x
              </div>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="rounded-[5px] px-3 py-1.5 text-[12px] font-mono-ui"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)', color: 'var(--ink-2)' }}
              title="O download já foi acionado. Clique para gerar de novo."
            >
              ↺ regenerar
            </button>
          </div>
          <div className="grid gap-4 px-4.5 py-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {([
              ['unidades', stats.unidades],
              ['quizzes',  stats.quizzes],
              ['tarefas',  stats.tarefas],
              ['fóruns',   stats.foruns],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <div className="text-[18px] font-semibold tabular-nums">{value}</div>
                <div className="font-mono-ui text-[10px] uppercase" style={{ color: 'var(--ink-3)', letterSpacing: 0.5 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onBackHome}
            className="rounded-[5px] px-3 py-1.5 text-[11.5px] font-mono-ui"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)', color: 'var(--ink-2)' }}
          >
            ← voltar para a lista
          </button>
          <button
            type="button"
            onClick={onReset}
            className="ml-auto rounded-[5px] px-3 py-1.5 text-[11.5px] font-mono-ui"
            style={{ color: 'var(--ink-3)' }}
          >
            + nova disciplina
          </button>
        </div>
      </div>
    </main>
  );
}
