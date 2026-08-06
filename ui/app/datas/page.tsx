'use client';

import { useCallback, useEffect, useState } from 'react';

import LoginMoodle from './components/LoginMoodle';
import Escopo from './components/Escopo';
import Previa from './components/Previa';
import { montaLinhas } from './lib/cadencia';
import type { Config, ItemRelatorio, Linha, Turma } from './components/types';

type Sessao = { autenticado: boolean; usuario?: string; nome?: string; configuracao?: string };

const CONFIG_INICIAL: Config = {
  modo: 'unica',
  aulaInicio: 1,
  aulaFim: 1,
  inicio: '',
  fim: '',
  intervaloDias: 7,
};

async function leErro(res: Response) {
  try {
    const corpo = await res.json();
    if (corpo?.error) return String(corpo.error);
  } catch { /* resposta sem JSON */ }
  return `Erro ${res.status}`;
}

export default function Datas() {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [passo, setPasso] = useState<'configurar' | 'previa'>('configurar');

  const [ids, setIds] = useState('');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [config, setConfig] = useState<Config>(CONFIG_INICIAL);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [relatorio, setRelatorio] = useState<ItemRelatorio[] | null>(null);
  const [aplicado, setAplicado] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/datas/sessao')
      .then(r => r.json())
      .then(setSessao)
      .catch(() => setSessao({ autenticado: false }));
  }, []);

  const deslogar = useCallback(async () => {
    await fetch('/api/datas/sessao', { method: 'DELETE' });
    setSessao({ autenticado: false });
    setTurmas([]);
    setRelatorio(null);
    setPasso('configurar');
  }, []);

  async function entrar(credenciais: { usuario: string; senha: string }) {
    const res = await fetch('/api/datas/sessao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credenciais),
    });
    if (!res.ok) throw new Error(await leErro(res));
    setSessao(await res.json());
  }

  async function carregarTurmas() {
    setCarregando(true);
    setErro(null);
    try {
      const cursos = ids.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/datas/turmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursos }),
      });
      if (res.status === 401) return deslogar();
      if (!res.ok) throw new Error(await leErro(res));

      const { turmas: lidas } = await res.json();
      setTurmas(lidas);

      // pré-preenche o intervalo com todas as aulas encontradas
      const maior = Math.max(0, ...lidas.flatMap((t: Turma) => t.secoes.map(s => s.numero)));
      if (maior > 0) setConfig(c => ({ ...c, aulaInicio: 1, aulaFim: maior }));
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível ler as turmas.');
    } finally {
      setCarregando(false);
    }
  }

  function verPrevia() {
    setLinhas(montaLinhas(config));
    setRelatorio(null);
    setAplicado(false);
    setErro(null);
    setPasso('previa');
  }

  /* Uma turma por requisição: cada chamada cabe no limite de duração da função,
   * o progresso aparece turma a turma e uma falha isolada não derruba o lote. */
  async function percorrer(simular: boolean) {
    const cursos = turmas.filter(t => !t.erro).map(t => t.cursoId);
    const acumulado: ItemRelatorio[] = [];
    setErro(null);
    setProgresso({ atual: 0, total: cursos.length });

    try {
      for (const [i, curso] of cursos.entries()) {
        setProgresso({ atual: i + 1, total: cursos.length });

        const res = await fetch('/api/datas/aplicar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ curso, linhas, simular }),
        });
        if (res.status === 401) return deslogar();
        if (!res.ok) throw new Error(await leErro(res));

        const { relatorio: parcial } = await res.json();
        acumulado.push(...parcial);
        setRelatorio([...acumulado]);
      }
      setAplicado(!simular);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao processar as turmas.');
      setRelatorio(acumulado.length ? [...acumulado] : null);
    } finally {
      setProgresso(null);
    }
  }

  async function simular() {
    setSimulando(true);
    setAplicado(false);
    await percorrer(true);
    setSimulando(false);
  }

  async function aplicar() {
    setAplicando(true);
    await percorrer(false);
    setAplicando(false);
  }

  /* Editar uma linha invalida a prévia: um relatório velho ao lado do botão
   * "Aplicar" é pior que nenhum relatório. */
  function trocarLinhas(novas: Linha[]) {
    setLinhas(novas);
    setRelatorio(null);
    setAplicado(false);
  }

  if (sessao === null) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
        Verificando sessão…
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col px-6 py-8">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>Datas das aulas</h1>
          <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Abertura e prazo das atividades e do bloco de cada aula, em lote.
          </p>
        </div>

        {sessao.autenticado && (
          <button
            onClick={deslogar}
            className="text-[11.5px] underline underline-offset-2"
            style={{ color: 'var(--ink-3)' }}
          >
            sair ({sessao.nome || sessao.usuario})
          </button>
        )}
      </div>

      <div
        className="rounded-lg p-6 sm:p-8"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        {sessao.configuracao ? (
          /* Falta configuração no servidor: mostrar o login seria enganoso,
           * porque nenhuma senha vai funcionar até a variável existir. */
          <div className="mx-auto flex max-w-md flex-col gap-2">
            <h2 className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
              Configuração pendente no servidor
            </h2>
            <p
              className="rounded-[6px] px-3 py-2 text-[12.5px] leading-relaxed"
              style={{ background: 'var(--error-dim)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
            >
              {sessao.configuracao}
            </p>
          </div>
        ) : !sessao.autenticado ? (
          <LoginMoodle onEntrar={entrar} />
        ) : passo === 'configurar' ? (
          <Escopo
            ids={ids} onIdsChange={setIds}
            turmas={turmas} carregando={carregando} onCarregar={carregarTurmas}
            config={config} onConfigChange={setConfig}
            onPrevia={verPrevia} previewando={false} erro={erro}
          />
        ) : (
          <Previa
            linhas={linhas} onLinhasChange={trocarLinhas}
            relatorio={relatorio} simulando={simulando} aplicando={aplicando}
            progresso={progresso} onSimular={simular} onAplicar={aplicar}
            onVoltar={() => setPasso('configurar')} erro={erro} aplicado={aplicado}
          />
        )}
      </div>
    </div>
  );
}
