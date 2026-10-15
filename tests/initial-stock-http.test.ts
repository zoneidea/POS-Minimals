import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {createApp} from '../apps/api/src/app';
const id='00000000-0000-4000-8000-000000000001';
const product={barcode:'001',name:'Coffee',categoryId:null,salePrice:'22.00',unitCost:'5.00'};
it('passes opening stock to owner creation but rejects it on product edits and denies staff',async()=>{
 let role='OWNER';const mutate=vi.fn(async()=>({...product,id,quantity:12,version:2,imagePath:null}));
 const app=createApp({products:{list:vi.fn(),mutate},resolveIdentity:async()=>({userId:id,orgId:id,orgName:'Shop',username:'Owner',role:role as 'OWNER',permissions:[]}),allowedOrigins:[],log:()=>{}});
 const post=(body:object)=>request(app).post('/api/v1/inventory/products').set('Authorization','Bearer t').send(body);
 expect((await post({...product,initialQuantity:12})).status).toBe(200);
 expect(mutate).toHaveBeenCalledWith('t','create',null,{...product,initialQuantity:12},null,expect.any(String));
 expect((await request(app).patch(`/api/v1/inventory/products/${id}`).set('Authorization','Bearer t').send({...product,initialQuantity:12,expectedVersion:1})).status).toBe(400);
 for(const quantity of [-1,1.1,2147483648])expect((await post({...product,initialQuantity:quantity})).status).toBe(400);
 role='EMPLOYEE';expect((await post({...product,initialQuantity:12})).status).toBe(403);expect(mutate).toHaveBeenCalledOnce();
});
