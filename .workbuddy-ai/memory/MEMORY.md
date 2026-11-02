# MEMORY.md — Conventions durables du projet RentFlow Africa

## Produit

**RentFlow Africa** — SaaS multi-tenant de gestion locative pour l'Afrique francophone.
Propriétaires, agences, gestionnaires, comptables, agents, locataires. Interface et documentation
en **français**. Objectif : produit commercialisable, pas une démo.

## Stack imposée

- Front : React 19, Vite, Tailwind, shadcn/ui, React Router, React Hook Form, Zod,
  TanStack Query, Recharts, Lucide.
- Back : Node 22, Express, Mongoose/MongoDB, Socket.IO, REST `/api/v1`.
- Sécurité : JWT accès court + refresh rotatif, Argon2id, RBAC, rate limiting, Helmet, CORS
  allowlist, sanitation MongoDB, audit logs.

## Monorepo

- npm workspaces : `apps/api`, `apps/web`, `packages/shared`.
- `@rentflow/shared` est consommé via `dist` → **doit être compilé avant les apps**.
  Des hooks `predev`/`prebuild`/`pretypecheck`/`pretest` dans le `package.json` racine s'en chargent.
- TypeScript strict, `moduleResolution: NodeNext` (API) / `Bundler` (web),
  `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
  → utiliser `import type` pour les types, et des spreads conditionnels pour les props optionnelles.
- Prettier (singleQuote, semi, printWidth 100). `npm run format` avant de conclure.

## Règles d'architecture à ne jamais enfreindre

1. **Isolation multi-tenant** : toute collection d'organisation porte `organizationId` ; chaque
   lecture/écriture/suppression/agrégation/export inclut le scope. Le client ne peut jamais
   imposer le scope (jamais d'`organizationId` accepté depuis le body).
2. **RBAC centralisé** : catalogue unique dans `packages/shared/src/constants/`. Les routes
   déclarent `requirePermission('domaine.action')` ; jamais de nom de rôle en dur dans la logique.
3. **Montants** : entiers en unités mineures + code devise ISO 4217. Attention : **XOF/XAF ont
   0 décimale** (voir `minorUnitExponent` dans `apps/web/src/lib/format.ts`). Jamais de flottant.
4. **Dates** : persistées en UTC, affichées dans le fuseau de l'organisation.
5. **Erreurs** : enveloppe stable `{ success: false, error: { code, message, details?, requestId } }`,
   pendant du succès `{ success: true, data, meta?, requestId }`. Émises uniquement par
   `apps/api/src/common/http.ts` (`sendSuccess`/`sendError`) — jamais de `res.json` à la main.
   Jamais de stack ni de détail interne en production.
6. **Audit** : append-only, distinct des logs techniques ; les écritures financières sont
   immuables (corrections par écritures compensatoires).
7. **Configuration** : `apps/api/src/config/env.ts` est le **seul** module autorisé à lire
   `process.env`. Le reste consomme `AppConfig` (`config/index.ts`), gelé en profondeur.
   Ajouter une variable = l'ajouter au schéma Zod **et** à `.env.example`.
8. **Secrets** : aucun secret dans le code ni dans un `VITE_*` (public dans le bundle).
   Le serveur refuse de démarrer sur secret faible, identique, ou resté à sa valeur d'exemple.

## Environnement de développement (poste Windows)

- **Les commandes npm longues reçoivent un SIGTERM en avant-plan** dans cet environnement.
  Lancer `npm run typecheck|test|build|verify` avec `run_in_background: true`, ou rediriger la
  sortie vers un fichier (`> /tmp/out.txt 2>&1`) pour ne pas perdre le diagnostic.
- `npm install` peut rester bloqué plusieurs minutes **après** avoir écrit les paquets : vérifier
  la présence dans `node_modules` avant de conclure à un échec, et déclarer la dépendance dans le
  `package.json` du workspace concerné si l'installation a été interrompue.
- Pas de Docker ni de `mongod` disponibles sur ce poste : les tests d'intégration base de données
  ne peuvent pas être exécutés ici. La logique de sécurité doit rester testable en unitaire.
- `rm -f` peut être SIGTERM'd : utiliser `node -e "fs.rmSync(p,{force:true})"` à la place.

## Honnêteté de statut (exigence explicite du client)

Ne jamais annoncer une fonctionnalité comme terminée si elle ne l'est pas. Les écrans non
implémentés affichent un état vide explicite ou un placeholder — **aucune donnée de démonstration
présentée comme réelle**. Les middlewares non implémentés refusent explicitement plutôt que de
laisser passer.

## Pièges connus

- `pino-http` en ESM : `import { pinoHttp } from 'pino-http'`.
- `cors({ origin: 'https://x' })` (chaîne) envoie l'en-tête ACAO à toutes les origines →
  utiliser un **tableau** d'origines autorisées.
- `express-mongo-sanitize` + Express 4 : ok. Ne pas construire de requête Mongo depuis un objet
  utilisateur non validé.
- Vitest sur cette machine : cold start lent ; lancer les commandes longues en arrière-plan.

## Roadmap (état)

- Milestone 0 (fondations) : **livré**.
- Milestone 1 : identité, organisations, memberships, refresh tokens, RBAC appliqué, audit.
- Milestone 2 : parc immobilier, locataires, baux. Milestone 3 : finance.
- Milestone 4 : maintenance et communication. Milestone 5 : production, SaaS, PWA/offline.
