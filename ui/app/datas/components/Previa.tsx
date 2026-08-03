'use client';

import { paraInput, doInput, formataCurto } from '../lib/cadencia';
import { ROTULO_STATUS, type ItemRelatorio, type Linha, type Mudanca, type Status } from './types';

const COR_STATUS: Record<Status, string> = {
  gravado: 'var(--ok)',
  planejado: 'var(--accent)',
  'sem-mudanca': 'var(--ink-3)',
  recusado: 'var(--error-text)',
  erro: 'var(--error-text)',
};

/* Uma tarefa move duedate e cutoffdate para a mesma data: sem agrupar, a linha
 * repetiria "fim: X → Y" duas vezes. */
function resumeMudancas(mudancas: Mudanca[]) {
  const vistos = new Map<string, Mudanca & { chave: string }>();

  for (const m of mudancas) {
    const chave = `${m.rotulo}|${m.de}|${m.para}`;
    if (!vistos.has(chave)) vistos.set(chave, { ...m, chave });
  }

  return [...vistos.values()];
}

function Chip({ status }: { status: Status }) {
  return (
    <span
      className="rounded-[4px] px-1.5 py-0.5 font-mono-ui text-[10px] whitespace-nowrap"
      style={{ color: COR_STATUS[status], border: `1px solid ${COR_STATUS[status]}`, opacity: 0.9 }}
    >
      {ROTULO_STATUS[status]}
    </span>
  );
}

/* Prévia e aplicação.
 *
 * A simulação é obrigatória antes de gravar, e editar qualquer linha invalida o
 * relatório: escrever data em turma de produção é irreversível, e um relatório
 * velho ao lado de um botão "Aplicar" seria pior que nenhum relatório. */
export default function Previa({
  linhas, onLinhasChange, relatorio, simulando, aplicando, progresso,
  onSimular, onAplicar, onVoltar, erro, aplicado,
}: {
  linhas: Linha[];
  onLinhasChange: (l: Linha[]) => void;
  relatorio: ItemRelatorio[] | null;
  simulando: boolean;
  aplicando: boolean;
  progresso: { atual: number; total: number } | null;
  onSimular: () => void;
  onAplicar: () => void;
  onVoltar: () => void;
  erro: string | null;
  aplicado: boolean;
}) {
  function editar(indice: number, campo: 'inicio' | 'fim', valor: string) {
    onLinhasChange(linhas.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
  }

  const ocupado = simulando || aplicando;
  const totais = (relatorio ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const vaiMudar = (relatorio ?? []).filter(i => i.status === 'planejado').length;

  const porTurma = (relatorio ?? []).reduce<Record<string, ItemRelatorio[]>>((acc, item) => {
    (acc[item.curso] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* linhas editáveis */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
            Datas por aula
          </h3>
          <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            ajuste qualquer linha se precisar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[12.5px]">
            <thead>
              <tr style={{ color: 'var(--ink-3)' }}>
                <th className="pb-1.5 text-left font-normal text-[11px]">Aula</th>
                <th className="pb-1.5 text-left font-normal text-[11px]">Início</th>
                <th className="pb-1.5 text-left font-normal text-[11px]">Fim</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, i) => (
                <tr key={linha.aula} style={{ borderTop: '1px solid var(--line-2)' }}>
                  <td className="py-1.5 pr-3 font-mono-ui" style={{ color: 'var(--ink-2)' }}>
                    {linha.aula}
                  </td>
                  {(['inicio', 'fim'] as const).map(campo => (
                    <td key={campo} className="py-1.5 pr-3">
                      <input
                        type="datetime-local"
                        value={paraInput(linha[campo])}
                        disabled={ocupado}
                        onChange={e => editar(i, campo, doInput(e.target.value))}
                        className="rounded-[5px] px-2 py-1 text-[12px] outline-none disabled:opacity-50"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ações */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onVoltar}
          disabled={ocupado}
          className="rounded-[6px] px-3 py-2 text-[12.5px] transition-opacity disabled:opacity-40"
          style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
        >
          Voltar
        </button>

        <button
          onClick={onSimular}
          disabled={ocupado}
          className="rounded-[6px] px-4 py-2 text-[13px] font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--surface-3)', color: 'var(--ink)', border: '1px solid var(--line)' }}
        >
          {simulando ? 'Simulando…' : relatorio ? 'Simular de novo' : 'Simular'}
        </button>

        {relatorio && !aplicado && (
          <button
            onClick={onAplicar}
            disabled={ocupado || vaiMudar === 0}
            className="rounded-[6px] px-4 py-2 text-[13px] font-medium transition-opacity disabled:opacity-40"
            style={{ background: 'var(--danger)', color: 'var(--accent-ink)' }}
          >
            {aplicando ? 'Gravando…' : `Aplicar ${vaiMudar} alteração(ões)`}
          </button>
        )}

        {progresso && (
          <span className="font-mono-ui text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            turma {progresso.atual}/{progresso.total}
          </span>
        )}
      </div>

      {erro && (
        <p
          className="rounded-[6px] px-3 py-2 text-[12px]"
          style={{ background: 'var(--error-dim)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
        >
          {erro}
        </p>
      )}

      {relatorio && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <span className="font-medium" style={{ color: 'var(--ink)' }}>
              {aplicado ? 'Resultado' : 'Prévia'}
            </span>
            {Object.entries(totais).map(([status, total]) => (
              <span key={status} className="flex items-center gap-1.5">
                <Chip status={status as Status} />
                <span style={{ color: 'var(--ink-3)' }}>{total}</span>
              </span>
            ))}
          </div>

          {!aplicado && vaiMudar > 0 && (
            <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Nada foi gravado ainda. &ldquo;Aplicar&rdquo; escreve nas turmas e não tem desfazer.
            </p>
          )}

          {Object.entries(porTurma).map(([curso, itens]) => (
            <div key={curso} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2 text-[12px]">
                <span className="font-mono-ui" style={{ color: 'var(--ink-3)' }}>{curso}</span>
                <span style={{ color: 'var(--ink-2)' }}>{itens[0]?.cursoNome}</span>
              </div>

              <ul className="flex flex-col">
                {itens.map((item, i) => (
                  <li
                    key={`${item.alvo}-${item.id ?? i}`}
                    className="flex flex-wrap items-baseline gap-2 py-1 text-[12px]"
                    style={{ borderTop: '1px solid var(--line-2)' }}
                  >
                    <Chip status={item.status} />
                    <span className="font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {item.alvo === 'secao' ? `aula ${item.aula}` : item.tipo}
                    </span>
                    <span style={{ color: 'var(--ink-2)' }}>{item.nome}</span>

                    {resumeMudancas(item.mudancas).map(m => (
                      <span key={m.chave} className="font-mono-ui text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                        {m.rotulo}: {formataCurto(m.de)} → {formataCurto(m.para)}
                      </span>
                    ))}

                    {item.erro && (
                      <span className="text-[11px]" style={{ color: 'var(--error-text)' }}>{item.erro}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
