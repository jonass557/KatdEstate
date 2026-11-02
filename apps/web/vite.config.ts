import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En développement, l'interface appelle l'API via VITE_API_URL. Ce proxy
    // sert de repli pratique : il permet d'utiliser des chemins relatifs
    // (« /api/v1/... ») sans se soucier du port de l'API.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Objectif : qu'un visiteur ne télécharge pas Recharts et Socket.IO pour
    // afficher l'écran de connexion. Les dépendances stables sont isolées dans
    // des chunks séparés, mis en cache durablement par le navigateur, tandis que
    // le code applicatif reste dans le chunk principal — qu'on peut alors
    // revalider fréquemment sans invalider le cache des librairies.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    // Le seuil par défaut (500 kB) déclenche un avertissement alors que les
    // chunks sont ici volontairement répartis : on l'aligne sur le plus gros.
    chunkSizeWarningLimit: 700,
  },
});
