export type SessaoGuardada = {
  cookies: string;
  usuario: string;
  nome: string;
  expiraEm: number;
};

export declare const COOKIE: string;
export declare const VALIDADE_S: number;

/** Empacota a sessão: cifrada quando há MOODLE_SESSION_SECRET, plana sem ele. */
export declare function criaToken(dados: { cookies: string; usuario: string; nome: string }): string;

/** Lê os dois formatos. Devolve null para token vencido, adulterado ou ilegível. */
export declare function decifra(token: string | undefined | null): SessaoGuardada | null;

/** True quando a sessão está sendo cifrada. Só para diagnóstico. */
export declare function cifrando(): boolean;

export declare const opcoesCookie: {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
};
