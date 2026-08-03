export type Condicao = { type: string; d?: string; t?: number; [chave: string]: unknown };

export type Restricoes = { op: string; c: Condicao[]; showc: boolean[]; show?: boolean };

export declare function analisaRestricoes(bruto: string | undefined | null): Restricoes;

export declare function defineRestricaoDeData(
  restricoes: Restricoes,
  alvo: { direcao: string; timestamp: number },
): { restricoes: Restricoes; anterior: number | null; criada: boolean };

export declare function dataAtual(restricoes: Restricoes, direcao: string): number | null;
export declare function serializa(restricoes: Restricoes): string;
