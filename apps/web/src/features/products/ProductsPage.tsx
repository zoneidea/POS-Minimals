import {useCafeConfiguration} from '../cafe-options/use-cafe-configuration';
import {getCafeConfiguration} from '../cafe-options/client';
import {CafeOptionsSettings} from '../cafe-options/CafeOptionsSettings';
const loadProductConfiguration=(signal:AbortSignal)=>getCafeConfiguration(signal,true);
import { ImportModal } from '../imports/ImportModal';
import { StockAdjustmentModal } from '../stock/StockAdjustmentModal';
import { StockHistoryModal } from '../stock/StockHistoryModal';
import { useEffect,useState } from 'react';
import { Plus,RefreshCw,History,FileSpreadsheet } from 'lucide-react';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { listCategories } from '../categories/client';
import { listProducts,type Product } from './client';
import { ProductList } from './ProductList';
import { ProductForm } from './ProductForm';
import { ProductDeleteModal } from './ProductDeleteModal';
export function ProductsPage(){
 const cafe=useCafeConfiguration(loadProductConfiguration);
 const [importing,setImporting]=useState(false);
 const [items,setItems]=useState<Product[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[editing,setEditing]=useState<Product|true|null>(null),[removing,setRemoving]=useState<Product|null>(null),[adjusting,setAdjusting]=useState<Product|null>(null),[history,setHistory]=useState<string|true|null>(null),[categories,setCategories]=useState<Map<string,string>>(new Map());
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');Promise.all([listProducts(page,controller.signal),(async()=>{const names=new Map<string,string>();let current=1;while(true){const data=await listCategories(current,controller.signal);data.items.forEach(item=>names.set(item.id,item.name));if(current*data.limit>=data.total)break;current++;}return names;})()]).then(([data,names])=>{if(controller.signal.aborted)return;const last=Math.max(1,Math.ceil(data.total/10));if(page>last){setPage(last);return;}setItems(data.items);setTotal(data.total);setCategories(names);}).catch(error=>{if(!controller.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[page,revision]);
 const modalOpen=Boolean(importing||editing||removing||adjusting||history);
 const reload=()=>setRevision(v=>v+1);
 return <section className="products-page"><div className="category-toolbar"><button type="button" className="secondary" disabled={modalOpen} onClick={()=>setImporting(true)}><FileSpreadsheet size={18}/>นำเข้า Excel</button><button type="button" className="secondary" disabled={modalOpen} onClick={()=>setHistory(true)}><History size={18}/>ประวัติสต็อก</button><button type="button" className="primary" disabled={modalOpen||!cafe.data||Boolean(cafe.error)} onClick={()=>{setEditing(true);}}><Plus size={18}/>เพิ่มสินค้า</button></div>{importing?<ImportModal onClose={()=>setImporting(false)} onImported={()=>{setImporting(false);reload();}}/>:null}{editing?<ProductForm key={editing===true?'new':editing.id} item={editing===true?undefined:editing} onCancel={()=>setEditing(null)} cafeGroups={cafe.data?.storeMode==='CAFE'?cafe.data.groups:undefined} onSaved={()=>{setEditing(null);reload();cafe.reload();}}/>:null}{removing?<ProductDeleteModal item={removing} onCancel={()=>setRemoving(null)} onDeleted={()=>{setRemoving(null);reload();cafe.reload();}}/>:null}{adjusting?<StockAdjustmentModal item={adjusting} onCancel={()=>setAdjusting(null)} onSaved={()=>{setAdjusting(null);reload();}}/>:null}{history?<StockHistoryModal productId={history===true?undefined:history} onClose={()=>setHistory(null)}/>:null}{loading?<div className="loading" role="status"><Busy/>กำลังโหลดสินค้า</div>:error?<><Notice>{error}</Notice></>:null}<ProductList cafe={cafe.data?.storeMode==='CAFE'} error={Boolean(error)} loading={loading} items={items} total={total} page={page} onPageChange={setPage} categories={categories} disabled={loading||Boolean(error)||modalOpen||!cafe.data||Boolean(cafe.error)} onAdjust={item=>setAdjusting(item)} onHistory={item=>setHistory(item.id)} onEdit={item=>{setEditing(item);}} onDelete={item=>{setRemoving(item);}}/>{cafe.error?<Notice>{cafe.error}</Notice>:null}{cafe.data?.storeMode==='CAFE'?<CafeOptionsSettings groups={cafe.data.groups} disabled={modalOpen||Boolean(cafe.error)} onChanged={cafe.reload}/>:null}</section>;
}
