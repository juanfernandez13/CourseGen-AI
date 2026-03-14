const mammoth = require('mammoth');

/**
 * Extrai o texto completo do .docx sem truncar.
 * O Gemini 2.5 Flash suporta até 1M tokens — texto de DOCX cabe facilmente.
 */
async function processMatriz(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  const fullText = result.value;

  if (!fullText || fullText.trim().length < 50) {
    throw new Error('Documento vazio ou não foi possível extrair o texto.');
  }

  return fullText;
}

module.exports = { processMatriz };
