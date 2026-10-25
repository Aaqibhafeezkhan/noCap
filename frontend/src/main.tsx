import ReactDOM from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

// On macOS the Electron window hides its title bar; the header leaves room for the traffic lights.
const ua = navigator.userAgent;
if (ua.includes('Electron') && ua.includes('Macintosh')) document.documentElement.classList.add('is-electron');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
