import {cafeConfiguration} from '@pos/contracts/cafe-options';import {call} from '../management/client';
export async function getCafeConfiguration(signal?:AbortSignal,management=false){return cafeConfiguration.parse(await call(management?'/management/cafe/options':'/cafe/options',undefined,undefined,signal));}
