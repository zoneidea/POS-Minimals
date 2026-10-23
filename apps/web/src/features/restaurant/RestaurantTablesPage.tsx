import {useState} from 'react';
import {Plus} from 'lucide-react';
import type {RestaurantTable,RestaurantZone} from '@pos/contracts/restaurant';
import {DiningTable} from './DiningTable';
import {Notice,Busy} from '../../components/Notice';
import {getCafeConfiguration} from '../cafe-options/client';
import {useCafeConfiguration} from '../cafe-options/use-cafe-configuration';
import {ZoneEditor} from './ZoneEditor';
import {useRestaurantZones} from './use-restaurant-zones';
import {TableEditor} from './TableEditor';
import {useRestaurantBoard} from './use-restaurant-board';
import './restaurant.css';
export function RestaurantTablesPage(){const mode=useCafeConfiguration(getCafeConfiguration,false);if(mode.error)return <Notice>{mode.error}</Notice>;if(!mode.data)return <p role="status"><Busy/>กำลังโหลดโหมดร้าน</p>;if(mode.data.storeMode!=='RESTAURANT')return <Notice>เมนูจัดการโต๊ะใช้ได้เฉพาะโหมดร้านอาหาร</Notice>;return <TableManagement/>;}
function TableManagement(){
 const board=useRestaurantBoard(false,true),zones=useRestaurantZones(),[editingZone,setEditingZone]=useState<RestaurantZone|true|null>(null),[editing,setEditing]=useState<RestaurantTable|true|null>(null);
 return <section className="category-page restaurant-table-management"><div className="category-toolbar"><button className="secondary" disabled={zones.loading||Boolean(zones.error)||Boolean(editingZone)} onClick={()=>setEditingZone(true)}><Plus size={18}/>สร้างโซน</button><button className="primary" disabled={board.loading||Boolean(board.error)||Boolean(editing)||Boolean(editingZone)} onClick={()=>setEditing(true)}><Plus size={18}/>เพิ่มโต๊ะ</button></div>
 <div className="restaurant-zone-toolbar"><div className="restaurant-zone" role="group" aria-label="จัดการโซน">{zones.zones.map(zone=><button className="secondary" key={zone.id} disabled={Boolean(editingZone)} onClick={()=>setEditingZone(zone)}>{zone.name}</button>)}</div></div>{zones.error?<Notice>{zones.error}</Notice>:null}
 {board.error?<Notice>{board.error}</Notice>:null}{board.loading?<p role="status"><Busy/>กำลังโหลดโต๊ะ</p>:null}<div className="restaurant-tables restaurant-management-grid" aria-label="รายการโต๊ะ" aria-busy={board.loading}>{!board.loading&&!board.error&&!board.tables.length?<p className="hint">ยังไม่มีโต๊ะ กดเพิ่มโต๊ะเพื่อเริ่มต้น</p>:null}{!board.error&&board.tables.map(table=><DiningTable key={table.id} table={table} management disabled={board.loading||Boolean(editing)||Boolean(editingZone)} onSelect={()=>setEditing(table)}/>)}</div>
 {editing?<TableEditor zones={zones.zones} table={editing===true?undefined:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);board.reload();zones.reload();}}/>:null}{editingZone?<ZoneEditor zone={editingZone===true?undefined:editingZone} onClose={()=>setEditingZone(null)} onSaved={()=>{setEditingZone(null);board.reload();zones.reload();}}/>:null}</section>;
}
