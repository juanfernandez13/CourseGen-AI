'use client';

import { useState } from 'react';
import StepIndicator from './components/StepIndicator';
import UploadStep from './components/UploadStep';
import ReviewStep from './components/ReviewStep';
import DoneStep from './components/DoneStep';
import BuilderStep from './components/BuilderStep';
import { generateMbz } from './lib/api';
import { useJsonHistory } from './lib/useJsonHistory';
import { usePersistedFiles } from './lib/usePersistedFiles';

type Mode = 'upload' | 'builder';
type Step = 1 | 2 | 3;

export default function Home() {
  const [mode, setMode]           = useState<Mode>('upload');
  const [step, setStep]           = useState<Step>(1);
  const files = usePersistedFiles();
  const { matrizFile, quizFiles, tarefaFiles, setMatrizFile, setQuizFiles, setTarefaFiles, clearAllFiles } = files;
  const [extractedJson, setExtractedJson] = useState<string>('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const history = useJsonHistory();

  function handleExtracted(json: string) {
    setExtractedJson(json);
    history.save(json, 'Extração via Gemini');
    setError(null);
    setStep(2);
  }

  function handleBuilderDone(json: string) {
    setExtractedJson(json);
    history.save(json, 'Criado manualmente');
    setError(null);
    setStep(2);
  }

  function handleRestore(json: string) {
    setExtractedJson(json);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      history.save(extractedJson, 'Antes de gerar MBZ');
      await generateMbz(extractedJson, quizFiles, tarefaFiles);
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar o MBZ.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setStep(1);
    await clearAllFiles();
    setExtractedJson('');
    setError(null);
    setLoading(false);
  }

  function handleNavigate(target: 1 | 2 | 3) {
    if (target < step) {
      setError(null);
      setStep(target);
    }
  }

  return (
    <div className="mx-auto max-w-6xl flex flex-col px-6 py-8">
      <StepIndicator currentStep={step} onNavigate={handleNavigate} />

      <div
        className="rounded-lg p-6 sm:p-8"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        {step === 1 && (
          <>
            {/* Mode selector — dir-b segmented pill */}
            <div
              className="mb-6 inline-flex overflow-hidden rounded-[5px]"
              style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}
            >
              {([
                { key: 'upload',  label: 'Upload / Importar' },
                { key: 'builder', label: 'Criar manualmente' },
              ] as const).map((opt, i) => {
                const on = mode === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setMode(opt.key)}
                    className="px-3.5 py-1.5 text-[12px] transition-colors font-mono-ui uppercase tracking-[0.06em]"
                    style={{
                      background:   on ? 'var(--surface-3)' : 'transparent',
                      color:        on ? 'var(--ink)' : 'var(--ink-3)',
                      borderRight:  i === 0 ? '1px solid var(--line)' : 'none',
                      fontWeight:   on ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {mode === 'upload' && (
              <UploadStep
                matrizFile={matrizFile}
                quizFiles={quizFiles}
                tarefaFiles={tarefaFiles}
                onMatrizChange={setMatrizFile}
                onQuizzesChange={setQuizFiles}
                onTarefasChange={setTarefaFiles}
                onExtracted={handleExtracted}
                history={history}
              />
            )}
            {mode === 'builder' && (
              <BuilderStep onDone={handleBuilderDone} />
            )}
          </>
        )}
        {step === 2 && (
          <ReviewStep
            json={extractedJson}
            onJsonChange={setExtractedJson}
            onGenerate={handleGenerate}
            onBack={() => { setError(null); setStep(1); }}
            loading={loading}
            error={error}
            tarefaFiles={tarefaFiles}
            history={history}
            onRestore={handleRestore}
          />
        )}
        {step === 3 && <DoneStep onReset={handleReset} />}
      </div>
    </div>
  );
}
