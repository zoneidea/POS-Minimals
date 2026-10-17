import {it,expect} from 'vitest';
import {renderToString} from 'react-dom/server';
import {LandingPage} from '../apps/web/src/features/landing/LandingPage';
import {faqItems,structuredData,landingTitle,landingDescription,shareImage} from '../apps/web/src/features/landing/content';
import {readFileSync} from 'node:fs';
it('renders public copy, pricing, FAQ and screenshots into initial HTML without a browser or authentication',()=>{
 const html=renderToString(<LandingPage/>);
 expect(html.match(/<h1>/g)).toHaveLength(1);
 expect(html).toContain('/brand/kidtang-wordmark.webp');expect(html).toContain('alt="KidTang คิดตังค์ by ZoneIdea"');
 for(const text of ['ระบบขายหน้าร้าน','ใช้ฟรีทุกฟังก์ชัน','1.50%','15','การแจ้งเบิกเงินในระบบยังไม่เปิดใช้งาน','มีร้านแล้ว? เข้าสู่ระบบ'])expect(html).toContain(text);
 expect(html.match(/<details>/g)).toHaveLength(6);
 for(const name of ['sales','inventory','reports'])expect(html).toContain(`kidtang-${name}-selected-screen.png`);
 expect(html).not.toMatch(/Payment Gateway|API|ฟรีทุกอย่าง|ไม่มีค่าใช้จ่าย|ถอนเงินได้ทันที/);
 expect(html).toContain('href="/forgot-password"');expect(html).toContain('href="/?register=1#login"');
 expect(html).toContain('autoComplete="current-password"');
});
it('describes the free software offer separately from payment/withdrawal fees without invented social proof',()=>{
 expect(faqItems).toHaveLength(6);expect(landingTitle).toContain('ระบบ POS ฟรี');expect(landingDescription).toContain('ใช้งานผ่านเว็บ');
 expect(shareImage).toBe('https://pos-minimals.vercel.app/images/kidtang-selected-share.png');
 const app=structuredData['@graph'][1];expect(app).toMatchObject({'@type':'SoftwareApplication',offers:{price:'0',priceCurrency:'THB'}});
 expect(JSON.stringify(app)).toContain('ยังไม่เปิดใช้งาน');expect(app).not.toHaveProperty('aggregateRating');expect(app).not.toHaveProperty('review');
});
it('routes private and recovery HTML separately from the indexable landing page without touching API routing',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));expect(config.routes[0].dest).toBe('/api/index');expect(config.routes[1]).toEqual({handle:'filesystem'});
 const rule=config.routes[2];for(const path of ['/marketplace','/coupons','/reports/coupons','/pos','/reports/gateway','/forgot-password','/reset-password','/join']){const match=path.match(new RegExp(rule.src));expect(match).not.toBeNull();expect(rule.dest.replace('$1',match![1])).toBe('/internal'+path+'.html');}
 expect(rule.headers['X-Robots-Tag']).toBe('noindex, nofollow');expect(new RegExp(rule.src).test('/')).toBe(false);
 expect(config.routes.at(-1).dest).toBe('/app.html');
});
