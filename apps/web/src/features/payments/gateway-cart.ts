export interface GatewayCart {items:{productId:string;quantity:number}[];discountAmount:string;couponCode?:string;}
export function sameGatewayCart(a:GatewayCart,b:GatewayCart){
 if(a.discountAmount!==b.discountAmount||(a.couponCode??'')!==(b.couponCode??'')||a.items.length!==b.items.length)return false;
 const quantities=new Map(a.items.map(i=>[i.productId,i.quantity]));
 return quantities.size===a.items.length&&new Set(b.items.map(i=>i.productId)).size===b.items.length&&b.items.every(i=>quantities.get(i.productId)===i.quantity);
}
