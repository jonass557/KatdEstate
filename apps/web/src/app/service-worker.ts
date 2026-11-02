/**
 * Enregistre le service worker PWA — **en production uniquement**.
 *
 * En développement, un service worker interférerait avec le HMR de Vite et
 * masquerait les modifications de code. L'échec d'enregistrement est non
 * bloquant : l'application doit rester pleinement utilisable sans PWA.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('[RentFlow] Service worker non enregistré.', error);
    });
  });
}
