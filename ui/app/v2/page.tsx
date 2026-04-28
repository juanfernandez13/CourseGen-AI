'use client';

import { useEffect, useState } from 'react';
import { extractJson, generateMbz } from '../lib/api';
import { useJsonHistory } from '../lib/useJsonHistory';
import { usePersistedFiles } from '../lib/usePersistedFiles';
import V2Home from './components/V2Home';
import V2Upload from './components/V2Upload';
import V2Review from './components/V2Review';
import V2Generating from './components/V2Generating';
import V2Done from './components/V2Done';
import Stepper from './components/Stepper';
import type { LogLine, V2Stage } from './types';

export default function V2Page() {
  const [stage, setStage] = useState<V2Stage>('home');
  const files = usePersistedFiles();
  const { matrizFile, quizFiles, tarefaFiles, setMatrizFile, setQuizFiles, setTarefaFiles, clearAllFiles } = files;
  const history = useJsonHistory();
  const [json, setJson] = useState<string>('');
  const [log, setLog] = useState<LogLine[]>([]);
  const [extractStartedAt, setExtractStartedAt] = useState<number | null>(null);
  const [generateStartedAt, setGenerateStartedAt] = useState<number | null>(null);
  const [generateElapsed, setGenerateElapsed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (history.versions[0] && !json) setJson(history.versions[0].json);
  }, [history.versions, json]);

  async function handleExtract() {
    if (!matrizFile) return;
    setError(null);
    setLog([]);
    const start = Date.now();
    setExtractStartedAt(start);
    setStage('extracting');

    const tsFromStart = () => {
      const s = Math.floor((Date.now() - start) / 1000);
      return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };
    const push = (entry: Omit<LogLine, 'ts'>) =>
      setLog(prev => [...prev, { ...entry, ts: tsFromStart() }]);

    push({ tag: 'parser', body: `lendo ${matrizFile.name} (${(matrizFile.size / 1024).toFixed(0)} KB)`, tone: 'info' });
    if (quizFiles.length) {
      push({ tag: 'parser', body: `${quizFiles.length} arquivo(s) de quiz anexado(s)`, tone: 'info' });
    }
    push({ tag: 'gemini', body: 'enviando documento para extração…', tone: 'info' });

    try {
      const data = await extractJson(matrizFile, quizFiles);
      const text = JSON.stringify(data, null, 2);
      const aulas = ((data as { aulas?: unknown[] }).aulas ?? []) as unknown[];
      const obj   = data as { disciplina?: { nome?: string; codigo?: string } };
      push({ tag: 'gemini', body: `identificou: ${obj.disciplina?.nome ?? 'sem nome'} (${obj.disciplina?.codigo ?? '—'})`, tone: 'ok' });
      push({ tag: 'gemini', body: `extraiu ${aulas.length} unidade(s)`, tone: 'ok' });
      if (quizFiles.length) push({ tag: 'linker', body: `associou ${quizFiles.length} arquivo(s) de quiz`, tone: 'ok' });
      push({ tag: 'gemini', body: 'estrutura pronta · indo para revisão', tone: 'ok' });
      setJson(text);
      history.save(text, 'Extração via Gemini (v2)');
      setStage('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido na extração.';
      push({ tag: 'error', body: msg, tone: 'danger' });
      setError(msg);
      setStage('upload');
    }
  }

  async function handleGenerate() {
    if (!json.trim()) return;
    setError(null);
    const start = Date.now();
    setGenerateStartedAt(start);
    setStage('generating');
    try {
      history.save(json, 'Antes de gerar MBZ (v2)');
      await generateMbz(json, quizFiles, tarefaFiles);
      setGenerateElapsed(Date.now() - start);
      setStage('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar o MBZ.';
      setError(msg);
      setStage('review');
    }
  }

  async function handleReset() {
    await clearAllFiles();
    setJson('');
    setLog([]);
    setError(null);
    setExtractStartedAt(null);
    setGenerateStartedAt(null);
    setGenerateElapsed(0);
    setStage('upload');
  }

  function handleBackToHome() {
    setStage('home');
  }

  function handleResume() {
    if (json && !error) setStage('review');
    else                setStage('upload');
  }

  function handleNew() {
    setStage('upload');
  }

  const showStepper = stage === 'upload' || stage === 'extracting' || stage === 'review';

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      {showStepper && <Stepper stage={stage} onNavigate={s => {
        if (s === 'upload') setStage('upload');
        if (s === 'review' && json) setStage('review');
      }} />}

      {stage === 'home' && (
        <V2Home
          matrizName={matrizFile?.name ?? null}
          draftJson={json}
          versions={history.versions}
          onResume={handleResume}
          onNew={handleNew}
          onRestore={(j: string) => { setJson(j); setStage('review'); }}
          onClearHistory={history.clear}
        />
      )}

      {(stage === 'upload' || stage === 'extracting') && (
        <V2Upload
          matrizFile={matrizFile}
          quizFiles={quizFiles}
          tarefaFiles={tarefaFiles}
          onMatrizChange={f => { setMatrizFile(f).catch(() => undefined); }}
          onQuizzesChange={f => { setQuizFiles(f).catch(() => undefined); }}
          onTarefasChange={f => { setTarefaFiles(f).catch(() => undefined); }}
          onExtract={handleExtract}
          onCancel={handleBackToHome}
          extracting={stage === 'extracting'}
          log={log}
          startedAt={extractStartedAt}
          error={error}
        />
      )}

      {stage === 'review' && (
        <V2Review
          json={json}
          onJsonChange={setJson}
          onGenerate={handleGenerate}
          onBack={() => setStage('upload')}
          loading={false}
          error={error}
          matrizFile={matrizFile}
          quizFiles={quizFiles}
          tarefaFiles={tarefaFiles}
        />
      )}

      {stage === 'generating' && (() => {
        let courseName = 'curso';
        try { courseName = (JSON.parse(json) as { disciplina?: { nome?: string } }).disciplina?.nome ?? 'curso'; }
        catch { /* ignore */ }
        return <V2Generating courseName={courseName} />;
      })()}

      {stage === 'done' && (
        <V2Done
          json={json}
          elapsedMs={generateElapsed}
          onReset={handleReset}
          onBackHome={handleBackToHome}
        />
      )}
    </div>
  );
}
