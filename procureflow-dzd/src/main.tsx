import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Une nouvelle version est disponible. Voulez-vous recharger ?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

// Gracefully silence known upstream Firebase Auth 12.x popup assertion edge cases & offline notices
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason && typeof reason === 'object' && 'message' in reason ? reason.message : String(reason || ''));
    if (
      msg.includes('INTERNAL ASSERTION FAILED') ||
      msg.includes('Pending promise was never set') ||
      msg.includes('popup-closed-by-user') ||
      msg.includes('cancelled-popup-request') ||
      msg.includes('Failed to get document because the client is offline') ||
      msg.includes('client is offline') ||
      msg.includes('offline')
    ) {
      event.preventDefault();
      console.warn('Silenced Firebase offline/auth event:', msg);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('INTERNAL ASSERTION FAILED') ||
      msg.includes('Pending promise was never set') ||
      msg.includes('popup-closed-by-user') ||
      msg.includes('Failed to get document because the client is offline') ||
      msg.includes('client is offline') ||
      msg.includes('offline')
    ) {
      event.preventDefault();
      console.warn('Silenced Firebase offline/auth assertion error:', msg);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

