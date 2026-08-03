'use client';

import { useState } from 'react';

/* Porta de entrada da aba. Esta tela escreve em turmas de produção, então não
 * pode ficar aberta como o gerador: só entra quem tem credencial do Moodle.
 *
 * A senha vai uma vez para o backend, que a usa para abrir a sessão e a
 * descarta. O que fica no navegador é um cookie httpOnly cifrado — este
 * componente nunca chega perto dele. */
export default function LoginMoodle({
  onEntrar,
}: {
  onEntrar: (credenciais: { usuario: string; senha: string }) => Promise<void>;
}) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      await onEntrar({ usuario, senha });
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.');
      // limpa e volta a ocultar: a próxima tentativa não começa exposta
      setSenha('');
      setVerSenha(false);
    } finally {
      setLoading(false);
    }
  }

  const campo = {
    background: 'var(--surface-2)',
    border: '1px solid var(--line)',
    color: 'var(--ink)',
  };

  return (
    <form onSubmit={submeter} className="mx-auto flex max-w-sm flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
          Entrar no Moodle
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          Esta aba altera datas de turmas reais. Use a mesma conta com que você edita
          os cursos no Moodle.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px]" style={{ color: 'var(--ink-2)' }}>Usuário</span>
        <input
          type="text"
          value={usuario}
          onChange={e => setUsuario(e.target.value)}
          autoComplete="username"
          required
          className="rounded-[6px] px-3 py-2 text-[13px] outline-none"
          style={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px]" style={{ color: 'var(--ink-2)' }}>Senha</span>
        <div className="relative">
          <input
            type={verSenha ? 'text' : 'password'}
            value={senha}
            onChange={e => setSenha(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-[6px] py-2 pl-3 pr-16 text-[13px] outline-none"
            style={campo}
          />
          {/* type="button" é obrigatório: dentro de um <form>, o padrão é submit
            * e revelar a senha dispararia o login. */}
          <button
            type="button"
            onClick={() => setVerSenha(v => !v)}
            aria-pressed={verSenha}
            aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] px-1.5 py-1 text-[11px]"
            style={{ color: 'var(--ink-3)' }}
          >
            {verSenha ? 'ocultar' : 'ver'}
          </button>
        </div>
      </label>

      {erro && (
        <p
          className="rounded-[6px] px-3 py-2 text-[12px]"
          style={{ background: 'var(--error-dim)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
        >
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !usuario || !senha}
        className="rounded-[6px] px-4 py-2 text-[13px] font-medium transition-opacity disabled:opacity-40"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {loading ? 'Entrando…' : 'Entrar'}
      </button>

      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
        A senha não é armazenada. Fica salvo apenas um cookie de sessão cifrado,
        que expira em 2 horas.
      </p>
    </form>
  );
}
