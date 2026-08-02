'use client';

/* Editor do livro de notas.
 *
 * Espelha o que o gerador faz em server/mbzGenerator/model.js: cada categoria
 * tem nome, peso e os tipos de atividade que recebe. Tipo não reivindicado por
 * nenhuma categoria fica na raiz do livro, como a Avaliação Final. */

export type CategoriaNota = { nome: string; peso: number; tipos: string[] };

const TIPOS: { key: string; label: string }[] = [
  { key: 'forum',      label: 'fóruns' },
  { key: 'quiz',       label: 'questionários' },
  { key: 'tarefa',     label: 'tarefas' },
  { key: 'chat',       label: 'chats' },
  { key: 'wiki',       label: 'wikis' },
  { key: 'glossario',  label: 'glossários' },
  { key: 'encontro',   label: 'encontros presenciais' },
];

/* Mesmo default do servidor, para a tela mostrar o que será gerado. */
export const CATEGORIAS_PADRAO: CategoriaNota[] = [
  { nome: 'Atividades a distância', peso: 40, tipos: ['forum', 'quiz', 'tarefa', 'chat', 'wiki', 'glossario'] },
  { nome: 'Atividades presenciais', peso: 60, tipos: ['encontro'] },
];

export default function GradebookEditor({
  categorias, onChange,
}: {
  categorias: CategoriaNota[];
  onChange: (categorias: CategoriaNota[]) => void;
}) {
  const somaPesos = categorias.reduce((s, c) => s + (Number(c.peso) || 0), 0);
  const semCategoria = TIPOS.filter(t => !categorias.some(c => c.tipos.includes(t.key)));

  function editar(i: number, patch: Partial<CategoriaNota>) {
    onChange(categorias.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  /* Um tipo pertence a uma categoria só — marcar aqui desmarca nas outras. */
  function alternarTipo(i: number, tipo: string) {
    const jaTem = categorias[i].tipos.includes(tipo);
    onChange(categorias.map((c, idx) => {
      if (idx === i) {
        return { ...c, tipos: jaTem ? c.tipos.filter(t => t !== tipo) : [...c.tipos, tipo] };
      }
      return jaTem ? c : { ...c, tipos: c.tipos.filter(t => t !== tipo) };
    }));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Livro de notas</span>
        <span className="text-xs" style={{ color: somaPesos === 100 ? 'var(--text-3)' : 'var(--error)' }}>
          soma dos pesos: {somaPesos}{somaPesos !== 100 && ' — o Moodle espera 100'}
        </span>
      </div>

      {categorias.map((cat, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg p-3"
          style={{ background: 'var(--bg)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={cat.nome}
              onChange={e => editar(i, { nome: e.target.value })}
              placeholder="Nome da categoria"
              className="flex-1 min-w-[180px] rounded-md px-2.5 py-1.5 text-xs outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                value={cat.peso}
                onChange={e => editar(i, { peso: Number(e.target.value) })}
                className="w-16 rounded-md px-2 py-1.5 text-xs outline-none text-right"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>%</span>
            </div>
            <button
              onClick={() => onChange(categorias.filter((_, idx) => idx !== i))}
              className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
              style={{ color: 'var(--text-4)', border: '1px solid var(--border)' }}
              title="Remover categoria"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map(tipo => {
              const marcado = cat.tipos.includes(tipo.key);
              return (
                <button
                  key={tipo.key}
                  onClick={() => alternarTipo(i, tipo.key)}
                  className="rounded-full px-2.5 py-0.5 text-xs transition-colors"
                  style={{
                    background: marcado ? 'var(--primary-dim)' : 'transparent',
                    color:      marcado ? 'var(--primary)' : 'var(--text-4)',
                    border: `1px solid ${marcado ? 'var(--primary-ring)' : 'var(--border)'}`,
                  }}
                >
                  {tipo.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => onChange([...categorias, { nome: `Categoria ${categorias.length + 1}`, peso: 0, tipos: [] }])}
          className="rounded-md px-2.5 py-1 text-xs"
          style={{ background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-ring)' }}
        >
          + categoria
        </button>

        {semCategoria.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-4)' }}>
            fora de categoria: {semCategoria.map(t => t.label).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
