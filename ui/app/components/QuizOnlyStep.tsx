'use client';

import { useState } from 'react';
import { extractQuestionarios } from '../lib/api';
import type { FilesUpdater } from '../lib/usePersistedFiles';
import FileViewer from './FileViewer';
import { DropZone, FileChip, Spinner, UploadCard } from './UploadStep';

type Props = {
  quizFiles: File[];
  onQuizzesChange: (next: FilesUpdater) => void;
  onExtracted: (json: string) => void;
};

/**
 * Modo "só questionários": para quando pedem apenas um quiz e não existe matriz.
 * Gera um .mbz que só traz os questionários, pronto para mesclar num curso que
 * já existe.
 */
export default function QuizOnlyStep({ quizFiles, onQuizzesChange, onExtracted }: Props) {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewFile, setViewFile] = useState<File | null>(null);

  const canExtract = quizFiles.length > 0 && !loading;

  async function handleExtract() {
    setLoading(true);
    setError(null);
    try {
      const data = await extractQuestionarios(quizFiles);
      onExtracted(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
          step 01 / upload
        </span>
        <h2
          className="mt-1.5 text-[22px] font-semibold tracking-tight"
          style={{ color: 'var(--text-1)', letterSpacing: '-0.4px' }}
        >
          Só questionários
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>
          Sem matriz. O .mbz traz apenas os quizzes, para mesclar num curso que já existe.
        </p>
      </div>

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
          accept=".docx"
          multiple
          onAdd={f => onQuizzesChange(prev => [...prev, ...f])}
          dragging={dragging}
          setDragging={setDragging}
          compact={quizFiles.length > 0}
        />
        {quizFiles.length === 0 && (
          <p className="text-xs text-center" style={{ color: 'var(--ink-3)' }}>
            Apenas .docx. Um número no nome (&ldquo;Quiz 3&rdquo;) já indica a seção de destino.
          </p>
        )}
        {quizFiles.length > 0 && (
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {quizFiles.map((f, i) => (
              <FileChip
                key={`${f.name}-${i}`}
                name={f.name}
                badge={`Q${i + 1}`}
                onRemove={() => onQuizzesChange(prev => prev.filter((_, idx) => idx !== i))}
                onView={() => setViewFile(f)}
              />
            ))}
          </div>
        )}
      </UploadCard>

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

      <div
        className="-mx-6 -mb-6 mt-2 flex flex-wrap items-center justify-end gap-3 px-6 py-4 sm:-mx-8 sm:-mb-8 sm:px-8"
        style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}
      >
        <button
          onClick={handleExtract}
          disabled={!canExtract}
          className="flex items-center gap-2 rounded-md px-4 py-1.5 text-[12.5px] font-medium transition-colors"
          style={{
            background: canExtract ? 'var(--ink)' : 'var(--surface-3)',
            color:      canExtract ? 'var(--bg)'  : 'var(--ink-3)',
            cursor:     canExtract ? 'pointer'    : 'not-allowed',
            border:     '1px solid transparent',
          }}>
          {loading ? (
            <><Spinner />extraindo…</>
          ) : (
            <>
              Extrair com Gemini
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </>
          )}
        </button>
      </div>

      {viewFile && <FileViewer file={viewFile} onClose={() => setViewFile(null)} />}
    </div>
  );
}
