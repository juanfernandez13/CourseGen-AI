'use client';

type Props = {
  currentStep: 1 | 2 | 3;
  onNavigate?: (step: 1 | 2 | 3) => void;
};

const steps = [
  { number: 1 as const, label: 'upload',   key: 'upload'   },
  { number: 2 as const, label: 'revisão',  key: 'review'   },
  { number: 3 as const, label: 'download', key: 'download' },
];

export default function StepIndicator({ currentStep, onNavigate }: Props) {
  return (
    <div
      className="-mx-6 mb-8 flex h-10 items-center gap-2.5 border-b px-6 font-mono-ui text-[11.5px] uppercase tracking-[0.06em]"
      style={{ borderColor: 'var(--line)' }}
    >
      {steps.map((step, index) => {
        const done   = step.number < currentStep;
        const active = step.number === currentStep;
        const click  = done && !!onNavigate;

        return (
          <div key={step.key} className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={!click}
              onClick={() => click && onNavigate(step.number)}
              className="flex items-center gap-1.5 transition-colors"
              style={{
                color: active || done ? 'var(--ink)' : 'var(--ink-3)',
                cursor: click ? 'pointer' : 'default',
              }}
              title={click ? `Voltar para ${step.label}` : undefined}
            >
              <span
                className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold"
                style={{
                  background: active ? 'var(--accent)' : done ? 'var(--accent-soft)' : 'transparent',
                  color:      active ? 'var(--bg)'    : done ? 'var(--accent-ink)'   : 'var(--ink-3)',
                  border:     active ? '1px solid var(--accent)'
                            : done   ? '1px solid var(--primary-ring)'
                            :          '1px solid var(--line-2)',
                }}
              >
                {done ? (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : step.number}
              </span>
              <span style={{ fontWeight: active ? 600 : 400 }}>{step.label}</span>
            </button>

            {index < steps.length - 1 && (
              <span style={{ color: 'var(--ink-3)' }}>/</span>
            )}
          </div>
        );
      })}

      <span className="ml-auto" style={{ color: 'var(--ink-3)' }}>
        esc para cancelar
      </span>
    </div>
  );
}
