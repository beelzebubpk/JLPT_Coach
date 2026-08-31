# วิธีอัปเดต JLPT Coach เป็น Version 2.2.0 Multi-Voice

## ก่อนเริ่ม — สำรอง Progress

1. เปิด JLPT Coach เวอร์ชันเดิม
2. ไปที่ `โปรไฟล์ → สำรองข้อมูล`
3. กด `Export`
4. เก็บไฟล์ JSON ใน iCloud Drive

การอัปเดตผ่าน Repository และ URL เดิมไม่ควรลบ Progress แต่ควรมี Backup ก่อนเสมอ

## ไฟล์ใน Update Pack

อัปโหลดไฟล์ต่อไปนี้ไปที่ Root ของ GitHub Repository เดิม:

- `index.html`
- `styles.css`
- `app.js`
- `dialogue-engine.js` — ไฟล์ใหม่ ต้องอัปโหลดเพิ่ม
- `sw.js`
- `manifest.webmanifest`
- `VERSION.txt`
- `README_TH.md`
- `CHANGELOG_TH.md`
- `CONTENT_LICENSES.md` — บันทึกสิทธิ์และขอบเขตการใช้แหล่งข้อมูล
- `BUILD_VALIDATION.txt` — รายงานการตรวจสอบ Release
- `REPLACE_INSTRUCTIONS_TH.md` — คู่มือฉบับนี้

ไม่จำเป็นต้องแทนที่:

- `data.js`
- `content.json`
- `content-config.js`
- `content-engine.js`
- `content-loader.js`
- `assets/`

## ขั้นตอนบน GitHub มือถือ

1. แตก `JLPT_Coach_V2_2_0_MultiVoice_Update.zip` ในแอป Files
2. เปิด GitHub Repository เดิมด้วย Safari
3. เลือก `Add file → Upload files`
4. เลือกไฟล์ทั้งหมดใน Update Pack
5. เมื่อ GitHub แจ้งชื่อไฟล์ซ้ำ ให้ยืนยันแทนที่ไฟล์เดิม
6. ตรวจว่า `dialogue-engine.js` อยู่ Root ระดับเดียวกับ `app.js`
7. Commit message แนะนำ: `Update JLPT Coach to v2.2.0 multi-voice`
8. รอ GitHub Pages Deploy

## บังคับให้ iPhone รับ Version ใหม่

1. เปิด URL GitHub Pages เดิมใน Safari ขณะออนไลน์
2. กด Refresh หนึ่งครั้ง
3. รอให้หน้าเปิดสมบูรณ์
4. ปิด JLPT Coach จาก App Switcher
5. เปิดจาก Icon บน Home Screen ใหม่
6. ไปที่ `โปรไฟล์ → เกี่ยวกับ` และตรวจว่าแสดง `Version 2.2.0`

ไม่ต้องลบ Icon จาก Home Screen และไม่ต้องสร้าง Repository ใหม่

## ทดสอบ Multi-Voice

1. ไปที่ `โปรไฟล์ → การเรียนประจำวัน`
2. เปิด `เสียงอ่านภาษาญี่ปุ่น`
3. เปิด `แยกเสียงตามผู้พูด`
4. กด `ทดสอบ 2 เสียง`
5. เข้า `เรียน → Listening Sprint`
6. เลือกข้อที่มีผู้พูด 2 คน
7. กด Play และตรวจว่า Speaker chip สลับ Highlight
8. หลังตอบ ตรวจว่า Script แยกเป็นรายผู้พูดและแตะแต่ละบรรทัดฟังซ้ำได้

## ถ้าเสียงยังเหมือนกันมาก

- ตรวจสถานะใต้ปุ่มทดสอบเสียง
- หากแสดงว่าพบ Japanese voice เพียง 1 เสียง ระบบจะใช้ Pitch/Rate แยกตัวละครแทน
- ลองเลือกความเร็ว `มาตรฐาน` แล้วทดสอบใหม่
- เพิ่ม Japanese voice ในการตั้งค่าภาษา/เสียงของ iPhone แล้วเปิดแอปใหม่
- เสียงที่มีจริงขึ้นกับรุ่น iPhone และเวอร์ชัน iOS

## ถ้ายังเห็น Version เก่า

1. เปิด URL ผ่าน Safari โดยตรง
2. Refresh อีกครั้ง
3. ตรวจว่า Repository มี `dialogue-engine.js`
4. ตรวจว่า `sw.js` มี Cache name `jlpt-coach-v2-2-0-20260831-1`
5. ปิดแอปจาก App Switcher แล้วเปิดใหม่
6. ห้ามลบ Safari Website Data ก่อน Export Progress
