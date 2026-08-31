/* JLPT Coach V2.3 content sources and coverage targets.
 * This file contains configuration only; no test questions are copied from JLPT exams.
 */
window.JLPT_CONTENT_CONFIG = Object.freeze({
  version: '2.3.0-20260831-1',
  cache: {
    dbName: 'jlpt-coach-content-v2-3',
    storeName: 'packs',
    key: 'licensed-content-2.3.0-20260831-1',
  },
  networkTimeoutMs: 30000,
  levels: ['N5', 'N4', 'N3', 'N2', 'N1'],
  targetCumulative: {
    N5: { vocab: 800, kanji: 100 },
    N4: { vocab: 1500, kanji: 300 },
    N3: { vocab: 3750, kanji: 650 },
    N2: { vocab: 6000, kanji: 1000 },
    N1: { vocab: 10000, kanji: 2000 },
  },
  sources: {
    openjlpt: {
      name: 'OpenJLPT',
      license: 'CC BY-SA 4.0',
      homepage: 'https://github.com/evanclan/OpenJLPT',
      mirrors: [
        'https://cdn.jsdelivr.net/gh/evanclan/OpenJLPT@main/data/json',
        'https://raw.githubusercontent.com/evanclan/OpenJLPT/main/data/json',
      ],
      vocabPath: (level) => `vocab/${level.toLowerCase()}.json`,
      kanjiPath: (level) => `kanji/${level.toLowerCase()}.json`,
    },

    openanki: {
      name: 'Open Anki JLPT Decks',
      license: 'MIT',
      homepage: 'https://github.com/jamsinclair/open-anki-jlpt-decks',
      mirrors: [
        'https://cdn.jsdelivr.net/gh/jamsinclair/open-anki-jlpt-decks@main/src',
        'https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/main/src',
      ],
      vocabPath: (level) => `${level.toLowerCase()}.csv`,
      format: 'csv',
    },
    wordmaster: {
      name: 'WordMaster Word Lists',
      license: 'MIT',
      homepage: 'https://github.com/lratusa/wordmaster-wordlists',
      mirrors: [
        'https://cdn.jsdelivr.net/gh/lratusa/wordmaster-wordlists@main/japanese',
        'https://raw.githubusercontent.com/lratusa/wordmaster-wordlists/main/japanese',
      ],
      vocabPath: (level) => `jlpt_${level.toLowerCase()}.json`,
      kanjiPath: (level) => `jlpt_kanji_${level.toLowerCase()}.json`,
    },
  },
});
