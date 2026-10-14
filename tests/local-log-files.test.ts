import {it,expect} from 'vitest';
import {mkdtemp,writeFile,readdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appendLocalLog} from '../apps/api/src/infra/local-log-files';
it('rotates local diagnostics and deletes only expired files owned by this logger',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pos-log-'));try{
 await writeFile(join(dir,'api-2026-08-01.jsonl'),'old');await writeFile(join(dir,'api-2026-09-20.jsonl'),'recent');await writeFile(join(dir,'other-2026-08-01.jsonl'),'untouched');
 await appendLocalLog(join(dir,'api.jsonl'),'safe metadata',new Date('2026-10-14T00:00:00Z'));
 expect(await readdir(dir)).toEqual(expect.arrayContaining(['api-2026-09-20.jsonl','api-2026-10-14.jsonl','other-2026-08-01.jsonl']));expect(await readdir(dir)).not.toContain('api-2026-08-01.jsonl');expect(await readFile(join(dir,'api-2026-10-14.jsonl'),'utf8')).toBe('safe metadata\n');
 }finally{await rm(dir,{recursive:true,force:true});}
});
