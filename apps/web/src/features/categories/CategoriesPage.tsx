import { useEffect,useState } from 'react';
import { Plus,RefreshCw } from 'lucide-react';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { listCategories,type Category } from './client';
import { CategoryForm } from './CategoryForm';
import { CategoryDeleteModal } from './CategoryDeleteModal';
import { CategoryList } from './CategoryList';
export function CategoriesPage(){
 const [items,setItems]=useState<Category[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[editing,setEditing]=useState<Category|true|null>(null),[removing,setRemoving]=useState<Category|null>(null),[notice,setNotice]=useState('');
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');listCategories(page,controller.signal).then(data=>{setItems(data.items);setTotal(data.total);}).catch(e=>{if(!controller.signal.aborted)setError(authMessage(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[page,revision]);
 const reload=()=>setRevision(v=>v+1);
 return <section className="category-page"><div className="category-toolbar"><button className="primary" disabled={Boolean(editing)||Boolean(removing)} onClick={()=>{setEditing(true);setNotice('');}}><Plus size={18} aria-hidden="true"/>เพิ่มหมวดหมู่</button></div>{notice?<Notice success>{notice}</Notice>:null}{editing?<CategoryForm key={editing===true?'new':editing.id} item={editing===true?undefined:editing} onSaved={()=>{setEditing(null);setNotice('บันทึกหมวดหมู่แล้ว');reload();}} onCancel={()=>setEditing(null)}/>:null}{removing?<CategoryDeleteModal item={removing} onCancel={()=>setRemoving(null)} onDeleted={()=>{setRemoving(null);setNotice('ลบหมวดหมู่แล้ว');if(items.length===1&&page>1)setPage(v=>v-1);else reload();}}/>:null}{error?<><Notice>{error}</Notice><button className="secondary" onClick={reload}><RefreshCw size={18} aria-hidden="true"/>ลองโหลดใหม่</button></>:null}{loading?<div className="loading" role="status"><Busy/>กำลังโหลดหมวดหมู่</div>:error?null:<><CategoryList items={items} total={total} page={page} onPageChange={setPage} disabled={Boolean(editing)||Boolean(removing)} onEdit={item=>{setEditing(item);setNotice('');}} onDelete={item=>{setRemoving(item);setNotice('');}}/></>}</section>;
}
