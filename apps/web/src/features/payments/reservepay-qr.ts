import { initializeReservepay } from '../../lib/reservepay-sdk';
export interface ReservepayPaymentSdk {
 endpoints: { sdk: {
  selectPaymentMethod(input:{amount:string;currency:'THB';payment_method:'PROMPTPAY'}):Promise<string>;
  createDiscoverNextActionPolling():{execute(input:{payment_session_id:string;pollingUntilAction:'DISPLAY_QR'|'CHECK_STATUS'}):Promise<string>;abort():void};
  retrieveQrData(input:{payment_session_id:string}):Promise<string>;
  checkStatus(input:{payment_session_id:string}):Promise<string>;
 } };
}
export async function paymentSdk(){
 const instance=await initializeReservepay() as ReservepayPaymentSdk;
 if(!instance?.endpoints?.sdk?.selectPaymentMethod)throw new Error('ReservePay SDK ไม่พร้อมใช้งาน');
 return instance.endpoints.sdk;
}
export function amountMinor(amount:string){
 if(!/^\d+\.\d{2}$/.test(amount)||BigInt(amount.replace('.',''))<=0n)throw new Error('ยอดชำระไม่ถูกต้อง');
 return BigInt(amount.replace('.','')).toString();
}
/** The base64 response encodes QR text, not HTML. Rasterize it for screen and printer. */
export async function qrImageSource(encoded:string):Promise<string> {
 if(typeof encoded!=='string'||encoded.length>20000)throw new Error('ข้อมูล QRCode ไม่ถูกต้อง');
 const text=atob(encoded);
 if(!text||text.length>4096)throw new Error('ข้อมูล QRCode ไม่ถูกต้อง');
 const QRCode=await import('qrcode');
 return QRCode.toDataURL(text,{width:512,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}});
}
export function paymentStatusLabel(status:string){
 switch(status){case 'SUCCESSFUL':return 'ReservePay ยืนยันชำระเงินสำเร็จแล้ว · ยังไม่ได้บันทึกบิลขายใน POS';case 'FAILED':return 'ชำระเงินไม่สำเร็จ';case 'EXPIRED':return 'QRCode หมดอายุ';default:return 'ยังไม่พบการชำระเงิน กรุณาตรวจสอบอีกครั้ง';}
}
