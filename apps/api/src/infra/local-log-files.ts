import {appendFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {dirname,basename,join} from 'node:path';
/** Daily diagnostic files; cleanup only this logger's own dated files. */
export async function appendLocalLog(file:string,line:string,now=new Date()){
 const directory=dirname(file),prefix=basename(file).replace(/\.jsonl$/,''),day=now.toISOString().slice(0,10);
 await mkdir(directory,{recursive:true});await appendFile(join(directory,`${prefix}-${day}.jsonl`),line+'\n');
 const cutoff=now.getTime()-30*86400000;
 for(const name of await readdir(directory)){
  if(!name.startsWith(prefix+'-')||!name.endsWith('.jsonl'))continue;
  const stamp=name.slice(prefix.length+1,-6);if(!/^\d{4}-\d{2}-\d{2}$/.test(stamp))continue;
  // Drop only files whose whole UTC day is outside the retention window.
  if(Date.parse(stamp+'T00:00:00Z')+86400000<cutoff)await unlink(join(directory,name)).catch(()=>{});
 }
}
