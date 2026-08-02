'use client';

import { useEffect, useState } from 'react';
import PlanilhaUpload from './components/PlanilhaUpload';
import AlunosReview from './components/AlunosReview';
import CsvDownload, { type ArquivoCsv } from './components/CsvDownload';
import { authHeaders } from '../lib/apiKeys';
import type { Aluno } from './components/types';

type Step = 'upload' | 'review' | 'done';

const PASSOS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'planilha' },
  { key: 'review', label: 'revisão' },
  { key: 'done',   label: 'download' },
];

async function readError(res: Response): Promise<string> {
  let message = `Erro ${res.status}: ${res.statusText}`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch { /* resposta sem JSON */ }
  return message;
}

export default function CadastroLote() {
  const [step, setStep]         = useState<Step>('upload');
  const [planilha, setPlanilha] = useState<File | null>(null);
  const [alunos, setAlunos]     = useState<Aluno[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<ArquivoCsv[]>([]);

  // Object URLs seguram memória até serem revogados.
  useEffect(() => () => { arquivos.forEach(a => URL.revokeObjectURL(a.url)); }, [arquivos]);

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleExtract() {
    if (!planilha) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('planilha', planilha);

      const res = await fetch('/api/alunos/extract', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error(await readError(res));

      const { alunos: extraidos } = await res.json();
      if (!extraidos?.length) throw new Error('Nenhum aluno foi identificado na planilha.');

      setAlunos(extraidos);
      setStep('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao interpretar a planilha.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(cursos: string[]) {
    setLoading(true);
    setError(null);
    try {
      const base = planilha?.name.replace(/\.[^.]+$/, '') ?? 'turma';
      const res = await fetch('/api/alunos/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alunos, cursos, base: `alunos_${base}` }),
      });
      if (!res.ok) throw new Error(await readError(res));

      const { arquivos: gerados } = await res.json();
      // O CSV vem como texto; o blob é montado aqui para o link de download.
      setArquivos((gerados as { curso: string; filename: string; csv: string }[]).map(a => ({
        curso: a.curso,
        filename: a.filename,
        url: URL.createObjectURL(new Blob([a.csv], { type: 'text/csv;charset=utf-8' })),
      })));
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar os CSVs.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep('upload');
    setPlanilha(null);
    setAlunos([]);
    setArquivos([]);
    setError(null);
  }

  const atual = PASSOS.findIndex(p => p.key === step);

  return (
    <div className="mx-auto max-w-6xl flex flex-col px-6 py-8">
      {/* Indicador de passos */}
      <div className="mb-5 flex items-center gap-2 font-mono-ui text-[11px]">
        {PASSOS.map((passo, i) => (
          <span key={passo.key} className="flex items-center gap-2">
            {i > 0 && <span style={{ color: 'var(--line-2)' }}>/</span>}
            <span
              className="flex items-center gap-1.5"
              style={{ color: i === atual ? 'var(--accent)' : i < atual ? 'var(--ink-2)' : 'var(--ink-3)' }}
            >
              <span
                className="grid h-4 w-4 place-items-center rounded-full text-[9px]"
                style={{
                  background: i <= atual ? 'var(--accent-soft)' : 'transparent',
                  border: `1px solid ${i <= atual ? 'var(--accent)' : 'var(--line-2)'}`,
                }}
              >
                {i + 1}
              </span>
              {passo.label}
            </span>
          </span>
        ))}
      </div>

      <div
        className="rounded-lg p-6 sm:p-8"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        {step === 'upload' && (
          <PlanilhaUpload
            planilha={planilha}
            onPlanilhaChange={file => { setPlanilha(file); setError(null); }}
            onConvert={handleExtract}
            loading={loading}
            error={error}
          />
        )}

        {step === 'review' && (
          <AlunosReview
            alunos={alunos}
            onChange={setAlunos}
            onConfirm={handleConfirm}
            onBack={() => { setStep('upload'); setError(null); }}
            loading={loading}
            error={error}
          />
        )}

        {step === 'done' && arquivos.length > 0 && (
          <CsvDownload
            arquivos={arquivos}
            totalAlunos={alunos.length}
            onDownload={a => triggerDownload(a.url, a.filename)}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
