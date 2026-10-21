export const landingTitle='POSJung | ระบบ POS ฟรี สำหรับร้านทั่วไปและคาเฟ่';
export const landingDescription='POSJung ขายง่าย ใช้ฟรี ระบบ POS ใช้งานผ่านเว็บ เลือกหรือเปลี่ยนโหมดร้านขายของทั่วไปและคาเฟ่ จัดการสินค้า สต็อก บันทึกการขาย ออกเลขคิวและพิมพ์ใบเสร็จ';
export const siteUrl='https://posjung.com/';
export const shareImage=siteUrl+'images/posjung-share.png';
export const faqItems=[
 {question:'ใช้งานฟรีอะไรบ้าง?',answer:'ใช้ฟังก์ชันของระบบขายหน้าร้านฟรี ทั้งการขาย จัดการสินค้าและสต็อก รายงานยอดขาย และจัดการพนักงาน'},
 {question:'ต้องมีอุปกรณ์อะไร?',answer:'มีโน้ตบุ๊กหรือ PC ที่เชื่อมต่ออินเทอร์เน็ตและเปิดเว็บเบราว์เซอร์ได้ ก็เริ่มใช้งานได้ หากต้องการพิมพ์ใบเสร็จ ให้เพิ่มเครื่องพิมพ์และติดตั้งไดรเวอร์ของเครื่องนั้น'},
 {question:'เริ่มขายต้องทำอย่างไร?',answer:'กดสร้างร้านฟรี สมัครบัญชีและยืนยันอีเมล เลือกโหมดร้าน จากนั้นเพิ่มสินค้าและจำนวนคงเหลือ แล้วเริ่มขายได้เลย'},
 {question:'รับพร้อมเพย์ต้องตรวจสลิปหรือไม่?',answer:'เมื่อเปิดรับพร้อมเพย์แบบระบบยืนยันการจ่ายและตั้งค่าบัญชีรับเงินแล้ว ให้สร้าง QR สำหรับยอดขาย ลูกค้าสแกนจ่าย แล้วกดตรวจสอบการชำระเงิน ระบบตรวจผลการชำระจากผู้ให้บริการที่เชื่อมต่อธนาคาร การใช้รูป QR ที่อัปโหลดเองยังต้องยืนยันการรับเงินด้วยตนเอง'},
 {question:'เปลี่ยนโหมดร้านได้หรือไม่?',answer:'เลือกโหมดร้านขายของทั่วไปหรือคาเฟ่ตั้งแต่สร้างร้าน เจ้าของร้านเปลี่ยนภายหลังได้ที่ตั้งค่าร้าน โดยเก็บสินค้าและประวัติขายเดิม'},
 {question:'โหมดคาเฟ่พิมพ์อะไรได้บ้าง?',answer:'หลังรับเงินสำเร็จ ระบบออกเลขคิวและพิมพ์ใบเสร็จพร้อมเลขคิว ต่อด้วยใบออเดอร์สำหรับเตรียมผ่าน posjung-agent โดยไม่ต้องจัดการสถานะออเดอร์'},
];
export const structuredData={
 '@context':'https://schema.org','@graph':[
  {'@type':'WebSite','@id':siteUrl+'#website',name:'POSJung',url:siteUrl,inLanguage:'th',publisher:{'@type':'Organization',name:'POSJung',logo:siteUrl+'brand/posjung-wordmark.webp'}},
  {'@type':'SoftwareApplication',name:'POSJung',url:siteUrl,applicationCategory:'BusinessApplication',operatingSystem:'Web',inLanguage:'th',image:shareImage,description:landingDescription,offers:{'@type':'Offer',price:'0',priceCurrency:'THB',description:'ระบบขายหน้าร้าน รองรับโหมดร้านทั่วไปและคาเฟ่'}},
 ],
};
