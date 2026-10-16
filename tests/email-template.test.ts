import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('email primary button verifies with Supabase URL and provides a fallback',()=>{const html=readFileSync('supabase/templates/confirm-signup.html','utf8');expect(html).toMatch(/href="\{\{ \.ConfirmationURL \}\}"[^>]*>Confirm email<\/a>/);expect(html).toContain('KidTang');expect(html).not.toMatch(/<script|onclick=|<button/);expect(html.match(/href="\{\{ \.ConfirmationURL \}\}"/g)).toHaveLength(2);});
