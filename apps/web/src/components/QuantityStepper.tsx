import {Minus,Plus} from 'lucide-react';
import './quantity-stepper.css';

export function QuantityStepper({value,max,onChange}:{value:number;max:number;onChange:(value:number)=>void}){
 return <div className="quantity-stepper" role="group" aria-label="จำนวนรายการสินค้า">
  <button type="button" className="secondary" aria-label="ลดจำนวน" disabled={value<=1} onClick={()=>onChange(Math.max(1,value-1))}><Minus size={18}/></button>
  <output aria-label="จำนวนรายการสินค้า" aria-live="polite" aria-atomic="true">{value}</output>
  <button type="button" className="secondary" aria-label="เพิ่มจำนวน" disabled={value>=max} onClick={()=>onChange(Math.min(max,value+1))}><Plus size={18}/></button>
 </div>;
}
