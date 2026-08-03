import type { Campos } from './index';

export declare const FUSO_PADRAO: string;

export declare function analisa(texto: string): {
  ano: number; mes: number; dia: number; hora: number; minuto: number;
};

export declare function paraTimestamp(texto: string, fuso?: string): number;
export declare function deTimestamp(ts: number, fuso?: string): string;
export declare function camposDeData(prefixo: string, texto: string): [string, string][];
export declare function leData(campos: Campos, prefixo: string): string | null;

/** Soma dias a "AAAA-MM-DD HH:MM" preservando o horário. */
export declare function somaDias(texto: string, dias: number): string;
