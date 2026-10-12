import { ArrowDownUp } from 'lucide-react';
import { StockHistory } from '../stock/StockHistory';

export function AuditPage() {
 return <section aria-labelledby="stock-audit-title">
  <h2 id="stock-audit-title"><ArrowDownUp size={20} aria-hidden="true"/> ประวัติสต็อก</h2>
  <p className="product-note">หน้านี้แสดงการเคลื่อนไหวสต็อกของร้าน ประวัติบิลขายและกิจกรรมประเภทอื่นอยู่ระหว่างพัฒนา</p>
  <StockHistory/>
 </section>;
}
