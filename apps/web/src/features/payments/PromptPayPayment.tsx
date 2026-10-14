import { useEffect,useState } from 'react';
import { getPaymentConfig,type PaymentConfig } from './client';
import { Busy,Notice } from '../../components/Notice';
import './payments.css';
export function PromptPayPayment(){const [value,setValue]=useState<PaymentConfig|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{const c=new AbortController();getPaymentConfig(c.signal).then(v=>{if(!c.signal.aborted)setValue(v);}).catch(()=>{if(!c.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[]);
 return <section className="promptpay-payment">{loading?<p role="status"><Busy/>กำลังโหลดช่องทางรับเงิน</p>:null}{error?<Notice>{error}</Notice>:null}{value?.mode==='UPLOAD'?<><img className="payment-qr" src={value.qrImage} alt="QRCode PromptPay ของร้าน"/><p>สแกน QRCode ของร้าน · ตรวจสอบยอดเงินและชื่อผู้รับก่อนโอน</p><p className="hint">รูป QRCode นี้ไม่ได้ปรับยอดเงินอัตโนมัติ ระบบยังไม่บันทึกการขาย PromptPay</p></>:value?.mode==='GATEWAY'?<><h3>Payment Gateway</h3><Notice>เงินจะเข้าหลังจาก 1 วัน</Notice><p>ตั้งค่าบัญชีรับเงินแล้ว · ยังไม่เชื่อมผู้ให้บริการ จึงยังรับชำระผ่าน Gateway ไม่ได้</p></>:!loading&&!error?<p>ไม่มีข้อมูลช่องทางรับเงิน PromptPay</p>:null}</section>;
}
