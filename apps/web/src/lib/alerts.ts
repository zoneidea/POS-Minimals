import type {SweetAlertOptions} from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import './alerts.css';
const load=async()=>{try{return (await import('sweetalert2')).default;}catch{return undefined;}};
const target=()=>document.querySelector<HTMLDialogElement>('dialog[open]')??document.body;
async function fire(options:SweetAlertOptions){
 const Swal=await load();if(!Swal)return;
 const host=target();let observer:MutationObserver|undefined;
 try{return await Swal.fire({...options,target:host,didOpen:()=>{
  const container=Swal.getContainer();
  observer=new MutationObserver(()=>{
   if(host.isConnected){if(!container?.isConnected)observer?.disconnect();return;}
   observer?.disconnect();
   if(!container||document.querySelector('.swal2-container'))return;
   // SweetAlert's public close() needs a connected container to undo body/ARIA/keyboard state.
   container.style.visibility='hidden';document.body.append(container);
   Swal.update({hideClass:{popup:'',backdrop:''}});Swal.close();
  });
  observer.observe(document.body,{childList:true,subtree:true});
 },didDestroy:()=>observer?.disconnect()});}catch(error){observer?.disconnect();throw error;}
}

export async function successAlert(text='บันทึกข้อมูลสำเร็จ'){
 if(typeof document==='undefined')return;
 await fire({icon:'success',title:text,timer:1500,timerProgressBar:true,showConfirmButton:false,allowOutsideClick:false,allowEscapeKey:false,returnFocus:false,customClass:{popup:'pos-alert'},heightAuto:false});
}
export async function warningAlert(text:string){
 if(typeof document==='undefined'||!text)return;
 await fire({icon:'warning',title:'ดำเนินการไม่สำเร็จ',text,confirmButtonText:'ตกลง',returnFocus:false,customClass:{popup:'pos-alert'},heightAuto:false});
}
export async function confirmAlert(text='ยืนยันการเปลี่ยนแปลงข้อมูลนี้หรือไม่?',deleting=false){
 if(typeof document==='undefined')return true;
 const result=await fire({icon:'warning',title:deleting?'ยืนยันการลบข้อมูล':'ยืนยันการเปลี่ยนแปลง',text,showCancelButton:true,confirmButtonText:deleting?'ลบข้อมูล':'ยืนยัน',cancelButtonText:'ยกเลิก',focusCancel:true,returnFocus:false,customClass:{popup:'pos-alert'},heightAuto:false});
 return result?.isConfirmed??false;
}
