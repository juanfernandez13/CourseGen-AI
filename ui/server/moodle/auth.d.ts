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
