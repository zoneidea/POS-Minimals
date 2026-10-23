import {restaurantZones,type RestaurantZone,restaurantBoard,restaurantBill,type RestaurantTable} from '@pos/contracts/restaurant';
import {call} from '../management/client';
import {completedSaleSchema} from '../pos/checkout-client';
export async function getManagementTables(signal?:AbortSignal){return restaurantBoard.parse(await call('/management/restaurant/tables',undefined,undefined,signal));}
export async function getBoard(signal?:AbortSignal){return restaurantBoard.parse(await call('/restaurant/board',undefined,undefined,signal));}
export async function saveTable(input:{name:string;zone:string;seats:number;enabled:boolean;version?:number},table?:RestaurantTable){return call(`/management/restaurant/tables${table?'/'+table.id:''}`,input,table?'PATCH':'POST');}
export async function openBill(id:string,key:string){return restaurantBill.parse(await call(`/restaurant/tables/${id}/open`,{key},'POST'));}
export async function sendRound(id:string,input:unknown){return restaurantBill.parse(await call(`/restaurant/bills/${id}/rounds`,input,'POST'));}
export async function cancelRound(billId:string,id:string,version:number,reason:string){return restaurantBill.parse(await call(`/management/restaurant/bills/${billId}/rounds/${id}/cancel`,{version,reason},'POST'));}
export async function cancelBill(id:string,version:number){return restaurantBill.parse(await call(`/restaurant/bills/${id}/cancel`,{version},'POST'));}
export async function payCash(id:string,input:unknown){return completedSaleSchema.parse(await call(`/restaurant/bills/${id}/checkout/cash`,input,'POST'));}

export async function getZones(signal?:AbortSignal){return restaurantZones.parse(await call('/management/restaurant/zones',undefined,undefined,signal));}
export async function saveZone(name:string,zone?:RestaurantZone){return call(`/management/restaurant/zones${zone?'/'+zone.id:''}`,{name,...(zone?{version:zone.version}:{})},zone?'PATCH':'POST');}
export async function deleteZone(zone:RestaurantZone){return call(`/management/restaurant/zones/${zone.id}/delete`,{version:zone.version},'POST');}

export async function moveTable(id:string,input:{targetId:string;version:number;key:string}){return restaurantBill.parse(await call(`/restaurant/bills/${id}/move`,input,'POST'));}
