import {useState} from 'react';
import {Coffee,Plus} from 'lucide-react';
import type {CafeGroup} from '@pos/contracts/cafe-options';
import {CafeGroupEditor} from './CafeGroupEditor';
import './cafe-options.css';
export function CafeOptionsSettings({groups,onChanged,disabled=false}:{groups:CafeGroup[];onChanged:()=>void;disabled?:boolean}){
 const [editor,setEditor]=useState<{group:CafeGroup|null}|null>(null);
 return <section className="cafe-options-panel"><div className="cafe-options-toolbar"><h2><Coffee size={22}/>ตัวเลือกขนาด / ท็อปปิ้ง / ความหวาน</h2><button type="button" className="primary" disabled={disabled} onClick={()=>setEditor({group:null})}><Plus size={18}/>เพิ่มกลุ่มตัวเลือก</button></div><p className="hint">สร้างกลุ่มเพื่อเลือกใช้ตอนเพิ่มหรือแก้ไขสินค้า ใช้กลุ่มเดียวกันได้หลายเมนู</p>{!groups.length?<p>ไม่มีข้อมูลกลุ่มตัวเลือก</p>:null}{groups.map(g=><div className="cafe-group-row" key={g.id}><div><strong>{g.name}</strong><small className="cafe-item-details">{g.enabled?'เปิดใช้งาน':'ปิดใช้งาน'} · เลือก {g.minChoices}–{g.maxChoices} · {g.options.length} ตัวเลือก · {g.productIds.length} เมนู</small></div><button type="button" className="secondary" disabled={disabled} onClick={()=>setEditor({group:g})}>แก้ไข {g.name}</button></div>)}{editor?<CafeGroupEditor group={editor.group} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);onChanged();}}/>:null}</section>;
}
