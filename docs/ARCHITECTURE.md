# Architecture — DOMORA

## Objectifs et périmètre

DOMORA est une plateforme SaaS professionnelle multi-tenant de gestion immobilière et locative destinée principalement à l'Afrique francophone (UEMOA / CEMAC), avec une architecture évolutive pour l'international. Les objectifs structurants sont l'isolation stricte des organisations, la sécurité par défaut, une expérience responsive et mobile-first, la traçabilité des opérations via audit logs immuables et une architecture modulaire hautement maintenable.

## Architecture générale

Monorepo npm workspaces : `apps/web` (SPA React 19 + Vite 6 + Tailwind), `apps/api` (API Node.js/Express + Mongoose) et `packages/shared` (types, constantes et schémas Zod partagés). MongoDB est la base de données principale. REST sous `/api/v1` est l'interface d'échange métier ; Socket.IO gère les notifications et événements temps réel.

```text
Navigateur/PWA ── HTTPS ──> React 19/Vite 6 ── REST /api/v1 ──> Express (Node 22) ──> MongoDB 7+
       │                             │                               │
       └──── Socket.IO ──────────────┴───────────────────────────────┘
                                      └── Stockage fichiers privé (AES-256 / S3)
```

## Frontend

React + TypeScript strict + Vite ; React Router pour le routage, TanStack Query pour l’état serveur, React Hook Form et Zod pour les formulaires, Tailwind CSS et shadcn/ui pour les composants accessibles, Recharts pour les visualisations et Lucide pour les icônes. Organisation par fonctionnalités (`features`) avec `app`, `routes`, `layouts`, `components`, `lib` et `styles`. Les appels réseau passent par un client commun ; les composants ne portent pas de logique d’accès aux données.

Les providers prévus couvrent Query, thème, session, organisation active et socket. Les protections de routes côté client améliorent l’UX, mais ne constituent jamais une frontière de sécurité : l’API revalide chaque demande.

## Backend

Node.js + TypeScript strict + Express, Mongoose et Socket.IO. `server.ts` initialise la configuration, la base et le serveur ; `app.ts` construit l’application de façon testable sans ouvrir de port. Les modules métier suivront les couches routes → middleware → controllers → services → repositories → modèles. Les controllers traduisent HTTP, les services appliquent règles métier et permissions, les repositories encapsulent les requêtes Mongo filtrées par organisation.

La configuration est validée au démarrage. Le middleware de sécurité est enregistré centralement : request ID, journalisation, limite de corps, sanitation des clés Mongo, Helmet, CORS allowlist, rate limits. Les routes ajoutent authentification, membership, permissions et validation avant contrôleur.

## MongoDB et relations

Les collections sont décrites dans [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md). Les utilisateurs sont globaux ; `memberships` relie utilisateurs et organisations. Les données de gestion immobilière appartiennent à une organisation via `organizationId`. Modèle partagé de collections recommandé pour le MVP, avec accès via repositories scoped. Relations fortes par ObjectId, références explicites et dénormalisation mesurée pour les vues fréquentes. Indexes composés préfixés par `organizationId` ; timestamps UTC ; montants stockés en unités mineures avec devise ISO. Les documents sont validés au niveau Zod/serveur et Mongoose, avec contraintes uniques composées.

## Authentification et sessions

JWT d’accès de courte durée, validé par l’API. Les refresh tokens sont opaques ou JWT avec `jti`, conservés uniquement sous forme hachée dans une session serveur, rotatifs, révocables, à durée limitée et protégés contre le rejeu. Les mots de passe sont hachés avec Argon2id. Pour navigateur, cookies `HttpOnly`, `Secure`, `SameSite` sont recommandés, avec protection CSRF adaptée. Les tokens bruts et secrets n’entrent jamais dans les logs. Voir [SECURITY.md](SECURITY.md).

## RBAC

Le catalogue est centralisé dans `packages/shared/src/constants/` et constitue l’unique source
de vérité :

- `roles.ts` — 7 rôles (`SUPER_ADMIN`, `ADMIN`, `OWNER`, `PROPERTY_MANAGER`, `ACCOUNTANT`,
  `AGENT`, `TENANT`), avec libellés, descriptions et distinction explicite entre rôles
  _plateforme_ (`SUPER_ADMIN`) et rôles _organisation_.
- `permissions.ts` — 73 permissions granulaires en convention `domaine.action`
  (`properties.create`, `payments.refund`, `reports.export`, `settings.manage`, …), regroupées
  par domaine, plus le mapping par défaut `DEFAULT_ROLE_PERMISSIONS`.

Fonctions utilitaires exportées : `permissionsForRole`, `resolvePermissions` (base du rôle ∪
autorisations supplémentaires − révocations, `SUPER_ADMIN` toujours complet), `hasPermission`,
`hasAnyPermission`, `hasAllPermissions`, `isPermission`, `permissionDomain`.

Les routes déclarent la permission exigée via `requirePermission('payments.refund')` ; les
contrôleurs ne répètent jamais un nom de rôle. Refus par défaut. `SUPER_ADMIN` suit une
frontière platform-admin explicite, séparée des accès d’organisation. Le mapping par défaut est
une politique documentée, jamais un substitut au contrôle serveur. Des rôles personnalisés par
organisation (collections `roles`/`permissions`) restent un incrément ultérieur.

## Multi-tenant

Une organisation est l’espace client. Un utilisateur peut rejoindre plusieurs organisations par `memberships`; l’organisation active est résolue depuis la route et vérifiée côté serveur. Toute collection appartenant à une organisation porte `organizationId`. Tout repository tenant-scoped reçoit ce scope explicitement et inclut `organizationId` dans chaque lecture, modification et suppression, y compris accès par identifiant. Les valeurs envoyées par le navigateur ne sont jamais une autorité de scope. Les événements Socket.IO vérifient membership/permission avant abonnement aux rooms `organization:{organizationId}:...`. Les tests doivent vérifier lectures, mutations, sockets et exports cross-tenant.

## API et temps réel

API REST versionnée `/api/v1`, JSON, pagination déterministe, erreurs uniformes, request ID. Contrats détaillés dans [API_SPECIFICATION.md](API_SPECIFICATION.md). Les opérations financières futures devront prendre en charge l’idempotence et une piste d’audit. Socket.IO ne remplace pas REST pour les mutations durables ; les notifications temps réel sont des signaux synchronisés avec les données persistées.

## Conventions de code

TypeScript strict, ESM cohérent, noms descriptifs, petites fonctions, validations à la frontière, erreurs typées, aucune donnée tenant sans scope explicite. Pas de logique métier dans route handlers ou composants UI. Les tests accompagnent services, repositories et middleware de sécurité. Les dépendances et leurs versions sont gérées par workspaces npm/lockfile. Les migrations et changements de schéma/index sont documentés et reproductibles.

## Erreurs et observabilité

Un middleware final transforme erreurs connues en enveloppe stable
`{ success: false, error: { code, message, details?, requestId } }`, sans stack ni détails
internes en production. Le pendant succès est `{ success: true, data, meta?, requestId }`.
Les deux ne sont produits que par `common/http.ts` (`sendSuccess`/`sendError`) : aucun
contrôleur ne sérialise sa réponse à la main, ce qui empêche la dérive du format.

Le middleware traduit automatiquement les familles d'erreur connues : `ZodError`,
JSON mal formé, `ValidationError` et `CastError` Mongoose, clé dupliquée MongoDB (11000),
puis `AppError` applicative. Toute erreur non reconnue devient un `INTERNAL_ERROR`
générique et est journalisée côté serveur.

Les logs structurés Pino ajoutent requestId, action, acteur pseudonymisé et organisation
quand disponible ; la liste `redact` exclut mots de passe, jetons, cookies, en-têtes
d'autorisation et secrets. Audit métier append-only distinct des logs techniques, avec
acteur, action, ressource, organisation, résultat et horodatage.

## Configuration centralisée

`config/env.ts` est le **seul** module autorisé à lire `process.env`. Il valide chaque
variable avec Zod puis `config/index.ts` en dérive un objet `AppConfig` **gelé en
profondeur**, seul objet consommé par le reste du code. Aucune couche métier n'accède donc
à une variable d'environnement non validée.

La validation est une frontière de sécurité : le démarrage échoue si un secret est absent,
fait moins de 32 caractères, est identique à l'autre secret, ou conserve une valeur
d'exemple en production. En production, `COOKIE_SECURE=true` et des origines HTTPS sont
également exigés. Les erreurs sont listées variable par variable.

Les fichiers `.env` sont chargés par `config/dotenv.ts` via `process.loadEnvFile()` (Node
22), sans dépendance externe. Les variables déjà présentes dans l'environnement ne sont
jamais écrasées : en production, ce sont celles injectées par la plateforme qui font foi.

## Frontend — session et autorisations

`app/session.tsx` détient l'état de session (`loading`, `authenticated`, `unauthenticated`,
`unavailable`). Le statut `unavailable` correspond à une API d'identité injoignable ou non
encore livrée (404) : l'interface passe alors en **mode aperçu** explicitement signalé, sans
jamais laisser croire à une session authentifiée.

`app/organization.tsx` mémorise l'organisation active ; `app/permissions.tsx` combine la
membership et l'organisation active pour exposer `useCan()`, en réutilisant
`resolvePermissions` du paquet partagé — la même fonction que côté API, donc aucune
divergence possible entre les deux.

`components/protected-route.tsx` protège les routes privées et
`components/role-guard.tsx` (`Can`, `RequirePermission`) gère les permissions. Ces garde-fous
sont du confort d'interface : l'API revalide systématiquement chaque requête.

Le client HTTP (`lib/api-client.ts`) est une instance Axios unique qui porte l'access token
en mémoire (jamais dans `localStorage`), rafraîchit la session une seule fois en cas de 401
puis rejoue la requête, et normalise toute erreur — y compris une panne réseau — en
`ApiError` typée.

## Tests

Vitest pour unités, Supertest pour HTTP, tests repository contre MongoDB de test isolé lorsque nécessaire, tests de composants avec Testing Library et parcours E2E (Playwright à sélectionner avant le MVP). Couvrir surtout auth, RBAC, isolation organisationnelle, paiements/idempotence, validation et erreurs. CI exécute format, lint, typecheck, tests et builds ; scans dépendances et tests sécurité avant déploiement.

## Fichiers

Métadonnées et fichiers conservés hors MongoDB dans stockage objet privé chiffré avec URL signées à durée courte, permissions contrôlées, limites de taille/type, inspection malware et audit. Le fournisseur, la région, les politiques de conservation et la résidence des données restent à décider avant l’implémentation.

## Notifications

Le domaine notifications persiste les notifications et préférences ; un mécanisme outbox/queue sera défini pour garantir le traitement asynchrone. Socket.IO signale les changements aux membres autorisés. Email, SMS, WhatsApp et push seront derrière des adaptateurs ; les fournisseurs et règles de consentement restent à sélectionner.

## Paiements

Le modèle distingue charges/factures, paiements, reçus et transactions de dépôt. Montants en unités mineures et devise explicite, mouvements append-only/traçables, clé d’idempotence sur création et traitement de webhooks vérifiés et rejouables sans double comptabilisation. Aucun fournisseur ni transfert de fonds n’est engagé dans cette phase ; voir questions ouvertes dans la roadmap.

## Déploiement et exploitation

Séparer environnements local, staging et production ; secrets injectés par gestionnaire de secrets, TLS, MongoDB géré avec sauvegardes chiffrées et tests de restauration, health/live et readiness, logs/metrics/alertes, CI/CD avec migrations contrôlées et stratégie de rollback. Déjà en place pour la CI : lockfile versionné et workflow `.github/workflows/ci.yml` exécutant `npm run verify` sur chaque push et pull request. Région, fournisseur cloud, RPO/RTO et exigences de résidence des données sont à décider. Ne pas considérer la fondation comme prête à la production avant durcissement, monitoring, restauration et tests de charge.

## Décisions architecturales

- npm workspaces pour une base simple à installer et déployer séparément.
- MongoDB partagé avec `organizationId` obligatoire et vérifié par repositories.
- memberships explicites pour autoriser plusieurs organisations par utilisateur.
- REST pour mutations/données durables, Socket.IO pour notifications/temps réel.
- Zod pour validation aux frontières et contrats partagés ; Mongoose comme validation/persistance complémentaire.
- React Query pour cache/état serveur.
- Pas de microservices avant besoin démontré.

## État d’implémentation de la fondation

**Livré et vérifié (compile, lint, tests et build passent) :**

- Configuration centralisée et validée au démarrage (`config/env.ts` + `config/index.ts`
  gelé), chargement `.env` sans dépendance, refus de démarrer sur secret faible, secret
  identique ou valeur d'exemple en production.
- Logger structuré avec redaction, gestion d'erreurs uniforme
  (`{ success, error: { code, message, details?, requestId } }`), request ID propagé.
- Middleware de sécurité HTTP (Helmet, CORS en allowlist, sanitation MongoDB, rate limits
  généraux/auth/sensibles configurable), validation par Zod.
- Health `GET /api/health`, `/api/health/live`, `/api/health/ready` (ping MongoDB réel) et
  alias versionnés `/api/v1/health*` ; script de diagnostic `npm run db:check`.
- Catalogue RBAC centralisé (rôles, 73 permissions, résolution, tests d'invariants).
- Shell web : providers, routeur dérivé du catalogue de navigation, sidebar responsive,
  drawer mobile, palette de commandes (Ctrl/Cmd+K), thème clair/sombre, toasts, dialogue de
  confirmation, états vides, squelettes, formatage monétaire tenant compte des devises sans
  décimales (XOF/XAF).
- Client HTTP Axios unique (token en mémoire, rafraîchissement sur 401 avec requête
  rejouée, normalisation des erreurs réseau), contexte d'authentification, écran de
  connexion relié au contrat partagé, chargement global, protection des routes privées
  (`ProtectedRoute`, `PublicOnlyRoute`) et garde de permissions (`Can`, `RequirePermission`).
- Manifeste PWA (`manifest.webmanifest`, favicon, `theme-color`) et service worker
  (`public/sw.js`) : cache du shell et des assets statiques, **jamais** des réponses d'API ;
  enregistré uniquement en production.
- Outillage : lockfile versionné (`npm ci` reproductible), CI GitHub Actions exécutant
  `npm run verify`, `.editorconfig`, `.nvmrc`, `docker-compose.yml` (MongoDB de développement),
  README d'installation pas à pas.

**Non implémenté — ne doit pas être présenté comme terminé :**

- Routes d'authentification serveur (`/auth/register`, `/auth/login`, `/auth/refresh`,
  `/auth/logout`, `/auth/me`). Le client les appelle déjà ; en leur absence, l'interface
  affiche un mode aperçu explicitement signalé. Les middlewares `authenticate` et
  `requireOrganizationMembership` refusent toujours explicitement.
- Modèles Mongoose et collections métier ; aucun CRUD.
- Paiements, documents, notifications externes, abonnements, IA, API publique.
- Rôles personnalisés par organisation, audit persistant (`audit` est un no-op documenté).
- Tests d'intégration base de données et parcours E2E (aucun modèle n'existe encore).
