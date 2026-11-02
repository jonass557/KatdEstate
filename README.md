# KadtEstate

Plateforme SaaS professionnelle de **gestion immobilière, locative, foncière, marketplace et chefferie traditionnelle**, conçue avec une architecture modulaire et évolutive pour l'Afrique francophone (UEMOA / CEMAC) et l'international.

> **État du projet :**
> - **Gestion Immobilière & Locative** : Baux, échéances, loyers, quittances PDF, comptabilité, charges, maintenance et portails dédiés (Locataire, Propriétaire, Gestionnaire).
> - **Marketplace Immobilière & Module Agents** : Annonces certifiées, profils d'agents, visites, offres et commissions.
> - **Recensement & Sécurité Quartier** : Découpage territorial (villes, arrondissements, quartiers, blocs), recensement avec QR codes et identifiant unique, signalements sécurisés d'incidents.
> - **Chefferie & Foncier** : Ventes de maisons, locations avec horaires officiels (05h-22h), ventes de terrains, certificats officiels infalsifiables avec sceaux et vérification publique QR, gestion automatique des commissions.
> - **Déploiement Automatisé** : Préconfiguré pour **Render** (API Backend) et **Vercel** (Frontend Web).
> - **Base de données & Médias** : Connecté à **MongoDB Atlas** et **Cloudinary**.
> Consultez le fichier [PROJECT_STATUS.md](PROJECT_STATUS.md) pour les détails d'implémentation et [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) pour le déploiement en ligne.

### Documentation de référence
- [Architecture technique](docs/ARCHITECTURE.md)
- [Exigences produit (PRD)](docs/PRODUCT_REQUIREMENTS.md)
- [Schéma de base de données](docs/DATABASE_SCHEMA.md)
- [Spécifications d'API](docs/API_SPECIFICATION.md)
- [Sécurité & Conformité](docs/SECURITY.md)
- [Feuille de route (Roadmap)](docs/ROADMAP.md)

---

## 1. Ce dont vous avez besoin

| Outil       | Version        | Pourquoi                                                         |
| ----------- | -------------- | ---------------------------------------------------------------- |
| **Node.js** | **22 ou plus** | Le projet utilise `process.loadEnvFile()` et les workspaces npm. |
| **npm**     | 10 ou plus     | Livré avec Node 22.                                              |
| **MongoDB** | 7 ou plus      | La base de données. Docker est le moyen le plus simple.          |
| **Docker**  | optionnel      | Uniquement pour lancer MongoDB sans l'installer.                 |

Vérifiez votre version de Node :

```bash
node --version   # doit afficher v22.x.x ou plus
```

Si votre version est trop ancienne, installez Node 22 depuis
[nodejs.org](https://nodejs.org/) ou utilisez `nvm` (le fichier `.nvmrc` est fourni :
`nvm use`).

---

## 2. Installation, étape par étape

### Étape 1 — Récupérer le projet et installer les dépendances

```bash
cd immoNova
npm install
```

> Cette commande installe les trois espaces de travail (`apps/api`, `apps/web`,
> `packages/shared`) en une seule fois. C'est le principe des _npm workspaces_.

### Étape 2 — Créer votre fichier de configuration

Le projet a besoin d'un fichier `.env` **à la racine**. Il n'est pas versionné, car il
contient des secrets.

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows (CMD)
copy .env.example .env
```

### Étape 3 — Générer les deux secrets

Le serveur **refuse de démarrer** si les secrets sont absents, trop courts, identiques,
ou laissés à leur valeur d'exemple. Générez-en deux différents :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Lancez la commande **deux fois**, puis collez les deux résultats dans `.env` :

```ini
JWT_ACCESS_SECRET=le-premier-resultat
JWT_REFRESH_SECRET=le-second-resultat
```

### Étape 4 — Démarrer MongoDB

**Option A — avec Docker (recommandé, rien à installer d'autre) :**

```bash
npm run db:up      # démarre MongoDB 7 sur 127.0.0.1:27017
npm run db:check   # vérifie que la connexion fonctionne
```

**Option B — avec un MongoDB déjà installé sur votre machine :**

Assurez-vous que le service écoute sur `127.0.0.1:27017`, puis :

```bash
npm run db:check
```

**Option C — MongoDB Atlas (cloud, gratuit) :**

Créez un cluster sur [mongodb.com/atlas](https://www.mongodb.com/atlas), puis remplacez
`MONGODB_URI` dans `.env` par la chaîne de connexion fournie.

### Étape 5 — Lancer le projet

```bash
npm run dev
```

Deux serveurs démarrent en parallèle :

| Service       | Adresse                 | Rôle                     |
| ------------- | ----------------------- | ------------------------ |
| API           | <http://localhost:4000> | Backend REST + Socket.IO |
| Interface web | <http://localhost:5173> | Application React        |

Ouvrez <http://localhost:5173> dans votre navigateur.

### Étape 6 — Vérifier que tout fonctionne

Dans un autre terminal :

```bash
curl http://localhost:4000/api/health
```

Réponse attendue lorsque la base est joignable :

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "rentflow-api",
    "dependencies": { "database": { "connected": true } }
  },
  "requestId": "req_..."
}
```

---

## 3. Commandes disponibles

Toutes les commandes s'exécutent **depuis la racine** du projet.

### Développement

| Commande                 | Effet                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| `npm run dev`            | Lance l'API et l'interface web en parallèle, avec rechargement automatique. |
| `npm run api:dev`        | Lance uniquement l'API.                                                     |
| `npm run api:dev:pretty` | Idem, avec des journaux lisibles par un humain.                             |
| `npm run web:dev`        | Lance uniquement l'interface web.                                           |

### Base de données

| Commande           | Effet                                                    |
| ------------------ | -------------------------------------------------------- |
| `npm run db:up`    | Démarre MongoDB via Docker.                              |
| `npm run db:down`  | Arrête MongoDB.                                          |
| `npm run db:check` | Diagnostique la connexion MongoDB et affiche la latence. |

### Qualité et vérification

| Commande               | Effet                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `npm run lint`         | Analyse statique (ESLint) sur les trois espaces de travail.                         |
| `npm run format`       | Formate le code avec Prettier.                                                      |
| `npm run format:check` | Vérifie le formatage sans modifier les fichiers.                                    |
| `npm run typecheck`    | Vérifie les types TypeScript.                                                       |
| `npm test`             | Lance tous les tests.                                                               |
| `npm run verify`       | **Enchaîne tout** : format, lint, types, tests, build. À lancer avant de committer. |

### Production

| Commande              | Effet                                                               |
| --------------------- | ------------------------------------------------------------------- |
| `npm run build`       | Compile l'API (`apps/api/dist`) et l'interface (`apps/web/dist`).   |
| `npm start`           | Démarre l'API compilée. **Nécessite `npm run build` au préalable.** |
| `npm run web:preview` | Sert localement l'interface compilée, pour vérifier le rendu final. |

---

## 4. Organisation du dépôt

Le projet est un **monorepo** : trois paquets qui partagent un même dépôt et un même
`package-lock.json`.

```text
immoNova/
├── apps/
│   ├── api/                    # Backend — Node.js, Express, MongoDB, Socket.IO
│   │   └── src/
│   │       ├── config/         #   Configuration centralisée et validée
│   │       ├── common/         #   Utilitaires transverses (erreurs, HTTP, logs, jetons)
│   │       ├── middleware/     #   Sécurité, erreurs, validation, rate limiting
│   │       ├── modules/        #   Un dossier par domaine métier
│   │       ├── db/             #   Connexion MongoDB
│   │       ├── routes/         #   Routeur de l'API versionnée
│   │       ├── scripts/        #   Scripts de diagnostic
│   │       ├── app.ts          #   Construction de l'application (testable)
│   │       └── server.ts       #   Démarrage du serveur
│   └── web/                    # Frontend — React, Vite, Tailwind, TanStack Query
│       └── src/
│           ├── app/            #   Providers (thème, session, organisation, permissions)
│           ├── components/     #   Composants réutilisables, dont shadcn/ui
│           ├── layouts/        #   Coquille de l'application (barre latérale, en-tête)
│           ├── lib/            #   Client API, formatage, navigation
│           └── pages/          #   Écrans
├── packages/
│   └── shared/                 # Contrats partagés : rôles, permissions, schémas Zod, types
├── .env.example                # Modèle de configuration (à copier vers .env)
├── ARCHITECTURE.md             # Décisions d'architecture
├── DATABASE_SCHEMA.md          # Modèle de données
├── API_SPECIFICATION.md        # Contrat de l'API
├── SECURITY.md                 # Politique de sécurité
└── ROADMAP.md                  # Jalons et état d'avancement
```

**Pourquoi `packages/shared` ?** Les schémas de validation et le catalogue de permissions
y sont définis **une seule fois**, puis importés par l'API et par l'interface. Une règle ne
peut donc pas diverger entre le client et le serveur.

---

## 5. Format des réponses de l'API

Toutes les réponses partagent la même enveloppe. Le client n'a jamais besoin d'inspecter
le code HTTP pour savoir quoi faire.

**Succès :**

```json
{
  "success": true,
  "data": { "…": "…" },
  "meta": { "page": 1, "pageSize": 20, "total": 42, "hasNextPage": true },
  "requestId": "req_1f2e…"
}
```

**Erreur :**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La requête est invalide.",
    "details": [{ "path": "email", "message": "Adresse e-mail invalide" }],
    "requestId": "req_1f2e…"
  }
}
```

Codes d'erreur : `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.

`requestId` est également renvoyé dans l'en-tête `X-Request-Id`. **Conservez-le** quand
vous signalez un problème : il permet de retrouver la trace exacte dans les journaux.

---

## 6. Sécurité — règles à ne jamais enfreindre

1. **Aucun secret dans le code.** Tout passe par `.env`, jamais committé.
2. **Aucune donnée d'une organisation accessible à une autre.** Chaque requête est
   filtrée par `organizationId`, vérifié côté serveur.
3. **Le navigateur n'est jamais une autorité.** Masquer un bouton est du confort ;
   l'API revalide systématiquement les permissions.
4. **Les secrets ne vont jamais dans les journaux.** La liste de censure est dans
   `apps/api/src/common/logger.ts`.
5. **Aucun `VITE_*` ne doit contenir de secret** : ces variables sont publiques.

---

## 7. En cas de problème

### « Configuration invalide » au démarrage

Le message liste précisément les variables fautives. Vérifiez que `.env` existe bien
**à la racine** et que les deux secrets sont renseignés et différents.

### « MongoDB injoignable »

```bash
npm run db:check
```

Ce script indique si MongoDB répond. En développement, l'API démarre quand même et
`/api/health` renvoie alors `503` avec la cause exacte — c'est volontaire, pour vous
laisser diagnostiquer sans bloquer.

### Le port 4000 ou 5173 est déjà utilisé

Modifiez `PORT` dans `.env` pour l'API, ou `server.port` dans `apps/web/vite.config.ts`
pour l'interface.

### L'interface affiche « Mode aperçu »

Cela signifie que l'API d'identité n'est pas joignable, ou que les routes `/auth/*` ne
sont pas encore déployées (c'est le cas aujourd'hui). L'interface reste explorable et le
bandeau le signale explicitement — aucune session réelle n'est ouverte.

### `npm run typecheck` échoue avec « Cannot find module '@rentflow/shared' »

Le paquet partagé doit être compilé en premier :

```bash
npm run build --workspace @rentflow/shared
```

Les scripts `predev`, `prebuild`, `pretypecheck` et `pretest` s'en chargent
automatiquement ; cette commande n'est utile qu'en cas d'exécution manuelle.

### Repartir de zéro

```bash
npm run clean
rm -rf node_modules
npm install
```

---

## 8. Documentation

| Fichier                                            | Contenu                                                  |
| -------------------------------------------------- | -------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)                 | Architecture, RBAC, multi-tenant, état d'implémentation. |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)           | Collections, relations, index.                           |
| [API_SPECIFICATION.md](API_SPECIFICATION.md)       | Contrat détaillé des routes.                             |
| [SECURITY.md](SECURITY.md)                         | Politique de sécurité et menaces couvertes.              |
| [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | Périmètre fonctionnel.                                   |
| [ROADMAP.md](ROADMAP.md)                           | Jalons et travail restant.                               |
