export type Par = [string, string];

export declare class Campos {
  pares: Par[];
  obtem(nome: string): string | undefined;
  tem(nome: string): boolean;
  define(nome: string, valor: string | number): this;
  entries(): Par[];
  clone(): Campos;
}

export declare class Sessao {
  constructor(base: string, opcoes?: { cookies?: string; atrasoMs?: number });
  serializaCookies(): string;
  url(caminho: string): string;
  texto(caminho: string, opcoes?: RequestInit): Promise<string>;
  postaForm(caminho: string, campos: Par[], opcoes?: RequestInit): Promise<Response & { urlFinal: string }>;
}

export type Atividade = { cmid: string; tipo: string; nome: string };

export type Secao = {
  numero: number;
  sectionId: string | null;
  nome: string;
  atividades: Atividade[];
};

export type Turma = { cursoId: number | string; nome: string; secoes: Secao[] };

export type Mudanca = {
  campo: string;
  rotulo: 'início' | 'fim';
  de: string;
  para: string;
};

export type Status = 'gravado' | 'planejado' | 'sem-mudanca' | 'recusado' | 'erro';

export type ItemRelatorio = {
  curso: number | string;
  cursoNome: string;
  aula: number | null;
  alvo: 'secao' | 'atividade' | 'turma';
  tipo: string;
  id?: string;
  nome: string;
  status: Status;
  mudancas: Mudanca[];
  erro?: string;
};

/** Uma aula com as datas já resolvidas — a cadência é calculada na tela. */
export type Linha = { aula: number; inicio: string | null; fim: string | null };

export declare function lerTurma(sessao: Sessao, cursoId: number | string): Promise<Turma>;

export declare function executa(
  sessao: Sessao,
  opcoes: {
    cursos: (number | string)[];
    linhas: Linha[];
    simular?: boolean;
    fuso?: string;
  },
): Promise<ItemRelatorio[]>;
