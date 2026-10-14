import { Component,type ReactNode } from 'react';
import { Notice } from './Notice';
export class PageLoadBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<Notice>ไม่สามารถโหลดข้อมูลได้</Notice>:this.props.children;}
}
