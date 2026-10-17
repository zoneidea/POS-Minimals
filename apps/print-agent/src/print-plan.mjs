// CSS width is printable width, not roll width. Leave a small rounding allowance
// inside the measured hard margins. The receipt's own padding remains inside it.
export function printPlan(job,metrics){
 if(metrics){
  if(Math.abs(metrics.paperWidthMm-job.width)>2)throw Object.assign(new Error('Printer paper width differs from POS'),{code:'PRINTER_PAPER_MISMATCH'});
  return {
   contentWidthMm:Math.min(job.width-8,metrics.printableWidthMm-0.5),
   options:{deviceName:metrics.printerName,margins:{marginType:'printableArea'},pageSize:{width:Math.round(metrics.paperWidthMm*1000),height:Math.round(metrics.paperHeightMm*1000)}},
   diagnostics:{paperWidthMm:metrics.paperWidthMm,paperHeightMm:metrics.paperHeightMm,printableWidthMm:metrics.printableWidthMm,printableHeightMm:metrics.printableHeightMm,printableXMm:metrics.printableXMm,printableYMm:metrics.printableYMm},
  };
 }
 return {contentWidthMm:job.width-8,options:{deviceName:job.printer,margins:{marginType:'none'}}};
}
export function receiptWidthCss(width){
 if(!Number.isFinite(width)||width<20||width>80)throw new Error('Invalid receipt width');
 return `:root{--receipt-width:${width}mm!important}body{box-sizing:border-box!important;width:${width}mm!important;max-width:${width}mm!important}`;
}
