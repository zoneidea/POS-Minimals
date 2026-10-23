import {z} from 'zod';
import {cafeGroup,optionSnapshot,cafeLineFields,cafeQuoteFields,uniqueCartLines} from './cafe-options.js';
const money=z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/);
export const restaurantTableInput=z.object({name:z.string().trim().min(1).max(60),zone:z.string().trim().max(60),seats:z.number().int().min(1).max(100),enabled:z.boolean(),version:z.number().int().positive().optional()}).strict();
export const restaurantRoundInput=z.object({version:z.number().int().positive(),key:z.uuid(),items:z.array(z.object({...cafeLineFields,productId:z.uuid(),expectedUnitPrice:money,quantity:z.number().int().min(1).max(2147483647)}).strict()).min(1).max(200).refine(uniqueCartLines)}).strict();
export const restaurantRound=z.object({source:z.enum(['STAFF','GUEST']).optional(),id:z.uuid(),number:z.number().int().positive(),createdAt:z.string(),cancelled:z.boolean(),cancelReason:z.string().nullable(),items:z.array(z.object({...cafeQuoteFields,productId:z.uuid(),lineId:z.uuid(),name:z.string(),barcode:z.string(),quantity:z.number().int().positive(),unitPrice:money,lineTotal:money}))});
export const restaurantBill=z.object({id:z.uuid(),tableId:z.uuid(),tableName:z.string(),status:z.enum(['OPEN','CLOSED','CANCELLED']),version:z.number().int().positive(),openedAt:z.string(),totalAmount:money,rounds:z.array(restaurantRound)});
export const restaurantTable=restaurantTableInput.required({version:true}).extend({id:z.uuid(),bill:restaurantBill.nullable()});
export const restaurantBoard=z.object({tables:z.array(restaurantTable)});
export const restaurantCashInput=z.object({version:z.number().int().positive(),key:z.uuid(),receivedAmount:money,totalAmount:money,discountAmount:money.optional(),couponCode:z.string().regex(/^[A-Z0-9_-]{3,32}$/).optional()}).strict();
export type RestaurantBill=z.infer<typeof restaurantBill>;
export type RestaurantTable=z.infer<typeof restaurantTable>;
export type RestaurantRound=z.infer<typeof restaurantRound>;

export const restaurantQuoteInput=z.object({version:z.number().int().positive(),discountAmount:money,couponCode:z.string().regex(/^[A-Z0-9_-]{3,32}$/).optional()}).strict();

export const restaurantZoneInput=z.object({name:z.string().trim().min(1).max(60),version:z.number().int().positive().optional()}).strict();
export const restaurantZone=restaurantZoneInput.required({version:true}).extend({id:z.uuid()});
export const restaurantZones=z.array(restaurantZone);
export type RestaurantZone=z.infer<typeof restaurantZone>;

export const guestOrderInput=z.object({key:z.uuid(),version:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),items:z.array(z.object({productId:z.uuid(),lineId:z.uuid(),quantity:z.number().int().min(1).max(20),optionIds:z.array(z.uuid()).max(100),note:z.string().max(200),expectedUnitPrice:money}).strict()).min(1).max(50).refine(uniqueCartLines)}).strict();
export const guestOrder=z.object({billId:z.uuid(),tableName:z.string(),version:z.number().int().positive(),totalAmount:money,rounds:z.array(z.object({id:z.uuid(),number:z.number().int().positive(),createdAt:z.string(),cancelled:z.boolean(),source:z.enum(['STAFF','GUEST']),items:z.array(z.object({name:z.string(),quantity:z.number().int().positive(),lineTotal:money,options:z.array(optionSnapshot),note:z.string()}))}))});
export const guestMenu=z.object({storeName:z.string(),tableName:z.string(),expiresAt:z.string(),categories:z.array(z.object({id:z.uuid(),name:z.string()})),products:z.array(z.object({id:z.uuid(),name:z.string(),categoryId:z.uuid().nullable(),salePrice:money,available:z.boolean(),imageUrl:z.url().nullable()})),groups:z.array(cafeGroup),order:guestOrder});
export const guestOrderResult=z.object({roundId:z.uuid(),roundNumber:z.number().int().positive(),replayed:z.boolean(),order:guestOrder});
export const guestAccess=z.object({url:z.url(),expiresAt:z.string()});
export type GuestMenu=z.infer<typeof guestMenu>;
export type GuestOrder=z.infer<typeof guestOrder>;
export type GuestOrderInput=z.infer<typeof guestOrderInput>;
