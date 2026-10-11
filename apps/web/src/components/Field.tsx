import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; icon: LucideIcon };
export function Field({ label, icon: Icon, id, type, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return <label className="field" htmlFor={id}><span>{label}</span><div className="input-wrap"><Icon size={18} aria-hidden="true"/><input {...props} id={id} type={type === 'password' && visible ? 'text' : type}/>{type === 'password' ? <button type="button" className="reveal" aria-label={visible ? `ซ่อน${label}` : `แสดง${label}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button> : null}</div></label>;
}
