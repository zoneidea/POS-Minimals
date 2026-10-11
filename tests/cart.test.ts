import { expect,it } from 'vitest';
import { addToCart,cartTotal,changeQuantity,formatAmount,cartSchema,cartKey } from '../apps/web/src/features/pos/cart';
const product={id:'00000000-0000-4000-8000-000000000001',name:'Coffee',barcode:'00123',salePrice:'0.10',quantityOnHand:2,rowVersion:1,imageUrl:null,categoryId:null};
it('limits additions to available stock and refuses sold-out products',()=>{const one=addToCart([],product);const two=addToCart(one,product);expect(two[0]!.quantity).toBe(2);expect(addToCart(two,product)).toBe(two);expect(addToCart([],{...product,quantityOnHand:0})).toEqual([]);});
it('supports decrement/removal without negative quantity',()=>{const one=addToCart([],product);expect(changeQuantity(one,product.id,-1)).toEqual([]);expect(changeQuantity(changeQuantity(one,product.id,1),product.id,1)[0]!.quantity).toBe(2);});
it('calculates decimal totals exactly including large amounts',()=>{expect(formatAmount(cartTotal([{...addToCart([],product)[0]!,quantity:3}]))).toBe('0.30');expect(cartTotal([{...addToCart([],product)[0]!,salePrice:'999999999999.99',quantity:2147483647}])).toBe(99999999999999n*2147483647n);});
it('isolates saved carts and rejects corrupted values',()=>{expect(cartKey('a','x')).not.toBe(cartKey('b','x'));expect(cartKey('a','x')).not.toBe(cartKey('a','y'));expect(cartSchema.safeParse([{...product,quantity:-1}]).success).toBe(false);});
