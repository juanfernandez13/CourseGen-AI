'use strict';

const { sanitize, dateToTs, normalizeTitleBrackets, extractBracketWeight } = require('./utils');

// ── Section / Module ──────────────────────────────────────────────────────────

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

function buildModuleXml(id, modname, sectionid, sectionnumber, now, availTs = 0, availEndTs = 0, opts = {}) {
  const visible         = opts.visible !== undefined ? opts.visible : 1;
  const showdescription = opts.showdescription !== undefined ? opts.showdescription : 0;
  let avail;
  if (availTs && availEndTs) {
    avail = `{"op":"&amp;","c":[{"type":"date","d":"&gt;=","t":${availTs}},{"type":"date","d":"&lt;","t":${availEndTs}}],"showc":[true,true]}`;
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
  <visible>${visible}</visible>
  <visibleoncoursepage>1</visibleoncoursepage>
  <visibleold>${visible}</visibleold>
  <groupmode>0</groupmode>
  <groupingid>0</groupingid>
  <completion>1</completion>
  <completiongradeitemnumber>$@NULL@$</completiongradeitemnumber>
  <completionpassgrade>0</completionpassgrade>
  <completionview>0</completionview>
  <completionexpected>0</completionexpected>
  <availability>${avail}</availability>
  <showdescription>${showdescription}</showdescription>
  <downloadcontent>1</downloadcontent>
  <lang></lang>
  <tags>
  </tags>
</module>`;
}

// ── Forum ─────────────────────────────────────────────────────────────────────

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

// ── Quiz ──────────────────────────────────────────────────────────────────────

function buildQuizXml(id, ctx, aula, now) {
  const quiz      = aula.quiz || {};
  const titulo    = sanitize(normalizeTitleBrackets(quiz.titulo || `[Questionário] ${aula.titulo || ''}`));
  const timeopen  = dateToTs(quiz.data_inicio || aula.data_inicio) || 0;
  const timeclose = dateToTs(quiz.data_fim    || aula.data_fim, true) || 0;
  const questoes  = quiz.questoes || [];

  // Nota máxima da atividade é sempre 10; a nota do livro de notas é configurada separadamente
  const gradeActivity = 10;
  const sumgrades = questoes.length > 0
    ? questoes.reduce((s, q) => s + (parseFloat(q.pontuacao) || 1), 0)
    : gradeActivity;

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
    <timelimit>7200</timelimit>
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
    <grade>${gradeActivity}.00000</grade>
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
        <maxgrade>${gradeActivity + 1}.00000</maxgrade>
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

// ── Questions (banco de questões) ─────────────────────────────────────────────

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
        const itens    = q.itens || [];
        const nCorrect = itens.filter(it => it.isCorrect).length || 1;
        let answersXml = '';
        itens.forEach((item, ai) => {
          const answerId = quizId + 8000000 + qi * 100 + ai;
          const fraction = item.isCorrect ? (1 / nCorrect).toFixed(7) : '0.0000000';
          const fbText   = item.feedback
            ? sanitize(item.feedback)
            : (item.isCorrect ? 'Opção correta. Parabéns!' : 'Opção incorreta.');
          answersXml += `
                    <answer id="${answerId}">
                      <answertext>&lt;p&gt;${sanitize(item.texto || '')}&lt;/p&gt;</answertext>
                      <answerformat>1</answerformat>
                      <fraction>${fraction}</fraction>
                      <feedback>&lt;p&gt;${fbText}&lt;/p&gt;</feedback>
                      <feedbackformat>1</feedbackformat>
                    </answer>`;
        });
        const mcId     = quizId + 9000000 + qi * 100;
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
        const itens      = q.itens || [];
        const matchOptId = quizId + 10000000 + qi * 100;
        let matchesXml   = '';
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

// ── Chat ─────────────────────────────────────────────────────────────────────

function buildChatXml(id, ctx, aula, now) {
  const chat      = aula.chat || {};
  const titulo    = sanitize(normalizeTitleBrackets(chat.titulo || aula.titulo || `Chat ${aula.numero || id}`));
  const descricao = sanitize(chat.descricao || aula.descricao || '');
  const chattime  = dateToTs(chat.data_inicio || aula.data_inicio) || 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<activity id="${id}" moduleid="${id}" modulename="chat" contextid="${ctx}">
  <chat id="${id}">
    <name>${titulo}</name>
    <intro>&lt;p dir="ltr"&gt;${descricao}&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <keepdays>0</keepdays>
    <studentlogs>0</studentlogs>
    <chattime>${chattime}</chattime>
    <schedule>0</schedule>
    <timemodified>${now}</timemodified>
    <messages>
    </messages>
  </chat>
</activity>`;
}

// ── Wiki ─────────────────────────────────────────────────────────────────────

function buildWikiXml(id, ctx, aula, now) {
  const wiki      = aula.wiki || {};
  const titulo    = sanitize(normalizeTitleBrackets(wiki.titulo || aula.titulo || `Wiki ${aula.numero || id}`));
  const descricao = sanitize(wiki.descricao || aula.descricao || '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<activity id="${id}" moduleid="${id}" modulename="wiki" contextid="${ctx}">
  <wiki id="${id}">
    <name>${titulo}</name>
    <intro>&lt;p dir="ltr" style="text-align: left;"&gt;${descricao}&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <timecreated>0</timecreated>
    <timemodified>${now}</timemodified>
    <firstpagetitle>1</firstpagetitle>
    <wikimode>collaborative</wikimode>
    <defaultformat>html</defaultformat>
    <forceformat>0</forceformat>
    <editbegin>0</editbegin>
    <editend>0</editend>
    <subwikis>
    </subwikis>
  </wiki>
</activity>`;
}

// ── Glossary ─────────────────────────────────────────────────────────────────

function buildGlossaryXml(id, ctx, aula, now) {
  const glossary  = aula.glossario || {};
  const titulo    = sanitize(normalizeTitleBrackets(glossary.titulo || aula.titulo || `Glossário ${aula.numero || id}`));
  const descricao = sanitize(glossary.descricao || aula.descricao || '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<activity id="${id}" moduleid="${id}" modulename="glossary" contextid="${ctx}">
  <glossary id="${id}">
    <name>${titulo}</name>
    <intro>&lt;p dir="ltr"&gt;${descricao}&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <allowduplicatedentries>0</allowduplicatedentries>
    <displayformat>fullwithauthor</displayformat>
    <mainglossary>0</mainglossary>
    <showspecial>1</showspecial>
    <showalphabet>1</showalphabet>
    <showall>1</showall>
    <allowcomments>1</allowcomments>
    <allowprintview>1</allowprintview>
    <usedynalink>0</usedynalink>
    <defaultapproval>1</defaultapproval>
    <globalglossary>0</globalglossary>
    <entbypage>10</entbypage>
    <editalways>0</editalways>
    <rsstype>0</rsstype>
    <rssarticles>0</rssarticles>
    <assessed>1</assessed>
    <assesstimestart>0</assesstimestart>
    <assesstimefinish>0</assesstimefinish>
    <scale>10</scale>
    <timecreated>${now}</timecreated>
    <timemodified>${now}</timemodified>
    <completionentries>0</completionentries>
    <entries>
    </entries>
    <entriestags>
    </entriestags>
    <categories>
    </categories>
  </glossary>
</activity>`;
}

// ── Assign (tarefa / nota / falta) ────────────────────────────────────────────

function buildAssignXml(id, ctx, aula, now, arquivos = [], gradeOnly = false) {
  const tarefa    = aula.tarefa || {};
  const titulo    = sanitize(normalizeTitleBrackets(tarefa.titulo    || `[Tarefa] ${aula.titulo || ''}`));
  const descricao = sanitize(tarefa.descricao || '');
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
    <grade>10</grade>
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

// ── Gradebook ─────────────────────────────────────────────────────────────────

function buildGradebook(rootCatId, eadCatId, presencialCatId, courseItemId, eadItemId, presItemId, categorias, now) {
  const cat0  = categorias[0] || { nome: 'Atividades a distância', peso: 40 };
  const cat1  = categorias[1] || { nome: 'Atividades presenciais',  peso: 60 };
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

// ── HTML Blocks ───────────────────────────────────────────────────────────────

function phpSerializeHtmlBlock(title, text) {
  const tLen = Buffer.byteLength(title, 'utf8');
  const xLen = Buffer.byteLength(text,  'utf8');
  // Order must be: title, format, text (matches real Moodle backup)
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

// ── HTML content helpers ──────────────────────────────────────────────────────

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
  const d   = data.disciplina   || {};
  const p   = data.professor    || {};
  const bib = data.bibliografia || {};
  const fr  = data.frequencia   || {};
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
  if (data.ementa) html += `<h3>Ementa</h3><p>${data.ementa}</p>`;
  if ((bib.basica || []).length) {
    html += `<h3>Bibliografia Básica</h3><ul>${bib.basica.map(b => `<li>${b}</li>`).join('')}</ul>`;
  }
  return html;
}

module.exports = {
  buildSectionXml,
  buildModuleXml,
  buildForumDiscussionXml,
  buildChatXml,
  buildWikiXml,
  buildGlossaryXml,
  buildQuizXml,
  buildQuestionsXml,
  buildAssignXml,
  buildGradebook,
  buildActivityGradesXml,
  buildBlockXml,
  buildAgendaHtml,
  buildCourseSummary,
};
