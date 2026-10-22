import {lazy,Suspense} from 'react';
import {useCafeConfiguration} from '../cafe-options/use-cafe-configuration';
import {getCafeConfiguration} from '../cafe-options/client';
import {Notice} from '../../components/Notice';
const PosPage=lazy(()=>import('../pos/PosPage').then(m=>({default:m.PosPage})));
const RestaurantPage=lazy(()=>import('./RestaurantPage').then(m=>({default:m.RestaurantPage})));
export function PosEntry({userId,orgId,canManage}:{userId:string;orgId:string;canManage:boolean}){
 const config=useCafeConfiguration(getCafeConfiguration);
 if(config.error)return <Notice>{config.error}</Notice>;
 if(!config.data)return <p role="status">กำลังโหลดโหมดร้าน</p>;
 return <Suspense fallback={<p role="status">กำลังเปิดหน้าขาย</p>}>{config.data.storeMode==='RESTAURANT'?<RestaurantPage userId={userId} orgId={orgId} canManage={canManage} configuration={config.data}/>:<PosPage userId={userId} orgId={orgId}/>}</Suspense>;
}
