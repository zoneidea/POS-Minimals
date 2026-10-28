export const agentVersion='1.2.3';
export function allowedOrigins(packaged){return ['https://zoneexchange.vercel.app','https://posjung.com','https://pos-minimals.vercel.app',...(!packaged?['http://127.0.0.1:5173','http://localhost:5173']:[])];}
