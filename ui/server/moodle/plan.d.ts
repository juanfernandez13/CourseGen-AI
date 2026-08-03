import type { Campos, Mudanca } from './index';

export type Datas = { inicio?: string | null; fim?: string | null };

export declare const TIPOS_SUPORTADOS: string[];

export declare function planejaAtividade(
  campos: Campos, tipo: string, datas: Datas, fuso?: string,
): Mudanca[];

export declare function planejaSecao(campos: Campos, datas: Datas, fuso?: string): Mudanca[];

export declare function leDatasAtuais(
  campos: Campos, tipo: string, fuso?: string,
): { inicio: string | null; fim: string | null };
