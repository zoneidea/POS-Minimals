import {useEffect,useState} from 'react';
import {Notice} from '../../components/Notice';
import './print-notice.css';
// Only print feedback expires; payment, order and validation errors stay visible.
export function PrintNotice({message,onDismiss}:{message:string;onDismiss?:()=>void}){
 const [visible,setVisible]=useState(message);
 useEffect(()=>{setVisible(message);if(!message)return;const timer=setTimeout(()=>{setVisible('');onDismiss?.();},2000);return()=>clearTimeout(timer);},[message,onDismiss]);
 return visible?<div key={message} className="print-notice"><Notice>{visible}</Notice></div>:null;
}
