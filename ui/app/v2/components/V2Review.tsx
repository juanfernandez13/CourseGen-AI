'use client';

import { useMemo, useState } from 'react';
import Badge from './Badge';

/* ─── Types — mirrors v1 ReviewStep ─────────────────────────────────────── */
type QuestaoItem = { texto: string; isCorrect?: boolean; resposta?: string };
type Questao = { tipo?: string; enunciado?: string; pontuacao?: number; itens?: QuestaoItem[]; feedback?: string };
type ActivityBase = { titulo?: string; descricao?: string; nota?: number; data_inicio?: string | null; data_fim?: string | null };
type Quiz   = ActivityBase & { questoes?: Questao[] };
type Tarefa = ActivityBase & { arquivos?: { filename?: string; filePath?: string }[] };
type Forum  = ActivityBase;
type Aula   = { numero?: number; titulo?: string; descricao?: string; quiz?: Quiz; tarefa?: Tarefa; forum?: Forum };
type MatrizData = {
  disciplina?: { nome?: string; codigo?: string; carga_horaria?: string };
  professor?:  { nome?: string };
  ementa?:     string;
  objetivos?:  string[] | string;
  aulas?:      Aula[];
};

type ViewMode = 'blocks' | 'json';

type Props = {
  json:         string;
  onJsonChange: (s: string) => void;
  onGenerate:   () => void;
  onBack:       () => void;
  loading:      boolean;
  error:        string | null;
  matrizFile:   File | null;
  quizFiles:    File[];
  tarefaFiles:  File[];
};

function parseSafe(raw: string): { data: MatrizData | null; error: string | null } {
  try { return { data: JSON.parse(raw) as MatrizData, error: null }; }
  catch (e) { return { data: null, error: e instanceof SyntaxError ? e.message : 'JSON inválido.' }; }
}

const ACT_COLORS: Record<string, [string, string]> = {
  forum:  ['#60a5fa', '🗨'],
  wiki:   ['#a78bfa', '☞'],
  quiz:   ['var(--quiz)', '?'],
  tarefa: ['var(--tarefa)', '✎'],
};

/* ─── Block card wrapper ────────────────────────────────────────────────── */
function BlockCard({
  title, meta, tone, defaultOpen = true, headerExtra, children,
}: {
  title: string;
  meta?: string;
  tone?: 'ok' | 'warn' | 'accent';
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const stripe = tone === 'warn' ? 'var(--warn)' : tone === 'ok' ? 'var(--ok)' : 'var(--accent)';
  return (
    <section
      className="relative rounded-[7px] mb-3 overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: stripe, opacity: 0.6 }} />
      <header
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer"
        style={{ borderBottom: open ? '1px solid var(--line)' : 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>{open ? '▾' : '▸'}</span>
        <span className="text-[13.5px] font-semibold" style={{ letterSpacing: -0.2 }}>{title}</span>
        {tone === 'warn' && <Badge tone="warn">aviso</Badge>}
        <div className="flex-1" />
        {headerExtra}
        {meta && <span className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>{meta}</span>}
      </header>
      {open && children && <div className="px-4 py-3.5">{children}</div>}
    </section>
  );
}

/* ─── Tree (left) ───────────────────────────────────────────────────────── */
function Tree({
  data, activeIdx, onSelect,
}: { data: MatrizData | null; activeIdx: number | 'meta'; onSelect: (idx: number | 'meta') => void }) {
  const aulas = data?.aulas ?? [];
  const ementa = (data?.ementa ?? '').trim();
  const ementaTrunc = ementa.length > 0 && ementa.length < 80;

  return (
    <aside
      className="overflow-auto flex flex-col"
      style={{ borderRight: '1px solid var(--line)', background: 'var(--surface)' }}
    >
      <div className="px-3.5 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="text-[13px] font-semibold mb-0.5 truncate">{data?.disciplina?.nome ?? 'Disciplina'}</div>
        <div className="font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
          {data?.disciplina?.codigo ?? '—'} · {data?.disciplina?.carga_horaria ?? '—'}
        </div>
      </div>
      <div className="p-2 flex-1">
        <TreeRow label="Identificação" active={activeIdx === 'meta'} onClick={() => onSelect('meta')} count={5} />
        <TreeRow label="Ementa" warn={ementaTrunc} count={ementa ? 1 : 0} />
        <TreeRow label="Objetivos" count={Array.isArray(data?.objetivos) ? (data?.objetivos?.length ?? 0) : (data?.objetivos ? 1 : 0)} />
        {aulas.map((a, i) => {
          const acts = (a.quiz ? 1 : 0) + (a.tarefa ? 1 : 0) + (a.forum ? 1 : 0);
          const active = activeIdx === i;
          return (
            <div key={i}>
              <TreeRow
                label={`▾ Unidade ${a.numero ?? i + 1} — ${a.titulo ?? '—'}`}
                count={acts}
                active={active}
                onClick={() => onSelect(i)}
              />
              {active && (
                <>
                  {a.forum  && <TreeRow label="Fórum" depth={1} />}
                  {a.quiz   && <TreeRow label={`Quiz · ${a.quiz.questoes?.length ?? 0} questões`} depth={1} />}
                  {a.tarefa && <TreeRow label="Tarefa" depth={1} />}
                </>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function TreeRow({
  label, count, active, warn, depth = 0, onClick,
}: { label: string; count?: number; active?: boolean; warn?: boolean; depth?: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-[4px] mb-px text-[12.5px] transition-colors cursor-pointer"
      style={{
        padding:    '5px 10px',
        paddingLeft: 10 + depth * 14,
        background: active ? 'var(--surface-3)' : 'transparent',
        color:      active ? 'var(--ink)' : 'var(--ink-2)',
        fontWeight: active ? 500 : 400,
      }}
    >
      <span className="flex-1 truncate" style={{ color: warn ? 'var(--warn)' : 'inherit' }}>{label}</span>
      {count != null && <span className="font-mono-ui text-[10px]" style={{ color: 'var(--ink-3)' }}>{count}</span>}
      {warn && <span style={{ color: 'var(--warn)' }}>!</span>}
    </div>
  );
}

/* ─── Activity row (inside Unidade block) ───────────────────────────────── */
function ActivityRow({
  type, title, meta,
}: { type: keyof typeof ACT_COLORS; title: string; meta?: string }) {
  const [color, ico] = ACT_COLORS[type];
  return (
    <div
      className="flex items-center gap-3 rounded-[5px] px-3 py-2.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div
        className="w-[26px] h-[26px] rounded-[5px] grid place-items-center text-[13px] shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        {ico}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge>{type}</Badge>
          <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>{title}</span>
        </div>
        {meta && <div className="text-[11px] mt-0.5 font-mono-ui" style={{ color: 'var(--ink-3)' }}>{meta}</div>}
      </div>
    </div>
  );
}

/* ─── Right panel ───────────────────────────────────────────────────────── */
function RightPanel({
  matrizFile, quizFiles, tarefaFiles, data,
}: { matrizFile: File | null; quizFiles: File[]; tarefaFiles: File[]; data: MatrizData | null }) {
  const aulas = data?.aulas ?? [];
  const ementa = (data?.ementa ?? '').trim();
  const ementaTrunc = ementa.length > 0 && ementa.length < 80;

  const all = [
    ...(matrizFile ? [{ kind: 'matriz', file: matrizFile }] : []),
    ...quizFiles.map(f  => ({ kind: 'quiz',   file: f })),
    ...tarefaFiles.map(f => ({ kind: 'tarefa', file: f })),
  ];

  return (
    <aside
      className="flex flex-col"
      style={{ borderLeft: '1px solid var(--line)', background: 'var(--surface)' }}
    >
      <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="font-mono-ui text-[10.5px] uppercase mb-2.5" style={{ color: 'var(--ink-3)', letterSpacing: 0.5 }}>
          Arquivos do upload
        </div>
        {all.length === 0 && <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>Nenhum arquivo anexado.</div>}
        {all.map((f, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-2 py-1 rounded-[4px] text-[11.5px]"
            style={{ color: 'var(--ink-2)' }}
          >
            <div
              className="w-[14px] h-[16px] rounded-[2px] grid place-items-center font-mono-ui text-[6px] shrink-0"
              style={{ background: 'var(--surface-3)', color: 'var(--ink-3)', letterSpacing: 0.3 }}
            >
              DOC
            </div>
            <span className="flex-1 truncate font-mono-ui text-[11px]" title={f.file.name}>{f.file.name}</span>
            <span className="font-mono-ui text-[10px]" style={{ color: 'var(--ink-3)' }}>
              {(f.file.size / 1024).toFixed(0)}KB
            </span>
          </div>
        ))}
      </div>

      <div className="px-4 py-3.5 flex-1">
        <div
          className="font-mono-ui text-[10.5px] uppercase mb-2.5 flex items-center gap-1.5"
          style={{ color: 'var(--accent)', letterSpacing: 0.5 }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
          validação
        </div>
        <div className="font-mono-ui text-[11px] leading-[1.7]" style={{ color: 'var(--ink-2)' }}>
          <div>
            <span style={{ color: data?.disciplina?.nome ? 'var(--ok)' : 'var(--warn)' }}>
              {data?.disciplina?.nome ? '✓' : '!'}
            </span>{' '}
            identificação · {data?.disciplina?.nome ? 'ok' : 'sem nome'}
          </div>
          <div>
            <span style={{ color: ementaTrunc ? 'var(--warn)' : 'var(--ok)' }}>
              {ementaTrunc ? '!' : '✓'}
            </span>{' '}
            ementa · {ementaTrunc ? 'parece truncada' : 'ok'}
          </div>
          <div>
            <span style={{ color: aulas.length > 0 ? 'var(--ok)' : 'var(--warn)' }}>
              {aulas.length > 0 ? '✓' : '!'}
            </span>{' '}
            {aulas.length} unidades · {aulas.reduce((s, a) => s + (a.quiz ? 1 : 0) + (a.tarefa ? 1 : 0) + (a.forum ? 1 : 0), 0)} atividades
          </div>
          <div>
            <span style={{ color: 'var(--ok)' }}>✓</span> schema moodle 2.x
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function V2Review({
  json, onJsonChange, onGenerate, onBack, loading, error, matrizFile, quizFiles, tarefaFiles,
}: Props) {
  const [view, setView] = useState<ViewMode>('blocks');
  const [activeIdx, setActiveIdx] = useState<number | 'meta'>('meta');
  const { data, error: parseError } = useMemo(() => parseSafe(json), [json]);

  const aulas = data?.aulas ?? [];
  const totalAtividades = aulas.reduce((s, a) => s + (a.quiz ? 1 : 0) + (a.tarefa ? 1 : 0) + (a.forum ? 1 : 0), 0);

  function format() {
    try { onJsonChange(JSON.stringify(JSON.parse(json), null, 2)); } catch { /* ignore */ }
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: '260px 1fr 280px',
        height: 'calc(100vh - 48px - 38px)',
        overflow: 'hidden',
      }}
    >
      <Tree data={data} activeIdx={activeIdx} onSelect={setActiveIdx} />

      {/* Center */}
      <main className="flex flex-col min-w-0">
        {/* Toolbar */}
        <div
          className="h-[38px] flex items-center px-3.5 gap-3"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <div
            className="flex overflow-hidden rounded-[5px]"
            style={{ border: '1px solid var(--line)' }}
          >
            {([
              ['blocks', '◧ Blocos'],
              ['json',   '{ } JSON'],
            ] as const).map(([k, label], i) => {
              const on = view === k;
              return (
                <button
                  key={k}
                  onClick={() => setView(k)}
                  className="px-3 py-1 text-[11.5px] font-mono-ui transition-colors"
                  style={{
                    background: on ? 'var(--surface-3)' : 'transparent',
                    color:      on ? 'var(--ink)'        : 'var(--ink-3)',
                    fontWeight: on ? 500 : 400,
                    borderRight: i === 0 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {aulas.length} unidades · {totalAtividades} atividades
          </span>
          <div className="flex-1" />
          {view === 'json' && (
            <button
              onClick={format}
              className="font-mono-ui text-[11px] px-2.5 py-1 rounded-[4px]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
            >
              formatar
            </button>
          )}
          <span className="font-mono-ui text-[11px]" style={{ color: parseError ? 'var(--danger)' : 'var(--ok)' }}>
            {parseError ? '⚠ JSON inválido' : '✓ JSON válido'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto" style={{ background: 'var(--bg)' }}>
          {view === 'blocks' ? (
            <BlocksView data={data} activeIdx={activeIdx} parseError={parseError} />
          ) : (
            <textarea
              value={json}
              onChange={e => onJsonChange(e.target.value)}
              spellCheck={false}
              className="w-full resize-none p-4 font-mono-ui text-[12px] leading-[1.6] outline-none"
              style={{
                background: 'transparent',
                color:      'var(--ink)',
                border:     'none',
                minHeight:  '100%',
                width:      '100%',
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className="h-10 flex items-center px-3.5 gap-4 font-mono-ui text-[11px]"
          style={{ borderTop: '1px solid var(--line)', color: 'var(--ink-3)' }}
        >
          <span>{aulas.length} unidades · {totalAtividades} atividades · {parseError ? '1 erro' : '0 erros'}</span>
          <span className="ml-auto">schema: moodle 2.x {parseError ? '✗' : '✓'}</span>
          <button
            onClick={onBack}
            disabled={loading}
            className="rounded-[4px] px-3 py-1 text-[11.5px]"
            style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}
          >
            ← voltar
          </button>
          <button
            onClick={onGenerate}
            disabled={!!parseError || loading}
            className="rounded-[4px] px-3.5 py-1 text-[11.5px] font-semibold"
            style={{
              background: parseError ? 'var(--surface-3)' : 'var(--accent)',
              color:      parseError ? 'var(--ink-3)' : 'var(--bg)',
              cursor:     parseError || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'gerando…' : 'finalizar e gerar .mbz →'}
          </button>
        </div>

        {error && (
          <div
            className="px-3.5 py-2 text-[12.5px]"
            style={{ background: 'var(--error-dim)', color: 'var(--error-text)', borderTop: '1px solid var(--error-border)' }}
          >
            ⚠ {error}
          </div>
        )}
      </main>

      <RightPanel data={data} matrizFile={matrizFile} quizFiles={quizFiles} tarefaFiles={tarefaFiles} />
    </div>
  );
}

/* ─── Blocks view (center) ──────────────────────────────────────────────── */
function BlocksView({
  data, activeIdx, parseError,
}: { data: MatrizData | null; activeIdx: number | 'meta'; parseError: string | null }) {
  if (parseError) {
    return (
      <div className="p-6">
        <div
          className="rounded-[6px] px-4 py-3 text-[12.5px]"
          style={{ background: 'var(--error-dim)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
        >
          ⚠ JSON inválido — alterne para a aba JSON para corrigir. <span className="font-mono-ui text-[11px]">({parseError})</span>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const aulas = data.aulas ?? [];
  const ementa = (data.ementa ?? '').trim();
  const ementaTrunc = ementa.length > 0 && ementa.length < 80;
  const objetivos = Array.isArray(data.objetivos)
    ? data.objetivos
    : data.objetivos ? [data.objetivos] : [];

  return (
    <div className="px-6 py-5 max-w-[860px] mx-auto">
      {/* Identification */}
      <BlockCard title="Identificação" meta="da Matriz DE" tone="ok">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {([
            ['Nome',      data.disciplina?.nome],
            ['Código',    data.disciplina?.codigo],
            ['Carga',     data.disciplina?.carga_horaria],
            ['Professor', data.professor?.nome],
          ] as [string, string | undefined][]).map(([l, v]) => (
            <div key={l}>
              <div className="font-mono-ui text-[10px] uppercase mb-1" style={{ color: 'var(--ink-3)', letterSpacing: 0.5 }}>{l}</div>
              <div className="text-[12.5px]" style={{ color: v ? 'var(--ink)' : 'var(--ink-3)' }}>{v ?? '—'}</div>
            </div>
          ))}
        </div>
      </BlockCard>

      {/* Ementa */}
      {ementa && (
        <BlockCard
          title="Ementa"
          meta={ementaTrunc ? 'parece truncada' : `${ementa.length} chars`}
          tone={ementaTrunc ? 'warn' : 'ok'}
        >
          <div className="text-[12.5px] leading-[1.6]" style={{ color: 'var(--ink-2)' }}>
            {ementa}
            {ementaTrunc && <span className="font-mono-ui text-[11px]" style={{ color: 'var(--warn)' }}> [truncado]</span>}
          </div>
        </BlockCard>
      )}

      {/* Objetivos */}
      {objetivos.length > 0 && (
        <BlockCard title="Objetivos" meta={`${objetivos.length} item${objetivos.length !== 1 ? 's' : ''}`} tone="ok">
          <ul className="text-[12.5px] leading-[1.6] flex flex-col gap-1.5 list-none p-0 m-0" style={{ color: 'var(--ink-2)' }}>
            {objetivos.map((o, i) => (
              <li key={i} className="flex items-start gap-2">
                <span style={{ color: 'var(--accent)' }}>·</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </BlockCard>
      )}

      {/* Unidades */}
      {aulas.map((aula, i) => {
        const acts: { type: keyof typeof ACT_COLORS; title: string; meta?: string }[] = [];
        if (aula.forum)  acts.push({ type: 'forum',  title: aula.forum.titulo  ?? 'Fórum'  });
        if (aula.quiz)   acts.push({ type: 'quiz',   title: aula.quiz.titulo   ?? 'Quiz',   meta: `${aula.quiz.questoes?.length ?? 0} questões` });
        if (aula.tarefa) acts.push({ type: 'tarefa', title: aula.tarefa.titulo ?? 'Tarefa', meta: aula.tarefa.descricao });

        return (
          <BlockCard
            key={i}
            title={`Unidade ${aula.numero ?? i + 1} — ${aula.titulo ?? 'Sem título'}`}
            meta={`${acts.length} atividade${acts.length !== 1 ? 's' : ''}`}
            tone="accent"
            defaultOpen={activeIdx === i}
          >
            {aula.descricao && (
              <p className="text-[12.5px] mb-3" style={{ color: 'var(--ink-2)' }}>{aula.descricao}</p>
            )}
            <div className="flex flex-col gap-1.5">
              {acts.length === 0 ? (
                <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>Sem atividades.</div>
              ) : (
                acts.map((a, ai) => <ActivityRow key={ai} type={a.type} title={a.title} meta={a.meta} />)
              )}
            </div>
          </BlockCard>
        );
      })}

      {aulas.length === 0 && (
        <div
          className="rounded-[6px] py-8 text-center text-[12.5px]"
          style={{ background: 'var(--surface)', border: '1px dashed var(--line-2)', color: 'var(--ink-3)' }}
        >
          Nenhuma unidade extraída.
        </div>
      )}
    </div>
  );
}
