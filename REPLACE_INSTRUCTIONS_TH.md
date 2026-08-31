# วิธี Replace JLPT Coach เป็น Version 2.1.1

## ก่อนเริ่ม

1. เปิดแอปเดิม
2. ไปที่ Profile/Settings
3. กด Export Progress
4. เก็บไฟล์ JSON ไว้ใน iCloud Drive

## ไฟล์ที่ต้อง Replace

อัปโหลดไฟล์ทั้งหมดจาก `JLPT_Coach_V2_1_1_Content_Replacement.zip` ไปที่ Root ของ GitHub Repository เดิม และเลือกแทนที่ไฟล์ชื่อเดิม

ไม่ต้องลบหรือแก้:

- `data.js`
- `content.json`
- `assets/`

## หลัง Commit

1. รอ GitHub Pages Deploy
2. เปิด URL เดิมด้วย Safari ขณะออนไลน์
3. Refresh หนึ่งครั้ง
4. ปิดแอปจาก App Switcher
5. เปิด JLPT Coach จาก Home Screen
6. ไปที่ Profile → คลังเนื้อหา N5–N1
7. กด `ซิงก์คลังใหม่`
8. รอจนแสดง `พร้อมใช้งาน`

การซิงก์ครั้งแรกอาจใช้เวลาหลายนาทีตามความเร็วอินเทอร์เน็ต หลังจากนั้นแอปใช้คลังใน IndexedDB แบบออฟไลน์

## ถ้ายังเห็นจำนวนเดิม

1. เปิด URL ผ่าน Safari โดยตรง
2. Refresh
3. กลับไปที่ Home Screen app
4. กด `ซิงก์คลังใหม่` อีกครั้ง
5. ห้ามลบ Safari Website Data ก่อน Export Progress
