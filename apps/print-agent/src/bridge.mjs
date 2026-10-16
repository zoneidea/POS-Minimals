import {printFailureCode} from './receipt-layout.mjs';
import {normalizePrinter} from './printer-info.mjs';
import {createServer} from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function createBridge({origins,pairCode,clients,persist,listPrinters,print,record}){
 const printersForClient=async()=> (await listPrinters()).map(normalizePrinter);
 let failures=0,blockedUntil=0;const jobs=new Map();
 const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(!origins.includes(origin)||req.headers.host!=='127.0.0.1:17865'){res.writeHead(403);res.end();return;}
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Private-Network','true');
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');res.writeHead(204);res.end();return;}
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try{
   if(req.method==='GET'&&req.url==='/health'){send(200,{version:'1.0.3'});return;}
   let body={};if(req.method==='POST'){if(req.headers['content-type']!=='application/json'){send(415,{error:'JSON required'});return;}let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>1024*1024){send(413,{error:'Receipt too large'});return;}}body=JSON.parse(raw);}
   if(req.method==='POST'&&req.url==='/pair'){
    if(Date.now()<blockedUntil){send(429,{error:'Try pairing later'});return;}
    if(typeof body.code!=='string'||body.code!==pairCode()){failures++;if(failures>=5){blockedUntil=Date.now()+60000;failures=0;}send(403,{error:'Pairing code incorrect'});return;}
    const token=randomBytes(32).toString('hex');clients[origin]=hash(token);await persist();failures=0;record('paired');send(200,{token});return;
   }
   const token=req.headers.authorization?.replace(/^Bearer /,'')??'',expected=clients[origin],actual=hash(token);
   if(!expected||!timingSafeEqual(Buffer.from(expected),Buffer.from(actual))){send(401,{error:'Pair this device first'});return;}
   if(req.method==='GET'&&req.url==='/printers'){send(200,{printers:await printersForClient()});return;}
   if(req.method==='POST'&&req.url==='/print'){
    if(!/^[\da-f-]{36}$/i.test(body.jobId??'')||typeof body.html!=='string'||![58,80].includes(body.width)||typeof body.printer!=='string'||body.printer.length>200){send(400,{error:'Invalid print job'});return;}
    const digest=hash(JSON.stringify(body)),prior=jobs.get(body.jobId);
    if(prior){send(prior.digest===digest?409:400,{error:'Job already submitted; check printer before printing again'});return;}
    if(jobs.size>=10000){send(429,{error:'Restart Agent to clear finished jobs'});return;}
    jobs.set(body.jobId,{digest});
    const printers=await printersForClient();if(body.printer&&!printers.some(p=>p.name===body.printer)||!body.printer&&printers.length===0){jobs.delete(body.jobId);send(400,{error:'Printer unavailable',code:'PRINTER_UNAVAILABLE'});return;}
    record('print_requested',body.jobId);
    try{await print(body);record('print_submitted',body.jobId);send(200,{submitted:true});}catch(error){const code=printFailureCode(error);record('print_failed',body.jobId,code);send(503,{error:'Could not submit print job; check printer before trying again',code,jobId:body.jobId});}return;
   }
   send(404,{error:'Not found'});
  }catch{if(!res.headersSent)send(400,{error:'Invalid request'});else res.end();}
 });
 return server;
}
