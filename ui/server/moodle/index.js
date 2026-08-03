'use strict';

/* Fachada: pega uma sessão autenticada, uma lista de turmas e as datas de cada
 * aula, e devolve o que mudaria (simulação) ou o que mudou (aplicação).
 *
 * A simulação é o caminho padrão da tela: escrever data em turma de produção é
 * irreversível, então o usuário sempre vê a prévia antes de confirmar. */

const { leCurso } = require('./course');
const { leFormulario, extraiErros } = require('./form');
const { planejaAtividade, planejaSecao, leDatasAtuais, TIPOS_SUPORTADOS } = require('./plan');
const { FUSO_PADRAO } = require('./dates');

/** Baixa um formulário e resolve o action contra a PÁGINA.
 *
 * O modedit.php devolve action relativo ("modedit.php"); resolvido contra a
 * raiz do site o POST iria para /modedit.php, que não existe. */
async function carregaFormulario(sessao, caminho) {
  const pagina = sessao.url(caminho);
  const html = await sessao.texto(pagina);
  const formulario = leFormulario(html);

  return {
    ...formulario,
    action: new URL(formulario.action || pagina, pagina).toString(),
    pagina,
    html,
  };
}

/** Grava reenviando TODOS os campos lidos — o Moodle reposta a configuração
 *  inteira, e campo omitido é ajuste apagado. */
async function grava(sessao, formulario) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(formulario.html);
  const botao = $('input[name="submitbutton2"]').length ? 'submitbutton2' : 'submitbutton';

  const envio = formulario.campos.clone();
  envio.pares.push([botao, $(`input[name="${botao}"]`).attr('value') ?? 'Salvar']);

  const resposta = await sessao.postaForm(formulario.action, envio.entries(), {
    headers: { Referer: formulario.pagina },
  });

  const corpo = await resposta.text();

  // sucesso = o Moodle redirecionou de volta para a página do curso
  if (/course\/view\.php/.test(resposta.urlFinal)) return { ok: true };
  return { ok: false, erro: extraiErros(corpo) };
}

async function processaAlvo(sessao, alvo, simular) {
  try {
    const formulario = await carregaFormulario(sessao, alvo.caminho);
    const mudancas = alvo.planeja(formulario.campos);

    if (!mudancas.length) return { status: 'sem-mudanca', mudancas: [] };
    if (simular) return { status: 'planejado', mudancas };

    const gravou = await grava(sessao, formulario);
    return gravou.ok
      ? { status: 'gravado', mudancas }
      : { status: 'recusado', mudancas, erro: gravou.erro };
  } catch (erro) {
    return { status: 'erro', mudancas: [], erro: erro instanceof Error ? erro.message : String(erro) };
  }
}

/** Estrutura da turma para a tela montar o seletor de aulas. */
async function lerTurma(sessao, cursoId) {
  const html = await sessao.texto(`/course/view.php?id=${cursoId}`);
  const curso = leCurso(html, cursoId);

  return {
    ...curso,
    secoes: curso.secoes
      .filter(s => s.numero > 0) // seção 0 é o cabeçalho do curso, não uma aula
      .map(s => ({
        ...s,
        atividades: s.atividades.filter(a => TIPOS_SUPORTADOS.includes(a.tipo)),
      })),
  };
}

/**
 * @param linhas [{ aula, inicio, fim }] — datas já resolvidas por aula.
 *   A cadência é calculada na tela; aqui chega sempre explícito, para o
 *   servidor não ter uma segunda cópia dessa regra.
 */
async function executa(sessao, { cursos, linhas, simular = true, fuso = FUSO_PADRAO }) {
  const relatorio = [];

  for (const cursoId of cursos) {
    let turma;
    try {
      turma = await lerTurma(sessao, cursoId);
    } catch (erro) {
      relatorio.push({
        curso: cursoId, cursoNome: '', aula: null, alvo: 'turma', tipo: '', nome: '',
        status: 'erro', mudancas: [],
        erro: erro instanceof Error ? erro.message : String(erro),
      });
      continue;
    }

    for (const linha of linhas) {
      const secao = turma.secoes.find(s => s.numero === linha.aula);
      if (!secao) continue;

      const base = { curso: cursoId, cursoNome: turma.nome, aula: linha.aula };

      if (secao.sectionId && linha.inicio) {
        const resultado = await processaAlvo(sessao, {
          caminho: `/course/editsection.php?id=${secao.sectionId}`,
          planeja: campos => planejaSecao(campos, linha, fuso),
        }, simular);

        relatorio.push({
          ...base, alvo: 'secao', tipo: 'section', id: secao.sectionId,
          nome: secao.nome || `Aula ${linha.aula}`, ...resultado,
        });
      }

      for (const atividade of secao.atividades) {
        const resultado = await processaAlvo(sessao, {
          caminho: `/course/modedit.php?update=${atividade.cmid}`,
          planeja: campos => planejaAtividade(campos, atividade.tipo, linha, fuso),
        }, simular);

        relatorio.push({
          ...base, alvo: 'atividade', tipo: atividade.tipo, id: atividade.cmid,
          nome: atividade.nome, ...resultado,
        });
      }
    }
  }

  return relatorio;
}

module.exports = { executa, lerTurma, carregaFormulario, grava, leDatasAtuais };
