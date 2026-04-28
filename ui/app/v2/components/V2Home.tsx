'use client';

import { useMemo, useState } from 'react';
import Badge from './Badge';
import type { JsonVersion } from '../../lib/useJsonHistory';

type Props = {
  matrizName: string | null;
  draftJson:  string;
  versions:   JsonVersion[];
  onResume:   () => void;
  onNew:      () => void;
  onRestore:  (json: string) => void;
  onClearHistory: () => void;
};

type Filter = 'all' | 'building' | 'done';

function summarizeDraft(json: string): { name: string; code: string; carga: string; progress: number } | null {
  if (!json.trim()) return null;
  try {
    const data = JSON.parse(json);
    return {
      name:  data?.disciplina?.nome   ?? 'Sem título',
      code:  data?.disciplina?.codigo ?? '—',
      carga: data?.disciplina?.carga_horaria ?? '—',
      progress: 70,
    };
  } catch {
    return null;
  }
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d} dia${d !== 1 ? 's' : ''}`;
}

export default function V2Home({ matrizName, draftJson, versions, onResume, onNew, onRestore, onClearHistory }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const summary = useMemo(() => summarizeDraft(draftJson), [draftJson]);

  // "Em construção" = current draft (if any) + last 2 versions that aren't generated downloads.
  // "Finalizadas" = mocked from generated history (none persisted today; show recent versions as proxy).
  const buildingRows = summary
    ? [{
        kind: 'building' as const,
        name: summary.name,
        code: summary.code,
        carga: summary.carga,
        progress: summary.progress,
        edited: matrizName ?? 'rascunho atual',
        ts: versions[0]?.timestamp ?? Date.now(),
      }]
    : [];

  const doneRows: { kind: 'done'; name: string; code: string; carga: string; size: string; edited: string; ts: number }[] = [];

  const all = [...buildingRows, ...doneRows];
  const visible = filter === 'all' ? all
                 : filter === 'building' ? buildingRows
                 : doneRows;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="font-mono-ui text-[11px] uppercase mb-1.5" style={{ color: 'var(--ink-3)', letterSpacing: 0.5 }}>
          WORKSPACE · LOCAL
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight m-0">Disciplinas</h1>
            <p className="text-[12.5px] mt-1" style={{ color: 'var(--ink-2)' }}>
              Tudo salvo neste navegador. Limpar dados do site = perder tudo.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNew}
              className="rounded-[5px] px-3.5 py-1.5 text-[12.5px]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)', color: 'var(--ink)' }}
            >
              Builder manual
            </button>
            <button
              type="button"
              onClick={onNew}
              className="rounded-[5px] px-3.5 py-1.5 text-[12.5px] font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              + Subir Matriz DE
            </button>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div
        className="flex items-center gap-1.5 px-8 py-2.5 text-[11.5px]"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {([
          ['all',      'Todas',          all.length],
          ['building', 'Em construção',  buildingRows.length],
          ['done',     'Finalizadas',    doneRows.length],
        ] as const).map(([k, label, n]) => {
          const on = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 transition-colors"
              style={{
                background: on ? 'var(--surface-3)' : 'transparent',
                color:      on ? 'var(--ink)'        : 'var(--ink-2)',
                border:     on ? '1px solid var(--line-2)' : '1px solid transparent',
              }}
            >
              {label}
              <span className="font-mono-ui text-[10px]" style={{ color: 'var(--ink-3)' }}>{n}</span>
            </button>
          );
        })}
        <span className="ml-auto font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
          ordem: editado ↓
        </span>
      </div>

      {/* Table */}
      <div className="px-8 pt-3.5 pb-7">
        {visible.length === 0 ? (
          <EmptyState onNew={onNew} />
        ) : (
          <>
            <div
              className="grid items-center gap-x-3 px-3.5 py-2 font-mono-ui text-[10px] uppercase"
              style={{
                gridTemplateColumns: '20px 2fr 1fr 90px 1fr 90px 100px',
                color: 'var(--ink-3)',
                letterSpacing: 0.5,
              }}
            >
              <div /><div>nome</div><div>código</div><div>carga</div><div>progresso</div><div>editado</div><div />
            </div>
            {visible.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={r.kind === 'building' ? onResume : undefined}
                className="grid items-center gap-x-3 px-3.5 py-2.5 text-left text-[12.5px] transition-colors hover:bg-(--surface-2) cursor-pointer w-full"
                style={{
                  gridTemplateColumns: '20px 2fr 1fr 90px 1fr 90px 100px',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div
                  className="w-2 h-2 rounded-[1px]"
                  style={{ background: r.kind === 'done' ? 'var(--ok)' : 'var(--accent)', opacity: r.kind === 'done' ? 1 : 0.7 }}
                />
                <div className="font-medium truncate" style={{ color: 'var(--ink)' }}>{r.name}</div>
                <div className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>{r.code}</div>
                <div className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-2)' }}>{r.carga}</div>
                {r.kind === 'done' ? (
                  <div className="flex items-center gap-2">
                    <Badge tone="ok">finalizada</Badge>
                    <span className="font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>{(r as { size: string }).size}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[3px] rounded-[2px] overflow-hidden max-w-[100px]" style={{ background: 'var(--surface-3)' }}>
                      <div style={{ width: `${(r as { progress: number }).progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
                    </div>
                    <span className="font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>{(r as { progress: number }).progress}%</span>
                  </div>
                )}
                <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {versions[0]?.timestamp ? relTime(versions[0].timestamp) : '—'}
                </div>
                <div className="flex justify-end gap-1.5 text-[11px]">
                  {r.kind === 'done' ? (
                    <span className="font-mono-ui" style={{ color: 'var(--accent-ink)' }}>↓ baixar .mbz</span>
                  ) : (
                    <span className="font-mono-ui" style={{ color: 'var(--ink-2)' }}>continuar →</span>
                  )}
                </div>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Versions panel */}
      {versions.length > 0 && (
        <div className="px-8 pb-8">
          <div className="flex items-baseline gap-2.5 mb-3">
            <h2 className="text-[13px] font-semibold m-0" style={{ letterSpacing: -0.2 }}>Histórico de JSON</h2>
            <Badge>{versions.length}</Badge>
            <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>restaure uma versão anterior</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClearHistory}
              className="font-mono-ui text-[11px]"
              style={{ color: 'var(--danger)' }}
            >
              limpar tudo
            </button>
          </div>
          <div
            className="rounded-[6px] overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            {versions.slice(0, 5).map((v, i) => (
              <div
                key={v.id}
                className="grid items-center gap-x-3 px-3.5 py-2.5 text-[12px]"
                style={{
                  gridTemplateColumns: '20px 1fr 140px 90px',
                  borderBottom: i < Math.min(versions.length, 5) - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                <div className="w-2 h-2 rounded-[1px]" style={{ background: 'var(--accent)' }} />
                <div className="truncate" style={{ color: 'var(--ink)' }}>{v.label}</div>
                <div className="font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                  {new Date(v.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onRestore(v.json)}
                    className="font-mono-ui text-[11px]"
                    style={{ color: 'var(--accent-ink)' }}
                  >
                    restaurar →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div
        className="w-16 h-16 mb-5 grid place-items-center rounded-[12px] text-[28px]"
        style={{ background: 'var(--surface)', border: '1px dashed var(--line-2)', color: 'var(--ink-3)' }}
      >
        ＋
      </div>
      <h3 className="text-[20px] font-semibold m-0 mb-1" style={{ letterSpacing: -0.4 }}>Nenhuma disciplina ainda</h3>
      <p className="text-[13px] max-w-[420px] mb-6" style={{ color: 'var(--ink-2)' }}>
        Suba uma Matriz DE pra deixar a IA estruturar tudo, ou monte a disciplina do zero pelo builder.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="rounded-[5px] px-4 py-2 text-[12.5px] font-semibold"
        style={{ background: 'var(--accent)', color: 'var(--bg)' }}
      >
        + Nova disciplina
      </button>
    </div>
  );
}
