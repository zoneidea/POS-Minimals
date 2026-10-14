import { z } from 'zod';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import type { UserContext } from '../auth/types.js';
export const activityQuery=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),action:z.string().regex(/^[A-Z_]{1,60}$/).optional()}).strict();
export function createActivityService(url:string,key:string){return {async list(token:string,context:UserContext,query:z.infer<typeof activityQuery>){
 const client=createUserClient(url,key,token);
 let request=client.from('activity_logs').select('id,action,entity_id,actor_user_id,request_id,created_at',{count:'exact'}).eq('org_id',context.orgId).gte('created_at',new Date(Date.now()-30*86400000).toISOString());
 if(query.action)request=request.eq('action',query.action);
 const {data,error,count}=await request.order('created_at',{ascending:false}).order('id',{ascending:false}).range((query.page-1)*10,query.page*10-1);
 if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถโหลดข้อมูลได้');
 const ids=[...new Set((data??[]).map(row=>row.actor_user_id))];const names=new Map<string,string>();
 if(ids.length){const members=await client.from('organization_members').select('user_id,display_username').eq('org_id',context.orgId).in('user_id',ids);if(members.error)throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถโหลดข้อมูลได้');for(const member of members.data??[])names.set(member.user_id,member.display_username);}
 return {items:(data??[]).map(row=>({id:row.id,action:row.action,entityId:row.entity_id,actorUsername:names.get(row.actor_user_id)??null,requestId:row.request_id,createdAt:row.created_at})),total:count??0,page:query.page,limit:10};
 }};}
export type ActivityService=ReturnType<typeof createActivityService>;
