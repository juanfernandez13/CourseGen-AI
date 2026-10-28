'use strict';

/**
 * Modo "só questionários": gera um .mbz para MESCLAR dentro de um curso que já
 * existe, sem a matriz da disciplina.
 *
 * O JSON leva `modo: 'questionarios'` e cada item de `aulas` é UM questionário:
 * `numero` é a seção do curso de destino e `quiz` traz título e questões.
 *
 * Mora aqui, e não no gerador, porque a tela e o gerador compartilham estas
 * regras — a mesma razão de taskFileMapper.js.
 */

const MODO_QUESTIONARIOS = 'questionarios';

function isQuizOnly(data) {
  return data?.modo === MODO_QUESTIONARIOS;
}

/** Mesmo teste, a partir do texto do JSON (a tela guarda o JSON como string). */
function isQuizOnlyJson(text) {
  try {
    return isQuizOnly(JSON.parse(text));
  } catch {
    return false;
  }
}

/** Seção de destino: o número declarado ou, sem ele, a posição (1º → seção 1). A 0 é a seção geral. */
function secaoDestino(numero, indice) {
  const n = Number.parseInt(numero, 10);
  return Number.isInteger(n) && n >= 0 ? n : indice + 1;
}

/** "Quiz_3.docx" → "Quiz 3". */
function tituloDoArquivo(nome) {
  return String(nome || '')
    .replace(/\.[^.]+$/, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Monta o JSON do modo a partir da extração dos .docx.
 *
 * `quizzes[i]` é o que o Gemini devolveu para `arquivos[i]` ({ numero, nome }).
 * O número vem do nome do arquivo ("Quiz 3" → seção 3) e, sem ele, da ordem.
 */
function montarQuestionarios(quizzes, arquivos = []) {
  return {
    modo: MODO_QUESTIONARIOS,
    aulas: (quizzes || []).map((quiz, i) => {
      const numero = secaoDestino(arquivos[i]?.numero, i);
      return {
        numero,
        quiz: {
          titulo: tituloDoArquivo(arquivos[i]?.nome) || `Questionário ${numero}`,
          questoes: quiz?.questoes || [],
        },
      };
    }),
  };
}

module.exports = {
  MODO_QUESTIONARIOS,
  isQuizOnly,
  isQuizOnlyJson,
  secaoDestino,
  tituloDoArquivo,
  montarQuestionarios,
};
