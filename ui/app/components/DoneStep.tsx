'use client';

type Props = { onReset: () => void; quizOnly?: boolean };

/* Passos de quem restaura o pacote só de questionários. O ponto que mais erra é
 * a opção de restauração: a que apaga o conteúdo do curso destrói o curso. */
const PASSOS_QUIZ_ONLY = [
  'No curso de destino, abra Mais → Reutilização de curso → Restaurar e envie o questionarios.mbz.',
  'Na escolha do destino, use a opção de mesclar com este curso. Nunca a que exclui o conteúdo.',
  'Deixe marcados só os questionários e conclua. Cada um entra na seção de mesmo número.',
  'Depois, no livro de notas, mova o quiz para a categoria certa e defina o peso.',
];

export default function DoneStep({ onReset, quizOnly = false }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-7 py-14 text-center">
      <style>{`
        @keyframes drawCheck { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } }
        @keyframes pulseRing { 0%,100% { opacity: 0.25; transform: scale(1); } 50% { opacity: 0.45; transform: scale(1.06); } }
      `}</style>

      <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
        step 03 / pronto
      </span>

      {/* Animated check */}
      <div
        className="relative grid h-24 w-24 place-items-center rounded-full"
        style={{ background: 'rgba(74, 222, 128, 0.10)', border: '1px solid rgba(74, 222, 128, 0.28)' }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'rgba(74, 222, 128, 0.15)',
            animation: 'pulseRing 2.4s ease-in-out infinite',
          }}
        />
        <svg width="42" height="42" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="20" stroke="var(--ok)" strokeWidth="1.25" />
          <path
            d="M13 22l7 7 11-14"
            stroke="var(--ok)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ strokeDasharray: 30, strokeDashoffset: 0, animation: 'drawCheck 0.55s ease forwards' }}
          />
        </svg>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--text-1)', letterSpacing: '-0.4px' }}>
          Pacote .mbz gerado
        </h2>
        <p className="max-w-sm text-[13px]" style={{ color: 'var(--text-2)' }}>
          O arquivo foi baixado automaticamente. Agora você pode importá-lo no Moodle.
        </p>
      </div>

      <div
        className="flex items-center gap-2 rounded-md px-3 py-1.5 font-mono-ui text-[10.5px] uppercase tracking-[0.06em]"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)' }} />
        sucesso
      </div>

      {quizOnly && (
        <div
          className="w-full max-w-xl rounded-md p-4 text-left"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
        >
          <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
            como importar no Moodle
          </span>
          <ol className="mt-3 flex flex-col gap-2.5">
            {PASSOS_QUIZ_ONLY.map((passo, i) => (
              <li key={passo} className="flex items-start gap-3 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}
                >
                  {i + 1}
                </span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-2 flex flex-col items-center gap-2.5">
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-md px-4 py-1.5 text-[12.5px] font-medium transition-colors"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          Gerar outro
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
          isso reinicia o processo do início
        </p>
      </div>
    </div>
  );
}
