'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { extractJson, extractQuizzes } from '../lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeQuizQuestions(data: any, quizzes: { questoes: unknown[] }[]) {
  let idx = 0;
  for (const aula of (data.aulas || [])) {
    if (aula.quiz && idx < quizzes.length) {
      aula.quiz.questoes = quizzes[idx].questoes || [];
      idx++;
    }
  }
  return data;
}

type Props = {
  matrizFile: File | null;
  quizFiles: File[];
  tarefaFiles: File[];
  onMatrizChange: (f: File | null) => void;
  onQuizzesChange: (files: File[]) => void;
  onTarefasChange: (files: File[]) => void;
  onExtracted: (json: string) => void;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" />
    </svg>
  );
}

const EXT_COLORS: Record<string, string> = {
  pdf:  '#f87171',
  docx: 'var(--primary)',
  doc:  'var(--primary)',
  xlsx: '#34d399',
  pptx: '#fb923c',
  ppt:  '#fb923c',
};

function FileChip({ name, badge, onRemove }: { name: string; badge?: string; onRemove: () => void }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const color = EXT_COLORS[ext] ?? 'var(--primary)';

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
      style={{ background: 'var(--bg)', border: '1px solid var(--border-subtle)' }}
    >
      {badge && (
        <span
          className="text-xs font-bold rounded px-1.5 py-0.5 shrink-0"
          style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}
        >
          {badge}
        </span>
      )}
      {/* Extension icon */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <polyline points="14,2 14,8 20,8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span
        className="flex-1 truncate text-xs font-medium"
        style={{ color: 'var(--text-2)', maxWidth: '200px' }}
        title={name}
      >
        {name}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-red-500/10"
        title="Remover"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Drop Zone ─────────────────────────────────────────────────────────────── */
function DropZone({
  accept, multiple, onAdd, dragging, setDragging, compact = false,
}: {
  accept: string;
  multiple: boolean;
  onAdd: (files: File[]) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    onAdd(multiple ? Array.from(e.dataTransfer.files) : [e.dataTransfer.files[0]]);
  }
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onAdd(Array.from(e.target.files));
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 gap-2"
      style={{
        background: dragging ? 'var(--primary-dim)' : 'var(--bg)',
        border:     dragging ? '2px dashed var(--primary)' : '2px dashed var(--border)',
        padding:    compact ? '12px 16px' : '24px 16px',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleChange} />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
        <polyline points="17,8 12,3 7,8"                      stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="3" x2="12" y2="15"                 stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>
        {dragging ? 'Solte aqui' : 'Arraste ou clique'}
      </span>
    </div>
  );
}

/* ─── Card wrapper ───────────────────────────────────────────────────────────── */
function UploadCard({
  title, subtitle, required, accentColor, icon, children,
}: {
  title: string;
  subtitle: string;
  required?: boolean;
  accentColor?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{ background: accentColor ? `${accentColor}14` : 'var(--primary-dim)' }}
        >
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{title}</span>
            {required && <span className="text-xs" style={{ color: 'var(--error)' }}>*</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────────── */
export default function UploadStep({
  matrizFile, quizFiles, tarefaFiles,
  onMatrizChange, onQuizzesChange, onTarefasChange, onExtracted,
}: Props) {
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [dragMatriz, setDragMatriz]   = useState(false);
  const [dragQuiz, setDragQuiz]       = useState(false);
  const [dragTarefa, setDragTarefa]   = useState(false);
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [manualJson, setManualJson]   = useState('');
  const [dragJson, setDragJson]       = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  async function handleExtract() {
    if (!matrizFile) return;
    setLoading(true);
    setError(null);
    try {
      // /api/preview já extrai quizzes junto com a matriz numa única chamada
      const data = await extractJson(matrizFile, quizFiles);
      onExtracted(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUseJson() {
    if (!manualJson.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(manualJson);
    } catch {
      setError('JSON inválido. Verifique o conteúdo colado.');
      return;
    }
    if (quizFiles.length > 0) {
      setLoading(true);
      setError(null);
      try {
        const quizzes = await extractQuizzes(quizFiles);
        parsed = mergeQuizQuestions(parsed, quizzes);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao extrair questões dos quizzes.');
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    onExtracted(JSON.stringify(parsed, null, 2));
  }

  const canExtract = !!matrizFile && !loading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-1)' }}>Enviar arquivos</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
          Faça o upload da matriz obrigatória e, opcionalmente, os quizzes e tarefas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Matriz */}
        <UploadCard
          title="Matriz"
          subtitle="Documento principal da disciplina"
          required
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
              <polyline points="14,2 14,8 20,8" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="13" x2="16" y2="13" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="17" x2="12" y2="17" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        >
          {matrizFile ? (
            <FileChip name={matrizFile.name} onRemove={() => onMatrizChange(null)} />
          ) : (
            <DropZone
              accept=".docx,.doc"
              multiple={false}
              onAdd={f => onMatrizChange(f[0])}
              dragging={dragMatriz}
              setDragging={setDragMatriz}
            />
          )}
          {!matrizFile && (
            <p className="text-xs text-center" style={{ color: 'var(--border)' }}>Apenas .docx</p>
          )}
        </UploadCard>

        {/* Quizzes */}
        <UploadCard
          title="Quizzes"
          subtitle={`${quizFiles.length} arquivo${quizFiles.length !== 1 ? 's' : ''} selecionado${quizFiles.length !== 1 ? 's' : ''}`}
          accentColor="var(--quiz)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--quiz)" strokeWidth="1.5" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="var(--quiz)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="17" r="0.8" fill="var(--quiz)" />
            </svg>
          }
        >
          <DropZone
            accept=".docx,.doc"
            multiple
            onAdd={f => onQuizzesChange([...quizFiles, ...f])}
            dragging={dragQuiz}
            setDragging={setDragQuiz}
            compact={quizFiles.length > 0}
          />
          {quizFiles.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              {quizFiles.map((f, i) => (
                <FileChip key={`${f.name}-${i}`} name={f.name} badge={`Q${i + 1}`}
                  onRemove={() => onQuizzesChange(quizFiles.filter((_, idx) => idx !== i))} />
              ))}
            </div>
          )}
        </UploadCard>

        {/* Tarefas */}
        <UploadCard
          title="Tarefas"
          subtitle={`${tarefaFiles.length} arquivo${tarefaFiles.length !== 1 ? 's' : ''} selecionado${tarefaFiles.length !== 1 ? 's' : ''}`}
          accentColor="var(--tarefa)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 11l3 3L22 4" stroke="var(--tarefa)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="var(--tarefa)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        >
          <DropZone
            accept=".docx,.doc,.pdf,.xlsx,.xls,.ppt,.pptx"
            multiple
            onAdd={f => onTarefasChange([...tarefaFiles, ...f])}
            dragging={dragTarefa}
            setDragging={setDragTarefa}
            compact={tarefaFiles.length > 0}
          />
          {tarefaFiles.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              {tarefaFiles.map((f, i) => (
                <FileChip key={`${f.name}-${i}`} name={f.name}
                  onRemove={() => onTarefasChange(tarefaFiles.filter((_, idx) => idx !== i))} />
              ))}
            </div>
          )}
        </UploadCard>
      </div>

      {error && (
        <div
          className="flex items-start gap-3 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--error-dim)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" stroke="var(--error)" strokeWidth="1.5" />
            <line x1="12" y1="8" x2="12" y2="12" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="var(--error)" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* JSON manual panel */}
      <div style={{ display: 'grid', gridTemplateRows: showJsonPanel ? '1fr' : '0fr', transition: 'grid-template-rows 300ms ease' }}>
      <div style={{ overflow: 'hidden' }}>
        <div className="flex flex-col gap-3 rounded-xl p-4 mb-6"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              Colar ou carregar JSON existente
            </span>
            <button
              onClick={() => { setShowJsonPanel(false); setManualJson(''); }}
              className="text-xs px-2 py-1 rounded-md"
              style={{ color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              Fechar
            </button>
          </div>

          {/* Drop zone for .json file */}
          <div
            onClick={() => jsonInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragJson(true); }}
            onDragLeave={() => setDragJson(false)}
            onDrop={e => {
              e.preventDefault();
              setDragJson(false);
              const file = e.dataTransfer.files[0];
              if (file) file.text().then(setManualJson);
            }}
            className="flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-all"
            style={{
              border:   dragJson ? '2px dashed var(--primary)' : '2px dashed var(--border)',
              background: dragJson ? 'var(--primary-dim)' : 'var(--surface)',
              padding: '10px 16px',
            }}>
            <input ref={jsonInputRef} type="file" accept=".json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(setManualJson); }} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
              <polyline points="17,8 12,3 7,8" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="3" x2="12" y2="15" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {dragJson ? 'Solte o arquivo .json' : 'Arraste um .json ou clique para selecionar'}
            </span>
          </div>

          <textarea
            value={manualJson}
            onChange={e => setManualJson(e.target.value)}
            placeholder='Cole o JSON extraído anteriormente aqui...'
            spellCheck={false}
            className="w-full resize-none rounded-xl p-3 text-xs leading-relaxed outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
              fontFamily: '"Fira Code","JetBrains Mono",Consolas,monospace',
              minHeight: '140px',
            }}
          />

          <div className="flex justify-end">
            <button
              onClick={handleUseJson}
              disabled={!manualJson.trim() || loading}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{
                background: manualJson.trim() && !loading ? 'var(--primary)' : 'var(--surface)',
                color:      manualJson.trim() && !loading ? 'var(--primary-text)' : 'var(--text-4)',
                cursor:     manualJson.trim() && !loading ? 'pointer' : 'not-allowed',
                border: '1px solid transparent',
              }}>
              {loading && quizFiles.length > 0 ? <Spinner /> : null}
              {loading && quizFiles.length > 0 ? 'Extraindo questões...' : 'Usar este JSON'}
              {!(loading && quizFiles.length > 0) && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Toggle JSON manual panel */}
        <button
          onClick={() => { setShowJsonPanel(v => !v); setError(null); }}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
          style={{
            background: showJsonPanel ? 'var(--primary-dim)' : 'var(--card)',
            color:      showJsonPanel ? 'var(--primary)' : 'var(--text-2)',
            border:     showJsonPanel ? '1px solid var(--primary-ring)' : '1px solid var(--border)',
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {showJsonPanel ? 'Ocultar JSON manual' : 'Usar JSON existente'}
        </button>

        {/* Gemini extract button */}
        <button
          onClick={handleExtract}
          disabled={!canExtract}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200"
          style={{
            background: canExtract ? 'var(--primary)' : 'var(--card)',
            color:      canExtract ? 'var(--primary-text)' : 'var(--text-4)',
            cursor:     canExtract ? 'pointer' : 'not-allowed',
            border:     '1px solid transparent',
          }}>
          {loading ? (
            <><Spinner />Extraindo com Gemini...</>
          ) : (
            <>
              Extrair com Gemini
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
