export type ConfigCadencia = {
  modo: 'unica' | 'cadencia';
  aulaInicio: number;
  aulaFim: number;
  inicio: string;
  fim: string;
  intervaloDias: number;
};

export declare function montaLinhas(
  config: ConfigCadencia,
): { aula: number; inicio: string; fim: string }[];
