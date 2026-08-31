# JLPT Coach N5–N1 — Version 2.1.1

เวอร์ชันนี้ขยายระบบคลัง Vocabulary และ Kanji ของ JLPT Coach โดยใช้ชุดข้อมูลเปิดที่มีสัญญาอนุญาตชัดเจน และจัดเก็บคลังที่ประมวลผลแล้วไว้ใน IndexedDB ของอุปกรณ์ เพื่อให้ใช้งานออฟไลน์ได้หลังการซิงก์ครั้งแรก

## ขอบเขตที่ทำในเวอร์ชันนี้

| ระดับเป้าหมาย | Vocabulary สะสม | Kanji สะสม |
|---|---:|---:|
| N5 | 800 | 100 |
| N4 | 1,500 | 300 |
| N3 | 3,750 | 650 |
| N2 | 6,000 | 1,000 |
| N1 | 10,000 | 2,000 |

ตัวเลขเป็นเป้าหมายเชิงประมาณการของแอป ไม่ใช่รายการทางการของ JLPT เนื่องจากผู้จัดสอบไม่ได้เผยแพร่รายการ Vocabulary, Kanji และ Grammar อย่างเป็นทางการสำหรับระบบข้อสอบหลังปี 2010

## ประเด็นสำคัญเรื่อง “ข้อสอบย้อนหลัง 5 ปี”

แอปนี้ **ไม่ได้คัดลอกหรือรวมข้อสอบจริงย้อนหลัง 5 ปี** เพราะข้อสอบจริงแต่ละรอบไม่ได้ถูกเผยแพร่ครบชุดอย่างเป็นทางการ และลิขสิทธิ์ข้อสอบเป็นของผู้จัดสอบ JLPT การอัปเดตนี้จึงใช้แนวทางที่ปลอดภัยกว่า:

1. ใช้แหล่ง Vocabulary/Kanji แบบเปิดและมี License
2. รวมและลบรายการซ้ำ
3. จัดลำดับเป็นเป้าหมายสะสม N5 → N1
4. รักษาโจทย์เดิมของ JLPT Coach ที่สร้างขึ้นเพื่อการฝึก
5. ใช้ประเภทโจทย์ทางการของ JLPT เป็นแนวทางในอนาคต แต่ไม่ทำสำเนาข้อสอบจริง

อ่านรายละเอียดได้ที่ `SOURCE_AUDIT_2021_2025_TH.md`

## แหล่งข้อมูลที่ใช้

### OpenJLPT

- เว็บไซต์: https://github.com/evanclan/OpenJLPT
- License: CC BY-SA 4.0
- ใช้: Vocabulary, Kanji, คำอ่าน, English meanings และตัวอย่างประโยคเมื่อมี

### WordMaster Word Lists

- เว็บไซต์: https://github.com/lratusa/wordmaster-wordlists
- License: MIT
- ใช้: Vocabulary และ Kanji เพิ่มเติมเพื่อขยาย Coverage
- หมายเหตุ: บางรายการเป็นคำแปลภาษาจีน ระบบจึงจำกัดรายการเหล่านั้นไว้กับโหมด Reading/Audio เมื่อไม่สามารถยืนยันว่าเป็น English meaning

### Open Anki JLPT Decks

- เว็บไซต์: https://github.com/jamsinclair/open-anki-jlpt-decks
- License: MIT
- ใช้: Vocabulary เสริมเพื่อเพิ่มจำนวน Unique words และลดความเสี่ยงที่คลัง N1 จะไม่ถึงเป้าหมาย 10,000 คำ

ดูรายละเอียดสัญญาอนุญาตได้ที่ `CONTENT_LICENSES.md`

## กลไกการซิงก์

เมื่อเปิด Version 2.1.1 ครั้งแรกขณะออนไลน์:

1. แอปดาวน์โหลดข้อมูลจากแหล่งเปิดผ่าน jsDelivr
2. หาก jsDelivr ไม่สำเร็จ จะลอง Raw GitHub เป็นแหล่งสำรอง
3. Normalize Schema ของแต่ละแหล่งให้เป็นรูปแบบเดียวกัน
4. ลบรายการซ้ำด้วย `word + reading` สำหรับ Vocabulary และตัวอักษรสำหรับ Kanji
5. รักษาเนื้อหา Starter/Curated เดิมของ JLPT Coach ไว้เป็นลำดับแรก
6. ตัดจำนวนสะสมตามเป้าหมายของแต่ละระดับ
7. เก็บคลังที่เสร็จแล้วไว้ใน IndexedDB
8. การเปิดครั้งต่อไปใช้คลัง Offline ในเครื่อง

หากดาวน์โหลดไม่สำเร็จ แอปจะเปิดด้วย Starter Pack เดิม และสามารถกด `โปรไฟล์ → ซิงก์คลังใหม่` เมื่อมีอินเทอร์เน็ต

## ไฟล์ที่เพิ่มหรือแก้ไข

- `content-config.js` — เป้าหมายจำนวน แหล่งข้อมูล URL และ Content Cache Version
- `content-engine.js` — Normalize, Merge, Deduplicate และจัด Coverage N5–N1
- `content-loader.js` — ดาวน์โหลด JSON/CSV, Cache ใน IndexedDB และ Offline fallback
- `app.js` — ใช้ Vocabulary + Kanji pack แบบสะสมตามระดับ
- `index.html` — หน้าสถานะและปุ่มซิงก์คลัง
- `styles.css` — UI สำหรับสถานะ Content Sync
- `sw.js` — Offline app-shell cache และ Cache Version ใหม่
- `manifest.webmanifest` — Metadata ของ PWA
- `VERSION.txt` — เลขเวอร์ชัน
- `CONTENT_LICENSES.md` — Attribution และ License
- `SOURCE_AUDIT_2021_2025_TH.md` — ขอบเขตการวิจัยข้อสอบย้อนหลัง
- `CONTENT_SOURCES.json` — Source/target metadata สำหรับตรวจสอบด้วยโปรแกรม

`data.js` และ `content.json` ยังคงเป็น Starter Pack ที่มากับแอป ไม่จำเป็นต้องแทนที่ในการอัปเดตแบบ Replacement Pack

## วิธี Replace บน GitHub Pages

ก่อนอัปเดต:

1. เปิดแอปเดิม
2. ไปที่ Profile/Settings
3. กด Export Progress
4. เก็บไฟล์ JSON ไว้ใน iCloud Drive

จากนั้น:

1. แตกไฟล์ `JLPT_Coach_V2_1_1_Content_Replacement.zip`
2. เข้า GitHub Repository เดิม
3. อัปโหลดไฟล์ทั้งหมดใน ZIP ทับไฟล์ชื่อเดิมที่ Root ของ Repository
4. Commit changes
5. รอ GitHub Pages Deploy
6. เปิด URL เดิมด้วย Safari ขณะออนไลน์
7. Refresh หน้าเว็บหนึ่งครั้ง
8. ปิด N4/JLPT Coach จาก App Switcher แล้วเปิดใหม่จาก Home Screen
9. ไปที่ `โปรไฟล์ → คลังเนื้อหา N5–N1`
10. กด `ซิงก์คลังใหม่`
11. รอจนสถานะแสดง `พร้อมใช้งาน`

ไม่ต้องลบ Icon จาก Home Screen และไม่ต้องสร้าง Repository ใหม่

## Auto Save และ Progress เดิม

การแทนที่ไฟล์ใน Repository เดิมจะไม่ลบ Local Progress ตราบใดที่:

- ใช้ GitHub Pages URL เดิม
- ไม่ลบ Safari Website Data
- ไม่กด Reset ในแอป
- ไม่เปลี่ยน Storage key `jlpt-coach-state-v2`

ข้อมูล Profile, XP, Streak, SRS, Mistake Log, Mock Test และคะแนนยังเก็บแยกในเครื่องของผู้ใช้แต่ละคนเหมือนเดิม

## ข้อควรทราบเกี่ยวกับภาษา

- เนื้อหา Curated เดิมยังมีคำอธิบายภาษาไทย
- คลังขนาดใหญ่ที่นำเข้าเป็น English-first
- WordMaster บางรายการอาจมี Chinese translation และจะไม่ถูกใช้สร้างคำถาม Meaning หากระบบตรวจไม่พบข้อความภาษาอังกฤษที่เพียงพอ
- การเพิ่มคำแปลไทยครบ 10,000+ คำควรทำเป็นโครงการแยก พร้อมกระบวนการตรวจคุณภาพโดยผู้สอนภาษาญี่ปุ่น

## การอัปเดตคลังในอนาคต

เมื่อแหล่งข้อมูลต้นทางได้รับการแก้ไข ผู้ดูแลสามารถเพิ่มเลข `version` และ `cache.key` ใน `content-config.js` แล้วเปลี่ยน `CACHE_NAME` ใน `sw.js` เพื่อบังคับให้แอปสร้างคลังใหม่ โดยไม่ต้องเปลี่ยน Adaptive Engine หรือข้อมูล Progress

## การทดสอบที่ดำเนินการ

- JavaScript syntax check ของ `app.js`, `content-config.js`, `content-engine.js`, `content-loader.js` และ `sw.js`
- JSON validation ของ `manifest.webmanifest` และ `CONTENT_SOURCES.json`
- Unit test ด้วยข้อมูลจำลองมากกว่า 10,000 Vocabulary และ 2,000 Kanji
- ยืนยันจำนวนสะสมเป้าหมาย 800/1,500/3,750/6,000/10,000 และ 100/300/650/1,000/2,000
- ยืนยันการลบรายการซ้ำและ Stable ID
- ยืนยันว่า Starter content เดิมมี Priority สูงสุดเพื่อรักษา SRS ID เดิม

## ข้อจำกัด

- จำนวนจริงหลังซิงก์อาจต่ำกว่าเป้าหมายหากแหล่งข้อมูลภายนอกบางแหล่งใช้งานไม่ได้ หรือจำนวน Unique items หลังลบซ้ำไม่พอ แอปจะแสดงจำนวนจริงและ Error count
- รายการระดับ JLPT เป็นการจัดหมวดจากแหล่งชุมชน/ชุดข้อมูลเปิด ไม่ใช่รายการรับรองจากผู้จัดสอบ
- Version นี้เพิ่ม Vocabulary/Kanji เป็นหลัก Grammar, Reading และ Listening ยังคงใช้คลังเดิม
- Projected Score และ Readiness เป็นตัวช่วยเรียน ไม่ใช่การรับรองผลสอบ
