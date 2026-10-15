/** Public installation identifiers; the server API key must never enter this module. */
export const reservepayOptions = Object.freeze({
  merchantId: '636424799305',
  installationId: 'ins_ctd1FZtaDq',
});
export const reservepayScriptUrl = 'https://sdk.reservepay.com/js/v1/reservepay.js';

declare global {
  interface Window {
    Reservepay?: { initReservepay(options: typeof reservepayOptions): unknown };
  }
}

let initialization: Promise<unknown> | undefined;

/** Share loading/initialization across POS remounts, including React StrictMode. */
export function initializeReservepay(): Promise<unknown> {
  if (initialization) return initialization;
  initialization = new Promise<unknown>((resolve, reject) => {
    const initialize = () => {
      try {
        if (!window.Reservepay?.initReservepay) throw new Error('ReservePay SDK unavailable');
        resolve(window.Reservepay.initReservepay(reservepayOptions));
      } catch (error) { reject(error); }
    };
    if (window.Reservepay?.initReservepay) { initialize(); return; }
    const script = document.createElement('script');
    script.src = reservepayScriptUrl;
    script.async = true;
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
    };
    const fail = () => {
      cleanup();
      script.remove();
      reject(new Error('ReservePay SDK could not be loaded'));
    };
    const timeout = window.setTimeout(fail, 15000);
    script.onload = () => { cleanup(); initialize(); };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => {
    initialization = undefined; // A later POS visit may retry a failed load.
    throw error;
  });
  return initialization;
}
