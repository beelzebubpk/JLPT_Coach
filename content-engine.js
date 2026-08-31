/*
 * JLPT Coach V2.1 — licensed content normalizer and coverage builder.
 * The engine is intentionally independent from the UI so future content packs can be
 * replaced without rewriting the adaptive-learning application.
 */
(() => {
  'use strict';

  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const LEVEL_RANK = Object.fromEntries(LEVELS.map((level, index) => [level, index]));

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    return String(value).split(/[;,、，／/]/).map(clean).filter(Boolean);
  }

  function normalizeLevel(value, fallback = 'N5') {
    const level = clean(value).toUpperCase();
    return LEVELS.includes(level) ? level : fallback;
  }

  function hashString(text) {
    let hash = 2166136261;
    const input = String(text ?? '');
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function stableId(prefix, ...parts) {
    return `${prefix}-${hashString(parts.map(clean).join('|'))}`;
  }

  function candidateKey(word, reading = '') {
    return `${clean(word).normalize('NFKC')}|${clean(reading).normalize('NFKC')}`.toLowerCase();
  }

  function containsLatin(text) {
    return /[A-Za-z]/.test(String(text ?? ''));
  }

  function containsHan(text) {
    return /[\u3400-\u9fff]/.test(String(text ?? ''));
  }

  function looksEnglish(text) {
    const value = clean(text);
    if (!value) return false;
    const latinCount = (value.match(/[A-Za-z]/g) || []).length;
    const hanCount = (value.match(/[\u3400-\u9fff]/g) || []).length;
    return latinCount >= 2 && latinCount >= hanCount * 2;
  }

  function firstExample(examples) {
    const values = Array.isArray(examples) ? examples : [];
    const first = values.find((item) => item && (item.ja || item.sentence || item.jp || item.japanese));
    if (!first) return { ja: '', translation: '' };
    return {
      ja: clean(first.ja || first.sentence || first.jp || first.japanese),
      translation: clean(first.en || first.translation_en || first.translation || first.translation_cn || first.th),
    };
  }

  function mapTheme(partOfSpeech, word) {
    const pos = clean(partOfSpeech).toLowerCase();
    if (/动|verb|v\.?$/.test(pos)) return 'verbs';
    if (/形|adjective|adj/.test(pos)) return 'adjectives';
    if (/副|adverb|adv/.test(pos)) return 'adverbs';
    if (/接|conjunction|conj/.test(pos)) return 'connectors';
    if (/数|number|counter/.test(pos) || /^[一二三四五六七八九十百千万億兆]+$/.test(clean(word))) return 'numbers';
    return 'general';
  }

  function normalizeBaseVocab(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => ({
      ...item,
      id: clean(item.id) || stableId('base-v', item.word, item.reading),
      level: normalizeLevel(item.level),
      sourceLevel: normalizeLevel(item.level),
      source: item.source || 'JLPT Coach curated starter content',
      sourceLicense: item.sourceLicense || 'Application content',
      sourcePriority: 0,
      sourceIndex: index,
      contentType: 'vocab',
      theme: item.theme || 'general',
      availableModes: Array.isArray(item.availableModes) ? item.availableModes : ['meaning', 'reading', 'context', 'audio'],
    })).filter((item) => item.word && item.reading);
  }

  function normalizeOpenVocab(payload, sourceLevel) {
    const array = Array.isArray(payload) ? payload : (payload?.words || payload?.vocab || payload?.data || []);
    return array.map((raw, index) => {
      const word = clean(raw.word || raw.expression || raw.term);
      const reading = clean(raw.reading || raw.kana || raw.furigana || word);
      const meanings = asArray(raw.meanings || raw.meaning || raw.glosses || raw.english);
      const english = meanings.join('; ');
      const example = firstExample(raw.examples || raw.sentences);
      const availableModes = ['reading', 'audio'];
      if (english) availableModes.push('meaning');
      if (example.ja && example.translation) availableModes.push('context');
      return {
        id: stableId('oj-v', word, reading),
        level: normalizeLevel(sourceLevel),
        sourceLevel: normalizeLevel(raw.level, sourceLevel),
        word,
        reading,
        th: english ? `EN: ${english}` : 'คำศัพท์นำเข้า — เน้นคำอ่านและบริบท',
        en: english,
        theme: mapTheme(raw.part_of_speech || raw.pos, word),
        example: example.ja || `${word}を覚えます。`,
        exampleTh: example.translation ? `EN: ${example.translation}` : `เรียนรู้คำว่า ${word}`,
        tip: `OpenJLPT · ${normalizeLevel(sourceLevel)}${raw.part_of_speech ? ` · ${clean(raw.part_of_speech)}` : ''}`,
        source: 'OpenJLPT',
        sourceLicense: 'CC BY-SA 4.0',
        sourcePriority: 1,
        sourceIndex: index,
        contentType: 'vocab',
        availableModes,
      };
    }).filter((item) => item.word && item.reading);
  }

  function normalizeOpenAnkiVocab(payload, sourceLevel) {
    const array = Array.isArray(payload) ? payload : (payload?.rows || payload?.words || payload?.vocab || payload?.data || []);
    return array.map((raw, index) => {
      const word = clean(raw.expression || raw.word || raw.term);
      const reading = clean(raw.reading || raw.kana || raw.furigana || word);
      const meaning = clean(raw.meaning || raw.meanings || raw.english || raw.translation_en);
      const tags = clean(raw.tags);
      const availableModes = ['reading', 'audio'];
      if (meaning) availableModes.push('meaning');
      return {
        id: stableId('oa-v', word, reading),
        level: normalizeLevel(sourceLevel),
        sourceLevel: normalizeLevel(sourceLevel),
        word,
        reading,
        th: meaning ? `EN: ${meaning}` : 'คำศัพท์นำเข้า — เน้นคำอ่าน',
        en: meaning,
        theme: mapTheme(raw.part_of_speech || raw.pos, word),
        example: `${word}を覚えます。`,
        exampleTh: `เรียนรู้คำว่า ${word}`,
        tip: `Open Anki JLPT · ${normalizeLevel(sourceLevel)}${tags ? ` · ${tags}` : ''}`,
        source: 'Open Anki JLPT Decks',
        sourceLicense: 'MIT',
        sourcePriority: 3,
        sourceIndex: index,
        contentType: 'vocab',
        availableModes,
      };
    }).filter((item) => item.word && item.reading);
  }

  function normalizeWordMasterVocab(payload, sourceLevel) {
    const array = Array.isArray(payload) ? payload : (payload?.words || payload?.vocab || payload?.data || []);
    return array.map((raw, index) => {
      const word = clean(raw.word || raw.expression || raw.term);
      const reading = clean(raw.reading || raw.kana || raw.furigana || word);
      const translation = clean(raw.translation_en || raw.meaning_en || raw.translation_cn || raw.meaning || raw.translation);
      const example = firstExample(raw.examples || raw.sentences);
      const englishish = looksEnglish(translation);
      const availableModes = ['reading', 'audio'];
      if (englishish) availableModes.push('meaning');
      if (example.ja && example.translation && looksEnglish(example.translation)) availableModes.push('context');
      return {
        id: stableId('wm-v', word, reading),
        level: normalizeLevel(sourceLevel),
        sourceLevel: normalizeLevel(raw.jlpt_level || raw.level, sourceLevel),
        word,
        reading,
        th: translation ? `${englishish ? 'EN' : 'CN/EN'}: ${translation}` : 'คำศัพท์นำเข้า — เน้นคำอ่าน',
        en: translation,
        theme: mapTheme(raw.part_of_speech || raw.pos, word),
        example: example.ja || `${word}を覚えます。`,
        exampleTh: example.translation ? `${looksEnglish(example.translation) ? 'EN' : 'CN/EN'}: ${example.translation}` : `เรียนรู้คำว่า ${word}`,
        tip: `WordMaster · ${normalizeLevel(sourceLevel)}${raw.part_of_speech ? ` · ${clean(raw.part_of_speech)}` : ''}`,
        source: 'WordMaster Word Lists',
        sourceLicense: 'MIT',
        sourcePriority: 2,
        sourceIndex: index,
        contentType: 'vocab',
        availableModes,
      };
    }).filter((item) => item.word && item.reading);
  }

  function normalizeOpenKanji(payload, sourceLevel) {
    const array = Array.isArray(payload) ? payload : (payload?.kanji || payload?.characters || payload?.data || []);
    return array.map((raw, index) => {
      const character = clean(raw.character || raw.kanji || raw.literal || raw.word);
      const onyomi = asArray(raw.onyomi || raw.on_yomi || raw.on || raw.readings_on);
      const kunyomi = asArray(raw.kunyomi || raw.kun_yomi || raw.kun || raw.readings_kun);
      const meanings = asArray(raw.meanings || raw.meaning || raw.glosses || raw.english);
      return {
        id: stableId('oj-k', character),
        character,
        level: normalizeLevel(sourceLevel),
        sourceLevel: normalizeLevel(raw.level, sourceLevel),
        onyomi,
        kunyomi,
        meanings,
        strokes: Number(raw.strokes || raw.stroke_count || 0) || null,
        grade: raw.grade ?? null,
        frequency: raw.freq ?? raw.frequency ?? null,
        source: 'OpenJLPT',
        sourceLicense: 'CC BY-SA 4.0',
        sourcePriority: 1,
        sourceIndex: index,
        contentType: 'kanji',
      };
    }).filter((item) => item.character && [...item.character].length === 1);
  }

  function normalizeWordMasterKanji(payload, sourceLevel) {
    const array = Array.isArray(payload) ? payload : (payload?.kanji || payload?.characters || payload?.words || payload?.data || []);
    return array.map((raw, index) => {
      const character = clean(raw.character || raw.kanji || raw.literal || raw.word);
      const onyomi = asArray(raw.onyomi || raw.on_yomi || raw.on || raw.reading_on || raw.readings_on);
      const kunyomi = asArray(raw.kunyomi || raw.kun_yomi || raw.kun || raw.reading_kun || raw.readings_kun);
      const meanings = asArray(raw.meanings || raw.meaning || raw.translation_en || raw.translation_cn || raw.translation);
      return {
        id: stableId('wm-k', character),
        character,
        level: normalizeLevel(sourceLevel),
        sourceLevel: normalizeLevel(raw.jlpt_level || raw.level, sourceLevel),
        onyomi,
        kunyomi,
        meanings,
        strokes: Number(raw.strokes || raw.stroke_count || 0) || null,
        grade: raw.grade ?? null,
        frequency: raw.freq ?? raw.frequency ?? null,
        source: 'WordMaster Word Lists',
        sourceLicense: 'MIT',
        sourcePriority: 2,
        sourceIndex: index,
        contentType: 'kanji',
      };
    }).filter((item) => item.character && [...item.character].length === 1);
  }

  function sortCandidates(items) {
    return [...items].sort((a, b) => {
      const rankDiff = (LEVEL_RANK[a.sourceLevel] ?? 99) - (LEVEL_RANK[b.sourceLevel] ?? 99);
      if (rankDiff) return rankDiff;
      const priorityDiff = Number(a.sourcePriority ?? 9) - Number(b.sourcePriority ?? 9);
      if (priorityDiff) return priorityDiff;
      return Number(a.sourceIndex || 0) - Number(b.sourceIndex || 0);
    });
  }

  function dedupe(items, keyFn) {
    const selected = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      if (!key) return;
      const current = selected.get(key);
      if (!current) {
        selected.set(key, item);
        return;
      }
      const itemPriority = Number(item.sourcePriority ?? 9);
      const currentPriority = Number(current.sourcePriority ?? 9);
      if (itemPriority < currentPriority) {
        selected.set(key, item);
        return;
      }
      if (itemPriority === currentPriority) {
        const itemRank = LEVEL_RANK[item.sourceLevel] ?? 99;
        const currentRank = LEVEL_RANK[current.sourceLevel] ?? 99;
        if (itemRank < currentRank) selected.set(key, item);
      }
    });
    return sortCandidates([...selected.values()]);
  }

  function assignCoverageLevels(items, targets, countKey) {
    const maxTarget = Number(targets.N1?.[countKey] || items.length);
    const selected = items.slice(0, maxTarget);
    selected.forEach((item, index) => {
      const position = index + 1;
      const assigned = LEVELS.find((level) => position <= Number(targets[level]?.[countKey] || Infinity)) || 'N1';
      item.coverageLevel = assigned;
      item.normalizedFromLevel = item.sourceLevel;
      item.level = assigned;
    });
    return selected;
  }

  function cumulativeCounts(items) {
    return Object.fromEntries(LEVELS.map((level) => [
      level,
      items.filter((item) => (LEVEL_RANK[item.level] ?? 99) <= LEVEL_RANK[level]).length,
    ]));
  }

  function kanjiToStudyItem(item) {
    const on = item.onyomi?.slice(0, 3).join('・') || '';
    const kun = item.kunyomi?.slice(0, 3).join('・') || '';
    const reading = [kun && `訓 ${kun}`, on && `音 ${on}`].filter(Boolean).join(' ／ ') || 'อ่านจากคำศัพท์ประกอบ';
    const meaning = item.meanings?.join('; ') || 'meaning not supplied';
    const detail = [item.strokes ? `${item.strokes}画` : '', on ? `音読み ${on}` : '', kun ? `訓読み ${kun}` : ''].filter(Boolean).join(' · ');
    return {
      id: `kanji-${item.id}`,
      level: item.level,
      sourceLevel: item.sourceLevel,
      normalizedFromLevel: item.normalizedFromLevel,
      word: item.character,
      reading,
      th: `EN: ${meaning}`,
      en: meaning,
      theme: 'kanji',
      example: `漢字「${item.character}」を覚えます。`,
      exampleTh: `เรียนรู้คันจิ ${item.character}`,
      tip: `${detail || 'ฝึกจำจากคำศัพท์ประกอบ'} · ${item.source}`,
      source: item.source,
      sourceLicense: item.sourceLicense,
      contentType: 'kanji',
      availableModes: item.meanings?.length ? ['meaning', 'reading', 'audio'] : ['reading', 'audio'],
    };
  }

  function buildMergedContent(baseContent, sourcePayloads, config, fetchErrors = []) {
    const base = JSON.parse(JSON.stringify(baseContent || {}));
    const vocabCandidates = normalizeBaseVocab(base.vocab);
    const kanjiCandidates = [];

    LEVELS.forEach((level) => {
      const openVocab = sourcePayloads?.openjlpt?.vocab?.[level];
      const openKanji = sourcePayloads?.openjlpt?.kanji?.[level];
      const wordmasterVocab = sourcePayloads?.wordmaster?.vocab?.[level];
      const openAnkiVocab = sourcePayloads?.openanki?.vocab?.[level];
      const wordmasterKanji = sourcePayloads?.wordmaster?.kanji?.[level];
      if (openVocab) vocabCandidates.push(...normalizeOpenVocab(openVocab, level));
      if (wordmasterVocab) vocabCandidates.push(...normalizeWordMasterVocab(wordmasterVocab, level));
      if (openAnkiVocab) vocabCandidates.push(...normalizeOpenAnkiVocab(openAnkiVocab, level));
      if (openKanji) kanjiCandidates.push(...normalizeOpenKanji(openKanji, level));
      if (wordmasterKanji) kanjiCandidates.push(...normalizeWordMasterKanji(wordmasterKanji, level));
    });

    const uniqueVocab = dedupe(vocabCandidates, (item) => candidateKey(item.word, item.reading));
    const uniqueKanji = dedupe(kanjiCandidates, (item) => clean(item.character));
    const vocab = assignCoverageLevels(uniqueVocab, config.targetCumulative, 'vocab');
    const kanji = assignCoverageLevels(uniqueKanji, config.targetCumulative, 'kanji');

    const vocabCounts = cumulativeCounts(vocab);
    const kanjiCounts = cumulativeCounts(kanji);
    const complete = LEVELS.every((level) => (
      vocabCounts[level] >= config.targetCumulative[level].vocab
      && kanjiCounts[level] >= config.targetCumulative[level].kanji
    ));

    base.meta = {
      ...(base.meta || {}),
      version: '2.1.1',
      buildDate: new Date().toISOString().slice(0, 10),
      contentNoteTh: 'คลังคำศัพท์และคันจิแบบประมาณการจากชุดข้อมูลเปิด ไม่ใช่รายการทางการของ JLPT และไม่มีการคัดลอกข้อสอบจริงย้อนหลัง',
      contentSync: {
        version: config.version,
        generatedAt: new Date().toISOString(),
        complete,
        mode: complete ? 'licensed-full' : 'licensed-partial',
        vocabCounts,
        kanjiCounts,
        targets: config.targetCumulative,
        fetchedSources: Object.keys(sourcePayloads || {}),
        fetchErrors,
        noteTh: complete
          ? 'ซิงก์คลังเปิดสำเร็จและปรับจำนวนสะสมตามเป้าหมายของแอป'
          : 'โหลดแหล่งข้อมูลได้ไม่ครบ จึงใช้คลังที่มีอยู่และสามารถกดซิงก์ใหม่ได้',
      },
      attributions: [
        { name: 'OpenJLPT', license: 'CC BY-SA 4.0', url: config.sources.openjlpt.homepage },
        { name: 'WordMaster Word Lists', license: 'MIT', url: config.sources.wordmaster.homepage },
        { name: 'Open Anki JLPT Decks', license: 'MIT', url: config.sources.openanki.homepage },
      ],
    };

    base.themeLabels = {
      ...(base.themeLabels || {}),
      general: { icon: '🗂️', th: 'คำศัพท์ทั่วไป' },
      kanji: { icon: '漢', th: 'คันจิ' },
      verbs: { icon: '🏃', th: 'คำกริยา' },
      adjectives: { icon: '🎨', th: 'คำคุณศัพท์' },
      adverbs: { icon: '⚡', th: 'คำวิเศษณ์' },
      connectors: { icon: '🔗', th: 'คำเชื่อม' },
      numbers: { icon: '🔢', th: 'ตัวเลขและลักษณนาม' },
    };
    base.vocab = vocab;
    base.kanji = kanji;
    base.kanjiStudyItems = kanji.map(kanjiToStudyItem);
    base.grammar = Array.isArray(base.grammar) ? base.grammar : [];
    base.readings = Array.isArray(base.readings) ? base.readings : [];
    base.listenings = Array.isArray(base.listenings) ? base.listenings : [];
    return base;
  }

  window.JLPTContentEngine = Object.freeze({
    LEVELS,
    LEVEL_RANK,
    clean,
    asArray,
    normalizeLevel,
    hashString,
    stableId,
    normalizeOpenVocab,
    normalizeWordMasterVocab,
    normalizeOpenAnkiVocab,
    normalizeOpenKanji,
    normalizeWordMasterKanji,
    buildMergedContent,
    cumulativeCounts,
    kanjiToStudyItem,
  });
})();
