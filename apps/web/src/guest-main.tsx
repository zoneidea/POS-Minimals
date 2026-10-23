import '@fontsource/prompt/thai-400.css';import '@fontsource/prompt/latin-400.css';import '@fontsource/prompt/thai-600.css';import '@fontsource/prompt/thai-700.css';
import {createRoot} from 'react-dom/client';import {GuestMenuPage} from './features/guest-orders/GuestMenuPage';import {guestEntry} from './features/guest-orders/client';
import './style.css';import './theme.css';import './buttons.css';import './reference-theme.css';
const root=createRoot(document.getElementById('guest-root')!);guestEntry().then(entry=>root.render(<GuestMenuPage {...entry}/>)).catch(e=>root.render(<main style={{padding:24,fontFamily:'Prompt,sans-serif'}}><h1>สั่งอาหารผ่าน QR</h1><p>{e instanceof Error?e.message:'กรุณาสแกน QR อีกครั้ง'}</p></main>));
