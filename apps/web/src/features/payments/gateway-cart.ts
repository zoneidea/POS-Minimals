export interface GatewayCart {items:{productId:string;quantity:number;lineId?:string;optionIds?:string[];note?:string}[];discountAmount:string;couponCode?:string;}
export function sameGatewayCart(a:GatewayCart,b:GatewayCart){
 if(a.discountAmount!==b.discountAmount||(a.couponCode??'')!==(b.couponCode??'')||a.items.length!==b.items.length)return false;
 const key=(i:GatewayCart['items'][number])=>i.lineId??i.productId;
 const signature=(i:GatewayCart['items'][number])=>JSON.stringify([i.productId,i.quantity,[...(i.optionIds??[])].sort(),(i.note??'').trim()]);
 const rows=new Map(a.items.map(i=>[key(i),signature(i)]));return rows.size===a.items.length&&new Set(b.items.map(key)).size===b.items.length&&b.items.every(i=>rows.get(key(i))===signature(i));
}
