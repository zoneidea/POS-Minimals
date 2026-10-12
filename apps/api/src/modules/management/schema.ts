import { z } from 'zod';
export const settingsInput=z.object({storeName:z.string().trim().min(1).max(120),address:z.string().max(1000),phone:z.string().max(30),taxId:z.string().regex(/^(|[0-9]{13})$/),promptpayIdentifier:z.string().regex(/^(|[0-9]{10}|[0-9]{13})$/),receiptFooter:z.string().max(1000),vatEnabled:z.boolean(),vatRate:z.string().regex(/^(0|[1-9]\d{0,2})\.\d{2}$/).refine(value=>Number(value)<=100),autoOpenPrintDialog:z.boolean(),version:z.number().int().positive()}).strict();
export const staffInput=z.object({role:z.enum(['EMPLOYEE','ACCOUNTANT']),status:z.enum(['ACTIVE','SUSPENDED','DELETED']),version:z.number().int().positive()}).strict();
export const inviteInput=z.object({email:z.email().max(254),role:z.enum(['EMPLOYEE','ACCOUNTANT'])}).strict();
