import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=dirname(fileURLToPath(import.meta.url));
export function createTrayIcon(nativeImage,platform=process.platform){
 const image=nativeImage.createFromPath(join(base,platform==='darwin'?'trayTemplate.png':'icon.png'));
 if(platform==='darwin')image.setTemplateImage(true);
 return image;
}
