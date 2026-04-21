'use client';

import { useState } from 'react';
import StepIndicator from './components/StepIndicator';
import UploadStep from './components/UploadStep';
import ReviewStep from './components/ReviewStep';
import DoneStep from './components/DoneStep';
import BuilderStep from './components/BuilderStep';
import { generateMbz } from './lib/api';
import { useJsonHistory } from './lib/useJsonHistory';

type Mode = 'upload' | 'builder';
type Step = 1 | 2 | 3;

export default function Home() {
  const [mode, setMode]           = useState<Mode>('upload');
  const [step, setStep]           = useState<Step>(1);
  const [matrizFile, setMatrizFile]   = useState<File | null>(null);
  const [quizFiles, setQuizFiles]     = useState<File[]>([]);
  const [tarefaFiles, setTarefaFiles] = useState<File[]>([]);
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

  function handleReset() {
    setStep(1);
    setMatrizFile(null);
    setQuizFiles([]);
    setTarefaFiles([]);
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
    <div className="flex flex-col">
      <StepIndicator currentStep={step} onNavigate={handleNavigate} />

      <div className="rounded-2xl p-6 sm:p-8"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {step === 1 && (
          <>
            {/* Mode selector tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMode('upload')}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
                style={{
                  background: mode === 'upload' ? 'var(--primary)' : 'var(--card)',
                  color: mode === 'upload' ? 'var(--primary-text)' : 'var(--text-2)',
                  border: mode === 'upload' ? '1px solid var(--primary)' : '1px solid var(--border)',
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <polyline points="17,8 12,3 7,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Upload / Importar
              </button>
              <button
                onClick={() => setMode('builder')}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
                style={{
                  background: mode === 'builder' ? 'var(--primary)' : 'var(--card)',
                  color: mode === 'builder' ? 'var(--primary-text)' : 'var(--text-2)',
                  border: mode === 'builder' ? '1px solid var(--primary)' : '1px solid var(--border)',
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Criar manualmente
              </button>
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
