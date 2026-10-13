import { createRoot } from 'react-dom/client';
import App from './App';
import { WebAnalytics } from './features/analytics/WebAnalytics';
import './style.css';
import './theme.css';
import './buttons.css';
createRoot(document.getElementById('root')!).render(<><App/><WebAnalytics/></>);
