import type { Categoria } from './moodle/catalogo';

export type Consulta = {
  /** O curso como veio na planilha; costuma ser o programa, não a disciplina. */
  curso?: string | null;
  cidade?: string | null;
  /** "2026.2" e variantes. */
  semestre?: string | null;
};

export type Nota = {
  nota: number;
  cobertura: number;
  cidadeBate: boolean;
  semestreBate: boolean;
  /** Por que essa nota, em português, para dar para discordar sem abrir o Moodle. */
  motivos: string[];
};

export type Candidata = Categoria & Nota;

export type Sugestao = {
  candidatos: Candidata[];
  escolhida: Candidata | null;
  /** "IA", "pontuação", ou o motivo de a IA ter sido ignorada. */
  origem: string;
  /** O que não fecha na escolha; vazio quando bate cidade, semestre e curso. */
  alertas: string[];
  confianca?: 'alta' | 'media' | 'baixa' | null;
  justificativa?: string | null;
  alternativa?: Candidata | null;
};

export type Conferencia = {
  ok: boolean;
  problemas: { id: string; mensagem: string }[];
  avisos: { id: string; mensagem: string }[];
};

export declare const PARADAS: Set<string>;
export declare const PROMPT_TURMAS: string;

export declare function normaliza(texto: unknown): string;
export declare function fichas(texto: unknown): Set<string>;
export declare function variantesDeSemestre(semestre: unknown): string[];
export declare function temSemestre(texto: unknown, semestre: unknown): boolean;

export declare function pontua(consulta: Consulta, categoria: Categoria): Nota;
export declare function ranqueia(consulta: Consulta, categorias: Categoria[], limite?: number): Candidata[];
export declare function montarPromptTurmas(consulta: Consulta, candidatos: Candidata[]): string;

/** O que não fecha na escolha — é isto que denuncia raiz de categoria errada. */
export declare function alertasDaEscolha(consulta: Consulta, escolhida: Candidata | null): string[];

/** Sem `apiKey`, devolve o topo determinístico em vez de falhar. */
export declare function sugere(consulta: Consulta, categorias: Categoria[], apiKey?: string): Promise<Sugestao>;

/** Portão determinístico antes do CSV: nome breve truncado não passa. */
export declare function confereTurmas(
  cursos: { id: string; fullname?: string; shortname: string | null; truncado?: boolean; visivel?: boolean }[],
  semestre?: string | null,
): Conferencia;
