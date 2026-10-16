// Electron's current PrinterInfo may omit isDefault. Never guess the first printer.
export function normalizePrinter({name,displayName,isDefault}){
 if(typeof name!=='string'||!name)throw new Error('Invalid printer name');
 return {name,displayName:typeof displayName==='string'&&displayName?displayName:name,isDefault:isDefault===true};
}
