import type { Sessao } from './index';

export declare function login(
  sessao: Sessao,
  credenciais: { usuario: string; senha: string },
): Promise<{ sesskey: string; nome: string }>;

export declare function extraiSesskey(html: string): string | null;
export declare function sessaoViva(sessao: Sessao): Promise<boolean>;
