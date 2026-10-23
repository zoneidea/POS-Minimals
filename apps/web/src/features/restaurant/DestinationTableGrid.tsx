import {Armchair,Check} from 'lucide-react';
import type {RestaurantTable} from '@pos/contracts/restaurant';
import {LabelText} from '../../components/LabelText';
import './destination-table-grid.css';
export function DestinationTableGrid({tables,selected,disabled,onSelect}:{tables:RestaurantTable[];selected:string;disabled:boolean;onSelect:(id:string)=>void}){
 return <fieldset className="destination-table-field" disabled={disabled}><legend><LabelText required>โต๊ะปลายทาง</LabelText></legend><div className="destination-table-grid" role="group" aria-label="เลือกโต๊ะปลายทาง">{tables.map(table=><button type="button" className="destination-table-button" key={table.id} aria-pressed={selected===table.id} onClick={()=>onSelect(table.id)}><span className="destination-table-icon"><Armchair size={21} aria-hidden="true"/>{selected===table.id?<Check size={17} aria-hidden="true"/>:null}</span><strong>{table.name}</strong><span>{table.zone||'ไม่ระบุโซน'}</span><small>{table.seats} ที่นั่ง</small></button>)}</div></fieldset>;
}
