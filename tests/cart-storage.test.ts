import { expect,it } from 'vitest';
import { restoreCart,persistCart } from '../apps/web/src/features/pos/cart-storage';
import { addToCart,changeQuantity } from '../apps/web/src/features/pos/cart';
const product={id:'00000000-0000-4000-8000-000000000001',name:'Coffee',barcode:'00123',salePrice:'10.00',quantityOnHand:5,rowVersion:1,imageUrl:null,categoryId:null};
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}
it('restores selected rows and quantities after a new page/mount',()=>{const store=storage(),items=changeQuantity(addToCart([],product),product.id,2);persistCart('user','shop',items,store);expect(restoreCart('user','shop',store)).toEqual({items,error:''});expect(restoreCart('other','shop',store).items).toEqual([]);expect(restoreCart('user','other',store).items).toEqual([]);});
it('retains removals and explicit clearing on the next restore',()=>{const store=storage(),items=addToCart([],product);persistCart('user','shop',items,store);persistCart('user','shop',changeQuantity(items,product.id,-1),store);expect(restoreCart('user','shop',store).items).toEqual([]);});
it('does not overwrite unreadable storage during restoration',()=>{let writes=0;const store={getItem:()=>'{broken',setItem:()=>{writes++;}};expect(restoreCart('user','shop',store).error).not.toBe('');expect(writes).toBe(0);});
