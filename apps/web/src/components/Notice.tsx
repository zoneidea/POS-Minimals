import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
export function Notice({ children, success = false }: { children: React.ReactNode; success?: boolean }) { const Icon = success ? CircleCheck : CircleAlert; return <div className={`notice ${success ? 'success' : ''}`} role={success ? 'status' : 'alert'}><Icon size={20} aria-hidden="true"/><span>{children}</span></div>; }
export function Busy() { return <LoaderCircle size={20} className="spin" aria-label="กำลังดำเนินการ"/>; }
