import { useEffect, useState } from 'react';

const workspacePaths = new Set(['/','/dashboard','/pos','/sales','/inventory','/categories','/settings','/users','/reports','/reports/gateway','/audits','/account','/marketplace','/coupons','/reports/coupons']);
export function navigateWorkspace(path: string, replace = false) {
 window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
 window.dispatchEvent(new Event('popstate'));
}
export function useWorkspacePath(enabled: boolean, home: string) {
 const [path, setPath] = useState(window.location.pathname);
 useEffect(() => {
  const update = () => setPath(window.location.pathname);
  const click = (event: MouseEvent) => {
   if (!enabled || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
   const anchor = event.target instanceof Element ? event.target.closest('a') : null;
   if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
   const url = new URL(anchor.href);
   if (url.origin !== window.location.origin || !workspacePaths.has(url.pathname) || url.search || url.hash) return;
   event.preventDefault();
   const destination = url.pathname === '/' ? home : url.pathname;
   if (destination !== window.location.pathname) navigateWorkspace(destination);
  };
  window.addEventListener('popstate', update);
  document.addEventListener('click', click);
  return () => { window.removeEventListener('popstate', update); document.removeEventListener('click', click); };
 }, [enabled, home]);
 return path;
}
