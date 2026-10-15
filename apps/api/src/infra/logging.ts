import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import {appendLocalLog} from './local-log-files.js';
export interface RequestLog {
  requestId: string; method: string; path: string; status: number; durationMs: number;
  timingsMs?:Record<string,number>;functionRegion?:string;
}
export type LogRequest = (event: RequestLog) => void;
export function createRequestLogger(file = 'logs/api.jsonl',storage?:{url:string;secret?:string}): LogRequest {
  const client=storage?.secret?createClient(storage.url,storage.secret,{auth:{persistSession:false,autoRefreshToken:false}}):null;
  return (event) => {
    // Never include headers, request/response payloads, query strings, tokens or PII.
    const line = JSON.stringify({ event: 'http_request_response', at: new Date().toISOString(), ...event });
    process.stdout.write(line + '\n');
    if(client){const pending=Promise.resolve(client.rpc('record_request_log',{p_request_id:event.requestId,p_method:event.method,p_route:event.path,p_status:event.status,p_duration:event.durationMs})).then(({error})=>{if(error)process.stderr.write('Persistent request log unavailable\n');}).catch(()=>{process.stderr.write('Persistent request log unavailable\n');});if(process.env.VERCEL)waitUntil(pending);else void pending;}
    else if(process.env.VERCEL)process.stderr.write('Persistent request logging not configured\n');
    if (!process.env.VERCEL) {
      void appendLocalLog(file,line)
        .catch(() => process.stderr.write('Request log file unavailable\n'));
    }
  };
}
