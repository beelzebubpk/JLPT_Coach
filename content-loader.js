/*
 * JLPT Coach V2.1 — first-run content sync.
 * Downloads licensed/open vocabulary and kanji data, normalizes it, stores the resulting
 * compact pack in IndexedDB, and reuses that pack offline on later launches.
 */
(() => {
  'use strict';

  const CONFIG = window.JLPT_CONTENT_CONFIG;
  const ENGINE = window.JLPTContentEngine;
  const BASE_CONTENT = window.JLPT_CONTENT;

  function setBoot(message, detail = '') {
    const overlay = document.getElementById('contentBootOverlay');
    const title = document.getElementById('contentBootTitle');
    const note = document.getElementById('contentBootNote');
    if (title) title.textContent = message;
    if (note) note.textContent = detail;
    if (overlay) overlay.classList.remove('done');
  }

  function finishBoot() {
    const overlay = document.getElementById('contentBootOverlay');
    if (!overlay) return;
    overlay.classList.add('done');
    window.setTimeout(() => overlay.remove(), 360);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(CONFIG.cache.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CONFIG.cache.storeName)) {
          db.createObjectStore(CONFIG.cache.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open IndexedDB'));
    });
  }

  async function idbGet(key) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.cache.storeName, 'readonly');
        const request = tx.objectStore(CONFIG.cache.storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
      });
    } finally {
      db.close();
    }
  }

  async function idbPut(key, value) {
    const db = await openDatabase();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.cache.storeName, 'readwrite');
        tx.objectStore(CONFIG.cache.storeName).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
      });
    } finally {
      db.close();
    }
  }

  async function idbDelete(key) {
    const db = await openDatabase();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.cache.storeName, 'readwrite');
        tx.objectStore(CONFIG.cache.storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('IndexedDB delete failed'));
      });
    } finally {
      db.close();
    }
  }

  async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchText(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function parseCsv(text) {
    const input = String(text ?? '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (quoted) {
        if (char === '"' && input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (field || row.length) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows.shift().map((header) => String(header).trim());
    return rows
      .filter((values) => values.some((value) => String(value).trim()))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  async function fetchFromMirrors(source, path, format = 'json') {
    const errors = [];
    for (const base of source.mirrors) {
      const url = `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
      try {
        const raw = format === 'csv'
          ? await fetchText(url, CONFIG.networkTimeoutMs)
          : await fetchJson(url, CONFIG.networkTimeoutMs);
        return { data: format === 'csv' ? parseCsv(raw) : raw, url };
      } catch (error) {
        errors.push(`${url}: ${error?.message || error}`);
      }
    }
    throw new Error(errors.join(' | '));
  }

  async function runWithConcurrency(tasks, concurrency, onProgress) {
    const results = new Array(tasks.length);
    let nextIndex = 0;
    let completed = 0;
    async function worker() {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= tasks.length) return;
        try {
          results[index] = { status: 'fulfilled', value: await tasks[index].run() };
        } catch (error) {
          results[index] = { status: 'rejected', reason: error };
        }
        completed += 1;
        onProgress?.(completed, tasks.length, tasks[index]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
    return results;
  }

  function makeTasks() {
    const tasks = [];
    CONFIG.levels.forEach((level) => {
      ['openjlpt', 'wordmaster'].forEach((sourceKey) => {
        const source = CONFIG.sources[sourceKey];
        tasks.push({
          sourceKey,
          type: 'vocab',
          level,
          label: `${source.name} ${level} Vocabulary`,
          run: () => fetchFromMirrors(source, source.vocabPath(level), source.format || 'json'),
        });
        tasks.push({
          sourceKey,
          type: 'kanji',
          level,
          label: `${source.name} ${level} Kanji`,
          run: () => fetchFromMirrors(source, source.kanjiPath(level), source.format || 'json'),
        });
      });

      const openAnki = CONFIG.sources.openanki;
      tasks.push({
        sourceKey: 'openanki',
        type: 'vocab',
        level,
        label: `${openAnki.name} ${level} Vocabulary`,
        run: () => fetchFromMirrors(openAnki, openAnki.vocabPath(level), openAnki.format || 'csv'),
      });
    });
    return tasks;
  }

  async function buildOnlinePack() {
    if (!navigator.onLine) throw new Error('อุปกรณ์ออฟไลน์และยังไม่มีคลังที่เคยซิงก์');
    const tasks = makeTasks();
    setBoot('กำลังเตรียมคลัง N5–N1', `ดาวน์โหลดชุดข้อมูลเปิด 0/${tasks.length} ไฟล์ · ทำครั้งแรกครั้งเดียว`);
    const results = await runWithConcurrency(tasks, 4, (done, total, task) => {
      setBoot('กำลังเตรียมคลัง N5–N1', `${done}/${total} · ${task.label}`);
    });

    const payloads = {
      openjlpt: { vocab: {}, kanji: {} },
      wordmaster: { vocab: {}, kanji: {} },
      openanki: { vocab: {}, kanji: {} },
    };
    const errors = [];
    results.forEach((result, index) => {
      const task = tasks[index];
      if (result.status === 'fulfilled') {
        payloads[task.sourceKey][task.type][task.level] = result.value.data;
      } else {
        errors.push(`${task.label}: ${result.reason?.message || result.reason}`);
      }
    });

    const pack = ENGINE.buildMergedContent(BASE_CONTENT, payloads, CONFIG, errors);
    const n1Vocab = Number(pack.meta?.contentSync?.vocabCounts?.N1 || 0);
    const n1Kanji = Number(pack.meta?.contentSync?.kanjiCounts?.N1 || 0);
    if (n1Vocab < 500 || n1Kanji < 100) {
      throw new Error(`ข้อมูลที่โหลดได้ไม่พอ (${n1Vocab} คำ / ${n1Kanji} คันจิ)`);
    }
    try {
      await idbPut(CONFIG.cache.key, {
        savedAt: new Date().toISOString(),
        configVersion: CONFIG.version,
        pack,
      });
      pack.meta.contentSync.cacheStored = true;
    } catch (cacheError) {
      console.warn('Content pack is ready, but IndexedDB cache write failed.', cacheError);
      pack.meta.contentSync.cacheStored = false;
      pack.meta.contentSync.cacheError = cacheError?.message || String(cacheError);
      pack.meta.contentSync.noteTh = `${pack.meta.contentSync.noteTh} · ใช้ได้ในรอบนี้ แต่บันทึกคลังออฟไลน์ไม่สำเร็จ`;
    }
    return pack;
  }

  async function loadContent({ forceRefresh = false } = {}) {
    try {
      if (!forceRefresh) {
        setBoot('กำลังเปิด JLPT Coach', 'ตรวจคลังออฟไลน์ในเครื่อง…');
        const cached = await idbGet(CONFIG.cache.key).catch(() => null);
        if (cached?.pack?.meta?.contentSync?.version === CONFIG.version) {
          window.JLPT_CONTENT = cached.pack;
          window.JLPT_CONTENT_STATUS = { source: 'cache', savedAt: cached.savedAt, error: null };
          finishBoot();
          return cached.pack;
        }
      }
      const pack = await buildOnlinePack();
      window.JLPT_CONTENT = pack;
      window.JLPT_CONTENT_STATUS = { source: 'network', savedAt: new Date().toISOString(), error: null };
      finishBoot();
      return pack;
    } catch (error) {
      console.warn('Licensed content sync failed; using bundled starter content.', error);
      const fallback = {
        ...BASE_CONTENT,
        kanji: Array.isArray(BASE_CONTENT.kanji) ? BASE_CONTENT.kanji : [],
        kanjiStudyItems: Array.isArray(BASE_CONTENT.kanjiStudyItems) ? BASE_CONTENT.kanjiStudyItems : [],
        meta: {
          ...(BASE_CONTENT.meta || {}),
          version: '2.1.1-fallback',
          contentSync: {
            version: CONFIG.version,
            generatedAt: new Date().toISOString(),
            complete: false,
            mode: 'starter-fallback',
            vocabCounts: Object.fromEntries(CONFIG.levels.map((level) => [level, (BASE_CONTENT.vocab || []).filter((item) => item.level === level).length])),
            kanjiCounts: Object.fromEntries(CONFIG.levels.map((level) => [level, 0])),
            targets: CONFIG.targetCumulative,
            fetchErrors: [error?.message || String(error)],
            noteTh: 'ยังซิงก์คลังขยายไม่ได้ แอปใช้ Starter Pack และสามารถกดซิงก์ใหม่เมื่อออนไลน์',
          },
        },
      };
      window.JLPT_CONTENT = fallback;
      window.JLPT_CONTENT_STATUS = { source: 'fallback', savedAt: null, error: error?.message || String(error) };
      setBoot('เปิดด้วย Starter Pack', 'เชื่อมต่ออินเทอร์เน็ตแล้วกด “ซิงก์คลังใหม่” ในหน้าโปรไฟล์');
      window.setTimeout(finishBoot, 650);
      return fallback;
    }
  }

  window.JLPTContentManager = Object.freeze({
    async refresh() {
      await idbDelete(CONFIG.cache.key).catch(() => {});
      return loadContent({ forceRefresh: true });
    },
    async clearCache() {
      await idbDelete(CONFIG.cache.key).catch(() => {});
    },
    status() {
      return window.JLPT_CONTENT_STATUS || { source: 'unknown', savedAt: null, error: null };
    },
    config: CONFIG,
    parseCsv,
  });

  window.JLPT_CONTENT_READY = loadContent();
})();
