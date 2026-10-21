import {Check,Coffee,Store} from 'lucide-react';
import {LabelText} from '../../components/LabelText';
import type {StoreMode} from './StoreModeSelect';
import './store-mode-buttons.css';
const modes=[{value:'RETAIL',label:'ร้านขายของทั่วไป',Icon:Store},{value:'CAFE',label:'คาเฟ่',Icon:Coffee}] as const;
export function StoreModeButtons({value,onChange,disabled=false}:{value:StoreMode;onChange:(mode:StoreMode)=>void;disabled?:boolean}){
 return <div className="settings-field-wide store-mode-field"><LabelText required>โหมดร้าน</LabelText><div className="store-mode-buttons" role="group" aria-label="โหมดร้าน">{modes.map(({value:mode,label,Icon})=><button key={mode} type="button" className="secondary store-mode-button" aria-pressed={value===mode} disabled={disabled} onClick={()=>onChange(mode)}><Icon size={21} aria-hidden="true"/><span>{label}</span>{value===mode?<Check className="store-mode-check" size={18} aria-hidden="true"/>:null}</button>)}</div><small className="hint">เลือกโหมดแล้วกดบันทึก โหมดคาเฟ่ออกเลขคิวและพิมพ์ใบเสร็จต่อด้วยใบออเดอร์เตรียม โดยเก็บประวัติขายเดิม</small></div>;
}
