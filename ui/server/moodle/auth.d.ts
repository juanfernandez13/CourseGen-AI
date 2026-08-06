export type SessaoGuardada = {
  cookies: string;
  usuario: string;
  nome: string;
  expiraEm: number;
};

export declare const COOKIE: string;
export declare const VALIDADE_S: number;

export declare function criaToken(dados: { cookies: string; usuario: string; nome: string }): string;
export declare function decifra(token: string | undefined | null): SessaoGuardada | null;

export declare const opcoesCookie: {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
};

/** Mensagem única para o caso de a variável faltar, usada nas rotas e nos testes. */
export declare const FALTA_SEGREDO: string;

/** Checa a configuração sem lançar, para a rota falhar antes de tocar no Moodle. */
export declare function configurado(): { ok: true } | { ok: false; motivo: string };
