const money=/^(0|[1-9]\d{0,11})(\.\d{0,2})?$/;
export function parseAmount(value:string):bigint|null {
 if(!money.test(value))return null;
 const [whole,fraction='']=value.split('.');return BigInt(whole!)*100n+BigInt(fraction.padEnd(2,'0'));
}
export function amountInput(cents:bigint){return `${cents/100n}.${String(cents%100n).padStart(2,'0')}`;}
export function addCash(value:string,baht:number){const cents=parseAmount(value);if(cents===null)return value;const result=cents+BigInt(baht)*100n;return result>99999999999999n?value:amountInput(result);}
export function cashDigit(value:string,key:string){
 if(key==='backspace')return value.slice(0,-1)||'0';
 const next=value==='0'&&key!=='.'?key:value+key;
 return parseAmount(next)===null?value:next;
}
