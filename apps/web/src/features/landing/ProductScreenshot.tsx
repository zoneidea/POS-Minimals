export function ProductScreenshot({name,alt,large=false}:{name:string;alt:string;large?:boolean}){
 const src=`/images/kidtang-${name}-screen.webp`;
 return <figure className={large?'landing-main-screen':undefined}><a href={src} target="_blank" rel="noopener noreferrer" aria-label={`เปิดภาพขนาดเต็ม: ${alt}`}><img src={src} srcSet={`${src.replace('.webp','-small.webp')} 800w, ${src} 1600w`} sizes={large?'(max-width:850px) calc(100vw - 32px), 1200px':'(max-width:850px) calc(100vw - 32px), 760px'} alt={alt} width={1600} height={1000} loading="lazy" decoding="async"/></a><figcaption>หน้าระบบจริง · ข้อมูลร้านตัวอย่าง · กดดูภาพขนาดเต็ม</figcaption></figure>;
}
