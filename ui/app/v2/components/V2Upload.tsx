'use client';

import { useEffect, useRef, useState } from 'react';
import Badge from './Badge';
import Dropzone from './Dropzone';
import type { LogLine } from '../types';

type Props = {
  matrizFile:     File | null;
  quizFiles:      File[];
  tarefaFiles:    File[];
  onMatrizChange: (f: File | null) => void;
  onQuizzesChange:(files: File[]) => void;
  onTarefasChange:(files: File[]) => void;
  onExtract:      () => void;
  onCancel:       () => void;
  extracting:     boolean;
  log:            LogLine[];
  startedAt:      number | null;
  error:          string | null;
};

function FileRow({ name, size, onRemove }: { name: string; size: number; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-[3px] font-mono-ui text-[11px]" style={{ background: 'var(--surface-2)' }}>
      <span style={{ color: 'var(--ink-3)' }}>›</span>
      <span className="flex-1 truncate" style={{ color: 'var(--ink)' }} title={name}>{name}</span>
      <span style={{ color: 'var(--ink-3)' }}>{(size / 1024).toFixed(0)} KB</span>
      <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} style={{ color: 'var(--ink-3)' }}>×</button>
    </div>
  );
}

function elapsed(startedAt: number | null): string {
  if (!startedAt) return '00:00';
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function V2Upload({
  matrizFile, quizFiles, tarefaFiles,
  onMatrizChange, onQuizzesChange, onTarefasChange,
  onExtract, onCancel, extracting, log, startedAt, error,
}: Props) {
  const [tick, setTick] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!extracting) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [extracting]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  const canExtract = !!matrizFile && !extracting;

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-7 pb-6 max-w-[1180px] mx-auto w-full">
        <h1 className="text-[22px] font-semibold m-0 tracking-tight" style={{ letterSpacing: -0.4 }}>
          Anexar documentos
        </h1>
        <p className="text-[13px] mt-1 mb-5" style={{ color: 'var(--ink-2)' }}>
          Matriz DE é obrigatória. Quizzes e tarefas, opcionais. Tamanho máximo 20 MB por arquivo.
        </p>

        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
          {/* Matriz */}
          <div
            className="relative rounded-[6px] p-4"
            style={{
              background: 'var(--surface)',
              border: matrizFile ? '1px solid var(--accent)' : '1px solid var(--line)',
            }}
          >
            <div
              className="absolute -top-[1px] left-3 px-1.5 font-mono-ui text-[9.5px] uppercase"
              style={{ background: 'var(--bg)', color: 'var(--accent)', letterSpacing: 0.5 }}
            >
              obrigatório
            </div>
            <div className="flex items-center justify-between gap-2 mt-1 mb-1">
              <div className="text-[13px] font-medium">Matriz DE</div>
              {matrizFile ? <Badge tone="ok">anexada</Badge> : <Badge>aguardando</Badge>}
            </div>
            <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Documento de planejamento da disciplina
            </div>

            <div className="mt-3.5">
              {matrizFile ? (
                <div className="flex items-center gap-2.5 font-mono-ui text-[11px]">
                  <div
                    className="w-6 h-7 grid place-items-center rounded-[2px] text-[8px] font-bold"
                    style={{ background: 'var(--accent-soft)', border: '1px solid rgba(129,140,248,0.3)', color: 'var(--accent)' }}
                  >
                    DOC
                  </div>
                  <div className="flex-1 truncate" style={{ color: 'var(--ink)' }}>{matrizFile.name}</div>
                  <div style={{ color: 'var(--ink-3)' }}>{(matrizFile.size / 1024).toFixed(0)} KB</div>
                  <button type="button" onClick={() => onMatrizChange(null)} style={{ color: 'var(--ink-3)' }}>×</button>
                </div>
              ) : (
                <Dropzone
                  accept=".docx,.doc"
                  multiple={false}
                  onAdd={files => onMatrizChange(files[0])}
                  hint=".docx · .doc"
                  size="sm"
                />
              )}
            </div>
          </div>

          {/* Quizzes */}
          <div className="rounded-[6px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[13px] font-medium">Quizzes</div>
              <Badge>{quizFiles.length} {quizFiles.length === 1 ? 'arquivo' : 'arquivos'}</Badge>
            </div>
            <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Banco de questões para os quizzes
            </div>
            <div className="mt-3.5 flex flex-col gap-1.5">
              {quizFiles.map((f, i) => (
                <FileRow
                  key={`${f.name}-${i}`}
                  name={f.name}
                  size={f.size}
                  onRemove={() => onQuizzesChange(quizFiles.filter((_, idx) => idx !== i))}
                />
              ))}
              <Dropzone
                accept=".docx,.doc"
                multiple
                onAdd={files => onQuizzesChange([...quizFiles, ...files])}
                hint=".docx"
                size="sm"
              />
            </div>
          </div>

          {/* Tarefas */}
          <div className="rounded-[6px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[13px] font-medium">Tarefas</div>
              <Badge>{tarefaFiles.length} {tarefaFiles.length === 1 ? 'arquivo' : 'arquivos'}</Badge>
            </div>
            <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Enunciados de atividades de entrega
            </div>
            <div className="mt-3.5 flex flex-col gap-1.5">
              {tarefaFiles.map((f, i) => (
                <FileRow
                  key={`${f.name}-${i}`}
                  name={f.name}
                  size={f.size}
                  onRemove={() => onTarefasChange(tarefaFiles.filter((_, idx) => idx !== i))}
                />
              ))}
              <Dropzone
                accept=".docx,.doc,.pdf,.xlsx,.pptx"
                multiple
                onAdd={files => onTarefasChange([...tarefaFiles, ...files])}
                hint=".docx · .pdf"
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Live extraction log */}
        <div className="rounded-[6px] overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div
            className="px-3.5 py-2 flex items-center gap-2 font-mono-ui text-[11px]"
            style={{ borderBottom: '1px solid var(--line)', color: 'var(--ink-2)' }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: extracting ? 'var(--accent)' : (log.length > 0 ? 'var(--ok)' : 'var(--ink-3)'),
                boxShadow:  extracting ? '0 0 0 3px rgba(129,140,248,0.2)' : 'none',
              }}
            />
            {extracting ? 'extraindo · gemini' : log.length > 0 ? 'extração concluída' : 'aguardando · anexe a Matriz e clique em extrair'}
            <span className="ml-auto" style={{ color: 'var(--ink-3)' }} data-tick={tick}>
              elapsed {elapsed(startedAt)}
            </span>
          </div>
          <div
            ref={logRef}
            className="px-3.5 py-2.5 font-mono-ui text-[11px] leading-[1.7] max-h-[260px] overflow-auto"
            style={{ color: 'var(--ink-2)' }}
          >
            {log.length === 0 && !extracting && (
              <div style={{ color: 'var(--ink-3)' }}>// log vazio · ainda não extraiu</div>
            )}
            {log.map((l, i) => (
              <div
                key={i}
                className="grid gap-2.5"
                style={{ gridTemplateColumns: '50px 70px 1fr', animation: 'logLineIn 150ms ease' }}
              >
                <span style={{ color: 'var(--ink-3)' }}>{l.ts}</span>
                <span style={{
                  color:
                    l.tone === 'danger' ? 'var(--danger)'
                    : l.tone === 'warn'   ? 'var(--warn)'
                    : l.tone === 'ok'     ? 'var(--ok)'
                                          : 'var(--accent)',
                }}>
                  {l.tag}
                </span>
                <span>{l.body}</span>
              </div>
            ))}
            {extracting && (
              <div className="grid gap-2.5 opacity-70" style={{ gridTemplateColumns: '50px 70px 1fr' }}>
                <span style={{ color: 'var(--ink-3)' }}>{elapsed(startedAt)}</span>
                <span style={{ color: 'var(--accent)' }}>gemini</span>
                <span>processando<span style={{ animation: 'blink 1s infinite' }}>▎</span></span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div
            className="mt-4 rounded-[5px] px-3.5 py-2 text-[12.5px]"
            style={{ background: 'var(--error-dim)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}
          >
            ⚠ {error}
          </div>
        )}

        <div className="mt-5 flex justify-between items-center">
          <span className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {canExtract ? 'pronto pra extrair' : extracting ? 'extraindo…' : 'anexe a Matriz pra continuar'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[5px] px-3.5 py-1.5 text-[12px]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)', color: 'var(--ink-2)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onExtract}
              disabled={!canExtract}
              className="rounded-[5px] px-3.5 py-1.5 text-[12px] font-medium"
              style={{
                background: canExtract ? 'var(--accent)' : 'var(--surface-3)',
                color:      canExtract ? 'var(--bg)' : 'var(--ink-3)',
                cursor:     canExtract ? 'pointer'  : 'not-allowed',
              }}
            >
              {extracting ? 'extraindo…' : 'Extrair com Gemini →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
