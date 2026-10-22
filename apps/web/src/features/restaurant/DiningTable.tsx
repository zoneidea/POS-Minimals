import type {RestaurantTable} from '@pos/contracts/restaurant';
// Seats are decorative; the button's text exposes the exact seat count and occupancy.
export function DiningTable({table,disabled,onSelect}:{table:RestaurantTable;disabled?:boolean;onSelect:()=>void}){
 const occupied=Boolean(table.bill),count=Math.max(1,Math.min(100,table.seats)),chairWidth=Math.min(17,300/count);
 return <article className="restaurant-table" data-open={occupied} data-disabled={!table.enabled}><button className="restaurant-table-main" disabled={disabled||!table.enabled} onClick={onSelect}>
 <svg className="dining-table-plan" viewBox="-90 -72 180 144" aria-hidden="true" focusable="false">{Array.from({length:count},(_,i)=>{const angle=-Math.PI/2+i*2*Math.PI/count;return <rect data-seat key={i} x={-chairWidth/2} y={-5} width={chairWidth} height={10} rx={3} className="dining-chair" transform={`translate(${Math.cos(angle)*64} ${Math.sin(angle)*51}) rotate(${angle*180/Math.PI+90})`}/>;})}<rect className="dining-table-top" x={-47} y={-34} width={94} height={68} rx={17}/><circle className="dining-plate" r={15}/><circle className="dining-plate-inner" r={10}/><path className="dining-cutlery" d="M-25 -13v26M-29 -13v9q4 5 8 0v-9M25 -13v26M25 -13q9 6 0 12"/></svg>
 <strong>{table.name}</strong><small>{table.zone||'ไม่ระบุโซน'} · {table.seats} ที่นั่ง</small><span className="restaurant-occupancy"><i aria-hidden="true"/>{!table.enabled?'ปิดใช้งาน':occupied?'ไม่ว่าง':'ว่าง'}</span>{table.bill?<b>฿{table.bill.totalAmount}</b>:null}</button></article>;
}
