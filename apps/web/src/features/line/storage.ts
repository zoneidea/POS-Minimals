import {cartSchema,type CartItem} from '../pos/cart';
import {linePending,type LinePending} from './schema';
export function lineCartKey(scope:string){return `kidtang:line:cart:v1:${scope}`;}
export function linePendingKey(scope:string){return `kidtang:line:pending-sale:v1:${scope}`;}
export function readLineCart(scope:string,storage:Pick<Storage,'getItem'>=localStorage):CartItem[]{const saved=storage.getItem(lineCartKey(scope));return saved?cartSchema.parse(JSON.parse(saved)):[];}
export function readLinePending(scope:string,storage:Pick<Storage,'getItem'>=localStorage):LinePending|null{const saved=storage.getItem(linePendingKey(scope));return saved?linePending.parse(JSON.parse(saved)):null;}
