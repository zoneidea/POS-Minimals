import {renderToString} from 'react-dom/server';
import {LandingPage} from './LandingPage';
import {landingTitle,landingDescription,structuredData,shareImage,siteUrl} from './content';
export function renderLanding(){return renderToString(<LandingPage/>);}
export {landingTitle,landingDescription,structuredData,shareImage,siteUrl};
