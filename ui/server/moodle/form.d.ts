export { Campos } from './index';

export declare function leFormulario(
  html: string,
  seletor?: string,
): { campos: import('./index').Campos; action: string; method: string };

export declare function extraiErros(html: string): string;
