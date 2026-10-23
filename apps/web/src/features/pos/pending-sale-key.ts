// Storage identity is shared without initializing the authenticated API client.
export function pendingSaleKey(scope:string){return `pos:pending-sale:v1:${scope}`;}
