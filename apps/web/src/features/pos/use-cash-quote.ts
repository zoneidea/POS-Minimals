import {quoteLine} from '../cafe-options/cart-lines';
import {cafeQuoteFields} from '@pos/contracts/cafe-options';
type QuoteData=z.infer<typeof result>;
import { useEffect,useState } from 'react';
import { z } from 'zod';
import { auth,authMessage,request } from '../../lib/client';
import type { CartItem } from './cart';
import { parseAmount,amountInput } from './checkout-amounts';
const money=z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/);
const result=z.object({quoteFingerprint:z.string(),items:z.array(z.object({...cafeQuoteFields,productId:z.uuid(),name:z.string(),unitPrice:money,quantity:z.number().int().positive(),expectedVersion:z.number().int().positive(),stockAvailable:z.number().int().nonnegative(),lineTotal:money,barcode:z.string()})),subtotalAmount:money,discountAmount:money,vatAmount:money,totalAmount:money,vatEnabled:z.boolean(),vatRate:money,couponDiscountAmount:money.optional(),manualDiscountAmount:money.optional()});
export function useCashQuote(items:CartItem[],discount:string,enabled:boolean,couponCode?:string,restaurant?:{billId:string;version:number}){
 const amount=parseAmount(discount),key=amount===null||!items.length||!enabled?'':JSON.stringify({...(restaurant?{version:restaurant.version}:{items:items.map(quoteLine),paymentMethod:'CASH'}),discountAmount:amountInput(amount),...(couponCode?{couponCode}:{})});
 const path=restaurant?`/restaurant/bills/${restaurant.billId}/quote`:'/sales/quote';
 const [revision,setRevision]=useState(0),[state,setState]=useState<{key:string;quote?:QuoteData;error?:string}>({key:''});
 useEffect(()=>{const refresh=()=>setRevision(value=>value+1);window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 useEffect(()=>{setState({key:''});if(!key)return;const controller=new AbortController();
 const timer=setTimeout(async()=>{try{const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');const quote=result.parse(await request(path,data.session.access_token,JSON.parse(key),controller.signal,'POST'));if(!controller.signal.aborted)setState({key,quote});}catch(error){if(!controller.signal.aborted)setState({key,error:authMessage(error)});}},300);
 return()=>{clearTimeout(timer);controller.abort();};},[key,revision,path]);
 const current=state.key===key&&key?state:undefined;
 return {quote:current?.quote,error:current?.error,pending:Boolean(key&&!current),reload:()=>setRevision(value=>value+1)};
}
