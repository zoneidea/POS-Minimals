import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {readFileSync} from 'node:fs';
import {createApp} from '../apps/api/src/app';
import {timeStep} from '../apps/api/src/infra/request-timing';
it('reports safe stage timings for diagnosis while keeping live identity checks on cache hits',async()=>{
 const log=vi.fn(),resolve=vi.fn(async()=>timeStep('auth',async()=>({userId:'private-user',orgId:'private-shop',orgName:'Private',username:'private-name',role:'OWNER' as const,permissions:[]})));
 const app=createApp({resolveIdentity:resolve,checkSessionDay:async()=>Date.now()+1000,categories:{list:async()=>({items:[],page:1,limit:10,total:0}),mutate:vi.fn()},allowedOrigins:[],log});
 const response=await request(app).get('/api/v1/categories').set('Authorization','Bearer private-token');
 expect(response.status).toBe(200);expect(response.headers['server-timing']).toMatch(/session;dur=[\d.]+/);
 expect(response.headers['server-timing']).toMatch(/auth;dur=[\d.]+/);expect(response.headers['server-timing']).toMatch(/data;dur=[\d.]+/);
 const event=log.mock.calls[0]![0];expect(event.timingsMs).toHaveProperty('auth');
 expect(JSON.stringify(event)).not.toMatch(/private-user|private-shop|private-name|private-token/);
 expect(response.headers['server-timing']).not.toContain('private');
});
it('pins API execution to the Sydney database region while preserving SPA/API routing',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 expect(config.regions).toEqual(['syd1']);expect(config.routes[0].dest).toBe('/api/index');expect(config.outputDirectory).toBe('apps/web/dist');
});
