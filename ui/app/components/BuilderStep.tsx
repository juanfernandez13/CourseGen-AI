'use client';

import { useState, useEffect, useRef, ChangeEvent, DragEvent } from 'react';

/* ─── Types ────────────────────────────────────────────────────────────────── */
type Questao = {
  tipo: 'multipla_escolha' | 'associativa' | 'dissertativa';
  enunciado: string;
  pontuacao: number;
  itens: { texto: string; isCorrect?: boolean; resposta?: string }[];
  feedback?: string;
};

type Quiz = {
  titulo: string;
  nota: number;
  data_inicio: string;
  data_fim: string;
  questoes: Questao[];
};

type TarefaArquivo = { name: string; size: number };

type Tarefa = {
  titulo: string;
  nota: number;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  arquivos: TarefaArquivo[];
};

type Forum = {
  titulo: string;
  nota: number;
  descricao: string;
  arquivos: TarefaArquivo[];
};

type Aula = {
  numero: number;
  titulo: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  forums: Forum[];
  quizzes: Quiz[];
  tarefas: Tarefa[];
};

type Categoria = { nome: string; peso: number };

type BuilderData = {
  disciplina: { nome: string; codigo: string; carga_horaria: string; curso: string; semestre: string; turma: string };
  professor: { nome: string; email: string; titulacao: string };
  livro_de_notas: { categorias: Categoria[] };
  aulas: Aula[];
};

const STORAGE_KEY = 'ifce-builder-data';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function emptyAula(n: number): Aula {
  return {
    numero: n, titulo: `Aula ${n}`, descricao: '',
    data_inicio: '', data_fim: '',
    forums: [], quizzes: [], tarefas: [],
  };
}

function emptyForum(aulaNum: number): Forum {
  return { titulo: `[Aula ${aulaNum}] Fórum`, nota: 5, descricao: '', arquivos: [] };
}

function emptyQuiz(): Quiz {
  return { titulo: '', nota: 5, data_inicio: '', data_fim: '', questoes: [] };
}

function emptyTarefa(): Tarefa {
  return { titulo: '', nota: 10, descricao: '', data_inicio: '', data_fim: '', arquivos: [] };
}

function emptyQuestao(): Questao {
  return {
    tipo: 'multipla_escolha', enunciado: '', pontuacao: 1,
    itens: [
      { texto: '', isCorrect: true },
      { texto: '', isCorrect: false },
      { texto: '', isCorrect: false },
      { texto: '', isCorrect: false },
    ],
  };
}

function defaultData(): BuilderData {
  return {
    disciplina: { nome: '', codigo: '', carga_horaria: '', curso: '', semestre: '', turma: '' },
    professor: { nome: '', email: '', titulacao: '' },
    livro_de_notas: {
      categorias: [
        { nome: 'Atividades a distância', peso: 40 },
        { nome: 'Atividades presenciais', peso: 60 },
      ],
    },
    aulas: [],
  };
}

function loadSaved(): BuilderData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function persist(data: BuilderData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* full */ }
}

/* ─── Shared UI ────────────────────────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
      />
    </div>
  );
}

function DateField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  function handleInput(raw: string) {
    // Auto-insert slashes as the user types digits
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) formatted += '/';
      formatted += digits[i];
    }
    onChange(formatted);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => handleInput(e.target.value)}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
      />
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 100 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</label>
      <input
        type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        min={min} max={max}
        className="rounded-lg px-3 py-2 text-sm outline-none w-24"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 2 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</label>
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
      />
    </div>
  );
}

function SectionTitle({ children, color = 'var(--text-1)' }: { children: React.ReactNode; color?: string }) {
  return <h3 className="text-sm font-bold" style={{ color }}>{children}</h3>;
}

/* ─── File Drop Zone (compact) ─────────────────────────────────────────────── */
function FileDrop({ files, onChange, accept = '*' }: {
  files: TarefaArquivo[]; onChange: (f: TarefaArquivo[]) => void; accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function add(fileList: FileList | File[]) {
    const arr = Array.from(fileList).map(f => ({ name: f.name, size: f.size }));
    onChange([...files, ...arr]);
  }
  function handleDrop(e: DragEvent) { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }
  function handleChange(e: ChangeEvent<HTMLInputElement>) { if (e.target.files) add(e.target.files); e.target.value = ''; }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Arquivos</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        className="flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-all"
        style={{
          padding: '8px 12px',
          background: drag ? 'var(--primary-dim)' : 'var(--bg)',
          border: drag ? '2px dashed var(--primary)' : '2px dashed var(--border)',
        }}>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handleChange} />
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
          <polyline points="17,8 12,3 7,8" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="3" x2="12" y2="15" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{drag ? 'Solte aqui' : 'Arraste ou clique'}</span>
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              {f.name}
              <button onClick={e => { e.stopPropagation(); onChange(files.filter((_, j) => j !== i)); }}
                style={{ color: 'var(--text-4)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Question Editor ──────────────────────────────────────────────────────── */
function QuestaoEditor({ q, onChange, onRemove }: { q: Questao; onChange: (q: Questao) => void; onRemove: () => void }) {
  const updateItem = (idx: number, patch: Partial<Questao['itens'][0]>) => {
    const itens = q.itens.map((it, i) => i === idx ? { ...it, ...patch } : it);
    onChange({ ...q, itens });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl p-4"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 flex flex-col gap-2">
          <TextArea label="Enunciado" value={q.enunciado} onChange={v => onChange({ ...q, enunciado: v })} placeholder="Texto da questão..." />
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Tipo</label>
              <select value={q.tipo}
                onChange={e => {
                  const tipo = e.target.value as Questao['tipo'];
                  let itens = q.itens;
                  if (tipo === 'dissertativa') itens = [];
                  else if (tipo === 'associativa') itens = itens.length ? itens.map(it => ({ ...it, resposta: 'V', isCorrect: undefined })) : [{ texto: '', resposta: 'V' }, { texto: '', resposta: 'F' }];
                  else itens = itens.length ? itens.map(it => ({ ...it, isCorrect: it.isCorrect ?? false, resposta: undefined })) : emptyQuestao().itens;
                  onChange({ ...q, tipo, itens });
                }}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
                <option value="multipla_escolha">Múltipla escolha</option>
                <option value="associativa">Associativa (V/F)</option>
                <option value="dissertativa">Dissertativa</option>
              </select>
            </div>
            <NumberField label="Pontuação" value={q.pontuacao} onChange={v => onChange({ ...q, pontuacao: v })} min={0} max={100} />
          </div>
        </div>
        <button onClick={onRemove} className="shrink-0 mt-4 p-1 rounded-md" style={{ color: 'var(--error)' }} title="Remover questão">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {q.tipo === 'dissertativa' ? (
        <TextArea label="Feedback (opcional)" value={q.feedback ?? ''} onChange={v => onChange({ ...q, feedback: v })} placeholder="Gabarito/feedback..." />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
              {q.tipo === 'associativa' ? 'Afirmações (V/F)' : 'Alternativas'}
            </span>
            <button onClick={() => onChange({ ...q, itens: [...q.itens, q.tipo === 'associativa' ? { texto: '', resposta: 'V' } : { texto: '', isCorrect: false }] })}
              className="text-xs px-2 py-1 rounded-md"
              style={{ background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-ring)' }}>
              + Alternativa
            </button>
          </div>
          {q.itens.map((item, ai) => (
            <div key={ai} className="flex items-center gap-2">
              {q.tipo === 'associativa' ? (
                <select value={item.resposta ?? 'V'} onChange={e => updateItem(ai, { resposta: e.target.value })}
                  className="rounded-md px-2 py-1.5 text-xs font-bold w-12 text-center outline-none"
                  style={{ background: item.resposta === 'V' ? 'var(--tarefa-dim)' : 'var(--error-dim)', color: item.resposta === 'V' ? 'var(--tarefa)' : 'var(--error)', border: '1px solid var(--border)' }}>
                  <option value="V">V</option>
                  <option value="F">F</option>
                </select>
              ) : (
                <button onClick={() => { const itens = q.itens.map((it, i) => ({ ...it, isCorrect: i === ai })); onChange({ ...q, itens }); }}
                  className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 border-2 transition-all"
                  style={{ borderColor: item.isCorrect ? 'var(--tarefa)' : 'var(--border)', background: item.isCorrect ? 'var(--tarefa)' : 'transparent' }}
                  title="Marcar como correta">
                  {item.isCorrect && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>}
                </button>
              )}
              <input value={item.texto} onChange={e => updateItem(ai, { texto: e.target.value })}
                placeholder={`Alternativa ${String.fromCharCode(65 + ai)}`}
                className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
              {q.itens.length > 2 && (
                <button onClick={() => onChange({ ...q, itens: q.itens.filter((_, i) => i !== ai) })}
                  className="shrink-0 p-1 rounded-md" style={{ color: 'var(--text-4)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Aula Modal (create / edit) ───────────────────────────────────────────── */
function AulaModal({ aula, categorias, onSave, onClose, isNew }: {
  aula: Aula; categorias: Categoria[]; onSave: (a: Aula) => void; onClose: () => void; isNew: boolean;
}) {
  const [a, setA] = useState<Aula>(aula);
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const eadCat = categorias.find(c => c.nome.toLowerCase().includes('distância'));
  const presCat = categorias.find(c => c.nome.toLowerCase().includes('presencial'));

  const updateForum = (idx: number, patch: Partial<Forum>) => setA(prev => ({
    ...prev, forums: prev.forums.map((f, i) => i === idx ? { ...f, ...patch } : f),
  }));
  const updateQuiz = (idx: number, patch: Partial<Quiz>) => setA(prev => ({
    ...prev, quizzes: prev.quizzes.map((q, i) => i === idx ? { ...q, ...patch } : q),
  }));
  const updateTarefa = (idx: number, patch: Partial<Tarefa>) => setA(prev => ({
    ...prev, tarefas: prev.tarefas.map((t, i) => i === idx ? { ...t, ...patch } : t),
  }));

  function handleSave() { onSave(a); onClose(); }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh] overflow-y-auto"
      style={{
        background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(3px)',
        opacity: visible ? 1 : 0, transition: 'opacity 200ms ease',
      }}
      onClick={onClose}>
      <div
        className="relative flex flex-col rounded-2xl w-full max-w-3xl"
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          opacity: visible ? 1 : 0, transition: 'transform 200ms ease, opacity 200ms ease',
          marginBottom: '5vh',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>
            {isNew ? 'Nova aula' : `Editar Aula ${a.numero}`}
          </h3>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: 'var(--card)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-5 overflow-y-auto" style={{ maxHeight: '75vh' }}>
          {/* Basic info */}
          <div className="grid grid-cols-1 gap-3">
            <Field label="Título" value={a.titulo} onChange={v => setA({ ...a, titulo: v })} placeholder="Aula 1 – Introdução..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateField label="Data início" value={a.data_inicio} onChange={v => setA({ ...a, data_inicio: v })} />
            <DateField label="Data fim" value={a.data_fim} onChange={v => setA({ ...a, data_fim: v })} />
          </div>
          <TextArea label="Descrição" value={a.descricao} onChange={v => setA({ ...a, descricao: v })} placeholder="Conteúdo da aula..." />

          {/* ── FÓRUNS ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle color="var(--forum)">Fóruns ({a.forums.length})</SectionTitle>
              <button onClick={() => setA({ ...a, forums: [...a.forums, emptyForum(a.numero)] })}
                className="text-xs px-2.5 py-1 rounded-md font-medium"
                style={{ background: 'var(--forum-dim)', color: 'var(--forum)', border: '1px solid var(--forum-border)' }}>
                + Fórum
              </button>
            </div>
            {a.forums.map((f, fi) => (
              <div key={fi} className="flex flex-col gap-3 rounded-xl p-4"
                style={{ background: 'var(--forum-dim)', border: '1px solid var(--forum-border)' }}>
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold" style={{ color: 'var(--forum)' }}>Fórum {fi + 1}</span>
                  <button onClick={() => setA({ ...a, forums: a.forums.filter((_, i) => i !== fi) })}
                    className="p-1 rounded-md" style={{ color: 'var(--error)' }} title="Remover">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <Field label="Título" value={f.titulo} onChange={v => updateForum(fi, { titulo: v })} />
                <div className="flex gap-3 items-end">
                  <NumberField label="Peso" value={f.nota} onChange={v => updateForum(fi, { nota: v })} />
                  {eadCat && <span className="text-xs pb-2" style={{ color: 'var(--text-4)' }}>Cat: {eadCat.nome} ({eadCat.peso}%)</span>}
                </div>
                <TextArea label="Descrição" value={f.descricao} onChange={v => updateForum(fi, { descricao: v })} placeholder="Tema do fórum..." />
                <FileDrop files={f.arquivos} onChange={arquivos => updateForum(fi, { arquivos })} />
              </div>
            ))}
          </div>

          {/* ── QUIZZES ────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle color="var(--quiz)">Quizzes ({a.quizzes.length})</SectionTitle>
              <button onClick={() => setA({ ...a, quizzes: [...a.quizzes, emptyQuiz()] })}
                className="text-xs px-2.5 py-1 rounded-md font-medium"
                style={{ background: 'var(--quiz-dim)', color: 'var(--quiz)', border: '1px solid var(--quiz-border)' }}>
                + Quiz
              </button>
            </div>
            {a.quizzes.map((q, qi) => (
              <div key={qi} className="flex flex-col gap-3 rounded-xl p-4"
                style={{ background: 'var(--quiz-dim)', border: '1px solid var(--quiz-border)' }}>
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold" style={{ color: 'var(--quiz)' }}>Quiz {qi + 1}</span>
                  <button onClick={() => setA({ ...a, quizzes: a.quizzes.filter((_, i) => i !== qi) })}
                    className="p-1 rounded-md" style={{ color: 'var(--error)' }} title="Remover">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Título" value={q.titulo} onChange={v => updateQuiz(qi, { titulo: v })} />
                  <NumberField label="Peso" value={q.nota} onChange={v => updateQuiz(qi, { nota: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DateField label="Início" value={q.data_inicio} onChange={v => updateQuiz(qi, { data_inicio: v })} />
                  <DateField label="Fim" value={q.data_fim} onChange={v => updateQuiz(qi, { data_fim: v })} />
                </div>
                {eadCat && <span className="text-xs" style={{ color: 'var(--text-4)' }}>Cat: {eadCat.nome} ({eadCat.peso}%)</span>}

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                    {q.questoes.length} questão(ões)
                  </span>
                  <button onClick={() => updateQuiz(qi, { questoes: [...q.questoes, emptyQuestao()] })}
                    className="text-xs px-2.5 py-1 rounded-md font-medium"
                    style={{ background: 'var(--quiz-dim)', color: 'var(--quiz)', border: '1px solid var(--quiz-border)' }}>
                    + Questão
                  </button>
                </div>
                {q.questoes.map((qq, qqi) => (
                  <QuestaoEditor key={qqi} q={qq}
                    onChange={nq => {
                      const questoes = q.questoes.map((x, i) => i === qqi ? nq : x);
                      updateQuiz(qi, { questoes });
                    }}
                    onRemove={() => updateQuiz(qi, { questoes: q.questoes.filter((_, i) => i !== qqi) })}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* ── TAREFAS ────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionTitle color="var(--tarefa)">Tarefas ({a.tarefas.length})</SectionTitle>
              <button onClick={() => setA({ ...a, tarefas: [...a.tarefas, emptyTarefa()] })}
                className="text-xs px-2.5 py-1 rounded-md font-medium"
                style={{ background: 'var(--tarefa-dim)', color: 'var(--tarefa)', border: '1px solid var(--tarefa-border)' }}>
                + Tarefa
              </button>
            </div>
            {a.tarefas.map((t, ti) => (
              <div key={ti} className="flex flex-col gap-3 rounded-xl p-4"
                style={{ background: 'var(--tarefa-dim)', border: '1px solid var(--tarefa-border)' }}>
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold" style={{ color: 'var(--tarefa)' }}>Tarefa {ti + 1}</span>
                  <button onClick={() => setA({ ...a, tarefas: a.tarefas.filter((_, i) => i !== ti) })}
                    className="p-1 rounded-md" style={{ color: 'var(--error)' }} title="Remover">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <Field label="Título" value={t.titulo} onChange={v => updateTarefa(ti, { titulo: v })} />
                <div className="flex gap-3 items-end">
                  <NumberField label="Peso" value={t.nota} onChange={v => updateTarefa(ti, { nota: v })} />
                  {presCat && <span className="text-xs pb-2" style={{ color: 'var(--text-4)' }}>Cat: {presCat.nome} ({presCat.peso}%)</span>}
                </div>
                <TextArea label="Descrição" value={t.descricao} onChange={v => updateTarefa(ti, { descricao: v })} placeholder="Instruções da tarefa..." />
                <div className="grid grid-cols-2 gap-3">
                  <DateField label="Início" value={t.data_inicio} onChange={v => updateTarefa(ti, { data_inicio: v })} />
                  <DateField label="Fim" value={t.data_fim} onChange={v => updateTarefa(ti, { data_fim: v })} />
                </div>
                <FileDrop files={t.arquivos} onChange={arquivos => updateTarefa(ti, { arquivos })}
                  accept=".docx,.doc,.pdf,.xlsx,.xls,.ppt,.pptx,.png,.jpg,.jpeg,.zip" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            Cancelar
          </button>
          <button onClick={handleSave}
            className="rounded-lg px-5 py-2 text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-text)' }}>
            {isNew ? 'Criar aula' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Aula Card (grid) ─────────────────────────────────────────────────────── */
function AulaCard({ aula, onEdit, onRemove }: { aula: Aula; onEdit: () => void; onRemove: () => void }) {
  const totalActivities = aula.forums.length + aula.quizzes.length + aula.tarefas.length;
  return (
    <div className="flex flex-col rounded-xl overflow-hidden transition-all duration-150"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      {/* Top */}
      <button onClick={onEdit} className="flex flex-col gap-2.5 p-4 text-left w-full">
        <div className="flex items-start gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0"
            style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
            {aula.numero}
          </span>
          <p className="flex-1 text-sm font-semibold leading-snug" style={{ color: 'var(--text-1)' }}>
            {aula.titulo || `Aula ${aula.numero}`}
          </p>
        </div>

        {(aula.data_inicio || aula.data_fim) && (
          <span className="inline-flex items-center gap-1 text-xs rounded-md px-2 py-0.5 ml-9"
            style={{ background: 'var(--bg)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2.5" />
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
            </svg>
            {aula.data_inicio}{aula.data_fim && aula.data_fim !== aula.data_inicio ? ` → ${aula.data_fim}` : ''}
          </span>
        )}

        {/* Activity pills */}
        <div className="flex flex-wrap gap-1 ml-9">
          {aula.forums.length > 0 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ color: 'var(--forum)', background: 'var(--forum-dim)' }}>
              {aula.forums.length} Fórum{aula.forums.length > 1 ? 's' : ''}
            </span>
          )}
          {aula.quizzes.length > 0 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ color: 'var(--quiz)', background: 'var(--quiz-dim)' }}>
              {aula.quizzes.length} Quiz{aula.quizzes.length > 1 ? 'zes' : ''}
            </span>
          )}
          {aula.tarefas.length > 0 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ color: 'var(--tarefa)', background: 'var(--tarefa-dim)' }}>
              {aula.tarefas.length} Tarefa{aula.tarefas.length > 1 ? 's' : ''}
            </span>
          )}
          {totalActivities === 0 && (
            <span className="text-xs" style={{ color: 'var(--text-4)' }}>Sem atividades</span>
          )}
        </div>
      </button>

      {/* Bottom actions */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={onEdit} className="flex items-center gap-1 text-xs font-medium"
          style={{ color: 'var(--primary)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Editar
        </button>
        <button onClick={onRemove} className="flex items-center gap-1 text-xs"
          style={{ color: 'var(--error)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Remover
        </button>
      </div>
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
type Props = { onDone: (json: string) => void };

export default function BuilderStep({ onDone }: Props) {
  const [data, setData] = useState<BuilderData>(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadSaved();
    if (saved) setData(saved);
    setLoaded(true);
  }, []);

  // Persist on every change (after initial load)
  useEffect(() => {
    if (loaded) persist(data);
  }, [data, loaded]);

  const updateDisc = (k: string, v: string) => setData(d => ({ ...d, disciplina: { ...d.disciplina, [k]: v } }));
  const updateProf = (k: string, v: string) => setData(d => ({ ...d, professor: { ...d.professor, [k]: v } }));

  const saveAula = (idx: number, aula: Aula) => setData(d => ({
    ...d, aulas: d.aulas.map((a, i) => i === idx ? aula : a),
  }));
  const removeAula = (idx: number) => setData(d => ({
    ...d, aulas: d.aulas.filter((_, i) => i !== idx).map((a, i) => ({ ...a, numero: i + 1 })),
  }));
  const addAula = (aula: Aula) => setData(d => ({
    ...d, aulas: [...d.aulas, { ...aula, numero: d.aulas.length + 1 }],
  }));

  const updateCategoria = (idx: number, patch: Partial<Categoria>) => setData(d => ({
    ...d, livro_de_notas: {
      ...d.livro_de_notas,
      categorias: d.livro_de_notas.categorias.map((c, i) => i === idx ? { ...c, ...patch } : c),
    },
  }));

  const totalPeso = data.livro_de_notas.categorias.reduce((s, c) => s + c.peso, 0);

  function handleClear() {
    setData(defaultData());
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleGenerate() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any = {
      disciplina: data.disciplina,
      professor: data.professor,
      livro_de_notas: data.livro_de_notas,
      aulas: data.aulas.map(a => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aula: any = {
          numero: a.numero, titulo: a.titulo, descricao: a.descricao,
          data_inicio: a.data_inicio, data_fim: a.data_fim,
        };
        // Keep backward compat: single forum/quiz/tarefa uses singular keys,
        // multiple uses arrays. For the MBZ generator the first of each is what matters.
        if (a.forums.length === 1) aula.forum = a.forums[0];
        else if (a.forums.length > 1) aula.forums = a.forums;
        if (a.quizzes.length === 1) aula.quiz = a.quizzes[0];
        else if (a.quizzes.length > 1) aula.quizzes = a.quizzes;
        if (a.tarefas.length === 1) aula.tarefa = a.tarefas[0];
        else if (a.tarefas.length > 1) aula.tarefas = a.tarefas;
        return aula;
      }),
    };
    onDone(JSON.stringify(output, null, 2));
  }

  if (!loaded) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-1)' }}>Criar curso manualmente</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
            Preencha os dados da disciplina e crie aulas com fóruns, quizzes e tarefas.
          </p>
        </div>
        <button onClick={handleClear}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shrink-0"
          style={{ color: 'var(--error)', background: 'var(--error-dim)', border: '1px solid var(--error-border)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Limpar dados
        </button>
      </div>

      {/* Disciplina + Professor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 rounded-xl p-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <SectionTitle>Disciplina</SectionTitle>
          <Field label="Nome" value={data.disciplina.nome} onChange={v => updateDisc('nome', v)} placeholder="Ex: Geometria Analítica" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código" value={data.disciplina.codigo} onChange={v => updateDisc('codigo', v)} placeholder="MAT001" />
            <Field label="Carga horária" value={data.disciplina.carga_horaria} onChange={v => updateDisc('carga_horaria', v)} placeholder="80h" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Curso" value={data.disciplina.curso} onChange={v => updateDisc('curso', v)} placeholder="Eng. Civil" />
            <Field label="Semestre" value={data.disciplina.semestre} onChange={v => updateDisc('semestre', v)} placeholder="2025.1" />
            <Field label="Turma" value={data.disciplina.turma} onChange={v => updateDisc('turma', v)} placeholder="A" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl p-4"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <SectionTitle>Professor</SectionTitle>
            <Field label="Nome" value={data.professor.nome} onChange={v => updateProf('nome', v)} placeholder="Dr. João Silva" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail" value={data.professor.email} onChange={v => updateProf('email', v)} placeholder="joao@ifce.edu.br" />
              <Field label="Titulação" value={data.professor.titulacao} onChange={v => updateProf('titulacao', v)} placeholder="Doutor" />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl p-4"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <SectionTitle>Livro de notas</SectionTitle>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                style={{
                  background: totalPeso === 100 ? 'var(--tarefa-dim)' : 'var(--error-dim)',
                  color: totalPeso === 100 ? 'var(--tarefa)' : 'var(--error)',
                  border: totalPeso === 100 ? '1px solid var(--tarefa-border)' : '1px solid var(--error-border)',
                }}>
                Total: {totalPeso}%
              </span>
            </div>
            {data.livro_de_notas.categorias.map((cat, ci) => (
              <div key={ci} className="flex items-end gap-3">
                <div className="flex-1">
                  <Field label="Categoria" value={cat.nome} onChange={v => updateCategoria(ci, { nome: v })} />
                </div>
                <NumberField label="Peso (%)" value={cat.peso} onChange={v => updateCategoria(ci, { peso: v })} min={0} max={100} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aulas — grid */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Aulas ({data.aulas.length})</SectionTitle>
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
            style={{ background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-ring)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Nova aula
          </button>
        </div>

        {data.aulas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl"
            style={{ background: 'var(--card)', border: '2px dashed var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Nenhuma aula criada.</p>
            <button onClick={() => setShowNewModal(true)}
              className="mt-3 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: 'var(--primary)', color: 'var(--primary-text)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Criar primeira aula
            </button>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {data.aulas.map((aula, i) => (
              <AulaCard key={`${aula.numero}-${i}`} aula={aula}
                onEdit={() => setEditingIdx(i)}
                onRemove={() => removeAula(i)} />
            ))}
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="flex justify-end pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={handleGenerate}
          disabled={!data.disciplina.nome.trim()}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
          style={{
            background: data.disciplina.nome.trim() ? 'var(--primary)' : 'var(--card)',
            color: data.disciplina.nome.trim() ? 'var(--primary-text)' : 'var(--text-4)',
            cursor: data.disciplina.nome.trim() ? 'pointer' : 'not-allowed',
          }}>
          Revisar JSON
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      {showNewModal && (
        <AulaModal
          aula={emptyAula(data.aulas.length + 1)}
          categorias={data.livro_de_notas.categorias}
          isNew
          onSave={a => addAula(a)}
          onClose={() => setShowNewModal(false)}
        />
      )}
      {editingIdx !== null && data.aulas[editingIdx] && (
        <AulaModal
          aula={data.aulas[editingIdx]}
          categorias={data.livro_de_notas.categorias}
          isNew={false}
          onSave={a => saveAula(editingIdx, a)}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
}
