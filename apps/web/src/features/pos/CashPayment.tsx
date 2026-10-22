import './cash-payment.css';
import { Delete } from 'lucide-react';
import { addCash,amountInput,cashDigit,parseAmount } from './checkout-amounts';
import { formatAmount } from './cart';
export function CashPayment({received,onChange,due}:{received:string;onChange:(value:string)=>void;due:bigint|null}) {
 const amount=parseAmount(received),change=amount!==null&&due!==null&&amount>=due?amount-due:0n;
 return <section className="cash-payment" aria-label="ชำระเงินสด"><label className="checkout-field">รับเงิน (บาท)<input type="number" inputMode="decimal" min="0" step="0.01" value={received} onChange={event=>onChange(event.target.value)}/></label>
 <div className="cash-shortcuts">{[20,50,100,500,1000].map(value=><button className="secondary" key={value} onClick={()=>onChange(addCash(received,value))}>+{value}</button>)}</div>
 <div className="cash-tools"><button className="secondary" disabled={due===null||due>99999999999999n} onClick={()=>{if(due!==null)onChange(amountInput(due));}}>พอดี</button><button className="secondary" onClick={()=>onChange('0')}>ล้าง</button><button className="secondary" aria-label="ลบตัวเลขเงินรับล่าสุด" onClick={()=>onChange(cashDigit(received,'backspace'))}><Delete size={18}/></button></div>
 <div className="cash-change" aria-live="polite"><span>เงินทอน</span><strong>฿{formatAmount(change)}</strong></div>
 <div className="cash-keypad">{['7','8','9','4','5','6','1','2','3','0','.','00'].map(key=><button className="secondary" key={key} onClick={()=>onChange(cashDigit(received,key))}>{key}</button>)}</div>

 {amount===null?<p role="alert" className="checkout-error">กรุณากรอกเงินรับเป็นจำนวนบวกหรือศูนย์ ไม่เกิน 2 ตำแหน่งทศนิยม</p>:due!==null&&amount<due?<p className="checkout-error">เงินรับยังไม่ครบ ฿{formatAmount(due-amount)}</p>:null}
 </section>;
}
