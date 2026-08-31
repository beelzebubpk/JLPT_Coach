# รายงานตรวจสอบ JLPT Coach V2.3.0

## ผลรวม

- Structural/Data validation: ผ่าน
- Browser mobile flow: **14/14 checks ผ่าน**
- JavaScript page error: 0
- Console error: 0
- Viewport ทดสอบ: 390x844

## Flow ที่ทดสอบ

- เปิดแอปและโหลด Textbook/Dialogue Engine
- Onboarding N4 พร้อมคะแนน 51/120 + 24/60
- Adaptive analysis และ Score gap 15 คะแนน
- Learning Path, Question Lab และ Topic Path
- ตรวจคำตอบและบันทึก Question subtype
- Grammar Quick Card / Deep Explain
- Listening หลายผู้พูด, ซ่อน Script ก่อนตอบ และเปิด Transcript หลังตอบ
- Error subtype analytics และ Mock Ladder 10 ขั้น
- Local Save schema 3 และการกู้ข้อมูลใน document ใหม่

## ข้อจำกัดการทดสอบ

สภาพแวดล้อมสร้างไฟล์บล็อกการนำทาง HTTP/local จึงไม่ได้ทดสอบ Service Worker และการดาวน์โหลด Open Content ผ่านเครือข่ายแบบ end-to-end ใน Browser จริง อย่างไรก็ตาม ได้ตรวจ syntax, manifest, app-shell path, cache version และไฟล์ที่อ้างอิงทั้งหมดแล้ว หลังอัปเดตบน GitHub Pages ควรเปิดด้วย Safari และกดซิงก์คลังใหม่หนึ่งครั้งเพื่อยืนยันเครือข่ายและเสียง iOS จริง
