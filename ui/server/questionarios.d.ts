export const MODO_QUESTIONARIOS: 'questionarios';

export type QuizArquivo = { numero?: number; nome?: string };

export function isQuizOnly(data: unknown): boolean;
export function isQuizOnlyJson(text: string): boolean;
export function secaoDestino(numero: unknown, indice: number): number;
export function tituloDoArquivo(nome: string | undefined): string;

export function montarQuestionarios(
  quizzes: Array<{ questoes?: unknown[] } | null | undefined>,
  arquivos?: QuizArquivo[],
): {
  modo: 'questionarios';
  aulas: Array<{ numero: number; quiz: { titulo: string; questoes: unknown[] } }>;
};
