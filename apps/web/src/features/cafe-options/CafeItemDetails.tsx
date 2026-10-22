import './cafe-options.css';
import type {CafeOptionSnapshot} from '@pos/contracts/cafe-options';
export function CafeItemDetails({item}:{item:{options?:CafeOptionSnapshot[];note?:string}}){return <>{item.options?.length?<small className="cafe-item-details">{item.options.map(o=>o.name).join(' · ')}</small>:null}{item.note?<small className="cafe-item-note">หมายเหตุ: {item.note}</small>:null}</>;}
