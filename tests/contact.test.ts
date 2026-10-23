import {describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../apps/api/src/app.js';
import {createContactService,contactInput} from '../apps/api/src/modules/contact/service.js';
import {createContactSender,contactAvailable} from '../apps/web/src/features/landing/contact-client';

const input={name:'Example user',email:'visitor@example.invalid',subject:'Contact test',message:'Testing contact form integration',website:''};
const env={RESEND_API_KEY:'test-key',CONTACT_EMAIL_FROM:'POSJung <contact@mail.example.invalid>',UPSTASH_REDIS_REST_URL:'https://redis.example.invalid',UPSTASH_REDIS_REST_TOKEN:'test-redis',SALE_SNAPSHOT_KEY:'test-salt'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
describe('public contact boundary',()=>{
 it('allows contact without staff login while preserving protected endpoints and safe logs',async()=>{
  const send=vi.fn().mockResolvedValue(undefined),guard=vi.fn().mockRejectedValue(new Error('No session')),log=vi.fn();
  const app=createApp({contact:{enabled:true,send},allowedOrigins:['https://posjung.com'],checkSessionDay:guard,resolveIdentity:vi.fn(),log});
  expect((await request(app).get('/api/v1/contact/config')).body).toEqual({success:true,data:{enabled:true}});
  const result=await request(app).post('/api/v1/contact').set('Origin','https://posjung.com').set('Idempotency-Key',randomUUID()).send(input);
  expect(result.status).toBe(202);expect(send).toHaveBeenCalledOnce();expect(guard).not.toHaveBeenCalled();
  expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);await request(app).get('/api/v1/auth/me').set('Authorization','Bearer test');expect(guard).toHaveBeenCalledOnce();
  expect(JSON.stringify(log.mock.calls)).not.toContain(input.email);expect(JSON.stringify(log.mock.calls)).not.toContain(input.message);
 });
 it('rejects missing Origin, idempotency, extra recipients and invalid inputs before delivery',async()=>{
  const send=vi.fn(),app=createApp({contact:{enabled:true,send},allowedOrigins:['https://posjung.com'],resolveIdentity:vi.fn(),log:vi.fn()});
  expect((await request(app).post('/api/v1/contact').set('Idempotency-Key',randomUUID()).send(input)).status).toBe(403);
  expect((await request(app).post('/api/v1/contact').set('Origin','https://posjung.com').send(input)).status).toBe(400);
  for(const invalid of [{...input,to:'other@example.invalid'},{...input,email:'bad'},{...input,subject:'x\r\nBcc: spam'},{...input,message:'short'},{...input,name:' '},{...input,message:'x'.repeat(3001)}])expect((await request(app).post('/api/v1/contact').set('Origin','https://posjung.com').set('Idempotency-Key',randomUUID()).send(invalid)).status).toBe(400);
  expect(send).not.toHaveBeenCalled();expect(contactInput.safeParse(input).success).toBe(true);
 });
});
describe('Resend transport',()=>{
 it('fixes the recipient, uses visitor Reply-To and preserves retry key without storing PII in Redis',async()=>{
  const transport=vi.fn().mockResolvedValueOnce(json({result:1})).mockResolvedValueOnce(json({id:'mail-test'}));
  const service=createContactService(env,transport),key=randomUUID();await service.send(input,key,'192.0.2.1');
  const redis=JSON.parse(transport.mock.calls[0]![1].body),mail=transport.mock.calls[1]!;
  expect(JSON.stringify(redis)).not.toContain('192.0.2.1');expect(JSON.stringify(redis)).not.toContain(input.email);
  expect(mail[0]).toBe('https://api.resend.com/emails');expect(mail[1].headers['Idempotency-Key']).toBe(`contact/${key}`);
  expect(JSON.parse(mail[1].body)).toMatchObject({to:['dev@zoneidea.co.th'],reply_to:input.email,from:env.CONTACT_EMAIL_FROM,text:expect.stringContaining(input.message)});
 });
 it('fails closed on rate limit or unavailable shared limiter without calling Resend',async()=>{
  for(const [result,status] of [[json({result:0}),429],[json({error:'unavailable'},503),503],[json({result:null}),503]] as const){
   const transport=vi.fn().mockResolvedValue(result);await expect(createContactService(env,transport).send(input,randomUUID(),'ip')).rejects.toMatchObject({status});expect(transport).toHaveBeenCalledOnce();
  }
 });
 it('disables delivery when configuration is absent and rejects honeypots',async()=>{
  const transport=vi.fn();expect(createContactService({},transport).enabled).toBe(false);
  await expect(createContactService({},transport).send(input,randomUUID(),'ip')).rejects.toMatchObject({status:503});
  await expect(createContactService(env,transport).send({...input,website:'spam'},randomUUID(),'ip')).rejects.toMatchObject({status:400});expect(transport).not.toHaveBeenCalled();
 });
 it('does not acknowledge provider errors or unknown outcomes',async()=>{
  for(const response of [json({message:'secret-provider-error'},403),json({}),json({id:''})]){
   const transport=vi.fn().mockResolvedValueOnce(json({result:1})).mockResolvedValueOnce(response);await expect(createContactService(env,transport).send(input,randomUUID(),'ip')).rejects.toMatchObject({status:502,code:'CONTACT_SEND_UNCONFIRMED'});
  }
 });
});
describe('contact browser client',()=>{
 it('reuses the key for uncertain retries, rotates after success or edited input',async()=>{
  const transport=vi.fn().mockResolvedValueOnce(json({},502)).mockResolvedValueOnce(json({success:true,data:{accepted:true}},202)).mockResolvedValueOnce(json({success:true,data:{accepted:true}},202));
  const send=createContactSender(transport);await expect(send(input)).rejects.toThrow();await send(input);await send({...input,message:'Another message to support'});
  const headers=transport.mock.calls.map(call=>call[1].headers);expect(headers[0]['Idempotency-Key']).toBe(headers[1]['Idempotency-Key']);expect(headers[2]['Idempotency-Key']).not.toBe(headers[1]['Idempotency-Key']);
 });
 it('reports availability only on an acknowledged enabled config',async()=>{
  expect(await contactAvailable(vi.fn().mockResolvedValue(json({success:true,data:{enabled:true}})))).toBe(true);
  expect(await contactAvailable(vi.fn().mockRejectedValue(new Error('offline')))).toBe(false);
 });
});
