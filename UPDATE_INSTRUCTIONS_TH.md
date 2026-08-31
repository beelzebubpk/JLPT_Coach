# วิธีอัปเดต JLPT Coach เป็น Version 2.3.0 บน GitHub Pages (iPhone)

1. เปิดแอปเดิม → โปรไฟล์ → Export Progress และเก็บ JSON ใน iCloud Drive.
2. ดาวน์โหลดและแตก `JLPT_Coach_V2_3_0_Update.zip` ใน Files.
3. Safari → GitHub → repository เดิม → Add file → Upload files.
4. เลือกทุกไฟล์ในแพ็ก รวม `textbook-engine.js`, `content.json`, `data.js`, `app.js`, `index.html`, `styles.css`, `sw.js` และไฟล์ config/engine อื่น.
5. Upload ไปที่ Root เดียวกับ `index.html` และ Commit: `Update JLPT Coach to V2.3.0`.
6. รอ GitHub Pages deploy.
7. เปิด URL เดิมใน Safari ขณะออนไลน์และ Refresh.
8. ปิดแอปจาก App Switcher แล้วเปิดจากไอคอน Home Screen.
9. โปรไฟล์ → ตรวจสถานะ Textbook Engine และ Version 2.3.0.
10. กดซิงก์คลังใหม่ 1 ครั้ง เพื่อสร้าง IndexedDB cache เวอร์ชันใหม่.

ไม่ต้องลบไอคอน Home Screen, ไม่ต้องสร้าง repository ใหม่, และไม่ควรลบ Safari Website Data.
