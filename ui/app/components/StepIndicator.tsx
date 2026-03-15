'use client';

type Props = {
  currentStep: 1 | 2 | 3;
  onNavigate?: (step: 1 | 2 | 3) => void;
};

const steps = [
  { number: 1 as const, label: 'Upload' },
  { number: 2 as const, label: 'Revisar' },
  { number: 3 as const, label: 'Concluído' },
];

export default function StepIndicator({ currentStep, onNavigate }: Props) {
  return (
    <div className="flex items-center justify-center mb-10">
      {steps.map((step, index) => {
        const done      = step.number < currentStep;
        const active    = step.number === currentStep;
        const isLast    = index === steps.length - 1;
        const clickable = done && !!onNavigate;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={() => clickable && onNavigate(step.number)}
                onKeyDown={e => e.key === 'Enter' && clickable && onNavigate(step.number)}
                className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all duration-200"
                style={{
                  background:  done || active ? 'var(--step-bg-active)' : 'var(--step-bg-idle)',
                  color:       done || active ? 'var(--step-text-active)' : 'var(--step-text-idle)',
                  border:      `2px solid ${done || active ? 'var(--step-border-active)' : 'var(--step-border-idle)'}`,
                  boxShadow:   active ? 'var(--step-shadow)' : 'none',
                  cursor:      clickable ? 'pointer' : 'default',
                  outline:     'none',
                }}
                title={clickable ? `Voltar para ${step.label}` : undefined}
              >
                {done ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : step.number}
              </div>

              <span
                className="text-xs font-medium whitespace-nowrap transition-colors"
                style={{
                  color:  active ? 'var(--step-label-active)' : clickable ? 'var(--primary)' : 'var(--step-label-idle)',
                  cursor: clickable ? 'pointer' : 'default',
                  textDecoration: clickable ? 'underline' : 'none',
                  textDecorationColor: 'var(--primary)',
                }}
                onClick={() => clickable && onNavigate(step.number)}
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                className="w-20 h-0.5 mx-2 mb-5 transition-all duration-300"
                style={{ background: done ? 'var(--step-line-done)' : 'var(--step-line-idle)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
