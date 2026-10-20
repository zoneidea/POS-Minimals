import {landingTitle,landingDescription,siteUrl,shareImage,structuredData} from './content';
export function applyPageMetadata(path:string){
 const home=path==='/',canonical=new URL(path,siteUrl).href;
 document.title=home?landingTitle:'POSJung | ระบบจัดการร้าน';
 const set=(selector:string,value:string)=>{let node=document.head.querySelector<HTMLMetaElement>(selector);if(!node){node=document.createElement('meta');const property=selector.match(/(?:name|property)="([^"]+)"/)?.[1];node.setAttribute(selector.includes('property=')?'property':'name',property??'');document.head.append(node);}node.content=value;};
 set('meta[name="application-name"]','POSJung');
 set('meta[property="og:site_name"]','POSJung');
 set('meta[name="robots"]',home?'index, follow':'noindex, nofollow');
 set('meta[name="description"]',home?landingDescription:'พื้นที่ใช้งาน POSJung สำหรับผู้ใช้ที่เข้าสู่ระบบ');
 for(const [key,value] of Object.entries({'og:title':home?landingTitle:document.title,'og:description':home?landingDescription:'พื้นที่ใช้งาน POSJung','og:url':canonical,'og:image':shareImage}))set(`meta[property="${key}"]`,value);
 for(const [key,value] of Object.entries({'twitter:title':home?landingTitle:document.title,'twitter:description':home?landingDescription:'พื้นที่ใช้งาน POSJung','twitter:image':shareImage}))set(`meta[name="${key}"]`,value);
 let link=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!link){link=document.createElement('link');link.rel='canonical';document.head.append(link);}link.href=canonical;
 let json=document.getElementById('landing-structured-data');if(home){if(!json){json=document.createElement('script');json.id='landing-structured-data';json.setAttribute('type','application/ld+json');document.head.append(json);}json.textContent=JSON.stringify(structuredData);}else json?.remove();
}
