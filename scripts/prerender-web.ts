import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const root=fileURLToPath(new URL('../apps/web',import.meta.url)),dist=join(root,'dist');
const server=await createServer({configFile:false,root,plugins:[react()],server:{middlewareMode:true},appType:'custom'});
try{
 const {renderLanding,landingTitle,landingDescription,structuredData,shareImage,siteUrl}=await server.ssrLoadModule('/src/features/landing/prerender.tsx');
 const template=await readFile(join(dist,'index.html'),'utf8');
 const assets=await readdir(join(dist,'assets'));
 const fontHints=['prompt-thai-400-normal-','prompt-thai-700-normal-'].map(prefix=>assets.find(name=>name.startsWith(prefix)&&name.endsWith('.woff2'))).filter(Boolean).map(name=>`<link rel="preload" href="/assets/${name}" as="font" type="font/woff2" crossorigin>`).join('');
 const verification=process.env.GOOGLE_SITE_VERIFICATION?.trim();
 const escape=(v:string)=>v.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const head=(path:string)=>{
  const home=path==='/',title=home?landingTitle:'POSJung | ระบบจัดการร้าน',description=home?landingDescription:'พื้นที่ใช้งาน POSJung สำหรับผู้ใช้ที่เข้าสู่ระบบ',canonical=new URL(path,siteUrl).href;
  return `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="application-name" content="POSJung"><meta name="robots" content="${home?'index, follow':'noindex, nofollow'}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:locale" content="th_TH"><meta property="og:site_name" content="POSJung"><meta property="og:url" content="${canonical}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="${shareImage}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="POSJung ขายง่าย ใช้ฟรี โลโก้ระบบ POS สำหรับร้านทั่วไปและคาเฟ่"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${shareImage}">${home?`<script id="landing-structured-data" type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<','\\u003c')}</script>`:''}`;
 };
 const page=(path:string,html='')=>template.replace('<!-- page-metadata -->',head(path)+(path==='/'?fontHints+(verification?`<meta name="google-site-verification" content="${escape(verification)}">`:''):'')).replace('<div id="root"></div>',`<div id="root">${html}</div>`);
 await writeFile(join(dist,'index.html'),page('/',renderLanding()));
 await writeFile(join(dist,'app.html'),page('/404'));
 const privatePaths=['dashboard','pos','tables','sales','inventory','categories','settings','users','reports','reports/gateway','audits','account','marketplace','coupons','reports/coupons','forgot-password','reset-password','join'];
 for(const path of privatePaths){const file=join(dist,'internal',path+'.html');await mkdir(dirname(file),{recursive:true});await writeFile(file,page('/'+path));}
 await writeFile(join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}</loc></url></urlset>`);
 await writeFile(join(dist,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
 console.log('Prerendered public landing page and noindex application entry points.');
}finally{await server.close();}
