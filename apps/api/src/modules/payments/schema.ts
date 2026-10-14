import { z } from 'zod';
export const bankCodes=['002','004','006','011','014','022','024','025','030','033','034','035','039','066','067','069','070','071','073'] as const;
export const paymentSettingsInput=z.object({mode:z.enum(['DISABLED','UPLOAD','GATEWAY']),qrImage:z.string().max(50000).regex(/^(|data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+)$/),bankCode:z.enum(bankCodes).or(z.literal('')),accountName:z.string().trim().max(150).default(''),accountNumber:z.string().regex(/^(|[0-9]{6,20})$/),version:z.number().int().positive()}).strict();
export function maskAccount(value:string){return value.replace(/\d(?=\d{4})/g,'x').replace(/^(.{3})(.)(.{5})(.)$/,'$1-$2-$3-$4');}
