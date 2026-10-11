import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
export interface RequestLog {
  requestId: string; method: string; path: string; status: number; durationMs: number;
}
export type LogRequest = (event: RequestLog) => void;
export function createRequestLogger(file = 'logs/api.jsonl'): LogRequest {
  return (event) => {
    // Never include headers, request/response payloads, query strings, tokens or PII.
    const line = JSON.stringify({ event: 'http_request_response', at: new Date().toISOString(), ...event });
    process.stdout.write(line + '\n');
    if (!process.env.VERCEL) {
      void mkdir(dirname(file), { recursive: true }).then(() => appendFile(file, line + '\n'))
        .catch(() => process.stderr.write('Request log file unavailable\n'));
    }
  };
}
