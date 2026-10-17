import {Coins,FileClock} from 'lucide-react';
import {withdrawalNotice} from './content';
export function LandingFees(){
 return <aside className="landing-fee-strip" aria-label="ค่าบริการรับชำระเงิน"><div><Coins size={25} aria-hidden="true"/><p>พร้อมเพย์ <strong>1.50%</strong> ต่อรายการ · ถอนเงิน <strong>15</strong> บาทต่อครั้ง</p></div><div><FileClock size={24} aria-hidden="true"/><p>{withdrawalNotice}<small>ค่าถอนเป็นอัตราที่กำหนดสำหรับบริการเมื่อเปิดใช้งาน</small></p></div></aside>;
}
