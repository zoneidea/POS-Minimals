import {DeleteConfirmation} from '../../components/DeleteConfirmation';
import {deleteCategory,type Category} from './client';
export function CategoryDeleteModal({item,onDeleted,onCancel}:{item:Category;onDeleted:()=>void;onCancel:()=>void}){return <DeleteConfirmation text={`ลบหมวดหมู่ “${item.name}” หรือไม่? ระบบจะซ่อนข้อมูลและเก็บประวัติไว้`} remove={()=>deleteCategory(item.id)} onDeleted={onDeleted} onCancel={onCancel}/>;}
