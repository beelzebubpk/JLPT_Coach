# JLPT Coach N5–N1 — Version 2.3.0

Version 2.3.0 turns the prepared Textbook Data Pack into a working PWA. It keeps the adaptive score plan, SRS, Local Auto Save, open-licensed Vocabulary/Kanji sync, and Multi-Voice Listening from previous releases, then adds a Textbook Learning Engine for N5–N3.

## What is new

### 1. Textbook Learning Path
- N5: 8 stages
- N4: 10 stages
- N3: 12 stages
- Each stage links Grammar, topic tags, and exam question types.
- Stage progress is saved locally and marked complete at 70%+ accuracy.

### 2. Question Lab and Exam Blueprint
- 17 question types covering Vocabulary, Grammar, Reading, and Listening.
- Users can directly practice a weak question type rather than only choosing a broad skill.
- Question types include Kanji reading, orthography, context, grammar choice/order/cloze, short/medium reading, information retrieval, task listening, key point, quick response, and announcement.

### 3. Error Analytics
- 35 error codes distinguish causes such as Kanji reading, orthography, collocation, transitivity, conjugation, nuance, sentence order, inference, date/time, negation, speaker tracking, and final-decision mistakes.
- Mistake Log stores question type, error code, response time, selected answer, correct answer, number of speakers, and replay count when applicable.
- Adaptive weighting uses these subtypes in addition to overall skill accuracy.

### 4. Grammar Study Engine
- Quick Card: pattern, connection, short meaning, and example.
- Deep Explain: nuance, why the answer is correct, common mistakes, memory hint, and related contrast groups.
- 16 contrast groups are included for easily confused patterns.

### 5. Topic and Collocation Training
- N3 vocabulary structure uses topic and word-usage taxonomy.
- Selected N4/N3 items include collocations, topic IDs, and transitivity pairs.
- Topic progress is tracked separately from the original theme list.

### 6. Mock Ladder
- 10 stages from Diagnostic to Final Readiness.
- Saves best accuracy, latest accuracy, attempts, and best time for each stage.

### 7. Multi-Voice Listening improvements
- The app validates dialogue turns from the script and uses the speaker count found in the conversation.
- Two people receive two speaker profiles; three people receive three profiles.
- Different Japanese system voices are used when available; Pitch/Rate fallback remains when iOS exposes only one voice.
- Script remains hidden until answering, then becomes a line-by-line replay transcript.

## Bundled content in this release

| Level | Vocabulary starter | Grammar | Reading | Listening | Practice questions |
|---|---:|---:|---:|---:|---:|
| N5 | 40 | 23 | 10 | 10 | 43 |
| N4 | 180 | 59 | 28 | 28 | 115 |
| N3 | 40 | 31 | 12 | 12 | 55 |
| N2 | 40 | 15 | 6 | 6 | 27 |
| N1 | 40 | 15 | 6 | 6 | 27 |


The Vocabulary column above is the bundled curated starter database. After a successful open-licensed content sync, the app still targets cumulative coverage of N5 800/100 Kanji, N4 1,500/300, N3 3,750/650, N2 6,000/1,000, and N1 10,000/2,000.

## Rights and source policy

The uploaded textbooks were used as references for organization, pedagogy, topic coverage, and question-format taxonomy. The app does not embed scanned pages, textbook illustrations, or copied question sets. New public content is marked `original_rewrite`; open datasets retain their licenses and attribution. See `TEXTBOOK_RIGHTS_REGISTRY.json` and `CONTENT_LICENSES.md`.

## Updating an existing GitHub Pages installation

1. In the current app, open Profile and Export Progress to JSON.
2. Extract `JLPT_Coach_V2_3_0_Update.zip`.
3. Upload every file from the update package to the root of the same GitHub repository and replace files with the same names.
4. Commit and wait for GitHub Pages deployment.
5. Open the same site URL in Safari while online and refresh once.
6. Close JLPT Coach from the App Switcher and reopen it from the Home Screen.
7. Open Profile and verify Version 2.3.0 / Textbook Engine status.
8. Run “Sync content again” once. V2.3.0 uses a new IndexedDB content-cache key so the licensed Vocabulary/Kanji pack is rebuilt together with the new textbook content.

Do not delete Safari Website Data and do not press Reset before exporting a backup.

## Save compatibility

- Local Storage key remains `jlpt-coach-state-v2`.
- Existing Profile, exam scores, XP, streak, SRS, mistakes, mock tests, and settings remain.
- New schema-3 fields are added non-destructively: subtype analytics, path progress, mock-ladder progress, topic sessions, and content-schema version.
- Different devices still keep separate local saves unless a cloud backend is added later.

## Main files

- `textbook-engine.js`: blueprint, error, topic, grammar-contrast, path, and subtype analytics logic.
- `content.json` / `data.js`: Version 2.3 content database.
- `app.js`: V2.3 UI and adaptive integration.
- `dialogue-engine.js`: multi-speaker parsing and voice assignment.
- `content-config.js`: open-content sources and V2.3 cache version.
- `content-engine.js` / `content-loader.js`: merge, deduplicate, IndexedDB cache, and fallback.
- `sw.js`: offline app-shell cache.

## Limitations

- N5/N4/N3 receive the strongest Textbook Learning Path expansion. N2/N1 retain the general adaptive system and starter content but do not yet have equivalent textbook depth from the supplied files.
- Listening still uses Web Speech / iOS Japanese voices rather than studio-recorded human audio.
- Projected score and readiness are learning indicators, not official JLPT score predictions.
- The expanded open Vocabulary/Kanji lists are community/open-dataset classifications, not official post-2010 JLPT lists.
