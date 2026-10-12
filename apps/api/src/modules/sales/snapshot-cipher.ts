import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import { z } from 'zod';
const identity=z.object({storeName:z.string(),cashierName:z.string()});
export function snapshotCipher(hex:string){
 if(!/^[0-9a-f]{64}$/i.test(hex))throw new Error('SALE_SNAPSHOT_KEY must be a 32-byte hex key');
 const key=Buffer.from(hex,'hex');
 return {
 encrypt(value:z.infer<typeof identity>){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('pos:sale-identity:v1'));const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');},
 decrypt(value:string){const [version,iv,tag,data]=value.split('.');if(version!=='v1'||!iv||!tag||!data)throw new Error('Invalid encrypted sale identity');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));decipher.setAAD(Buffer.from('pos:sale-identity:v1'));decipher.setAuthTag(Buffer.from(tag,'base64'));return identity.parse(JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8')));}
 };
}
