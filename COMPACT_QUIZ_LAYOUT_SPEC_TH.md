# Compact Quiz Layout Specification — V2.3.1

## เป้าหมาย

ให้ผู้ใช้ทำควิซบนมือถือโดยไม่ต้องเลื่อน Whole page เพื่อหาโจทย์ ตัวเลือก หรือปุ่มตอบ

## โครงสร้างหน้าจอ

1. Compact header: ปิดบทเรียน + Progress + ลำดับข้อ/พลังงาน
2. Question zone: ประเภทข้อ เวลาเป้าหมาย คำถาม และ Hint แบบพับได้
3. Stimulus zone:
   - Vocabulary/Grammar: ไม่มีกรอบว่าง ใช้พื้นที่จัดตัวเลือกให้อยู่กลางจอ
   - Reading: Internal scroll pane
   - Listening: Speaker chips + Play/Slow/Stop
4. Answer zone: Fixed inside quiz viewport
5. Action bar: ตรวจคำตอบ/ไปต่อ อยู่ด้านล่างพร้อม Safe Area
6. Feedback: Collapsible bottom sheet พร้อม internal scroll

## Responsive targets ที่ตรวจสอบ

- 320 × 568
- 375 × 667
- 390 × 844
- 430 × 932

## กติกา Overflow

- `lessonMain`: hidden ระหว่างทำควิซ
- `passage-scroll`: auto เฉพาะ Reading ยาว
- `options-stacked`: auto เฉพาะตัวเลือกที่ยาวผิดปกติ
- `feedback-panel`: auto สำหรับคำอธิบายละเอียด
- Intro, Grammar Study Card และ Summary ยังสามารถเลื่อนตามปกติ เพราะไม่ใช่หน้าตอบควิซ
