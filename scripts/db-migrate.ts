import { Client } from 'pg';
import { DatabaseInitializer } from './database-initializer.js';
// Only run for a confirmed non-production database. Never print the connection URL.
if (!['development', 'staging'].includes(process.env.DB_ENVIRONMENT ?? '')) {
  throw new Error('Set DB_ENVIRONMENT=development or staging for the confirmed target database');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const applied = await new DatabaseInitializer(client, 'supabase/migrations').apply();
  console.log(JSON.stringify({ applied }));
} catch {
  // Driver errors may contain connection details; keep CLI output credential-free.
  process.stderr.write('Database initialization failed; no credentials logged. Check target and connectivity.\n');
  process.exitCode = 1;
} finally { await client.end(); }
