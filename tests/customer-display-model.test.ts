import {it,expect} from 'vitest';
import {cartDisplay,checkoutDisplay,completedDisplay,withCustomerQr,type CheckoutDisplayInput} from '../apps/web/src/features/customer-display/model';
import type {CompletedSale} from '../apps/web/src/features/pos/checkout-client';
const items=[{id:'10000000-0000-4000-8000-000000000001',name:'ชาเขียว',barcode:'001',salePrice:'20.00',quantity:2,stock:20}];
const quote:NonNullable<CheckoutDisplayInput['quote']>={quoteFingerprint:'quote',items:[{productId:items[0]!.id,name:'ชาเขียว ราคาใหม่',unitPrice:'25.00',quantity:2,expectedVersion:2,stockAvailable:20,lineTotal:'50.00',barcode:'001'}],subtotalAmount:'50.00',discountAmount:'5.00',totalAmount:'45.00',vatAmount:'0.00',vatEnabled:false,vatRate:'7.00'};
const payment=()=>checkoutDisplay({items,quote,due:4500n,received:5000n,mode:'cash',pending:false});
it('uses draft quantities before checkout, then server prices/discounts and decimal-safe change',()=>{
 expect(cartDisplay(items)).toMatchObject({kind:'cart',total:'40.00',qr:null});
 expect(payment()).toMatchObject({kind:'payment',subtotal:'50.00',discount:'5.00',total:'45.00',received:'50.00',change:'5.00',items:[{name:'ชาเขียว ราคาใหม่',unitPrice:'25.00',lineTotal:'50.00'}]});
 expect(checkoutDisplay({items,quote,due:4500n,received:2000n,mode:'cash',pending:false}).change).toBeNull();
 expect(checkoutDisplay({items,quote,due:null,received:5000n,mode:'cash',pending:false}).total).toBeNull();
 expect(checkoutDisplay({items,quote,due:4500n,received:5000n,mode:'cash',pending:true})).toMatchObject({total:null,change:null});
});
it('shows QR only for the matching PromptPay amount and valid expiry, never during cash/pending/completed views',()=>{
 const qr={image:'data:image/png;base64,aGVsbG8=',amount:'45.00',mode:'GATEWAY' as const,expiresAt:2000},frame={...payment(),paymentMethod:'PROMPTPAY' as const,received:null,change:null};
 expect(withCustomerQr(frame,qr,1000).qr).toEqual(qr);
 expect(withCustomerQr(frame,qr,2000).qr).toBeNull();expect(withCustomerQr(frame,{...qr,expiresAt:null},1000).qr).toBeNull();
 expect(withCustomerQr(payment(),qr,1000).qr).toBeNull();expect(withCustomerQr({...frame,total:null},qr,1000).qr).toBeNull();
 expect(withCustomerQr(frame,{...qr,amount:'40.00'},1000).qr).toBeNull();
 expect(withCustomerQr(frame,{...qr,image:'https://example.com/qr'},1000).qr).toBeNull();
 expect(withCustomerQr(frame,{...qr,mode:'UPLOAD',expiresAt:null},1000).qr?.mode).toBe('UPLOAD');
 expect(withCustomerQr({...frame,kind:'completed'},qr,1000).qr).toBeNull();
});
it('shows confirmed receipt snapshots and change, without live prices or customer QR',()=>{
 const sale:CompletedSale={saleId:items[0]!.id,saleNo:'B001',status:'COMPLETED',totalAmount:'45.00',receivedAmount:'50.00',changeAmount:'5.00',receipt:{saleId:items[0]!.id,saleNo:'B001',completedAtUtc:'2026-10-20T10:00:00Z',store:{name:'ร้านทดสอบ'},cashierName:'พนักงาน',paymentMethod:'CASH',items:[{barcode:'001',productName:'ชื่อ ณ เวลาขาย',quantity:2,unitPrice:'25.00',discountAmount:'5.00',lineTotal:'45.00'}],totals:{subtotal:'50.00',discount:'5.00',vat:'0.00',total:'45.00',received:'50.00',change:'5.00'}}};
 expect(completedDisplay(sale)).toMatchObject({kind:'completed',items:[{name:'ชื่อ ณ เวลาขาย'}],total:'45.00',change:'5.00',qr:null});
});
it('serialized browser frames satisfy the packaged Agent protocol without sharing runtime dependencies',async()=>{
 const url=new URL('../apps/print-agent/src/customer-display-protocol.mjs',import.meta.url).href;const {validateDisplayUpdate}=await import(url);
 const frames=[cartDisplay(items),payment(),checkoutDisplay({items,quote,due:4500n,received:null,mode:'promptpay',pending:false})];
 for(const frame of frames)expect(validateDisplayUpdate({sessionId:items[0]!.id,sequence:1,frame:JSON.parse(JSON.stringify(frame))}).frame).toEqual(frame);
});
