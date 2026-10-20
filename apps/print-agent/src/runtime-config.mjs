export const agentVersion='1.1.1';
export function allowedOrigins(packaged){return ['https://posjung.com','https://pos-minimals.vercel.app',...(!packaged?['http://127.0.0.1:5173','http://localhost:5173']:[])];}
