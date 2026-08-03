'use client';

import { paraInput, doInput } from '../lib/cadencia';
import type { Config, Modo, Turma } from './types';

const campoBase = {
  background: 'var(--surface-2)',
  border: '1px solid var(--line)',
  color: 'var(--ink)',
};

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px]" style={{ color: 'var(--ink-2)' }}>{children}</span>;
}

/* Escolha do alvo (turmas + intervalo de aulas) e do modelo de datas.
 *
 * "Aula N" é a seção N do curso — a numeração que o Moodle já usa. */
export default function Escopo({
  ids, onIdsChange, turmas, carregando, onCarregar,
  config, onConfigChange, onPrevia, previewando, erro,
}: {
  ids: string;
  onIdsChange: (v: string) => void;
  turmas: Turma[];
  carregando: boolean;
  onCarregar: () => void;
  config: Config;
  onConfigChange: (c: Config) => void;
  onPrevia: () => void;
  previewando: boolean;
  erro: string | null;
}) {
  const muda = <K extends keyof Config>(chave: K, valor: Config[K]) =>
    onConfigChange({ ...config, [chave]: valor });

  const maxAulas = Math.max(0, ...turmas.flatMap(t => t.secoes.map(s => s.numero)));
  const semData = !config.inicio && !config.fim;

  return (
    <div className="flex flex-col gap-6">
      {/* turmas */}
      <section className="flex flex-col gap-2">
        <Rotulo>Turmas (ids do Moodle, separados por vírgula, espaço ou linha)</Rotulo>
        <textarea
          value={ids}
          onChange={e => onIdsChange(e.target.value)}
          rows={3}
          placeholder="5369, 3489, 3488"
          className="rounded-[6px] px-3 py-2 font-mono-ui text-[12.5px] outline-none"
          style={campoBase}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={onCarregar}
            disabled={carregando || !ids.trim()}
            className="rounded-[6px] px-3 py-1.5 text-[12.5px] transition-opacity disabled:opacity-40"
            style={{ background: 'var(--surface-3)', color: 'var(--ink)', border: '1px solid var(--line)' }}
          >
            {carregando ? 'Lendo…' : 'Carregar turmas'}
          </button>
          {turmas.length > 0 && (
            <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              {turmas.length} turma(s) · até {maxAulas} aulas
            </span>
          )}
        </div>

        {turmas.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {turmas.map(t => (
              <li key={t.cursoId} className="flex items-baseline gap-2 text-[12px]">
                <span className="font-mono-ui" style={{ color: 'var(--ink-3)' }}>{t.cursoId}</span>
                <span style={{ color: t.erro ? 'var(--error-text)' : 'var(--ink-2)' }}>
                  {t.erro ?? t.nome}
                </span>
                {!t.erro && (
                  <span style={{ color: 'var(--ink-3)' }}>
                    · {t.secoes.length} aulas · {t.secoes.reduce((n, s) => n + s.atividades.length, 0)} atividades
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* intervalo de aulas */}
      <section className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <Rotulo>Da aula</Rotulo>
          <input
            type="number" min={1} value={config.aulaInicio}
            onChange={e => muda('aulaInicio', Number(e.target.value))}
            className="w-20 rounded-[6px] px-3 py-2 text-[13px] outline-none" style={campoBase}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <Rotulo>até a aula</Rotulo>
          <input
            type="number" min={1} value={config.aulaFim}
            onChange={e => muda('aulaFim', Number(e.target.value))}
            className="w-20 rounded-[6px] px-3 py-2 text-[13px] outline-none" style={campoBase}
          />
        </label>
        {maxAulas > 0 && (
          <button
            onClick={() => onConfigChange({ ...config, aulaInicio: 1, aulaFim: maxAulas })}
            className="pb-2 text-[11.5px] underline underline-offset-2"
            style={{ color: 'var(--ink-3)' }}
          >
            todas as aulas
          </button>
        )}
      </section>

      {/* modelo de datas */}
      <section className="flex flex-col gap-3">
        <div className="flex gap-1">
          {([['unica', 'Mesma data para todas'], ['cadencia', 'Cadência a partir da primeira']] as [Modo, string][])
            .map(([valor, texto]) => (
              <button
                key={valor}
                onClick={() => muda('modo', valor)}
                className="rounded-[6px] px-3 py-1.5 text-[12.5px] transition-colors"
                style={{
                  background: config.modo === valor ? 'var(--accent-soft)' : 'transparent',
                  color: config.modo === valor ? 'var(--accent)' : 'var(--ink-2)',
                  border: `1px solid ${config.modo === valor ? 'var(--accent)' : 'var(--line)'}`,
                }}
              >
                {texto}
              </button>
            ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <Rotulo>{config.modo === 'cadencia' ? 'Início da 1ª aula' : 'Início'}</Rotulo>
            <input
              type="datetime-local" value={paraInput(config.inicio)}
              onChange={e => muda('inicio', doInput(e.target.value))}
              className="rounded-[6px] px-3 py-2 text-[13px] outline-none" style={campoBase}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>{config.modo === 'cadencia' ? 'Fim da 1ª aula' : 'Fim'}</Rotulo>
            <input
              type="datetime-local" value={paraInput(config.fim)}
              onChange={e => muda('fim', doInput(e.target.value))}
              className="rounded-[6px] px-3 py-2 text-[13px] outline-none" style={campoBase}
            />
          </label>
          {config.modo === 'cadencia' && (
            <label className="flex flex-col gap-1.5">
              <Rotulo>Intervalo (dias)</Rotulo>
              <input
                type="number" min={1} value={config.intervaloDias}
                onChange={e => muda('intervaloDias', Number(e.target.value))}
                className="w-24 rounded-[6px] px-3 py-2 text-[13px] outline-none" style={campoBase}
              />
            </label>
          )}
        </div>

        <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          Deixe um dos dois vazio para não mexer nele. O início vai para a abertura da
          tarefa/questionário e para a restrição do bloco da aula; o fim vai para o prazo
          e o encerramento. O bloco da aula recebe só o início — pôr um &ldquo;até&rdquo; nele
          esconderia a aula inteira do aluno depois do prazo.
        </p>
      </section>

      {erro && (
        <p
          className="rounded-[6px] px-3 py-2 text-[12px]"
          style={{ background: 'var(--error-dim)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
        >
          {erro}
        </p>
      )}

      <div>
        <button
          onClick={onPrevia}
          disabled={previewando || !turmas.length || semData || config.aulaFim < config.aulaInicio}
          className="rounded-[6px] px-4 py-2 text-[13px] font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {previewando ? 'Simulando…' : 'Ver prévia'}
        </button>
      </div>
    </div>
  );
}
