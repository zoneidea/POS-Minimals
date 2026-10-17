// Use a dedicated isolated world: the page world correctly rejects execution
// when receipt JavaScript is disabled. Never evaluate receipt-provided code.
export async function receiptHeight(webContents) {
 try {
  const height = await webContents.executeJavaScriptInIsolatedWorld(1001, [{
   code: `(async()=>{
    await document.fonts.ready;
    await Promise.all(Array.from(document.images,image=>image.decode().catch(()=>{})));
    const bounds=document.body.getBoundingClientRect();
    const bottom=Math.max(bounds.bottom,...Array.from(document.body.children,node=>node.getBoundingClientRect().bottom));
    return Math.ceil((bottom+8)*25400/96);
   })()`,
  }]);
  if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid height');
  return Math.min(2000000, Math.max(10000, Math.ceil(height)));
 } catch {
  throw Object.assign(new Error('Receipt layout failed'), {code:'RECEIPT_LAYOUT_FAILED'});
 }
}
export function nativePrintFailure(reason) {
 return Object.assign(new Error('Native printing failed'), {code:
  reason === 'Invalid printer settings' ? 'PRINT_INVALID_SETTINGS' :
  reason === 'Print job canceled' ? 'PRINT_CANCELED' : 'PRINT_FAILED'});
}
export function printFailureCode(error) {
 return ['RECEIPT_LAYOUT_FAILED','PRINT_INVALID_SETTINGS','PRINT_CANCELED'].includes(error?.code)
  ? error.code : 'PRINT_FAILED';
}
