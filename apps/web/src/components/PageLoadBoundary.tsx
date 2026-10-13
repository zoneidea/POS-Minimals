import { Component,type ReactNode } from 'react';
import { Notice } from './Notice';
export class PageLoadBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<><Notice>โหลดหน้าไม่สำเร็จ กรุณาโหลดใหม่</Notice><button className="secondary" type="button" onClick={()=>window.location.reload()}>โหลดใหม่</button></>:this.props.children;}
}
