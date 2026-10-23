import {useMemo,useState,useRef} from 'react';
// Async print results belong to the view that initiated them, even after navigation back.
export function useViewNotice(viewKey:string):[string,(message:string)=>void]{
 const view=useMemo(()=>Symbol(viewKey),[viewKey]);
 const active=useRef(view);active.current=view;
 const [notice,setNotice]=useState<{view:symbol;message:string}|null>(null);
 return [notice?.view===view?notice.message:'',message=>{if(active.current===view)setNotice({view,message});}];
}
