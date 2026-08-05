import type { Campos, Sessao } from './index';

export type LinhaPrevia = {
  username: string;
  nome: string;
  email: string;
  status: string;
};

export type LinhaResultado = {
  status: string;
  id: string;
  username: string;
  inscricao: string;
};

export type Resumo = {
  criados: number;
  atualizados: number;
  erros: number;
  linhas: LinhaResultado[];
  texto: string;
};

export type FormularioPasso2 = { campos: Campos; action: string; method: string };

/** Valores dos <select> do passo 2, conferidos contra o ead.ifce.edu.br. */
export declare const OPCOES_PADRAO: Record<string, string>;
export declare const DELIMITADOR_PADRAO: string;

/** Sobe o CSV e devolve a pré-visualização do Moodle sem criar ninguém. */
export declare function previsualiza(
  sessao: Sessao,
  opcoes: { csv: string; nomeArquivo?: string; delimitador?: string },
): Promise<{ formulario: FormularioPasso2; linhas: LinhaPrevia[]; html: string }>;

/** Confirma: cria e atualiza os usuários. Não tem desfazer. */
export declare function confirma(
  sessao: Sessao,
  formulario: FormularioPasso2,
  opcoes?: Record<string, string>,
): Promise<{ ok: boolean; resumo: Resumo; erro: string }>;

export declare function leLinhasDaPrevia(html: string): LinhaPrevia[];
export declare function leResumo(html: string): Resumo;
export declare function formularioComUutype(html: string): FormularioPasso2 | null;
export declare function achaRepositorioDeUpload(html: string): string;
