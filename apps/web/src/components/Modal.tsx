import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const titleId=useId();
 useEffect(()=>{
  const element=dialog.current;
  const previous=document.activeElement;
  element?.showModal();
  return()=>{element?.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus();};
 },[]);
 return <dialog ref={dialog} className="modal" aria-labelledby={titleId} aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <div className="modal-header"><h2 id={titleId}>{title}</h2><button type="button" className="secondary" aria-label="ปิดหน้าต่าง" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true"/></button></div>
  {children}
 </dialog>;
}
