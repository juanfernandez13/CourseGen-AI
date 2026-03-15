'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── PDF Viewer ─────────────────────────────────────────────────────────── */
function PdfViewer({ file }: { file: File }) {
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const renderTaskRef      = useRef<{ cancel: () => void } | null>(null);
  const [numPages, setNumPages]       = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale]             = useState(1.4);
  const [loading, setLoading]         = useState(true);
  const [pdfDoc, setPdfDoc]           = useState<unknown>(null);

  /* Load PDF once */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      if (!cancelled) {
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  /* Render current page onto canvas */
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page      = await (pdfDoc as any).getPage(currentPage);
    const viewport  = page.getViewport({ scale });
    const canvas    = canvasRef.current;
    const ctx       = canvas.getContext('2d')!;
    canvas.width    = viewport.width;
    canvas.height   = viewport.height;

    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => { renderPage(); }, [renderPage]);

  const prev = () => setCurrentPage(p => Math.max(1, p - 1));
  const next = () => setCurrentPage(p => Math.min(numPages, p + 1));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 gap-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        {/* Page nav */}
        <div className="flex items-center gap-2">
          <button onClick={prev} disabled={currentPage <= 1}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: currentPage <= 1 ? 'var(--text-4)' : 'var(--text-2)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
            {loading ? '…' : `${currentPage} / ${numPages}`}
          </span>
          <button onClick={next} disabled={currentPage >= numPages}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: currentPage >= numPages ? 'var(--text-4)' : 'var(--text-2)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))}
            className="flex items-center justify-center w-7 h-7 rounded-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-xs w-10 text-center" style={{ color: 'var(--text-3)' }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
            className="flex items-center justify-center w-7 h-7 rounded-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex justify-center p-4"
        style={{ background: '#2a2a2a' }}>
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2" style={{ color: '#888' }}>
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" />
            </svg>
            <span className="text-sm">Renderizando PDF…</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="rounded shadow-2xl"
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── DOCX Viewer ────────────────────────────────────────────────────────── */
function DocxViewer({ file }: { file: File }) {
  const [html, setHtml]       = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const mammoth = (await import('mammoth/mammoth.browser' as string)) as {
          default?: { convertToHtml: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
          convertToHtml?: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        };
        const fn = mammoth.default?.convertToHtml ?? mammoth.convertToHtml;
        if (!fn) throw new Error('mammoth não carregou');
        const result = await fn({ arrayBuffer: buf });
        if (!cancelled) setHtml(result.value);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Erro ao renderizar DOCX.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  if (loading) return (
    <div className="flex items-center justify-center h-48 gap-2" style={{ color: 'var(--text-3)' }}>
      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" />
      </svg>
      <span className="text-sm">Convertendo DOCX…</span>
    </div>
  );

  if (err) return (
    <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--error)' }}>{err}</div>
  );

  return (
    <div className="overflow-auto flex-1 p-8" style={{ background: 'var(--bg)' }}>
      <div
        className="mx-auto max-w-3xl rounded-2xl px-12 py-10 shadow-lg text-sm leading-relaxed"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
      >
        <style>{`
          .docx-content h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 1rem; color: var(--primary); border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
          .docx-content h2 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem; color: var(--text-1); }
          .docx-content h3 { font-size: 1.05rem; font-weight: 600; margin: 1.25rem 0 0.5rem; color: var(--text-2); }
          .docx-content p  { margin: 0 0 0.75rem; line-height: 1.75; color: var(--text-1); }
          .docx-content ul, .docx-content ol { margin: 0 0 0.75rem 1.5rem; }
          .docx-content li { margin-bottom: 0.35rem; line-height: 1.6; color: var(--text-1); }
          .docx-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
          .docx-content th, .docx-content td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
          .docx-content th { background: var(--card); font-weight: 600; color: var(--text-1); }
          .docx-content td { color: var(--text-2); }
          .docx-content strong, .docx-content b { color: var(--text-1); font-weight: 600; }
          .docx-content em { color: var(--text-2); }
          .docx-content a  { color: var(--primary); }
        `}</style>
        <div
          className="docx-content"
          dangerouslySetInnerHTML={{ __html: html ?? '' }}
        />
      </div>
    </div>
  );
}

/* ─── File Viewer Modal ──────────────────────────────────────────────────── */
type Props = { file: File; onClose: () => void };

export default function FileViewer({ file, onClose }: Props) {
  const isPdf  = /\.pdf$/i.test(file.name);
  const isDocx = /\.docx?$/i.test(file.name);
  const iconColor = isPdf ? 'var(--error)' : 'var(--primary)';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl w-full overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxWidth: '900px', height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
              style={{ background: isPdf ? 'var(--error-dim)' : 'var(--primary-dim)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
                <polyline points="14,2 14,8 20,8" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
                {isPdf && <text x="6.5" y="17.5" fontSize="5.5" fill={iconColor} fontWeight="bold">PDF</text>}
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{file.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {(file.size / 1024).toFixed(0)} KB · {isPdf ? 'PDF' : isDocx ? 'Word' : 'Arquivo'}
              </p>
            </div>
          </div>

          <button onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ml-3 transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          {isPdf  && <PdfViewer  file={file} />}
          {isDocx && <DocxViewer file={file} />}
          {!isPdf && !isDocx && (
            <div className="flex items-center justify-center flex-1 text-sm" style={{ color: 'var(--text-3)' }}>
              Tipo de arquivo não suportado para pré-visualização.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
