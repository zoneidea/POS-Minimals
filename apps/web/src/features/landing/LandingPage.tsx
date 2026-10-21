import {BrandLogo} from '../../components/BrandLogo';
import type {ReactNode,MouseEventHandler} from 'react';
import {LandingHeader} from './LandingHeader';
import {LandingHero} from './LandingHero';
import {ProductTour} from './ProductTour';
import {PromptPaySection} from './PromptPaySection';
import {StoreModesSection} from './StoreModesSection';
import {GettingStarted} from './GettingStarted';
import {FaqSection} from './FaqSection';
import {AppFooter} from '../../components/AppFooter';
import './landing.css';
import './landing-brand.css';
export function LandingPage({dark=false,onToggle,authContent,register=false,onRegister,onLogin}:{dark?:boolean;onToggle?:()=>void;authContent?:ReactNode;register?:boolean;onRegister?:MouseEventHandler<HTMLAnchorElement>;onLogin?:MouseEventHandler<HTMLAnchorElement>}){return <div className="app landing-app" data-theme={dark?'dark':'light'}><a className="landing-skip" href="#main-content">ข้ามไปเนื้อหา</a><LandingHeader dark={dark} onToggle={onToggle} onLogin={onLogin}/><main id="main-content" className="landing-main"><LandingHero authContent={authContent} register={register} onRegister={onRegister} onLogin={onLogin}/><ProductTour/><PromptPaySection/><StoreModesSection/><GettingStarted onRegister={onRegister}/><FaqSection/></main><footer className="landing-footer"><div className="landing-container"><a href="/" aria-label="POSJung หน้าแรก"><BrandLogo/></a><span>ระบบขายหน้าร้านใช้ฟรีทุกฟังก์ชัน</span></div></footer><AppFooter/></div>;}
