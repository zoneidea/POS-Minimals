import {LabelText} from '../../components/LabelText';
export type StoreMode='RETAIL'|'CAFE';
export function StoreModeSelect({value,onChange,disabled=false}:{value:StoreMode;onChange:(mode:StoreMode)=>void;disabled?:boolean}){
 return <label className="settings-field-wide"><LabelText required>โหมดร้าน</LabelText><select name="storeMode" required value={value} disabled={disabled} onChange={event=>onChange(event.target.value as StoreMode)}><option value="RETAIL">ร้านขายของทั่วไป</option><option value="CAFE">คาเฟ่</option></select><small className="hint">โหมดคาเฟ่ออกเลขคิว พร้อมพิมพ์ใบเสร็จและใบออเดอร์เตรียมต่อกัน เปลี่ยนโหมดได้ภายหลังโดยเก็บประวัติขายเดิม</small></label>;
}
