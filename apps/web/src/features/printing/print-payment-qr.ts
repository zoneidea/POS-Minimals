import {agentPrint,printerProfile} from './agent-client';
import {receiptFontCss} from '../sales/receipt-font';
export function paymentQrHtml(image:string,amount:string){
 if(!/^data:image\/(svg\+xml|png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(image)||!/^\d+\.\d{2}$/.test(amount))throw new Error('ข้อมูลพิมพ์ QRCode ไม่ถูกต้อง');
 return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>PromptPay QRCode</title><style>${receiptFontCss}@page{size:80mm auto;margin:4mm}body{width:72mm;margin:0;text-align:center;font:14px Prompt,Tahoma,sans-serif;color:#000;background:white}img{width:100%;max-width:58mm;height:auto;object-fit:contain}h1{font-size:20px}</style></head><body><h1>ชำระเงิน PromptPay</h1><h2>฿${amount}</h2><img src="${image}" alt="PromptPay QRCode"><p>กรุณาตรวจสอบยอดและชื่อผู้รับก่อนโอน</p><p>เอกสารนี้ไม่ใช่ใบเสร็จรับเงิน</p></body></html>`;
}
export async function printPaymentQr(image:string,amount:string){
 const html=paymentQrHtml(image,amount),profile=printerProfile();
 if(profile){await agentPrint(html,profile);return 'ส่งงานเข้าคิวเครื่องพิมพ์แล้ว';}
 const frame=document.createElement('iframe');frame.title='พิมพ์ PromptPay QRCode';frame.style.cssText='position:fixed;width:0;height:0;border:0;left:-10000px';
 frame.onload=async()=>{const target=frame.contentWindow;if(!target){frame.remove();return;}target.addEventListener('afterprint',()=>frame.remove(),{once:true});await frame.contentDocument?.fonts.ready;await Promise.all(Array.from(frame.contentDocument?.images??[]).map(img=>img.decode()));target.focus();target.print();};
 frame.srcdoc=html;document.body.append(frame);return 'เปิดหน้าต่างพิมพ์แล้ว';
}
