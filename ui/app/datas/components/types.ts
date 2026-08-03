export type Atividade = { cmid: string; tipo: string; nome: string };

export type Secao = {
  numero: number;
  sectionId: string | null;
  nome: string;
  atividades: Atividade[];
};

export type Turma = {
  cursoId: string;
  nome: string;
  secoes: Secao[];
  erro?: string;
};

export type Modo = 'unica' | 'cadencia';

/** Uma aula com as datas já resolvidas. É o que a API recebe. */
export type Linha = { aula: number; inicio: string; fim: string };

export type Config = {
  modo: Modo;
  aulaInicio: number;
  aulaFim: number;
  inicio: string;
  fim: string;
  intervaloDias: number;
};

export type Mudanca = { campo: string; rotulo: string; de: string; para: string };

export type Status = 'gravado' | 'planejado' | 'sem-mudanca' | 'recusado' | 'erro';

export type ItemRelatorio = {
  curso: string;
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

export const ROTULO_STATUS: Record<Status, string> = {
  gravado: 'gravado',
  planejado: 'vai mudar',
  'sem-mudanca': 'já está',
  recusado: 'recusado',
  erro: 'erro',
};
