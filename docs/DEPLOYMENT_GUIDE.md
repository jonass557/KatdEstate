# Guide de Déploiement — KadtEstate (Render & Vercel)

Ce guide détaille les étapes simples pour déployer **KadtEstate** en production :
- **Backend (API Express + Node.js)** sur **Render**
- **Frontend (Application Web React + Vite)** sur **Vercel**
- **Base de données** sur **MongoDB Atlas**
- **Médias & Documents** sur **Cloudinary**

---

## 1. Déploiement du Backend sur Render

### Étape 1 : Créer le Web Service sur Render
1. Rendez-vous sur [dashboard.render.com](https://dashboard.render.com/) et connectez votre compte GitHub / GitLab.
2. Cliquez sur **New +** > **Web Service**.
3. Sélectionnez le dépôt `immoNova` (ou `kadtestate`).
4. Renseignez les paramètres suivants :
   - **Name** : `kadtestate-api` (ou le nom de votre choix)
   - **Region** : Frankfurt (EU) ou Oregon (US)
   - **Branch** : `main` (ou votre branche principale)
   - **Root Directory** : laissez vide (ou `.`)
   - **Runtime** : `Node`
   - **Build Command** :
     ```bash
     npm install --include=dev && npm run build --workspace @rentflow/shared
     ```
   - **Start Command** :
     ```bash
     npm run api:start
     ```
   - **Health Check Path** : `/api/health`

### Étape 2 : Variables d'environnement sur Render
Dans l'onglet **Environment** de votre Web Service Render, ajoutez les variables suivantes :

| Clé | Valeur recommandée | Note |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Active les optimisations de production |
| `PORT` | `10000` | Port par défaut de Render |
| `TRUST_PROXY` | `true` | Indispensable derrière le reverse proxy Render |
| `MONGODB_URI` | `mongodb+srv://valdeslando15_db_user:MvINlhq5Yzlf89Sx@katdestate.qm5oscp.mongodb.net/kadtestate?retryWrites=true&w=majority` | Connexion MongoDB Atlas |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `10000` | Timeout de connexion |
| `CLIENT_URL` | `https://votre-frontend.vercel.app` | **Important** : URL de votre frontend Vercel (CORS) |
| `JWT_ACCESS_SECRET` | *(Générez une chaîne aléatoire de 48+ caractères)* | Secret JWT d'accès |
| `JWT_REFRESH_SECRET` | *(Générez une autre chaîne aléatoire de 48+ caractères)* | Secret JWT de rafraîchissement |
| `JWT_ISSUER` | `kadtestate-api` | Émetteur des tokens |
| `JWT_AUDIENCE` | `kadtestate-web` | Destinataire des tokens |
| `COOKIE_SECURE` | `true` | Transmission HTTPS uniquement |
| `COOKIE_NAME` | `kadtestate_refresh` | Nom du cookie |
| `CLOUDINARY_CLOUD_NAME` | `dq2cw4tyo` | Cloud name Cloudinary |
| `CLOUDINARY_API_KEY` | `822762149564633` | API Key Cloudinary |
| `CLOUDINARY_API_SECRET` | `bcOpM_zkDSYScp1-9LsVkYNYuZE` | API Secret Cloudinary |
| `CLOUDINARY_FOLDER` | `kadtestate` | Dossier de stockage |

> [!TIP]
> Vous pouvez aussi utiliser le fichier [render.yaml](file:///c:/Users/DELL/Documents/immoNova/render.yaml) inclus dans le projet en créant un **Blueprint Instance** sur Render.

---

## 2. Déploiement du Frontend sur Vercel

### Étape 1 : Importer le projet sur Vercel
1. Rendez-vous sur [vercel.com](https://vercel.com/) et connectez votre compte Git.
2. Cliquez sur **Add New...** > **Project**.
3. Sélectionnez le dépôt `immoNova`.
4. Vercel détecte automatiquement la configuration grâce au fichier [vercel.json](file:///c:/Users/DELL/Documents/immoNova/vercel.json) à la racine :
   - **Framework Preset** : `Vite`
   - **Build Command** : `npm run build --workspace @rentflow/shared && npm run build --workspace @rentflow/web`
   - **Output Directory** : `apps/web/dist`

### Étape 2 : Variables d'environnement sur Vercel
Dans la section **Environment Variables** du projet Vercel :

| Clé | Valeur | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://kadtestate-api.onrender.com/api/v1` | URL publique de votre API Render suivie de `/api/v1` |

5. Cliquez sur **Deploy**.

---

## 3. Liaison Finale & Sécurité (CORS)

Une fois les deux services déployés :
1. Récupérez l'URL attribuée par Vercel (ex : `https://kadtestate.vercel.app`).
2. Dans le dashboard Render de l'API > **Environment**, mettez à jour `CLIENT_URL` avec votre URL Vercel exacte.
3. Sauvegardez : Render redémarrera automatiquement pour autoriser les requêtes CORS de votre site Vercel.
4. Ouvrez votre site Vercel : votre plateforme SaaS KadtEstate est désormais 100% opérationnelle en ligne !
