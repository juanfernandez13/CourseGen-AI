'use client';

export type ArquivoCsv = { curso: string; filename: string; url: string };

/* Lista de arquivos gerados. O download não é automático: com vários cursos,
 * disparar tudo de uma vez faria o navegador bloquear parte dos downloads. */
export default function CsvDownload({
  arquivos, totalAlunos, onDownload, onReset,
}: {
  arquivos: ArquivoCsv[];
  totalAlunos: number;
  onDownload: (arquivo: ArquivoCsv) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
          step 03 / download
        </span>
        <h2
          className="mt-1.5 text-[22px] font-semibold tracking-tight"
          style={{ color: 'var(--text-1)', letterSpacing: '-0.4px' }}
        >
          {arquivos.length} {arquivos.length === 1 ? 'arquivo gerado' : 'arquivos gerados'}
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>
          Os mesmos {totalAlunos} {totalAlunos === 1 ? 'aluno' : 'alunos'} em cada curso. Baixe um a um.
        </p>
      </div>

      <div className="flex flex-col" style={{ border: '1px solid var(--line)', borderRadius: 6 }}>
        {arquivos.map((arquivo, i) => (
          <div
            key={arquivo.filename}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
            style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}
          >
            <div
              className="grid h-8 w-8 place-items-center rounded-[4px] shrink-0 font-mono-ui text-[8px] font-bold"
              style={{ background: 'var(--accent-soft)', color: '#34d399' }}
            >
              CSV
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[13px] truncate" style={{ color: 'var(--ink)' }} title={arquivo.curso}>
                {arquivo.curso}
              </div>
              <div className="font-mono-ui text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                {arquivo.filename}
              </div>
            </div>

            <button
              onClick={() => onDownload(arquivo)}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', border: '1px solid var(--primary-ring)' }}
            >
              baixar
            </button>
          </div>
        ))}
      </div>

      <div
        className="-mx-6 -mb-6 mt-2 flex flex-wrap items-center justify-between gap-3 px-6 py-4 sm:-mx-8 sm:-mb-8 sm:px-8"
        style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}
      >
        <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          Precisa converter outra turma?
        </span>
        <button
          onClick={onReset}
          className="rounded-md px-4 py-2 text-[12.5px] font-medium"
          style={{ background: 'var(--surface-3)', color: 'var(--ink)', border: '1px solid var(--line)' }}
        >
          Enviar outra planilha
        </button>
      </div>
    </div>
  );
}
