export type NamedTaskFile = { name?: string; filename?: string };

export const PADROES: { tarefa: RegExp; quiz: RegExp };

export function extractTaskNumber(filename: string): number | null;
export function extractQuizNumber(filename: string): number | null;

export function mapFilesByNumber<T extends NamedTaskFile>(
  files: T[],
  padrao: RegExp,
): Record<number, T[]>;

export function mapTaskFiles<T extends NamedTaskFile>(files: T[]): Record<number, T[]>;
export function mapQuizFiles<T extends NamedTaskFile>(files: T[]): Record<number, T[]>;

export function listQuizFiles<T extends NamedTaskFile>(
  files: T[],
  opcoes?: { umPorNumero?: boolean },
): Array<{ file: T; numero: number }>;
