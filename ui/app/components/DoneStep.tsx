'use client';

type Props = { onReset: () => void };

export default function DoneStep({ onReset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16 text-center">
      <style>{`
        @keyframes drawCheck { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } }
        @keyframes pulseSlow  { 0%,100% { opacity: 0.15; } 50% { opacity: 0.35; } }
      `}</style>

      {/* Animated circle + checkmark */}
      <div className="relative flex items-center justify-center w-28 h-28 rounded-full"
        style={{ background: 'var(--primary-dim)', border: '2px solid var(--primary-ring)' }}>
        <span className="absolute inset-0 rounded-full"
          style={{ background: 'var(--primary-dim)', animation: 'pulseSlow 2.5s ease-in-out infinite' }} />
        <div className="flex items-center justify-center w-20 h-20 rounded-full"
          style={{ background: 'var(--primary-dim)' }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="20" stroke="var(--primary)" strokeWidth="1.5" />
            <path d="M13 22l7 7 11-14"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 30, strokeDashoffset: 0, animation: 'drawCheck 0.5s ease forwards' }}
            />
          </svg>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
          MBZ gerado com sucesso!
        </h2>
        <p className="text-base max-w-sm" style={{ color: 'var(--text-3)' }}>
          O arquivo foi baixado automaticamente. Agora você pode importá-lo no Moodle.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200"
          style={{ background: 'var(--primary)', color: 'var(--primary-text)' }}
        >
          Gerar outro
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <p className="text-xs" style={{ color: 'var(--text-4)' }}>
          Isso irá reiniciar o processo do início.
        </p>
      </div>
    </div>
  );
}
