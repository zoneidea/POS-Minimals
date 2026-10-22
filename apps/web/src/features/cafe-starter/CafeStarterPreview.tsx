import type {CafeStarterStatus} from '@pos/contracts/cafe-options';
import {Modal} from '../../components/Modal';
export function CafeStarterPreview({catalog,onClose}:{catalog:CafeStarterStatus['catalog'];onClose:()=>void}){
 return <Modal title="ชุดข้อมูลเริ่มต้นคาเฟ่" onClose={onClose}><div className="cafe-starter-preview">
  <p className="hint">ราคาเริ่มต้นสำหรับเครื่องดื่มเย็นขนาดปกติ แก้ไขได้ก่อนขายจริง · ไม่ใช่ราคากลางตลาด</p>
  {catalog.categories.map(category=><section key={category}><h3>{category}</h3><ul>{catalog.products.filter(p=>p.category===category).map(p=><li key={p.name}><span>{p.name}</span><strong>฿{p.price}</strong></li>)}</ul></section>)}
  <h3>ตัวเลือกที่เตรียมให้</h3>{catalog.groups.map(g=><section key={g.key}><h4>{g.name} <small>เลือก {g.minChoices}–{g.maxChoices} รายการ</small></h4><p>{g.options.map(o=>`${o.name}${o.price==='0.00'?'':` +฿${o.price}`}${o.isDefault?' (ค่าเริ่มต้น)':''}`).join(' · ')}</p></section>)}
  <p className="notice">ไม่มีรูปสินค้า · ไม่ติดตามสต็อก · ต้นทุนเริ่มต้น 0 บาท กรุณากำหนดต้นทุนก่อนใช้รายงานกำไร ตัวเลือกผูกเฉพาะเมนูที่เหมาะสม</p>
  <div className="category-actions"><button type="button" className="secondary" onClick={onClose}>ปิด</button></div>
 </div></Modal>;
}
