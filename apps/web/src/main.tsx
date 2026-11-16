import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './app/service-worker';
import './index.css';

if (typeof window !== 'undefined') {
  const isMapElement = (el: unknown): boolean =>
    el instanceof Element && Boolean(el.closest('.gm-style') || el.closest('.leaflet-container'));

  window.addEventListener(
    'wheel',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && !isMapElement(e.target)) {
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
        if (!isMapElement(e.target)) {
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
