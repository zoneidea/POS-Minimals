// Generated from cafe-options.ts by npm run contracts:generate. Do not edit.
import { z } from 'zod';
const money = z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/);
export const cafeLineFields = { lineId: z.uuid().optional(), optionIds: z.array(z.uuid()).max(100).refine(ids => new Set(ids).size === ids.length).optional(), note: z.string().trim().max(200).optional() };
export const cafeExpectedFields = { expectedOptionsFingerprint: z.string().regex(/^[a-f0-9]{32}$/).optional() };
export const uniqueCartLines = (items) => new Set(items.map(i => i.lineId ?? i.productId)).size === items.length;
export const optionSnapshot = z.object({ id: z.uuid(), name: z.string(), groupName: z.string(), price: money });
export const cafeReceiptFields = { lineId: z.uuid().optional(), baseUnitPrice: money.optional(), options: z.array(optionSnapshot).optional(), note: z.string().max(200).optional() };
export const cafeQuoteFields = { ...cafeLineFields, baseUnitPrice: money.optional(), options: z.array(optionSnapshot).optional(), optionsFingerprint: z.string().regex(/^[a-f0-9]{32}$/).optional(), cafeSnapshot: z.object({ baseUnitPrice: money, options: z.array(optionSnapshot), configuration: z.array(z.object({ id: z.uuid(), version: z.number().int().positive() })) }).optional() };
export const cafeOption = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(80), price: money, enabled: z.boolean(), isDefault: z.boolean() }).strict();
export const cafeGroupInput = z.object({ name: z.string().trim().min(1).max(80), minChoices: z.number().int().min(0).max(20), maxChoices: z.number().int().min(1).max(20), enabled: z.boolean(), options: z.array(cafeOption).min(1).max(30), productIds: z.array(z.uuid()).max(200).refine(ids => new Set(ids).size === ids.length) }).strict();
export function validCafeGroup(v) { return v.minChoices <= v.maxChoices && new Set(v.options.map(o => o.id)).size === v.options.length && v.options.every(o => !o.isDefault || o.enabled) && v.options.filter(o => o.isDefault).length <= v.maxChoices && (!v.enabled || v.options.filter(o => o.enabled).length >= v.minChoices); }
export const cafeGroup = cafeGroupInput.extend({ id: z.uuid(), version: z.number().int().positive() });
export const cafeConfiguration = z.object({ storeMode: z.enum(['RETAIL', 'CAFE']), groups: z.array(cafeGroup) });
export const cafeStarterAction = z.object({ action: z.enum(['APPLY', 'SKIP', 'CLEAR']), packageVersion: z.literal('cafe-starter-v1') }).strict();
export const cafeStarterState = z.enum(['AVAILABLE', 'APPLIED', 'SKIPPED', 'CLEARED']);
export const cafeStarterCatalog = z.object({ version: z.literal('cafe-starter-v1'), categories: z.array(z.string()), products: z.array(z.object({ name: z.string(), category: z.string(), price: money, groups: z.array(z.string()) })), groups: z.array(z.object({ key: z.string(), name: z.string(), minChoices: z.number().int(), maxChoices: z.number().int(), options: z.array(z.object({ name: z.string(), price: money, isDefault: z.boolean() })) })) });
export const cafeStarterStatus = z.object({ status: cafeStarterState, remaining: z.number().int().nonnegative(), catalog: cafeStarterCatalog });
export const cafeStarterResult = z.object({ status: cafeStarterState, created: z.number().int().nonnegative().optional(), skipped: z.number().int().nonnegative().optional(), removed: z.number().int().nonnegative().optional(), kept: z.number().int().nonnegative().optional(), categoriesCreated: z.number().int().nonnegative().optional(), groupsCreated: z.number().int().nonnegative().optional(), categoriesRemoved: z.number().int().nonnegative().optional(), groupsRemoved: z.number().int().nonnegative().optional() });
