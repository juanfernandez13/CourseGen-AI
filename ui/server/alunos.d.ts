export type ProblemaAluno = { campo: string; mensagem: string };

export type Aluno = {
  password:  string;
  username:  string;
  firstname: string;
  lastname:  string;
  email:     string;
  city:      string;
  course1:   string;
  type1:     1 | 2;
  problemas: ProblemaAluno[];
  avisos:    ProblemaAluno[];
  observacao: string | null;
};

export const COLUNAS_CSV: string[];
export const SENHA_PADRAO: string;
export const CIDADE_PADRAO: string;

export function cpfTemDigitoValido(cpf: string): boolean;
export function emailValido(email: string): boolean;

/** A linha 1 é dado, e não cabeçalho? Só responde `true` com certeza. */
export function primeiraLinhaEhDado(rows: string[][]): boolean;
export function montarPromptAlunos(rows: string[][]): string;
export function normalizarAluno(bruto: unknown): Aluno;
export function normalizarAlunos(brutos: unknown): Aluno[];
export function extrairAlunos(rows: string[][], apiKey: string): Promise<Aluno[]>;
export function montarCsv(alunos: Array<Record<string, unknown>>): string;

export type ArquivoCurso = { curso: string; filename: string; csv: string };

export function slugCurso(curso: string): string;
export function montarCsvPorCurso(
  alunos: Array<Record<string, unknown>>,
  cursos: string[],
  base?: string,
): ArquivoCurso[];
