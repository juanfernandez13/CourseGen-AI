'use client';

import { useState, useEffect } from 'react';
import FileViewer from './FileViewer';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type QuestaoItem = { texto: string; isCorrect?: boolean; resposta?: string };
type Questao = {
  tipo?: string;
  enunciado?: string;
  pontuacao?: number;
  itens?: QuestaoItem[];
  feedback?: string;
};
type ActivityBase = { titulo?: string; descricao?: string; nota?: number; data_inicio?: string | null; data_fim?: string | null };
type Quiz   = ActivityBase & { questoes?: Questao[] };
type Tarefa = ActivityBase & { arquivos?: { filename?: string; filePath?: string }[] };
type Forum  = ActivityBase;
type Aula   = { numero?: number; titulo?: string; descricao?: string; data_inicio?: string | null; data_fim?: string | null; quiz?: Quiz; tarefa?: Tarefa; forum?: Forum };
type MatrizData = {
  disciplina?: { nome?: string; codigo?: string; carga_horaria?: string; semestre?: string; turma?: string; polo?: string };
  professor?:  { nome?: string; email?: string; titulacao?: string; tutor?: string };
  aulas?: Aula[];
};

function parseJsonSafe(raw: string): { data: MatrizData | null; error: string | null } {
  try   { return { data: JSON.parse(raw) as MatrizData, error: null }; }
  catch (e) { return { data: null, error: e instanceof SyntaxError ? e.message : 'JSON inválido.' }; }
}

/** Map tarefa_N.ext → tarefaNum */
function buildTarefaMap(files: File[]): Record<number, File[]> {
  const map: Record<number, File[]> = {};
  for (const f of files) {
    const m = f.name.match(/tarefa[_-]?(\d+)/i);
    if (m) {
      const n = parseInt(m[1]);
      if (!map[n]) map[n] = [];
      map[n].push(f);
    }
  }
  return map;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Shared ─────────────────────────────────────────────────────────────── */
function Period({ start, end }: { start?: string | null; end?: string | null }) {
  if (!start && !end) return null;
  const text = start === end || !end ? start : `${start} → ${end}`;
  return (
    <span className="inline-flex items-center gap-1 text-xs rounded-md px-2 py-0.5"
      style={{ background: 'var(--card)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2.5" />
        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="8"  y1="2" x2="8"  y2="6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="3"  y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
      </svg>
      {text}
    </span>
  );
}

function NotaBadge({ nota, dimVar, colorVar }: { nota?: number; dimVar: string; colorVar: string }) {
  if (nota === undefined || nota === null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs rounded-md px-2 py-0.5 font-medium"
      style={{ background: `var(${dimVar})`, color: `var(${colorVar})`, border: `1px solid var(${colorVar}-border)` }}>
      Peso: {nota}
    </span>
  );
}

type ActivityType = 'quiz' | 'tarefa' | 'forum';
const ACT_VAR:   Record<ActivityType, string> = { quiz: 'var(--quiz)',     tarefa: 'var(--tarefa)',     forum: 'var(--forum)'     };
const ACT_DIM:   Record<ActivityType, string> = { quiz: 'var(--quiz-dim)', tarefa: 'var(--tarefa-dim)', forum: 'var(--forum-dim)' };
const ACT_LABEL: Record<ActivityType, string> = { quiz: 'Quiz',            tarefa: 'Tarefa',             forum: 'Fórum'            };

function ActivityPill({ type }: { type: ActivityType }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color: ACT_VAR[type], background: ACT_DIM[type] }}>
      {ACT_LABEL[type]}
    </span>
  );
}

/* ─── Quiz Accordion ─────────────────────────────────────────────────────── */
function QuizAccordion({ questoes }: { questoes: Questao[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const letra = (n: number) => String.fromCharCode(65 + n);

  return (
    <div className="flex flex-col gap-1.5">
      {questoes.map((q, qi) => {
        const isOpen = openIdx === qi;
        return (
          <div key={qi} className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
            {/* Question header (always visible) */}
            <button
              className="flex items-center gap-2 w-full px-3 py-2.5 text-left"
              onClick={() => setOpenIdx(isOpen ? null : qi)}
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-md text-xs font-bold shrink-0"
                style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                {qi + 1}
              </span>
              <p className="flex-1 text-xs font-medium leading-snug" style={{ color: 'var(--text-1)' }}>
                {q.enunciado ?? '—'}
              </p>
              {q.pontuacao != null && (
                <span className="text-xs shrink-0 px-1.5 py-0.5 rounded-md"
                  style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                  {q.pontuacao}pt
                </span>
              )}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                className="shrink-0 transition-transform duration-200"
                style={{ color: 'var(--text-3)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Alternatives (animated expand) */}
            <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 300ms ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <div className="flex flex-col gap-1 px-3 pb-3">
                  {q.tipo === 'dissertativa' ? (
                    q.feedback ? (
                      <p className="text-xs px-2 py-1.5 rounded-lg italic"
                        style={{ background: 'var(--card)', color: 'var(--text-2)' }}>
                        {q.feedback}
                      </p>
                    ) : (
                      <p className="text-xs italic" style={{ color: 'var(--text-4)' }}>Dissertativa — sem gabarito automático.</p>
                    )
                  ) : (q.itens ?? []).map((item, ai) => {
                    const isCorrect = q.tipo === 'associativa'
                      ? item.resposta === 'V'
                      : item.isCorrect === true;
                    return (
                      <div key={ai} className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-lg"
                        style={{
                          background: isCorrect ? 'var(--tarefa-dim)' : 'var(--card)',
                          border:     isCorrect ? '1px solid var(--tarefa-border)' : '1px solid transparent',
                        }}>
                        <span className="font-bold shrink-0 w-4" style={{ color: isCorrect ? 'var(--tarefa)' : 'var(--text-3)' }}>
                          {q.tipo === 'associativa' ? (item.resposta ?? '?') : `${letra(ai)})`}
                        </span>
                        <span style={{ color: isCorrect ? 'var(--tarefa)' : 'var(--text-2)' }}>{item.texto}</span>
                        {isCorrect && q.tipo !== 'associativa' && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="ml-auto shrink-0 mt-0.5">
                            <path d="M5 12l5 5L19 7" stroke="var(--tarefa)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Aula Modal ─────────────────────────────────────────────────────────── */
function AulaModal({ aula, tarefaFiles, onClose }: { aula: Aula; tarefaFiles: File[]; onClose: () => void }) {
  const [viewFile, setViewFile] = useState<File | null>(null);
  const [visible, setVisible] = useState(false);
  const questoes = aula.quiz?.questoes ?? [];

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(3px)',
          opacity: visible ? 1 : 0, transition: 'opacity 300ms ease',
        }}
        onClick={onClose}
      >
        <div className="relative flex flex-col rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)',
            opacity: visible ? 1 : 0,
            transition: 'transform 300ms ease, opacity 300ms ease',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-5 shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0"
                style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                {aula.numero ?? '?'}
              </span>
              <div className="flex flex-col gap-1.5 min-w-0">
                <h3 className="text-base font-semibold leading-snug" style={{ color: 'var(--text-1)' }}>
                  {aula.titulo ?? 'Sem título'}
                </h3>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <Period start={aula.data_inicio} end={aula.data_fim} />
                  {aula.quiz   && <ActivityPill type="quiz" />}
                  {aula.tarefa && <ActivityPill type="tarefa" />}
                  {aula.forum  && <ActivityPill type="forum" />}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ background: 'var(--card)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
            {/* Descrição */}
            {aula.descricao && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Descrição</span>
                <p className="text-sm leading-relaxed rounded-xl p-4"
                  style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  {aula.descricao}
                </p>
              </div>
            )}

            {/* Quiz */}
            {aula.quiz && (() => {
              const q = aula.quiz!;
              return (
                <div className="flex flex-col gap-3 rounded-xl p-4"
                  style={{ background: 'var(--quiz-dim)', border: '1px solid var(--quiz-border)' }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--quiz)' }}>Quiz</span>
                      {q.titulo && <span className="text-xs" style={{ color: 'var(--text-3)' }}>— {q.titulo}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <NotaBadge nota={q.nota} dimVar="--quiz-dim" colorVar="--quiz" />
                      <Period start={q.data_inicio} end={q.data_fim} />
                    </div>
                  </div>

                  {questoes.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
                      style={{ border: '1px dashed var(--quiz-border)', color: 'var(--text-2)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="var(--quiz)" strokeWidth="2" />
                        <line x1="12" y1="8" x2="12" y2="12" stroke="var(--quiz)" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="12" cy="16" r="1" fill="var(--quiz)" />
                      </svg>
                      As questões serão carregadas a partir dos arquivos .docx na etapa de geração.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                        {questoes.length} questão(ões) — clique para expandir
                      </span>
                      <QuizAccordion questoes={questoes} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tarefa */}
            {aula.tarefa && (() => {
              const t = aula.tarefa!;
              return (
                <div className="flex flex-col gap-3 rounded-xl p-4"
                  style={{ background: 'var(--tarefa-dim)', border: '1px solid var(--tarefa-border)' }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--tarefa)' }}>Tarefa</span>
                      {t.titulo && <span className="text-xs" style={{ color: 'var(--text-3)' }}>— {t.titulo}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <NotaBadge nota={t.nota} dimVar="--tarefa-dim" colorVar="--tarefa" />
                      <Period start={t.data_inicio} end={t.data_fim} />
                    </div>
                  </div>

                  {t.descricao && (
                    <p className="text-xs leading-relaxed rounded-lg p-3"
                      style={{ background: 'var(--bg)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      {t.descricao}
                    </p>
                  )}

                  {/* Uploaded files (client-side File objects) */}
                  {tarefaFiles.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                        {tarefaFiles.length} arquivo(s) anexado(s)
                      </span>
                      {tarefaFiles.map((f, fi) => {
                        const isPdf  = /\.pdf$/i.test(f.name);
                        const isDocx = /\.docx?$/i.test(f.name);
                        const canPreview = isPdf || isDocx;
                        return (
                          <div key={fi} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                stroke={isPdf ? 'var(--error)' : 'var(--tarefa)'} strokeWidth="1.5" strokeLinecap="round" />
                              <polyline points="14,2 14,8 20,8"
                                stroke={isPdf ? 'var(--error)' : 'var(--tarefa)'} strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            <span className="flex-1 truncate" style={{ color: 'var(--text-2)' }} title={f.name}>{f.name}</span>
                            <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                              {(f.size / 1024).toFixed(0)} KB
                            </span>
                            {canPreview && (
                              <button
                                onClick={() => setViewFile(f)}
                                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-all"
                                style={{ background: 'var(--tarefa-dim)', color: 'var(--tarefa)', border: '1px solid var(--tarefa-border)' }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                Ver
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                      style={{ border: '1px dashed var(--tarefa-border)', color: 'var(--text-2)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="var(--tarefa)" strokeWidth="2" />
                        <line x1="12" y1="8" x2="12" y2="12" stroke="var(--tarefa)" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="12" cy="16" r="1" fill="var(--tarefa)" />
                      </svg>
                      Nenhum arquivo carregado para esta tarefa.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Fórum */}
            {aula.forum && (() => {
              const f = aula.forum!;
              return (
                <div className="flex flex-col gap-3 rounded-xl p-4"
                  style={{ background: 'var(--forum-dim)', border: '1px solid var(--forum-border)' }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--forum)' }}>Fórum</span>
                      {f.titulo && <span className="text-xs" style={{ color: 'var(--text-3)' }}>— {f.titulo}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <NotaBadge nota={f.nota} dimVar="--forum-dim" colorVar="--forum" />
                      <Period start={f.data_inicio} end={f.data_fim} />
                    </div>
                  </div>
                  {f.descricao && (
                    <p className="text-xs leading-relaxed rounded-lg p-3"
                      style={{ background: 'var(--bg)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      {f.descricao}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* File viewer (stacked above modal) */}
      {viewFile && <FileViewer file={viewFile} onClose={() => setViewFile(null)} />}
    </>
  );
}

/* ─── Aula Card ──────────────────────────────────────────────────────────── */
function AulaCard({ aula, tarefaFiles }: { aula: Aula; tarefaFiles: File[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col gap-3 rounded-xl p-4 text-left w-full transition-all duration-150"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <div className="flex items-start gap-2.5">
          <span className="flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold shrink-0"
            style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
            {aula.numero ?? '?'}
          </span>
          <p className="flex-1 text-sm font-medium leading-snug" style={{ color: 'var(--text-1)' }}>
            {aula.titulo ?? 'Sem título'}
          </p>
        </div>

        {(aula.data_inicio || aula.data_fim) && (
          <div className="ml-8"><Period start={aula.data_inicio} end={aula.data_fim} /></div>
        )}

        <div className="flex items-center justify-between ml-8">
          <div className="flex flex-wrap gap-1">
            {aula.quiz   && <ActivityPill type="quiz" />}
            {aula.tarefa && <ActivityPill type="tarefa" />}
            {aula.forum  && <ActivityPill type="forum" />}
            {tarefaFiles.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
                style={{ color: 'var(--text-3)', background: 'var(--card)', border: '1px solid var(--border)' }}>
                {tarefaFiles.length} arquivo(s)
              </span>
            )}
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--border)', flexShrink: 0 }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      </button>

      {open && (
        <AulaModal aula={aula} tarefaFiles={tarefaFiles} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/* ─── Visual View ────────────────────────────────────────────────────────── */
function VisualView({ data, tarefaMap }: { data: MatrizData; tarefaMap: Record<number, File[]> }) {
  const aulas = data.aulas ?? [];

  // Assign tarefa files to each aula by count order (same logic as server.js)
  let tarefaCounter = 0;
  const aulaFiles: File[][] = aulas.map(aula => {
    if (aula.tarefa) {
      tarefaCounter++;
      return tarefaMap[tarefaCounter] ?? [];
    }
    return [];
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Metadata */}
      <div className="grid gap-3 rounded-xl p-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {([
          ['Disciplina', data.disciplina?.nome],
          ['Código',     data.disciplina?.codigo],
          ['C.H.',       data.disciplina?.carga_horaria],
          ['Semestre',   data.disciplina?.semestre],
          ['Turma',      data.disciplina?.turma],
          ['Polo',       data.disciplina?.polo],
          ['Professor',  data.professor?.nome],
          ['Tutor',      data.professor?.tutor],
        ] as [string, string | undefined][]).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-4)' }}>{label}</span>
            <span className="text-sm font-medium truncate" style={{ color: value ? 'var(--text-1)' : 'var(--border)' }} title={value ?? ''}>
              {value ?? '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['Aulas',   aulas.length,                        '--primary', '--primary-dim', '--border'],
          ['Quizzes', aulas.filter(a => a.quiz).length,   '--quiz',    '--quiz-dim',    '--quiz-border'],
          ['Tarefas', aulas.filter(a => a.tarefa).length, '--tarefa',  '--tarefa-dim',  '--tarefa-border'],
          ['Fóruns',  aulas.filter(a => a.forum).length,  '--forum',   '--forum-dim',   '--forum-border'],
        ] as [string, number, string, string, string][]).map(([label, value, color, dim, bdr]) => (
          <div key={label} className="flex items-center gap-2 rounded-lg px-4 py-2.5"
            style={{ background: `var(${dim})`, border: `1px solid var(${bdr})` }}>
            <span className="text-2xl font-bold" style={{ color: `var(${color})` }}>{value}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {aulas.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: 'var(--border)' }}>Nenhuma aula extraída.</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
          {aulas.map((aula, i) => (
            <AulaCard key={i} aula={aula} tarefaFiles={aulaFiles[i]} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── JSON View ──────────────────────────────────────────────────────────── */
function JsonView({ json, onJsonChange, parseError }: { json: string; onJsonChange: (s: string) => void; parseError: string | null }) {
  function format() {
    try { onJsonChange(JSON.stringify(JSON.parse(json), null, 2)); } catch { /* leave */ }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs">
          {parseError
            ? <span style={{ color: 'var(--error)' }}>⚠ {parseError}</span>
            : <span style={{ color: 'var(--tarefa)' }}>✓ JSON válido</span>}
        </span>
        <button onClick={format}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
          style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 10h16M4 14h10M4 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Formatar
        </button>
      </div>
      <textarea
        value={json}
        onChange={e => onJsonChange(e.target.value)}
        spellCheck={false}
        className="w-full resize-none rounded-xl p-4 text-sm leading-relaxed outline-none"
        style={{
          background:  'var(--bg)',
          border:      parseError ? '1px solid var(--error-border)' : '1px solid var(--border)',
          color:       'var(--text-1)',
          fontFamily:  '"Fira Code","JetBrains Mono",Consolas,monospace',
          minHeight:   '520px',
        }}
      />
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
type Props = {
  json: string;
  onJsonChange: (s: string) => void;
  onGenerate: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  tarefaFiles: File[];
};

export default function ReviewStep({ json, onJsonChange, onGenerate, onBack, loading, error, tarefaFiles }: Props) {
  const [view, setView] = useState<'visual' | 'json'>('visual');
  const { data, error: parseError } = parseJsonSafe(json);
  const canGenerate = !parseError && !loading;
  const tarefaMap = buildTarefaMap(tarefaFiles);

  return (
    <div className="flex flex-col gap-5">
      {/* Header + toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-1)' }}>Revisar dados extraídos</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>Clique em uma aula para ver detalhes e arquivos.</p>
        </div>

        <div className="flex rounded-lg overflow-hidden shrink-0"
          style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
          {(['visual', 'json'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all"
              style={{ background: view === v ? 'var(--primary)' : 'transparent', color: view === v ? 'var(--primary-text)' : 'var(--text-3)' }}>
              {v === 'visual' ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3"   width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  <rect x="14" y="3"  width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  <rect x="3" y="14"  width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                </svg>Visual</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 8v8M9 11l3-3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>JSON</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === 'visual' && data  && <VisualView data={data} tarefaMap={tarefaMap} />}
      {view === 'visual' && !data && (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl"
          style={{ background: 'var(--error-dim)', border: '1px solid var(--error-border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>JSON inválido — alterne para a aba JSON para corrigir.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{parseError}</p>
        </div>
      )}
      {view === 'json' && <JsonView json={json} onJsonChange={onJsonChange} parseError={parseError} />}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--error-dim)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" stroke="var(--error)" strokeWidth="1.5" />
            <line x1="12" y1="8" x2="12" y2="12" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="var(--error)" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={onBack} disabled={loading}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
          style={{ background: 'transparent', color: loading ? 'var(--text-4)' : 'var(--text-2)', border: '1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Voltar
        </button>
        <button onClick={onGenerate} disabled={!canGenerate}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
          style={{ background: !canGenerate ? 'var(--card)' : 'var(--primary)', color: !canGenerate ? 'var(--text-4)' : 'var(--primary-text)', cursor: !canGenerate ? 'not-allowed' : 'pointer' }}>
          {loading
            ? <><Spinner />Gerando...</>
            : <>Gerar MBZ <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></>}
        </button>
      </div>
    </div>
  );
}
