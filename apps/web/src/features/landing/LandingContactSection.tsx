import {useEffect,useMemo,useState} from 'react';
import {ContactSection} from './ContactSection';
import {contactAvailable,createContactSender} from './contact-client';
export function LandingContactSection(){
 const [enabled,setEnabled]=useState(false),send=useMemo(()=>createContactSender(),[]);
 useEffect(()=>{let current=true;void contactAvailable().then(value=>{if(current)setEnabled(value);});return()=>{current=false;};},[]);
 return <ContactSection send={enabled?send:undefined}/>;
}
