'use client';

import { useState } from 'react';
import StepIndicator from './components/StepIndicator';
import UploadStep from './components/UploadStep';
import ReviewStep from './components/ReviewStep';
import DoneStep from './components/DoneStep';
import { generateMbz } from './lib/api';

type Step = 1 | 2 | 3;

export default function Home() {
  const [step, setStep]           = useState<Step>(1);
  const [matrizFile, setMatrizFile]   = useState<File | null>(null);
  const [quizFiles, setQuizFiles]     = useState<File[]>([]);
  const [tarefaFiles, setTarefaFiles] = useState<File[]>([]);
  const [extractedJson, setExtractedJson] = useState<string>('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  function handleExtracted(json: string) {
    setExtractedJson(json);
    setError(null);
    setStep(2);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
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
          <UploadStep
            matrizFile={matrizFile}
            quizFiles={quizFiles}
            tarefaFiles={tarefaFiles}
            onMatrizChange={setMatrizFile}
            onQuizzesChange={setQuizFiles}
            onTarefasChange={setTarefaFiles}
            onExtracted={handleExtracted}
          />
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
          />
        )}
        {step === 3 && <DoneStep onReset={handleReset} />}
      </div>
    </div>
  );
}
