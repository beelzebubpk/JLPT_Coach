# รายงานตรวจสอบ Release — JLPT Coach V2.3.1

## ผลรวม

**ผ่าน** สำหรับการนำไปอัปเดต GitHub Pages โดยรักษา Save เดิม

## Flow ที่ตรวจสอบ

- เปิดแอปด้วย Profile ที่ผ่าน Onboarding แล้ว
- เข้า Learn และเริ่ม Vocabulary, Grammar, Reading, Listening
- ข้าม Intro/Study Card จนถึงหน้าควิซ
- เลือกคำตอบและกดตรวจ
- เปิด Feedback Bottom Sheet
- ย่อและขยาย Feedback
- ปิดบทเรียนและเริ่ม Mode ใหม่

## ขนาดหน้าจอ

| Viewport | Vocab | Grammar | Reading | Listening |
|---|---:|---:|---:|---:|
| 320 × 568 | ผ่าน | ผ่าน | ผ่าน | ผ่าน |
| 375 × 667 | ผ่าน | ผ่าน | ผ่าน | ผ่าน |
| 390 × 844 | ผ่าน | ผ่าน | ผ่าน | ผ่าน |
| 430 × 932 | ผ่าน | ผ่าน | ผ่าน | ผ่าน |

ได้ทดสอบ N1 Reading/Listening เพิ่มที่ 320 × 568 และ 390 × 844 เพื่อครอบคลุมคำถามและตัวเลือกที่ยาวกว่า N4

## เกณฑ์ One-screen

- หน้าควิซหลักไม่มี Whole-page scroll
- `lessonMain.scrollHeight` ไม่เกิน `clientHeight`
- ตัวเลือกทุกข้ออยู่ภายในพื้นที่บทเรียน
- ปุ่มตรวจคำตอบ/ไปต่ออยู่ใน Viewport
- Reading เลื่อนเฉพาะ Passage pane
- Feedback เลื่อนภายใน Bottom Sheet

## Compatibility

- Storage Key: `jlpt-coach-state-v2`
- State Schema: 3
- Content Cache: ใช้ของ V2.3.0 ต่อได้
- ไม่เปลี่ยน ID ของคำศัพท์ ไวยากรณ์ บทอ่าน หรือ Listening
- ไม่ต้อง Sync คลังใหม่สำหรับการอัปเดต UI นี้

## สิ่งที่ต้องยืนยันบน iPhone จริง

- Voice ที่ iOS เปิดให้ Safari/PWA ใช้งาน
- Safe Area ตามรุ่น iPhone จริง
- Service Worker รับ Cache `jlpt-coach-v2-3-1-20260831-1`
- GitHub Pages Deploy และการ Refresh จาก URL เดิม
