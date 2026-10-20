import type {CustomerFrame} from './model';
// Coalesce rapid cart/numpad changes, keep ordering, and never await this from checkout.
export class CustomerDisplaySession{
 private id:string;private sequence=0;private revision=0;private sentRevision=0;private latest:CustomerFrame|undefined;private connected=false;private busy=false;private closed=false;private retryAt=0;
 constructor(private io:{configure:()=>Promise<unknown>;send:(id:string,sequence:number,frame:CustomerFrame)=>Promise<unknown>;release:(id:string)=>Promise<unknown>;error:(message:string)=>void;newId:()=>string}){this.id=io.newId();}
 update(frame:CustomerFrame){this.latest=frame;this.revision++;void this.flush();}
 async flush(){
  if(this.closed||this.busy||!this.latest||Date.now()<this.retryAt)return;this.busy=true;let failed=false;
  try{if(!this.connected){await this.io.configure();this.connected=true;}if(this.closed)return;
   const revision=this.revision;await this.io.send(this.id,++this.sequence,this.latest);this.sentRevision=revision;if(!this.closed)this.io.error('');
  }catch(error){failed=true;this.connected=false;this.retryAt=Date.now()+3000;if((error as {code?:string})?.code==='DISPLAY_SESSION_CLOSED'){this.id=this.io.newId();this.sequence=0;}
   if(!this.closed)this.io.error(error instanceof Error?error.message:'เชื่อมต่อจอลูกค้าไม่สำเร็จ');
  }finally{this.busy=false;if(!failed&&!this.closed&&this.sentRevision!==this.revision)void this.flush();}
 }
 close(){if(this.closed)return;this.closed=true;void this.io.release(this.id).catch(()=>{});}
}
