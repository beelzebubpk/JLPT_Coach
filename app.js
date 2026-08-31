(async () => {
  'use strict';

  const CONTENT = window.JLPT_CONTENT_READY ? await window.JLPT_CONTENT_READY : window.JLPT_CONTENT;
  if (!CONTENT) {
    document.body.innerHTML = '<p style="padding:24px">ไม่พบข้อมูลแอป กรุณาเปิด index.html พร้อม data.js</p>';
    return;
  }
  const DIALOGUE = window.JLPTDialogueEngine;
  if (!DIALOGUE) {
    document.body.innerHTML = '<p style="padding:24px">ไม่พบ Dialogue Engine กรุณาอัปโหลด dialogue-engine.js พร้อมไฟล์แอป</p>';
    return;
  }

  const STORAGE_KEY = 'jlpt-coach-state-v2';
  const LEGACY_KEY = 'n4-sprint-state-v1';
  const SCHEMA_VERSION = 2;
  const DAY_MS = 86400000;
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const LEVEL_RANK = Object.fromEntries(LEVELS.map((level, index) => [level, index + 1]));
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const SKILL_LABELS = {
    vocab: { th: 'Vocabulary / Kanji', short: 'คำศัพท์', icon: '🧠' },
    grammar: { th: 'Grammar', short: 'ไวยากรณ์', icon: '🧩' },
    reading: { th: 'Reading', short: 'การอ่าน', icon: '📖' },
    listening: { th: 'Listening', short: 'การฟัง', icon: '🎧' },
  };

  const INSIGHTS = [
    ['💡', 'จำเป็นชุด ไม่ใช่คำโดด', 'จำคำศัพท์พร้อมคำอ่าน Particle ที่ใช้คู่กัน และประโยคสั้น จะช่วยทั้ง Vocabulary, Reading และ Listening'],
    ['⏱️', 'ความเร็วคือส่วนหนึ่งของความรู้', 'คำที่รู้แต่ต้องคิดนานยังไม่พร้อมสำหรับข้อสอบ ใช้ Smart Review จนตอบได้อัตโนมัติ'],
    ['🎧', 'แยกผู้พูดก่อนจับคำตอบ', 'ระบบใช้คนละเสียงหรือปรับ Pitch/Rate ตามผู้พูด รอบแรกให้จับว่าใครเสนออะไรและข้อสรุปสุดท้ายคืออะไร'],
    ['📖', 'อ่านคำถามก่อนบทความ', 'หา keyword เช่น いつ、なぜ、最も และเงื่อนไขปฏิเสธ ก่อนอ่านรายละเอียด'],
    ['🔁', 'ข้อผิดคือข้อมูล ไม่ใช่ความล้มเหลว', 'Mistake Log จะเพิ่มน้ำหนักให้ทักษะที่พลาดและนำคำศัพท์กลับมาถามเร็วขึ้น'],
    ['🌱', 'วันยุ่งก็เรียนได้', 'โหมด 5–10 นาทีช่วยรักษาความต่อเนื่อง โดยระบบยังเลือกสิ่งที่มีมูลค่าสูงสุดให้'],
    ['🧭', 'คะแนนรวมอย่างเดียวไม่พอ', 'JLPT ต้องผ่านทั้งคะแนนรวมและ Section minimum แอปจึงแสดงความเสี่ยงราย Section แยกกัน'],
    ['🧠', 'จุดแข็งใช้ Maintenance', 'ทักษะที่ดีอยู่แล้วจะยังถูกฝึก แต่ใช้เวลาน้อยกว่าเพื่อเปิดพื้นที่ให้จุดอ่อน'],
  ];

  const STUDY_ITEMS = [...(CONTENT.vocab || []), ...(CONTENT.kanjiStudyItems || [])];
  const VOCAB_BY_ID = new Map(STUDY_ITEMS.map((item) => [item.id, item]));
  const GRAMMAR_BY_ID = new Map(CONTENT.grammar.map((item) => [item.id, item]));
  const READING_BY_ID = new Map(CONTENT.readings.map((item) => [item.id, item]));
  const LISTENING_BY_ID = new Map(CONTENT.listenings.map((item) => [item.id, item]));
  const VOCAB_ORDER_CACHE = new Map();

  let state = loadState();
  let currentView = 'home';
  let reviewFilter = 'due';
  let activeLesson = null;
  let installPrompt = null;
  let toastTimer = null;
  let activeSpeechUi = null;
  let questionTimerHandle = null;
  let onboardingStep = 1;
  let onboardingEditMode = false;
  let onboardingResultId = null;

  function blankStats() {
    return {
      vocab: { attempts: 0, correct: 0, totalSeconds: 0 },
      grammar: { attempts: 0, correct: 0, totalSeconds: 0 },
      reading: { attempts: 0, correct: 0, totalSeconds: 0 },
      listening: { attempts: 0, correct: 0, totalSeconds: 0 },
    };
  }

  function defaultStatsByLevel() {
    return Object.fromEntries(LEVELS.map((level) => [level, blankStats()]));
  }

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: {
        name: '',
        targetLevel: 'N4',
        dailyMinutes: 25,
        reminderTime: '20:30',
        examDate: CONTENT.meta.defaultExamDate,
        sound: true,
        multiVoice: true,
        listeningSpeed: 'auto',
        dark: false,
        selfWeaknesses: [],
        onboardingDone: false,
        createdAt: localISO(),
      },
      examResults: [],
      xp: 0,
      streak: 0,
      lastStudyDate: null,
      completedDates: {},
      srs: {},
      statsByLevel: defaultStatsByLevel(),
      mistakes: [],
      mockScores: [],
      lessonHistory: [],
      lastReminderDate: null,
      migratedFromV1: false,
    };
  }

  function normalizeStatsByLevel(saved) {
    const base = defaultStatsByLevel();
    LEVELS.forEach((level) => {
      const source = saved?.[level] || {};
      Object.keys(base[level]).forEach((skill) => {
        base[level][skill] = { ...base[level][skill], ...(source[skill] || {}) };
      });
    });
    return base;
  }

  function migrateLegacyState(legacy) {
    const next = defaultState();
    const legacyProfile = legacy.profile || {};
    next.profile = {
      ...next.profile,
      name: legacyProfile.name || 'Patipat',
      targetLevel: 'N4',
      dailyMinutes: Number(legacyProfile.dailyMinutes || 25),
      reminderTime: legacyProfile.reminderTime || '20:30',
      examDate: legacyProfile.examDate || CONTENT.meta.defaultExamDate,
      sound: legacyProfile.sound !== false,
      multiVoice: legacyProfile.multiVoice !== false,
      listeningSpeed: legacyProfile.listeningSpeed || 'auto',
      dark: Boolean(legacyProfile.dark),
      selfWeaknesses: ['vocab'],
      onboardingDone: true,
      createdAt: legacyProfile.createdAt || localISO(),
    };
    next.examResults = [
      { id: 'legacy-n5-2025', level: 'N5', date: '2025-12-07', sections: { languageReading: 65, listening: 31 }, references: { vocab: 'A', grammar: 'A', reading: 'A' }, note: 'Migrated from N4 Sprint baseline' },
      { id: 'legacy-n4-2026', level: 'N4', date: '2026-07-05', sections: { languageReading: 51, listening: 24 }, references: { vocab: 'B', grammar: 'A', reading: 'B' }, note: 'Migrated from N4 Sprint baseline' },
    ];
    next.xp = Number(legacy.xp || 0);
    next.streak = Number(legacy.streak || 0);
    next.lastStudyDate = legacy.lastStudyDate || null;
    next.completedDates = legacy.completedDates || {};
    next.statsByLevel.N4 = {
      vocab: { ...blankStats().vocab, ...(legacy.stats?.vocab || {}) },
      grammar: { ...blankStats().grammar, ...(legacy.stats?.grammar || {}) },
      reading: { ...blankStats().reading, ...(legacy.stats?.reading || {}) },
      listening: { ...blankStats().listening, ...(legacy.stats?.listening || {}) },
    };
    Object.entries(legacy.srs || {}).forEach(([id, value]) => {
      const mapped = id.startsWith('v') ? `n4-${id}` : id;
      if (VOCAB_BY_ID.has(mapped)) next.srs[mapped] = value;
    });
    next.mistakes = (legacy.mistakes || []).map((m) => ({
      ...m,
      level: 'N4',
      itemId: m.itemId ? (m.itemId.startsWith('v') ? `n4-${m.itemId}` : m.itemId) : null,
      grammarId: m.grammarId ? (m.grammarId.startsWith('n4-') ? m.grammarId : `n4-${m.grammarId}`) : null,
    }));
    next.mockScores = (legacy.mockScores || []).map((m) => ({
      id: m.id || `legacy-mock-${Date.now()}-${Math.random()}`,
      level: 'N4',
      date: m.date || localISO(),
      sections: { languageReading: Number(m.languageReading || 0), listening: Number(m.listening || 0) },
      total: Number(m.total ?? (Number(m.languageReading || 0) + Number(m.listening || 0))),
      note: m.note || '',
    }));
    next.lessonHistory = (legacy.lessonHistory || []).map((item) => ({ ...item, level: item.level || 'N4' }));
    next.lastReminderDate = legacy.lastReminderDate || null;
    next.migratedFromV1 = true;
    return next;
  }

  function loadState() {
    const base = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (legacyRaw) {
          const migrated = migrateLegacyState(JSON.parse(legacyRaw));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
        return base;
      }
      const saved = JSON.parse(raw);
      return {
        ...base,
        ...saved,
        profile: { ...base.profile, ...(saved.profile || {}) },
        examResults: Array.isArray(saved.examResults) ? saved.examResults : [],
        completedDates: saved.completedDates || {},
        srs: saved.srs || {},
        statsByLevel: normalizeStatsByLevel(saved.statsByLevel),
        mistakes: Array.isArray(saved.mistakes) ? saved.mistakes : [],
        mockScores: Array.isArray(saved.mockScores) ? saved.mockScores : [],
        lessonHistory: Array.isArray(saved.lessonHistory) ? saved.lessonHistory : [],
      };
    } catch (error) {
      console.warn('Could not load saved state:', error);
      return base;
    }
  }

  function saveState() {
    try {
      state.schemaVersion = SCHEMA_VERSION;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not save app state:', error);
      showToast('บันทึกข้อมูลในเครื่องไม่สำเร็จ');
    }
  }

  function localISO(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(iso) {
    if (!iso) return new Date();
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function addDays(iso, amount) {
    const d = parseLocalDate(iso);
    d.setDate(d.getDate() + amount);
    return localISO(d);
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((parseLocalDate(toIso) - parseLocalDate(fromIso)) / DAY_MS);
  }

  function formatThaiDate(iso, options = {}) {
    if (!iso) return 'ไม่ระบุวันที่';
    const defaultOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat('th-TH', { ...defaultOptions, ...options }).format(parseLocalDate(iso));
  }

  function hashString(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(items, seedText) {
    const result = [...items];
    const random = mulberry32(hashString(seedText));
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getConfig(level = state.profile.targetLevel) {
    return CONTENT.meta.scoring[level] || CONTENT.meta.scoring.N4;
  }

  function isWithinTargetLevel(itemLevel, targetLevel = state.profile.targetLevel) {
    return (LEVEL_RANK[itemLevel] || 99) <= (LEVEL_RANK[targetLevel] || 0);
  }

  function levelVocab(level = state.profile.targetLevel) {
    return STUDY_ITEMS.filter((item) => isWithinTargetLevel(item.level, level));
  }

  function levelLexicalVocab(level = state.profile.targetLevel) {
    return (CONTENT.vocab || []).filter((item) => isWithinTargetLevel(item.level, level));
  }

  function levelKanji(level = state.profile.targetLevel) {
    return (CONTENT.kanji || []).filter((item) => isWithinTargetLevel(item.level, level));
  }

  function levelGrammar(level = state.profile.targetLevel) {
    return CONTENT.grammar.filter((item) => item.level === level);
  }

  function levelReadings(level = state.profile.targetLevel) {
    return CONTENT.readings.filter((item) => item.level === level);
  }

  function levelListenings(level = state.profile.targetLevel) {
    return CONTENT.listenings.filter((item) => item.level === level);
  }

  function getLevelStats(level = state.profile.targetLevel) {
    if (!state.statsByLevel[level]) state.statsByLevel[level] = blankStats();
    return state.statsByLevel[level];
  }

  function resultTotal(result) {
    if (!result) return 0;
    return Object.values(result.sections || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function resultPasses(result) {
    if (!result) return false;
    const config = getConfig(result.level);
    const total = resultTotal(result);
    return total >= config.overallPass && config.sections.every((section) => Number(result.sections?.[section.key] || 0) >= section.pass);
  }

  function latestByDate(items) {
    return [...items].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null;
  }

  function latestExamResult(level = state.profile.targetLevel) {
    return latestByDate(state.examResults.filter((result) => result.level === level));
  }

  function latestMock(level = state.profile.targetLevel) {
    return latestByDate(state.mockScores.filter((result) => result.level === level));
  }

  function nearestExamResult(level = state.profile.targetLevel) {
    const exact = latestExamResult(level);
    if (exact) return exact;
    const targetRank = LEVEL_RANK[level];
    const sorted = [...state.examResults].sort((a, b) => {
      const da = Math.abs(LEVEL_RANK[a.level] - targetRank);
      const db = Math.abs(LEVEL_RANK[b.level] - targetRank);
      if (da !== db) return da - db;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    return sorted[0] || null;
  }

  function gradePerformance(grade) {
    return ({ A: 0.82, B: 0.50, C: 0.25, U: 0.55, '': 0.55 }[grade] ?? 0.55);
  }

  function accuracy(skill, level = state.profile.targetLevel) {
    const stat = getLevelStats(level)[skill];
    return stat.attempts ? Math.round(stat.correct / stat.attempts * 100) : null;
  }

  function allocateWeights(raw) {
    const skills = Object.keys(SKILL_LABELS);
    const floor = 10;
    const remaining = 100 - floor * skills.length;
    const sum = skills.reduce((total, skill) => total + Math.max(0.01, raw[skill]), 0);
    const exact = Object.fromEntries(skills.map((skill) => [skill, floor + remaining * Math.max(0.01, raw[skill]) / sum]));
    const rounded = Object.fromEntries(skills.map((skill) => [skill, Math.round(exact[skill])]));
    let diff = 100 - skills.reduce((total, skill) => total + rounded[skill], 0);
    const order = [...skills].sort((a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])));
    let index = 0;
    while (diff !== 0) {
      const skill = order[index % order.length];
      if (diff > 0) { rounded[skill] += 1; diff -= 1; }
      else if (rounded[skill] > floor) { rounded[skill] -= 1; diff += 1; }
      index += 1;
      if (index > 100) break;
    }
    return rounded;
  }

  function getPhase(profile = state.profile) {
    const left = daysBetween(localISO(), profile.examDate);
    if (left < 0) return { id: 6, name: 'After Exam', short: 'Review', description: 'สรุปผลและวางระดับถัดไป', newRatio: 0.15 };
    if (left === 0) return { id: 5, name: 'Exam Day', short: 'Today', description: 'ทบทวนเบา ๆ และรักษาสมาธิ', newRatio: 0 };
    if (left <= 7) return { id: 5, name: 'Final Review', short: 'Final', description: 'งดเนื้อหาใหม่จำนวนมาก เน้นข้อผิดและพักให้พอ', newRatio: 0 };
    if (left <= 21) return { id: 4, name: 'Mock & Repair', short: 'Phase 4', description: 'ทำ Mock และซ่อม Section ที่เสี่ยง', newRatio: 0.10 };
    if (left <= 45) return { id: 3, name: 'Exam Mode', short: 'Phase 3', description: 'จับเวลาและฝึกตัดสินใจให้เร็ว', newRatio: 0.20 };
    if (left <= 90) return { id: 2, name: 'Skill Connection', short: 'Phase 2', description: 'เชื่อมคำศัพท์กับ Reading และ Listening', newRatio: 0.35 };
    return { id: 1, name: 'Foundation Repair', short: 'Phase 1', description: 'สร้างคลังคำและซ่อมพื้นฐานที่ขาด', newRatio: 0.55 };
  }

  function computeAdaptivePlan(options = {}) {
    const profile = options.profile || state.profile;
    const examResults = options.examResults || state.examResults;
    const statsByLevel = options.statsByLevel || state.statsByLevel;
    const mistakes = options.mistakes || state.mistakes;
    const level = profile.targetLevel || 'N4';
    const config = getConfig(level);
    const sameLevelResult = latestByDate(examResults.filter((r) => r.level === level));
    const targetRank = LEVEL_RANK[level];
    let sourceResult = sameLevelResult;
    if (!sourceResult && examResults.length) {
      sourceResult = [...examResults].sort((a, b) => {
        const da = Math.abs(LEVEL_RANK[a.level] - targetRank);
        const db = Math.abs(LEVEL_RANK[b.level] - targetRank);
        if (da !== db) return da - db;
        return String(b.date || '').localeCompare(String(a.date || ''));
      })[0];
    }

    const performance = { vocab: 0.55, grammar: 0.55, reading: 0.55, listening: 0.55 };
    if (sourceResult) {
      const sourceConfig = getConfig(sourceResult.level);
      const same = sourceResult.level === level;
      const rankGap = Math.abs(LEVEL_RANK[sourceResult.level] - targetRank);
      const confidence = same ? 1 : clamp(0.58 - rankGap * 0.12, 0.22, 0.58);
      const refs = sourceResult.references || {};
      const hasRef = (key) => ['A', 'B', 'C'].includes(refs[key]);
      let sourcePerf;
      if (['N4', 'N5'].includes(sourceResult.level)) {
        const lr = clamp(Number(sourceResult.sections?.languageReading || 0) / 120, 0, 1);
        sourcePerf = {
          vocab: hasRef('vocab') ? lr * 0.42 + gradePerformance(refs.vocab) * 0.58 : lr,
          grammar: hasRef('grammar') ? lr * 0.42 + gradePerformance(refs.grammar) * 0.58 : lr,
          reading: hasRef('reading') ? lr * 0.42 + gradePerformance(refs.reading) * 0.58 : lr,
          listening: clamp(Number(sourceResult.sections?.listening || 0) / 60, 0, 1),
        };
      } else {
        const lang = clamp(Number(sourceResult.sections?.language || 0) / 60, 0, 1);
        const read = clamp(Number(sourceResult.sections?.reading || 0) / 60, 0, 1);
        sourcePerf = {
          vocab: hasRef('vocab') ? lang * 0.45 + gradePerformance(refs.vocab) * 0.55 : lang,
          grammar: hasRef('grammar') ? lang * 0.45 + gradePerformance(refs.grammar) * 0.55 : lang,
          reading: hasRef('reading') ? read * 0.55 + gradePerformance(refs.reading) * 0.45 : read,
          listening: clamp(Number(sourceResult.sections?.listening || 0) / 60, 0, 1),
        };
      }
      Object.keys(performance).forEach((skill) => {
        const adjustedSource = same ? sourcePerf[skill] : Math.max(0.2, sourcePerf[skill] - rankGap * 0.10);
        performance[skill] = performance[skill] * (1 - confidence) + adjustedSource * confidence;
      });
    }

    const levelStats = statsByLevel?.[level] || blankStats();
    Object.keys(performance).forEach((skill) => {
      const stat = levelStats[skill] || blankStats()[skill];
      if (stat.attempts >= 4) {
        const practicePerf = stat.correct / stat.attempts;
        const confidence = clamp(stat.attempts / 60, 0.12, 0.58);
        performance[skill] = performance[skill] * (1 - confidence) + practicePerf * confidence;
      }
      performance[skill] = clamp(performance[skill], 0.12, 0.94);
    });

    const selfWeak = new Set(profile.selfWeaknesses || []);
    const mistakeCounts = { vocab: 0, grammar: 0, reading: 0, listening: 0 };
    mistakes.filter((m) => (m.level || level) === level).forEach((m) => {
      if (mistakeCounts[m.skill] != null) mistakeCounts[m.skill] += Number(m.count || 1);
    });

    const raw = {};
    Object.keys(performance).forEach((skill) => {
      raw[skill] = 0.16 + Math.pow(1 - performance[skill], 1.35);
      if (selfWeak.has(skill)) raw[skill] += 0.30;
      if (skill === 'vocab' && selfWeak.has('kanji')) raw[skill] += 0.22;
      if (selfWeak.has('speed') && ['vocab', 'reading', 'listening'].includes(skill)) raw[skill] += 0.10;
      raw[skill] += Math.min(0.28, mistakeCounts[skill] * 0.018);
    });
    const weights = allocateWeights(raw);
    const priority = Object.keys(weights).sort((a, b) => weights[b] - weights[a])[0];
    const phase = getPhase(profile);

    let priorityReason = 'เป็นทักษะที่มีช่องว่างมากที่สุดจากข้อมูลปัจจุบัน';
    if (selfWeak.has(priority) || (priority === 'vocab' && selfWeak.has('kanji'))) priorityReason = 'คุณระบุว่าเป็นจุดอ่อน และข้อมูลระบบยังสนับสนุนให้เพิ่มเวลา';
    else if (sourceResult?.references && ['B', 'C'].includes(sourceResult.references[priority])) priorityReason = `Reference Information ของทักษะนี้อยู่ระดับ ${sourceResult.references[priority]}`;
    else {
      const stat = levelStats[priority];
      if (stat?.attempts >= 4 && stat.correct / stat.attempts < 0.7) priorityReason = `ความแม่นยำจากการฝึกล่าสุดอยู่ที่ ${Math.round(stat.correct / stat.attempts * 100)}%`;
    }

    const total = sameLevelResult ? resultTotal(sameLevelResult) : null;
    const gapToPass = total == null ? null : Math.max(0, config.overallPass - total);
    const sectionRisks = sameLevelResult ? config.sections.map((section) => {
      const score = Number(sameLevelResult.sections?.[section.key] || 0);
      return { ...section, score, margin: score - section.pass, risk: score < section.pass + 5 };
    }) : [];

    return { level, config, sourceResult, sameLevelResult, performance, weights, priority, priorityReason, phase, gapToPass, sectionRisks };
  }

  function buildPlanCounts(adaptive = computeAdaptivePlan(), minutes = Number(state.profile.dailyMinutes)) {
    const units = Math.max(5, Math.round(minutes / 2));
    const counts = {
      vocab: Math.max(1, Math.round(units * adaptive.weights.vocab / 100)),
      grammar: Math.max(1, Math.round(units * adaptive.weights.grammar / 100)),
      reading: Math.max(1, Math.round(units * adaptive.weights.reading / 100 / 1.35)),
      listening: Math.max(1, Math.round(units * adaptive.weights.listening / 100 / 1.35)),
    };
    if (minutes <= 10) {
      counts.grammar = adaptive.weights.grammar >= 18 ? 1 : 0;
      if (adaptive.weights.reading < 18 && adaptive.weights.listening >= adaptive.weights.reading) counts.reading = 0;
      if (adaptive.weights.listening < 18 && adaptive.weights.reading > adaptive.weights.listening) counts.listening = 0;
    }
    const newWords = adaptive.phase.newRatio === 0 ? 0 : Math.min(counts.vocab, Math.max(1, Math.round(counts.vocab * adaptive.phase.newRatio)));
    return { ...counts, newWords, reviews: Math.max(0, counts.vocab - newWords), minutes };
  }

  function buildVocabOrder(level = state.profile.targetLevel) {
    if (VOCAB_ORDER_CACHE.has(level)) return VOCAB_ORDER_CACHE.get(level);
    const items = levelVocab(level);
    const buckets = {};
    items.forEach((item) => { (buckets[item.theme] ||= []).push(item); });
    Object.keys(buckets).forEach((theme) => { buckets[theme] = seededShuffle(buckets[theme], `${level}-${theme}`); });
    const themes = seededShuffle(Object.keys(buckets), `${level}-theme-order`);
    const pointers = Object.fromEntries(themes.map((theme) => [theme, 0]));
    const order = [];
    let remaining = items.length;
    while (remaining > 0) {
      let added = 0;
      themes.forEach((theme) => {
        const pointer = pointers[theme];
        if (pointer < buckets[theme].length) {
          order.push(buckets[theme][pointer]);
          pointers[theme] += 1;
          remaining -= 1;
          added += 1;
        }
      });
      if (!added) break;
    }
    VOCAB_ORDER_CACHE.set(level, order);
    return order;
  }

  function getDueItems(level = state.profile.targetLevel, date = localISO()) {
    return Object.entries(state.srs)
      .filter(([id, srs]) => isWithinTargetLevel(VOCAB_BY_ID.get(id)?.level, level) && srs.due <= date)
      .map(([id, srs]) => ({ item: VOCAB_BY_ID.get(id), srs }))
      .sort((a, b) => {
        if (a.srs.due !== b.srs.due) return a.srs.due.localeCompare(b.srs.due);
        const aRate = a.srs.attempts ? a.srs.correct / a.srs.attempts : 0;
        const bRate = b.srs.attempts ? b.srs.correct / b.srs.attempts : 0;
        return aRate - bRate || b.srs.lapses - a.srs.lapses;
      });
  }

  function getWeakItems(level = state.profile.targetLevel) {
    return Object.entries(state.srs)
      .filter(([id]) => isWithinTargetLevel(VOCAB_BY_ID.get(id)?.level, level))
      .map(([id, srs]) => ({ item: VOCAB_BY_ID.get(id), srs }))
      .filter(({ srs }) => (srs.attempts >= 1 && srs.correct / srs.attempts < 0.72) || srs.lapses >= 1)
      .sort((a, b) => {
        const aRate = a.srs.attempts ? a.srs.correct / a.srs.attempts : 0;
        const bRate = b.srs.attempts ? b.srs.correct / b.srs.attempts : 0;
        return aRate - bRate || b.srs.lapses - a.srs.lapses;
      });
  }

  function getNewItems(count, level = state.profile.targetLevel) {
    const fresh = buildVocabOrder(level).filter((item) => !state.srs[item.id]);
    if (fresh.length >= count) return fresh.slice(0, count);
    const reinforcement = getWeakItems(level).map(({ item }) => item);
    return uniqueBy([...fresh, ...reinforcement, ...buildVocabOrder(level)], (item) => item.id).slice(0, count);
  }

  function ensureSrs(itemId) {
    if (!state.srs[itemId]) {
      state.srs[itemId] = {
        learnedAt: localISO(), due: localISO(), interval: 0, ease: 2.4, reps: 0,
        attempts: 0, correct: 0, lapses: 0, lastSeen: null,
      };
    }
    return state.srs[itemId];
  }

  function updateSrs(itemId, isCorrect) {
    const srs = ensureSrs(itemId);
    srs.attempts += 1;
    srs.lastSeen = localISO();
    if (!isCorrect) {
      srs.lapses += 1;
      srs.reps = 0;
      srs.interval = 1;
      srs.ease = Math.max(1.3, srs.ease - 0.2);
      srs.due = addDays(localISO(), 1);
      return;
    }
    srs.correct += 1;
    srs.reps += 1;
    if (srs.reps === 1) srs.interval = 1;
    else if (srs.reps === 2) srs.interval = 3;
    else srs.interval = clamp(Math.round(Math.max(3, srs.interval) * srs.ease), 4, 60);
    srs.ease = Math.min(2.85, srs.ease + 0.05);
    srs.due = addDays(localISO(), srs.interval);
  }

  function makeOptionEntries(correctEntry, distractors, seed) {
    const entries = uniqueBy([correctEntry, ...distractors], (entry) => entry.text).slice(0, 4);
    const shuffled = seededShuffle(entries, seed);
    return {
      options: shuffled.map((entry) => entry.text),
      notes: shuffled.map((entry) => entry.note || ''),
      answer: shuffled.findIndex((entry) => entry.correct),
    };
  }

  function shuffleExistingOptions(options, answer, seed, wrongNoteFactory = null) {
    const entries = options.map((text, index) => ({
      text,
      correct: index === answer,
      note: index === answer ? '' : (wrongNoteFactory ? wrongNoteFactory(text, index) : ''),
    }));
    const shuffled = seededShuffle(entries, seed);
    return {
      options: shuffled.map((entry) => entry.text),
      optionNotes: shuffled.map((entry) => entry.note),
      answer: shuffled.findIndex((entry) => entry.correct),
    };
  }

  function distractorPool(item) {
    const sameLevel = levelVocab(item.level).filter((candidate) => candidate.id !== item.id);
    const sameTheme = sameLevel.filter((candidate) => candidate.theme === item.theme);
    const adjacent = STUDY_ITEMS.filter((candidate) => candidate.id !== item.id && Math.abs(LEVEL_RANK[candidate.level] - LEVEL_RANK[item.level]) <= 1);
    return uniqueBy([
      ...seededShuffle(sameTheme, `${item.id}-theme`),
      ...seededShuffle(sameLevel, `${item.id}-same`),
      ...seededShuffle(adjacent, `${item.id}-adjacent`),
    ], (candidate) => candidate.id);
  }

  function makeVocabQuestion(item, seed, forcedMode = null) {
    const defaultModes = ['meaning', 'reading', 'context', 'audio'];
    const availableModes = (Array.isArray(item.availableModes) ? item.availableModes : defaultModes)
      .filter((candidate) => candidate !== 'context' || (item.example && item.exampleTh));
    const modes = availableModes.length ? availableModes : ['reading'];
    const mode = forcedMode && modes.includes(forcedMode) ? forcedMode : modes[hashString(seed) % modes.length];
    const pool = distractorPool(item).slice(0, 16);
    let optionData;
    let prompt;
    let hint;
    let speakText = '';

    if (mode === 'reading') {
      const correct = { text: item.reading, correct: true, note: `${item.word} อ่านว่า ${item.reading}` };
      const distractors = pool.slice(0, 3).map((d) => ({ text: d.reading, note: `คำอ่านนี้เป็นของ ${d.word}（${d.reading}）` }));
      optionData = makeOptionEntries(correct, distractors, `${seed}-reading`);
      prompt = `คำอ่านของ「${item.word}」คือข้อใด`;
      hint = 'แยกเสียง On/Kun เท่าที่รู้ แล้วเทียบกับคำที่คุ้น';
      speakText = item.word;
    } else if (mode === 'context') {
      const correct = { text: item.exampleTh, correct: true, note: `${item.word} = ${item.th}` };
      const distractors = pool.slice(0, 3).map((d) => ({ text: d.exampleTh, note: `ประโยคนี้เป็นความหมายของ ${d.word}` }));
      optionData = makeOptionEntries(correct, distractors, `${seed}-context`);
      prompt = `ประโยคนี้หมายความว่าอย่างไร\n「${item.example}」`;
      hint = `จับคำสำคัญ「${item.word}」และความสัมพันธ์ของ Particle`;
      speakText = item.example;
    } else {
      const correct = { text: item.th, correct: true, note: `${item.word}（${item.reading}）= ${item.th}` };
      const distractors = pool.slice(0, 3).map((d) => ({ text: d.th, note: `ความหมายนี้เป็นของ ${d.word}（${d.reading}）` }));
      optionData = makeOptionEntries(correct, distractors, `${seed}-${mode}`);
      prompt = mode === 'audio' ? 'ฟังเสียง แล้วเลือกความหมายที่ถูกต้อง' : `「${item.word}」หมายถึงอะไร`;
      hint = mode === 'audio' ? 'ฟังซ้ำได้ ก่อนเลือกคำตอบ' : `คำอ่าน: ${item.reading}`;
      speakText = mode === 'audio' ? `${item.word}。${item.word}。` : item.word;
    }

    return {
      type: 'question', level: state.profile.targetLevel, itemLevel: item.level, skill: 'vocab', subtype: mode, itemId: item.id,
      kicker: `${item.level} · ${mode === 'reading' ? 'KANJI READING' : mode === 'context' ? 'CONTEXT' : mode === 'audio' ? 'LISTEN & CHOOSE' : 'VOCABULARY'}`,
      prompt, hint, options: optionData.options, optionNotes: optionData.notes, answer: optionData.answer,
      speakText,
      explanation: `${item.word}（${item.reading}）หมายถึง “${item.th}” · ${item.tip} · ตัวอย่าง: ${item.example} (${item.exampleTh})`,
    };
  }

  function makeIntroCard(item) {
    return { type: 'intro', level: state.profile.targetLevel, itemLevel: item.level, skill: 'vocab', itemId: item.id };
  }

  function makeGrammarCard(item) {
    const optionData = shuffleExistingOptions(
      item.options, item.answer,
      `${localISO()}-${item.id}-${getLevelStats(item.level).grammar.attempts}`,
      (text) => `ตัวเลือก「${text}」ไม่ตรงกับรูปหรือความหมายที่โจทย์ต้องการ`,
    );
    return {
      type: 'question', level: item.level, skill: 'grammar', subtype: 'grammar', grammarId: item.id,
      kicker: `${item.level} · GRAMMAR`, prompt: item.question,
      hint: `${item.pattern} = ${item.th}`,
      options: optionData.options, optionNotes: optionData.optionNotes, answer: optionData.answer,
      explanation: `${item.why} · รูปประโยค: ${item.formation} · ตัวอย่าง: ${item.example} (${item.exampleTh}) · ${item.contrast}`,
    };
  }

  function makeReadingCard(item) {
    const optionData = shuffleExistingOptions(
      item.options, item.answer,
      `${localISO()}-${item.id}-${getLevelStats(item.level).reading.attempts}`,
      (text) => `บทอ่านไม่ได้สนับสนุนคำตอบ「${text}」 ให้ย้อนดูเงื่อนไข คำปฏิเสธ หรือข้อสรุปของผู้เขียน`,
    );
    return {
      type: 'question', level: item.level, skill: 'reading', subtype: 'reading', readingId: item.id,
      kicker: `${item.level} · READING`, prompt: item.question,
      hint: item.level === 'N1' || item.level === 'N2' ? 'จับข้ออ้าง เหตุผล และจุดที่ผู้เขียนเปลี่ยนมุม' : 'อ่านคำถามก่อน แล้วหาประโยคที่ตรงกัน',
      passage: item.text, title: item.title,
      options: optionData.options, optionNotes: optionData.optionNotes, answer: optionData.answer,
      explanation: item.explanation,
    };
  }

  function inferListeningType(item, dialogue) {
    const script = String(item.script || '');
    if (dialogue.speakers.length === 1 && /放送|予報|司会|ナレーター/.test(script)) return 'announcement';
    if (/何をしますか|どうしますか|まず何/.test(item.question || '')) return 'task';
    if (/どうして|なぜ|理由/.test(item.question || '')) return 'key-point';
    if (dialogue.speakers.length > 1) return 'conversation';
    return 'monologue';
  }

  function listeningTypeLabel(type) {
    return ({
      conversation: '会話', announcement: 'アナウンス', task: '課題理解',
      'key-point': 'ポイント理解', monologue: 'モノローグ',
    })[type] || 'LISTENING';
  }

  function makeListeningCard(item) {
    const optionData = shuffleExistingOptions(
      item.options, item.answer,
      `${localISO()}-${item.id}-${getLevelStats(item.level).listening.attempts}`,
      (text) => `เสียงไม่ได้สรุปว่า「${text}」 ให้ฟังจุดเปลี่ยนแผน ความเห็นสุดท้าย และคำปฏิเสธ`,
    );
    const dialogue = DIALOGUE.normalize(item);
    const questionType = item.questionType || inferListeningType(item, dialogue);
    return {
      type: 'question', level: item.level, skill: 'listening', subtype: 'listening', listeningId: item.id,
      kicker: `${item.level} · LISTENING · ${listeningTypeLabel(questionType)}`, prompt: item.question,
      hint: dialogue.speakers.length > 1
        ? `มี ${dialogue.speakers.length} ผู้พูด ระบบจะแยกเสียงและไฮไลต์ผู้พูดให้ จับข้อสรุปสุดท้ายก่อน`
        : 'รอบแรกจับสถานการณ์ เวลา และข้อสรุปสุดท้ายก่อน',
      script: item.script, title: item.title, dialogue, questionType,
      options: optionData.options, optionNotes: optionData.optionNotes, answer: optionData.answer,
      explanation: item.explanation,
      speakText: dialogue.lines.map((line) => line.text).join('。'),
    };
  }

  function mistakePriority(items, skill, level, seed) {
    const counts = new Map();
    state.mistakes.filter((m) => m.level === level && m.skill === skill).forEach((m) => {
      const id = m.itemId || m.grammarId || m.readingId || m.listeningId;
      if (id) counts.set(id, (counts.get(id) || 0) + Number(m.count || 1));
    });
    return [...items].sort((a, b) => {
      const ca = counts.get(a.id) || 0;
      const cb = counts.get(b.id) || 0;
      if (ca !== cb) return cb - ca;
      return hashString(`${seed}-${a.id}`) - hashString(`${seed}-${b.id}`);
    });
  }

  function pickItems(items, skill, count, level, seed) {
    if (!items.length || count <= 0) return [];
    const prioritized = mistakePriority(items, skill, level, seed);
    return uniqueBy(prioritized, (item) => item.id).slice(0, count);
  }

  function buildDailyLesson() {
    const level = state.profile.targetLevel;
    const adaptive = computeAdaptivePlan();
    const counts = buildPlanCounts(adaptive);
    const today = localISO();
    const cards = [];

    const due = getDueItems(level).map(({ item }) => item);
    const weak = getWeakItems(level).map(({ item }) => item);
    const newItems = getNewItems(counts.newWords, level);
    const reviewNeeded = Math.max(0, counts.vocab - newItems.length);
    const reviewItems = uniqueBy([...due, ...weak, ...buildVocabOrder(level).filter((item) => state.srs[item.id])], (item) => item.id).slice(0, reviewNeeded);

    newItems.forEach((item, index) => {
      if (!state.srs[item.id]) cards.push(makeIntroCard(item));
      cards.push(makeVocabQuestion(item, `${today}-${level}-new-${index}`, index % 2 ? 'reading' : 'meaning'));
    });
    reviewItems.forEach((item, index) => cards.push(makeVocabQuestion(item, `${today}-${level}-review-${index}`)));

    pickItems(levelGrammar(level), 'grammar', counts.grammar, level, `${today}-grammar`).forEach((item) => cards.push(makeGrammarCard(item)));
    pickItems(levelReadings(level), 'reading', counts.reading, level, `${today}-reading`).forEach((item) => cards.push(makeReadingCard(item)));
    pickItems(levelListenings(level), 'listening', counts.listening, level, `${today}-listening`).forEach((item) => cards.push(makeListeningCard(item)));

    if (!cards.length) buildVocabOrder(level).slice(0, 5).forEach((item, index) => cards.push(makeVocabQuestion(item, `${today}-fallback-${index}`)));

    return {
      id: `daily-${level}-${today}`,
      level,
      mode: 'daily',
      title: `${level} Daily Quest`,
      plannedMinutes: counts.minutes,
      cards: seededInterleave(cards, `${today}-${level}-daily-order`),
    };
  }

  function seededInterleave(cards, seed) {
    const intros = cards.filter((card) => card.type === 'intro');
    const questions = cards.filter((card) => card.type === 'question');
    const result = [];
    intros.forEach((intro) => {
      result.push(intro);
      const immediate = questions.find((q) => q.itemId === intro.itemId);
      if (immediate) result.push(immediate);
    });
    const used = new Set(result.map(cardKey));
    result.push(...seededShuffle(questions.filter((q) => !used.has(cardKey(q))), seed));
    return result;
  }

  function cardKey(card) {
    return `${card.type}-${card.level}-${card.skill}-${card.itemId || card.grammarId || card.readingId || card.listeningId || ''}-${card.subtype || ''}`;
  }

  function buildModeLesson(mode, options = {}) {
    const level = options.level || state.profile.targetLevel;
    const today = localISO();
    const cards = [];
    const adaptive = computeAdaptivePlan();

    if (mode === 'vocab') {
      const items = getNewItems(6, level);
      items.forEach((item, index) => {
        if (!state.srs[item.id]) cards.push(makeIntroCard(item));
        cards.push(makeVocabQuestion(item, `${today}-${level}-vocab-${index}`));
      });
    } else if (mode === 'review') {
      let items = getDueItems(level).map(({ item }) => item);
      if (!items.length) items = getWeakItems(level).map(({ item }) => item);
      if (!items.length) items = buildVocabOrder(level).filter((item) => state.srs[item.id]);
      if (!items.length) items = buildVocabOrder(level);
      items.slice(0, 12).forEach((item, index) => cards.push(makeVocabQuestion(item, `${today}-${level}-review-${index}`)));
    } else if (mode === 'reading') {
      pickItems(levelReadings(level), 'reading', 3, level, `${today}-reading-mode`).forEach((item) => cards.push(makeReadingCard(item)));
    } else if (mode === 'listening') {
      pickItems(levelListenings(level), 'listening', 3, level, `${today}-listening-mode`).forEach((item) => cards.push(makeListeningCard(item)));
    } else if (mode === 'grammar') {
      pickItems(levelGrammar(level), 'grammar', 6, level, `${today}-grammar-mode`).forEach((item) => cards.push(makeGrammarCard(item)));
    } else if (mode === 'theme') {
      const items = levelVocab(level).filter((item) => item.theme === options.theme);
      seededShuffle(items, `${today}-${level}-theme-${options.theme}`).slice(0, 8).forEach((item, index) => {
        if (!state.srs[item.id]) cards.push(makeIntroCard(item));
        cards.push(makeVocabQuestion(item, `${today}-${level}-theme-${index}`));
      });
    } else if (mode === 'single') {
      const item = VOCAB_BY_ID.get(options.itemId);
      if (item) {
        if (!state.srs[item.id]) cards.push(makeIntroCard(item));
        ['meaning', 'reading', 'context', 'audio'].forEach((type, index) => cards.push(makeVocabQuestion(item, `${today}-single-${index}`, type)));
      }
    } else if (mode === 'quick') {
      const topSkill = adaptive.priority;
      const vocabItems = uniqueBy([...getDueItems(level).map(({ item }) => item), ...getNewItems(2, level)], (item) => item.id).slice(0, 2);
      vocabItems.forEach((item, index) => {
        if (!state.srs[item.id]) cards.push(makeIntroCard(item));
        cards.push(makeVocabQuestion(item, `${today}-quick-v-${index}`));
      });
      if (topSkill === 'grammar') pickItems(levelGrammar(level), 'grammar', 1, level, `${today}-quick-g`).forEach((item) => cards.push(makeGrammarCard(item)));
      if (topSkill === 'reading') pickItems(levelReadings(level), 'reading', 1, level, `${today}-quick-r`).forEach((item) => cards.push(makeReadingCard(item)));
      if (topSkill === 'listening') pickItems(levelListenings(level), 'listening', 1, level, `${today}-quick-l`).forEach((item) => cards.push(makeListeningCard(item)));
      if (topSkill === 'vocab' && vocabItems.length < 3) getNewItems(3, level).slice(vocabItems.length).forEach((item, index) => cards.push(makeVocabQuestion(item, `${today}-quick-extra-${index}`)));
    } else if (mode === 'mixed') {
      const compact = buildPlanCounts(adaptive, 15);
      const due = getDueItems(level).map(({ item }) => item);
      const vocabItems = uniqueBy([...due, ...getNewItems(Math.max(2, compact.vocab), level)], (item) => item.id).slice(0, Math.max(2, compact.vocab));
      vocabItems.forEach((item, index) => {
        if (!state.srs[item.id]) cards.push(makeIntroCard(item));
        cards.push(makeVocabQuestion(item, `${today}-mixed-v-${index}`));
      });
      pickItems(levelGrammar(level), 'grammar', Math.max(1, compact.grammar), level, `${today}-mixed-g`).forEach((item) => cards.push(makeGrammarCard(item)));
      pickItems(levelReadings(level), 'reading', 1, level, `${today}-mixed-r`).forEach((item) => cards.push(makeReadingCard(item)));
      pickItems(levelListenings(level), 'listening', 1, level, `${today}-mixed-l`).forEach((item) => cards.push(makeListeningCard(item)));
    }

    return {
      id: `${mode}-${level}-${today}-${Date.now()}`,
      level,
      mode,
      title: options.title || `${level} ${mode}`,
      plannedMinutes: mode === 'quick' ? 5 : mode === 'mixed' ? 15 : 12,
      cards: seededInterleave(cards, `${today}-${mode}-${level}`),
    };
  }

  function formatElapsed(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function stopQuestionTimer() {
    if (questionTimerHandle) {
      window.clearInterval(questionTimerHandle);
      questionTimerHandle = null;
    }
    if (!activeLesson?.questionStartedAt) return 0;
    const elapsed = Math.max(0, Math.round((Date.now() - activeLesson.questionStartedAt) / 1000));
    activeLesson.questionStartedAt = null;
    return elapsed;
  }

  function startQuestionTimer() {
    stopQuestionTimer();
    if (!activeLesson) return;
    activeLesson.questionStartedAt = Date.now();
    const update = () => {
      const target = $('questionTimer');
      if (!target || !activeLesson?.questionStartedAt) return;
      target.textContent = `⏱ ${formatElapsed((Date.now() - activeLesson.questionStartedAt) / 1000)}`;
    };
    update();
    questionTimerHandle = window.setInterval(update, 1000);
  }

  function startLesson(lesson) {
    if (!lesson.cards.length) {
      showToast('ยังไม่มีรายการสำหรับโหมดนี้');
      return;
    }
    activeLesson = {
      ...lesson,
      index: 0,
      selected: null,
      answered: false,
      energy: 5,
      correct: 0,
      attempts: 0,
      xpEarned: 0,
      wrongItems: [],
      startedAt: new Date().toISOString(),
      finished: false,
      questionStartedAt: null,
      questionTimes: [],
      audioPlayCounts: {},
    };
    $('lessonOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    renderLessonCard();
  }

  function closeLesson(force = false) {
    if (!activeLesson) return;
    stopQuestionTimer();
    if (!force && activeLesson.index > 0 && !activeLesson.finished) {
      if (!window.confirm('ออกจากบทเรียนตอนนี้หรือไม่? คำตอบที่ทำไปแล้วบันทึกอัตโนมัติแล้ว')) return;
    }
    stopSpeech();
    $('lessonOverlay').classList.remove('open');
    document.body.style.overflow = '';
    activeLesson = null;
    renderAll();
  }

  function renderLessonCard() {
    stopQuestionTimer();
    stopSpeech();
    const main = $('lessonMain');
    const footer = $('lessonFooter');
    const action = $('lessonActionBtn');
    const feedback = $('feedbackPanel');
    feedback.className = 'feedback-panel';
    feedback.classList.remove('show', 'correct', 'wrong');
    activeLesson.selected = null;
    activeLesson.answered = false;

    const progress = activeLesson.cards.length ? activeLesson.index / activeLesson.cards.length : 1;
    $('lessonProgressFill').style.width = `${Math.round(progress * 100)}%`;
    $('lessonEnergy').textContent = `💚 ${activeLesson.energy}`;

    if (activeLesson.index >= activeLesson.cards.length) {
      renderLessonSummary();
      return;
    }

    const card = activeLesson.cards[activeLesson.index];
    footer.classList.remove('hidden');
    action.disabled = false;

    if (card.type === 'intro') {
      const item = VOCAB_BY_ID.get(card.itemId);
      if (!item) { activeLesson.index += 1; renderLessonCard(); return; }
      ensureSrs(item.id);
      saveState();
      const theme = CONTENT.themeLabels[item.theme] || { th: 'คำศัพท์', icon: '🧠' };
      main.innerHTML = `
        <div class="lesson-kicker">${escapeHtml(item.level)} · NEW WORD · ${escapeHtml(theme.th)}</div>
        <h2 class="lesson-question" id="lessonTitle">รู้จักคำนี้ก่อนทำโจทย์</h2>
        <article class="word-teach-card">
          <span class="theme-tag">${theme.icon} ${escapeHtml(theme.th)}</span>
          <div class="big-word">${escapeHtml(item.word)}</div>
          <div class="big-reading">${escapeHtml(item.reading)}</div>
          <div class="big-meaning">${escapeHtml(item.th)}</div>
          <div class="big-en">${escapeHtml(item.en)}</div>
          <div class="example-box"><div class="example-jp">${escapeHtml(item.example)}</div><div class="example-th">${escapeHtml(item.exampleTh)}</div></div>
          <div class="memory-tip"><span>🧷</span><span>${escapeHtml(item.tip)}</span></div>
          <button type="button" class="secondary-btn small-btn speak-btn" data-speak="${escapeAttr(item.word + '。' + item.example)}">🔊 ฟังเสียง</button>
        </article>`;
      action.textContent = 'จำแล้ว ไปต่อ';
      action.onclick = () => {
        activeLesson.xpEarned += 1;
        activeLesson.index += 1;
        renderLessonCard();
      };
      bindSpeakButtons(main);
      return;
    }

    renderQuestion(card, main);
    action.textContent = 'ตรวจคำตอบ';
    action.disabled = true;
    action.onclick = () => handleLessonAction(card);
  }

  function getListeningBaseRate(level, slow = false) {
    const setting = state.profile.listeningSpeed || 'auto';
    const preset = { slow: 0.72, normal: 0.86, exam: 1.00 }[setting];
    let rate = preset || (['N1', 'N2'].includes(level) ? 0.92 : level === 'N3' ? 0.88 : 0.84);
    if (slow) rate -= 0.14;
    return clamp(rate, 0.58, 1.12);
  }

  function renderListeningMarkup(card) {
    const dialogue = card.dialogue || DIALOGUE.normalize(card.script);
    const count = dialogue.speakers.length;
    const speakerChips = dialogue.speakers.map((speaker) => `
      <div class="speaker-chip speaker-tone-${speaker.index % 6}" data-speaker-index="${speaker.index}">
        <span class="speaker-avatar" aria-hidden="true">${escapeHtml(speaker.icon)}</span>
        <span class="speaker-chip-copy"><strong>${escapeHtml(speaker.labelTh)}</strong><small>${escapeHtml(speaker.role)}</small></span>
      </div>`).join('');
    const transcript = dialogue.lines.map((line, index) => {
      const speaker = dialogue.speakers[line.speakerIndex];
      return `<button type="button" class="transcript-line speaker-tone-${line.speakerIndex % 6}" data-dialogue-line="${index}">
        <span class="transcript-speaker"><span aria-hidden="true">${escapeHtml(speaker?.icon || '🗣️')}</span><strong>${escapeHtml(line.speaker)}</strong></span>
        <span class="transcript-text">${escapeHtml(line.text)}</span><span class="transcript-play" aria-hidden="true">🔊</span>
      </button>`;
    }).join('');
    const summary = count > 1 ? `${count} ผู้พูด · แยกเสียงอัตโนมัติ` : 'เสียงเดียว / ประกาศ';
    return `<article class="listening-card" data-listening-card="${escapeAttr(card.listeningId || cardKey(card))}">
      <div class="speaker-stage" aria-label="ผู้พูดในบทสนทนา">${speakerChips}</div>
      <button type="button" class="audio-orb" data-dialogue-play aria-label="เล่นบทสนทนาทั้งหมด">▶</button>
      <div class="audio-status" data-dialogue-status aria-live="polite">${escapeHtml(summary)} · แตะเพื่อฟัง</div>
      <div class="audio-tools">
        <button type="button" class="audio-tool" data-dialogue-slow>🐢 ฟังช้า</button>
        <button type="button" class="audio-tool" data-dialogue-stop>■ หยุด</button>
      </div>
      <div class="voice-fallback-note">ถ้า iPhone มีเสียงญี่ปุ่นหลายเสียง ระบบจะเลือกคนละเสียง หากมีเสียงเดียว ระบบจะแยกด้วยระดับเสียงและความเร็ว</div>
      <div class="script-reveal hidden" id="currentScript"><div class="script-heading"><strong>Script แยกผู้พูด</strong><small>แตะแต่ละบรรทัดเพื่อฟังซ้ำ</small></div>${transcript}</div>
    </article>`;
  }

  function incrementListeningPlay(card) {
    if (!activeLesson) return 0;
    const key = cardKey(card);
    activeLesson.audioPlayCounts[key] = Number(activeLesson.audioPlayCounts[key] || 0) + 1;
    return activeLesson.audioPlayCounts[key];
  }

  function listeningPlayCount(card) {
    return Number(activeLesson?.audioPlayCounts?.[cardKey(card)] || 0);
  }

  function bindListeningControls(root, card) {
    const dialogue = card.dialogue || DIALOGUE.normalize(card.script);
    const playButton = root.querySelector('[data-dialogue-play]');
    const slowButton = root.querySelector('[data-dialogue-slow]');
    const stopButton = root.querySelector('[data-dialogue-stop]');
    const statusNode = root.querySelector('[data-dialogue-status]');
    const speakerNodes = Array.from(root.querySelectorAll('[data-speaker-index]'));
    const transcriptNodes = Array.from(root.querySelectorAll('[data-dialogue-line]'));

    const resetUi = (message = null) => {
      playButton?.classList.remove('playing');
      if (playButton) playButton.textContent = '▶';
      speakerNodes.forEach((node) => node.classList.remove('active'));
      transcriptNodes.forEach((node) => node.classList.remove('speaking'));
      if (message && statusNode) statusNode.textContent = message;
      if (activeSpeechUi === resetUi) activeSpeechUi = null;
    };

    const highlightLine = (line, lineIndex) => {
      speakerNodes.forEach((node) => node.classList.toggle('active', Number(node.dataset.speakerIndex) === line.speakerIndex));
      transcriptNodes.forEach((node) => node.classList.toggle('speaking', Number(node.dataset.dialogueLine) === lineIndex));
      if (statusNode) statusNode.textContent = `กำลังพูด: ${dialogue.speakers[line.speakerIndex]?.labelTh || line.speaker} · บรรทัด ${lineIndex + 1}/${dialogue.lines.length}`;
    };

    const play = (slow = false) => {
      if (!state.profile.sound) { showToast('เปิดเสียงอ่านได้ที่โปรไฟล์'); return; }
      stopSpeech();
      incrementListeningPlay(card);
      activeSpeechUi = resetUi;
      if (playButton) { playButton.classList.add('playing'); playButton.textContent = '■'; }
      if (statusNode) statusNode.textContent = slow ? 'กำลังเริ่มโหมดช้า…' : 'กำลังเริ่มบทสนทนา…';
      DIALOGUE.play(dialogue, {
        multiVoice: state.profile.multiVoice !== false,
        baseRate: getListeningBaseRate(card.level, slow),
        pauseMs: slow ? 340 : 210,
        onLineStart: highlightLine,
        onEnd: () => resetUi(`ฟังจบแล้ว · เล่นไป ${listeningPlayCount(card)} รอบ`),
        onUnsupported: () => { resetUi('อุปกรณ์นี้ไม่รองรับเสียงอ่านอัตโนมัติ'); showToast('อุปกรณ์นี้ไม่รองรับเสียงอ่านอัตโนมัติ'); },
      }).catch((error) => {
        console.warn('Dialogue playback failed:', error);
        resetUi('เล่นเสียงไม่สำเร็จ กรุณาทดลองอีกครั้ง');
      });
    };

    if (playButton) playButton.onclick = () => playButton.classList.contains('playing') ? stopSpeech() : play(false);
    if (slowButton) slowButton.onclick = () => play(true);
    if (stopButton) stopButton.onclick = () => { stopSpeech(); if (statusNode) statusNode.textContent = 'หยุดแล้ว · แตะ ▶ เพื่อเริ่มใหม่'; };
    transcriptNodes.forEach((button) => {
      button.onclick = () => {
        if (!state.profile.sound) { showToast('เปิดเสียงอ่านได้ที่โปรไฟล์'); return; }
        const lineIndex = Number(button.dataset.dialogueLine);
        stopSpeech();
        activeSpeechUi = resetUi;
        DIALOGUE.playLine(dialogue, lineIndex, {
          multiVoice: state.profile.multiVoice !== false,
          baseRate: getListeningBaseRate(card.level, false),
          onLineStart: highlightLine,
          onEnd: () => resetUi('ฟังบรรทัดนี้จบแล้ว'),
          onUnsupported: () => resetUi('อุปกรณ์นี้ไม่รองรับเสียงอ่านอัตโนมัติ'),
        }).catch(() => resetUi('เล่นเสียงไม่สำเร็จ'));
      };
    });
  }

  function renderQuestion(card, main) {
    let body = `<div class="lesson-question-top"><div class="lesson-kicker">${escapeHtml(card.kicker)}</div><div class="question-timer" id="questionTimer">⏱ 00:00</div></div><h2 class="lesson-question" id="lessonTitle">${escapeHtml(card.prompt).replace(/\n/g, '<br>')}</h2>`;
    if (card.hint) body += `<p class="lesson-hint">${escapeHtml(card.hint)}</p>`;

    if (card.subtype === 'reading') {
      body += `<article class="passage-card"><h3 class="passage-title">${escapeHtml(card.title)}</h3><p class="passage-text">${escapeHtml(card.passage)}</p></article>`;
    }

    if (card.subtype === 'listening') {
      body += renderListeningMarkup(card);
    } else if (card.subtype === 'audio') {
      body += `<article class="listening-card"><button type="button" class="audio-orb" data-speak="${escapeAttr(card.speakText)}" aria-label="เล่นเสียงคำศัพท์">🔊</button><div class="audio-status">แตะฟังคำศัพท์ แล้วเลือกความหมาย</div></article>`;
    } else if (card.speakText) {
      body += `<button type="button" class="ghost-btn small-btn" data-speak="${escapeAttr(card.speakText)}">🔊 ฟังคำ/ประโยค</button><div style="height:12px"></div>`;
    }

    body += '<div class="options">';
    card.options.forEach((option, index) => {
      body += `<button type="button" class="option-btn" data-option-index="${index}"><span class="option-label">${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`;
    });
    body += '</div>';
    main.innerHTML = body;

    $$('[data-option-index]', main).forEach((button) => {
      button.addEventListener('click', () => {
        if (activeLesson.answered) return;
        $$('[data-option-index]', main).forEach((b) => b.classList.remove('selected'));
        button.classList.add('selected');
        activeLesson.selected = Number(button.dataset.optionIndex);
        $('lessonActionBtn').disabled = false;
      });
    });
    bindSpeakButtons(main);
    if (card.subtype === 'listening') bindListeningControls(main, card);
    startQuestionTimer();
    if (card.subtype === 'audio' && state.profile.sound) window.setTimeout(() => speakJapanese(card.speakText), 350);
  }

  function handleLessonAction(card) {
    if (!activeLesson.answered) { gradeCurrentQuestion(card); return; }
    activeLesson.index += 1;
    renderLessonCard();
  }

  function gradeCurrentQuestion(card) {
    const selected = activeLesson.selected;
    if (selected == null) return;
    const elapsedSeconds = stopQuestionTimer();
    if (elapsedSeconds) activeLesson.questionTimes.push(elapsedSeconds);
    const correct = selected === card.answer;
    activeLesson.answered = true;
    activeLesson.attempts += 1;
    if (correct) activeLesson.correct += 1;
    else activeLesson.energy = Math.max(1, activeLesson.energy - 1);

    const stat = getLevelStats(card.level || state.profile.targetLevel)[card.skill];
    stat.attempts += 1;
    if (correct) stat.correct += 1;
    stat.totalSeconds = Number(stat.totalSeconds || 0) + elapsedSeconds;
    if (card.skill === 'vocab' && card.itemId) updateSrs(card.itemId, correct);

    const earned = correct ? 10 : 2;
    activeLesson.xpEarned += earned;
    state.xp += earned;

    const optionButtons = $$('[data-option-index]', $('lessonMain'));
    optionButtons.forEach((button, index) => {
      button.disabled = true;
      button.classList.remove('selected');
      if (index === card.answer) button.classList.add('correct');
      else if (index === selected) button.classList.add('wrong');
    });

    if (card.subtype === 'listening') {
      stopSpeech();
      $('currentScript')?.classList.remove('hidden');
    }

    let explanation = card.explanation;
    if (!correct && card.optionNotes?.[selected]) explanation = `${card.optionNotes[selected]} · ${explanation}`;
    if (card.subtype === 'listening') {
      const plays = listeningPlayCount(card);
      explanation = `${explanation} · ฟัง ${plays} รอบ${card.dialogue?.speakers?.length > 1 ? ` · ${card.dialogue.speakers.length} ผู้พูด` : ''}`;
    }
    if (elapsedSeconds) explanation = `${explanation} · ใช้เวลา ${formatElapsed(elapsedSeconds)}`;
    showFeedback(correct, explanation);
    $('lessonActionBtn').textContent = activeLesson.index === activeLesson.cards.length - 1 ? 'ดูสรุป' : 'ไปต่อ';
    $('lessonActionBtn').disabled = false;
    $('lessonEnergy').textContent = `💚 ${activeLesson.energy}`;

    if (!correct) recordMistake(card, selected);
    saveState();
  }

  function recordMistake(card, selected) {
    const contentId = card.itemId || card.grammarId || card.readingId || card.listeningId || cardKey(card);
    const key = `${card.level}:${card.skill}:${contentId}`;
    const existing = state.mistakes.find((m) => m.key === key);
    const record = {
      key,
      level: card.level || state.profile.targetLevel,
      skill: card.skill,
      itemId: card.itemId || null,
      grammarId: card.grammarId || null,
      readingId: card.readingId || null,
      listeningId: card.listeningId || null,
      prompt: card.prompt,
      selected: card.options[selected] || '',
      correct: card.options[card.answer] || '',
      explanation: card.optionNotes?.[selected] ? `${card.optionNotes[selected]} · ${card.explanation}` : card.explanation,
      audioPlays: card.skill === 'listening' ? listeningPlayCount(card) : null,
      speakerCount: card.skill === 'listening' ? Number(card.dialogue?.speakers?.length || 1) : null,
      questionType: card.skill === 'listening' ? (card.questionType || 'listening') : null,
      date: localISO(),
      count: (existing?.count || 0) + 1,
    };
    if (existing) Object.assign(existing, record);
    else state.mistakes.unshift(record);
    state.mistakes = state.mistakes.sort((a, b) => b.date.localeCompare(a.date) || b.count - a.count).slice(0, 240);
    activeLesson.wrongItems.push(record);
  }

  function showFeedback(correct, text) {
    const panel = $('feedbackPanel');
    panel.className = `feedback-panel show ${correct ? 'correct' : 'wrong'}`;
    $('feedbackTitle').textContent = correct ? '✅ ถูกต้อง เก่งมาก!' : '🧠 ยังไม่ใช่ แต่ระบบจำข้อนี้แล้ว';
    $('feedbackText').textContent = text;
  }

  function renderLessonSummary() {
    stopQuestionTimer();
    stopSpeech();
    if (!activeLesson.finished) completeLesson();
    $('lessonProgressFill').style.width = '100%';
    const lessonAccuracy = activeLesson.attempts ? Math.round(activeLesson.correct / activeLesson.attempts * 100) : 100;
    const weakText = activeLesson.wrongItems.length
      ? activeLesson.wrongItems.slice(0, 3).map((m) => {
        if (m.itemId) return VOCAB_BY_ID.get(m.itemId)?.word;
        return SKILL_LABELS[m.skill]?.short;
      }).filter(Boolean).join('、')
      : 'ไม่มีข้อผิดในรอบนี้';
    $('lessonMain').innerHTML = `
      <section class="lesson-summary">
        <div class="summary-mascot" data-mascot="celebrate"></div>
        <h2 id="lessonTitle">จบรอบ ${escapeHtml(activeLesson.level)} แล้ว!</h2>
        <p>${lessonAccuracy >= 80 ? 'ทำได้ดีมาก แผนวันถัดไปจะค่อย ๆ เพิ่มความท้าทาย' : 'ข้อผิดถูกบันทึกแล้ว ระบบจะเพิ่มน้ำหนักและนำกลับมาฝึกอีก'}</p>
        <div class="reward-grid">
          <div class="reward-card"><strong>+${activeLesson.xpEarned}</strong><span>XP รอบนี้</span></div>
          <div class="reward-card"><strong>${lessonAccuracy}%</strong><span>ความแม่นยำ</span></div>
          <div class="reward-card"><strong>${state.streak}</strong><span>วันต่อเนื่อง</span></div>
        </div>
        <div class="weak-review"><h3>🔁 Adaptive Update</h3><p>${escapeHtml(weakText)}${activeLesson.wrongItems.length ? ' จะถูกนำกลับมาถามเร็วขึ้น และมีผลต่อน้ำหนักแผน' : ' — รักษาระดับต่อไป ระบบจะเลือกเนื้อหาใหม่ให้'}</p></div>
      </section>`;
    injectMascots($('lessonMain'));
    $('feedbackPanel').className = 'feedback-panel';
    $('lessonActionBtn').textContent = 'กลับหน้าหลัก';
    $('lessonActionBtn').disabled = false;
    $('lessonActionBtn').onclick = () => closeLesson(true);
    launchConfetti();
  }

  function completeLesson() {
    activeLesson.finished = true;
    const today = localISO();
    const bonus = 20;
    activeLesson.xpEarned += bonus;
    state.xp += bonus;

    if (state.lastStudyDate !== today) {
      const yesterday = addDays(today, -1);
      state.streak = state.lastStudyDate === yesterday ? state.streak + 1 : 1;
      state.lastStudyDate = today;
    }
    state.completedDates[today] = (state.completedDates[today] || 0) + 1;
    state.lessonHistory.unshift({
      id: activeLesson.id, level: activeLesson.level, date: today, mode: activeLesson.mode,
      correct: activeLesson.correct, attempts: activeLesson.attempts, xp: activeLesson.xpEarned,
      durationEstimate: activeLesson.plannedMinutes,
    });
    state.lessonHistory = state.lessonHistory.slice(0, 730);
    saveState();
  }

  function mascotSVG(variant = 'icon', badgeOverride = null) {
    const wave = variant === 'wave';
    const celebrate = variant === 'celebrate';
    const badge = escapeHtml(badgeOverride || state.profile.targetLevel || 'JP');
    return `
      <svg viewBox="0 0 180 180" role="img" aria-label="มาสคอต JLPT Coach">
        <defs>
          <linearGradient id="mBody-${variant}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#62d7bd"/><stop offset="1" stop-color="#2aa88f"/></linearGradient>
          <linearGradient id="mBg-${variant}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5faf4"/><stop offset="1" stop-color="#eeeaff"/></linearGradient>
        </defs>
        <rect width="180" height="180" rx="42" fill="url(#mBg-${variant})"/>
        ${celebrate ? '<path d="M28 32l7 12 13 2-10 9 3 13-13-7-12 7 3-13-10-9 13-2z" fill="#ffbf47"/><path d="M145 20l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#7d6fe8"/>' : ''}
        <ellipse cx="90" cy="145" rx="50" ry="10" fill="#1d6e61" opacity=".15"/>
        <path d="M47 78c0-37 19-58 43-58s43 21 43 58v42c0 25-18 41-43 41s-43-16-43-41z" fill="url(#mBody-${variant})"/>
        <path d="M53 63C41 51 42 35 55 29c9 9 14 19 14 30z" fill="#36b39a"/><path d="M127 63c12-12 11-28-2-34-9 9-14 19-14 30z" fill="#36b39a"/>
        <ellipse cx="72" cy="82" rx="18" ry="21" fill="#fff"/><ellipse cx="108" cy="82" rx="18" ry="21" fill="#fff"/>
        <circle cx="75" cy="85" r="8" fill="#173a33"/><circle cx="105" cy="85" r="8" fill="#173a33"/><circle cx="78" cy="81" r="2.7" fill="#fff"/><circle cx="108" cy="81" r="2.7" fill="#fff"/>
        <ellipse cx="58" cy="102" rx="9" ry="5" fill="#ff8d91" opacity=".72"/><ellipse cx="122" cy="102" rx="9" ry="5" fill="#ff8d91" opacity=".72"/><path d="M82 101c5 4 11 4 16 0-1 9-15 9-16 0z" fill="#173a33"/>
        <path d="M67 121c13 7 33 7 46 0v25c-13 7-33 7-46 0z" fill="#fff" opacity=".96"/>
        <text x="90" y="141" text-anchor="middle" font-size="18" font-weight="900" font-family="Arial, sans-serif" fill="#7d6fe8">${badge}</text>
        <path d="M51 106c-13 5-20 16-18 28 8-7 15-10 23-9" fill="none" stroke="#2aa88f" stroke-width="14" stroke-linecap="round"/>
        <g transform="${wave ? 'rotate(-24 127 105)' : celebrate ? 'rotate(24 127 105)' : 'rotate(5 127 105)'}"><path d="M129 106c14 4 23 14 24 27-9-6-17-8-26-6" fill="none" stroke="#2aa88f" stroke-width="14" stroke-linecap="round"/></g>
        ${wave ? '<path d="M154 85c7-6 11-13 10-21M160 96c8-2 14-7 18-13" fill="none" stroke="#ffbf47" stroke-width="4" stroke-linecap="round"/>' : ''}
      </svg>`;
  }

  function injectMascots(root = document) {
    $$('[data-mascot]', root).forEach((node) => { node.innerHTML = mascotSVG(node.dataset.mascot || 'icon'); });
  }

  function refreshOnboardingMascot(level) {
    const node = $('onboarding')?.querySelector('[data-mascot="celebrate"]');
    if (node) node.innerHTML = mascotSVG('celebrate', level);
  }

  function bindSpeakButtons(root = document) {
    $$('[data-speak]', root).forEach((button) => {
      button.onclick = () => speakJapanese(button.dataset.speak || '');
    });
  }

  function renderVoiceStatus() {
    if (!$('voiceStatus')) return;
    const info = DIALOGUE.status();
    if (!info.supported) {
      $('voiceStatus').textContent = 'อุปกรณ์นี้ไม่รองรับ Web Speech';
      if ($('voiceTestBtn')) $('voiceTestBtn').disabled = true;
      return;
    }
    if ($('voiceTestBtn')) $('voiceTestBtn').disabled = false;
    if (!info.count) $('voiceStatus').textContent = 'กำลังโหลดเสียงญี่ปุ่น · หากยังไม่พบ ระบบจะใช้เสียงเริ่มต้นของ iPhone';
    else if (info.hasMultiple) $('voiceStatus').textContent = `พบเสียงญี่ปุ่น ${info.count} เสียง · ระบบเลือกคนละเสียงให้ผู้พูดก่อน`;
    else $('voiceStatus').textContent = 'พบเสียงญี่ปุ่น 1 เสียง · ระบบจะแยกผู้พูดด้วย Pitch และความเร็ว';
    if ($('multiVoiceDesc')) $('multiVoiceDesc').textContent = state.profile.multiVoice !== false
      ? 'เปิด: คนละเสียงเมื่อมี และใช้ Pitch/Rate เป็นตัวสำรอง'
      : 'ปิด: ใช้เสียงเดียวตลอดบทสนทนา';
  }

  function refreshVoices() {
    DIALOGUE.refreshVoices();
    renderVoiceStatus();
  }

  function speakJapanese(text) {
    if (!state.profile.sound) { showToast('เปิดเสียงอ่านได้ที่โปรไฟล์'); return; }
    const info = DIALOGUE.status();
    if (!info.supported) { showToast('อุปกรณ์นี้ไม่รองรับเสียงอ่านอัตโนมัติ'); return; }
    stopSpeech();
    DIALOGUE.speakText(text, {
      baseRate: getListeningBaseRate(state.profile.targetLevel, false),
      onUnsupported: () => showToast('อุปกรณ์นี้ไม่รองรับเสียงอ่านอัตโนมัติ'),
    }).catch((error) => console.warn('Speech playback failed:', error));
  }

  function testDialogueVoices() {
    if (!state.profile.sound) { showToast('กรุณาเปิดเสียงอ่านภาษาญี่ปุ่นก่อน'); return; }
    const sample = DIALOGUE.normalize([
      { speaker: '女', text: 'こんにちは。今日の勉強を始めましょう。' },
      { speaker: '男', text: 'はい。まず、会話を聞きます。' },
    ]);
    stopSpeech();
    const statusNode = $('voiceStatus');
    DIALOGUE.play(sample, {
      multiVoice: state.profile.multiVoice !== false,
      baseRate: getListeningBaseRate(state.profile.targetLevel, false),
      pauseMs: 260,
      onLineStart: (line) => { if (statusNode) statusNode.textContent = `ทดสอบเสียง: ${sample.speakers[line.speakerIndex]?.labelTh || line.speaker}`; },
      onEnd: () => { renderVoiceStatus(); showToast('ทดสอบเสียงสนทนาเสร็จแล้ว'); },
      onUnsupported: () => { renderVoiceStatus(); showToast('อุปกรณ์นี้ไม่รองรับเสียงอ่านอัตโนมัติ'); },
    }).catch(() => { renderVoiceStatus(); showToast('ทดสอบเสียงไม่สำเร็จ'); });
  }

  function stopSpeech() {
    DIALOGUE.stop();
    if (activeSpeechUi) {
      const cleanup = activeSpeechUi;
      activeSpeechUi = null;
      cleanup('หยุดแล้ว · แตะ ▶ เพื่อเริ่มใหม่');
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/\n/g, ' ');
  }

  function learnedCount(level = state.profile.targetLevel) {
    return Object.keys(state.srs).filter((id) => isWithinTargetLevel(VOCAB_BY_ID.get(id)?.level, level)).length;
  }

  function masteredCount(level = state.profile.targetLevel) {
    return Object.entries(state.srs).filter(([id, srs]) => {
      const item = VOCAB_BY_ID.get(id);
      return isWithinTargetLevel(item?.level, level)
        && Number(srs.interval || 0) >= 7
        && Number(srs.attempts || 0) >= 2
        && Number(srs.correct || 0) / Number(srs.attempts || 1) >= 0.75;
    }).length;
  }

  function skillAttemptTotal(level = state.profile.targetLevel) {
    return Object.values(getLevelStats(level)).reduce((sum, stat) => sum + Number(stat.attempts || 0), 0);
  }

  function latestScoreSource(level = state.profile.targetLevel) {
    const mock = latestMock(level);
    const result = latestExamResult(level);
    if (!mock) return result ? { ...result, sourceType: 'ผลสอบจริง' } : null;
    if (!result) return { ...mock, sourceType: 'Mock Test' };
    return String(mock.date || '').localeCompare(String(result.date || '')) >= 0
      ? { ...mock, sourceType: 'Mock Test' }
      : { ...result, sourceType: 'ผลสอบจริง' };
  }

  function projectedScore(level = state.profile.targetLevel) {
    const source = latestScoreSource(level);
    const stats = getLevelStats(level);
    const attempts = skillAttemptTotal(level);
    const learned = learnedCount(level);
    const mastered = masteredCount(level);
    const studyDays = Object.keys(state.completedDates).length;
    const weightedPractice = Object.keys(SKILL_LABELS).reduce((sum, skill) => {
      const stat = stats[skill];
      const rate = stat.attempts ? stat.correct / stat.attempts : 0.55;
      return sum + rate * 0.25;
    }, 0);

    if (!source) {
      if (attempts < 20) return null;
      const reliability = clamp(attempts / 140, 0.25, 0.78);
      const raw = weightedPractice * 180;
      return clamp(Math.round(raw * reliability + 90 * (1 - reliability)), 0, 180);
    }

    const base = resultTotal(source);
    const practiceLift = Math.min(10, learned * 0.035)
      + Math.min(7, mastered * 0.065)
      + Math.min(5, studyDays * 0.08)
      + Math.max(-3, (weightedPractice - 0.55) * 12);
    const confidence = clamp(attempts / 100, 0, 0.45);
    const estimate = base + practiceLift * confidence;
    return clamp(Math.round(estimate), 0, 180);
  }

  function readiness(level = state.profile.targetLevel) {
    const config = getConfig(level);
    const source = latestScoreSource(level);
    const projection = projectedScore(level);
    const attempts = skillAttemptTotal(level);
    if (!source && attempts < 20) {
      return {
        id: 'diagnostic', label: 'Diagnostic', icon: '🧭',
        headline: 'กำลังสร้างฐานข้อมูลส่วนตัว',
        description: 'ทำแบบฝึกอย่างน้อยประมาณ 20 ข้อ หรือเพิ่มผลสอบ/Mock Test เพื่อให้การประเมินนิ่งขึ้น',
        projection,
      };
    }

    const total = projection ?? resultTotal(source);
    const sectionSource = source;
    const failedSections = sectionSource
      ? config.sections.filter((section) => Number(sectionSource.sections?.[section.key] || 0) < section.pass)
      : [];
    const nearSections = sectionSource
      ? config.sections.filter((section) => {
        const score = Number(sectionSource.sections?.[section.key] || 0);
        return score >= section.pass && score < section.pass + 5;
      })
      : [];

    if (failedSections.length) {
      return {
        id: 'risk', label: 'Section Risk', icon: '⚠️',
        headline: `ต้องซ่อม ${failedSections.map((section) => section.labelTh).join(' / ')}`,
        description: 'แม้คะแนนรวมดีขึ้น แต่ JLPT ยังต้องผ่านคะแนนขั้นต่ำของทุก Section',
        projection: total,
      };
    }
    if (total < config.overallPass - 15) {
      return { id: 'developing', label: 'Developing', icon: '🌱', headline: 'กำลังสร้างคะแนนฐาน', description: `ยังห่างเส้นผ่านประมาณ ${config.overallPass - total} คะแนน ให้เน้นทักษะ Priority ต่อเนื่อง`, projection: total };
    }
    if (total < config.overallPass) {
      return { id: 'near', label: 'Near Passing', icon: '🛠️', headline: `เหลือประมาณ ${config.overallPass - total} คะแนนถึงเส้นผ่าน`, description: nearSections.length ? 'บาง Section ยังอยู่ใกล้เกณฑ์ขั้นต่ำ ควรเพิ่ม Safety Margin' : 'ใกล้ผ่านแล้ว แต่ยังต้องทำคะแนนให้เสถียร', projection: total };
    }
    if (total < config.safetyTarget || nearSections.length) {
      return { id: 'near-ready', label: 'Near Ready', icon: '🎯', headline: 'แตะเส้นผ่านแล้ว กำลังสร้าง Safety Margin', description: nearSections.length ? 'คะแนนรวมผ่าน แต่ยังมี Section ใกล้ขั้นต่ำ จึงควรซ้อมให้สูงกว่านี้' : `เป้าหมายซ้อมที่แนะนำคือประมาณ ${config.safetyTarget}/180`, projection: total };
    }
    if (total < config.safetyTarget + 15) {
      return { id: 'ready', label: 'Exam Ready', icon: '✅', headline: 'คะแนนซ้อมอยู่ในช่วงพร้อมสอบ', description: 'รักษาความเสถียรด้วย Mock Test และทบทวน Mistake Log ต่อไป', projection: total };
    }
    return { id: 'strong', label: 'Strong', icon: '🏆', headline: 'มี Safety Margin ที่ดี', description: 'ลดการเปิดเนื้อหาใหม่ช่วงท้าย และรักษาความเร็วกับความแม่นยำ', projection: total };
  }

  function renderAll() {
    applyTheme();
    injectMascots();
    renderTopbar();
    renderHome();
    renderLearn();
    renderReview();
    renderProgress();
    renderProfile();
    renderSettings();
    updateNotificationStatus();
  }

  function renderTopbar() {
    const phase = getPhase();
    const days = Math.max(0, daysBetween(localISO(), state.profile.examDate));
    $('topLevel').textContent = state.profile.targetLevel;
    $('topStreak').textContent = state.streak;
    $('topXp').textContent = state.xp;
    $('topbarSubtitle').textContent = `${phase.name} · ${days} วันถึงสอบ`;
  }

  function weightBarsHtml(weights, compact = false) {
    return Object.keys(SKILL_LABELS).map((skill) => `
      <div class="weight-row ${compact ? 'compact' : ''}">
        <span class="weight-name">${SKILL_LABELS[skill].icon} ${escapeHtml(SKILL_LABELS[skill].th)}</span>
        <div class="weight-track"><i style="width:${weights[skill]}%"></i></div>
        <b>${weights[skill]}%</b>
      </div>`).join('');
  }

  function renderHome() {
    const today = localISO();
    const adaptive = computeAdaptivePlan();
    const counts = buildPlanCounts(adaptive);
    const ready = readiness(adaptive.level);
    const source = latestScoreSource(adaptive.level);
    const completed = Boolean(state.completedDates[today]);
    const left = Math.max(0, daysBetween(today, state.profile.examDate));

    $('heroEyebrow').textContent = `🎯 เป้าหมายส่วนตัว · JLPT ${adaptive.level}`;
    $('heroCopy').textContent = state.profile.name
      ? `${state.profile.name} ระบบกำลังให้น้ำหนักกับ ${SKILL_LABELS[adaptive.priority].th} มากที่สุด โดยปรับจากคะแนนและคำตอบล่าสุด`
      : `ระบบกำลังให้น้ำหนักกับ ${SKILL_LABELS[adaptive.priority].th} มากที่สุด โดยปรับจากคะแนนและคำตอบล่าสุด`;
    $('daysLeft').textContent = left;
    $('todayDateLabel').textContent = formatThaiDate(today, { weekday: 'long', day: 'numeric', month: 'short' });
    $('phaseChip').textContent = adaptive.phase.short;
    $('dailyPlanTitle').textContent = `${adaptive.phase.name} · ${counts.minutes} นาที`;
    $('dailyPlanSubtitle').textContent = `${adaptive.phase.description} · ${getDueItems(adaptive.level).length} คำถึงกำหนดทบทวน`;
    $('startDailyBtn').textContent = completed ? 'ฝึกเพิ่มอีกหนึ่งรอบ' : 'เริ่มบทเรียนวันนี้';

    const quests = [];
    if (counts.newWords > 0) quests.push({ icon: '🌱', name: `ศัพท์ใหม่ ${counts.newWords} คำ`, desc: 'คำอ่าน ความหมาย บริบท และเสียงอ่าน', minutes: Math.max(3, Math.round(counts.minutes * adaptive.weights.vocab / 100 * 0.55)) });
    if (counts.reviews > 0 || getDueItems(adaptive.level).length) quests.push({ icon: '🔁', name: `Smart Review ${Math.max(counts.reviews, Math.min(8, getDueItems(adaptive.level).length))} คำ`, desc: 'คำถึงกำหนดและคำที่เคยผิดจะมาก่อน', minutes: Math.max(3, Math.round(counts.minutes * adaptive.weights.vocab / 100 * 0.45)) });
    if (counts.grammar > 0) quests.push({ icon: '🧩', name: `Grammar ${counts.grammar} ข้อ`, desc: adaptive.weights.grammar <= 15 ? 'Maintenance สำหรับจุดแข็ง' : 'ซ่อม Pattern และตัวเลือกที่สับสน', minutes: Math.max(2, Math.round(counts.minutes * adaptive.weights.grammar / 100)) });
    if (counts.reading > 0) quests.push({ icon: '📖', name: `Reading ${counts.reading} ชุด`, desc: 'จับคำถามหลัก เงื่อนไข และเวลาที่ใช้', minutes: Math.max(3, Math.round(counts.minutes * adaptive.weights.reading / 100)) });
    if (counts.listening > 0) quests.push({ icon: '🎧', name: `Listening ${counts.listening} ชุด`, desc: 'ฟังก่อนดู Script แล้ววิเคราะห์จุดที่พลาด', minutes: Math.max(3, Math.round(counts.minutes * adaptive.weights.listening / 100)) });
    $('dailyQuestList').innerHTML = quests.map((quest) => `<div class="quest-item"><div class="quest-icon">${quest.icon}</div><div><div class="quest-name">${escapeHtml(quest.name)}</div><div class="quest-desc">${escapeHtml(quest.desc)}</div></div><div class="quest-minutes">~${quest.minutes} นาที</div></div>`).join('');

    $('priorityOrb').textContent = SKILL_LABELS[adaptive.priority].icon;
    $('priorityTitle').textContent = SKILL_LABELS[adaptive.priority].th;
    $('priorityReason').textContent = adaptive.priorityReason;
    $('homeWeightList').innerHTML = weightBarsHtml(adaptive.weights, true);

    const projection = ready.projection;
    $('projectedScore').textContent = projection == null ? '—' : projection;
    $('scoreRingCaption').textContent = projection == null ? 'รอข้อมูลเพิ่ม' : '/ 180';
    $('scoreRing').style.setProperty('--p', `${projection == null ? 0 : clamp(projection / 180 * 100, 0, 100)}%`);
    $('readinessChip').textContent = `${ready.icon} ${ready.label}`;
    $('readinessChip').className = `readiness-chip ${ready.id === 'risk' ? 'risk' : ['near','developing','near-ready'].includes(ready.id) ? 'near' : ['ready','strong'].includes(ready.id) ? 'ready' : ''}`;
    $('scoreHeadline').textContent = ready.headline;
    $('scoreDescription').textContent = ready.description;
    $('scoreTargetLabel').textContent = `ผ่าน ${adaptive.config.overallPass} · เป้าซ้อม ${adaptive.config.safetyTarget}+`;

    if (!source) {
      $('sectionRiskList').innerHTML = '<div class="section-risk-item"><span>📊 เพิ่มคะแนนสอบหรือ Mock Test เพื่อวิเคราะห์ Section minimum</span><strong>รอข้อมูล</strong></div>';
    } else {
      $('sectionRiskList').innerHTML = adaptive.config.sections.map((section) => {
        const score = Number(source.sections?.[section.key] || 0);
        const margin = score - section.pass;
        const status = score < section.pass ? 'danger' : margin < 5 ? 'warning' : 'safe';
        const label = score < section.pass ? `ต่ำกว่าเกณฑ์ ${Math.abs(margin)}` : margin < 5 ? `เหนือเกณฑ์ ${margin}` : `ผ่าน +${margin}`;
        return `<div class="section-risk-item ${status === 'safe' ? 'ok' : 'risk'}"><span>${status === 'safe' ? '✅' : status === 'warning' ? '⚠️' : '❗'} ${escapeHtml(section.labelTh)} · ${score}/${section.max}</span><strong>${label}</strong></div>`;
      }).join('');
    }

    renderWeekStrip();
    const insight = INSIGHTS[hashString(`${today}-${adaptive.level}`) % INSIGHTS.length];
    $('insightIcon').textContent = insight[0];
    $('insightTitle').textContent = insight[1];
    $('insightText').textContent = insight[2];
  }

  function renderWeekStrip() {
    const todayDate = parseLocalDate(localISO());
    const day = todayDate.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + mondayOffset);
    const days = [];
    let doneCount = 0;
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const iso = localISO(date);
      const done = Boolean(state.completedDates[iso]);
      if (done) doneCount += 1;
      days.push(`<div class="day-dot ${done ? 'done' : ''} ${iso === localISO() ? 'today' : ''}"><span>${new Intl.DateTimeFormat('th-TH', { weekday: 'narrow' }).format(date)}</span><span class="dot">${done ? '✓' : date.getDate()}</span></div>`);
    }
    $('weekStrip').innerHTML = days.join('');
    $('weekGoalLabel').textContent = `${doneCount}/5 วันเป้าหมาย`;
  }

  function renderLearn() {
    const level = state.profile.targetLevel;
    $('learnLevelNote').textContent = `คลังระดับ ${level}`;
    $('learnedCount').textContent = learnedCount(level);
    $('dueCount').textContent = getDueItems(level).length;
    const vocabAccuracy = accuracy('vocab', level);
    $('accuracyCount').textContent = vocabAccuracy == null ? '—' : `${vocabAccuracy}%`;

    const vocab = levelVocab(level);
    const countsByTheme = {};
    Object.keys(state.srs).forEach((id) => {
      const item = VOCAB_BY_ID.get(id);
      if (item && isWithinTargetLevel(item.level, level)) countsByTheme[item.theme] = (countsByTheme[item.theme] || 0) + 1;
    });
    const themes = uniqueBy(vocab.map((item) => item.theme), (theme) => theme);
    $('contentCountLabel').textContent = `${levelLexicalVocab(level).length.toLocaleString()} Vocabulary · ${levelKanji(level).length.toLocaleString()} Kanji · ${levelGrammar(level).length} Grammar · ${levelReadings(level).length} Reading · ${levelListenings(level).length} Listening`;
    $('themeList').innerHTML = themes.map((theme) => {
      const label = CONTENT.themeLabels[theme] || { icon: '🗂️', th: theme };
      const total = vocab.filter((item) => item.theme === theme).length;
      const learned = countsByTheme[theme] || 0;
      return `<button type="button" class="theme-row" data-theme-practice="${escapeAttr(theme)}"><span class="theme-icon">${label.icon}</span><span><h4>${escapeHtml(label.th)}</h4><p>${learned}/${total} คำเริ่มเรียนแล้ว</p></span><span class="theme-progress">ฝึก ›</span></button>`;
    }).join('');
    $$('[data-theme-practice]', $('themeList')).forEach((button) => {
      button.onclick = () => {
        const theme = button.dataset.themePractice;
        const label = CONTENT.themeLabels[theme] || { th: theme };
        startLesson(buildModeLesson('theme', { theme, title: label.th }));
      };
    });
  }

  function renderReview() {
    const level = state.profile.targetLevel;
    const query = ($('wordSearch')?.value || '').trim().toLowerCase();
    let items;
    if (reviewFilter === 'due') items = getDueItems(level);
    else if (reviewFilter === 'weak') items = getWeakItems(level);
    else items = levelVocab(level).map((item) => ({ item, srs: state.srs[item.id] || null }));

    if (query) {
      items = items.filter(({ item }) => [item.word, item.reading, item.th, item.en].some((value) => String(value).toLowerCase().includes(query)));
    }

    const list = items.slice(0, 80);
    if (!list.length) {
      $('wordList').innerHTML = `<div class="empty-state"><div class="big">${reviewFilter === 'due' ? '🌿' : '🔎'}</div><h3>${query ? 'ไม่พบคำที่ค้นหา' : 'คิวนี้ว่างแล้ว'}</h3><p>${reviewFilter === 'due' ? 'เมื่อเรียนคำใหม่หรือถึงวันทบทวน คำจะปรากฏที่นี่' : 'ลองเปลี่ยนตัวกรองหรือค้นด้วยคำอ่าน'}</p></div>`;
    } else {
      $('wordList').innerHTML = list.map(({ item, srs }) => {
        const rate = srs?.attempts ? Math.round(srs.correct / srs.attempts * 100) : null;
        const className = rate == null ? '' : rate < 70 ? 'weak' : Number(srs.interval || 0) >= 7 ? 'good' : '';
        const badge = srs ? (rate == null ? 'ใหม่' : `${rate}%`) : 'ยังไม่เรียน';
        return `<button type="button" class="word-row" data-word-id="${item.id}"><span class="word-main"><span class="word-jp">${escapeHtml(item.word)}</span><span class="word-reading">${escapeHtml(item.reading)}</span><span class="word-th">${escapeHtml(item.th)}</span></span><span class="mastery-badge ${className}">${badge}</span></button>`;
      }).join('');
      $$('[data-word-id]', $('wordList')).forEach((button) => { button.onclick = () => openWordModal(button.dataset.wordId); });
    }
    renderMistakes();
  }

  function renderMistakes() {
    const level = state.profile.targetLevel;
    const mistakes = state.mistakes.filter((item) => item.level === level);
    if (!mistakes.length) {
      $('mistakeList').innerHTML = '<div class="empty-state"><div class="big">✨</div><h3>ยังไม่มีข้อผิดในระดับนี้</h3><p>เมื่อตอบผิด ระบบจะเก็บคำอธิบายและเพิ่มข้อนั้นเข้าคิวทบทวน</p></div>';
      return;
    }
    $('mistakeList').innerHTML = `<div class="mistake-stack">${mistakes.slice(0, 15).map((mistake) => {
      const item = mistake.itemId ? VOCAB_BY_ID.get(mistake.itemId) : null;
      const title = item ? `${item.word}（${item.reading}）` : `${SKILL_LABELS[mistake.skill]?.icon || '📝'} ${SKILL_LABELS[mistake.skill]?.th || mistake.skill}`;
      const listeningMeta = mistake.skill === 'listening'
        ? ` · ฟัง ${Number(mistake.audioPlays || 0)} รอบ · ${Number(mistake.speakerCount || 1)} ผู้พูด · ${mistake.questionType || 'listening'}`
        : '';
      return `<details class="mistake-card"><summary><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(mistake.date)} · ผิด ${mistake.count} ครั้ง${escapeHtml(listeningMeta)}</small></span><span class="details-arrow">⌄</span></summary><div class="mistake-body"><p><strong>โจทย์:</strong> ${escapeHtml(mistake.prompt)}</p><p class="wrong-answer"><strong>คำตอบที่เลือก:</strong> ${escapeHtml(mistake.selected)}</p><p class="right-answer"><strong>คำตอบที่ถูก:</strong> ${escapeHtml(mistake.correct)}</p><p><strong>เหตุผล:</strong> ${escapeHtml(mistake.explanation)}</p></div></details>`;
    }).join('')}</div>`;
  }

  function openWordModal(itemId) {
    const item = VOCAB_BY_ID.get(itemId);
    if (!item) return;
    const srs = state.srs[itemId];
    const theme = CONTENT.themeLabels[item.theme] || { icon: '🧠', th: item.theme };
    const status = srs ? `ทบทวนครั้งถัดไป: ${formatThaiDate(srs.due, { day: 'numeric', month: 'short' })} · ช่วงห่าง ${srs.interval || 0} วัน` : 'ยังไม่ได้เริ่มเรียนคำนี้';
    $('wordModalBody').innerHTML = `
      <h2 id="wordModalTitle">${escapeHtml(item.word)} <small style="color:var(--muted);font-size:.7em">${escapeHtml(item.reading)}</small></h2>
      <p><span class="theme-tag">${theme.icon} ${escapeHtml(theme.th)}</span> <span class="target-level-badge">${escapeHtml(item.level)}</span></p>
      <div class="big-meaning" style="text-align:left">${escapeHtml(item.th)}</div>
      <div class="big-en" style="text-align:left">${escapeHtml(item.en)}</div>
      <div class="example-box"><div class="example-jp">${escapeHtml(item.example)}</div><div class="example-th">${escapeHtml(item.exampleTh)}</div></div>
      <div class="memory-tip"><span>🧷</span><span>${escapeHtml(item.tip)}</span></div>
      <p style="margin-top:12px">${escapeHtml(status)}</p>
      <div class="modal-actions"><button type="button" class="ghost-btn" data-speak="${escapeAttr(item.word + '。' + item.example)}">🔊 ฟังเสียง</button><button type="button" class="primary-btn" id="practiceSingleWord">ฝึกคำนี้</button></div>
      <button type="button" class="ghost-btn full" style="width:100%;margin-top:11px" data-close-modal="wordModal">ปิด</button>`;
    $('wordModal').classList.add('open');
    bindSpeakButtons($('wordModalBody'));
    $('practiceSingleWord').onclick = () => {
      $('wordModal').classList.remove('open');
      startLesson(buildModeLesson('single', { itemId, title: item.word }));
    };
    bindModalCloseButtons();
  }

  function renderProgress() {
    const level = state.profile.targetLevel;
    const adaptive = computeAdaptivePlan();
    const ready = readiness(level);
    const stats = getLevelStats(level);
    $('progressStreak').textContent = state.streak;
    $('progressXp').textContent = state.xp;
    $('progressLearned').textContent = learnedCount(level);
    $('progressMastered').textContent = masteredCount(level);
    $('progressLearnedCaption').textContent = `คำในระดับ ${level}`;
    const xpInLevel = state.xp % 100;
    $('xpNextLabel').textContent = `อีก ${xpInLevel === 0 ? 100 : 100 - xpInLevel} XP ถึงเลเวลถัดไป`;

    const classes = { vocab: 'danger', grammar: 'secondary', reading: 'accent', listening: '' };
    $('skillBars').innerHTML = Object.keys(SKILL_LABELS).map((skill) => {
      const value = accuracy(skill, level);
      const attempts = Number(stats[skill].attempts || 0);
      const width = value == null ? 0 : value;
      const avgSeconds = attempts ? Math.round(Number(stats[skill].totalSeconds || 0) / attempts) : 0;
      return `<div><div class="skill-row-header"><span>${SKILL_LABELS[skill].icon} ${escapeHtml(SKILL_LABELS[skill].th)}</span><strong>${attempts ? `${value}% · ${attempts} ข้อ${avgSeconds ? ` · ${avgSeconds}s/ข้อ` : ''}` : 'ยังไม่มีข้อมูล'}</strong></div><div class="progress-track"><div class="progress-fill ${classes[skill]}" style="width:${width}%"></div></div></div>`;
    }).join('');
    $('progressWeightBars').innerHTML = weightBarsHtml(adaptive.weights);

    $('progressProjectedScore').textContent = ready.projection == null ? '—' : ready.projection;
    $('progressScoreRing').style.setProperty('--p', `${ready.projection == null ? 0 : clamp(ready.projection / 180 * 100, 0, 100)}%`);
    $('progressReadinessChip').textContent = `${ready.icon} ${ready.label}`;
    $('progressReadinessChip').className = `readiness-chip ${ready.id === 'risk' ? 'risk' : ['near','developing','near-ready'].includes(ready.id) ? 'near' : ['ready','strong'].includes(ready.id) ? 'ready' : ''}`;
    $('progressScoreText').textContent = ready.headline;
    $('progressScoreDetail').textContent = ready.description;
    $('progressTargetNote').textContent = `${level}: ผ่าน ${adaptive.config.overallPass} · เป้าซ้อม ${adaptive.config.safetyTarget}+`;

    const mocks = [...state.mockScores].filter((mock) => mock.level === level).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!mocks.length) {
      $('mockList').innerHTML = `<div class="empty-state"><div class="big">📝</div><h3>ยังไม่มีคะแนน Mock ระดับ ${level}</h3><p>เมื่อเริ่ม Exam Mode แนะนำให้กรอกคะแนนเป็นระยะเพื่อดูแนวโน้มและ Section risk</p></div>`;
    } else {
      $('mockList').innerHTML = mocks.map((mock, index) => {
        const status = resultPasses(mock) ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่าน';
        const sections = getConfig(level).sections.map((section) => `${section.labelEn}: ${Number(mock.sections?.[section.key] || 0)}/${section.max}`).join(' · ');
        return `<div class="mock-row"><span><strong>Mock ${mocks.length - index} · ${status}</strong><br><time>${formatThaiDate(mock.date, { day: 'numeric', month: 'short', year: 'numeric' })} · ${escapeHtml(sections)}${mock.note ? `<br>${escapeHtml(mock.note)}` : ''}</time></span><span class="mock-score">${resultTotal(mock)}/180</span><button type="button" class="icon-btn" data-delete-mock="${mock.id}" aria-label="ลบคะแนน">🗑️</button></div>`;
      }).join('');
      $$('[data-delete-mock]', $('mockList')).forEach((button) => {
        button.onclick = () => {
          if (!window.confirm('ลบคะแนน Mock นี้หรือไม่?')) return;
          state.mockScores = state.mockScores.filter((mock) => mock.id !== button.dataset.deleteMock);
          saveState();
          renderAll();
        };
      });
    }
  }

  function renderProfile() {
    const level = state.profile.targetLevel;
    const adaptive = computeAdaptivePlan();
    $('profileNameLabel').textContent = state.profile.name || 'ผู้เรียน';
    $('profileTargetLevel').textContent = level;
    $('profilePhase').textContent = adaptive.phase.short;
    $('profileSummaryText').textContent = `${adaptive.phase.description} · เรียน ${state.profile.dailyMinutes} นาที/วัน · Priority ${SKILL_LABELS[adaptive.priority].th}`;

    const results = [...state.examResults].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!results.length) {
      $('examResultList').innerHTML = '<div class="empty-state"><div class="big">📊</div><h3>ยังไม่มีผลสอบ</h3><p>เพิ่มคะแนนจริงหรือใช้ Mock Test เพื่อเริ่มวิเคราะห์ Score gap</p></div>';
    } else {
      $('examResultList').innerHTML = results.map((result) => {
        const config = getConfig(result.level);
        const pass = resultPasses(result);
        const sectionText = config.sections.map((section) => `${section.labelTh} ${Number(result.sections?.[section.key] || 0)}/${section.max}`).join(' · ');
        const refs = result.references || {};
        const refText = ['vocab', 'grammar', 'reading'].filter((key) => ['A', 'B', 'C'].includes(refs[key])).map((key) => `${SKILL_LABELS[key]?.short || key} ${refs[key]}`).join(' · ');
        return `<article class="exam-result-card card"><div class="result-head"><span class="target-level-badge">${result.level}</span><span class="result-status ${pass ? 'pass' : 'fail'}">${pass ? 'ผ่าน' : 'ไม่ผ่าน'}</span><strong>${resultTotal(result)}/180</strong></div><p>${escapeHtml(sectionText)}</p>${refText ? `<small>Reference: ${escapeHtml(refText)}</small>` : ''}<small>${formatThaiDate(result.date)}${result.note ? ` · ${escapeHtml(result.note)}` : ''}</small><button type="button" class="icon-btn result-delete" data-delete-result="${result.id}" aria-label="ลบผลสอบ">🗑️</button></article>`;
      }).join('');
      $$('[data-delete-result]', $('examResultList')).forEach((button) => {
        button.onclick = () => {
          if (!window.confirm('ลบผลสอบชุดนี้หรือไม่?')) return;
          state.examResults = state.examResults.filter((result) => result.id !== button.dataset.deleteResult);
          saveState();
          renderAll();
        };
      });
    }
    renderContentStatus();
  }

  function renderContentStatus() {
    if (!$('contentSyncStatus')) return;
    const level = state.profile.targetLevel;
    const sync = CONTENT.meta?.contentSync || {};
    const managerStatus = window.JLPTContentManager?.status?.() || {};
    const vocabCount = levelLexicalVocab(level).length;
    const kanjiCount = levelKanji(level).length;
    const target = sync.targets?.[level] || {};
    const complete = Boolean(sync.complete);
    const sourceLabel = managerStatus.source === 'cache'
      ? 'คลังออฟไลน์ในเครื่อง'
      : managerStatus.source === 'network'
        ? 'ซิงก์จากแหล่งข้อมูลเปิดแล้ว'
        : 'Starter Pack';
    $('contentSyncStatus').textContent = `${complete ? 'พร้อมใช้งาน' : 'ยังไม่ครบ'} · ${sourceLabel}`;
    $('contentSyncStatus').className = `setting-desc content-status ${complete ? 'complete' : 'partial'}`;
    $('contentSyncCounts').textContent = `${level}: ${vocabCount.toLocaleString()} Vocabulary / ${kanjiCount.toLocaleString()} Kanji${target.vocab ? ` · เป้าหมาย ${Number(target.vocab).toLocaleString()} / ${Number(target.kanji || 0).toLocaleString()}` : ''}`;
    const errorCount = Array.isArray(sync.fetchErrors) ? sync.fetchErrors.length : 0;
    $('contentSyncDetail').textContent = `${sync.noteTh || 'คลังเนื้อหาพร้อมใช้งาน'}${errorCount ? ` · มีแหล่งโหลดไม่สำเร็จ ${errorCount} รายการ` : ''}`;
    $('contentLicenseNote').textContent = (CONTENT.meta?.attributions || [])
      .map((item) => `${item.name} (${item.license})`).join(' · ') || 'Starter content ของ JLPT Coach';
  }

  function renderSettings() {
    $('dailyMinutesSelect').value = String(state.profile.dailyMinutes);
    $('reminderTimeInput').value = state.profile.reminderTime || '20:30';
    $('soundToggle').checked = Boolean(state.profile.sound);
    if ($('multiVoiceToggle')) $('multiVoiceToggle').checked = state.profile.multiVoice !== false;
    if ($('listeningSpeedSelect')) $('listeningSpeedSelect').value = state.profile.listeningSpeed || 'auto';
    $('darkToggle').checked = Boolean(state.profile.dark);
    $('examDateInput').value = state.profile.examDate;
    $('examDateDesc').textContent = `${Math.max(0, daysBetween(localISO(), state.profile.examDate))} วันถึงวันสอบ · ใช้คำนวณ Study Phase`;
    renderVoiceStatus();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.profile.dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = state.profile.dark ? '#10221f' : '#35b79d';
  }

  function switchView(view) {
    currentView = view;
    $$('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`));
    $$('.nav-btn').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'review') renderReview();
    if (view === 'progress') renderProgress();
    if (view === 'profile') renderProfile();
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function launchConfetti() {
    const container = $('confetti');
    container.innerHTML = '';
    container.classList.remove('hidden');
    const colors = ['#35b79d', '#7d6fe8', '#ffbf47', '#ef6b6b', '#65d7bc'];
    for (let i = 0; i < 36; i += 1) {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.45}s`;
      piece.style.animationDuration = `${1.35 + Math.random() * 0.8}s`;
      piece.style.setProperty('--x', `${-70 + Math.random() * 140}px`);
      container.appendChild(piece);
    }
    window.setTimeout(() => container.classList.add('hidden'), 2400);
  }

  function renderDynamicScoreFields(containerId, level, values = {}, prefix = 'score') {
    const config = getConfig(level);
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = config.sections.map((section) => `
      <div class="form-group score-field">
        <label for="${prefix}-${section.key}">${escapeHtml(section.labelTh)} <small>0–${section.max}</small></label>
        <input type="number" inputmode="numeric" id="${prefix}-${section.key}" data-score-key="${section.key}" min="0" max="${section.max}" step="1" value="${values[section.key] ?? ''}" placeholder="0–${section.max}">
        <small class="field-help">เกณฑ์ขั้นต่ำ ${section.pass}/${section.max}</small>
      </div>`).join('');
  }

  function collectScoreFields(containerId, level, allowEmpty = false) {
    const config = getConfig(level);
    const container = $(containerId);
    const sections = {};
    let valid = true;
    let hasAny = false;
    config.sections.forEach((section) => {
      const input = container?.querySelector(`[data-score-key="${section.key}"]`);
      const raw = input?.value?.trim() ?? '';
      if (raw !== '') hasAny = true;
      let value = Number(raw);
      if (raw === '' && allowEmpty) value = 0;
      if (raw === '' && !allowEmpty) valid = false;
      if (!Number.isFinite(value) || value < 0 || value > section.max) valid = false;
      sections[section.key] = clamp(Number.isFinite(value) ? Math.round(value) : 0, 0, section.max);
      input?.classList.toggle('invalid', raw !== '' && (Number(raw) < 0 || Number(raw) > section.max));
    });
    return { sections, total: Object.values(sections).reduce((sum, value) => sum + value, 0), valid: valid && (allowEmpty || hasAny), hasAny };
  }

  function scoreSummaryHtml(level, sections) {
    const config = getConfig(level);
    const total = Object.values(sections || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const sectionRows = config.sections.map((section) => {
      const score = Number(sections?.[section.key] || 0);
      const pass = score >= section.pass;
      return `<span class="score-summary-section ${pass ? 'pass' : 'risk'}">${pass ? '✓' : '!'} ${escapeHtml(section.labelTh)} ${score}/${section.max}</span>`;
    }).join('');
    return `<strong>${level} · ${total}/180</strong><span class="${total >= config.overallPass ? 'score-pass' : 'score-risk'}">${total >= config.overallPass ? 'ถึงเกณฑ์รวม' : `ขาด ${Math.max(0, config.overallPass - total)} คะแนนจากเกณฑ์รวม`}</span><div>${sectionRows}</div>`;
  }

  function openMockModal() {
    const level = state.profile.targetLevel;
    $('mockModalTitle').textContent = `บันทึก Mock Test ${level}`;
    $('mockModalSubtitle').textContent = `เกณฑ์รวม ${getConfig(level).overallPass}/180 และต้องผ่านขั้นต่ำทุก Section`;
    $('mockDate').value = localISO();
    $('mockNote').value = '';
    renderDynamicScoreFields('mockScoreFields', level, {}, 'mock');
    $('mockModal').classList.add('open');
  }

  function openResultModal() {
    const level = state.profile.targetLevel;
    $('resultLevel').value = level;
    $('resultDate').value = localISO();
    $('resultRefVocab').value = 'U';
    $('resultRefGrammar').value = 'U';
    $('resultRefReading').value = 'U';
    $('resultNote').value = '';
    renderDynamicScoreFields('resultScoreFields', level, {}, 'result');
    $('resultModal').classList.add('open');
  }

  function bindModalCloseButtons() {
    $$('[data-close-modal]').forEach((button) => {
      button.onclick = () => $(button.dataset.closeModal)?.classList.remove('open');
    });
  }

  function setOnboardingGoal(minutes) {
    $$('.goal-choice').forEach((label) => {
      const input = label.querySelector('input');
      const selected = Number(input?.value) === Number(minutes);
      label.classList.toggle('selected', selected);
      if (input) input.checked = selected;
    });
  }

  function setTargetLevelPicker(level) {
    $$('[data-target-level]', $('targetLevelPicker')).forEach((button) => button.classList.toggle('selected', button.dataset.targetLevel === level));
  }

  function toggleScoreArea() {
    const enabled = $('hasPreviousScore').checked;
    $('onboardingScoreArea').classList.toggle('hidden', !enabled);
    $('noScoreNote').classList.toggle('hidden', enabled);
  }

  function updateOnboardingScoreSummary() {
    const level = $('previousLevelSelect').value;
    const collected = collectScoreFields('onboardingScoreFields', level, true);
    $('onboardingScoreSummary').innerHTML = scoreSummaryHtml(level, collected.sections);
  }

  function openOnboarding(editMode = false) {
    onboardingEditMode = editMode;
    onboardingStep = 1;
    onboardingResultId = null;
    const level = state.profile.targetLevel || 'N4';
    $('onboardingName').value = state.profile.name || '';
    $('onboardingExamDate').value = state.profile.examDate || CONTENT.meta.defaultExamDate;
    setTargetLevelPicker(level);
    refreshOnboardingMascot(level);

    const result = latestExamResult(level) || nearestExamResult(level);
    $('hasPreviousScore').checked = Boolean(result) || !editMode;
    $('previousLevelSelect').value = result?.level || level;
    renderDynamicScoreFields('onboardingScoreFields', result?.level || level, result?.sections || {}, 'onboarding');
    $('onboardingRefVocab').value = result?.references?.vocab || 'U';
    $('onboardingRefGrammar').value = result?.references?.grammar || 'U';
    $('onboardingRefReading').value = result?.references?.reading || 'U';
    onboardingResultId = editMode && result ? result.id : null;
    toggleScoreArea();
    updateOnboardingScoreSummary();

    $$('#weaknessPicker input').forEach((input) => { input.checked = (state.profile.selfWeaknesses || []).includes(input.value); });
    setOnboardingGoal(state.profile.dailyMinutes || 25);
    $('onboardingReminder').value = state.profile.reminderTime || '20:30';
    $('onboardingCloseBtn').classList.toggle('hidden', !editMode);
    $('onboardingTitle').textContent = editMode ? 'แก้ไขโค้ช JLPT ส่วนตัว' : 'สร้างโค้ช JLPT ส่วนตัว';
    $('onboardingLead').textContent = editMode ? 'เปลี่ยนระดับ วันสอบ คะแนน หรือเวลาที่เรียนได้ แล้วระบบจะคำนวณแผนใหม่ทันที' : 'เลือกเป้าหมายและใส่ข้อมูลจริง ระบบจะไม่บังคับให้ทุกคนเรียนเหมือนกัน';
    showOnboardingStep(1);
    $('onboarding').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function showOnboardingStep(step) {
    onboardingStep = clamp(step, 1, 4);
    $$('.onboarding-step').forEach((section) => section.classList.toggle('active', Number(section.dataset.step) === onboardingStep));
    $$('#stepDots i').forEach((dot, index) => dot.classList.toggle('active', index < onboardingStep));
    $('onboardingBackBtn').classList.toggle('hidden', onboardingStep === 1);
    $('onboardingNextBtn').classList.toggle('hidden', onboardingStep === 4);
    $('finishOnboardingBtn').classList.toggle('hidden', onboardingStep !== 4);
    if (onboardingStep === 4) renderOnboardingAnalysis();
    $('onboarding').scrollTop = 0;
  }

  function collectOnboardingDraft() {
    const targetLevel = $('targetLevelPicker').querySelector('.selected')?.dataset.targetLevel || 'N4';
    const profile = {
      ...state.profile,
      name: $('onboardingName').value.trim(),
      targetLevel,
      examDate: $('onboardingExamDate').value || CONTENT.meta.defaultExamDate,
      dailyMinutes: Number(document.querySelector('input[name="goal"]:checked')?.value || 25),
      reminderTime: $('onboardingReminder').value || '20:30',
      selfWeaknesses: $$('#weaknessPicker input:checked').map((input) => input.value),
    };
    let result = null;
    if ($('hasPreviousScore').checked) {
      const level = $('previousLevelSelect').value;
      const collected = collectScoreFields('onboardingScoreFields', level, false);
      result = {
        id: onboardingResultId || `result-${Date.now()}`,
        level,
        date: localISO(),
        sections: collected.sections,
        references: {
          vocab: $('onboardingRefVocab').value,
          grammar: $('onboardingRefGrammar').value,
          reading: $('onboardingRefReading').value,
        },
        note: onboardingEditMode ? 'Updated from profile setup' : 'Added during onboarding',
        valid: collected.valid,
      };
    }
    return { profile, result };
  }

  function renderOnboardingAnalysis() {
    const draft = collectOnboardingDraft();
    const examResults = [...state.examResults];
    if (draft.result?.valid) {
      const index = examResults.findIndex((result) => result.id === draft.result.id);
      if (index >= 0) examResults[index] = draft.result;
      else examResults.push(draft.result);
    }
    const adaptive = computeAdaptivePlan({ profile: draft.profile, examResults });
    const scoreTotal = draft.result?.valid && draft.result.level === draft.profile.targetLevel ? resultTotal(draft.result) : null;
    const gap = scoreTotal == null ? null : Math.max(0, adaptive.config.overallPass - scoreTotal);
    $('onboardingAnalysis').innerHTML = `
      <div class="analysis-hero"><div class="analysis-level">${draft.profile.targetLevel}</div><div><span class="eyebrow-mini">STEP 4 / 4 · แผนที่ระบบเสนอ</span><h2>${escapeHtml(draft.profile.name || 'ผู้เรียน')} · ${adaptive.phase.name}</h2><p>${escapeHtml(adaptive.phase.description)}</p></div></div>
      <div class="analysis-grid"><div class="analysis-cell"><strong>${Math.max(0, daysBetween(localISO(), draft.profile.examDate))}</strong><span>วันถึงสอบ</span></div><div class="analysis-cell"><strong>${draft.profile.dailyMinutes} นาที</strong><span>เวลา/วัน</span></div><div class="analysis-cell"><strong>${adaptive.config.overallPass}/180</strong><span>เกณฑ์ผ่าน</span></div><div class="analysis-cell"><strong>${gap == null ? 'รอข้อมูล' : gap === 0 ? 'ถึงเกณฑ์รวม' : `${gap} คะแนน`}</strong><span>Score gap</span></div></div>
      <div class="analysis-priority"><span>${SKILL_LABELS[adaptive.priority].icon}</span><div><small>Priority แรก</small><strong>${escapeHtml(SKILL_LABELS[adaptive.priority].th)}</strong><p>${escapeHtml(adaptive.priorityReason)}</p></div></div>
      <div class="weight-list">${weightBarsHtml(adaptive.weights, true)}</div>
      <p class="analysis-footnote">ระบบจะคำนวณใหม่หลังทุกบทเรียนจาก Accuracy, Response time, SRS, Mistake Log และ Mock Test</p>`;
  }

  function finishOnboarding(event) {
    event?.preventDefault();
    const draft = collectOnboardingDraft();
    if (!draft.profile.examDate) {
      showToast('กรุณาเลือกวันสอบเป้าหมาย');
      showOnboardingStep(1);
      return;
    }
    if ($('hasPreviousScore').checked && !draft.result?.valid) {
      showToast('กรุณากรอกคะแนนทุก Section ให้ถูกต้อง หรือปิดตัวเลือก “มีผลสอบ”');
      showOnboardingStep(2);
      return;
    }
    state.profile = { ...state.profile, ...draft.profile, onboardingDone: true };
    if (draft.result?.valid) {
      const cleanResult = { ...draft.result };
      delete cleanResult.valid;
      const existingIndex = state.examResults.findIndex((result) => result.id === cleanResult.id);
      if (existingIndex >= 0) state.examResults[existingIndex] = cleanResult;
      else state.examResults.push(cleanResult);
    }
    state.lastReminderDate = null;
    saveState();
    $('onboarding').classList.remove('open');
    document.body.style.overflow = '';
    renderAll();
    switchView('home');
    showToast('Adaptive Plan พร้อมแล้ว 🌱');
  }

  function notificationSupported() {
    return 'Notification' in window;
  }

  function updateNotificationStatus() {
    if (!notificationSupported()) {
      $('notificationStatus').textContent = 'Browser นี้ไม่รองรับ Notification';
      $('notificationBtn').disabled = true;
      return;
    }
    const permission = Notification.permission;
    $('notificationStatus').textContent = permission === 'granted'
      ? `อนุญาตแล้ว · เวลา ${state.profile.reminderTime}`
      : permission === 'denied' ? 'ถูกปฏิเสธใน Browser Settings' : 'ยังไม่ได้อนุญาต';
    $('notificationBtn').disabled = false;
    $('notificationBtn').textContent = permission === 'granted' ? 'ทดสอบ' : 'เปิดการเตือน';
  }

  async function requestNotification() {
    if (!notificationSupported()) {
      showToast('อุปกรณ์นี้ไม่รองรับ Notification');
      return;
    }
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        updateNotificationStatus();
        showToast('ยังไม่ได้รับอนุญาตให้แจ้งเตือน');
        return;
      }
    }
    await showAppNotification('JLPT Coach พร้อมแล้ว 🌱', { body: `เปิดภารกิจ ${state.profile.targetLevel} วันนี้เพื่อรักษา Streak` });
    updateNotificationStatus();
  }

  async function showAppNotification(title, options = {}) {
    try {
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, { icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: 'jlpt-coach-reminder', ...options });
      } else if (Notification.permission === 'granted') {
        new Notification(title, { icon: 'assets/icon-192.png', ...options });
      }
    } catch (error) {
      console.warn('Notification failed:', error);
    }
  }

  function reminderTick() {
    if (!notificationSupported() || Notification.permission !== 'granted') return;
    const today = localISO();
    if (state.completedDates[today] || state.lastReminderDate === today) return;
    const [hour, minute] = (state.profile.reminderTime || '20:30').split(':').map(Number);
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (now >= due && now - due < 3 * 60 * 60 * 1000) {
      showAppNotification(`ได้เวลา ${state.profile.targetLevel} Daily Quest แล้ว 🌱`, { body: `วันนี้ใช้ประมาณ ${state.profile.dailyMinutes} นาที ระบบจัดสิ่งที่ควรเรียนที่สุดให้แล้ว` });
      state.lastReminderDate = today;
      saveState();
    }
  }

  function utcStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function escapeICSText(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }

  function downloadICS() {
    const startIso = localISO();
    const [hour, minute] = (state.profile.reminderTime || '20:30').split(':');
    const examIso = state.profile.examDate;
    if (!examIso) { showToast('กรุณาตั้งวันสอบก่อน'); return; }
    const start = startIso.replaceAll('-', '');
    const exam = examIso.replaceAll('-', '');
    const dayAfterExam = addDays(examIso, 1).replaceAll('-', '');
    const dailyUntil = addDays(examIso, -1).replaceAll('-', '');
    const level = state.profile.targetLevel;
    const duration = Math.max(10, Number(state.profile.dailyMinutes) || 25);
    const uid = `jlpt-coach-${level.toLowerCase()}-${Date.now()}@local`;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JLPT Coach//Adaptive Daily Study//TH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Bangkok', 'X-LIC-LOCATION:Asia/Bangkok', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:ICT', 'DTSTART:19700101T000000', 'END:STANDARD', 'END:VTIMEZONE',
      'BEGIN:VEVENT', `UID:${uid}-daily`, `DTSTAMP:${utcStamp(new Date())}`, `DTSTART;TZID=Asia/Bangkok:${start}T${hour}${minute}00`, `RRULE:FREQ=DAILY;UNTIL:${dailyUntil}T165900Z`, `DURATION:PT${duration}M`, `SUMMARY:${escapeICSText(`JLPT Coach ${level} - Daily Quest`)}`, `DESCRIPTION:${escapeICSText('เปิดแอปและทำ Adaptive Daily Quest ระบบจะเลือกทักษะที่ควรเรียนที่สุดจากคะแนนและข้อผิดล่าสุด')}`, 'BEGIN:VALARM', 'TRIGGER:-PT5M', 'ACTION:DISPLAY', `DESCRIPTION:${escapeICSText(`Time for JLPT ${level}`)}`, 'END:VALARM', 'END:VEVENT',
      'BEGIN:VEVENT', `UID:${uid}-exam`, `DTSTAMP:${utcStamp(new Date())}`, `DTSTART;VALUE=DATE:${exam}`, `DTEND;VALUE=DATE:${dayAfterExam}`, `SUMMARY:${escapeICSText(`JLPT ${level} Exam Day`)}`, `DESCRIPTION:${escapeICSText('ตรวจสนามสอบ เวลารายงานตัว และเอกสารจาก Test Voucher อีกครั้ง')}`, 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${escapeICSText(`Tomorrow is JLPT ${level} exam day`)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
    ];
    downloadBlob(lines.join('\r\n'), `JLPT_Coach_${level}_Daily_Reminders.ics`, 'text/calendar;charset=utf-8');
    showToast('สร้างไฟล์ปฏิทินแล้ว');
  }

  function exportProgress() {
    const payload = { app: 'JLPT Coach N5-N1', appVersion: '2.2.0', schemaVersion: SCHEMA_VERSION, contentVersion: CONTENT.meta.version, exportedAt: new Date().toISOString(), state };
    downloadBlob(JSON.stringify(payload, null, 2), `JLPT_Coach_Backup_${localISO()}.json`, 'application/json');
    showToast('Export progress แล้ว');
  }

  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = parsed.state || parsed;
        if (!imported.profile || !imported.srs) throw new Error('Invalid backup');
        if (imported.stats && !imported.statsByLevel) {
          state = migrateLegacyState(imported);
        } else {
          const base = defaultState();
          state = {
            ...base,
            ...imported,
            profile: { ...base.profile, ...(imported.profile || {}), onboardingDone: true },
            examResults: Array.isArray(imported.examResults) ? imported.examResults : [],
            completedDates: imported.completedDates || {},
            srs: imported.srs || {},
            statsByLevel: normalizeStatsByLevel(imported.statsByLevel),
            mistakes: Array.isArray(imported.mistakes) ? imported.mistakes : [],
            mockScores: Array.isArray(imported.mockScores) ? imported.mockScores : [],
            lessonHistory: Array.isArray(imported.lessonHistory) ? imported.lessonHistory : [],
          };
        }
        saveState();
        renderAll();
        switchView('home');
        showToast('Import progress สำเร็จ');
      } catch (error) {
        console.warn(error);
        showToast('ไฟล์สำรองไม่ถูกต้อง');
      }
    };
    reader.readAsText(file);
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed:', error));
  }

  function bindEvents() {
    $$('.nav-btn').forEach((button) => { button.onclick = () => switchView(button.dataset.view); });
    $('startDailyBtn').onclick = () => startLesson(buildDailyLesson());
    $('quickFiveBtn').onclick = () => startLesson(buildModeLesson('quick'));
    $('quickReviewBtn').onclick = () => startLesson(buildModeLesson('review'));
    $('lessonCloseBtn').onclick = () => closeLesson(false);

    $$('.mode-card').forEach((button) => { button.onclick = () => startLesson(buildModeLesson(button.dataset.mode)); });
    $$('[data-review-filter]').forEach((button) => {
      button.onclick = () => {
        reviewFilter = button.dataset.reviewFilter;
        $$('[data-review-filter]').forEach((other) => other.classList.toggle('active', other === button));
        renderReview();
      };
    });
    $('wordSearch').oninput = renderReview;
    $('clearMistakesBtn').onclick = () => {
      const level = state.profile.targetLevel;
      if (!state.mistakes.some((mistake) => mistake.level === level)) return;
      if (window.confirm(`ล้างประวัติข้อผิดระดับ ${level} หรือไม่? คิว SRS ยังอยู่`)) {
        state.mistakes = state.mistakes.filter((mistake) => mistake.level !== level);
        saveState();
        renderReview();
        renderHome();
      }
    };

    $('addMockBtn').onclick = openMockModal;
    $('mockForm').onsubmit = (event) => {
      event.preventDefault();
      const level = state.profile.targetLevel;
      const collected = collectScoreFields('mockScoreFields', level, false);
      if (!collected.valid) { showToast('กรุณากรอกคะแนนทุก Section ให้ถูกช่วง'); return; }
      state.mockScores.push({ id: `mock-${Date.now()}`, level, date: $('mockDate').value || localISO(), sections: collected.sections, total: collected.total, note: $('mockNote').value.trim() });
      saveState();
      $('mockModal').classList.remove('open');
      renderAll();
      showToast('บันทึกคะแนน Mock แล้ว');
    };

    $('addResultBtn').onclick = openResultModal;
    $('resultLevel').onchange = () => renderDynamicScoreFields('resultScoreFields', $('resultLevel').value, {}, 'result');
    $('resultForm').onsubmit = (event) => {
      event.preventDefault();
      const level = $('resultLevel').value;
      const collected = collectScoreFields('resultScoreFields', level, false);
      if (!collected.valid) { showToast('กรุณากรอกคะแนนทุก Section ให้ถูกช่วง'); return; }
      state.examResults.push({
        id: `result-${Date.now()}`, level, date: $('resultDate').value || localISO(), sections: collected.sections,
        references: { vocab: $('resultRefVocab').value, grammar: $('resultRefGrammar').value, reading: $('resultRefReading').value },
        note: $('resultNote').value.trim(),
      });
      saveState();
      $('resultModal').classList.remove('open');
      renderAll();
      showToast('เพิ่มผลสอบแล้ว');
    };

    $('editProfileBtn').onclick = () => openOnboarding(true);
    $('dailyMinutesSelect').onchange = () => { state.profile.dailyMinutes = Number($('dailyMinutesSelect').value); saveState(); renderAll(); };
    $('reminderTimeInput').onchange = () => { state.profile.reminderTime = $('reminderTimeInput').value || '20:30'; state.lastReminderDate = null; saveState(); renderSettings(); updateNotificationStatus(); };
    $('soundToggle').onchange = () => { state.profile.sound = $('soundToggle').checked; saveState(); if (!state.profile.sound) stopSpeech(); renderVoiceStatus(); };
    if ($('multiVoiceToggle')) $('multiVoiceToggle').onchange = () => { state.profile.multiVoice = $('multiVoiceToggle').checked; saveState(); stopSpeech(); renderVoiceStatus(); };
    if ($('listeningSpeedSelect')) $('listeningSpeedSelect').onchange = () => { state.profile.listeningSpeed = $('listeningSpeedSelect').value || 'auto'; saveState(); stopSpeech(); renderVoiceStatus(); };
    if ($('voiceTestBtn')) $('voiceTestBtn').onclick = testDialogueVoices;
    $('darkToggle').onchange = () => { state.profile.dark = $('darkToggle').checked; saveState(); applyTheme(); };
    $('examDateInput').onchange = () => { state.profile.examDate = $('examDateInput').value || CONTENT.meta.defaultExamDate; saveState(); renderAll(); };

    $('notificationBtn').onclick = requestNotification;
    $('calendarBtn').onclick = downloadICS;
    if ($('refreshContentBtn')) {
      $('refreshContentBtn').onclick = async () => {
        const button = $('refreshContentBtn');
        if (!window.JLPTContentManager) { showToast('ไม่พบ Content Manager'); return; }
        button.disabled = true;
        button.textContent = 'กำลังซิงก์…';
        $('contentSyncDetail').textContent = 'กำลังดาวน์โหลดและจัดคลัง N5–N1 โปรดเปิดอินเทอร์เน็ตไว้';
        try {
          await window.JLPTContentManager.refresh();
          button.textContent = 'กำลังเปิดใหม่…';
          window.location.reload();
        } catch (error) {
          console.warn(error);
          button.disabled = false;
          button.textContent = 'ซิงก์คลังใหม่';
          showToast('ซิงก์ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต');
        }
      };
    }
    $('exportBtn').onclick = exportProgress;
    $('importBtn').onclick = () => $('importFile').click();
    $('importFile').onchange = () => { if ($('importFile').files?.[0]) importProgress($('importFile').files[0]); $('importFile').value = ''; };
    $('resetBtn').onclick = () => {
      if (!window.confirm('ลบ Profile, XP, SRS, ข้อผิด และคะแนนทั้งหมดในเครื่องนี้จริงหรือไม่?')) return;
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      saveState();
      renderAll();
      openOnboarding(false);
      showToast('ล้างข้อมูลแล้ว กรุณาสร้างแผนใหม่');
    };

    $('hasPreviousScore').onchange = toggleScoreArea;
    $('previousLevelSelect').onchange = () => {
      renderDynamicScoreFields('onboardingScoreFields', $('previousLevelSelect').value, {}, 'onboarding');
      updateOnboardingScoreSummary();
      onboardingResultId = null;
    };
    $('onboardingScoreFields').addEventListener('input', updateOnboardingScoreSummary);
    $$('[data-target-level]', $('targetLevelPicker')).forEach((button) => {
      button.onclick = () => {
        setTargetLevelPicker(button.dataset.targetLevel);
        refreshOnboardingMascot(button.dataset.targetLevel);
        if (!onboardingEditMode || !$('hasPreviousScore').checked) {
          $('previousLevelSelect').value = button.dataset.targetLevel;
          renderDynamicScoreFields('onboardingScoreFields', button.dataset.targetLevel, {}, 'onboarding');
          updateOnboardingScoreSummary();
        }
      };
    });
    $$('.goal-choice').forEach((label) => {
      label.onclick = () => setOnboardingGoal(Number(label.querySelector('input').value));
    });
    $('onboardingNextBtn').onclick = () => {
      if (onboardingStep === 1 && !$('onboardingExamDate').value) { showToast('กรุณาเลือกวันสอบเป้าหมาย'); return; }
      if (onboardingStep === 2 && $('hasPreviousScore').checked) {
        const collected = collectScoreFields('onboardingScoreFields', $('previousLevelSelect').value, false);
        if (!collected.valid) { showToast('กรอกคะแนนทุก Section หรือปิดตัวเลือก “มีผลสอบ”'); return; }
      }
      showOnboardingStep(onboardingStep + 1);
    };
    $('onboardingBackBtn').onclick = () => showOnboardingStep(onboardingStep - 1);
    $('onboardingForm').onsubmit = finishOnboarding;
    $('onboardingCloseBtn').onclick = () => {
      if (!onboardingEditMode) return;
      $('onboarding').classList.remove('open');
      document.body.style.overflow = '';
    };

    $('installBtn').onclick = async () => {
      if (installPrompt) {
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
      } else {
        showToast('iPhone: Safari → Share → “เพิ่มไปยังหน้าจอโฮม”');
      }
    };
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      installPrompt = event;
      $('installDesc').textContent = 'พร้อมติดตั้งเป็นแอปบนหน้าจอมือถือ';
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      $('installBtn').textContent = 'ติดตั้งแล้ว';
      $('installBtn').disabled = true;
    });

    bindModalCloseButtons();
    $$('.modal-backdrop').forEach((backdrop) => {
      backdrop.onclick = (event) => { if (event.target === backdrop) backdrop.classList.remove('open'); };
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { reminderTick(); renderAll(); }
    });
  }

  function init() {
    injectMascots();
    refreshVoices();
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = refreshVoices;
    bindEvents();
    renderAll();
    registerServiceWorker();
    if (!state.profile.onboardingDone) openOnboarding(false);
    else if (state.migratedFromV1) window.setTimeout(() => showToast('ย้าย Progress จาก N4 Sprint สำเร็จแล้ว'), 650);
    reminderTick();
    window.setInterval(reminderTick, 60000);
  }

  init();
})();
