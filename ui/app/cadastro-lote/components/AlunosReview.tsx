'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Aluno } from './types';

/* Colunas editáveis na revisão. password é fixa e não aparece como campo.
 * course1 saiu da tabela: como só se envia uma planilha por vez, o curso é o
 * mesmo para o lote inteiro e repeti-lo por linha só truncava as outras. */
const CAMPOS = [
  { key: 'username',  label: 'CPF (username)', width: 130 },
  { key: 'firstname', label: 'firstname',      width: 130 },
  { key: 'lastname',  label: 'lastname',       width: 180 },
  { key: 'email',     label: 'email',          width: 260 },
  { key: 'city',      label: 'city',           width: 140 },
] as const;

type CampoKey = typeof CAMPOS[number]['key'];

function cursosDistintos(alunos: Aluno[]): string[] {
  return [...new Set(alunos.map(a => (a.course1 ?? '').trim()).filter(Boolean))];
}

function problemaDe(aluno: Aluno, campo: string): string | null {
  return aluno.problemas.find(p => p.campo === campo)?.mensagem ?? null;
}
function avisoDe(aluno: Aluno, campo: string): string | null {
  return aluno.avisos.find(a => a.campo === campo)?.mensagem ?? null;
}

export default function AlunosReview({
  alunos, onChange, onConfirm, onBack, loading, error,
}: {
  alunos: Aluno[];
  onChange: (alunos: Aluno[]) => void;
  onConfirm: (cursos: string[]) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  /* Pré-preenchida com o que veio da planilha; cada curso vira um CSV. */
  const [cursos, setCursos] = useState<string[]>(() => cursosDistintos(alunos));
  const [novoCurso, setNovoCurso] = useState('');

  /* O curso deixou de ser por linha: quem define é a lista acima, e cada
   * arquivo recebe o seu. Some o problema por linha para não virar ruído. */
  useEffect(() => {
    if (alunos.some(a => a.problemas.some(p => p.campo === 'course1'))) {
      onChange(alunos.map(aluno => ({
        ...aluno,
        problemas: aluno.problemas.filter(p => p.campo !== 'course1'),
      })));
    }
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function adicionarCurso() {
    const valor = novoCurso.trim();
    if (!valor || cursos.includes(valor)) { setNovoCurso(''); return; }
    setCursos([...cursos, valor]);
    setNovoCurso('');
  }

  function editarCurso(index: number, valor: string) {
    setCursos(cursos.map((c, i) => (i === index ? valor : c)));
  }

  function removerCurso(index: number) {
    setCursos(cursos.filter((_, i) => i !== index));
  }

  const cursosValidos = cursos.map(c => c.trim()).filter(Boolean);

  const totalProblemas = useMemo(
    () => alunos.reduce((soma, a) => soma + a.problemas.length, 0),
    [alunos],
  );
  const linhasComProblema = useMemo(
    () => alunos.filter(a => a.problemas.length > 0).length,
    [alunos],
  );

  function editar(index: number, campo: CampoKey | 'type1', valor: string) {
    const proximos = alunos.map((aluno, i) => {
      if (i !== index) return aluno;
      const atualizado = campo === 'type1'
        ? { ...aluno, type1: (valor === '2' ? 2 : 1) as 1 | 2 }
        : { ...aluno, [campo]: valor };
      // A edição manual resolve o problema daquele campo.
      return {
        ...atualizado,
        problemas: aluno.problemas.filter(p => p.campo !== campo || !valor.trim()),
      };
    });
    onChange(proximos);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
          step 02 / revisão
        </span>
        <h2
          className="mt-1.5 text-[22px] font-semibold tracking-tight"
          style={{ color: 'var(--text-1)', letterSpacing: '-0.4px' }}
        >
          Conferir antes de gerar
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>
          {alunos.length} {alunos.length === 1 ? 'linha' : 'linhas'} ·{' '}
          {totalProblemas === 0
            ? 'nenhum problema encontrado'
            : `${totalProblemas} ${totalProblemas === 1 ? 'problema' : 'problemas'} em ${linhasComProblema} ${linhasComProblema === 1 ? 'linha' : 'linhas'}`}
        </p>
      </div>

      {/* Geração múltipla: os mesmos alunos, um CSV por curso da lista. */}
      <div
        className="flex flex-col gap-2.5 rounded-md px-4 py-3.5"
        style={{
          background: 'var(--surface-2)',
          border: `1px solid ${cursosValidos.length ? 'var(--line)' : 'var(--error-border)'}`,
        }}
      >
        <span className="font-mono-ui text-[10.5px] uppercase tracking-[0.06em]" style={{ color: 'var(--ink-3)' }}>
          course1 · cursos a gerar
        </span>

        {cursos.map((curso, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-mono-ui text-[11px] w-4 shrink-0" style={{ color: 'var(--ink-3)' }}>
              {i + 1}
            </span>
            <input
              value={curso}
              onChange={e => editarCurso(i, e.target.value)}
              placeholder="ex: Técnico em Serviços Públicos"
              spellCheck={false}
              className="flex-1 rounded-[5px] px-3 py-2 text-[13px] outline-none"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${curso.trim() ? 'var(--line-2)' : 'var(--error-border)'}`,
                color: 'var(--ink)',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              onClick={() => removerCurso(i)}
              className="flex h-7 w-7 items-center justify-center rounded shrink-0 transition-colors hover:bg-(--surface-3)"
              style={{ color: 'var(--ink-3)' }}
              title="Remover curso"
            >
              ×
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <span className="w-4 shrink-0" />
          <input
            value={novoCurso}
            onChange={e => setNovoCurso(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarCurso(); } }}
            placeholder="adicionar outro curso e pressionar Enter"
            spellCheck={false}
            className="flex-1 rounded-[5px] px-3 py-2 text-[13px] outline-none"
            style={{
              background: 'transparent',
              border: '1px dashed var(--line-2)',
              color: 'var(--ink)',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <button
            onClick={adicionarCurso}
            disabled={!novoCurso.trim()}
            className="flex h-7 w-7 items-center justify-center rounded shrink-0"
            style={{
              color: novoCurso.trim() ? 'var(--accent)' : 'var(--ink-3)',
              cursor: novoCurso.trim() ? 'pointer' : 'not-allowed',
            }}
            title="Adicionar curso"
          >
            +
          </button>
        </div>

        <span
          className="text-[11.5px]"
          style={{ color: cursosValidos.length ? 'var(--ink-3)' : 'var(--error)' }}
        >
          {cursosValidos.length
            ? `${alunos.length} ${alunos.length === 1 ? 'aluno' : 'alunos'} × ${cursosValidos.length} ${cursosValidos.length === 1 ? 'curso' : 'cursos'} = ${cursosValidos.length} ${cursosValidos.length === 1 ? 'arquivo' : 'arquivos'}.`
            : 'Informe ao menos um curso para gerar.'}
        </span>
      </div>

      {/* A tabela rola sozinha; a página nunca rola na horizontal. */}
      <div className="overflow-x-auto" style={{ border: '1px solid var(--line)', borderRadius: 6 }}>
        <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th className="px-2 py-2 text-left font-mono-ui text-[10.5px] uppercase" style={{ color: 'var(--ink-3)', width: 34 }}>#</th>
              {CAMPOS.map(c => (
                <th
                  key={c.key}
                  className="px-2 py-2 text-left font-mono-ui text-[10.5px] uppercase"
                  style={{ color: 'var(--ink-3)', minWidth: c.width }}
                >
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-left font-mono-ui text-[10.5px] uppercase" style={{ color: 'var(--ink-3)', width: 110 }}>type1</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((aluno, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                <td className="px-2 py-1 font-mono-ui text-[11px]" style={{ color: 'var(--ink-3)' }}>{i + 1}</td>

                {CAMPOS.map(campo => {
                  const problema = problemaDe(aluno, campo.key);
                  const aviso    = avisoDe(aluno, campo.key);
                  return (
                    <td key={campo.key} className="px-1 py-1">
                      <input
                        value={String(aluno[campo.key] ?? '')}
                        onChange={e => editar(i, campo.key, e.target.value)}
                        title={problema ?? aviso ?? undefined}
                        className="w-full rounded-[3px] px-1.5 py-1 outline-none font-mono-ui text-[11.5px]"
                        style={{
                          background: problema ? 'var(--error-dim)' : 'transparent',
                          border: problema
                            ? '1px solid var(--error-border)'
                            : aviso
                              ? '1px solid var(--accent)'
                              : '1px solid transparent',
                          color: 'var(--ink)',
                        }}
                      />
                    </td>
                  );
                })}

                <td className="px-1 py-1">
                  <select
                    value={aluno.type1}
                    onChange={e => editar(i, 'type1', e.target.value)}
                    className="w-full rounded-[3px] px-1.5 py-1 outline-none text-[11.5px]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--ink)' }}
                  >
                    <option value={1}>1 · aluno</option>
                    <option value={2}>2 · professor</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista os problemas por linha, para não depender só da cor da célula. */}
      {totalProblemas > 0 && (
        <div
          className="flex flex-col gap-1 rounded-md px-3 py-2.5 max-h-40 overflow-y-auto"
          style={{ background: 'var(--error-dim)', border: '1px solid var(--error-border)' }}
        >
          {alunos.flatMap((aluno, i) =>
            aluno.problemas.map((p, j) => (
              <span key={`${i}-${j}`} className="text-[11.5px]" style={{ color: 'var(--error)' }}>
                Linha {i + 1} · {p.campo}: {p.mensagem}
              </span>
            )),
          )}
        </div>
      )}

      {error && (
        <div
          className="rounded-md px-3 py-2 text-[12.5px]"
          style={{ background: 'var(--error-dim)', color: 'var(--error)', border: '1px solid var(--error-border)' }}
        >
          {error}
        </div>
      )}

      <div
        className="-mx-6 -mb-6 mt-2 flex flex-wrap items-center justify-between gap-3 px-6 py-4 sm:-mx-8 sm:-mb-8 sm:px-8"
        style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}
      >
        <button
          onClick={onBack}
          className="rounded-md px-4 py-2 text-[12.5px]"
          style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}
        >
          Voltar
        </button>
        <div className="flex items-center gap-3">
          {totalProblemas > 0 && (
            <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Ainda há problemas — dá para gerar assim mesmo.
            </span>
          )}
          <button
            onClick={() => onConfirm(cursosValidos)}
            disabled={loading || alunos.length === 0 || cursosValidos.length === 0}
            className="rounded-md px-4 py-2 text-[12.5px] font-medium"
            style={{
              background: loading || !cursosValidos.length ? 'var(--surface-3)' : 'var(--accent)',
              color:      loading || !cursosValidos.length ? 'var(--ink-3)' : '#fff',
              cursor:     loading || !cursosValidos.length ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Gerando…' : `Gerar ${cursosValidos.length || ''} CSV${cursosValidos.length === 1 ? '' : 's'}`.replace('  ', ' ')}
          </button>
        </div>
      </div>
    </div>
  );
}
