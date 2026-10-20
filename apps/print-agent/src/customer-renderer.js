const byId=id=>document.getElementById(id);
const money=value=>{if(value===null||value===undefined)return '—';const [whole,fraction]=value.split('.');return '฿'+BigInt(whole).toLocaleString('th-TH')+'.'+fraction;};
let current={frame:null,reason:'IDLE'},lastItems='';
function updateQr(){
 const frame=current.frame,qr=frame?.qr,expired=qr?.expiresAt!==null&&qr&&qr.expiresAt<=Date.now();
 const visible=Boolean(qr&&!expired&&frame.kind==='payment'&&frame.total===qr.amount);
 byId('qr-panel').hidden=!visible;
 if(visible){if(byId('qr').getAttribute('src')!==qr.image)byId('qr').src=qr.image;byId('qr-expiry').textContent=qr.expiresAt===null?'กรุณาโอนตามยอดที่แสดง':`QR หมดอายุใน ${String(Math.floor(Math.max(0,qr.expiresAt-Date.now())/60000)).padStart(2,'0')}:${String(Math.floor(Math.max(0,qr.expiresAt-Date.now())/1000)%60).padStart(2,'0')}`;}
 else byId('qr').removeAttribute('src');
 if(expired||current.reason==='QR_EXPIRED')byId('payment-message').textContent='QRCode หมดอายุ กรุณารอพนักงานตรวจสอบ';
}
function render(value){
 current=value;const frame=value.frame,completed=frame?.kind==='completed',items=frame?.items??[];
 document.body.classList.toggle('success',completed);
 byId('status').textContent=completed?'ชำระเงินสำเร็จ':frame?.kind==='payment'?'รอชำระเงิน':items.length?'กำลังเลือกสินค้า':'ยินดีต้อนรับ';
 byId('heading').textContent=completed?'ขอบคุณที่ใช้บริการ':'รายการสินค้า';
 byId('item-count').textContent=items.length?items.reduce((n,item)=>n+item.quantity,0)+' ชิ้น':'';
 byId('empty').hidden=Boolean(items.length);byId('items').hidden=!items.length;
 byId('empty-message').textContent=value.reason==='DISCONNECTED'?'รอเชื่อมต่อ POS':'กรุณาเลือกสินค้า';
 const content=JSON.stringify(items);
 if(content!==lastItems){lastItems=content;const fragment=document.createDocumentFragment();for(const item of items){const row=document.createElement('div');row.className='item';const name=document.createElement('strong');name.textContent=item.name;const detail=document.createElement('small');detail.textContent=`${money(item.unitPrice)} / ชิ้น × ${item.quantity}`;const amount=document.createElement('span');amount.className='item-amount';amount.textContent=money(item.lineTotal);row.append(name,detail,amount);fragment.append(row);}byId('items').replaceChildren(fragment);byId('items').scrollTop=byId('items').scrollHeight;}
 byId('total-label').textContent=completed?'ยอดชำระสำเร็จ':frame?.kind==='cart'?'ยอดสินค้ารวม':'ยอดรวมที่ต้องชำระ';
 byId('total').textContent=frame?.total===null?'กำลังคำนวณ':money(frame?.total??'0.00');
 byId('subtotal').textContent=money(frame?.subtotal??'0.00');byId('discount').textContent=money(frame?.discount??'0.00');
 byId('cash').hidden=frame?.paymentMethod!=='CASH';byId('received').textContent=money(frame?.received);byId('change').textContent=money(frame?.change);byId('change-label').textContent=completed?'เงินทอน':'เงินทอนโดยประมาณ';
 byId('payment-message').textContent=completed?'ชำระเงินสำเร็จ ขอบคุณที่ใช้บริการ':frame?.kind==='payment'?'กรุณารอพนักงานยืนยันการชำระเงิน':value.reason==='DISCONNECTED'?'การเชื่อมต่อ POS ขาดหาย ข้อมูลรายการถูกซ่อนแล้ว':'';
 updateQr();
}
window.customerDisplay.onState(render);setInterval(updateQr,1000);
