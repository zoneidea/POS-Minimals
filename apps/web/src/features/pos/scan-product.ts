import type { listCatalog,CatalogProduct } from './client';

export function findLoadedBarcode(value:string,items:readonly CatalogProduct[]){
 return items.find(product=>product.barcode===value);
}

// Exact lookup ignores the current category and page so scanners find every product.
export async function findScannedProduct(value:string,lookup:typeof listCatalog,signal:AbortSignal){
 if(value.length>100)return undefined;
 const data=await lookup(1,'',value,signal);
 return data.items.find(product=>product.barcode===value);
}
