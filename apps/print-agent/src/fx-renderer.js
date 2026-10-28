import{displayNumber,rateNumber}from'./fx-numbers.mjs';
const flags={"USD":"us","EUR":"eu","GBP":"gb","JPY":"jp","MYR":"my","SGD":"sg","HKD":"hk","BND":"bn","AUD":"au","CAD":"ca","CHF":"ch","CNY":"cn","DKK":"dk","INR":"in","KRW":"kr","LAK":"la","NOK":"no","NZD":"nz","SEK":"se","TWD":"tw","ZAR":"za","AED":"ae","VND":"vn","RUB":"ru","SAR":"sa"};
let frame=null,page=0,seen='';const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};const content=document.getElementById('content'),heading=document.getElementById('heading'),footer=document.getElementById('footer');function render(){content.replaceChildren();if(!frame){heading.textContent='WELCOME';footer.textContent='Please wait while we prepare your exchange.';return;}if(frame.view==='rates'){heading.textContent='อัตราแลกเปลี่ยน · EXCHANGE RATES';document.getElementById('updated').textContent='อัปเดต '+new Date(frame.updatedAt).toLocaleString('th-TH');const table=node('table',''),head=node('tr','');for(const t of['สกุลเงิน','รับซื้อ / BUY','ขาย / SELL'])head.append(node('th',t));table.append(head);const pages=Math.max(1,Math.ceil(frame.rows.length/14));page%=pages;for(const row of frame.rows.slice(page*14,(page+1)*14)){const tr=node('tr',''),name=node('td',row.code);if(flags[row.code]){const img=document.createElement('img');img.src='flags/'+flags[row.code]+'.svg';img.alt='';img.style.cssText='width:6vw;max-height:4vh;object-fit:contain;float:left;margin-right:2vw';name.prepend(img);}name.append(node('small',row.denomination+' · THB / '+row.basis+' '+row.code));tr.append(name,node('td',row.buy),node('td',row.sell));table.append(tr);}content.append(table);footer.textContent=`${page+1} / ${pages} · เปลี่ยนหน้าทุก 3 วินาที · บาทตามหน่วยที่ระบุในแต่ละสกุล`; }else{
 heading.textContent=frame.view==='completed'?'THANK YOU':frame.view==='idle'?'WELCOME':'CURRENCY EXCHANGE';
 document.getElementById('updated').textContent='';const section=node('section','');
 if(frame.view==='completed'){section.append(node('h2','Thank you for choosing LAEK Money'),node('p','Your exchange is complete.'));}
 else if(frame.view==='idle'){section.append(node('h2','Welcome to LAEK Money'),node('p','Please wait while we prepare your exchange.'));}
 else{
 for(const line of frame.items??[frame]){
 const code=line.currency.split(' ')[0];
 if(flags[code]){const img=document.createElement('img');img.src='flags/'+flags[code]+'.svg';img.alt=code+' flag';img.style.cssText='width:12vw;max-height:10vh;object-fit:contain';section.append(img);}
 section.append(node('h2',(frame.side==='BUY'?'WE BUY ':'WE SELL ')+line.currency),node('p','AMOUNT  '+displayNumber(line.amount)+' '+code),node('p','EXCHANGE RATE  '+rateNumber(line.rate,code)+' THB / '+displayNumber(line.basis)+' '+code),node('p',frame.side==='BUY'?'YOU RECEIVE':'YOU PAY'));
 }section.append(node('strong','THB '+displayNumber(frame.total,2)));
 }
 content.append(section);footer.textContent=frame.view==='quote'&&frame.expiresAt&&Date.now()>frame.expiresAt?'Rate expired. Please wait for our staff.':'';
 }}

window.customerDisplay.onState(state=>{const next=state.frame;if(JSON.stringify(next)!==seen){seen=JSON.stringify(next);page=0;}frame=next;render();});setInterval(()=>{if(frame?.view==='rates')page++;render();},3000);
