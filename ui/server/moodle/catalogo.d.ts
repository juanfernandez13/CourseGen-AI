import type { Sessao } from './index';

export type Categoria = { id: string; caminho: string };

export type CategoriaNaArvore = Categoria & {
  /** Saltos abaixo da raiz pedida; a própria raiz é 0. */
  profundidade: number;
  /** Último segmento do caminho ("2026.2"). */
  folha: string;
};

export type Turma = {
  id: string;
  fullname: string;
  /** Null quando o bloco de navegação não cobriu a turma. */
  shortname: string | null;
  /** O nav corta em ~50 caracteres; truncado não serve para `course1`. */
  truncado: boolean;
  visivel: boolean;
};

export type TurmaConfirmada = Turma & { exato: boolean };

export declare const SEPARADOR: string;

export declare function truncado(nome: string): boolean;

/** Todas as categorias do site, com caminho completo, a partir de um form de curso. */
export declare function leCategorias(html: string): Categoria[];

/** A categoria pedida e sua descendência, decidida por prefixo de caminho. */
export declare function subarvore(categorias: Categoria[], raizId: string | number): CategoriaNaArvore[];

/** Turmas de `management.php`, cruzando a listagem com o nome breve do nav. */
export declare function leCursos(html: string): Turma[];

/** Nome breve exato, de `course/edit.php`. */
export declare function leNomeBreve(html: string): string;

export declare function buscaCategorias(sessao: Sessao): Promise<Categoria[]>;
export declare function buscaCursos(sessao: Sessao, categoriaId: string | number): Promise<Turma[]>;

/** Resolve em `course/edit.php` só as turmas com nome breve truncado ou ausente. */
export declare function completaNomesBreves(sessao: Sessao, cursos: Turma[]): Promise<TurmaConfirmada[]>;
