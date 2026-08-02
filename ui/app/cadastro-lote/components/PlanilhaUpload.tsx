'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';

const ACCEPT = '.xlsx,.xls,.csv';

export default function PlanilhaUpload({
  planilha, onPlanilhaChange, onConvert, loading, error,
}: {
  planilha: File | null;
  onPlanilhaChange: (file: File | null) => void;
  onConvert: () => void;
  loading: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onPlanilhaChange(dropped);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) onPlanilhaChange(picked);
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
          step 01 / planilha
        </span>
        <h2
          className="mt-1.5 text-[22px] font-semibold tracking-tight"
          style={{ color: 'var(--text-1)', letterSpacing: '-0.4px' }}
        >
          Cadastro em lote de alunos
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>
          Envie a planilha com os alunos. Você confere os dados antes de gerar o CSV.
        </p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[5px] px-4 py-10 transition-colors"
        style={{
          background: dragging ? 'var(--accent-soft)' : 'var(--surface)',
          border:     dragging ? '1px dashed var(--accent)' : '1px dashed var(--line-2)',
        }}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleChange} />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={dragging ? 'var(--accent)' : 'var(--ink-3)'} strokeWidth="1.5" strokeLinecap="round" />
          <polyline points="17,8 12,3 7,8" stroke={dragging ? 'var(--accent)' : 'var(--ink-3)'} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="3" x2="12" y2="15" stroke={dragging ? 'var(--accent)' : 'var(--ink-3)'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span
          className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]"
          style={{ color: dragging ? 'var(--accent)' : 'var(--ink-3)' }}
        >
          {dragging ? 'solte a planilha' : 'arraste ou clique'}
        </span>
        <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          .xlsx, .xls ou .csv
        </span>
      </div>

      {planilha && (
        <div
          className="flex items-center gap-2.5 rounded-[3px] px-2.5 py-1.5 font-mono-ui text-[11px]"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <div
            className="grid h-6.5 w-5.5 place-items-center rounded-xs text-[8px] font-bold"
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--primary-ring)', color: '#34d399' }}
          >
            {planilha.name.split('.').pop()?.slice(0, 3).toUpperCase() || 'XLS'}
          </div>
          <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ink)' }} title={planilha.name}>
            {planilha.name}
          </span>
          <span style={{ color: 'var(--ink-3)' }}>{(planilha.size / 1024).toFixed(0)} KB</span>
          <button
            onClick={() => onPlanilhaChange(null)}
            className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-(--surface-3)"
            style={{ color: 'var(--ink-3)' }}
            title="Remover"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div
          className="rounded-md px-3 py-2 text-[12.5px]"
          style={{ background: 'var(--error-dim)', color: 'var(--error)', border: '1px solid var(--error-border)' }}
        >
          {error}
        </div>
      )}

      <div
        className="-mx-6 -mb-6 mt-2 flex items-center justify-end gap-3 px-6 py-4 sm:-mx-8 sm:-mb-8 sm:px-8"
        style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}
      >
        <button
          onClick={onConvert}
          disabled={!planilha || loading}
          className="rounded-md px-4 py-2 text-[12.5px] font-medium transition-colors"
          style={{
            background: planilha && !loading ? 'var(--accent)' : 'var(--surface-3)',
            color:      planilha && !loading ? '#fff' : 'var(--ink-3)',
            cursor:     planilha && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Analisando…' : 'Analisar planilha'}
        </button>
      </div>
    </div>
  );
}
