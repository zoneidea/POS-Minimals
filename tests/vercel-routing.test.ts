import { it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
const config=JSON.parse(readFileSync('vercel.json','utf8'));
it('API routing has no named capture to inject into strict business query schemas',()=>{const route=config.routes[0];const match=new RegExp(route.src).exec('/api/v1/inventory/products');expect(match).not.toBeNull();expect(match).toHaveLength(1);expect(route.dest).toBe('/api/index');expect(config.rewrites).toBeUndefined();const query=new URL('/api/v1/inventory/products?page=2&limit=10','https://example.test').searchParams;expect([...query.keys()]).toEqual(['page','limit']);});
it('keeps API dispatch before static assets and SPA fallback',()=>{expect(config.routes[1]).toEqual({handle:'filesystem'});expect(config.routes[2].dest).toBe('/index.html');expect(new RegExp(config.routes[0].src).test('/pos')).toBe(false);});
