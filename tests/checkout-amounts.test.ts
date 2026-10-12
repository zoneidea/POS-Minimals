import { expect,it } from 'vitest';
import { parseAmount,addCash,cashDigit } from '../apps/web/src/features/pos/checkout-amounts';
it('parses exact cents and rejects invalid/negative/excess precision amounts',()=>{expect(parseAmount('0.10')).toBe(10n);expect(parseAmount('12')).toBe(1200n);for(const value of ['-1','1e3','1.234','', '1000000000000'])expect(parseAmount(value)).toBeNull();});
it('quick cash buttons accumulate rather than replace received cash',()=>{expect(addCash(addCash('0',20),50)).toBe('70.00');expect(addCash('0.10',100)).toBe('100.10');});
it('supports decimal numpad, clear digit and bounded input',()=>{expect(cashDigit('0','7')).toBe('7');expect(cashDigit('7.','5')).toBe('7.5');expect(cashDigit('7.50','1')).toBe('7.50');expect(cashDigit('7.50','backspace')).toBe('7.5');expect(cashDigit('0','00')).toBe('0');});
