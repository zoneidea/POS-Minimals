import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); });

function browser() {
  const scripts: any[] = [];
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('document', {
    createElement: () => ({ remove: vi.fn() }),
    head: { appendChild: (script: unknown) => scripts.push(script) },
  });
  return scripts;
}

it('loads asynchronously and initializes exactly once across concurrent calls and remounts', async () => {
  const scripts = browser();
  const { initializeReservepay, reservepayOptions, reservepayScriptUrl } = await import('../apps/web/src/lib/reservepay-sdk');
  const first = initializeReservepay();
  expect(initializeReservepay()).toBe(first);
  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toMatchObject({ src: reservepayScriptUrl, async: true });
  const instance = {};
  window.Reservepay = { initReservepay: vi.fn(() => instance) };
  scripts[0].onload();
  expect(await first).toBe(instance);
  expect(await initializeReservepay()).toBe(instance);
  expect(window.Reservepay.initReservepay).toHaveBeenCalledExactlyOnceWith(reservepayOptions);
});

it('removes failed scripts and allows retry on a later visit', async () => {
  const scripts = browser();
  const { initializeReservepay } = await import('../apps/web/src/lib/reservepay-sdk');
  const failed = initializeReservepay();
  const assertion = expect(failed).rejects.toThrow('could not be loaded');
  scripts[0].onerror();
  await assertion;
  expect(scripts[0].remove).toHaveBeenCalledOnce();
  const retry = initializeReservepay();
  window.Reservepay = { initReservepay: () => ({}) };
  scripts[1].onload();
  await retry;
});

it('times out without leaving a pending initialization', async () => {
  vi.useFakeTimers();
  const scripts = browser();
  const { initializeReservepay } = await import('../apps/web/src/lib/reservepay-sdk');
  const assertion = expect(initializeReservepay()).rejects.toThrow('could not be loaded');
  await vi.advanceTimersByTimeAsync(15000);
  await assertion;
  expect(scripts[0].remove).toHaveBeenCalledOnce();
});
