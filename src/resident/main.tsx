import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/styles/app.css';
import { bindPrefsToDocument } from '@/shared/state/prefs';
import { Providers } from './Providers';
import { App } from './App';

bindPrefsToDocument();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);

// Offline shell. Production only, so development is never served stale files.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
