import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
export interface SqlConnection {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
export class DatabaseInitializer {
  constructor(private connection: SqlConnection, private directory: string) {}
  async apply(): Promise<string[]> {
    const applied: string[] = [];
    await this.connection.query("select pg_advisory_lock(hashtextextended('pos-minimals:migrations', 0))");
    try {
      await this.connection.query(`create schema if not exists private;
        create table if not exists private.schema_migrations (
          name text primary key, checksum text not null, applied_at timestamptz not null default now()
        ); revoke all on schema private from public;`);
      const names = (await readdir(this.directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
      for (const name of names) {
        const sql = await readFile(`${this.directory}/${name}`, 'utf8');
        const checksum = createHash('sha256').update(sql).digest('hex');
        const existing = await this.connection.query('select checksum from private.schema_migrations where name = $1', [name]);
        if (existing.rows.length) {
          if (existing.rows[0]?.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
          continue;
        }
        await this.connection.query('begin');
        try {
          await this.connection.query(sql);
          await this.connection.query('insert into private.schema_migrations(name, checksum) values ($1, $2)', [name, checksum]);
          await this.connection.query('commit');
          applied.push(name);
        } catch (error) {
          await this.connection.query('rollback');
          throw error;
        }
      }
      return applied;
    } finally {
      await this.connection.query("select pg_advisory_unlock(hashtextextended('pos-minimals:migrations', 0))");
    }
  }
}
