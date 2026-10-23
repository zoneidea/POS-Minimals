import type {ContactMessage} from './ContactSection';
export async function contactAvailable(transport:typeof fetch=fetch){
 try{const response=await transport('/api/v1/contact/config',{cache:'no-store'});const body=await response.json();return response.ok&&body.success===true&&body.data?.enabled===true;}catch{return false;}
}
export function createContactSender(transport:typeof fetch=fetch){
 let previous='',key='';
 return async(input:ContactMessage)=>{
  const payload=JSON.stringify(input);
  // Keep the same key after an uncertain result; edited messages get a new key.
  if(payload!==previous){previous=payload;key=crypto.randomUUID();}
  let response:Response,body:{success?:boolean;data?:{accepted?:boolean}};
  try{response=await transport('/api/v1/contact',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:payload,signal:AbortSignal.timeout(18000)});
  body=await response.json();}catch{throw new Error('ยังยืนยันการส่งข้อความไม่ได้ ข้อมูลที่กรอกยังอยู่ กรุณาลองส่งข้อความเดิมอีกครั้ง');}
  if(!response.ok||body.success!==true||body.data?.accepted!==true)throw new Error(response.status===429?'ส่งข้อความเกินจำนวนที่กำหนด กรุณารอสักครู่หรือติดต่อทางอีเมล':response.status===503?'ช่องทางส่งข้อความยังไม่พร้อม กรุณาติดต่อ dev@zoneidea.co.th':'ยังยืนยันการส่งข้อความไม่ได้ ข้อมูลที่กรอกยังอยู่ กรุณาลองส่งข้อความเดิมอีกครั้ง');
  previous='';key='';
 };
}
