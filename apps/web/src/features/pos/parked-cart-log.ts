export function logParkedCart(scope:string,action:'PARK'|'RECALL'|'DISCARD',count:number){
 const entry={action,at:new Date().toISOString(),count};
 // Browser-local metadata only: never record product names, notes or contact data.
 try{const key=`pos:parked-log:${scope}`,raw=JSON.parse(localStorage.getItem(key)??'[]') as {at:string}[];const cutoff=Date.now()-30*86400000;localStorage.setItem(key,JSON.stringify([...raw.filter(e=>Date.parse(e.at)>cutoff).slice(-99),entry]));}catch{/* Diagnostics cannot undo a committed draft change. */}
}
