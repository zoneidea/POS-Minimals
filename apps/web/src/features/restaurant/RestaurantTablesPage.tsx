import {useState} from 'react';
import {Plus,Pencil} from 'lucide-react';
import type {RestaurantTable} from '@pos/contracts/restaurant';
import {DataTable,TABLE_PAGE_SIZE} from '../../components/DataTable';
import {Notice,Busy} from '../../components/Notice';
import {getCafeConfiguration} from '../cafe-options/client';
import {useCafeConfiguration} from '../cafe-options/use-cafe-configuration';
import {TableEditor} from './TableEditor';
import {useRestaurantBoard} from './use-restaurant-board';
import './restaurant.css';
export function RestaurantTablesPage(){const mode=useCafeConfiguration(getCafeConfiguration);if(mode.error)return <Notice>{mode.error}</Notice>;if(!mode.data)return <p role="status"><Busy/>กำลังโหลดโหมดร้าน</p>;if(mode.data.storeMode!=='RESTAURANT')return <Notice>เมนูจัดการโต๊ะใช้ได้เฉพาะโหมดร้านอาหาร</Notice>;return <TableManagement/>;}
function TableManagement(){
 const board=useRestaurantBoard(),[page,setPage]=useState(1),[editing,setEditing]=useState<RestaurantTable|true|null>(null);
 return <section className="category-page restaurant-table-management"><div className="category-toolbar"><button className="primary" disabled={board.loading||Boolean(board.error)||Boolean(editing)} onClick={()=>setEditing(true)}><Plus size={18}/>เพิ่มโต๊ะ</button></div>
 {board.error?<Notice>{board.error}</Notice>:null}{board.loading?<p role="status"><Busy/>กำลังโหลดโต๊ะ</p>:null}<DataTable label="รายการโต๊ะ" rowKey={t=>t.id} rows={board.tables.slice((page-1)*TABLE_PAGE_SIZE,page*TABLE_PAGE_SIZE)} total={board.tables.length} page={page} onPageChange={setPage} loading={board.loading} error={Boolean(board.error)} disabled={Boolean(editing)} columns={[{key:'name',header:'ชื่อโต๊ะ',render:t=><strong>{t.name}</strong>},{key:'zone',header:'โซน',render:t=>t.zone||'—'},{key:'seats',header:'ที่นั่ง',render:t=>t.seats},{key:'enabled',header:'การใช้งาน',render:t=>t.enabled?'เปิดใช้งาน':'ปิดใช้งาน'},{key:'status',header:'สถานะ',render:t=><span className="restaurant-table-status" data-open={Boolean(t.bill)}>{t.bill?'ไม่ว่าง':'ว่าง'}</span>},{key:'actions',header:'จัดการ',render:t=><button className="secondary" disabled={Boolean(t.bill)||Boolean(editing)} title={t.bill?'กรุณาปิดบิลก่อนแก้ไขโต๊ะ':undefined} onClick={()=>setEditing(t)}><Pencil size={16}/>แก้ไข</button>}]}/>
 {editing?<TableEditor table={editing===true?undefined:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);board.reload();}}/>:null}</section>;
}
