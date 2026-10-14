import { createCipheriv, randomBytes } from 'node:crypto';
export function encryptStoreContact(phone: string, hex: string) {
 const key=Buffer.from(hex,'hex');
 if(key.length!==32) throw new Error('Server encryption key required');
 const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('pos:store-private:v1'));
 const data=Buffer.concat([cipher.update(JSON.stringify({address:'',phone,taxId:'',promptpayIdentifier:''}),'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');
}
