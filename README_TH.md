# JLPT Coach N5–N1 — Version 2

แอป PWA แบบ Mobile-first สำหรับผู้เรียน JLPT ตั้งแต่ N5 ถึง N1 โดยสร้างแผนเฉพาะบุคคลจากระดับเป้าหมาย คะแนนราย Section, Reference Information A/B/C, จุดอ่อนที่ผู้เรียนระบุ, เวลาที่เรียนได้, ผลการฝึก, SRS, Mistake Log และ Mock Test

## สิ่งใหม่ใน Version 2

- เลือกระดับเป้าหมาย N5 / N4 / N3 / N2 / N1 ตั้งแต่ Onboarding
- ช่องกรอกคะแนนเปลี่ยนตามโครงสร้างของระดับ
  - N4/N5: Language Knowledge + Reading และ Listening
  - N1/N2/N3: Language Knowledge, Reading และ Listening
- วิเคราะห์คะแนนรวมและ Section minimum แยกกัน
- คำนวณ Study Weight แบบ Adaptive สำหรับ Vocabulary/Kanji, Grammar, Reading และ Listening
- Daily Quest เปลี่ยนตามคะแนน ข้อผิด ความแม่นยำ เวลาในการตอบ และจำนวนวันที่เหลือ
- Progress แยกตามระดับ ผู้ใช้สลับเป้าหมายได้โดยข้อมูลระดับเดิมไม่หาย
- เพิ่มผลสอบจริงหลายครั้ง และบันทึก Mock Test แยกตามระดับ
- Local auto-save, Export/Import JSON และ Offline PWA
- รองรับการย้าย Progress จาก N4 Sprint Version 1 เมื่อใช้ URL/Origin เดิม

## คลังเนื้อหาใน Release นี้

- N4: คลังเต็มจาก N4 Sprint เดิม — Vocabulary 180, Grammar 41, Reading 20, Listening 20
- N5 / N3 / N2 / N1: Starter Pack ต่อระดับ — Vocabulary 40, Grammar 15, Reading 6, Listening 6

Adaptive Engine รองรับทุกระดับแล้ว แต่ Starter Pack ของ N5/N3/N2/N1 เป็นฐานเริ่มต้นสำหรับ Version 2 และสามารถขยาย `content.json` / `data.js` เพิ่มโดยไม่ต้องเปลี่ยนระบบหลัก

## ไฟล์สำคัญ

- `index.html` — หน้าแอป
- `styles.css` — UI/Responsive/Dark mode
- `data.js` — คลังเนื้อหาที่ Browser โหลด
- `content.json` — คลังเนื้อหารูปแบบ JSON สำหรับแก้ไข/ขยาย
- `app.js` — Adaptive Engine, SRS, Mistake Log, Local Save และ UI logic
- `manifest.webmanifest` — ข้อมูลติดตั้ง PWA
- `sw.js` — Offline cache
- `assets/` — Icon ของแอป
- `JLPT_Coach_V2_Standalone.html` — รุ่นไฟล์เดียวสำหรับทดลอง

## ติดตั้งผ่าน GitHub Pages

1. แตกไฟล์ ZIP
2. อัปโหลด **เนื้อหาภายในโฟลเดอร์ทั้งหมด** ไปยัง Root ของ GitHub repository
3. ตรวจว่า `index.html` อยู่หน้าแรกของ repository
4. ไปที่ `Settings → Pages`
5. เลือก `Deploy from a branch`
6. เลือก `main` และ `/(root)` แล้ว Save
7. เปิด URL ที่ GitHub Pages สร้างให้ด้วย Safari บน iPhone
8. กด `Share → Add to Home Screen`
9. เปิดแอปครั้งแรกขณะมีอินเทอร์เน็ต เพื่อให้ Service Worker เก็บ Offline cache

## อัปเดตจาก N4 Sprint เดิม

### วิธีที่รักษา Local Progress ได้ง่ายที่สุด

ใช้ repository และ URL เดิม:

1. ใน N4 Sprint เดิม เข้า Settings แล้ว Export Progress ก่อน
2. อัปโหลดไฟล์ Version 2 ทับไฟล์เดิมใน repository
3. รอ GitHub Pages Deploy
4. เปิด URL เดิมใน Safari แล้ว Refresh
5. เปิดจาก Home Screen อีกครั้ง

Version 2 จะตรวจ Local Storage key ของ N4 Sprint เดิมและย้าย XP, Streak, SRS, Mistake Log, Mock score และข้อมูล N4 ที่รองรับเข้าสู่ระบบใหม่อัตโนมัติ

### กรณีใช้ repository หรือ URL ใหม่

Local Storage จะไม่ตามไปเอง เพราะถือเป็นเว็บไซต์คนละ Origin ให้ใช้:

1. Export Progress จากแอปเดิม
2. เปิด Version 2
3. ไปที่ Profile → Import Progress
4. เลือกไฟล์ JSON ที่ Export ไว้

## Auto Save และความเป็นส่วนตัว

- แอปบันทึกอัตโนมัติใน Local Storage หลังตอบคำถาม จบบทเรียน เปลี่ยน Settings เพิ่มคะแนน หรือแก้ Profile
- ไม่มี Login และไม่มี Backend
- ผู้ใช้หลายคนเปิด URL เดียวกันจากคนละเครื่อง จะมี Save แยกกัน
- การลบ Safari Website Data, ลบข้อมูลเว็บไซต์ หรือ Reset ในแอปจะลบ Progress ของเครื่องนั้น
- แนะนำ Export Backup อย่างน้อยสัปดาห์ละครั้ง

## Adaptive Plan ใช้ข้อมูลอะไร

1. คะแนนสอบล่าสุดในระดับเป้าหมาย
2. คะแนนระดับใกล้เคียงเมื่อยังไม่มีคะแนนตรงระดับ
3. Reference Information A/B/C
4. Self-assessment เช่น Vocabulary, Kanji, Reading, Listening หรือ Speed
5. Accuracy และเวลาตอบแยกทักษะ
6. Mistake Log และจำนวนครั้งที่ผิดซ้ำ
7. SRS due items
8. จำนวนวันถึงวันสอบ
9. Mock Test ล่าสุด

ทักษะทุกด้านมี Maintenance floor เพื่อไม่ให้ระบบตัดทักษะใดออกทั้งหมด แต่จุดอ่อนจะได้รับสัดส่วนเวลามากกว่า

## การเตือนบน iPhone

Browser Notification ไม่ควรถูกถือว่าเป็น Push Notification ที่รับประกันเมื่อปิดแอปทั้งหมด วิธีที่เสถียรกว่าคือกดดาวน์โหลด `.ics` ในหน้า Profile แล้วเพิ่มกิจกรรมรายวันลง Apple Calendar

## ข้อจำกัด

- คลังข้อสอบเป็นเนื้อหาฝึกที่สร้างขึ้น ไม่ใช่ข้อสอบทางการของ JLPT
- Projected Score และ Readiness เป็นตัวช่วยติดตาม ไม่ใช่การรับรองผลสอบ
- Listening ใช้ Japanese Text-to-Speech ของอุปกรณ์ ไม่ใช่เสียงผู้พูดหลายคนแบบข้อสอบจริง
- รุ่น Standalone อาจเก็บ Local Storage จากไฟล์ local ไม่เสถียรเท่า PWA ที่เปิดผ่าน HTTPS
- คลัง N5/N3/N2/N1 ใน Version 2 เป็น Starter Pack และควรเพิ่มเนื้อหาก่อนใช้เป็นหลักสูตรระยะยาวเต็มรูปแบบ

## การทดสอบ Release

ทดสอบแล้วกับ Mobile viewport 390 × 844:

- Onboarding 4 ขั้น
- เลือก N5–N1
- Dynamic score fields 2 หรือ 3 Section ตามระดับ
- Adaptive analysis preview
- Daily Quest และ Priority weighting
- Quick lesson, answer grading และคำอธิบายข้อผิด
- Mock/result forms
- Responsive mobile UI
- ไม่มี JavaScript page error ใน flow หลักที่ทดสอบ

