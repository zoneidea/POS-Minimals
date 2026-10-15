import {Trash2} from 'lucide-react';
import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {authMessage} from '../../lib/client';
import {unlinkBankAccount} from './client';
export function UnlinkBankButton({version,disabled,onBusy,onRemoved}:{version:number;disabled:boolean;onBusy:(busy:boolean)=>void;onRemoved:()=>Promise<void>}){
 return <button type="button" className="secondary danger" disabled={disabled} onClick={async()=>{
  if(disabled||!await confirmAlert('ยืนยันลบบัญชีรับเงินและยกเลิกการเชื่อมต่อกับ ReservePay หรือไม่?',true))return;
  onBusy(true);
  try{await unlinkBankAccount(version);await onRemoved();await successAlert('ลบบัญชีรับเงินสำเร็จ');}catch(error){await warningAlert(authMessage(error));}finally{onBusy(false);}
 }}><Trash2 size={17} aria-hidden="true"/>ลบบัญชี</button>;
}
