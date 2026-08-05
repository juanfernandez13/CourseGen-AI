'use client';

import { useCallback, useEffect, useState } from 'react';
import LoginMoodle from '../../datas/components/LoginMoodle';
import type { ArquivoCsv } from './CsvDownload';

type LinhaPrevia = { username: string; nome: string; email: string; status: string };
type Resumo = { criados: number; atualizados: number; erros: number; texto: string };

async function leErro(res: Response) {
  try {
    const corpo = await res.json();
    if (corpo?.error) return String(corpo.error);
  } catch { /* resposta sem JSON */ }
  return `Erro ${res.status}`;
}

/* Envio do CSV gerado direto para o "Carregar lista de usuários" do Moodle.
 *
 * Exige login, como a aba de datas — isto cria contas de verdade. E a prévia é
 * obrigatória: quem confirma vê antes, linha a linha, o que o próprio Moodle
 * diz que vai fazer com cada aluno. Não há desfazer. */
export default function EnvioMoodle({ arquivo, onFechar }: { arquivo: ArquivoCsv; onFechar: () => void }) {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [linhas, setLinhas] = useState<LinhaPrevia[] | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/datas/sessao')
      .then(r => r.json())
      .then(s => setAutenticado(Boolean(s?.autenticado)))
      .catch(() => setAutenticado(false));
  }, []);

  const chamar = useCallback(async (confirmar: boolean) => {
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch('/api/alunos/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: arquivo.csv, nomeArquivo: arquivo.filename, confirmar }),
      });
      if (res.status === 401) { setAutenticado(false); return; }
      if (!res.ok) throw new Error(await leErro(res));

      const dados = await res.json();
      setLinhas(dados.linhas ?? []);
      if (dados.confirmado) setResumo(dados.resumo ?? null);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao falar com o Moodle.');
    } finally {
      setOcupado(false);
    }
  }, [arquivo]);

  async function entrar(credenciais: { usuario: string; senha: string }) {
    const res = await fetch('/api/datas/sessao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credenciais),
    });
    if (!res.ok) throw new Error(await leErro(res));
    setAutenticado(true);
  }

  const caixa = { background: 'var(--surface-2)', border: '1px solid var(--line)' };

  return (
    <div className="mt-2 rounded-[6px] p-4" style={caixa}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>Enviar ao Moodle</div>
          <div className="font-mono-ui text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
            {arquivo.filename}
          </div>
        </div>
        <button onClick={onFechar} className="text-[11.5px] underline underline-offset-2" style={{ color: 'var(--ink-3)' }}>
          fechar
        </button>
      </div>

      {autenticado === null && (
        <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>Verificando sessão…</p>
      )}

      {autenticado === false && <LoginMoodle onEntrar={entrar} />}

      {autenticado && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => chamar(false)}
              disabled={ocupado}
              className="rounded-[6px] px-3 py-1.5 text-[12.5px] disabled:opacity-40"
              style={{ background: 'var(--surface-3)', color: 'var(--ink)', border: '1px solid var(--line)' }}
            >
              {ocupado && !resumo ? 'Consultando…' : linhas ? 'Simular de novo' : 'Simular envio'}
            </button>

            {linhas && !resumo && (
              <button
                onClick={() => chamar(true)}
                disabled={ocupado}
                className="rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-40"
                style={{ background: 'var(--danger)', color: 'var(--accent-ink)' }}
              >
                {ocupado ? 'Enviando…' : `Confirmar envio de ${linhas.length}`}
              </button>
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

          {linhas && !resumo && (
            <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Nada foi enviado ainda. Confirmar cria e atualiza contas, e não tem desfazer.
            </p>
          )}

          {resumo && (
            <p
              className="rounded-[6px] px-3 py-2 text-[12px]"
              style={{ background: 'var(--accent-soft)', color: 'var(--ink)', border: '1px solid var(--accent)' }}
            >
              Enviado. Criados: {resumo.criados} · Atualizados: {resumo.atualizados} · Erros: {resumo.erros}
            </p>
          )}

          {linhas && linhas.length > 0 && (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ color: 'var(--ink-3)' }}>
                    <th className="pb-1 text-left font-normal text-[11px]">Usuário</th>
                    <th className="pb-1 text-left font-normal text-[11px]">Nome</th>
                    <th className="pb-1 text-left font-normal text-[11px]">Situação no Moodle</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={`${l.username}-${i}`} style={{ borderTop: '1px solid var(--line-2)' }}>
                      <td className="py-1 pr-3 font-mono-ui" style={{ color: 'var(--ink-2)' }}>{l.username}</td>
                      <td className="py-1 pr-3" style={{ color: 'var(--ink-2)' }}>{l.nome}</td>
                      <td className="py-1" style={{ color: 'var(--ink-3)' }}>{l.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
