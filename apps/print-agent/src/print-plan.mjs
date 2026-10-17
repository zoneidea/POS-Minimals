// CSS width is printable width, not roll width. Leave a small rounding allowance
// inside the measured hard margins. The receipt's own padding remains inside it.
export function printPlan(job,metrics){
 if(metrics){
  // OEM drivers may expose a logical page narrower than the physical roll.
  // Fit that page; reject only pages wider than the selected roll.
  if(metrics.paperWidthMm>job.width+2)throw Object.assign(new Error('Printer paper exceeds POS roll width'),{code:'PRINTER_PAPER_MISMATCH',details:{requestedWidthMm:job.width,paperWidthMm:metrics.paperWidthMm,paperHeightMm:metrics.paperHeightMm,printableWidthMm:metrics.printableWidthMm}});
  return {
   contentWidthMm:Math.min(job.width-8,metrics.paperWidthMm-0.5,metrics.printableWidthMm-0.5),
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

// Only bounded numeric geometry may cross the bridge; never raw driver details.
export function paperFailureDetails(error){
 if(error?.code!=='PRINTER_PAPER_MISMATCH')return undefined;
 const fields=['requestedWidthMm','paperWidthMm','paperHeightMm','printableWidthMm'];
 if(!fields.every(key=>Number.isFinite(error.details?.[key])&&error.details[key]>=20&&error.details[key]<=5000))return undefined;
 if(![58,80].includes(error.details.requestedWidthMm))return undefined;
 return Object.fromEntries(fields.map(key=>[key,error.details[key]]));
}
