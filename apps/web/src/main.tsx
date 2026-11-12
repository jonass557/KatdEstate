import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './app/service-worker';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener(
    'wheel',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && !(e.target instanceof Element && e.target.closest('.gm-style'))) {
        e.preventDefault();
      }
    },
    { passive: false },
  );
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
    }
  });
  for (const evt of ['gesturestart', 'gesturechange', 'gestureend'] as const) {
    document.addEventListener(
      evt,
      (e) => {
        if (!(e.target instanceof Element && e.target.closest('.gm-style'))) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Élément #root introuvable : impossible de monter RentFlow Africa.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
