# วิธีอัปเดต JLPT Coach V2.3.1 ผ่าน GitHub Pages บน iPhone

## 1. สำรองข้อมูล

เปิดแอปเดิม → Profile → Export Progress → เก็บไฟล์ JSON ไว้ใน iCloud Drive

## 2. ดาวน์โหลดและแตก Update Pack

ดาวน์โหลด `JLPT_Coach_V2_3_1_CompactQuiz_Update.zip` แล้วแตะ ZIP หนึ่งครั้งในแอป Files

## 3. อัปโหลดทับ Repository เดิม

1. เปิด GitHub ด้วย Safari
2. เข้า Repository ที่ใช้กับ JLPT Coach
3. เลือก `Add file → Upload files`
4. เลือกไฟล์ทั้งหมดภายในโฟลเดอร์ที่แตกจาก ZIP
5. อัปโหลดไปที่ Root เดียวกับ `index.html`
6. Commit message แนะนำ: `Update JLPT Coach to V2.3.1 compact quiz`

ไม่ต้องลบ `data.js`, `content.json`, `assets/` หรือสร้าง Repository ใหม่

## 4. รับไฟล์ใหม่บน iPhone

1. รอ GitHub Pages Deploy สำเร็จ
2. เปิด URL เดิมด้วย Safari ขณะมีอินเทอร์เน็ต
3. Refresh หนึ่งครั้ง
4. ปิด JLPT Coach จาก App Switcher
5. เปิดใหม่จาก Icon บน Home Screen
6. เข้า Profile → About และตรวจ Version 2.3.1

## 5. ตรวจหน้าควิซ

เปิด Vocabulary, Grammar, Reading และ Listening อย่างละหนึ่งข้อ ควรเห็น:

- ปุ่มตรวจคำตอบอยู่ด้านล่างตลอด
- ตัวเลือกอยู่ในหน้าเดียว
- Reading เลื่อนเฉพาะกรอบบทอ่าน
- Listening เห็นผู้พูดและปุ่มเสียงพร้อมตัวเลือก
- หลังตอบ เฉลยเปิดจากด้านล่างและกด “ไปต่อ” ได้ทันที

## หากยังเห็น Version เก่า

- เปิด URL ผ่าน Safari และ Refresh อีกครั้ง
- ปิด PWA จาก App Switcher แล้วเปิดใหม่
- ไม่จำเป็นต้องลบ Icon หรือ Clear Website Data

## Progress เดิม

ยังใช้ `jlpt-coach-state-v2` และ Schema 3 จึงรักษา Profile, XP, Streak, SRS, Mistake Log, Mock Test และ Progress ทุกระดับ เมื่อใช้ URL เดิม
