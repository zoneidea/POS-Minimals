import { Modal } from '../../components/Modal';
import { StockHistory } from './StockHistory';
export function StockHistoryModal({productId,onClose}:{productId?:string;onClose:()=>void}) {
 return <Modal title="ประวัติสต็อก" onClose={onClose}><StockHistory productId={productId}/></Modal>;
}
