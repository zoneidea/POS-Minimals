import {DeleteConfirmation} from '../../components/DeleteConfirmation';
import {deleteProduct,type Product} from './client';
export function ProductDeleteModal({item,onDeleted,onCancel}:{item:Product;onDeleted:()=>void;onCancel:()=>void}){return <DeleteConfirmation text={`ลบสินค้า “${item.name}” หรือไม่? ระบบจะซ่อนข้อมูลและเก็บประวัติไว้`} remove={()=>deleteProduct(item)} onDeleted={onDeleted} onCancel={onCancel}/>;}
