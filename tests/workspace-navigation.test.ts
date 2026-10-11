import { afterEach, expect, it, vi } from 'vitest';
import { navigateWorkspace } from '../apps/web/src/lib/use-workspace-path';
afterEach(() => vi.unstubAllGlobals());
it('changes menus through history without reloading the document', () => {
 const pushState=vi.fn(),replaceState=vi.fn(),dispatchEvent=vi.fn();
 vi.stubGlobal('window',{history:{pushState,replaceState},dispatchEvent});
 navigateWorkspace('/inventory');
 expect(pushState).toHaveBeenCalledWith(null,'','/inventory');
 expect(dispatchEvent.mock.calls[0]![0].type).toBe('popstate');
 navigateWorkspace('/dashboard',true);
 expect(replaceState).toHaveBeenCalledWith(null,'','/dashboard');
});
