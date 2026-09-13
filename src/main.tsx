import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against unhandled benign WebSocket close errors in sandboxed iframe environment
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e?.message && (e.message.includes('WebSocket') || e.message.includes('closed without opened'))) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (e?.reason?.message && (e.reason.message.includes('WebSocket') || e.reason.message.includes('closed without opened'))) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
