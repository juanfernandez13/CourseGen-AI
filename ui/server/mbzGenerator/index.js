'use strict';

const archiver = require('archiver');
const crypto   = require('crypto');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const {
  sanitize, dateToTs, textToMoodleHtml, normalizeTitleBrackets, formatNotaBR,
  embedAssignFiles, buildFilesXml,
} = require('./utils');

const {
  buildSectionXml, buildModuleXml,
  buildForumDiscussionXml, buildChatXml, buildWikiXml, buildGlossaryXml,
  buildQuizXml, buildQuestionsXml, buildAssignXml,
  buildGradebook, buildActivityGradesXml,
  buildBlockXml, buildAgendaHtml, buildCourseSummary,
} = require('./builders');

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

function buildGradingXml(areaId, areaname) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<areas>
  <area id="${areaId}">
    <areaname>${areaname}</areaname>
    <activemethod>$@NULL@$</activemethod>
    <definitions>
    </definitions>
  </area>
</areas>`;
}

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

  const base      = Math.floor(Math.random() * 80000) + 10000;
  const catId     = base + 1;
  const contextId = base + 2;
  const backupId  = crypto.randomUUID().replace(/-/g, '');

  const disciplina   = matrizData.disciplina   || {};
  const professor    = matrizData.professor    || {};
  const aulas        = matrizData.aulas        || [];
  const livroDeNotas = matrizData.livro_de_notas || {};
  const categorias   = livroDeNotas.categorias || [
    { nome: 'Atividades a distância', peso: 40 },
    { nome: 'Atividades presenciais', peso: 60 },
  ];
  const encontros  = matrizData.encontros  || [];
  const frequencia = matrizData.frequencia || {};

  const shortname = sanitize(disciplina.codigo || 'DISC001');
  const fullname  = sanitize(disciplina.nome   || 'Disciplina');

  // ── IDs ────────────────────────────────────────────────────────────────────
  const block1Id  = base + 50;  // Professores(as)
  const block1Ctx = base + 53;
  const block2Id  = base + 51;  // Agenda
  const block2Ctx = base + 54;
  const block3Id  = base + 52;  // Encontros virtuais
  const block3Ctx = base + 55;
  const sec0Id    = base + 200;
  const sec0Title = disciplina.polo
    ? `${fullname} / ${sanitize(disciplina.polo)}`
    : fullname;

  // Each aula gets a block of 20 IDs starting at base+300
  const aulaIds = aulas.map((_, i) => ({
    sectionId:    base + 300 + i * 20,
    forumId:      base + 301 + i * 20,
    forumCtx:     base + 302 + i * 20,
    quizId:       base + 303 + i * 20,
    quizCtx:      base + 304 + i * 20,
    assignId:     base + 305 + i * 20,
    assignCtx:    base + 306 + i * 20,
    chatId:       base + 307 + i * 20,
    chatCtx:      base + 308 + i * 20,
    wikiId:       base + 309 + i * 20,
    wikiCtx:      base + 310 + i * 20,
    wikiAssignId: base + 311 + i * 20,
    wikiAssignCtx:base + 312 + i * 20,
    glossaryId:   base + 313 + i * 20,
    glossaryCtx:  base + 314 + i * 20,
  }));

  // Each encontro gets 4 IDs (notaId, notaCtx, faltaId, faltaCtx)
  const encontrosBase = base + 300 + aulas.length * 20 + 100;
  const encontrosIds  = encontros.map((_, i) => ({
    notaId:   encontrosBase + i * 4,
    notaCtx:  encontrosBase + i * 4 + 1,
    faltaId:  encontrosBase + i * 4 + 2,
    faltaCtx: encontrosBase + i * 4 + 3,
  }));

  // Avaliação Final — always present
  const afBase          = encontrosBase + encontros.length * 4 + 10;
  const avFinalId       = afBase;
  const avFinalCtx      = afBase + 1;
  const avSectionId     = afBase + 2;
  const faltasSectionId = afBase + 3;
  const avFinal         = matrizData.avaliacao_final || {};

  // Gradebook IDs
  const rootCatId           = catId;
  const eadCatId            = catId + 1000;
  const presencialCatId     = catId + 1001;
  const courseGradeItemId   = catId + 2000;
  const eadCatItemId        = catId + 2001;
  const presencialCatItemId = catId + 2002;

  // Collects file metadata for files.xml
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
    write(`${dir}/inforef.xml`,       INFOREF_EMPTY);
  }

  // ── allActivities / allSections ────────────────────────────────────────────
  const allActivities = [
    ...aulas.flatMap((aula, i) => {
      const ids  = aulaIds[i];
      const acts = [];
      if (aula.forum) acts.push({
        moduleid: ids.forumId, sectionid: ids.sectionId, modulename: 'forum',
        title: sanitize(normalizeTitleBrackets(aula.forum.titulo || `Fórum ${i + 1}`)),
        dir: `activities/forum_${ids.forumId}`,
      });
      if (aula.quiz) acts.push({
        moduleid: ids.quizId, sectionid: ids.sectionId, modulename: 'quiz',
        title: sanitize(normalizeTitleBrackets(aula.quiz?.titulo || `Questionário ${i + 1}`)),
        dir: `activities/quiz_${ids.quizId}`,
      });
      if (aula.chat) {
        acts.push({
          moduleid: ids.chatId, sectionid: ids.sectionId, modulename: 'chat',
          title: sanitize(normalizeTitleBrackets(aula.chat.titulo || `Chat ${i + 1}`)),
          dir: `activities/chat_${ids.chatId}`,
        });
        // Assign oculto para lançar nota do chat
        acts.push({
          moduleid: ids.assignId, sectionid: ids.sectionId, modulename: 'assign',
          title: sanitize(normalizeTitleBrackets(aula.chat.nota_titulo || `[Aula ${i + 1}] [Chat ${i + 1}] ${aula.chat.titulo || ''} [${formatNotaBR(aula.chat.nota || 10)}]`)),
          dir: `activities/assign_${ids.assignId}`,
        });
      }
      if (aula.wiki) {
        acts.push({
          moduleid: ids.wikiId, sectionid: ids.sectionId, modulename: 'wiki',
          title: sanitize(normalizeTitleBrackets(aula.wiki.titulo || `Wiki ${i + 1}`)),
          dir: `activities/wiki_${ids.wikiId}`,
        });
        // Assign oculto para lançar nota da wiki
        acts.push({
          moduleid: ids.wikiAssignId, sectionid: ids.sectionId, modulename: 'assign',
          title: sanitize(normalizeTitleBrackets(aula.wiki.nota_titulo || `[Aula ${i + 1}] [Wiki ${i + 1}] ${aula.wiki.titulo || ''} [${formatNotaBR(aula.wiki.nota || 10)}]`)),
          dir: `activities/assign_${ids.wikiAssignId}`,
        });
      }
      if (aula.glossario) acts.push({
        moduleid: ids.glossaryId, sectionid: ids.sectionId, modulename: 'glossary',
        title: sanitize(normalizeTitleBrackets(aula.glossario.titulo || `Glossário ${i + 1}`)),
        dir: `activities/glossary_${ids.glossaryId}`,
      });
      if (!aula.chat && aula.tarefa) acts.push({
        moduleid: ids.assignId, sectionid: ids.sectionId, modulename: 'assign',
        title: sanitize(normalizeTitleBrackets(aula.tarefa?.titulo || `Tarefa ${i + 1}`)),
        dir: `activities/assign_${ids.assignId}`,
      });
      return acts;
    }),
    // Encontros: nota assign (Avaliações) + falta assign (Faltas)
    ...encontros.flatMap((enc, i) => {
      const acts = [];
      if (enc.avaliacao === 'nota_media') acts.push({
        moduleid: encontrosIds[i].notaId, sectionid: avSectionId, modulename: 'assign',
        title: sanitize(normalizeTitleBrackets(enc.nota_titulo || `[Encontro ${enc.numero || i + 1}] [Nota]`)),
        dir: `activities/assign_${encontrosIds[i].notaId}`,
      });
      acts.push({
        moduleid: encontrosIds[i].faltaId, sectionid: faltasSectionId, modulename: 'assign',
        title: sanitize(normalizeTitleBrackets(enc.falta_titulo || `[Encontro ${enc.numero || i + 1}] [Faltas]`)),
        dir: `activities/assign_${encontrosIds[i].faltaId}`,
      });
      return acts;
    }),
    // Avaliação Final (sempre presente)
    {
      moduleid: avFinalId, sectionid: avSectionId, modulename: 'assign',
      title: sanitize(normalizeTitleBrackets(avFinal.titulo || '[Disciplina] [Avaliação Final]')),
      dir: `activities/assign_${avFinalId}`,
    },
  ];

  const allSections = [
    { sectionid: sec0Id, title: sec0Title, dir: `sections/section_${sec0Id}` },
    ...aulaIds.map((ids, i) => ({
      sectionid: ids.sectionId,
      title: sanitize(aulas[i]?.titulo || `Aula ${i + 1}`),
      dir: `sections/section_${ids.sectionId}`,
    })),
    { sectionid: avSectionId,     title: 'Avaliações', dir: `sections/section_${avSectionId}` },
    { sectionid: faltasSectionId, title: 'Faltas',     dir: `sections/section_${faltasSectionId}` },
  ];

  // ── moodle_backup.xml ──────────────────────────────────────────────────────
  const secSettings = allSections.map(s => {
    const k = `section_${s.sectionid}`;
    return `      <setting><level>section</level><section>${k}</section><name>${k}_included</name><value>1</value></setting>\n` +
           `      <setting><level>section</level><section>${k}</section><name>${k}_userinfo</name><value>1</value></setting>`;
  }).join('\n');

  const actSettings = allActivities.map(a => {
    const k = `${a.modulename}_${a.moduleid}`;
    return `      <setting><level>activity</level><activity>${k}</activity><name>${k}_included</name><value>1</value></setting>\n` +
           `      <setting><level>activity</level><activity>${k}</activity><name>${k}_userinfo</name><value>1</value></setting>`;
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
      <setting><level>root</level><name>comments</name><value>1</value></setting>
      <setting><level>root</level><name>badges</name><value>1</value></setting>
      <setting><level>root</level><name>calendarevents</name><value>1</value></setting>
      <setting><level>root</level><name>userscompletion</name><value>1</value></setting>
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
  <summary>${sanitize(buildCourseSummary(matrizData))}</summary>
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

  // ── sections ───────────────────────────────────────────────────────────────
  const sec0Summary = textToMoodleHtml((matrizData.mural || {}).descricao || '');
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
    writeBlock(block1Id, block1Ctx, 'Professores(as)', profText, 1, -3);
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
    writeBlock(block3Id, block3Ctx, 'Encontros virtuais', evText, 1, -2);
  }
  {
    const agendaText = buildAgendaHtml(aulas, encontros);
    writeBlock(block2Id, block2Ctx, 'Agenda', agendaText, 2, -1);
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

  // ── Per-aula activities ────────────────────────────────────────────────────
  for (const [i, aula] of aulas.entries()) {
    const ids    = aulaIds[i];
    const secNum = i + 1;
    const tsAula = dateToTs(aula.data_inicio);

    // Fórum (EaD category)
    if (aula.forum) {
      const forumDir = `activities/forum_${ids.forumId}`;
      const tsStart  = dateToTs(aula.forum.data_inicio || aula.data_inicio);
      const tsEnd    = dateToTs(aula.forum.data_fim    || aula.data_fim, true, '23:55:00');
      write(`${forumDir}/forum.xml`, buildForumDiscussionXml(ids.forumId, ids.forumCtx, aula, now));
      writeActivityStubs(forumDir, ids.forumId, 'forum', ids.sectionId, secNum, tsStart,
        buildActivityGradesXml(ids.forumId, eadCatId, aula.forum.titulo || `Fórum ${i + 1}`, 'forum', i * 3 + 10, now, 1),
        tsEnd);
      write(`${forumDir}/grading.xml`, buildGradingXml(ids.forumId + 70000, 'forum'));
    }

    // Quiz (EaD category)
    if (aula.quiz) {
      const quizDir = `activities/quiz_${ids.quizId}`;
      write(`${quizDir}/quiz.xml`, buildQuizXml(ids.quizId, ids.quizCtx, aula, now));
      writeActivityStubs(quizDir, ids.quizId, 'quiz', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.quizId, eadCatId, aula.quiz?.titulo || `Questionário ${i + 1}`, 'quiz', i * 3 + 11, now));
      if (aula.quiz.questoes?.length) {
        const gradeItemId = ids.quizId + 90000;
        const catTopId    = ids.quizId + 2000000;
        const catDefId    = ids.quizId + 2001000;
        write(`${quizDir}/inforef.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<inforef>
  <grade_itemref>
    <grade_item>
      <id>${gradeItemId}</id>
    </grade_item>
  </grade_itemref>
  <question_categoryref>
    <question_category>
      <id>${catTopId}</id>
    </question_category>
    <question_category>
      <id>${catDefId}</id>
    </question_category>
  </question_categoryref>
</inforef>`);
      }
    }

    // Chat (EaD category) + assign oculto para nota
    if (aula.chat) {
      const chatDir  = `activities/chat_${ids.chatId}`;
      const tsStart  = dateToTs(aula.chat.data_inicio || aula.data_inicio);
      const tsEnd    = dateToTs(aula.chat.data_fim    || aula.data_fim, true, '23:55:00');
      write(`${chatDir}/chat.xml`, buildChatXml(ids.chatId, ids.chatCtx, aula, now));
      writeActivityStubs(chatDir, ids.chatId, 'chat', ids.sectionId, secNum, tsStart, GRADES, tsEnd);

      // Assign oculto para lançar a nota do chat
      const chatAssignDir = `activities/assign_${ids.assignId}`;
      const chatNotaTitulo = sanitize(normalizeTitleBrackets(
        aula.chat.nota_titulo || `[Aula ${i + 1}] [Chat ${i + 1}] ${aula.chat.titulo || ''} [${formatNotaBR(aula.chat.nota || 10)}]`
      ));
      write(`${chatAssignDir}/assign.xml`, buildAssignXml(ids.assignId, ids.assignCtx,
        { tarefa: { titulo: chatNotaTitulo, descricao: 'Atividade para receber a nota do chat' } }, now, [], true));
      writeActivityStubs(chatAssignDir, ids.assignId, 'assign', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.assignId, eadCatId, chatNotaTitulo, 'assign', i * 3 + 12, now),
        0, { visible: 0, showdescription: 1 });
      write(`${chatAssignDir}/grading.xml`, buildGradingXml(ids.assignId + 70000, 'submissions'));
    }

    // Wiki (EaD category) + assign oculto para nota
    if (aula.wiki) {
      const wikiDir  = `activities/wiki_${ids.wikiId}`;
      const tsStart  = dateToTs(aula.wiki.data_inicio || aula.data_inicio);
      const tsEnd    = dateToTs(aula.wiki.data_fim    || aula.data_fim, true, '23:55:00');
      write(`${wikiDir}/wiki.xml`, buildWikiXml(ids.wikiId, ids.wikiCtx, aula, now));
      writeActivityStubs(wikiDir, ids.wikiId, 'wiki', ids.sectionId, secNum, tsStart, GRADES, tsEnd);

      // Assign oculto para lançar a nota da wiki
      const wikiAssignDir = `activities/assign_${ids.wikiAssignId}`;
      const wikiNotaTitulo = sanitize(normalizeTitleBrackets(
        aula.wiki.nota_titulo || `[Aula ${i + 1}] [Wiki ${i + 1}] ${aula.wiki.titulo || ''} [${formatNotaBR(aula.wiki.nota || 10)}]`
      ));
      write(`${wikiAssignDir}/assign.xml`, buildAssignXml(ids.wikiAssignId, ids.wikiAssignCtx,
        { tarefa: { titulo: wikiNotaTitulo, descricao: '' } }, now, [], true));
      writeActivityStubs(wikiAssignDir, ids.wikiAssignId, 'assign', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.wikiAssignId, eadCatId, wikiNotaTitulo, 'assign', i * 3 + 13, now),
        0, { visible: 0 });
      write(`${wikiAssignDir}/grading.xml`, buildGradingXml(ids.wikiAssignId + 70000, 'submissions'));
    }

    // Glossário (EaD category) — tem nota própria (assessed)
    if (aula.glossario) {
      const glossaryDir = `activities/glossary_${ids.glossaryId}`;
      const tsStart     = dateToTs(aula.glossario.data_inicio || aula.data_inicio);
      const tsEnd       = dateToTs(aula.glossario.data_fim    || aula.data_fim, true, '23:55:00');
      write(`${glossaryDir}/glossary.xml`, buildGlossaryXml(ids.glossaryId, ids.glossaryCtx, aula, now));
      writeActivityStubs(glossaryDir, ids.glossaryId, 'glossary', ids.sectionId, secNum, tsStart,
        buildActivityGradesXml(ids.glossaryId, eadCatId, aula.glossario.titulo || `Glossário ${i + 1}`, 'glossary', i * 3 + 14, now),
        tsEnd);
    }

    // Tarefa (EaD category)
    if (!aula.chat && aula.tarefa) {
      const assignDir = `activities/assign_${ids.assignId}`;
      const arquivos  = (aula.tarefa.arquivos || []).filter(arq => {
        if (!arq?.filePath) return false;
        try { fs.statSync(arq.filePath); return true; } catch { return false; }
      });
      write(`${assignDir}/assign.xml`, buildAssignXml(ids.assignId, ids.assignCtx, aula, now, arquivos));
      writeActivityStubs(assignDir, ids.assignId, 'assign', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.assignId, eadCatId, aula.tarefa?.titulo || `Tarefa ${i + 1}`, 'assign', i * 3 + 12, now));
      write(`${assignDir}/grading.xml`, buildGradingXml(ids.assignId + 70000, 'submissions'));
      if (arquivos.length) {
        const idxBefore   = fileEntries.length;
        for (const { hash, content } of embedAssignFiles(ids.assignCtx, arquivos, fileEntries)) {
          write(`files/${hash.slice(0, 2)}/${hash}`, content);
        }
        const gradeItemId = ids.assignId + 90000;
        fileEntries._assignInforefs = fileEntries._assignInforefs || [];
        fileEntries._assignInforefs.push({ dir: assignDir, gradeItemId, idxStart: idxBefore, idxEnd: fileEntries.length });
      }
    }
  }

  // ── Encontros: nota (Avaliações) + falta (Faltas) ─────────────────────────
  for (const [i, enc] of encontros.entries()) {
    const ids        = encontrosIds[i];
    const notaTitulo  = sanitize(normalizeTitleBrackets(enc.nota_titulo  || `[Encontro ${enc.numero || i + 1}] [Nota]`));
    const faltaTitulo = sanitize(normalizeTitleBrackets(enc.falta_titulo || `[Encontro ${enc.numero || i + 1}] [Faltas]`));
    const faltaDesc   = enc.titulo || enc.descricao || '';

    if (enc.avaliacao === 'nota_media') {
      const notaDir = `activities/assign_${ids.notaId}`;
      write(`${notaDir}/assign.xml`, buildAssignXml(ids.notaId, ids.notaCtx,
        { tarefa: { titulo: notaTitulo, descricao: enc.descricao || '' } }, now, [], true));
      writeActivityStubs(notaDir, ids.notaId, 'assign', avSectionId, avSecNum, 0,
        buildActivityGradesXml(ids.notaId, presencialCatId, notaTitulo, 'assign', 500 + i * 2, now));
      write(`${notaDir}/grading.xml`, buildGradingXml(ids.notaId + 70000, 'submissions'));
    }

    const faltaDir = `activities/assign_${ids.faltaId}`;
    write(`${faltaDir}/assign.xml`, buildAssignXml(ids.faltaId, ids.faltaCtx,
      { tarefa: { titulo: faltaTitulo, descricao: faltaDesc } }, now, [], true));
    writeActivityStubs(faltaDir, ids.faltaId, 'assign', faltasSectionId, avSecNum + 1, 0);
    write(`${faltaDir}/grading.xml`, buildGradingXml(ids.faltaId + 70000, 'submissions'));
  }

  // ── Avaliação Final ────────────────────────────────────────────────────────
  {
    const titulo = sanitize(normalizeTitleBrackets(avFinal.titulo || '[Disciplina] [Avaliação Final]'));
    const dir    = `activities/assign_${avFinalId}`;
    write(`${dir}/assign.xml`, buildAssignXml(avFinalId, avFinalCtx,
      { tarefa: { titulo, descricao: avFinal.descricao || '' } }, now, [], true));
    writeActivityStubs(dir, avFinalId, 'assign', avSectionId, avSecNum, 0,
      buildActivityGradesXml(avFinalId, rootCatId, titulo, 'assign', 549, now));
    write(`${dir}/grading.xml`, buildGradingXml(avFinalId + 70000, 'submissions'));
  }

  // ── Root files ─────────────────────────────────────────────────────────────
  write('files.xml', buildFilesXml(fileEntries, now));

  // Overwrite inforefs for assigns with attached files (IDs resolved after buildFilesXml)
  for (const { dir, gradeItemId, idxStart, idxEnd } of (fileEntries._assignInforefs || [])) {
    const dirId    = fileEntries[idxStart]._xmlId - 1;
    const fileIds  = fileEntries.slice(idxStart, idxEnd).map(e => e._xmlId);
    const fileRefs = [dirId, ...fileIds]
      .map(fid => `    <file>\n      <id>${fid}</id>\n    </file>`)
      .join('\n');
    write(`${dir}/inforef.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<inforef>
  <fileref>
${fileRefs}
  </fileref>
  <grade_itemref>
    <grade_item>
      <id>${gradeItemId}</id>
    </grade_item>
  </grade_itemref>
</inforef>`);
  }

  write('questions.xml',    buildQuestionsXml(aulas, aulaIds, now));
  write('gradebook.xml',    buildGradebook(rootCatId, eadCatId, presencialCatId, courseGradeItemId, eadCatItemId, presencialCatItemId, categorias, now));
  write('outcomes.xml',     `<?xml version="1.0" encoding="UTF-8"?>\n<outcomes_definition>\n</outcomes_definition>`);
  write('badges.xml',       `<?xml version="1.0" encoding="UTF-8"?>\n<badges>\n</badges>`);
  write('completion.xml',   `<?xml version="1.0" encoding="UTF-8"?>\n<course_completion>\n</course_completion>`);
  write('groups.xml',       `<?xml version="1.0" encoding="UTF-8"?>\n<groups>\n  <groupings>\n  </groupings>\n</groups>`);
  write('roles.xml',        `<?xml version="1.0" encoding="UTF-8"?>\n<roles_definition>\n  <role id="5">\n    <name></name>\n    <shortname>student</shortname>\n    <nameincourse>$@NULL@$</nameincourse>\n    <description></description>\n    <sortorder>5</sortorder>\n    <archetype>student</archetype>\n  </role>\n</roles_definition>`);
  write('scales.xml',       `<?xml version="1.0" encoding="UTF-8"?>\n<scales_definition>\n</scales_definition>`);
  write('grade_history.xml', GRADE_HIST);
  write('users.xml',        `<?xml version="1.0" encoding="UTF-8"?>\n<users>\n</users>`);
  write('.ARCHIVE_INDEX',   buildArchiveIndex(tmpDir, now));

  await tarGzDirectory(tmpDir, outputPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return outputPath;
}

module.exports = { generateMBZ };
