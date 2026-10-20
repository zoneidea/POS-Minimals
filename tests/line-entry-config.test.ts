import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolveLineLiffId} from '../apps/web/src/features/line/entry-config';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('keeps legacy Developing defaults and environment overrides independent of Published',()=>{
 expect(resolveLineLiffId(undefined)).toBe('2012103465-KynjquiS');
 expect(resolveLineLiffId('developing','1234567890-TestDev','1234567891-TestPub')).toBe('1234567890-TestDev');
 expect(resolveLineLiffId('published','1234567890-TestDev')).toBe('2012103467-h4JHbf2A');
 expect(resolveLineLiffId('published','1234567890-TestDev','1234567891-TestPub')).toBe('1234567891-TestPub');
});
it('initializes the real SDK wrapper with the supplied Published ID',async()=>{
 const init=vi.fn(async()=>{});vi.stubGlobal('window',{liff:{init,isInClient:()=>true}});
 const {initializeLiff}=await import('../apps/web/src/features/line/liff');
 await initializeLiff(resolveLineLiffId('published'));
 expect(init).toHaveBeenCalledExactlyOnceWith({liffId:'2012103467-h4JHbf2A'});
});
it('routes both entry points to the shared client with distinct channel markers and no indexing',()=>{
 const routes=JSON.parse(readFileSync('vercel.json','utf8')).routes;
 for(const [path,channel] of [['/line/','developing'],['/line/published/','published']] as const){
  const html=readFileSync(`apps/web${path}index.html`,'utf8');
  expect(html).toContain(`data-line-channel="${channel}"`);expect(html).toContain('/src/line-main.tsx');expect(html).toContain('noindex, nofollow');expect(html).toContain(`href="https://posjung.com${path}"`);
  for(const url of [path,path.slice(0,-1)]){const route=routes.find((r:{src?:string})=>r.src&&new RegExp(r.src).test(url));expect(route.dest).toBe(`${path}index.html`);expect(route.headers['X-Robots-Tag']).toBe('noindex, nofollow');}
 }
 expect(readFileSync('apps/web/vite.config.ts','utf8')).toContain("./line/published/index.html");
 expect(readFileSync('apps/web/src/main.tsx','utf8')).not.toMatch(/line-main|features\/line/);
});
