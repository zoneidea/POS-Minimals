import {useEffect,useRef} from 'react';
import {confirmAlert,successAlert,warningAlert} from '../lib/alerts';
import {authMessage} from '../lib/client';
export function DeleteConfirmation({text,remove,onDeleted,onCancel}:{text:string;remove:()=>Promise<unknown>;onDeleted:()=>void;onCancel:()=>void}){
 const started=useRef(false);
 useEffect(()=>{if(started.current)return;started.current=true;void(async()=>{if(!await confirmAlert(text,true)){onCancel();return;}try{await remove();await successAlert('ลบข้อมูลสำเร็จ');onDeleted();}catch(error){await warningAlert(authMessage(error));onCancel();}})();},[]);
 return null;
}
