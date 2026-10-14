import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
export function encryptStoreContact(phone: string, hex: string) {
 const key=Buffer.from(hex,'hex');
 if(key.length!==32) throw new Error('Server encryption key required');
 const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('pos:store-private:v1'));
 const data=Buffer.concat([cipher.update(JSON.stringify({address:'',phone,taxId:'',promptpayIdentifier:''}),'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');
}

export function decryptStorePhone(value:string,hex:string){
 const [version,iv,tag,data]=value.split('.');if(version!=='v1'||!iv||!tag||!data)throw new Error('Invalid encrypted contact');
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(hex,'hex'),Buffer.from(iv,'base64'));
 decipher.setAAD(Buffer.from('pos:store-private:v1'));decipher.setAuthTag(Buffer.from(tag,'base64'));
 const result=JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8'));
 if(typeof result.phone!=='string')throw new Error('Invalid encrypted contact');return result.phone as string;
}
