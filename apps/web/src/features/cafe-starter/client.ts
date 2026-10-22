import {cafeStarterStatus,cafeStarterResult} from '@pos/contracts/cafe-options';import {call} from '../management/client';
export async function readCafeStarter(signal?:AbortSignal){return cafeStarterStatus.parse(await call('/management/cafe/starter',undefined,undefined,signal));}
export async function changeCafeStarter(action:'APPLY'|'SKIP'|'CLEAR'){return cafeStarterResult.parse(await call('/management/cafe/starter',{action,packageVersion:'cafe-starter-v1'},'POST'));}
