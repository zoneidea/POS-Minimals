import {it,expect} from 'vitest';
import {renderToString} from 'react-dom/server';
import {LandingPage} from '../apps/web/src/features/landing/LandingPage';
import {faqItems,structuredData,landingTitle,landingDescription,shareImage,siteUrl} from '../apps/web/src/features/landing/content';
import {readFileSync} from 'node:fs';
it('renders public copy, pricing, FAQ and screenshots into initial HTML without a browser or authentication',()=>{
 const html=renderToString(<LandingPage/>);
 expect(html.match(/<h1>/g)).toHaveLength(1);
 expect(html).toContain('/brand/posjung-wordmark.webp');expect(html).toContain('alt="POSJung ขายง่าย ใช้ฟรี"');
 for(const text of ['ระบบขายหน้าร้าน','ใช้ฟรีทุกฟังก์ชัน','คาเฟ่','เปลี่ยนโหมดได้','มีร้านแล้ว? เข้าสู่ระบบ','ไม่ต้องสร้างเองทั้งหมด','เฉพาะโหมดคาเฟ่','ต้นทุนเริ่มต้นเป็น 0 บาท'])expect(html).toContain(text);
 expect(html).not.toMatch(/ค่าธรรมเนียม|1\.50%|15 บาท|ถอนเงิน/);
 expect(html.match(/<details>/g)).toHaveLength(8);
 for(const name of ['sales','inventory','reports','cafe-starter'])expect(html).toContain(`posjung-${name}-screen-20261022.jpg`);
 expect(html).toContain('พนักงานต้องตรวจสอบยอดเงินเข้าก่อนยืนยันการขาย');expect(html).toContain('การยืนยันการชำระเงินอัตโนมัติยังไม่เปิดให้เลือกในช่วง Demo');
 expect(html).not.toMatch(/ร้านรู้ผลจากธนาคาร|พนักงานไม่ต้องถ่ายหรือตรวจสลิปเอง/);
 expect(html).not.toMatch(/Payment Gateway|API|ฟรีทุกอย่าง|ไม่มีค่าใช้จ่าย|ถอนเงินได้ทันที/);
 expect(html).toContain('href="/forgot-password"');expect(html).toContain('href="/?register=1#login"');
 expect(html).toContain('autoComplete="current-password"');
});
it('describes the free software offer separately from payment/withdrawal fees without invented social proof',()=>{
 expect(faqItems).toHaveLength(8);expect(landingTitle).toContain('ระบบ POS ฟรี');expect(landingDescription).toContain('ใช้งานผ่านเว็บ');
 expect(shareImage).toBe('https://posjung.com/images/posjung-share.png');
 expect(siteUrl).toBe('https://posjung.com/');expect(JSON.stringify(structuredData)).not.toContain('pos-minimals.vercel.app');expect(structuredData['@graph'][0]).toMatchObject({url:siteUrl});
 const app=structuredData['@graph'][1];expect(app).toMatchObject({'@type':'SoftwareApplication',offers:{price:'0',priceCurrency:'THB'}});
 expect(JSON.stringify(app)).toContain('คาเฟ่');expect(JSON.stringify(app)).not.toMatch(/ค่าธรรมเนียม|1\.50%|15 บาท|ถอนเงิน/);expect(app).not.toHaveProperty('aggregateRating');expect(app).not.toHaveProperty('review');
});
it('routes private and recovery HTML separately from the indexable landing page without touching API routing',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));expect(config.routes[0].dest).toBe('/api/index');expect(config.routes[1]).toEqual({handle:'filesystem'});
 const rule=config.routes[2];for(const path of ['/marketplace','/coupons','/reports/coupons','/pos','/reports/gateway','/forgot-password','/reset-password','/join']){const match=path.match(new RegExp(rule.src));expect(match).not.toBeNull();expect(rule.dest.replace('$1',match![1])).toBe('/internal'+path+'.html');}
 expect(rule.headers['X-Robots-Tag']).toBe('noindex, nofollow');expect(new RegExp(rule.src).test('/')).toBe(false);
 expect(config.routes.at(-1).dest).toBe('/app.html');
});

it('keeps cafe starter promotion and screenshot assets consistent with the installed package',()=>{
 const sql=readFileSync('supabase/migrations/202610220006_cafe_starter.sql','utf8');
 const manifest=sql.match(/\$catalog\$([\s\S]*?)\$catalog\$/)?.[1];if(!manifest)throw new Error('Starter catalog missing');
 const catalog=JSON.parse(manifest);
 expect(catalog.products).toHaveLength(18);expect(catalog.categories).toHaveLength(4);expect(catalog.groups).toHaveLength(7);
 const html=renderToString(<LandingPage/>);expect(html).toContain('18');expect(html).toContain('กลุ่มตัวเลือก');expect(landingDescription).toContain('เมนูตั้งต้น 18 รายการ');
 for(const name of ['sales','inventory','reports','cafe-starter'])expect(readFileSync(`apps/web/public/images/posjung-${name}-screen-20261022.jpg`).subarray(0,3).toString('hex')).toBe('ffd8ff');
});
