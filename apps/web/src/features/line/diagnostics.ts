const key='kidtang:line:diagnostics:v1';
type Event={at:number;event:string;route?:string;status?:number;durationMs?:number;requestId?:string};
export function recordLineEvent(event:Omit<Event,'at'>){
 try{const now=Date.now(),saved=JSON.parse(localStorage.getItem(key)??'[]');const rows=Array.isArray(saved)?saved.filter((row:Event)=>Number.isFinite(row.at)&&row.at>now-30*86400000):[];localStorage.setItem(key,JSON.stringify([...rows.slice(-99),{...event,at:now}]));}catch{/* Diagnostics must never block checkout or expose payloads. */}
}
