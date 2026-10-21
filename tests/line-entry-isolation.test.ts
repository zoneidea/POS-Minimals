import {it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
it('preserves legacy auth and LINE entry isolation while allowing additive store features',()=>{
 const entry=readFileSync('apps/web/line/index.html','utf8');expect(entry).toContain('/src/line-main.tsx');expect(entry).toContain('noindex, nofollow');
 for(const path of ['apps/web/src/main.tsx','apps/web/src/App.tsx','apps/web/src/lib/client.ts','apps/api/src/app.ts'])expect(readFileSync(path,'utf8'),path).not.toMatch(/@line\/liff|features\/line|line-auth-storage/);
 const legacy=readFileSync('apps/web/src/lib/client.ts','utf8');expect(legacy).toContain('createClient(');expect(legacy).toContain('getSession()');expect(legacy).toContain('Authorization: `Bearer ${token}`');
});
it('uses isolated auth and never imports the legacy auth/checkout singleton or print agent',()=>{const root='apps/web/src/features/line/';const source=readdirSync(root).filter(n=>/\.tsx?$/.test(n)).map(n=>readFileSync(root+n,'utf8')).join('\n');expect(source).toContain('kidtang:line:auth:v1:');expect(source).toContain('detectSessionInUrl:false');expect(source).not.toMatch(/from ['"][^'"]*(?:lib\/client|pos\/checkout-client|pos\/use-cash-checkout|printing\/|print-receipt)/);expect(source).not.toMatch(/getIDToken|getAccessToken|getProfile|signInWithIdToken/);});
