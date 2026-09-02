# JLPT Coach N5–N1 — Version 2.3.1 Compact Quiz

Version 2.3.1 เป็น Patch Release ต่อจาก V2.3.0 โดยปรับหน้าทำควิซให้ผู้ใช้ **อ่าน ฟัง เลือกคำตอบ และกดตรวจคำตอบได้ในหน้าจอมือถือเดียว** โดยไม่ต้องเลื่อนทั้งหน้า

## จุดเปลี่ยนหลัก

- หน้าควิซใช้ `100dvh` และล็อก Whole-page scrolling ระหว่างตอบ
- คำถาม เวลาเป้าหมาย เนื้อหา/เสียง ตัวเลือก และปุ่มตรวจคำตอบอยู่ใน Viewport เดียว
- Vocabulary, Kanji และ Grammar แบบ 4 ตัวเลือกแสดงเป็นตาราง 2 × 2 ที่แตะง่าย
- Reading ใช้ช่องบทอ่านที่เลื่อนภายในได้ โดยตัวเลือกและปุ่มตอบยังคงมองเห็น
- Listening ย่อ Player ให้เห็นผู้พูด ปุ่ม Play/Slow/Stop และตัวเลือกพร้อมกัน
- หลังตอบ เฉลยเปิดเป็น Bottom Sheet ที่เลื่อนภายในและย่อ/ขยายได้ โดยปุ่ม “ไปต่อ” ยังคงอยู่ด้านล่าง
- Script แยกผู้พูดถูกย้ายไปอยู่ในแผงเฉลย เพื่อไม่ดันตัวเลือกออกจากหน้าจอ
- รองรับ iPhone Safe Area, Dynamic Viewport และหน้าจอเตี้ย เช่น 320 × 568
- Progress เดิมไม่หาย เพราะยังใช้ Storage Key `jlpt-coach-state-v2` และ State Schema 3

## การเลื่อนที่ยังมีอยู่

คำว่า “ไม่ต้องเลื่อน” ในรุ่นนี้หมายถึง **ไม่ต้องเลื่อนหน้าควิซทั้งหน้าเพื่อไปหาตัวเลือกหรือปุ่มตอบ**

กรณีบทอ่านยาว เนื้อหาจะเลื่อนเฉพาะภายในกรอบ Reading เท่านั้น เพื่อรักษาขนาดตัวอักษรและไม่ตัดข้อความ ส่วนตัวเลือกและปุ่มตรวจคำตอบจะอยู่ในหน้าจอตลอดเวลา

## สิ่งที่ยังคงอยู่จาก V2.3.0

- N5–N1 Adaptive Plan
- Textbook Learning Path สำหรับ N5/N4/N3
- Question Lab 17 ประเภท
- Error Taxonomy 35 รหัส
- Grammar Quick Card / Deep Explain / Contrast Groups
- Topic และ Collocation Training
- Mock Ladder 10 ขั้น
- Multi-Voice Listening
- SRS, Mistake Log, Response-time tracking
- Local Auto Save และ Export/Import JSON
- Open-licensed Vocabulary/Kanji Sync และ IndexedDB Offline Cache

## อัปเดตจาก V2.3.0

1. Export Progress เป็น JSON ก่อน
2. อัปโหลดไฟล์ใน `JLPT_Coach_V2_3_1_CompactQuiz_Update.zip` ทับไฟล์เดิมที่ Root ของ GitHub Repository
3. รอ GitHub Pages Deploy
4. เปิด URL เดิมใน Safari แล้ว Refresh
5. ปิดแอปจาก App Switcher และเปิดใหม่จาก Home Screen
6. เข้า Profile และตรวจว่าแสดง Version 2.3.1

รุ่นนี้ไม่เปลี่ยนคลัง Content จึง **ไม่จำเป็นต้องกด Sync content ใหม่** หากคลังเดิมทำงานปกติ

## ไฟล์สำคัญที่เปลี่ยน

- `index.html` — โครงสร้าง Feedback Bottom Sheet และ Asset version
- `styles.css` — Compact Quiz Focus Mode และ Responsive rules
- `app.js` — Layout state, Question renderer, compact listening, feedback transcript
- `sw.js` — App-shell cache รุ่นใหม่
- `manifest.webmanifest` — คำอธิบายรุ่น
- `VERSION.txt` — Version metadata

## ข้อควรระวัง

- อย่าลบ Safari Website Data ก่อน Export Backup
- อย่าเปลี่ยน URL/Repository หากต้องการให้ Local Progress เดิมตามมาอัตโนมัติ
- หากยังเห็นหน้าตาเก่า ให้เปิด URL ใน Safari แล้ว Refresh จากนั้นปิดและเปิด PWA ใหม่
