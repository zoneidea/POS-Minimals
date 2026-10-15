import {Plus} from 'lucide-react';
import {faqItems} from './content';
export function FaqSection(){return <section id="faq" className="landing-faq"><div className="landing-container landing-faq-inner"><h2>คำถามที่พบบ่อย</h2><div>{faqItems.map(item=><details key={item.question}><summary>{item.question}<Plus size={20} aria-hidden="true"/></summary><p>{item.answer}</p></details>)}</div></div></section>;}
