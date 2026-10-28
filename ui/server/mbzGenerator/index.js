'use strict';

const archiver = require('archiver');
const crypto   = require('crypto');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const {
  sanitize, dateToTs, textToMoodleHtml, buildFilesXml,
} = require('./utils');

const {
  buildSectionXml, buildModuleXml,
  buildQuestionsXml, buildGradebook, buildActivityInforef,
  buildBlockXml, buildAgendaHtml, buildCourseSummary,
} = require('./builders');
const { createGenerationModel } = require('./model');
const { writeActivities } = require('./activityWriter');

// ── XML stub strings ──────────────────────────────────────────────────────────

const FILTERS    = `<?xml version="1.0" encoding="UTF-8"?>\n<filters>\n  <filter_actives>\n  </filter_actives>\n  <filter_configs>\n  </filter_configs>\n</filters>`;
const ROLES      = `<?xml version="1.0" encoding="UTF-8"?>\n<roles>\n  <role_overrides>\n  </role_overrides>\n  <role_assignments>\n  </role_assignments>\n</roles>`;
const COMMENTS   = `<?xml version="1.0" encoding="UTF-8"?>\n<comments>\n</comments>`;
const CALENDAR   = `<?xml version="1.0" encoding="UTF-8"?>\n<events>\n</events>`;
const GRADES     = `<?xml version="1.0" encoding="UTF-8"?>\n<activity_gradebook>\n  <grade_items>\n  </grade_items>\n  <grade_letters>\n  </grade_letters>\n</activity_gradebook>`;
const GRADE_HIST = `<?xml version="1.0" encoding="UTF-8"?>\n<grade_history>\n  <grade_grades>\n  </grade_grades>\n</grade_history>`;
const COMPLETION = `<?xml version="1.0" encoding="UTF-8"?>\n<completions>\n  <completionviews>\n  </completionviews>\n</completions>`;
const COMPETENCIES_ACT = `<?xml version="1.0" encoding="UTF-8"?>\n<course_module_competencies>\n  <competencies>\n  </competencies>\n</course_module_competencies>`;
const INFOREF_EMPTY    = `<?xml version="1.0" encoding="UTF-8"?>\n<inforef>\n</inforef>`;

// ── Archive helpers ───────────────────────────────────────────────────────────

function buildArchiveIndex(tmpDir, now) {
  const entries = [];
  function walk(dir, rel) {
    for (const item of fs.readdirSync(dir).sort()) {
      if (item === '.ARCHIVE_INDEX') continue;
      const abs  = path.join(dir, item);
      const relP = rel ? `${rel}/${item}` : item;
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        entries.push(`${relP}/\td\t0\t?`);
        walk(abs, relP);
      } else {
        entries.push(`${relP}\tf\t${stat.size}\t${now}`);
      }
    }
  }
  walk(tmpDir, '');
  return [`Moodle archive file index. Count: ${entries.length}`, ...entries].join('\n') + '\n';
}

function tarGzDirectory(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(outputPath);
    const archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// ── Main generator ────────────────────────────────────────────────────────────

async function generateMBZ(matrizData) {
  const tmpDir     = fs.mkdtempSync(path.join(os.tmpdir(), 'mbz-'));
  const outputPath = path.join(os.tmpdir(), `matriz_${Date.now()}.mbz`);
  const now        = Math.floor(Date.now() / 1000);
  const base = Math.floor(Math.random() * 80000) + 10000;
  const model = createGenerationModel(matrizData, base);
  const fileEntries = [];

  // ── Write helper (scoped to tmpDir) ───────────────────────────────────────
  function write(relPath, content) {
    const abs = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  // Writes all stub files for a Moodle activity directory
  function writeActivityStubs(dir, modId, modname, sectionId, secNum, availTs = 0, gradesXml = GRADES, availEndTs = 0, moduleOpts = {}) {
    write(`${dir}/module.xml`,        buildModuleXml(modId, modname, sectionId, secNum, now, availTs, availEndTs, moduleOpts));
    write(`${dir}/grades.xml`,        gradesXml);
    write(`${dir}/grade_history.xml`, GRADE_HIST);
    write(`${dir}/completion.xml`,    COMPLETION);
    write(`${dir}/calendar.xml`,      CALENDAR);
    write(`${dir}/comments.xml`,      COMMENTS);
    write(`${dir}/filters.xml`,       FILTERS);
    write(`${dir}/competencies.xml`,  COMPETENCIES_ACT);
    write(`${dir}/roles.xml`,         ROLES);
    write(`${dir}/inforef.xml`,       gradesXml === GRADES
      ? INFOREF_EMPTY
      : buildActivityInforef({ gradeItemId: modId + 90000 }));
  }

  try {
    writeBackupContents({
      matrizData,
      model,
      now,
      backupId: crypto.randomUUID().replace(/-/g, ''),
      write,
      writeActivityStubs,
      fileEntries,
    });
    write('.ARCHIVE_INDEX', buildArchiveIndex(tmpDir, now));
    await tarGzDirectory(tmpDir, outputPath);
    return outputPath;
  } catch (error) {
    fs.rmSync(outputPath, { force: true });
    throw error;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Writes the Moodle tree; archive lifecycle stays in generateMBZ. */
function writeBackupContents({ matrizData, model, now, backupId, write, writeActivityStubs, fileEntries }) {
  const {
    disciplina, aulas, categorias, shortname, fullname, allActivities, allSections, ids,
  } = model;
  const {
    base, catId, contextId, aulaIds, rootCatId, categoriaIds, categoriaItemIds, gradeSort,
    courseGradeItemId,
  } = ids;
  // O resumo de um curso novo vem da matriz; no modo só questionários, só do nome.
  const summarySource = model.quizOnly
    ? { disciplina: { nome: disciplina.nome || 'Questionários' } }
    : matrizData;

  // ── moodle_backup.xml ──────────────────────────────────────────────────────
  const secSettings = allSections.map(s => {
    const k = `section_${s.sectionid}`;
    return `      <setting><level>section</level><section>${k}</section><name>${k}_included</name><value>1</value></setting>\n` +
           `      <setting><level>section</level><section>${k}</section><name>${k}_userinfo</name><value>0</value></setting>`;
  }).join('\n');

  const actSettings = allActivities.map(a => {
    const k = `${a.modulename}_${a.moduleid}`;
    return `      <setting><level>activity</level><activity>${k}</activity><name>${k}_included</name><value>1</value></setting>\n` +
           `      <setting><level>activity</level><activity>${k}</activity><name>${k}_userinfo</name><value>0</value></setting>`;
  }).join('\n');

  // Blocks are discovered automatically by Moodle from course/blocks/
  write('moodle_backup.xml', `<?xml version="1.0" encoding="UTF-8"?>
<moodle_backup>
  <information>
    <name>backup.mbz</name>
    <moodle_version>2022112817.01</moodle_version>
    <moodle_release>4.1.17+ (Build: 20250321)</moodle_release>
    <backup_version>2022112800</backup_version>
    <backup_release>4.1</backup_release>
    <backup_date>${now}</backup_date>
    <mnet_remoteusers>0</mnet_remoteusers>
    <include_files>1</include_files>
    <include_file_references_to_external_content>0</include_file_references_to_external_content>
    <original_wwwroot>https://ead.ifce.edu.br</original_wwwroot>
    <original_site_identifier_hash>${backupId}</original_site_identifier_hash>
    <original_course_id>${base}</original_course_id>
    <original_course_format>topics</original_course_format>
    <original_course_fullname>${fullname}</original_course_fullname>
    <original_course_shortname>${shortname}</original_course_shortname>
    <original_course_startdate>${now}</original_course_startdate>
    <original_course_enddate>0</original_course_enddate>
    <original_course_contextid>${contextId}</original_course_contextid>
    <original_system_contextid>1</original_system_contextid>
    <details>
      <detail backup_id="${backupId}">
        <type>course</type>
        <format>moodle2</format>
        <interactive>1</interactive>
        <mode>10</mode>
        <execution>1</execution>
        <executiontime>0</executiontime>
      </detail>
    </details>
    <contents>
      <activities>
${allActivities.map(a => `        <activity>\n          <moduleid>${a.moduleid}</moduleid>\n          <sectionid>${a.sectionid}</sectionid>\n          <modulename>${a.modulename}</modulename>\n          <title>${a.title}</title>\n          <directory>${a.dir}</directory>\n        </activity>`).join('\n')}
      </activities>
      <sections>
${allSections.map(s => `        <section>\n          <sectionid>${s.sectionid}</sectionid>\n          <title>${s.title}</title>\n          <directory>${s.dir}</directory>\n        </section>`).join('\n')}
      </sections>
      <course>
        <courseid>${base}</courseid>
        <title>${shortname}</title>
        <directory>course</directory>
      </course>
    </contents>
    <settings>
      <setting><level>root</level><name>filename</name><value>backup.mbz</value></setting>
      <setting><level>root</level><name>imscc11</name><value>0</value></setting>
      <setting><level>root</level><name>users</name><value>0</value></setting>
      <setting><level>root</level><name>anonymize</name><value>0</value></setting>
      <setting><level>root</level><name>role_assignments</name><value>0</value></setting>
      <setting><level>root</level><name>activities</name><value>1</value></setting>
      <setting><level>root</level><name>blocks</name><value>1</value></setting>
      <setting><level>root</level><name>files</name><value>1</value></setting>
      <setting><level>root</level><name>filters</name><value>1</value></setting>
      <setting><level>root</level><name>comments</name><value>0</value></setting>
      <setting><level>root</level><name>badges</name><value>0</value></setting>
      <setting><level>root</level><name>calendarevents</name><value>1</value></setting>
      <setting><level>root</level><name>userscompletion</name><value>0</value></setting>
      <setting><level>root</level><name>logs</name><value>0</value></setting>
      <setting><level>root</level><name>grade_histories</name><value>0</value></setting>
      <setting><level>root</level><name>questionbank</name><value>1</value></setting>
      <setting><level>root</level><name>groups</name><value>1</value></setting>
      <setting><level>root</level><name>competencies</name><value>1</value></setting>
      <setting><level>root</level><name>customfield</name><value>1</value></setting>
      <setting><level>root</level><name>contentbankcontent</name><value>1</value></setting>
      <setting><level>root</level><name>legacyfiles</name><value>1</value></setting>
${secSettings}
${actSettings}
    </settings>
  </information>
</moodle_backup>`);

  write('moodle_backup.log', 'Moodle backup gerado automaticamente a partir da Matriz DE.\n');

  // ── course/ ────────────────────────────────────────────────────────────────
  write('course/course.xml', `<?xml version="1.0" encoding="UTF-8"?>
<course id="${base}" contextid="${contextId}">
  <shortname>${shortname}</shortname>
  <fullname>${fullname}</fullname>
  <idnumber></idnumber>
  <summary>${sanitize(buildCourseSummary(summarySource))}</summary>
  <summaryformat>1</summaryformat>
  <format>topics</format>
  <showgrades>1</showgrades>
  <newsitems>0</newsitems>
  <startdate>${now}</startdate>
  <enddate>0</enddate>
  <marker>0</marker>
  <maxbytes>0</maxbytes>
  <legacyfiles>0</legacyfiles>
  <showreports>0</showreports>
  <visible>1</visible>
  <groupmode>0</groupmode>
  <groupmodeforce>0</groupmodeforce>
  <defaultgroupingid>0</defaultgroupingid>
  <lang></lang>
  <theme></theme>
  <timecreated>${now}</timecreated>
  <timemodified>${now}</timemodified>
  <requested>0</requested>
  <showactivitydates>1</showactivitydates>
  <showcompletionconditions>1</showcompletionconditions>
  <enablecompletion>1</enablecompletion>
  <completionnotify>0</completionnotify>
  <category id="${catId}">
    <name>CREAD IFCE</name>
    <description></description>
  </category>
  <tags>
  </tags>
  <customfields>
  </customfields>
  <courseformatoptions>
    <courseformatoption>
      <format>topics</format>
      <sectionid>0</sectionid>
      <name>coursedisplay</name>
      <value>0</value>
    </courseformatoption>
    <courseformatoption>
      <format>topics</format>
      <sectionid>0</sectionid>
      <name>hiddensections</name>
      <value>1</value>
    </courseformatoption>
  </courseformatoptions>
</course>`);

  write('course/enrolments.xml', `<?xml version="1.0" encoding="UTF-8"?>
<enrolments>
  <enrols>
    <enrol id="1">
      <enrol>manual</enrol>
      <status>0</status>
      <name>$@NULL@$</name>
      <enrolperiod>0</enrolperiod>
      <enrolstartdate>0</enrolstartdate>
      <enrolenddate>0</enrolenddate>
      <expirynotify>0</expirynotify>
      <expirythreshold>86400</expirythreshold>
      <notifyall>0</notifyall>
      <password>$@NULL@$</password>
      <cost>$@NULL@$</cost>
      <currency>$@NULL@$</currency>
      <roleid>5</roleid>
      <customint1>$@NULL@$</customint1>
      <customint2>$@NULL@$</customint2>
      <customint3>$@NULL@$</customint3>
      <customint4>$@NULL@$</customint4>
      <customint5>$@NULL@$</customint5>
      <customint6>$@NULL@$</customint6>
      <customint7>$@NULL@$</customint7>
      <customint8>$@NULL@$</customint8>
      <customchar1>$@NULL@$</customchar1>
      <customchar2>$@NULL@$</customchar2>
      <customchar3>$@NULL@$</customchar3>
      <customdec1>$@NULL@$</customdec1>
      <customdec2>$@NULL@$</customdec2>
      <customtext1>$@NULL@$</customtext1>
      <customtext2>$@NULL@$</customtext2>
      <customtext3>$@NULL@$</customtext3>
      <customtext4>$@NULL@$</customtext4>
      <timecreated>${now}</timecreated>
      <timemodified>${now}</timemodified>
      <user_enrolments>
      </user_enrolments>
    </enrol>
  </enrols>
</enrolments>`);

  write('course/completiondefaults.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<course_completion_defaults>\n</course_completion_defaults>`);
  write('course/filters.xml',     FILTERS);
  write('course/competencies.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<course_competencies>\n  <competencies>\n  </competencies>\n  <user_competencies>\n  </user_competencies>\n</course_competencies>`);
  write('course/contentbank.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<contents>\n</contents>`);
  write('course/calendar.xml',    CALENDAR);
  write('course/comments.xml',    COMMENTS);
  write('course/roles.xml',       ROLES);
  write('course/inforef.xml',     INFOREF_EMPTY);

  if (model.quizOnly) {
    writeQuizOnlySections({ model, now, write });
  } else {
    writeFullCourseSections({ model, now, write });
  }

  writeActivities({ model, now, write, writeActivityStubs, fileEntries, emptyGrades: GRADES });

  // ── Root files ─────────────────────────────────────────────────────────────
  write('files.xml', buildFilesXml(fileEntries, now));

  // Overwrite inforefs for assigns with attached files (IDs resolved after buildFilesXml)
  for (const { dir, gradeItemId, idxStart, idxEnd } of (fileEntries._assignInforefs || [])) {
    const dirId    = fileEntries[idxStart]._xmlId - 1;
    const fileIds  = fileEntries.slice(idxStart, idxEnd).map(e => e._xmlId);
    write(`${dir}/inforef.xml`, buildActivityInforef({
      gradeItemId,
      fileIds: [dirId, ...fileIds],
    }));
  }

  write('questions.xml',    buildQuestionsXml(aulas, aulaIds, now));
  // Sem gradebook.xml o Moodle não mexe na estrutura de notas do curso de
  // destino (restore_gradebook_structure_step só roda se o arquivo existir). É o
  // que o modo só questionários quer: nenhuma categoria alheia aparece lá.
  if (!model.quizOnly) {
    const categoriasComIds = categorias.map((cat, i) => ({
      ...cat, id: categoriaIds[i], itemId: categoriaItemIds[i],
    }));
    write('gradebook.xml',  buildGradebook(rootCatId, categoriasComIds, courseGradeItemId, gradeSort, now));
  }
  write('outcomes.xml',     `<?xml version="1.0" encoding="UTF-8"?>\n<outcomes_definition>\n</outcomes_definition>`);
  write('badges.xml',       `<?xml version="1.0" encoding="UTF-8"?>\n<badges>\n</badges>`);
  write('completion.xml',   `<?xml version="1.0" encoding="UTF-8"?>\n<course_completion>\n</course_completion>`);
  write('groups.xml',       `<?xml version="1.0" encoding="UTF-8"?>\n<groups>\n  <groupings>\n  </groupings>\n</groups>`);
  write('roles.xml',        `<?xml version="1.0" encoding="UTF-8"?>\n<roles_definition>\n  <role id="5">\n    <name></name>\n    <shortname>student</shortname>\n    <nameincourse>$@NULL@$</nameincourse>\n    <description></description>\n    <sortorder>5</sortorder>\n    <archetype>student</archetype>\n  </role>\n</roles_definition>`);
  write('scales.xml',       `<?xml version="1.0" encoding="UTF-8"?>\n<scales_definition>\n</scales_definition>`);
  write('grade_history.xml', GRADE_HIST);
  write('users.xml',        `<?xml version="1.0" encoding="UTF-8"?>\n<users>\n</users>`);
}

/** Mural, aulas, blocos HTML e as seções Avaliações/Faltas: o curso inteiro. */
function writeFullCourseSections({ model, now, write }) {
  const {
    mural, professor, aulas, encontros, blocks, sec0Id, sec0Title, ids,
  } = model;
  const {
    contextId, aulaIds, encontrosIds, avFinalId, avSectionId, faltasSectionId,
  } = ids;

  // ── sections ───────────────────────────────────────────────────────────────
  const sec0Summary = textToMoodleHtml(mural.descricao);
  write(`sections/section_${sec0Id}/section.xml`, buildSectionXml(sec0Id, 0, sec0Title, sec0Summary, [], 0, now));
  write(`sections/section_${sec0Id}/inforef.xml`, INFOREF_EMPTY);

  // Fallback: se uma aula não tem data_inicio, calcula a partir da primeira
  // aula com data preenchida na matriz, somando 7 dias por aula. Aplica-se
  // SOMENTE à restrição de acesso da seção — atividades sempre usam o calendário.
  const WEEK = 7 * 86400;
  const rawSectionTs = aulas.map(a => dateToTs(a?.data_inicio));
  let anchorIdx = rawSectionTs.findIndex(ts => ts > 0);
  const sectionTs = rawSectionTs.map((ts, i) => {
    if (ts > 0) return ts;
    if (anchorIdx === -1) return 0;
    return rawSectionTs[anchorIdx] + (i - anchorIdx) * WEEK;
  });

  for (const [i, aula] of aulas.entries()) {
    const ids = aulaIds[i];
    const seq = [];
    if (aula.forum)     seq.push(ids.forumId);
    if (aula.quiz)      seq.push(ids.quizId);
    if (aula.chat)      { seq.push(ids.chatId); seq.push(ids.assignId); }
    if (aula.wiki)      { seq.push(ids.wikiId); seq.push(ids.wikiAssignId); }
    if (aula.glossario) seq.push(ids.glossaryId);
    if (!aula.chat && aula.tarefa) seq.push(ids.assignId);
    const summary = aula.descricao ? `&lt;p&gt;${sanitize(aula.descricao)}&lt;/p&gt;` : '';
    write(`sections/section_${ids.sectionId}/section.xml`,
      buildSectionXml(ids.sectionId, i + 1, sanitize(aula.titulo || `Aula ${i + 1}`), summary, seq, sectionTs[i], now));
    write(`sections/section_${ids.sectionId}/inforef.xml`, INFOREF_EMPTY);
  }

  // ── HTML blocks (course/blocks/html_N/) ────────────────────────────────────
  function writeBlock(id, ctxId, title, text, defaultWeight, posWeight) {
    const dir = `course/blocks/html_${id}`;
    write(`${dir}/block.xml`, buildBlockXml(id, ctxId, contextId, title, text, defaultWeight, posWeight, now));
    write(`${dir}/roles.xml`,    ROLES);
    write(`${dir}/comments.xml`, COMMENTS);
    write(`${dir}/inforef.xml`,  INFOREF_EMPTY);
  }

  {
    const profText =
      `<p dir="ltr" style="text-align: left;">Professor(a): ${sanitize(professor.nome || '')}</p>` +
      `<p dir="ltr" style="text-align: left;">Tutor(a): ${sanitize(professor.tutor || '')}</p>`;
    writeBlock(blocks.professores.id, blocks.professores.ctx, 'Professores(as)', profText, 1, -3);
  }
  {
    const evText =
      `<p dir="ltr" style="text-align: left;"></p>` +
      `<p dir="ltr">🎯 ENCONTROS VIRTUAIS</p>` +
      encontros.map((enc, i) =>
        `<p dir="ltr">💻 ${i === 0 ? 'Primeiro encontro' : `Encontro ${enc.numero || i + 1}`}: ${sanitize(enc.link_virtual || 'https://')}</p>`
      ).join('') +
      `<p></p><p dir="ltr"><br></p>` +
      `<p dir="ltr">🎯 GRAVAÇÕES<br></p>` +
      encontros.map((enc, i) =>
        `<p dir="ltr">💻 ${i === 0 ? 'Primeiro encontro' : `Encontro ${enc.numero || i + 1}`}:&nbsp;${sanitize(enc.link_gravacao || '')}</p>`
      ).join('') +
      `<p></p>`;
    writeBlock(blocks.encontros.id, blocks.encontros.ctx, 'Encontros virtuais', evText, 1, -2);
  }
  {
    const agendaText = buildAgendaHtml(aulas, encontros);
    writeBlock(blocks.agenda.id, blocks.agenda.ctx, 'Agenda', agendaText, 2, -1);
  }

  // ── Avaliações section ─────────────────────────────────────────────────────
  const avSecNum = aulas.length + 1;
  const avSeq    = [
    ...encontros.flatMap((enc, i) => enc.avaliacao === 'nota_media' ? [encontrosIds[i].notaId] : []),
    avFinalId,
  ];
  write(`sections/section_${avSectionId}/section.xml`,
    buildSectionXml(avSectionId, avSecNum, 'Avaliações', '', avSeq, 0, now));
  write(`sections/section_${avSectionId}/inforef.xml`, INFOREF_EMPTY);

  // ── Faltas section ─────────────────────────────────────────────────────────
  const faltasSeq = encontrosIds.map(e => e.faltaId);
  write(`sections/section_${faltasSectionId}/section.xml`,
    buildSectionXml(faltasSectionId, avSecNum + 1, 'Faltas', '', faltasSeq, 0, now));
  write(`sections/section_${faltasSectionId}/inforef.xml`, INFOREF_EMPTY);
}

/**
 * Só as seções que recebem questionário, sem nome nem resumo: ao mesclar, o
 * Moodle só preenche nome/resumo de seção existente quando estão vazios, então
 * deixar vazio é não tocar no que o curso de destino já tem.
 */
function writeQuizOnlySections({ model, now, write }) {
  for (const secao of model.secoes) {
    write(`sections/section_${secao.sectionId}/section.xml`,
      buildSectionXml(secao.sectionId, secao.numero, '$@NULL@$', '', secao.quizIds, 0, now));
    write(`sections/section_${secao.sectionId}/inforef.xml`, INFOREF_EMPTY);
  }
}

module.exports = { generateMBZ };
