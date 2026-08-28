(() => {
  'use strict';

  const CONTENT = window.N4_CONTENT;
  if (!CONTENT) {
    document.body.innerHTML = '<p style="padding:24px">ไม่พบไฟล์ข้อมูลของแอป กรุณาเปิดไฟล์ index.html พร้อม data.js</p>';
    return;
  }

  const STORAGE_KEY = 'n4-sprint-state-v1';
  const SCHEMA_VERSION = 1;
  const DAY_MS = 86400000;
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const THEME_SEQUENCE = [
    'pairs', 'schedule', 'work', 'engineering', 'adverb', 'communication', 'action',
    'pairs', 'schedule', 'work', 'safety', 'travel', 'feeling', 'study', 'health',
    'home', 'shopping', 'honorific', 'nature', 'people', 'food'
  ];

  const SKILL_LABELS = {
    vocab: { th: 'คำศัพท์', icon: '🧠' },
    grammar: { th: 'ไวยากรณ์', icon: '🧩' },
    reading: { th: 'การอ่าน', icon: '📖' },
    listening: { th: 'การฟัง', icon: '🎧' }
  };

  const INSIGHTS = [
    ['💡', 'จำเป็นชุด ไม่ใช่คำโดด', 'เช่น 間に合う ให้จำพร้อม ～に間に合う และประโยค 会議に間に合う เพื่อให้เลือก Particle ได้เร็วขึ้น'],
    ['⏱️', 'ความเร็วสำคัญพอ ๆ กับความรู้', 'เมื่อรู้คำแต่ใช้เวลานึกนาน ให้กดทบทวนซ้ำ ระบบจะลดช่วงห่างของคำนั้นจนตอบได้อัตโนมัติ'],
    ['🎧', 'ฟังเสียงก่อนดู Script', 'พยายามจับคน เวลา เหตุผล และสิ่งที่ต้องทำก่อน จากนั้นค่อยเปิด Script เพื่อหาว่าหลุดตรงคำไหน'],
    ['📖', 'อ่านคำถามก่อนบทความ', 'วงคำสำคัญ เช่น いつ、どこ、なぜ、何を แล้วค่อยอ่านเพื่อหาเฉพาะข้อมูลที่ตอบโจทย์'],
    ['🔁', 'ข้อผิดคือแผนการเรียนของวันพรุ่งนี้', 'ทุกข้อที่ตอบผิดจะถูกเพิ่มเข้าคิวทบทวนเร็วกว่าข้อที่ตอบถูก เพื่อไม่ให้ผิดซ้ำแบบเดิม'],
    ['🌱', 'วันยุ่งก็รักษา Streak ได้', 'เลือกโหมด 15 นาทีใน Settings ได้ เป้าหมายคือไม่ขาดช่วง ไม่ใช่เรียนหนักทุกวัน'],
    ['🧭', 'แยกกริยาคู่ด้วย Particle', 'คนทำให้เปลี่ยนใช้ ～を変える แต่สิ่งเปลี่ยนเองใช้ ～が変わる วิธีนี้ช่วยได้หลายคู่ใน N4'],
    ['🧠', 'Grammar A ไม่ต้องเรียนใหม่ทั้งเล่ม', 'รักษาระดับด้วย Micro grammar สั้น ๆ แล้วใช้เวลาหลักกับ Vocabulary, Reading และ Listening'],
  ];

  const VOCAB_BY_ID = new Map(CONTENT.vocab.map((item) => [item.id, item]));
  const GRAMMAR_BY_ID = new Map(CONTENT.grammar.map((item) => [item.id, item]));

  let state = loadState();
  let currentView = 'home';
  let reviewFilter = 'due';
  let activeLesson = null;
  let installPrompt = null;
  let toastTimer = null;
  let japaneseVoices = [];
  let questionTimerHandle = null;

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: {
        name: 'Patipat',
        dailyMinutes: 25,
        reminderTime: '20:30',
        examDate: CONTENT.meta.examDate,
        sound: true,
        dark: false,
        onboardingDone: false,
        createdAt: localISO(),
      },
      xp: 0,
      streak: 0,
      lastStudyDate: null,
      completedDates: {},
      srs: {},
      stats: {
        vocab: { attempts: 0, correct: 0 },
        grammar: { attempts: 0, correct: 0 },
        reading: { attempts: 0, correct: 0 },
        listening: { attempts: 0, correct: 0 },
      },
      mistakes: [],
      mockScores: [],
      lessonHistory: [],
      lastReminderDate: null,
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      return {
        ...base,
        ...saved,
        profile: { ...base.profile, ...(saved.profile || {}) },
        stats: {
          vocab: { ...base.stats.vocab, ...(saved.stats?.vocab || {}) },
          grammar: { ...base.stats.grammar, ...(saved.stats?.grammar || {}) },
          reading: { ...base.stats.reading, ...(saved.stats?.reading || {}) },
          listening: { ...base.stats.listening, ...(saved.stats?.listening || {}) },
        },
        completedDates: saved.completedDates || {},
        srs: saved.srs || {},
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
    const defaultOptions = { weekday: 'short', day: 'numeric', month: 'short' };
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

  function getPhase() {
    const today = localISO();
    const exam = state.profile.examDate;
    const left = daysBetween(today, exam);
    if (left <= 0) return { id: 5, name: left === 0 ? 'Exam Day' : 'หลังวันสอบ', short: 'Final', description: 'ทบทวนเบา ๆ และพักให้พร้อม' };
    if (left <= 14) return { id: 4, name: 'Final Sprint', short: 'Phase 4', description: 'ทบทวนจุดผิดและทำคะแนนให้เสถียร' };
    if (left <= 42) return { id: 3, name: 'Exam Mode', short: 'Phase 3', description: 'จับเวลาและฝึกตัดสินใจให้เร็ว' };
    if (left <= 70) return { id: 2, name: 'Connect Skills', short: 'Phase 2', description: 'เชื่อมศัพท์เข้ากับ Reading และ Listening' };
    return { id: 1, name: 'Vocab Repair', short: 'Phase 1', description: 'ซ่อมคำศัพท์และกริยาคู่ที่ทำให้เสียคะแนน' };
  }

  function planSettings(minutes = Number(state.profile.dailyMinutes)) {
    let plan;
    if (minutes <= 15) plan = { minutes: 15, newWords: 2, reviews: 4, micro: 1, label: 'เบาแต่ต่อเนื่อง' };
    else if (minutes >= 40) plan = { minutes: 40, newWords: 5, reviews: 10, micro: 2, label: 'เร่งคะแนน' };
    else plan = { minutes: 25, newWords: 3, reviews: 6, micro: 1, label: 'สมดุลสำหรับวัยทำงาน' };

    const phase = getPhase();
    if (phase.id === 2) {
      plan.newWords = Math.max(1, plan.newWords - 1);
      plan.reviews += 2;
      plan.micro += 1;
    } else if (phase.id === 3) {
      plan.newWords = Math.max(1, plan.newWords - 2);
      plan.reviews += 4;
      plan.micro += 1;
    } else if (phase.id >= 4) {
      plan.newWords = 0;
      plan.reviews += 6;
      plan.micro += 2;
    }
    return { ...plan, phaseId: phase.id };
  }

  function buildVocabOrder() {
    const buckets = {};
    CONTENT.vocab.forEach((item) => {
      (buckets[item.theme] ||= []).push(item);
    });
    Object.keys(buckets).forEach((theme) => {
      buckets[theme] = seededShuffle(buckets[theme], `theme-${theme}`);
    });
    const pointers = Object.fromEntries(Object.keys(buckets).map((theme) => [theme, 0]));
    const order = [];
    let remaining = CONTENT.vocab.length;
    while (remaining > 0) {
      let added = 0;
      THEME_SEQUENCE.forEach((theme) => {
        const bucket = buckets[theme] || [];
        const pointer = pointers[theme] || 0;
        if (pointer < bucket.length) {
          order.push(bucket[pointer]);
          pointers[theme] = pointer + 1;
          remaining -= 1;
          added += 1;
        }
      });
      if (added === 0) break;
    }
    return uniqueBy(order, (item) => item.id);
  }

  const PERSONALIZED_VOCAB_ORDER = buildVocabOrder();

  function getDueItems(date = localISO()) {
    return Object.entries(state.srs)
      .filter(([id, srs]) => VOCAB_BY_ID.has(id) && srs.due <= date)
      .map(([id, srs]) => ({ item: VOCAB_BY_ID.get(id), srs }))
      .sort((a, b) => {
        if (a.srs.due !== b.srs.due) return a.srs.due.localeCompare(b.srs.due);
        const aRate = a.srs.attempts ? a.srs.correct / a.srs.attempts : 0;
        const bRate = b.srs.attempts ? b.srs.correct / b.srs.attempts : 0;
        return aRate - bRate;
      });
  }

  function getWeakItems() {
    return Object.entries(state.srs)
      .filter(([id]) => VOCAB_BY_ID.has(id))
      .map(([id, srs]) => ({ item: VOCAB_BY_ID.get(id), srs }))
      .filter(({ srs }) => (srs.attempts >= 1 && srs.correct / srs.attempts < 0.7) || srs.lapses >= 1)
      .sort((a, b) => {
        const aRate = a.srs.attempts ? a.srs.correct / a.srs.attempts : 0;
        const bRate = b.srs.attempts ? b.srs.correct / b.srs.attempts : 0;
        return aRate - bRate || b.srs.lapses - a.srs.lapses;
      });
  }

  function getNewItems(count) {
    const fresh = PERSONALIZED_VOCAB_ORDER.filter((item) => !state.srs[item.id]);
    if (fresh.length >= count) return fresh.slice(0, count);
    const reinforcement = getWeakItems().map(({ item }) => item);
    return [...fresh, ...reinforcement].slice(0, count);
  }

  function ensureSrs(itemId) {
    if (!state.srs[itemId]) {
      state.srs[itemId] = {
        learnedAt: localISO(),
        due: localISO(),
        interval: 0,
        ease: 2.4,
        reps: 0,
        attempts: 0,
        correct: 0,
        lapses: 0,
        lastSeen: null,
      };
    }
    return state.srs[itemId];
  }

  function updateSrs(itemId, isCorrect) {
    const srs = ensureSrs(itemId);
    srs.attempts += 1;
    srs.lastSeen = localISO();
    if (!isCorrect) {
      srs.correct += 0;
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
    else srs.interval = clamp(Math.round(Math.max(3, srs.interval) * srs.ease), 4, 45);
    srs.ease = Math.min(2.8, srs.ease + 0.05);
    srs.due = addDays(localISO(), srs.interval);
  }

  function getDailySkill(dayIndex) {
    const cycle = ['reading', 'listening', 'reading', 'listening', 'grammar'];
    return cycle[((dayIndex % cycle.length) + cycle.length) % cycle.length];
  }

  function pickByDate(items, key, offset = 0) {
    if (!items.length) return null;
    const index = hashString(`${localISO()}-${key}-${offset}`) % items.length;
    return items[index];
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
    const sameTheme = CONTENT.vocab.filter((candidate) => candidate.theme === item.theme && candidate.id !== item.id);
    const others = CONTENT.vocab.filter((candidate) => candidate.id !== item.id);
    return uniqueBy([...seededShuffle(sameTheme, item.id), ...seededShuffle(others, `all-${item.id}`)], (candidate) => candidate.id);
  }

  function makeVocabQuestion(item, seed, forcedMode = null) {
    const modes = ['meaning', 'reading', 'context', 'audio'];
    const mode = forcedMode || modes[hashString(seed) % modes.length];
    const pool = distractorPool(item).slice(0, 12);
    let optionData;
    let prompt;
    let hint;
    let speakText = '';

    if (mode === 'reading') {
      const correct = { text: item.reading, correct: true, note: `${item.word} อ่านว่า ${item.reading}` };
      const distractors = pool.slice(0, 3).map((d) => ({ text: d.reading, note: `คำอ่านนี้เป็นของ ${d.word}（${d.reading}）` }));
      optionData = makeOptionEntries(correct, distractors, `${seed}-reading`);
      prompt = `คำอ่านของ「${item.word}」คือข้อใด`;
      hint = 'อ่านตัวคันจิก่อน แล้วค่อยเทียบเสียงทีละส่วน';
      speakText = item.word;
    } else if (mode === 'context') {
      const correct = { text: item.exampleTh, correct: true, note: `${item.word} = ${item.th}` };
      const distractors = pool.slice(0, 3).map((d) => ({ text: d.exampleTh, note: `ประโยคนี้เป็นความหมายของตัวอย่างคำว่า ${d.word}` }));
      optionData = makeOptionEntries(correct, distractors, `${seed}-context`);
      prompt = `ประโยคนี้หมายความว่าอย่างไร\n「${item.example}」`;
      hint = `จับคำสำคัญ「${item.word}」ก่อน ไม่ต้องแปลทุกคำ`;
      speakText = item.example;
    } else {
      const correct = { text: item.th, correct: true, note: `${item.word}（${item.reading}）= ${item.th}` };
      const distractors = pool.slice(0, 3).map((d) => ({ text: d.th, note: `ความหมายนี้เป็นของ ${d.word}（${d.reading}）` }));
      optionData = makeOptionEntries(correct, distractors, `${seed}-${mode}`);
      prompt = mode === 'audio' ? 'ฟังเสียง แล้วเลือกความหมายที่ถูกต้อง' : `「${item.word}」หมายถึงอะไร`;
      hint = mode === 'audio' ? 'แตะปุ่มเสียงได้หลายครั้ง ก่อนเลือกคำตอบ' : `คำอ่าน: ${item.reading}`;
      speakText = mode === 'audio' ? `${item.word}。${item.word}。` : item.word;
    }

    return {
      type: 'question',
      skill: 'vocab',
      subtype: mode,
      itemId: item.id,
      kicker: mode === 'reading' ? 'KANJI READING' : mode === 'context' ? 'CONTEXT' : mode === 'audio' ? 'LISTEN & CHOOSE' : 'VOCABULARY',
      prompt,
      hint,
      options: optionData.options,
      optionNotes: optionData.notes,
      answer: optionData.answer,
      speakText,
      explanation: `${item.word}（${item.reading}）หมายถึง “${item.th}” · ${item.tip} · ตัวอย่าง: ${item.example} (${item.exampleTh})`,
    };
  }

  function makeIntroCard(item) {
    return { type: 'intro', skill: 'vocab', itemId: item.id };
  }

  function makeGrammarCard(grammar) {
    const optionData = shuffleExistingOptions(
      grammar.options,
      grammar.answer,
      `${localISO()}-${grammar.id}-${state.stats.grammar.attempts}`,
      (text) => `ตัวเลือก「${text}」ไม่ตรงกับรูปหรือความหมายที่โจทย์ต้องการ`,
    );
    return {
      type: 'question', skill: 'grammar', subtype: 'grammar', grammarId: grammar.id,
      kicker: 'GRAMMAR MAINTENANCE', prompt: grammar.question,
      hint: `${grammar.pattern} = ${grammar.th}`,
      options: optionData.options, optionNotes: optionData.optionNotes, answer: optionData.answer,
      explanation: `${grammar.why} · รูปประโยค: ${grammar.formation} · ${grammar.contrast}`,
    };
  }

  function makeReadingCard(reading) {
    const optionData = shuffleExistingOptions(
      reading.options,
      reading.answer,
      `${localISO()}-${reading.id}-${state.stats.reading.attempts}`,
      (text) => `บทอ่านไม่ได้สนับสนุนคำตอบ「${text}」 ให้ย้อนดูเวลา เงื่อนไข หรือสิ่งที่ผู้เขียนสั่ง`,
    );
    return {
      type: 'question', skill: 'reading', subtype: 'reading', readingId: reading.id,
      kicker: 'READING SPRINT', prompt: reading.question, hint: 'อ่านคำถามก่อน แล้วหาประโยคที่มีข้อมูลตรงกัน',
      passage: reading.text, title: reading.title,
      options: optionData.options, optionNotes: optionData.optionNotes, answer: optionData.answer,
      explanation: reading.explanation,
    };
  }

  function makeListeningCard(listening) {
    const optionData = shuffleExistingOptions(
      listening.options,
      listening.answer,
      `${localISO()}-${listening.id}-${state.stats.listening.attempts}`,
      (text) => `เสียงไม่ได้สรุปว่า「${text}」 ให้ฟังคำเปลี่ยนแผน เวลา และคำปฏิเสธอีกครั้ง`,
    );
    return {
      type: 'question', skill: 'listening', subtype: 'listening', listeningId: listening.id,
      kicker: 'LISTENING SPRINT', prompt: listening.question,
      hint: 'ฟังรอบแรกเพื่อจับ “ใคร–เวลา–สิ่งที่ต้องทำ” ก่อน',
      script: listening.script, title: listening.title,
      options: optionData.options, optionNotes: optionData.optionNotes, answer: optionData.answer,
      explanation: listening.explanation,
      speakText: listening.script.replace(/(?:女|男|先生|店員|駅の放送|受付|天気予報|配達員)：/g, '。'),
    };
  }

  function buildDailyLesson() {
    const plan = planSettings();
    const today = localISO();
    const dayIndex = daysBetween(CONTENT.meta.planStart, today);
    const due = getDueItems().slice(0, plan.reviews).map(({ item }) => item);
    const newItems = getNewItems(plan.newWords);
    const cards = [];

    newItems.forEach((item, index) => {
      cards.push(makeIntroCard(item));
      cards.push(makeVocabQuestion(item, `${today}-new-${index}`, index % 2 === 0 ? 'meaning' : 'reading'));
    });

    due.forEach((item, index) => {
      cards.push(makeVocabQuestion(item, `${today}-due-${index}`));
    });

    for (let i = 0; i < plan.micro; i += 1) {
      const skill = getDailySkill(dayIndex + i);
      if (skill === 'reading') cards.push(makeReadingCard(pickByDate(CONTENT.readings, 'daily-reading', i)));
      if (skill === 'listening') cards.push(makeListeningCard(pickByDate(CONTENT.listenings, 'daily-listening', i)));
      if (skill === 'grammar') cards.push(makeGrammarCard(pickByDate(CONTENT.grammar, 'daily-grammar', i)));
    }

    if (cards.length === 0) {
      const reinforcement = PERSONALIZED_VOCAB_ORDER.slice(0, 5);
      reinforcement.forEach((item, index) => cards.push(makeVocabQuestion(item, `${today}-fallback-${index}`)));
    }

    return {
      id: `daily-${today}`,
      mode: 'daily',
      title: 'Daily Sprint',
      plannedMinutes: plan.minutes,
      cards: seededInterleave(cards, `${today}-daily-order`),
    };
  }

  function seededInterleave(cards, seed) {
    const intros = cards.filter((c) => c.type === 'intro');
    const questions = cards.filter((c) => c.type === 'question');
    const result = [];
    const introIds = new Set();
    intros.forEach((intro) => {
      result.push(intro);
      introIds.add(intro.itemId);
      const immediate = questions.find((q) => q.itemId === intro.itemId);
      if (immediate) result.push(immediate);
    });
    const used = new Set(result.map((c) => cardKey(c)));
    const rest = seededShuffle(questions.filter((q) => !used.has(cardKey(q))), seed);
    result.push(...rest);
    return result;
  }

  function cardKey(card) {
    return `${card.type}-${card.skill}-${card.itemId || card.grammarId || card.readingId || card.listeningId || ''}-${card.subtype || ''}`;
  }

  function buildModeLesson(mode, options = {}) {
    const today = localISO();
    const cards = [];
    if (mode === 'vocab') {
      const newItems = getNewItems(5);
      const items = newItems.length ? newItems : PERSONALIZED_VOCAB_ORDER.slice(0, 5);
      items.forEach((item, index) => {
        if (!state.srs[item.id]) cards.push(makeIntroCard(item));
        cards.push(makeVocabQuestion(item, `${today}-mode-vocab-${index}`));
      });
    } else if (mode === 'review') {
      let items = getDueItems().map(({ item }) => item);
      if (!items.length) items = getWeakItems().map(({ item }) => item);
      if (!items.length) items = PERSONALIZED_VOCAB_ORDER.filter((item) => state.srs[item.id]).slice(0, 10);
      if (!items.length) items = PERSONALIZED_VOCAB_ORDER.slice(0, 8);
      items.slice(0, 12).forEach((item, index) => cards.push(makeVocabQuestion(item, `${today}-review-${index}`)));
    } else if (mode === 'reading') {
      seededShuffle(CONTENT.readings, `${today}-reading-mode`).slice(0, 3).forEach((item) => cards.push(makeReadingCard(item)));
    } else if (mode === 'listening') {
      seededShuffle(CONTENT.listenings, `${today}-listening-mode`).slice(0, 3).forEach((item) => cards.push(makeListeningCard(item)));
    } else if (mode === 'grammar') {
      seededShuffle(CONTENT.grammar, `${today}-grammar-mode-${state.stats.grammar.attempts}`).slice(0, 5).forEach((item) => cards.push(makeGrammarCard(item)));
    } else if (mode === 'theme') {
      const theme = options.theme;
      const items = CONTENT.vocab.filter((item) => item.theme === theme);
      seededShuffle(items, `${today}-theme-${theme}`).slice(0, 7).forEach((item, index) => {
        if (!state.srs[item.id]) cards.push(makeIntroCard(item));
        cards.push(makeVocabQuestion(item, `${today}-theme-${theme}-${index}`));
      });
    } else if (mode === 'single') {
      const item = VOCAB_BY_ID.get(options.itemId);
      if (item) {
        if (!state.srs[item.id]) cards.push(makeIntroCard(item));
        ['meaning', 'reading', 'context', 'audio'].forEach((type, index) => cards.push(makeVocabQuestion(item, `${today}-single-${index}`, type)));
      }
    }
    return {
      id: `${mode}-${today}-${Date.now()}`,
      mode,
      title: options.title || `${mode} sprint`,
      plannedMinutes: ['reading', 'listening', 'grammar'].includes(mode) ? 12 : 15,
      cards,
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
    };
    $('lessonOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    renderLessonCard();
  }

  function closeLesson(force = false) {
    if (!activeLesson) return;
    stopQuestionTimer();
    if (!force && activeLesson.index > 0 && !activeLesson.finished) {
      if (!window.confirm('ออกจากบทเรียนตอนนี้หรือไม่? ความคืบหน้าที่ตอบไปแล้วถูกบันทึกไว้แล้ว')) return;
    }
    stopSpeech();
    $('lessonOverlay').classList.remove('open');
    document.body.style.overflow = '';
    activeLesson = null;
    renderAll();
  }

  function renderLessonCard() {
    stopQuestionTimer();
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
      ensureSrs(item.id);
      saveState();
      const theme = CONTENT.themeLabels[item.theme];
      main.innerHTML = `
        <div class="lesson-kicker">NEW WORD · ${escapeHtml(theme.th)}</div>
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
      action.disabled = false;
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

  function renderQuestion(card, main) {
    let body = `<div class="lesson-question-top"><div class="lesson-kicker">${escapeHtml(card.kicker)}</div><div class="question-timer" id="questionTimer">⏱ 00:00</div></div><h2 class="lesson-question" id="lessonTitle">${escapeHtml(card.prompt).replace(/\n/g, '<br>')}</h2>`;
    if (card.hint) body += `<p class="lesson-hint">${escapeHtml(card.hint)}</p>`;

    if (card.subtype === 'reading') {
      body += `<article class="passage-card"><h3 class="passage-title">${escapeHtml(card.title)}</h3><p class="passage-text">${escapeHtml(card.passage)}</p></article>`;
    }

    if (card.subtype === 'listening') {
      body += `
        <article class="listening-card">
          <button type="button" class="audio-orb" data-speak="${escapeAttr(card.speakText)}" aria-label="เล่นเสียง">▶</button>
          <div class="audio-status">แตะเพื่อฟัง · ฟังซ้ำได้</div>
          <div class="script-reveal hidden" id="currentScript"><strong>Script</strong><br>${escapeHtml(card.script)}</div>
        </article>`;
    } else if (card.subtype === 'audio') {
      body += `
        <article class="listening-card">
          <button type="button" class="audio-orb" data-speak="${escapeAttr(card.speakText)}" aria-label="เล่นเสียงคำศัพท์">🔊</button>
          <div class="audio-status">แตะฟังคำศัพท์ แล้วเลือกความหมาย</div>
        </article>`;
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
    startQuestionTimer();
    if (card.subtype === 'audio' && state.profile.sound) {
      window.setTimeout(() => speakJapanese(card.speakText), 380);
    }
  }

  function handleLessonAction(card) {
    if (!activeLesson.answered) {
      gradeCurrentQuestion(card);
      return;
    }
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

    const stat = state.stats[card.skill];
    stat.attempts += 1;
    if (correct) stat.correct += 1;
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

    if (card.subtype === 'listening') $('currentScript')?.classList.remove('hidden');

    let explanation = card.explanation;
    if (!correct && card.optionNotes?.[selected]) explanation = `${card.optionNotes[selected]} · ${explanation}`;
    if (elapsedSeconds) explanation = `${explanation} · ใช้เวลา ${formatElapsed(elapsedSeconds)}`;
    showFeedback(correct, explanation);
    $('lessonActionBtn').textContent = activeLesson.index === activeLesson.cards.length - 1 ? 'ดูสรุป' : 'ไปต่อ';
    $('lessonActionBtn').disabled = false;
    $('lessonEnergy').textContent = `💚 ${activeLesson.energy}`;

    if (!correct) recordMistake(card, selected);
    saveState();
  }

  function recordMistake(card, selected) {
    const key = `${card.skill}:${card.itemId || card.grammarId || card.readingId || card.listeningId || cardKey(card)}`;
    const existing = state.mistakes.find((m) => m.key === key);
    const record = {
      key,
      skill: card.skill,
      itemId: card.itemId || null,
      grammarId: card.grammarId || null,
      prompt: card.prompt,
      selected: card.options[selected] || '',
      correct: card.options[card.answer] || '',
      explanation: card.optionNotes?.[selected] ? `${card.optionNotes[selected]} · ${card.explanation}` : card.explanation,
      date: localISO(),
      count: (existing?.count || 0) + 1,
    };
    if (existing) Object.assign(existing, record);
    else state.mistakes.unshift(record);
    state.mistakes = state.mistakes.sort((a, b) => b.date.localeCompare(a.date) || b.count - a.count).slice(0, 120);
    activeLesson.wrongItems.push(record);
  }

  function showFeedback(correct, text) {
    const panel = $('feedbackPanel');
    panel.className = `feedback-panel show ${correct ? 'correct' : 'wrong'}`;
    $('feedbackTitle').textContent = correct ? '✅ ถูกต้อง เก่งมาก!' : '🧠 ยังไม่ใช่ แต่ข้อนี้จะกลับมาอีก';
    $('feedbackText').textContent = text;
  }

  function renderLessonSummary() {
    stopQuestionTimer();
    stopSpeech();
    if (!activeLesson.finished) completeLesson();
    $('lessonProgressFill').style.width = '100%';
    const accuracy = activeLesson.attempts ? Math.round(activeLesson.correct / activeLesson.attempts * 100) : 100;
    const weakText = activeLesson.wrongItems.length
      ? activeLesson.wrongItems.slice(0, 3).map((m) => m.itemId ? VOCAB_BY_ID.get(m.itemId)?.word : SKILL_LABELS[m.skill].th).filter(Boolean).join('、')
      : 'ไม่มีข้อผิดในรอบนี้';
    $('lessonMain').innerHTML = `
      <section class="lesson-summary">
        <div class="summary-mascot" data-mascot="celebrate"></div>
        <h2 id="lessonTitle">จบรอบแล้ว!</h2>
        <p>${accuracy >= 80 ? 'ทำได้ดีมาก รักษาความสม่ำเสมอแบบนี้ต่อไป' : 'ข้อผิดถูกบันทึกเข้าคิวทบทวนแล้ว รอบหน้าจะง่ายขึ้นทีละนิด'}</p>
        <div class="reward-grid">
          <div class="reward-card"><strong>+${activeLesson.xpEarned}</strong><span>XP รอบนี้</span></div>
          <div class="reward-card"><strong>${accuracy}%</strong><span>ความแม่นยำ</span></div>
          <div class="reward-card"><strong>${state.streak}</strong><span>วันต่อเนื่อง</span></div>
        </div>
        <div class="weak-review"><h3>🔁 คิวถัดไป</h3><p>${escapeHtml(weakText)}${activeLesson.wrongItems.length ? ' จะถูกถามซ้ำเร็วขึ้นตามระบบ SRS' : ' — พรุ่งนี้ระบบจะเลือกคำใหม่และทักษะถัดไปให้'}</p></div>
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
      id: activeLesson.id,
      date: today,
      mode: activeLesson.mode,
      correct: activeLesson.correct,
      attempts: activeLesson.attempts,
      xp: activeLesson.xpEarned,
      durationEstimate: activeLesson.plannedMinutes,
    });
    state.lessonHistory = state.lessonHistory.slice(0, 365);
    saveState();
  }

  function mascotSVG(variant = 'icon') {
    const wave = variant === 'wave';
    const celebrate = variant === 'celebrate';
    return `
      <svg viewBox="0 0 180 180" role="img" aria-label="มาสคอตโมจิสีเขียว">
        <defs>
          <linearGradient id="mBody-${variant}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#62d7bd"/><stop offset="1" stop-color="#2aa88f"/></linearGradient>
          <linearGradient id="mBg-${variant}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5faf4"/><stop offset="1" stop-color="#eeeaff"/></linearGradient>
        </defs>
        <rect width="180" height="180" rx="42" fill="url(#mBg-${variant})"/>
        ${celebrate ? '<path d="M28 32l7 12 13 2-10 9 3 13-13-7-12 7 3-13-10-9 13-2z" fill="#ffbf47"/><path d="M145 20l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#7d6fe8"/>' : ''}
        <ellipse cx="90" cy="145" rx="50" ry="10" fill="#1d6e61" opacity=".15"/>
        <path d="M47 78c0-37 19-58 43-58s43 21 43 58v42c0 25-18 41-43 41s-43-16-43-41z" fill="url(#mBody-${variant})"/>
        <path d="M53 63C41 51 42 35 55 29c9 9 14 19 14 30z" fill="#36b39a"/>
        <path d="M127 63c12-12 11-28-2-34-9 9-14 19-14 30z" fill="#36b39a"/>
        <ellipse cx="72" cy="82" rx="18" ry="21" fill="#fff"/>
        <ellipse cx="108" cy="82" rx="18" ry="21" fill="#fff"/>
        <circle cx="75" cy="85" r="8" fill="#173a33"/>
        <circle cx="105" cy="85" r="8" fill="#173a33"/>
        <circle cx="78" cy="81" r="2.7" fill="#fff"/>
        <circle cx="108" cy="81" r="2.7" fill="#fff"/>
        <ellipse cx="58" cy="102" rx="9" ry="5" fill="#ff8d91" opacity=".72"/>
        <ellipse cx="122" cy="102" rx="9" ry="5" fill="#ff8d91" opacity=".72"/>
        <path d="M82 101c5 4 11 4 16 0-1 9-15 9-16 0z" fill="#173a33"/>
        <path d="M67 121c13 7 33 7 46 0v25c-13 7-33 7-46 0z" fill="#fff" opacity=".95"/>
        <path d="M90 125v22" stroke="#d6ece7" stroke-width="3"/>
        <path d="M51 106c-13 5-20 16-18 28 8-7 15-10 23-9" fill="none" stroke="#2aa88f" stroke-width="14" stroke-linecap="round"/>
        <g transform="${wave ? 'rotate(-24 127 105)' : celebrate ? 'rotate(24 127 105)' : 'rotate(5 127 105)'}">
          <path d="M129 106c14 4 23 14 24 27-9-6-17-8-26-6" fill="none" stroke="#2aa88f" stroke-width="14" stroke-linecap="round"/>
        </g>
        ${wave ? '<path d="M154 85c7-6 11-13 10-21M160 96c8-2 14-7 18-13" fill="none" stroke="#ffbf47" stroke-width="4" stroke-linecap="round"/>' : ''}
      </svg>`;
  }

  function injectMascots(root = document) {
    $$('[data-mascot]', root).forEach((node) => {
      node.innerHTML = mascotSVG(node.dataset.mascot || 'icon');
    });
  }

  function bindSpeakButtons(root = document) {
    $$('[data-speak]', root).forEach((button) => {
      button.addEventListener('click', () => speakJapanese(button.dataset.speak || ''));
    });
  }

  function refreshVoices() {
    if (!('speechSynthesis' in window)) return;
    japaneseVoices = window.speechSynthesis.getVoices().filter((voice) => voice.lang?.toLowerCase().startsWith('ja'));
  }

  function speakJapanese(text) {
    if (!state.profile.sound) {
      showToast('เปิดเสียงอ่านได้ที่ Settings');
      return;
    }
    if (!('speechSynthesis' in window)) {
      showToast('อุปกรณ์นี้ไม่รองรับเสียงอ่านอัตโนมัติ');
      return;
    }
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.84;
    utterance.pitch = 1.03;
    if (japaneseVoices[0]) utterance.voice = japaneseVoices[0];
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/\n/g, ' ');
  }

  function accuracy(skill) {
    const stat = state.stats[skill];
    return stat.attempts ? Math.round(stat.correct / stat.attempts * 100) : null;
  }

  function learnedCount() {
    return Object.keys(state.srs).filter((id) => VOCAB_BY_ID.has(id)).length;
  }

  function masteredCount() {
    return Object.values(state.srs).filter((srs) => srs.interval >= 7 && srs.attempts >= 2 && srs.correct / srs.attempts >= 0.75).length;
  }

  function projectedScore() {
    const baseline = CONTENT.meta.baseline.total;
    const learned = learnedCount();
    const mastered = masteredCount();
    const studyDays = Object.keys(state.completedDates).length;
    const totalAttempts = Object.values(state.stats).reduce((sum, stat) => sum + stat.attempts, 0);
    const totalCorrect = Object.values(state.stats).reduce((sum, stat) => sum + stat.correct, 0);
    const overallAccuracy = totalAttempts ? totalCorrect / totalAttempts : 0.5;
    const practiceEstimate = baseline
      + Math.min(10, learned * 0.045)
      + Math.min(7, mastered * 0.075)
      + Math.min(6, studyDays * 0.12)
      + Math.max(0, (overallAccuracy - 0.55) * 16);
    if (state.mockScores.length) {
      const latest = [...state.mockScores].sort((a, b) => b.date.localeCompare(a.date))[0];
      return clamp(Math.round(latest.total * 0.75 + practiceEstimate * 0.25), 0, 180);
    }
    return clamp(Math.round(practiceEstimate), baseline, 125);
  }

  function renderAll() {
    applyTheme();
    renderTopbar();
    renderHome();
    renderLearn();
    renderReview();
    renderProgress();
    renderSettings();
    updateNotificationStatus();
  }

  function renderTopbar() {
    $('topStreak').textContent = state.streak;
    $('topXp').textContent = state.xp;
    const phase = getPhase();
    $('topbarSubtitle').textContent = `${phase.name} · ${Math.max(0, daysBetween(localISO(), state.profile.examDate))} วันถึงสอบ`;
  }

  function renderHome() {
    const today = localISO();
    const left = daysBetween(today, state.profile.examDate);
    const phase = getPhase();
    const plan = planSettings();
    const due = getDueItems().length;
    const skill = getDailySkill(daysBetween(CONTENT.meta.planStart, today));
    const completed = Boolean(state.completedDates[today]);

    $('daysLeft').textContent = Math.max(0, left);
    $('todayDateLabel').textContent = formatThaiDate(today, { weekday: 'long', day: 'numeric', month: 'short' });
    $('phaseChip').textContent = phase.short;
    $('dailyPlanTitle').textContent = `${phase.name} · ${plan.minutes} นาที`;
    $('dailyPlanSubtitle').textContent = `${phase.description} · มี ${due} คำถึงกำหนดทบทวน`;
    $('startDailyBtn').textContent = completed ? 'ฝึกเพิ่มอีกหนึ่งรอบ' : 'เริ่มบทเรียนวันนี้';

    const quests = [
      plan.newWords > 0
        ? { icon: '🧠', name: `ศัพท์ใหม่ ${plan.newWords} คำ`, desc: 'คำอ่าน + ความหมาย + ประโยคงาน/ชีวิต', minutes: Math.round(plan.minutes * 0.4) }
        : { icon: '🎯', name: 'งดศัพท์ใหม่ในช่วง Final', desc: 'ใช้เวลาเก็บคำที่ผิดและคำที่ถึงกำหนดให้แม่น', minutes: Math.round(plan.minutes * 0.3) },
      { icon: '🔁', name: `ทบทวนสูงสุด ${plan.reviews} คำ`, desc: due ? `${due} คำกำลังรอในคิว SRS` : 'ระบบจะเลือกคำที่อ่อนที่สุดให้', minutes: Math.round(plan.minutes * 0.3) },
      { icon: SKILL_LABELS[skill].icon, name: `${SKILL_LABELS[skill].th} Micro Sprint × ${plan.micro}`, desc: skill === 'grammar' ? 'รักษา Grammar A และสลับ Reading/Listening' : 'แบบฝึกสั้นพร้อมอธิบายจุดชี้คำตอบ', minutes: Math.max(4, Math.round(plan.minutes * 0.4)) },
    ];
    $('dailyQuestList').innerHTML = quests.map((q) => `
      <div class="quest-item"><div class="quest-icon">${q.icon}</div><div><div class="quest-name">${escapeHtml(q.name)}</div><div class="quest-desc">${escapeHtml(q.desc)}</div></div><div class="quest-minutes">~${q.minutes} นาที</div></div>`).join('');

    const projection = projectedScore();
    $('projectedScore').textContent = projection;
    $('scoreRing').style.setProperty('--p', `${clamp(projection / CONTENT.meta.baseline.targetTotal * 100, 0, 100)}%`);
    const vAcc = accuracy('vocab');
    const gAcc = accuracy('grammar');
    const lAcc = accuracy('listening');
    $('homeVocabBar').style.width = `${vAcc ?? 45}%`;
    $('homeGrammarBar').style.width = `${gAcc ?? 74}%`;
    $('homeListeningBar').style.width = `${lAcc ?? 40}%`;
    $('homeVocabLabel').textContent = vAcc == null ? 'B' : `${vAcc}%`;
    $('homeGrammarLabel').textContent = gAcc == null ? 'A' : `${gAcc}%`;
    $('homeListeningLabel').textContent = lAcc == null ? '24' : `${lAcc}%`;

    renderWeekStrip();
    const insight = INSIGHTS[hashString(today) % INSIGHTS.length];
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
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = localISO(d);
      const done = Boolean(state.completedDates[iso]);
      if (done) doneCount += 1;
      days.push(`<div class="day-dot ${done ? 'done' : ''} ${iso === localISO() ? 'today' : ''}"><span>${new Intl.DateTimeFormat('th-TH', { weekday: 'narrow' }).format(d)}</span><span class="dot">${done ? '✓' : d.getDate()}</span></div>`);
    }
    $('weekStrip').innerHTML = days.join('');
    $('weekGoalLabel').textContent = `${doneCount}/5 วันเป้าหมาย`;
  }

  function renderLearn() {
    $('learnedCount').textContent = learnedCount();
    $('dueCount').textContent = getDueItems().length;
    const vAcc = accuracy('vocab');
    $('accuracyCount').textContent = vAcc == null ? '—' : `${vAcc}%`;

    const countsByTheme = {};
    Object.entries(state.srs).forEach(([id]) => {
      const item = VOCAB_BY_ID.get(id);
      if (item) countsByTheme[item.theme] = (countsByTheme[item.theme] || 0) + 1;
    });
    $('themeList').innerHTML = Object.entries(CONTENT.themeLabels).map(([theme, label]) => {
      const total = CONTENT.vocab.filter((item) => item.theme === theme).length;
      const learned = countsByTheme[theme] || 0;
      return `<button type="button" class="theme-row" data-theme-practice="${theme}"><span class="theme-icon">${label.icon}</span><span><h4>${escapeHtml(label.th)}</h4><p>${learned}/${total} คำเริ่มเรียนแล้ว</p></span><span class="theme-progress">ฝึก ›</span></button>`;
    }).join('');
    $$('[data-theme-practice]').forEach((button) => {
      button.addEventListener('click', () => startLesson(buildModeLesson('theme', { theme: button.dataset.themePractice, title: CONTENT.themeLabels[button.dataset.themePractice].th })));
    });
  }

  function renderReview() {
    const query = ($('wordSearch')?.value || '').trim().toLowerCase();
    let items;
    if (reviewFilter === 'due') items = getDueItems().map(({ item, srs }) => ({ item, srs }));
    else if (reviewFilter === 'weak') items = getWeakItems();
    else items = CONTENT.vocab.map((item) => ({ item, srs: state.srs[item.id] || null }));

    if (query) {
      items = items.filter(({ item }) => [item.word, item.reading, item.th, item.en].some((value) => value.toLowerCase().includes(query)));
    }

    const list = items.slice(0, 60);
    if (!list.length) {
      $('wordList').innerHTML = `<div class="empty-state"><div class="big">${reviewFilter === 'due' ? '🌿' : '🔎'}</div><h3>${query ? 'ไม่พบคำที่ค้นหา' : 'คิวนี้ว่างแล้ว'}</h3><p>${reviewFilter === 'due' ? 'เมื่อเรียนคำใหม่หรือถึงวันทบทวน คำจะปรากฏที่นี่' : 'ลองเปลี่ยนตัวกรองหรือค้นด้วยคำอ่าน'}</p></div>`;
    } else {
      $('wordList').innerHTML = list.map(({ item, srs }) => {
        const rate = srs?.attempts ? Math.round(srs.correct / srs.attempts * 100) : null;
        const className = rate == null ? '' : rate < 70 ? 'weak' : srs.interval >= 7 ? 'good' : '';
        const badge = srs ? (rate == null ? 'ใหม่' : `${rate}%`) : 'ยังไม่เรียน';
        return `<button type="button" class="word-row" data-word-id="${item.id}"><span class="word-main"><span class="word-jp">${escapeHtml(item.word)}</span><span class="word-reading">${escapeHtml(item.reading)}</span><span class="word-th">${escapeHtml(item.th)}</span></span><span class="mastery-badge ${className}">${badge}</span></button>`;
      }).join('');
      $$('[data-word-id]', $('wordList')).forEach((button) => button.addEventListener('click', () => openWordModal(button.dataset.wordId)));
    }

    renderMistakes();
  }

  function renderMistakes() {
    if (!state.mistakes.length) {
      $('mistakeList').innerHTML = '<div class="empty-state"><div class="big">✨</div><h3>ยังไม่มีข้อผิดที่บันทึก</h3><p>เมื่อผิด ระบบจะเก็บคำอธิบายและเพิ่มข้อนั้นเข้าคิวทบทวน</p></div>';
      return;
    }
    $('mistakeList').innerHTML = `<div class="mistake-stack">${state.mistakes.slice(0, 10).map((m) => {
      const item = m.itemId ? VOCAB_BY_ID.get(m.itemId) : null;
      const title = item ? `${item.word}（${item.reading}）` : `${SKILL_LABELS[m.skill]?.icon || '📝'} ${SKILL_LABELS[m.skill]?.th || m.skill}`;
      return `<details class="mistake-card"><summary><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(m.date)} · ผิด ${m.count} ครั้ง</small></span><span class="details-arrow">⌄</span></summary><div class="mistake-body"><p><strong>โจทย์:</strong> ${escapeHtml(m.prompt)}</p><p class="wrong-answer"><strong>คำตอบที่เลือก:</strong> ${escapeHtml(m.selected)}</p><p class="right-answer"><strong>คำตอบที่ถูก:</strong> ${escapeHtml(m.correct)}</p><p><strong>เหตุผล:</strong> ${escapeHtml(m.explanation)}</p></div></details>`;
    }).join('')}</div>`;
  }

  function openWordModal(itemId) {
    const item = VOCAB_BY_ID.get(itemId);
    if (!item) return;
    const srs = state.srs[itemId];
    const theme = CONTENT.themeLabels[item.theme];
    const status = srs ? `ทบทวนครั้งถัดไป: ${formatThaiDate(srs.due, { day: 'numeric', month: 'short' })} · ช่วงห่าง ${srs.interval} วัน` : 'ยังไม่ได้เริ่มเรียนคำนี้';
    $('wordModalBody').innerHTML = `
      <h2 id="wordModalTitle">${escapeHtml(item.word)} <small style="color:var(--muted);font-size:.7em">${escapeHtml(item.reading)}</small></h2>
      <p><span class="theme-tag">${theme.icon} ${escapeHtml(theme.th)}</span></p>
      <div class="big-meaning" style="text-align:left">${escapeHtml(item.th)}</div>
      <div class="big-en" style="text-align:left">${escapeHtml(item.en)}</div>
      <div class="example-box"><div class="example-jp">${escapeHtml(item.example)}</div><div class="example-th">${escapeHtml(item.exampleTh)}</div></div>
      <div class="memory-tip"><span>🧷</span><span>${escapeHtml(item.tip)}</span></div>
      <p style="margin-top:12px">${escapeHtml(status)}</p>
      <div class="modal-actions"><button type="button" class="ghost-btn" data-speak="${escapeAttr(item.word + '。' + item.example)}">🔊 ฟังเสียง</button><button type="button" class="primary-btn" id="practiceSingleWord">ฝึกคำนี้</button></div>
      <button type="button" class="ghost-btn full" style="width:100%;margin-top:11px" data-close-modal="wordModal">ปิด</button>`;
    $('wordModal').classList.add('open');
    bindSpeakButtons($('wordModalBody'));
    $('practiceSingleWord').addEventListener('click', () => {
      $('wordModal').classList.remove('open');
      startLesson(buildModeLesson('single', { itemId, title: item.word }));
    });
    bindModalCloseButtons();
  }

  function renderProgress() {
    $('progressStreak').textContent = state.streak;
    $('progressXp').textContent = state.xp;
    $('progressLearned').textContent = learnedCount();
    $('progressMastered').textContent = masteredCount();
    const xpInLevel = state.xp % 100;
    $('xpNextLabel').textContent = `อีก ${xpInLevel === 0 ? 100 : 100 - xpInLevel} XP ถึงเลเวลถัดไป`;

    const defaults = { vocab: 45, grammar: 74, reading: 45, listening: 40 };
    const classes = { vocab: 'danger', grammar: 'secondary', reading: 'accent', listening: '' };
    $('skillBars').innerHTML = ['vocab', 'grammar', 'reading', 'listening'].map((skill) => {
      const value = accuracy(skill) ?? defaults[skill];
      const attempts = state.stats[skill].attempts;
      return `<div><div class="skill-row-header"><span>${SKILL_LABELS[skill].icon} ${SKILL_LABELS[skill].th}</span><strong>${attempts ? `${value}% · ${attempts} ข้อ` : `ฐานเริ่มต้น ${value}%`}</strong></div><div class="progress-track"><div class="progress-fill ${classes[skill]}" style="width:${value}%"></div></div></div>`;
    }).join('');

    const projection = projectedScore();
    $('progressProjectedScore').textContent = projection;
    $('progressScoreRing').style.setProperty('--p', `${clamp(projection / 180 * 100, 0, 100)}%`);
    $('progressScoreText').textContent = state.mockScores.length ? `ประมาณการล่าสุด ${projection}/180` : `เริ่มจากคะแนนจริง ${CONTENT.meta.baseline.total}`;

    if (!state.mockScores.length) {
      $('mockList').innerHTML = '<div class="empty-state"><div class="big">📝</div><h3>ยังไม่มีคะแนน Mock</h3><p>ช่วง Exam Mode แนะนำให้กรอกคะแนนอย่างน้อยสัปดาห์ละหนึ่งครั้ง</p></div>';
    } else {
      const sorted = [...state.mockScores].sort((a, b) => b.date.localeCompare(a.date));
      $('mockList').innerHTML = sorted.map((mock, index) => `<div class="mock-row"><span><strong>Mock ${sorted.length - index}</strong><br><time>${formatThaiDate(mock.date, { day: 'numeric', month: 'short', year: 'numeric' })}${mock.note ? ` · ${escapeHtml(mock.note)}` : ''}</time></span><span class="mock-score">${mock.total}/180</span><button type="button" class="icon-btn" data-delete-mock="${mock.id}" aria-label="ลบคะแนน">🗑️</button></div>`).join('');
      $$('[data-delete-mock]').forEach((button) => button.addEventListener('click', () => {
        state.mockScores = state.mockScores.filter((m) => m.id !== button.dataset.deleteMock);
        saveState();
        renderProgress();
      }));
    }
  }

  function renderSettings() {
    $('dailyMinutesSelect').value = String(state.profile.dailyMinutes);
    $('reminderTimeInput').value = state.profile.reminderTime;
    $('soundToggle').checked = Boolean(state.profile.sound);
    $('darkToggle').checked = Boolean(state.profile.dark);
    $('examDateInput').value = state.profile.examDate;
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
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
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

  function openMockModal() {
    $('mockDate').value = localISO();
    $('mockLang').value = '';
    $('mockListen').value = '';
    $('mockNote').value = '';
    $('mockModal').classList.add('open');
  }

  function bindModalCloseButtons() {
    $$('[data-close-modal]').forEach((button) => {
      button.onclick = () => $(button.dataset.closeModal).classList.remove('open');
    });
  }

  function notificationSupported() {
    return 'Notification' in window;
  }

  function updateNotificationStatus() {
    if (!notificationSupported()) {
      $('notificationStatus').textContent = 'เบราว์เซอร์นี้ไม่รองรับ Notification';
      $('notificationBtn').disabled = true;
      return;
    }
    const permission = Notification.permission;
    $('notificationStatus').textContent = permission === 'granted' ? `อนุญาตแล้ว · เตือน ${state.profile.reminderTime}` : permission === 'denied' ? 'ถูกปฏิเสธใน Browser Settings' : 'ยังไม่ได้อนุญาต';
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
    await showAppNotification('N4 Sprint พร้อมแล้ว 🌱', { body: 'ลองทำบทเรียนสั้น ๆ วันนี้ เพื่อรักษา Streak' });
    updateNotificationStatus();
  }

  async function showAppNotification(title, options = {}) {
    try {
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, { icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: 'n4-sprint-reminder', ...options });
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
    const [hour, minute] = state.profile.reminderTime.split(':').map(Number);
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (now >= due && now - due < 3 * 60 * 60 * 1000) {
      showAppNotification('ได้เวลา N4 Sprint แล้ว 🌱', { body: `วันนี้ใช้ประมาณ ${state.profile.dailyMinutes} นาที เน้นศัพท์และทักษะที่ถึงคิว` });
      state.lastReminderDate = today;
      saveState();
    }
  }

  function downloadICS() {
    const start = localISO() > CONTENT.meta.planStart ? localISO() : CONTENT.meta.planStart;
    const [hour, minute] = state.profile.reminderTime.split(':');
    const examIso = state.profile.examDate;
    const exam = examIso.replaceAll('-', '');
    const dayAfterExam = addDays(examIso, 1).replaceAll('-', '');
    const dailyUntil = addDays(examIso, -1).replaceAll('-', '');
    const startCompact = start.replaceAll('-', '');
    const uid = `n4-sprint-${Date.now()}@local`;
    const duration = Math.max(10, Number(state.profile.dailyMinutes) || 25);
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//N4 Sprint//Daily Study Plan//TH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Bangkok',
      'X-LIC-LOCATION:Asia/Bangkok',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0700',
      'TZOFFSETTO:+0700',
      'TZNAME:ICT',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:${uid}-daily`,
      `DTSTAMP:${utcStamp(new Date())}`,
      `DTSTART;TZID=Asia/Bangkok:${startCompact}T${hour}${minute}00`,
      `RRULE:FREQ=DAILY;UNTIL:${dailyUntil}T165900Z`,
      `DURATION:PT${duration}M`,
      'SUMMARY:N4 Sprint - Daily Japanese Practice',
      'DESCRIPTION:Vocabulary + SRS + Reading/Listening micro lesson. Open N4 Sprint and keep your streak.',
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Time for your N4 Sprint',
      'END:VALARM',
      'END:VEVENT',
      'BEGIN:VEVENT',
      `UID:${uid}-exam`,
      `DTSTAMP:${utcStamp(new Date())}`,
      `DTSTART;VALUE=DATE:${exam}`,
      `DTEND;VALUE=DATE:${dayAfterExam}`,
      'SUMMARY:JLPT N4 Exam Day',
      'DESCRIPTION:ตรวจเวลารายงานตัวและสนามสอบจาก Test Voucher อีกครั้ง เตรียมบัตรสอบ เอกสารยืนยันตัวตน ดินสอ และยางลบ',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:Tomorrow is JLPT N4 exam day',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    downloadBlob(lines.join('\r\n'), 'N4_Sprint_Daily_Reminders.ics', 'text/calendar;charset=utf-8');
    showToast('สร้างไฟล์ปฏิทินแล้ว');
  }

  function utcStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function exportProgress() {
    const payload = { app: 'N4 Sprint', version: CONTENT.meta.version, exportedAt: new Date().toISOString(), state };
    downloadBlob(JSON.stringify(payload, null, 2), `N4_Sprint_Backup_${localISO()}.json`, 'application/json');
    showToast('Export progress แล้ว');
  }

  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = parsed.state || parsed;
        if (!imported.profile || !imported.stats || !imported.srs) throw new Error('Invalid backup');
        state = {
          ...defaultState(),
          ...imported,
          profile: { ...defaultState().profile, ...imported.profile },
          stats: { ...defaultState().stats, ...imported.stats },
        };
        saveState();
        renderAll();
        showToast('Import progress สำเร็จ');
      } catch (error) {
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

  function finishOnboarding() {
    const selected = document.querySelector('input[name="goal"]:checked');
    state.profile.dailyMinutes = Number(selected?.value || 25);
    state.profile.onboardingDone = true;
    saveState();
    $('onboarding').classList.remove('open');
    renderAll();
    showToast('แผนส่วนตัวพร้อมแล้ว 🌱');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed:', error));
  }

  function bindEvents() {
    $$('.nav-btn').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    $('startDailyBtn').addEventListener('click', () => startLesson(buildDailyLesson()));
    $('lessonCloseBtn').addEventListener('click', () => closeLesson(false));

    $$('.mode-card').forEach((button) => button.addEventListener('click', () => startLesson(buildModeLesson(button.dataset.mode))));
    $('quickReviewBtn').addEventListener('click', () => startLesson(buildModeLesson('review')));

    $$('[data-review-filter]').forEach((button) => button.addEventListener('click', () => {
      reviewFilter = button.dataset.reviewFilter;
      $$('[data-review-filter]').forEach((b) => b.classList.toggle('active', b === button));
      renderReview();
    }));
    $('wordSearch').addEventListener('input', renderReview);
    $('clearMistakesBtn').addEventListener('click', () => {
      if (!state.mistakes.length) return;
      if (window.confirm('ล้างประวัติข้อผิดทั้งหมดหรือไม่? คิว SRS ของคำศัพท์จะยังคงอยู่')) {
        state.mistakes = [];
        saveState();
        renderReview();
      }
    });

    $('addMockBtn').addEventListener('click', openMockModal);
    $('mockForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const languageReading = clamp(Number($('mockLang').value), 0, 120);
      const listening = clamp(Number($('mockListen').value), 0, 60);
      state.mockScores.push({
        id: `mock-${Date.now()}`,
        date: $('mockDate').value,
        languageReading,
        listening,
        total: languageReading + listening,
        note: $('mockNote').value.trim(),
      });
      saveState();
      $('mockModal').classList.remove('open');
      renderProgress();
      showToast('บันทึกคะแนน Mock แล้ว');
    });

    $('dailyMinutesSelect').addEventListener('change', () => {
      state.profile.dailyMinutes = Number($('dailyMinutesSelect').value);
      saveState();
      renderHome();
      renderLearn();
    });
    $('reminderTimeInput').addEventListener('change', () => {
      state.profile.reminderTime = $('reminderTimeInput').value;
      state.lastReminderDate = null;
      saveState();
      updateNotificationStatus();
    });
    $('soundToggle').addEventListener('change', () => {
      state.profile.sound = $('soundToggle').checked;
      saveState();
      if (!state.profile.sound) stopSpeech();
    });
    $('darkToggle').addEventListener('change', () => {
      state.profile.dark = $('darkToggle').checked;
      saveState();
      applyTheme();
    });
    $('examDateInput').addEventListener('change', () => {
      state.profile.examDate = $('examDateInput').value || CONTENT.meta.examDate;
      saveState();
      renderTopbar();
      renderHome();
    });

    $('notificationBtn').addEventListener('click', requestNotification);
    $('calendarBtn').addEventListener('click', downloadICS);
    $('exportBtn').addEventListener('click', exportProgress);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', () => {
      if ($('importFile').files?.[0]) importProgress($('importFile').files[0]);
      $('importFile').value = '';
    });
    $('resetBtn').addEventListener('click', () => {
      if (!window.confirm('ลบความคืบหน้าทั้งหมดและเริ่มใหม่จริงหรือไม่?')) return;
      const settings = { ...state.profile };
      state = defaultState();
      state.profile = { ...state.profile, ...settings, onboardingDone: true };
      saveState();
      renderAll();
      showToast('เริ่มความคืบหน้าใหม่แล้ว');
    });

    $('finishOnboardingBtn').addEventListener('click', finishOnboarding);
    $$('.goal-choice').forEach((label) => label.addEventListener('click', () => {
      $$('.goal-choice').forEach((other) => other.classList.remove('selected'));
      label.classList.add('selected');
      label.querySelector('input').checked = true;
    }));

    $('installBtn').addEventListener('click', async () => {
      if (installPrompt) {
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        $('installBtn').disabled = true;
        $('installBtn').textContent = 'พร้อมใช้งาน';
      } else {
        showToast('เปิดผ่าน HTTPS แล้วใช้เมนู “เพิ่มไปยังหน้าจอโฮม”');
      }
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      installPrompt = event;
      $('installBtn').disabled = false;
      $('installDesc').textContent = 'พร้อมติดตั้งเป็นแอปบนหน้าจอมือถือ';
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      $('installBtn').textContent = 'ติดตั้งแล้ว';
      $('installBtn').disabled = true;
    });

    bindModalCloseButtons();
    $$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) backdrop.classList.remove('open');
    }));

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        reminderTick();
        renderAll();
      }
    });
  }

  function init() {
    injectMascots();
    refreshVoices();
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = refreshVoices;
    bindEvents();
    renderAll();
    applyTheme();
    registerServiceWorker();
    if (!state.profile.onboardingDone) $('onboarding').classList.add('open');
    reminderTick();
    window.setInterval(reminderTick, 60000);
  }

  init();
})();
