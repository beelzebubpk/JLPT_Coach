(() => {
  'use strict';

  const ROLE_LABELS_TH = {
    '女': 'ผู้หญิง',
    '男': 'ผู้ชาย',
    '先生': 'อาจารย์',
    '店員': 'พนักงานร้าน',
    '駅の放送': 'ประกาศสถานี',
    '放送': 'ประกาศ',
    '天気予報': 'พยากรณ์อากาศ',
    '受付': 'ประชาสัมพันธ์',
    '配達員': 'พนักงานส่งของ',
    '上司': 'หัวหน้างาน',
    '社員': 'พนักงาน',
    '部長': 'ผู้จัดการ',
    '担当者': 'ผู้รับผิดชอบ',
    '教授': 'อาจารย์มหาวิทยาลัย',
    '学生': 'นักศึกษา',
    '編集者': 'บรรณาธิการ',
    '研究員': 'นักวิจัย',
    '司会': 'ผู้ดำเนินรายการ',
    'ナレーター': 'ผู้บรรยาย',
  };

  const ROLE_ICONS = {
    female: '👩',
    male: '👨',
    teacher: '🧑‍🏫',
    service: '🧑‍💼',
    announcer: '📢',
    manager: '👔',
    student: '🧑‍🎓',
    researcher: '🧑‍🔬',
    narrator: '🎙️',
    neutral: '🗣️',
  };

  const NEUTRAL_VARIANTS = [
    { pitch: 1.08, rateOffset: 0.01 },
    { pitch: 0.90, rateOffset: -0.01 },
    { pitch: 1.00, rateOffset: 0.04 },
    { pitch: 0.80, rateOffset: -0.03 },
    { pitch: 1.20, rateOffset: 0.00 },
    { pitch: 0.96, rateOffset: 0.07 },
  ];

  let japaneseVoices = [];
  let sessionId = 0;
  let pendingResolve = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hashString(value) {
    let hash = 2166136261;
    const input = String(value || '');
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function voiceKey(voice) {
    return `${voice?.voiceURI || voice?.name || ''}|${voice?.lang || ''}`;
  }

  function voiceGender(voice) {
    const name = `${voice?.name || ''} ${voice?.voiceURI || ''}`.toLowerCase();
    if (/kyoko|\bfemale\b|\bwoman\b|女性|nanami|haruka|sayaka|mizuki|sakura|yuna|reina/.test(name)) return 'female';
    if (/otoya|\bmale\b|\bman\b|男性|takumi|ichiro|daichi|keita|haruto|hattori/.test(name)) return 'male';
    return 'neutral';
  }

  function roleType(role) {
    const value = String(role || '');
    if (/女|母|妻|彼女|女性/.test(value)) return 'female';
    if (/男|父|夫|彼|男性/.test(value)) return 'male';
    if (/先生|教授/.test(value)) return 'teacher';
    if (/店員|受付|配達員|社員|担当者|編集者/.test(value)) return 'service';
    if (/放送|予報|司会|ナレーター|アナウンス/.test(value)) return 'announcer';
    if (/上司|部長|社長|課長/.test(value)) return 'manager';
    if (/学生|生徒/.test(value)) return 'student';
    if (/研究員/.test(value)) return 'researcher';
    if (/語り手|Narrator/.test(value)) return 'narrator';
    return 'neutral';
  }

  function desiredGender(role) {
    const type = roleType(role);
    if (type === 'female') return 'female';
    if (type === 'male') return 'male';
    return 'neutral';
  }

  function labelTh(role, index) {
    return ROLE_LABELS_TH[role] || `ผู้พูด ${index + 1}`;
  }

  function refreshVoices() {
    if (!('speechSynthesis' in window)) {
      japaneseVoices = [];
      return japaneseVoices;
    }
    const seen = new Set();
    japaneseVoices = window.speechSynthesis.getVoices()
      .filter((voice) => String(voice.lang || '').toLowerCase().startsWith('ja'))
      .filter((voice) => {
        const key = voiceKey(voice);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const localDiff = Number(Boolean(b.localService)) - Number(Boolean(a.localService));
        if (localDiff) return localDiff;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
      });
    return [...japaneseVoices];
  }

  function getVoices() {
    if (!japaneseVoices.length) refreshVoices();
    return [...japaneseVoices];
  }

  function parseScript(script) {
    const source = String(script || '').replace(/\r/g, '').trim();
    if (!source) return [];

    const pattern = /(^|[。！？\n])\s*([^：。！？\n]{1,18})：/g;
    const markers = [];
    let match;
    while ((match = pattern.exec(source))) {
      markers.push({
        matchIndex: match.index,
        prefixLength: match[1].length,
        labelStart: match.index + match[1].length,
        contentStart: pattern.lastIndex,
        speaker: match[2].trim(),
      });
    }

    if (!markers.length) {
      return [{ speaker: 'ナレーター', text: source }];
    }

    const lines = [];
    const intro = source.slice(0, markers[0].labelStart).trim();
    if (intro) lines.push({ speaker: 'ナレーター', text: intro });

    markers.forEach((marker, index) => {
      const next = markers[index + 1];
      const end = next ? next.labelStart : source.length;
      const text = source.slice(marker.contentStart, end)
        .replace(/^[\s。！？]+/, '')
        .trim();
      if (text) lines.push({ speaker: marker.speaker, text });
    });
    return lines;
  }

  function normalize(input) {
    let rawLines;
    if (Array.isArray(input)) rawLines = input;
    else if (Array.isArray(input?.dialogue)) rawLines = input.dialogue;
    else if (Array.isArray(input?.turns)) rawLines = input.turns;
    else rawLines = parseScript(input?.script ?? input);

    const speakerMap = new Map();
    const lines = [];
    rawLines.forEach((raw, lineIndex) => {
      const speaker = String(raw?.speaker || raw?.speakerId || raw?.label || raw?.role || 'ナレーター').trim() || 'ナレーター';
      const text = String(raw?.text || raw?.line || '').trim();
      if (!text) return;
      if (!speakerMap.has(speaker)) {
        const index = speakerMap.size;
        const type = roleType(speaker);
        speakerMap.set(speaker, {
          key: `speaker-${index}`,
          index,
          role: speaker,
          labelTh: labelTh(speaker, index),
          type,
          icon: ROLE_ICONS[type] || ROLE_ICONS.neutral,
        });
      }
      const profile = speakerMap.get(speaker);
      lines.push({
        id: `line-${lineIndex}`,
        speaker,
        speakerKey: profile.key,
        speakerIndex: profile.index,
        text,
      });
    });

    if (!lines.length) {
      const profile = {
        key: 'speaker-0', index: 0, role: 'ナレーター', labelTh: 'ผู้บรรยาย',
        type: 'narrator', icon: ROLE_ICONS.narrator,
      };
      return { speakers: [profile], lines: [{ id: 'line-0', speaker: profile.role, speakerKey: profile.key, speakerIndex: 0, text: '' }] };
    }

    return { speakers: [...speakerMap.values()], lines };
  }

  function pickVoice(speaker, usedKeys, multiVoice) {
    const voices = getVoices();
    if (!voices.length) return null;
    if (!multiVoice) return voices[0];

    const targetGender = desiredGender(speaker.role);
    const genderMatches = targetGender === 'neutral'
      ? voices
      : voices.filter((voice) => voiceGender(voice) === targetGender);
    const preferredPool = genderMatches.length ? genderMatches : voices;
    const unusedPreferred = preferredPool.filter((voice) => !usedKeys.has(voiceKey(voice)));
    const unusedAny = voices.filter((voice) => !usedKeys.has(voiceKey(voice)));
    const pool = unusedPreferred.length ? unusedPreferred : unusedAny.length ? unusedAny : preferredPool;
    const selected = pool[hashString(`${speaker.role}-${speaker.index}`) % pool.length] || voices[0];
    usedKeys.add(voiceKey(selected));
    return selected;
  }

  function speakerProsody(speaker, hasDistinctVoice) {
    const variant = NEUTRAL_VARIANTS[speaker.index % NEUTRAL_VARIANTS.length];
    const type = speaker.type || roleType(speaker.role);
    let pitch = variant.pitch;
    let rateOffset = variant.rateOffset;

    if (type === 'female') pitch = hasDistinctVoice ? 1.06 : 1.16;
    else if (type === 'male') pitch = hasDistinctVoice ? 0.96 : 0.84;
    else if (type === 'announcer') { pitch = 0.98; rateOffset += 0.04; }
    else if (type === 'teacher' || type === 'manager') { pitch = 0.93; rateOffset -= 0.01; }
    else if (type === 'student') pitch = 1.10;
    else if (type === 'researcher') pitch = 0.96;

    return { pitch: clamp(pitch, 0.65, 1.35), rateOffset: clamp(rateOffset, -0.12, 0.12) };
  }

  function prepare(dialogueInput, options = {}) {
    const dialogue = dialogueInput?.lines ? dialogueInput : normalize(dialogueInput);
    const multiVoice = options.multiVoice !== false;
    const baseRate = clamp(Number(options.baseRate || 0.86), 0.55, 1.25);
    const usedKeys = new Set();
    const speakerProfiles = new Map();

    dialogue.speakers.forEach((speaker) => {
      const voice = pickVoice(speaker, usedKeys, multiVoice);
      const hasDistinctVoice = multiVoice && japaneseVoices.length > 1;
      const prosody = multiVoice ? speakerProsody(speaker, hasDistinctVoice) : { pitch: 1, rateOffset: 0 };
      speakerProfiles.set(speaker.key, {
        ...speaker,
        voice,
        pitch: prosody.pitch,
        rate: clamp(baseRate + prosody.rateOffset, 0.5, 1.35),
      });
    });

    return {
      ...dialogue,
      lines: dialogue.lines.map((line) => ({ ...line, profile: speakerProfiles.get(line.speakerKey) })),
      speakerProfiles,
      multiVoice,
      baseRate,
    };
  }

  function stop() {
    sessionId += 1;
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve({ cancelled: true });
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function speakOne(text, profile, token) {
    return new Promise((resolve) => {
      if (token !== sessionId) { resolve({ cancelled: true }); return; }
      const utterance = new SpeechSynthesisUtterance(String(text || ''));
      utterance.lang = 'ja-JP';
      utterance.rate = profile?.rate || 0.86;
      utterance.pitch = profile?.pitch || 1;
      utterance.volume = 1;
      if (profile?.voice) utterance.voice = profile.voice;

      let finished = false;
      let timeoutId = null;
      const finish = (result = {}) => {
        if (finished) return;
        finished = true;
        if (pendingResolve === finish) pendingResolve = null;
        if (timeoutId) window.clearTimeout(timeoutId);
        resolve(result);
      };
      pendingResolve = finish;
      utterance.onend = () => finish({ cancelled: false });
      utterance.onerror = (event) => finish({ cancelled: token !== sessionId, error: event?.error || 'speech-error' });
      const timeoutMs = Math.max(4500, Math.min(25000, String(text || '').length * 260));
      timeoutId = window.setTimeout(() => finish({ cancelled: token !== sessionId, timeout: true }), timeoutMs);
      window.speechSynthesis.speak(utterance);
    });
  }

  function pause(ms, token) {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(token !== sessionId), Math.max(0, Number(ms || 0)));
    });
  }

  async function play(dialogueInput, options = {}) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      options.onUnsupported?.();
      return { supported: false };
    }
    refreshVoices();
    stop();
    const token = sessionId;
    const prepared = prepare(dialogueInput, options);
    const lineIndexes = Array.isArray(options.lineIndexes)
      ? options.lineIndexes.filter((index) => Number.isInteger(index) && prepared.lines[index])
      : prepared.lines.map((_, index) => index);

    options.onStart?.(prepared);
    for (let orderIndex = 0; orderIndex < lineIndexes.length; orderIndex += 1) {
      const lineIndex = lineIndexes[orderIndex];
      const line = prepared.lines[lineIndex];
      if (token !== sessionId) return { supported: true, cancelled: true, prepared };
      options.onLineStart?.(line, lineIndex, prepared);
      const result = await speakOne(line.text, line.profile, token);
      options.onLineEnd?.(line, lineIndex, prepared, result);
      if (token !== sessionId || result.cancelled) return { supported: true, cancelled: true, prepared };
      if (orderIndex < lineIndexes.length - 1) {
        const cancelled = await pause(options.pauseMs ?? 220, token);
        if (cancelled) return { supported: true, cancelled: true, prepared };
      }
    }
    if (token === sessionId) options.onEnd?.(prepared);
    return { supported: true, cancelled: token !== sessionId, prepared };
  }

  function speakText(text, options = {}) {
    const dialogue = normalize([{ speaker: options.speaker || 'ナレーター', text }]);
    return play(dialogue, { ...options, multiVoice: false, pauseMs: 0 });
  }

  function playLine(dialogueInput, lineIndex, options = {}) {
    return play(dialogueInput, { ...options, lineIndexes: [Number(lineIndex)], pauseMs: 0 });
  }

  function status() {
    const voices = getVoices();
    return {
      supported: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
      count: voices.length,
      names: voices.map((voice) => voice.name || voice.voiceURI || 'Japanese voice'),
      hasMultiple: voices.length > 1,
      usesProsodyFallback: voices.length < 2,
    };
  }

  window.JLPTDialogueEngine = {
    normalize,
    parseScript,
    prepare,
    play,
    playLine,
    speakText,
    stop,
    refreshVoices,
    getVoices,
    status,
  };
})();
