import{displayNumber,rateNumber}from'./fx-numbers.mjs';
const node=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
export function renderCustomer(frame,content,flags,page){
 const active=frame?.view==='quote',complete=frame?.view==='completed';
 const layout=node('div','','customer-layout'),body=node('div','','customer-list');
 const rows=frame?.items??(active?[frame]:[]),pages=Math.max(1,Math.ceil(rows.length/10));page%=pages;
 if(active){
  const table=node('table','','customer-table'),head=node('thead'),tr=node('tr');
  for(const label of['Flag','Currency','Amount','Total (THB)'])tr.append(node('th',label));head.append(tr);table.append(head);
  const tbody=node('tbody');
  for(const line of rows.slice(page*10,(page+1)*10)){
   const code=line.currency.split(' ')[0],row=node('tr'),flag=node('td'),currency=node('td',line.currency);
   if(flags[code]){const img=document.createElement('img');img.src='flags/'+flags[code]+'.svg';img.alt=code+' flag';flag.append(img);}else flag.textContent='—';
   currency.append(node('small',rateNumber(line.rate,code)+' THB / '+displayNumber(line.basis)+' '+code));
   row.append(flag,currency,node('td',displayNumber(line.amount)),node('td',displayNumber(line.total,2)));tbody.append(row);
  }
  table.append(tbody);body.append(table);
 }else{const welcome=node('div','','customer-welcome');welcome.append(node('h2',complete?'THANK YOU':'WELCOME'),node('p',complete?'Thank you for choosing LAEK Money.':'Welcome to LAEK Money.'),node('small',complete?'Your exchange is complete.':'Please wait while we prepare your exchange.'));body.append(welcome);}
 const summary=node('aside','','customer-summary');summary.append(node('span',complete?'EXCHANGE COMPLETE':active?(frame.side==='BUY'?'YOU RECEIVE':'YOU PAY'):'TOTAL AMOUNT','summary-eyebrow'),node('span','TOTAL THB','summary-label'),node('strong',displayNumber(frame?.total??'0',2),'summary-total'));
 const details=node('dl');for(const[label,value]of[['TRANSACTION NO.',frame?.receipt||((active)?'Pending confirmation':'—')],['DATE & TIME',frame?.transactionAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(frame.transactionAt)):'—']]){const group=node('div');group.append(node('dt',label),node('dd',value));details.append(group);}summary.append(details);layout.append(body,summary);content.append(layout);
 if(active&&frame.expiresAt&&Date.now()>frame.expiresAt)return'Rate expired. Please wait for our staff.';
 return active&&pages>1?`Page ${page+1} / ${pages} · Changes every 3 seconds`:'LAEK Money · Exchange a brighter world';
}
