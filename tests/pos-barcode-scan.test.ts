import { expect,it,vi } from 'vitest';
import { findScannedProduct } from '../apps/web/src/features/pos/scan-product';
import { addToCart } from '../apps/web/src/features/pos/cart';
import type { CatalogProduct } from '../apps/web/src/features/pos/client';

const product:CatalogProduct={id:'00000000-0000-4000-8000-000000000001',name:'Water',barcode:'001234',categoryId:null,salePrice:'15.00',quantityOnHand:2,rowVersion:1,imageUrl:null};
it('looks up the exact barcode independently of catalog filters and adds one per scan',async()=>{
 const lookup=vi.fn().mockResolvedValue({items:[product],total:1,page:1,limit:10});
 const signal=new AbortController().signal;
 const found=await findScannedProduct('001234',lookup,signal);
 expect(lookup).toHaveBeenCalledWith(1,'','001234',signal);
 expect(found).toEqual(product);
 const once=addToCart([],found!);const twice=addToCart(once,found!);
 expect(once[0]!.quantity).toBe(1);expect(twice[0]!.quantity).toBe(2);
 expect(addToCart(twice,found!)).toBe(twice);
});
it('does not auto-add a name or partial barcode match',async()=>{
 const lookup=vi.fn().mockResolvedValue({items:[product],total:1,page:1,limit:10});
 expect(await findScannedProduct('Water',lookup,new AbortController().signal)).toBeUndefined();
 expect(await findScannedProduct('001',lookup,new AbortController().signal)).toBeUndefined();
});
it('propagates lookup failures rather than adding stale catalog data',async()=>{
 const lookup=vi.fn().mockRejectedValue(new Error('offline'));
 await expect(findScannedProduct('001234',lookup,new AbortController().signal)).rejects.toThrow('offline');
 expect(addToCart([],{...product,quantityOnHand:0})).toEqual([]);
});
