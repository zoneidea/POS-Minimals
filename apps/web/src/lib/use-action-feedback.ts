import {useState} from 'react';
import {successAlert,warningAlert} from './alerts';
export function useActionError(){const [error,set]=useState('');return [error,(value:string)=>{set(value);if(value)void warningAlert(value);}] as const;}
export function useActionSuccess(){return ['',(value:string)=>{if(value)void successAlert(value);}] as const;}
