import 'sweetalert2/dist/sweetalert2.min.css';
import './alerts.css';
const load=async()=>{try{return (await import('sweetalert2')).default;}catch{return undefined;}};
const target=()=>document.querySelector<HTMLDialogElement>('dialog[open]')??document.body;
export async function successAlert(text='บันทึกข้อมูลสำเร็จ'){
 if(typeof document==='undefined')return;
 const Swal=await load();if(!Swal)return;
 await Swal.fire({target:target(),icon:'success',title:text,timer:1500,timerProgressBar:true,showConfirmButton:false,allowOutsideClick:false,allowEscapeKey:false,returnFocus:false,customClass:{popup:'pos-alert'},heightAuto:false});
}
export async function warningAlert(text:string){
 if(typeof document==='undefined'||!text)return;
 const Swal=await load();if(!Swal)return;
 await Swal.fire({target:target(),icon:'warning',title:'ดำเนินการไม่สำเร็จ',text,confirmButtonText:'ตกลง',returnFocus:false,customClass:{popup:'pos-alert'},heightAuto:false});
}
export async function confirmAlert(text='ยืนยันการเปลี่ยนแปลงข้อมูลนี้หรือไม่?',deleting=false){
 if(typeof document==='undefined')return true;
 const Swal=await load();if(!Swal)return false;
 const result=await Swal.fire({target:target(),icon:'warning',title:deleting?'ยืนยันการลบข้อมูล':'ยืนยันการเปลี่ยนแปลง',text,showCancelButton:true,confirmButtonText:deleting?'ลบข้อมูล':'ยืนยัน',cancelButtonText:'ยกเลิก',focusCancel:true,returnFocus:false,customClass:{popup:'pos-alert'},heightAuto:false});
 return result.isConfirmed;
}
