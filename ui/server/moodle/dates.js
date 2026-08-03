'use strict';

/* Datas no fuso do curso.
 *
 * O Moodle guarda timestamps unix, mas o formulário trabalha com seletores
 * dia/mês/ano/hora/minuto no fuso do usuário. Tudo aqui fala "AAAA-MM-DD HH:MM"
 * no fuso configurado e converte nas bordas. */

const PADRAO = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

const FUSO_PADRAO = 'America/Fortaleza';

function analisa(texto) {
  const casou = PADRAO.exec(String(texto).trim());
  if (!casou) throw new Error(`Data inválida: "${texto}". Use "AAAA-MM-DD HH:MM".`);

  const [, ano, mes, dia, hora, minuto] = casou.map(Number);
  return { ano, mes, dia, hora, minuto };
}

/* Interpreta os campos como se fossem UTC, formata esse instante no fuso alvo e
 * usa a diferença como offset. Cobre horário de verão sem depender de libs. */
function paraTimestamp(texto, fuso = FUSO_PADRAO) {
  const { ano, mes, dia, hora, minuto } = analisa(texto);
  const comoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto, 0);

  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const partes = Object.fromEntries(
    formatador.formatToParts(new Date(comoUtc)).map(p => [p.type, p.value]),
  );

  const noFuso = Date.UTC(
    Number(partes.year), Number(partes.month) - 1, Number(partes.day),
    Number(partes.hour) % 24, // meia-noite sai como "24" em alguns ambientes
    Number(partes.minute), Number(partes.second),
  );

  return (comoUtc - (noFuso - comoUtc)) / 1000;
}

function deTimestamp(ts, fuso = FUSO_PADRAO) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
      .formatToParts(new Date(ts * 1000))
      .map(p => [p.type, p.value]),
  );

  const hora = String(Number(partes.hour) % 24).padStart(2, '0');
  return `${partes.year}-${partes.month}-${partes.day} ${hora}:${partes.minute}`;
}

/** Campos de um seletor de data do Moodle, incluindo o [enabled] que o liga. */
function camposDeData(prefixo, texto) {
  const { ano, mes, dia, hora, minuto } = analisa(texto);
  return [
    [`${prefixo}[day]`,     String(dia)],
    [`${prefixo}[month]`,   String(mes)],
    [`${prefixo}[year]`,    String(ano)],
    [`${prefixo}[hour]`,    String(hora)],
    [`${prefixo}[minute]`,  String(minuto)],
    [`${prefixo}[enabled]`, '1'],
  ];
}

/** Data atual de um seletor, ou null se estiver desligado/ausente. */
function leData(campos, prefixo) {
  if (campos.obtem(`${prefixo}[enabled]`) !== '1') return null;

  const parte = sufixo => campos.obtem(`${prefixo}[${sufixo}]`);
  const ano = parte('year');
  if (!ano) return null;

  const pad = v => String(v ?? '0').padStart(2, '0');
  return `${ano}-${pad(parte('month'))}-${pad(parte('day'))} ${pad(parte('hour'))}:${pad(parte('minute'))}`;
}

/** Soma dias a "AAAA-MM-DD HH:MM" preservando o horário. Usado pela cadência. */
function somaDias(texto, dias) {
  const { ano, mes, dia, hora, minuto } = analisa(texto);
  const movido = new Date(Date.UTC(ano, mes - 1, dia + dias));
  const pad = v => String(v).padStart(2, '0');

  return `${movido.getUTCFullYear()}-${pad(movido.getUTCMonth() + 1)}-${pad(movido.getUTCDate())} ${pad(hora)}:${pad(minuto)}`;
}

module.exports = { FUSO_PADRAO, analisa, paraTimestamp, deTimestamp, camposDeData, leData, somaDias };
