/*
 * JLPT Coach V2.3.0 — Textbook Learning Engine
 *
 * Uses textbook-informed metadata bundled in content.json/data.js. The source books are
 * used only for taxonomy, question-format and pedagogy references; published learning
 * items in the app are original rewrites or open-licensed content.
 */
(() => {
  'use strict';

  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function pack(content = window.JLPT_CONTENT) {
    return content?.textbookPack || {};
  }

  function mapBy(items, key = 'id') {
    return new Map(safeArray(items).map((item) => [item?.[key], item]).filter(([id]) => id));
  }

  function questionBlueprints(content) {
    return safeArray(pack(content).questionBlueprints);
  }

  function errorTaxonomy(content) {
    return safeArray(pack(content).errorTaxonomy);
  }

  function questionMap(content) {
    return mapBy(questionBlueprints(content));
  }

  function errorMap(content) {
    return mapBy(errorTaxonomy(content), 'code');
  }

  function blueprint(id, content) {
    return questionMap(content).get(id) || null;
  }

  function questionLabel(id, content) {
    const item = blueprint(id, content);
    if (item) return item.labelTh || item.labelJa || id;
    return clean(id).replaceAll('_', ' ');
  }

  function errorInfo(code, content) {
    return errorMap(content).get(code) || { code, skill: '', labelTh: clean(code).replaceAll('_', ' ') };
  }

  function errorLabel(code, content) {
    return errorInfo(code, content).labelTh || clean(code).replaceAll('_', ' ');
  }

  function blueprintsForLevel(level, content) {
    return questionBlueprints(content).filter((item) => !item.levels?.length || item.levels.includes(level));
  }

  function topicsForLevel(level, content) {
    const taxonomy = pack(content).topicTaxonomy?.levels || {};
    return safeArray(taxonomy[level]);
  }

  function topic(topicId, content) {
    for (const level of LEVELS) {
      const found = topicsForLevel(level, content).find((item) => item.id === topicId);
      if (found) return found;
    }
    return null;
  }

  function learningPath(level, content) {
    return safeArray(pack(content).learningPaths?.[level]);
  }

  function mockStages(content) {
    return safeArray(pack(content).mockLadder?.stages);
  }

  function contrastGroups(content) {
    return safeArray(pack(content).contrastGroups);
  }

  function contrastGroup(id, content) {
    return contrastGroups(content).find((item) => item.id === id) || null;
  }

  function contrastGroupsForGrammar(grammar, content) {
    const ids = safeArray(grammar?.contrastGroupIds);
    return ids.map((id) => contrastGroup(id, content)).filter(Boolean);
  }

  function practiceQuestions(content) {
    return safeArray(content?.practiceQuestions);
  }

  function practiceFor(level, questionTypes, content) {
    const wanted = new Set(safeArray(questionTypes));
    const all = wanted.has('all');
    return practiceQuestions(content).filter((item) => item.level === level && (all || wanted.has(item.questionType)));
  }

  function practiceCount(level, questionType, content) {
    return practiceQuestions(content).filter((item) => item.level === level && item.questionType === questionType).length;
  }

  function topicVocab(level, topicId, content) {
    return safeArray(content?.vocab).filter((item) => item.level === level && safeArray(item.topicIds).includes(topicId));
  }

  function topicCoverage(level, topicId, state, content) {
    const items = topicVocab(level, topicId, content);
    const learned = items.filter((item) => state?.srs?.[item.id]).length;
    const mastered = items.filter((item) => Number(state?.srs?.[item.id]?.interval || 0) >= 7).length;
    return { total: items.length, learned, mastered, percent: items.length ? Math.round(learned / items.length * 100) : 0 };
  }

  function estimatedSeconds(questionType, level = 'N4') {
    const rank = Math.max(1, LEVELS.indexOf(level) + 1);
    if (/reading_medium/.test(questionType)) return 115 + rank * 12;
    if (/reading_information/.test(questionType)) return 80 + rank * 8;
    if (/reading_/.test(questionType)) return 60 + rank * 6;
    if (/listening_/.test(questionType)) return 45 + rank * 5;
    if (/grammar_sentence_order|grammar_text_cloze/.test(questionType)) return 45 + rank * 4;
    if (/grammar_/.test(questionType)) return 30 + rank * 3;
    if (/vocab_word_usage|vocab_paraphrase/.test(questionType)) return 35 + rank * 3;
    return 24 + rank * 2;
  }

  function ensureSubtypeLevel(container, level) {
    if (!container[level] || typeof container[level] !== 'object') {
      container[level] = { questionTypes: {}, errorCodes: {} };
    }
    container[level].questionTypes ||= {};
    container[level].errorCodes ||= {};
    return container[level];
  }

  function blankQuestionStat() {
    return { attempts: 0, correct: 0, totalSeconds: 0, lastDate: null };
  }

  function recordSubtypeAttempt(container, level, card, correct, elapsedSeconds = 0, date = '') {
    const levelStats = ensureSubtypeLevel(container, level);
    const type = card.questionType || card.subtype || card.skill || 'unknown';
    const current = levelStats.questionTypes[type] || blankQuestionStat();
    current.attempts = Number(current.attempts || 0) + 1;
    current.correct = Number(current.correct || 0) + (correct ? 1 : 0);
    current.totalSeconds = Number(current.totalSeconds || 0) + Number(elapsedSeconds || 0);
    current.lastDate = date || current.lastDate || null;
    levelStats.questionTypes[type] = current;
    if (!correct) {
      safeArray(card.errorCodes).forEach((code) => {
        levelStats.errorCodes[code] = Number(levelStats.errorCodes[code] || 0) + 1;
      });
    }
    return levelStats;
  }

  function weakSubtypeRows(level, state, content, limit = 8) {
    const levelStats = state?.subtypeStatsByLevel?.[level] || { questionTypes: {}, errorCodes: {} };
    const mistakes = safeArray(state?.mistakes).filter((item) => item.level === level);
    const errorCounts = { ...(levelStats.errorCodes || {}) };
    mistakes.forEach((item) => safeArray(item.errorCodes).forEach((code) => {
      errorCounts[code] = Math.max(Number(errorCounts[code] || 0), 0) + Number(item.count || 1);
    }));

    const typeRows = Object.entries(levelStats.questionTypes || {}).map(([id, stat]) => {
      const attempts = Number(stat.attempts || 0);
      const correct = Number(stat.correct || 0);
      const accuracy = attempts ? Math.round(correct / attempts * 100) : null;
      const avgSeconds = attempts ? Math.round(Number(stat.totalSeconds || 0) / attempts) : 0;
      const recentMistakes = mistakes.filter((item) => item.questionType === id).reduce((sum, item) => sum + Number(item.count || 1), 0);
      const pressure = (accuracy == null ? 0 : 100 - accuracy) + recentMistakes * 12 + Math.min(20, Math.max(0, avgSeconds - estimatedSeconds(id, level)) / 2);
      return { kind: 'questionType', id, label: questionLabel(id, content), attempts, accuracy, avgSeconds, count: recentMistakes, pressure };
    });

    const errorRows = Object.entries(errorCounts).map(([code, count]) => ({
      kind: 'errorCode', id: code, label: errorLabel(code, content), attempts: 0, accuracy: null, avgSeconds: 0, count: Number(count || 0), pressure: Number(count || 0) * 14 + 8,
    }));

    return [...typeRows, ...errorRows]
      .filter((row) => row.pressure > 0)
      .sort((a, b) => b.pressure - a.pressure || b.count - a.count)
      .slice(0, limit);
  }

  function repeatedErrorCodes(level, state, limit = 5) {
    const rows = weakSubtypeRows(level, state, window.JLPT_CONTENT, 30)
      .filter((row) => row.kind === 'errorCode');
    return rows.slice(0, limit).map((row) => row.id);
  }

  function practicePriority(question, level, state) {
    let score = 0;
    const errors = new Set(repeatedErrorCodes(level, state, 12));
    safeArray(question.errorCodes).forEach((code) => { if (errors.has(code)) score += 20; });
    const stat = state?.subtypeStatsByLevel?.[level]?.questionTypes?.[question.questionType];
    if (stat?.attempts) score += Math.max(0, 100 - Math.round(stat.correct / stat.attempts * 100));
    const repeated = safeArray(state?.mistakes).filter((item) => item.level === level && item.questionType === question.questionType).length;
    score += repeated * 4;
    return score;
  }

  function versionInfo(content) {
    const item = pack(content);
    return {
      version: item.version || content?.meta?.version || 'unknown',
      blueprints: questionBlueprints(content).length,
      errors: errorTaxonomy(content).length,
      contrastGroups: contrastGroups(content).length,
      practiceQuestions: practiceQuestions(content).length,
      newContentCounts: item.newContentCounts || {},
    };
  }

  window.JLPTTextbookEngine = Object.freeze({
    LEVELS,
    clean,
    safeArray,
    pack,
    questionBlueprints,
    errorTaxonomy,
    blueprint,
    questionLabel,
    errorInfo,
    errorLabel,
    blueprintsForLevel,
    topicsForLevel,
    topic,
    learningPath,
    mockStages,
    contrastGroups,
    contrastGroup,
    contrastGroupsForGrammar,
    practiceQuestions,
    practiceFor,
    practiceCount,
    topicVocab,
    topicCoverage,
    estimatedSeconds,
    ensureSubtypeLevel,
    blankQuestionStat,
    recordSubtypeAttempt,
    weakSubtypeRows,
    repeatedErrorCodes,
    practicePriority,
    versionInfo,
  });
})();
