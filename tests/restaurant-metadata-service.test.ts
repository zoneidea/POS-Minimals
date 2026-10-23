import {it,expect,vi} from 'vitest';
const {clientFactory}=vi.hoisted(()=>({clientFactory:vi.fn()}));
vi.mock('../apps/api/src/infra/supabase/user-client',()=>({createUserClient:clientFactory}));
import {createRestaurantService} from '../apps/api/src/modules/restaurant/service';
import type {UserContext} from '../apps/api/src/modules/auth/types';
it('reads only tenant-scoped table metadata using the staff JWT and never fetches bill/order rows',async()=>{
 const id='00000000-0000-4000-8000-000000000001',row={id,name:'A1',zone:'',seats:4,enabled:true,version:1};
 const query={select:vi.fn(),eq:vi.fn(),order:vi.fn()};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.order.mockReturnValueOnce(query).mockResolvedValueOnce({data:[row],error:null});
 const from=vi.fn().mockReturnValue(query);clientFactory.mockReturnValue({from});
 const service=createRestaurantService('https://example.invalid','publishable','a'.repeat(64));
 const result=await service.tables('staff-token',{orgId:'tenant-a'} as UserContext);
 expect(clientFactory).toHaveBeenCalledWith('https://example.invalid','publishable','staff-token');expect(from).toHaveBeenCalledExactlyOnceWith('restaurant_tables');expect(query.select).toHaveBeenCalledWith('id,name,zone,seats,enabled,version');expect(query.eq).toHaveBeenCalledWith('org_id','tenant-a');expect(result.tables).toEqual([{...row,bill:null}]);
});
