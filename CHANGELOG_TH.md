# Changelog

## 2.2.0 — 2026-08-31

- เพิ่ม `dialogue-engine.js` สำหรับแยก Script ตามผู้พูดและอ่านทีละ Turn
- รองรับบทสนทนา 1 คน, 2 คน และหลายคน
- เลือก Japanese voice คนละเสียงเมื่ออุปกรณ์มีหลายเสียง
- เพิ่ม Pitch/Rate fallback เมื่ออุปกรณ์มี Japanese voice เพียงเสียงเดียว
- เพิ่ม Speaker chip และ Highlight คนที่กำลังพูด
- เพิ่มปุ่มฟังช้าและหยุดเสียง
- ซ่อน Script ก่อนตอบ และเปิด Transcript แบบแยกผู้พูดหลังตอบ
- แตะ Transcript รายบรรทัดเพื่อฟังซ้ำเฉพาะประโยคได้
- เพิ่มการตั้งค่า Multi-Voice, ความเร็ว และปุ่มทดสอบเสียง
- บันทึกจำนวนรอบฟัง จำนวนผู้พูด และ Listening subtype ลง Mistake Log เมื่อทำผิด
- เพิ่ม subtype: conversation, announcement, task, key-point และ monologue
- ปรับ Service Worker app-shell cache เป็น Version 2.2.0
- รักษา Local Storage key เดิม `jlpt-coach-state-v2` เพื่อไม่ให้ Progress หาย
- ไม่เพิ่มหรือคัดลอก Script/ข้อสอบจาก Textbook; ใช้รูปแบบข้อสอบเป็น Blueprint เท่านั้น

## 2.1.1 — 2026-08-28

- เพิ่ม Licensed Content Sync สำหรับ Vocabulary/Kanji N5–N1
- เพิ่ม OpenJLPT, WordMaster Word Lists และ Open Anki JLPT Decks
- รองรับ JSON และ CSV source
- เพิ่ม Merge, Deduplicate, Stable ID และ Cumulative coverage target
- เพิ่ม IndexedDB cache และ Offline fallback
- เพิ่มหน้าสถานะ จำนวนจริง เป้าหมาย Error count และ Attribution
- ปรับ Service Worker cache version
- ไม่เปลี่ยน Local Storage key จึงรักษา Progress เดิมเมื่อใช้ URL เดิม
- เพิ่มเอกสาร License และ Source audit
