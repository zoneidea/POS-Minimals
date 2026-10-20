export const moduleChangeKey='pos:module-settings-changed:v1';
// A refresh signal only: ownership/permissions always come from the API.
export function announceModuleChange(){try{localStorage.setItem(moduleChangeKey,crypto.randomUUID());}catch{/* Focus refresh and server authorization remain available. */}}
