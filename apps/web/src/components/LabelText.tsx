import type {ReactNode} from 'react';
export function LabelText({children,required=false}:{children:ReactNode;required?:boolean}){
 return <span className="label-text">{children}{required?<span className="required-mark" aria-hidden="true"> *</span>:null}</span>;
}
