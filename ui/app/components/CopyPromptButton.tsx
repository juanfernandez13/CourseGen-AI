'use client';

import { useState, type CSSProperties } from 'react';

/* Copia o mesmo prompt que a aplicação envia ao Gemini, já acompanhado de um
 * exemplo de saída. Serve para quem prefere gerar o JSON em outra IA e colar
 * o resultado na revisão. */

type Props = { className?: string; style?: CSSProperties };

type State = 'idle' | 'loading' | 'copied' | 'error';

const LABEL: Record<State, string> = {
  idle:    'copiar prompt',
  loading: 'copiando…',
  copied:  '✓ copiado',
  error:   '✗ falhou',
};

export default function CopyPromptButton({ className, style }: Props) {
  const [state, setState] = useState<State>('idle');

  async function copy() {
    setState('loading');
    try {
      const res = await fetch('/api/prompt');
      if (!res.ok) throw new Error('prompt indisponível');
      const { prompt } = await res.json();
      await navigator.clipboard.writeText(prompt);
      setState('copied');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      onClick={copy}
      disabled={state === 'loading'}
      className={className}
      style={style}
      title="Copia o prompt usado pela aplicação, com um exemplo de saída. Cole em outra IA seguido do texto da matriz."
    >
      {LABEL[state]}
    </button>
  );
}
