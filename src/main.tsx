import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { preloadQrLibrary } from './components/QrCodeSvg';
import './styles/app.css';
import './styles/print.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Warm up non-critical chunks once the browser is idle (after first paint)
const whenIdle = (cb: () => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(cb, { timeout: 3000 });
  } else {
    setTimeout(cb, 1500);
  }
};

whenIdle(() => {
  void preloadQrLibrary();
});

// Service worker: instant repeat visits + offline play (production only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration failures (e.g. private mode)
    });
  });
}
