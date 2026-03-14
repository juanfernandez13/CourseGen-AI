const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function generateMBZ(matrizData) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbz-'));
  const outputPath = path.join(os.tmpdir(), `matriz_${Date.now()}.mbz`);
  const now = Math.floor(Date.now() / 1000);

  const base = Math.floor(Math.random() * 80000) + 10000;
  const catId = base + 1;
  const contextId = base + 2;
  const backupId = uuidv4().replace(/-/g, '');

  const disciplina = matrizData.disciplina || {};
  const professor  = matrizData.professor  || {};
  const aulas = matrizData.aulas || [];
  const livroDeNotas = matrizData.livro_de_notas || {};
  const categorias = livroDeNotas.categorias || [
    { nome: 'Atividades a distância', peso: 40 },
    { nome: 'Atividades presenciais', peso: 60 },
  ];
  const encontros      = matrizData.encontros || [];
  const frequencia     = matrizData.frequencia || {};

  const shortname = sanitize(disciplina.codigo || 'DISC001');
  const fullname  = sanitize(disciplina.nome   || 'Disciplina');

  // ── IDs ──────────────────────────────────────────────────────────────────────
  const block1Id    = base + 50;   // PROFESSOR(A)
  const block1Ctx   = base + 53;
  const block2Id    = base + 51;   // Agenda
  const block2Ctx   = base + 54;
  const block3Id    = base + 52;   // Encontros Virtuais
  const block3Ctx   = base + 55;
  const sec0Id      = base + 200;
  const sec0Title   = disciplina.polo
    ? `${fullname} / ${sanitize(disciplina.polo)}`
    : fullname;

  // Each aula gets a block of 10 IDs starting at base+300
  const aulaIds = aulas.map((_, i) => ({
    sectionId: base + 300 + i * 10,
    forumId:   base + 301 + i * 10,
    forumCtx:  base + 302 + i * 10,
    quizId:    base + 303 + i * 10,
    quizCtx:   base + 304 + i * 10,
    assignId:  base + 305 + i * 10,
    assignCtx: base + 306 + i * 10,
  }));

  // Encontros: each gets 4 IDs (notaId, notaCtx, faltaId, faltaCtx)
  const encontrosBase = base + 300 + aulas.length * 10 + 100;
  const encontrosIds  = encontros.map((_, i) => ({
    notaId:   encontrosBase + i * 4,
    notaCtx:  encontrosBase + i * 4 + 1,
    faltaId:  encontrosBase + i * 4 + 2,
    faltaCtx: encontrosBase + i * 4 + 3,
  }));

  // Avaliação Final (AF) — always present
  const afBase          = encontrosBase + encontros.length * 4 + 10;
  const avFinalId       = afBase;
  const avFinalCtx      = afBase + 1;
  const avSectionId     = afBase + 2;
  const faltasSectionId = afBase + 3;
  const avFinal         = matrizData.avaliacao_final || {};

  // Gradebook IDs
  const rootCatId          = catId;
  const eadCatId           = catId + 1000;
  const presencialCatId    = catId + 1001;
  const courseGradeItemId  = catId + 2000;
  const eadCatItemId       = catId + 2001;
  const presencialCatItemId = catId + 2002;

  // Collects file metadata for files.xml; actual bytes written via embedAssignFiles()
  const fileEntries = [];

  // ── helpers ──────────────────────────────────────────────────────────────────
  function write(relPath, content) {
    const abs = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

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

  function writeActivityStubs(dir, modId, modname, sectionId, secNum, availTs = 0, gradesXml = GRADES, availEndTs = 0) {
    write(`${dir}/module.xml`,        buildModuleXml(modId, modname, sectionId, secNum, now, availTs, availEndTs));
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

  // ── allActivities / allSections for moodle_backup.xml ────────────────────────
  const allActivities = [
    ...aulas.flatMap((aula, i) => {
      const ids = aulaIds[i];
      const acts = [];
      if (aula.forum) acts.push({
        moduleid: ids.forumId, sectionid: ids.sectionId, modulename: 'forum',
        title: sanitize(normalizeTitleBrackets(aula.forum.titulo || `Fórum ${i + 1}`)), dir: `activities/forum_${ids.forumId}`,
      });
      if (aula.quiz) acts.push({
        moduleid: ids.quizId, sectionid: ids.sectionId, modulename: 'quiz',
        title: sanitize(normalizeTitleBrackets(aula.quiz?.titulo || `Questionário ${i + 1}`)), dir: `activities/quiz_${ids.quizId}`,
      });
      if (aula.tarefa) acts.push({
        moduleid: ids.assignId, sectionid: ids.sectionId, modulename: 'assign',
        title: sanitize(normalizeTitleBrackets(aula.tarefa?.titulo || `Tarefa ${i + 1}`)), dir: `activities/assign_${ids.assignId}`,
      });
      return acts;
    }),
    // Encontros: nota assign (Avaliações section, only nota_media) + falta assign (Faltas section)
    ...encontros.flatMap((enc, i) => {
      const acts = [];
      if (enc.avaliacao === 'nota_media') acts.push(
        { moduleid: encontrosIds[i].notaId, sectionid: avSectionId, modulename: 'assign',
          title: sanitize(normalizeTitleBrackets(enc.nota_titulo || `[Encontro ${enc.numero || i + 1}] [Nota]`)), dir: `activities/assign_${encontrosIds[i].notaId}` }
      );
      acts.push({ moduleid: encontrosIds[i].faltaId, sectionid: faltasSectionId, modulename: 'assign',
        title: sanitize(normalizeTitleBrackets(enc.falta_titulo || `[Encontro ${enc.numero || i + 1}] [Faltas]`)), dir: `activities/assign_${encontrosIds[i].faltaId}` });
      return acts;
    }),
    // Avaliação Final (always present, in Avaliações section)
    { moduleid: avFinalId, sectionid: avSectionId, modulename: 'assign',
      title: sanitize(normalizeTitleBrackets(avFinal.titulo || '[Disciplina] [Avaliação Final]')), dir: `activities/assign_${avFinalId}` },
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

  // ── moodle_backup.xml ─────────────────────────────────────────────────────────
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

  // Blocks are discovered automatically by Moodle from course/blocks/ — no need to list in moodle_backup.xml

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

  // ── course/ ───────────────────────────────────────────────────────────────────
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

  // ── sections ──────────────────────────────────────────────────────────────────
  const sec0Seq     = [];
  const sec0Summary = textToMoodleHtml((matrizData.mural || {}).descricao || '');
  write(`sections/section_${sec0Id}/section.xml`, buildSectionXml(sec0Id, 0, sec0Title, sec0Summary, sec0Seq, 0, now));
  write(`sections/section_${sec0Id}/inforef.xml`, INFOREF_EMPTY);

  for (const [i, aula] of aulas.entries()) {
    const ids = aulaIds[i];
    const seq = [];
    if (aula.forum)  seq.push(ids.forumId);
    if (aula.quiz)   seq.push(ids.quizId);
    if (aula.tarefa) seq.push(ids.assignId);
    const ts      = dateToTs(aula.data_inicio);
    const summary = aula.descricao ? `&lt;p&gt;${sanitize(aula.descricao)}&lt;/p&gt;` : '';
    write(`sections/section_${ids.sectionId}/section.xml`,
      buildSectionXml(ids.sectionId, i + 1, sanitize(aula.titulo || `Aula ${i + 1}`), summary, seq, ts, now));
    write(`sections/section_${ids.sectionId}/inforef.xml`, INFOREF_EMPTY);
  }

  // ── HTML blocks (course/blocks/html_N/) ──────────────────────────────────────
  function writeBlock(id, ctxId, title, text, defaultWeight, posWeight) {
    const dir = `course/blocks/html_${id}`;
    write(`${dir}/block.xml`, buildBlockXml(id, ctxId, contextId, title, text, defaultWeight, posWeight, now));
    write(`${dir}/roles.xml`, ROLES);
    write(`${dir}/comments.xml`, COMMENTS);
    write(`${dir}/inforef.xml`, INFOREF_EMPTY);
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

  // ── "Avaliações" section ──────────────────────────────────────────────────────
  const avSecNum = aulas.length + 1;
  const avSeq    = [...encontros.flatMap((enc, i) => enc.avaliacao === 'nota_media' ? [encontrosIds[i].notaId] : []), avFinalId];
  write(`sections/section_${avSectionId}/section.xml`,
    buildSectionXml(avSectionId, avSecNum, 'Avaliações', '', avSeq, 0, now));
  write(`sections/section_${avSectionId}/inforef.xml`, INFOREF_EMPTY);

  // ── "Faltas" section ──────────────────────────────────────────────────────────
  const faltasSeq = encontrosIds.map(e => e.faltaId);
  write(`sections/section_${faltasSectionId}/section.xml`,
    buildSectionXml(faltasSectionId, avSecNum + 1, 'Faltas', '', faltasSeq, 0, now));
  write(`sections/section_${faltasSectionId}/inforef.xml`, INFOREF_EMPTY);

  // ── per-aula activities ───────────────────────────────────────────────────────
  for (const [i, aula] of aulas.entries()) {
    const ids    = aulaIds[i];
    const secNum = i + 1;

    // Forum (type=single, assessed) → EaD category — only if defined in matriz
    if (aula.forum) {
      const forumDir   = `activities/forum_${ids.forumId}`;
      const tsStart    = dateToTs(aula.forum.data_inicio || aula.data_inicio);
      const tsEnd      = dateToTs(aula.forum.data_fim    || aula.data_fim, true, '23:55:00');
      write(`${forumDir}/forum.xml`, buildForumDiscussionXml(ids.forumId, ids.forumCtx, aula, now));
      writeActivityStubs(forumDir, ids.forumId, 'forum', ids.sectionId, secNum, tsStart,
        buildActivityGradesXml(ids.forumId, eadCatId, aula.forum.titulo || `Fórum ${i + 1}`, 'forum', i * 3 + 10, now),
        tsEnd);
      write(`${forumDir}/grading.xml`, buildGradingXml(ids.forumId + 70000, 'forum'));
    }

    // Quiz → EaD category
    if (aula.quiz) {
      const quizDir  = `activities/quiz_${ids.quizId}`;
      write(`${quizDir}/quiz.xml`, buildQuizXml(ids.quizId, ids.quizCtx, aula, now));
      writeActivityStubs(quizDir, ids.quizId, 'quiz', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.quizId, eadCatId, aula.quiz?.titulo || `Questionário ${i + 1}`, 'quiz', i * 3 + 11, now));
      // Override inforef with question category references if quiz has questions
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

    // Tarefa (assign) → Presencial category
    if (aula.tarefa) {
      const assignDir  = `activities/assign_${ids.assignId}`;
      const arquivos = (aula.tarefa.arquivos || []).filter(arq => {
        if (!arq?.filePath) return false;
        try { fs.statSync(arq.filePath); return true; } catch { return false; }
      });
      write(`${assignDir}/assign.xml`, buildAssignXml(ids.assignId, ids.assignCtx, aula, now, arquivos));
      writeActivityStubs(assignDir, ids.assignId, 'assign', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.assignId, presencialCatId, aula.tarefa?.titulo || `Tarefa ${i + 1}`, 'assign', i * 3 + 12, now));
      write(`${assignDir}/grading.xml`, buildGradingXml(ids.assignId + 70000, 'submissions'));
      if (arquivos.length) {
        const idxBefore = fileEntries.length;
        for (const { hash, content } of embedAssignFiles(ids.assignCtx, arquivos, fileEntries)) {
          write(`files/${hash.slice(0, 2)}/${hash}`, content);
        }
        // Build inforef with grade_item + file references
        // File XML IDs: +1 dir entry, then N file entries — computed after buildFilesXml runs.
        // We store the range [idxBefore, fileEntries.length) and resolve IDs at write time.
        const gradeItemId = ids.assignId + 90000;
        // Mark these entries so buildFilesXml can assign correct IDs; we compute later.
        fileEntries._assignInforefs = fileEntries._assignInforefs || [];
        fileEntries._assignInforefs.push({ dir: assignDir, gradeItemId, idxStart: idxBefore, idxEnd: fileEntries.length });
      }
    }
  }

  // ── encontros: nota (Avaliações section) + falta (Faltas section) ───────────
  for (const [i, enc] of encontros.entries()) {
    const ids        = encontrosIds[i];
    const notaTitulo  = sanitize(normalizeTitleBrackets(enc.nota_titulo  || `[Encontro ${enc.numero || i + 1}] [Nota]`));
    const faltaTitulo = sanitize(normalizeTitleBrackets(enc.falta_titulo || `[Encontro ${enc.numero || i + 1}] [Faltas]`));
    const faltaDesc   = enc.titulo || enc.descricao || '';

    // Nota assign: only for encontros que valem nota
    if (enc.avaliacao === 'nota_media') {
      const notaDir = `activities/assign_${ids.notaId}`;
      write(`${notaDir}/assign.xml`, buildAssignXml(ids.notaId, ids.notaCtx,
        { tarefa: { titulo: notaTitulo, descricao: enc.descricao || '', nota: 10 } }, now, [], true));
      writeActivityStubs(notaDir, ids.notaId, 'assign', avSectionId, avSecNum, 0,
        buildActivityGradesXml(ids.notaId, presencialCatId, notaTitulo, 'assign', 500 + i * 2, now));
      write(`${notaDir}/grading.xml`, buildGradingXml(ids.notaId + 70000, 'submissions'));
    }

    const faltaDir = `activities/assign_${ids.faltaId}`;
    write(`${faltaDir}/assign.xml`, buildAssignXml(ids.faltaId, ids.faltaCtx,
      { tarefa: { titulo: faltaTitulo, descricao: faltaDesc, nota: 10 } }, now, [], true));
    writeActivityStubs(faltaDir, ids.faltaId, 'assign', faltasSectionId, avSecNum + 1, 0);
    write(`${faltaDir}/grading.xml`, buildGradingXml(ids.faltaId + 70000, 'submissions'));
  }

  // ── avaliação final (always present, in "Avaliações" section) ────────────────
  {
    const titulo = sanitize(normalizeTitleBrackets(avFinal.titulo || '[Disciplina] [Avaliação Final]'));
    const dir    = `activities/assign_${avFinalId}`;
    write(`${dir}/assign.xml`, buildAssignXml(avFinalId, avFinalCtx,
      { tarefa: { titulo, descricao: avFinal.descricao || '', nota: 10 } }, now, [], true));
    writeActivityStubs(dir, avFinalId, 'assign', avSectionId, avSecNum, 0,
      buildActivityGradesXml(avFinalId, presencialCatId, titulo, 'assign', 549, now));
    write(`${dir}/grading.xml`, buildGradingXml(avFinalId + 70000, 'submissions'));
  }

  // ── root files ────────────────────────────────────────────────────────────────
  write('files.xml', buildFilesXml(fileEntries, now));

  // ── overwrite inforefs for assigns with attached files ────────────────────────
  // buildFilesXml sets _xmlId on each entry; dir entry id = firstFile._xmlId - 1
  for (const { dir, gradeItemId, idxStart, idxEnd } of (fileEntries._assignInforefs || [])) {
    const dirId   = fileEntries[idxStart]._xmlId - 1;
    const fileIds = fileEntries.slice(idxStart, idxEnd).map(e => e._xmlId);
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
  write('questions.xml', buildQuestionsXml(aulas, aulaIds, now));
  write('gradebook.xml',     buildGradebook(rootCatId, eadCatId, presencialCatId, courseGradeItemId, eadCatItemId, presencialCatItemId, categorias, now));
  write('outcomes.xml',      `<?xml version="1.0" encoding="UTF-8"?>\n<outcomes_definition>\n</outcomes_definition>`);
  write('badges.xml',        `<?xml version="1.0" encoding="UTF-8"?>\n<badges>\n</badges>`);
  write('completion.xml',    `<?xml version="1.0" encoding="UTF-8"?>\n<course_completion>\n</course_completion>`);
  write('groups.xml',        `<?xml version="1.0" encoding="UTF-8"?>\n<groups>\n  <groupings>\n  </groupings>\n</groups>`);
  write('roles.xml',         `<?xml version="1.0" encoding="UTF-8"?>\n<roles_definition>\n  <role id="5">\n    <name></name>\n    <shortname>student</shortname>\n    <nameincourse>$@NULL@$</nameincourse>\n    <description></description>\n    <sortorder>5</sortorder>\n    <archetype>student</archetype>\n  </role>\n</roles_definition>`);
  write('scales.xml',        `<?xml version="1.0" encoding="UTF-8"?>\n<scales_definition>\n</scales_definition>`);
  write('grade_history.xml', GRADE_HIST);
  write('users.xml',         `<?xml version="1.0" encoding="UTF-8"?>\n<users>\n</users>`);

  write('.ARCHIVE_INDEX', buildArchiveIndex(tmpDir, now));

  await tarGzDirectory(tmpDir, outputPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return outputPath;
}

// ─── XML builders ─────────────────────────────────────────────────────────────

function buildSectionXml(id, number, name, summaryXml, sequence, ts, now) {
  const avail = ts
    ? `{"op":"&amp;","c":[{"type":"date","d":"&gt;=","t":${ts}}],"showc":[true]}`
    : `{"op":"&amp;","c":[],"showc":[]}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<section id="${id}">
  <number>${number}</number>
  <name>${name}</name>
  <summary>${summaryXml}</summary>
  <summaryformat>1</summaryformat>
  <sequence>${sequence.join(',')}</sequence>
  <visible>1</visible>
  <availabilityjson>${avail}</availabilityjson>
  <timemodified>${now}</timemodified>
</section>`;
}

function buildModuleXml(id, modname, sectionid, sectionnumber, now, availTs = 0, availEndTs = 0) {
  let avail;
  if (availTs && availEndTs) {
    avail = `{"op":"&amp;","c":[{"type":"date","d":"&gt;=","t":${availTs}},{"type":"date","d":"&lt;=","t":${availEndTs}}],"showc":[true,true]}`;
  } else if (availTs) {
    avail = `{"op":"&amp;","c":[{"type":"date","d":"&gt;=","t":${availTs}}],"showc":[true]}`;
  } else {
    avail = '$@NULL@$';
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<module id="${id}" version="2022112801">
  <modulename>${modname}</modulename>
  <sectionid>${sectionid}</sectionid>
  <sectionnumber>${sectionnumber}</sectionnumber>
  <idnumber></idnumber>
  <added>${now}</added>
  <score>0</score>
  <indent>0</indent>
  <visible>1</visible>
  <visibleoncoursepage>1</visibleoncoursepage>
  <visibleold>1</visibleold>
  <groupmode>0</groupmode>
  <groupingid>0</groupingid>
  <completion>1</completion>
  <completiongradeitemnumber>$@NULL@$</completiongradeitemnumber>
  <completionpassgrade>0</completionpassgrade>
  <completionview>0</completionview>
  <completionexpected>0</completionexpected>
  <availability>${avail}</availability>
  <showdescription>0</showdescription>
  <downloadcontent>1</downloadcontent>
  <lang></lang>
  <tags>
  </tags>
</module>`;
}


function buildForumDiscussionXml(id, ctx, aula, now) {
  const forum     = aula.forum || {};
  const titulo    = sanitize(normalizeTitleBrackets(forum.titulo   || aula.titulo    || `Fórum ${aula.numero || id}`));
  const descricao = sanitize(forum.descricao || aula.descricao || '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<activity id="${id}" moduleid="${id}" modulename="forum" contextid="${ctx}">
  <forum id="${id}">
    <type>single</type>
    <name>${titulo}</name>
    <intro>&lt;p&gt;${descricao}&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <duedate>0</duedate>
    <cutoffdate>0</cutoffdate>
    <assessed>1</assessed>
    <assesstimestart>0</assesstimestart>
    <assesstimefinish>0</assesstimefinish>
    <scale>10</scale>
    <maxbytes>512000</maxbytes>
    <maxattachments>9</maxattachments>
    <forcesubscribe>0</forcesubscribe>
    <trackingtype>1</trackingtype>
    <rsstype>0</rsstype>
    <rssarticles>0</rssarticles>
    <timemodified>${now}</timemodified>
    <warnafter>0</warnafter>
    <blockafter>0</blockafter>
    <blockperiod>0</blockperiod>
    <completiondiscussions>0</completiondiscussions>
    <completionreplies>0</completionreplies>
    <completionposts>0</completionposts>
    <displaywordcount>0</displaywordcount>
    <lockdiscussionafter>0</lockdiscussionafter>
    <grade_forum>0</grade_forum>
    <discussions>
    </discussions>
    <subscriptions>
    </subscriptions>
    <digests>
    </digests>
    <readposts>
    </readposts>
    <trackedprefs>
    </trackedprefs>
    <poststags>
    </poststags>
    <grades>
    </grades>
  </forum>
</activity>`;
}

function buildQuizXml(id, ctx, aula, now) {
  const quiz      = aula.quiz || {};
  const titulo    = sanitize(normalizeTitleBrackets(quiz.titulo || `[Questionário] ${aula.titulo || ''}`));
  const nota      = quiz.nota ?? 10;
  const timeopen  = dateToTs(quiz.data_inicio || aula.data_inicio) || 0;
  const timeclose = dateToTs(quiz.data_fim    || aula.data_fim, true) || 0;
  const questoes  = quiz.questoes || [];

  // Calculate sumgrades from actual question points; fallback to nota
  const sumgrades = questoes.length > 0
    ? questoes.reduce((s, q) => s + (parseFloat(q.pontuacao) || 1), 0)
    : nota;

  // Build question_instances (IDs derived from question bank entries in questions.xml)
  let qInstances = '';
  questoes.forEach((q, qi) => {
    const qbeId = id + 3000000 + qi * 100;
    const qiId  = id + 6000000 + qi * 100;
    const qrId  = id + 7000000 + qi * 100;
    const mark  = parseFloat(q.pontuacao) || 1;
    qInstances += `
      <question_instance id="${qiId}">
        <quizid>${id}</quizid>
        <slot>${qi + 1}</slot>
        <page>${qi + 1}</page>
        <requireprevious>0</requireprevious>
        <maxmark>${mark.toFixed(7)}</maxmark>
        <question_reference id="${qrId}">
          <usingcontextid>${ctx}</usingcontextid>
          <component>mod_quiz</component>
          <questionarea>slot</questionarea>
          <questionbankentryid>${qbeId}</questionbankentryid>
          <version>$@NULL@$</version>
        </question_reference>
      </question_instance>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<activity id="${id}" moduleid="${id}" modulename="quiz" contextid="${ctx}">
  <quiz id="${id}">
    <name>${titulo}</name>
    <intro>&lt;p&gt;Após o estudo do material desta aula, responda a este questionário e avalie seus conhecimentos!&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <timeopen>${timeopen}</timeopen>
    <timeclose>${timeclose}</timeclose>
    <timelimit>3600</timelimit>
    <overduehandling>autosubmit</overduehandling>
    <graceperiod>0</graceperiod>
    <preferredbehaviour>deferredfeedback</preferredbehaviour>
    <canredoquestions>0</canredoquestions>
    <attempts_number>2</attempts_number>
    <attemptonlast>0</attemptonlast>
    <grademethod>1</grademethod>
    <decimalpoints>2</decimalpoints>
    <questiondecimalpoints>-1</questiondecimalpoints>
    <reviewattempt>69904</reviewattempt>
    <reviewcorrectness>4368</reviewcorrectness>
    <reviewmarks>4368</reviewmarks>
    <reviewspecificfeedback>4368</reviewspecificfeedback>
    <reviewgeneralfeedback>4368</reviewgeneralfeedback>
    <reviewrightanswer>16</reviewrightanswer>
    <reviewoverallfeedback>16</reviewoverallfeedback>
    <questionsperpage>1</questionsperpage>
    <navmethod>free</navmethod>
    <shuffleanswers>1</shuffleanswers>
    <sumgrades>${sumgrades.toFixed(5)}</sumgrades>
    <grade>${nota}.00000</grade>
    <timecreated>${now}</timecreated>
    <timemodified>${now}</timemodified>
    <password></password>
    <subnet></subnet>
    <browsersecurity>-</browsersecurity>
    <delay1>0</delay1>
    <delay2>0</delay2>
    <showuserpicture>0</showuserpicture>
    <showblocks>0</showblocks>
    <completionattemptsexhausted>0</completionattemptsexhausted>
    <completionminattempts>0</completionminattempts>
    <allowofflineattempts>0</allowofflineattempts>
    <subplugin_quizaccess_seb_quiz>
    </subplugin_quizaccess_seb_quiz>
    <question_instances>${qInstances}
    </question_instances>
    <sections>
      <section id="${id + 1}">
        <firstslot>1</firstslot>
        <heading></heading>
        <shufflequestions>0</shufflequestions>
      </section>
    </sections>
    <feedbacks>
      <feedback id="${id + 2}">
        <feedbacktext></feedbacktext>
        <feedbacktextformat>1</feedbacktextformat>
        <mingrade>0.00000</mingrade>
        <maxgrade>${nota + 1}.00000</maxgrade>
      </feedback>
    </feedbacks>
    <overrides>
    </overrides>
    <grades>
    </grades>
    <attempts>
    </attempts>
  </quiz>
</activity>`;
}

function buildQuestionsXml(aulas, aulaIds, now) {
  const stamp = () => `mbzgen+${now}+${Math.random().toString(36).slice(2, 9)}`;
  let categoriesXml = '';

  aulas.forEach((aula, i) => {
    if (!aula.quiz?.questoes?.length) return;
    const ids      = aulaIds[i];
    const quizId   = ids.quizId;
    const quizCtx  = ids.quizCtx;
    const titulo   = sanitize(aula.quiz.titulo || `Questionário ${i + 1}`);
    const questoes = aula.quiz.questoes;

    const catTopId = quizId + 2000000;
    const catDefId = quizId + 2001000;

    // Build question bank entries for this quiz's default category
    let entriesXml = '';
    questoes.forEach((q, qi) => {
      const qbeId      = quizId + 3000000 + qi * 100;
      const qvId       = quizId + 4000000 + qi * 100;
      const questionId = quizId + 5000000 + qi * 100;
      const enunciado  = sanitize(q.enunciado || '');
      const pontuacao  = parseFloat(q.pontuacao) || 1;
      const feedback   = sanitize(q.feedback || '');

      let pluginXml = '';

      if (q.tipo === 'multipla_escolha') {
        const itens = q.itens || [];
        // fraction: correct = 1.0, wrong = 0.0 for single answer
        const nCorrect = itens.filter(it => it.isCorrect).length || 1;
        let answersXml = '';
        itens.forEach((item, ai) => {
          const answerId = quizId + 8000000 + qi * 100 + ai;
          const fraction = item.isCorrect ? (1 / nCorrect).toFixed(7) : '0.0000000';
          const fbText   = item.isCorrect ? 'Opção correta. Parabéns!' : 'Opção incorreta.';
          answersXml += `
                    <answer id="${answerId}">
                      <answertext>&lt;p&gt;${sanitize(item.texto || '')}&lt;/p&gt;</answertext>
                      <answerformat>1</answerformat>
                      <fraction>${fraction}</fraction>
                      <feedback>&lt;p&gt;${fbText}&lt;/p&gt;</feedback>
                      <feedbackformat>1</feedbackformat>
                    </answer>`;
        });
        const mcId = quizId + 9000000 + qi * 100;
        const isSingle = nCorrect === 1 ? 1 : 0;
        pluginXml = `
                <plugin_qtype_multichoice_question>
                  <answers>${answersXml}
                  </answers>
                  <multichoice id="${mcId}">
                    <layout>0</layout>
                    <single>${isSingle}</single>
                    <shuffleanswers>1</shuffleanswers>
                    <correctfeedback>Sua resposta está correta.</correctfeedback>
                    <correctfeedbackformat>1</correctfeedbackformat>
                    <partiallycorrectfeedback>Sua resposta está parcialmente correta.</partiallycorrectfeedback>
                    <partiallycorrectfeedbackformat>1</partiallycorrectfeedbackformat>
                    <incorrectfeedback>Sua resposta está incorreta.</incorrectfeedback>
                    <incorrectfeedbackformat>1</incorrectfeedbackformat>
                    <answernumbering>abc</answernumbering>
                    <shownumcorrect>1</shownumcorrect>
                    <showstandardinstruction>0</showstandardinstruction>
                  </multichoice>
                </plugin_qtype_multichoice_question>`;

      } else if (q.tipo === 'associativa') {
        const itens = q.itens || [];
        const matchOptId = quizId + 10000000 + qi * 100;
        let matchesXml = '';
        itens.forEach((item, mi) => {
          const matchId = quizId + 11000000 + qi * 1000 + mi;
          matchesXml += `
                    <match id="${matchId}">
                      <questiontext>&lt;p&gt;${sanitize(item.texto || '')}&lt;/p&gt;</questiontext>
                      <questiontextformat>1</questiontextformat>
                      <answertext>${sanitize(item.resposta || 'V')}</answertext>
                    </match>`;
        });
        pluginXml = `
                <plugin_qtype_match_question>
                  <matchoptions id="${matchOptId}">
                    <shuffleanswers>1</shuffleanswers>
                    <correctfeedback>Sua resposta está correta.</correctfeedback>
                    <correctfeedbackformat>1</correctfeedbackformat>
                    <partiallycorrectfeedback>Sua resposta está parcialmente correta.</partiallycorrectfeedback>
                    <partiallycorrectfeedbackformat>1</partiallycorrectfeedbackformat>
                    <incorrectfeedback>Sua resposta está incorreta.</incorrectfeedback>
                    <incorrectfeedbackformat>1</incorrectfeedbackformat>
                    <shownumcorrect>1</shownumcorrect>
                  </matchoptions>
                  <matches>${matchesXml}
                  </matches>
                </plugin_qtype_match_question>`;

      } else {
        // dissertativa → essay
        pluginXml = `
                <plugin_qtype_essay_question>
                  <essay id="${quizId + 12000000 + qi * 100}">
                    <responseformat>editor</responseformat>
                    <responserequired>1</responserequired>
                    <responsefieldlines>15</responsefieldlines>
                    <minwordlimit>$@NULL@$</minwordlimit>
                    <maxwordlimit>$@NULL@$</maxwordlimit>
                    <attachments>0</attachments>
                    <attachmentsrequired>0</attachmentsrequired>
                    <maxbytes>0</maxbytes>
                    <filetypeslist>$@NULL@$</filetypeslist>
                    <graderinfo></graderinfo>
                    <graderinfoformat>1</graderinfoformat>
                    <responsetemplate>${feedback ? `&lt;p&gt;${feedback}&lt;/p&gt;` : ''}</responsetemplate>
                    <responsetemplateformat>1</responsetemplateformat>
                  </essay>
                </plugin_qtype_essay_question>`;
      }

      const qtype = q.tipo === 'multipla_escolha' ? 'multichoice'
                  : q.tipo === 'associativa'       ? 'match'
                  : 'essay';

      entriesXml += `
        <question_bank_entry id="${qbeId}">
          <questioncategoryid>${catDefId}</questioncategoryid>
          <idnumber>$@NULL@$</idnumber>
          <ownerid>$@NULL@$</ownerid>
          <question_version>
            <question_versions id="${qvId}">
              <version>1</version>
              <status>ready</status>
              <questions>
                <question id="${questionId}">
                  <parent>0</parent>
                  <name>${q.numero || qi + 1}</name>
                  <questiontext>&lt;p&gt;${enunciado}&lt;/p&gt;</questiontext>
                  <questiontextformat>1</questiontextformat>
                  <generalfeedback>${feedback ? `&lt;p&gt;${feedback}&lt;/p&gt;` : ''}</generalfeedback>
                  <generalfeedbackformat>1</generalfeedbackformat>
                  <defaultmark>${pontuacao.toFixed(7)}</defaultmark>
                  <penalty>0.3333333</penalty>
                  <qtype>${qtype}</qtype>
                  <length>1</length>
                  <stamp>${stamp()}</stamp>
                  <timecreated>${now}</timecreated>
                  <timemodified>${now}</timemodified>
                  <createdby>$@NULL@$</createdby>
                  <modifiedby>$@NULL@$</modifiedby>${pluginXml}
                  <plugin_qbank_comment_question>
                    <comments>
                    </comments>
                  </plugin_qbank_comment_question>
                  <plugin_qbank_customfields_question>
                    <customfields>
                    </customfields>
                  </plugin_qbank_customfields_question>
                  <question_hints>
                  </question_hints>
                  <tags>
                  </tags>
                </question>
              </questions>
            </question_versions>
          </question_version>
        </question_bank_entry>`;
    });

    categoriesXml += `
  <question_category id="${catTopId}">
    <name>top</name>
    <contextid>${quizCtx}</contextid>
    <contextlevel>70</contextlevel>
    <contextinstanceid>${quizId}</contextinstanceid>
    <info></info>
    <infoformat>0</infoformat>
    <stamp>${stamp()}</stamp>
    <parent>0</parent>
    <sortorder>0</sortorder>
    <idnumber>$@NULL@$</idnumber>
    <question_bank_entries>
    </question_bank_entries>
  </question_category>
  <question_category id="${catDefId}">
    <name>Padrão para ${titulo}</name>
    <contextid>${quizCtx}</contextid>
    <contextlevel>70</contextlevel>
    <contextinstanceid>${quizId}</contextinstanceid>
    <info>A categoria padrão para as questões compartilhadas no contexto '${titulo}'.</info>
    <infoformat>0</infoformat>
    <stamp>${stamp()}</stamp>
    <parent>${catTopId}</parent>
    <sortorder>999</sortorder>
    <idnumber>$@NULL@$</idnumber>
    <question_bank_entries>${entriesXml}
    </question_bank_entries>
  </question_category>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<question_categories>${categoriesXml}
</question_categories>`;
}

function buildAssignXml(id, ctx, aula, now, arquivos = [], gradeOnly = false) {
  const tarefa    = aula.tarefa || {};
  const titulo    = sanitize(normalizeTitleBrackets(tarefa.titulo    || `[Tarefa] ${aula.titulo || ''}`));
  const descricao = sanitize(tarefa.descricao || '');
  const nota      = tarefa.nota ?? 10;
  const duedate   = gradeOnly ? 0 : (dateToTs(tarefa.data_fim    || aula.data_fim,    true) || 0);
  const allowfrom = gradeOnly ? 0 : (dateToTs(tarefa.data_inicio || aula.data_inicio)       || 0);

  const fileEnabled = (!gradeOnly && arquivos.length > 0) ? 1 : 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<activity id="${id}" moduleid="${id}" modulename="assign" contextid="${ctx}">
  <assign id="${id}">
    <name>${titulo}</name>
    <intro>&lt;p&gt;${descricao}&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <alwaysshowdescription>${gradeOnly ? 0 : 1}</alwaysshowdescription>
    <submissiondrafts>0</submissiondrafts>
    <sendnotifications>0</sendnotifications>
    <sendlatenotifications>0</sendlatenotifications>
    <sendstudentnotifications>1</sendstudentnotifications>
    <duedate>${duedate}</duedate>
    <cutoffdate>${duedate}</cutoffdate>
    <gradingduedate>0</gradingduedate>
    <allowsubmissionsfromdate>${allowfrom}</allowsubmissionsfromdate>
    <grade>${nota}</grade>
    <timemodified>${now}</timemodified>
    <completionsubmit>1</completionsubmit>
    <requiresubmissionstatement>0</requiresubmissionstatement>
    <teamsubmission>0</teamsubmission>
    <requireallteammemberssubmit>0</requireallteammemberssubmit>
    <teamsubmissiongroupingid>0</teamsubmissiongroupingid>
    <blindmarking>0</blindmarking>
    <hidegrader>0</hidegrader>
    <revealidentities>0</revealidentities>
    <attemptreopenmethod>none</attemptreopenmethod>
    <maxattempts>-1</maxattempts>
    <markingworkflow>0</markingworkflow>
    <markingallocation>0</markingallocation>
    <preventsubmissionnotingroup>0</preventsubmissionnotingroup>
    <activity></activity>
    <activityformat>1</activityformat>
    <timelimit>0</timelimit>
    <submissionattachments>0</submissionattachments>
    <userflags>
    </userflags>
    <submissions>
    </submissions>
    <grades>
    </grades>
    <plugin_configs>
      <plugin_config id="${id + 1}"><plugin>onlinetext</plugin><subtype>assignsubmission</subtype><name>enabled</name><value>0</value></plugin_config>
      <plugin_config id="${id + 2}"><plugin>file</plugin><subtype>assignsubmission</subtype><name>enabled</name><value>${fileEnabled}</value></plugin_config>
      <plugin_config id="${id + 3}"><plugin>file</plugin><subtype>assignsubmission</subtype><name>maxfilesubmissions</name><value>20</value></plugin_config>
      <plugin_config id="${id + 4}"><plugin>file</plugin><subtype>assignsubmission</subtype><name>maxsubmissionsizebytes</name><value>0</value></plugin_config>
      <plugin_config id="${id + 5}"><plugin>file</plugin><subtype>assignsubmission</subtype><name>filetypeslist</name><value></value></plugin_config>
      <plugin_config id="${id + 6}"><plugin>comments</plugin><subtype>assignsubmission</subtype><name>enabled</name><value>1</value></plugin_config>
      <plugin_config id="${id + 7}"><plugin>comments</plugin><subtype>assignfeedback</subtype><name>enabled</name><value>1</value></plugin_config>
      <plugin_config id="${id + 8}"><plugin>comments</plugin><subtype>assignfeedback</subtype><name>commentinline</name><value>0</value></plugin_config>
      <plugin_config id="${id + 9}"><plugin>editpdf</plugin><subtype>assignfeedback</subtype><name>enabled</name><value>1</value></plugin_config>
      <plugin_config id="${id + 10}"><plugin>offline</plugin><subtype>assignfeedback</subtype><name>enabled</name><value>0</value></plugin_config>
      <plugin_config id="${id + 11}"><plugin>file</plugin><subtype>assignfeedback</subtype><name>enabled</name><value>0</value></plugin_config>
    </plugin_configs>
    <overrides>
    </overrides>
  </assign>
</activity>`;
}

function buildGradebook(rootCatId, eadCatId, presencialCatId, courseItemId, eadItemId, presItemId, categorias, now) {
  const cat0 = categorias[0] || { nome: 'Atividades a distância', peso: 40 };
  const cat1 = categorias[1] || { nome: 'Atividades presenciais',  peso: 60 };
  const peso0 = parseFloat(cat0.peso).toFixed(5);
  const peso1 = parseFloat(cat1.peso).toFixed(5);

  return `<?xml version="1.0" encoding="UTF-8"?>
<gradebook>
  <attributes>
  </attributes>
  <grade_categories>
    <grade_category id="${rootCatId}">
      <parent>$@NULL@$</parent>
      <depth>1</depth>
      <path>/${rootCatId}/</path>
      <fullname>?</fullname>
      <aggregation>10</aggregation>
      <keephigh>0</keephigh>
      <droplow>0</droplow>
      <aggregateonlygraded>0</aggregateonlygraded>
      <aggregateoutcomes>0</aggregateoutcomes>
      <timecreated>${now}</timecreated>
      <timemodified>${now}</timemodified>
      <hidden>0</hidden>
    </grade_category>
    <grade_category id="${eadCatId}">
      <parent>${rootCatId}</parent>
      <depth>2</depth>
      <path>/${rootCatId}/${eadCatId}/</path>
      <fullname>${sanitize(cat0.nome)}</fullname>
      <aggregation>10</aggregation>
      <keephigh>0</keephigh>
      <droplow>0</droplow>
      <aggregateonlygraded>0</aggregateonlygraded>
      <aggregateoutcomes>0</aggregateoutcomes>
      <timecreated>${now}</timecreated>
      <timemodified>${now}</timemodified>
      <hidden>0</hidden>
    </grade_category>
    <grade_category id="${presencialCatId}">
      <parent>${rootCatId}</parent>
      <depth>2</depth>
      <path>/${rootCatId}/${presencialCatId}/</path>
      <fullname>${sanitize(cat1.nome)}</fullname>
      <aggregation>10</aggregation>
      <keephigh>0</keephigh>
      <droplow>0</droplow>
      <aggregateonlygraded>0</aggregateonlygraded>
      <aggregateoutcomes>0</aggregateoutcomes>
      <timecreated>${now}</timecreated>
      <timemodified>${now}</timemodified>
      <hidden>0</hidden>
    </grade_category>
  </grade_categories>
  <grade_items>
    <grade_item id="${courseItemId}">
      <categoryid>$@NULL@$</categoryid>
      <itemname>$@NULL@$</itemname>
      <itemtype>course</itemtype>
      <itemmodule>$@NULL@$</itemmodule>
      <iteminstance>${rootCatId}</iteminstance>
      <itemnumber>$@NULL@$</itemnumber>
      <iteminfo>$@NULL@$</iteminfo>
      <idnumber>$@NULL@$</idnumber>
      <calculation>$@NULL@$</calculation>
      <gradetype>1</gradetype>
      <grademax>10.00000</grademax>
      <grademin>0.00000</grademin>
      <scaleid>$@NULL@$</scaleid>
      <outcomeid>$@NULL@$</outcomeid>
      <gradepass>0.00000</gradepass>
      <multfactor>1.00000</multfactor>
      <plusfactor>0.00000</plusfactor>
      <aggregationcoef>0.00000</aggregationcoef>
      <aggregationcoef2>0.00000</aggregationcoef2>
      <weightoverride>0</weightoverride>
      <sortorder>1</sortorder>
      <display>0</display>
      <decimals>$@NULL@$</decimals>
      <hidden>0</hidden>
      <locked>0</locked>
      <locktime>0</locktime>
      <needsupdate>0</needsupdate>
      <timecreated>${now}</timecreated>
      <timemodified>${now}</timemodified>
      <grade_grades>
      </grade_grades>
    </grade_item>
    <grade_item id="${eadItemId}">
      <categoryid>$@NULL@$</categoryid>
      <itemname></itemname>
      <itemtype>category</itemtype>
      <itemmodule>$@NULL@$</itemmodule>
      <iteminstance>${eadCatId}</iteminstance>
      <itemnumber>$@NULL@$</itemnumber>
      <iteminfo></iteminfo>
      <idnumber></idnumber>
      <calculation>$@NULL@$</calculation>
      <gradetype>1</gradetype>
      <grademax>10.00000</grademax>
      <grademin>0.00000</grademin>
      <scaleid>$@NULL@$</scaleid>
      <outcomeid>$@NULL@$</outcomeid>
      <gradepass>0.00000</gradepass>
      <multfactor>1.00000</multfactor>
      <plusfactor>0.00000</plusfactor>
      <aggregationcoef>${peso0}</aggregationcoef>
      <aggregationcoef2>0.00000</aggregationcoef2>
      <weightoverride>0</weightoverride>
      <sortorder>2</sortorder>
      <display>0</display>
      <decimals>$@NULL@$</decimals>
      <hidden>0</hidden>
      <locked>0</locked>
      <locktime>0</locktime>
      <needsupdate>0</needsupdate>
      <timecreated>${now}</timecreated>
      <timemodified>${now}</timemodified>
      <grade_grades>
      </grade_grades>
    </grade_item>
    <grade_item id="${presItemId}">
      <categoryid>$@NULL@$</categoryid>
      <itemname></itemname>
      <itemtype>category</itemtype>
      <itemmodule>$@NULL@$</itemmodule>
      <iteminstance>${presencialCatId}</iteminstance>
      <itemnumber>$@NULL@$</itemnumber>
      <iteminfo></iteminfo>
      <idnumber></idnumber>
      <calculation>$@NULL@$</calculation>
      <gradetype>1</gradetype>
      <grademax>10.00000</grademax>
      <grademin>0.00000</grademin>
      <scaleid>$@NULL@$</scaleid>
      <outcomeid>$@NULL@$</outcomeid>
      <gradepass>0.00000</gradepass>
      <multfactor>1.00000</multfactor>
      <plusfactor>0.00000</plusfactor>
      <aggregationcoef>${peso1}</aggregationcoef>
      <aggregationcoef2>0.00000</aggregationcoef2>
      <weightoverride>0</weightoverride>
      <sortorder>3</sortorder>
      <display>0</display>
      <decimals>$@NULL@$</decimals>
      <hidden>0</hidden>
      <locked>0</locked>
      <locktime>0</locktime>
      <needsupdate>0</needsupdate>
      <timecreated>${now}</timecreated>
      <timemodified>${now}</timemodified>
      <grade_grades>
      </grade_grades>
    </grade_item>
  </grade_items>
  <grade_letters>
  </grade_letters>
  <grade_settings>
    <grade_setting id="">
      <name>minmaxtouse</name>
      <value>1</value>
    </grade_setting>
  </grade_settings>
</gradebook>`;
}

function buildActivityGradesXml(actId, categoryId, titulo, itemmodule, sortOrder, now) {
  const itemId = actId + 90000;
  titulo = normalizeTitleBrackets(titulo);
  const weight = extractBracketWeight(titulo);
  return `<?xml version="1.0" encoding="UTF-8"?>
<activity_gradebook>
  <grade_items>
    <grade_item id="${itemId}">
      <categoryid>${categoryId}</categoryid>
      <itemname>${sanitize(titulo)}</itemname>
      <itemtype>mod</itemtype>
      <itemmodule>${itemmodule}</itemmodule>
      <iteminstance>${actId}</iteminstance>
      <itemnumber>0</itemnumber>
      <iteminfo></iteminfo>
      <idnumber></idnumber>
      <calculation>$@NULL@$</calculation>
      <gradetype>1</gradetype>
      <grademax>10.00000</grademax>
      <grademin>0.00000</grademin>
      <scaleid>$@NULL@$</scaleid>
      <outcomeid>$@NULL@$</outcomeid>
      <gradepass>0.00000</gradepass>
      <multfactor>1.00000</multfactor>
      <plusfactor>0.00000</plusfactor>
      <aggregationcoef>${weight.toFixed(5)}</aggregationcoef>
      <aggregationcoef2>0.00000</aggregationcoef2>
      <weightoverride>0</weightoverride>
      <sortorder>${sortOrder}</sortorder>
      <display>0</display>
      <decimals>$@NULL@$</decimals>
      <hidden>0</hidden>
      <locked>0</locked>
      <locktime>0</locktime>
      <needsupdate>0</needsupdate>
      <timecreated>${now}</timecreated>
      <timemodified>${now}</timemodified>
      <grade_grades>
      </grade_grades>
    </grade_item>
  </grade_items>
  <grade_letters>
  </grade_letters>
</activity_gradebook>`;
}

function phpSerializeHtmlBlock(title, text) {
  const tLen = Buffer.byteLength(title, 'utf8');
  const xLen = Buffer.byteLength(text, 'utf8');
  // Order must be: title, format, text  (matches real Moodle backup)
  const s = `O:8:"stdClass":3:{s:5:"title";s:${tLen}:"${title}";s:6:"format";s:1:"1";s:4:"text";s:${xLen}:"${text}";}`;
  return Buffer.from(s, 'utf8').toString('base64');
}

function buildBlockXml(id, blockCtxId, courseCtxId, title, text, defaultWeight, posWeight, now) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<block id="${id}" contextid="${blockCtxId}" version="2022112800">
  <blockname>html</blockname>
  <parentcontextid>${courseCtxId}</parentcontextid>
  <showinsubcontexts>0</showinsubcontexts>
  <pagetypepattern>course-view-*</pagetypepattern>
  <subpagepattern>$@NULL@$</subpagepattern>
  <defaultregion>side-post</defaultregion>
  <defaultweight>${defaultWeight}</defaultweight>
  <configdata>${phpSerializeHtmlBlock(title, text)}</configdata>
  <timecreated>${now}</timecreated>
  <timemodified>${now}</timemodified>
  <block_positions>
    <block_position id="${blockCtxId + 1}">
      <contextid>${courseCtxId}</contextid>
      <pagetype>course-view-topics</pagetype>
      <subpage></subpage>
      <visible>1</visible>
      <region>side-post</region>
      <weight>${posWeight}</weight>
    </block_position>
  </block_positions>
</block>`;
}

function buildAgendaHtml(aulas, encontros) {
  const lines = [];
  for (const aula of aulas) {
    const start = aula.data_inicio || '';
    const end   = aula.data_fim   || '';
    const date  = start && end ? `${start} a ${end} – ` : start ? `${start} – ` : '';
    lines.push(`<li>${date}${aula.titulo || `Aula ${aula.numero}`}</li>`);
  }
  for (const enc of encontros) {
    const date = enc.data ? `${enc.data} – ` : '';
    lines.push(`<li>⭐ <strong>${date}${enc.titulo || `Encontro ${enc.numero}`}</strong></li>`);
  }
  return `<p><strong>📅 Cronograma</strong></p><ul>${lines.join('')}</ul>`;
}

function buildCourseSummary(data) {
  const d   = data.disciplina          || {};
  const p   = data.professor           || {};
  const bib = data.bibliografia        || {};
  const fr  = data.frequencia          || {};
  let html = `<h2>${d.nome || ''}</h2>`;
  if (d.codigo)        html += `<p><strong>Código:</strong> ${d.codigo}</p>`;
  if (d.carga_horaria) html += `<p><strong>Carga Horária:</strong> ${d.carga_horaria}</p>`;
  if (d.curso)         html += `<p><strong>Curso:</strong> ${d.curso}</p>`;
  if (d.semestre)      html += `<p><strong>Semestre:</strong> ${d.semestre}</p>`;
  if (p.nome)          html += `<p><strong>Professor(a):</strong> ${p.nome}</p>`;
  if (p.email)         html += `<p><strong>E-mail:</strong> ${p.email}</p>`;
  if (fr.percentual_minimo) {
    html += `<h3>Frequência</h3><p>Frequência mínima exigida: <strong>${fr.percentual_minimo}%</strong>.`;
    if (fr.observacoes) html += ` ${fr.observacoes}`;
    html += `</p>`;
  }
  if (data.ementa)     html += `<h3>Ementa</h3><p>${data.ementa}</p>`;
  if ((bib.basica || []).length) {
    html += `<h3>Bibliografia Básica</h3><ul>${bib.basica.map(b => `<li>${b}</li>`).join('')}</ul>`;
  }
  return html; // will be XML-escaped by sanitize() in the caller
}

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

// ─── Utilities ────────────────────────────────────────────────────────────────

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

function dateToTs(dateStr, isEndDate = false, endTime = '23:59:59') {
  if (!dateStr || dateStr === 'null') return 0;
  const m = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return 0;
  const [, d, mo, y] = m;
  const time = isEndDate ? `T${endTime}` : 'T00:00:00';
  return Math.floor(new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}${time}-03:00`).getTime() / 1000);
}

// Converts plain text (with \n\n paragraph breaks) to XML-escaped Moodle HTML
function textToMoodleHtml(text) {
  if (!text) return '';
  return String(text).split(/\n\n+/)
    .map(p => `&lt;p&gt;${sanitize(p.trim())}&lt;/p&gt;`)
    .filter(p => p !== '&lt;p&gt;&lt;/p&gt;')
    .join('');
}

// Normaliza o último colchete de peso: "[Peso 50%]" → "[50]", "[50%]" → "[50]"
function normalizeTitleBrackets(titulo) {
  return String(titulo || '').replace(
    /\[[^\[\]]*?(\d+(?:\.\d+)?)[^\[\]]*\]([^\[]*)$/,
    (_, n, tail) => `[${parseFloat(n)}]${tail}`
  );
}

function extractBracketWeight(titulo) {
  const m = String(titulo || '').match(/\[(\d+(?:\.\d+)?)\][^\[]*$/);
  return m ? parseFloat(m[1]) : 0;
}

function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return {
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc':  'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
  }[ext] || 'application/octet-stream';
}

/**
 * Reads each file in `arquivos`, hashes it, copies to files/{ab}/{hash},
 * and pushes metadata into fileEntries (which will become files.xml).
 * `write` is not available here (it's a closure inside generateMBZ),
 * so the caller passes fileEntries and this function returns copy ops
 * as { hashPath, content } objects that generateMBZ will write itself.
 *
 * Simpler: just mutates fileEntries and returns copy descriptors.
 */
function embedAssignFiles(assignCtxId, arquivos, fileEntries) {
  if (!arquivos?.length) return [];
  const copies = [];
  for (const arq of arquivos) {
    if (!arq?.filePath) continue;
    try {
      const content  = fs.readFileSync(arq.filePath);
      const hash     = crypto.createHash('sha1').update(content).digest('hex');
      const filename = path.basename(arq.filename || arq.filePath);
      fileEntries.push({
        contenthash: hash,
        contextid:   assignCtxId,
        filename,
        filesize:    content.length,
        mimetype:    getMimeType(filename),
        content,                          // kept so generateMBZ can write the bytes
      });
      copies.push({ hash, content });
    } catch (e) {
      console.warn(`⚠️ Arquivo da tarefa não encontrado: ${arq.filePath}`);
    }
  }
  return copies;
}

// SHA1 of empty string — used for Moodle directory entries
const EMPTY_SHA1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';

function buildFilesXml(entries, now) {
  // Group by contextid to insert one directory entry per assign context
  const seen = new Set();
  const rows = [];
  let id = 1;

  for (const f of entries) {
    // Directory entry (one per context, first time we see this contextid)
    if (!seen.has(f.contextid)) {
      seen.add(f.contextid);
      rows.push(`
  <file id="${id++}">
    <contenthash>${EMPTY_SHA1}</contenthash>
    <contextid>${f.contextid}</contextid>
    <component>mod_assign</component>
    <filearea>introattachment</filearea>
    <itemid>0</itemid>
    <filepath>/</filepath>
    <filename>.</filename>
    <userid>$@NULL@$</userid>
    <filesize>0</filesize>
    <mimetype>$@NULL@$</mimetype>
    <status>0</status>
    <timecreated>${now}</timecreated>
    <timemodified>${now}</timemodified>
    <source>$@NULL@$</source>
    <author>$@NULL@$</author>
    <license>$@NULL@$</license>
    <sortorder>0</sortorder>
    <repositorytype>$@NULL@$</repositorytype>
    <repositoryid>$@NULL@$</repositoryid>
    <reference>$@NULL@$</reference>
  </file>`);
    }
    // Actual file entry
    rows.push(`
  <file id="${id++}">
    <contenthash>${f.contenthash}</contenthash>
    <contextid>${f.contextid}</contextid>
    <component>mod_assign</component>
    <filearea>introattachment</filearea>
    <itemid>0</itemid>
    <filepath>/</filepath>
    <filename>${sanitize(f.filename)}</filename>
    <userid>$@NULL@$</userid>
    <filesize>${f.filesize}</filesize>
    <mimetype>${f.mimetype}</mimetype>
    <status>0</status>
    <timecreated>${now}</timecreated>
    <timemodified>${now}</timemodified>
    <source>${sanitize(f.filename)}</source>
    <author>$@NULL@$</author>
    <license>allrightsreserved</license>
    <sortorder>0</sortorder>
    <repositorytype>$@NULL@$</repositorytype>
    <repositoryid>$@NULL@$</repositoryid>
    <reference>$@NULL@$</reference>
  </file>`);
    f._xmlId = id - 1; // store for inforef use
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<files>${rows.join('')}\n</files>`;
}

module.exports = { generateMBZ };
