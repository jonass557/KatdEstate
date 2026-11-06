# Feuille de route (Roadmap) — DOMORA

## Principes de livraison

Chaque jalon (Prompt) livre des briques métier réelles, typées, testées et intégrées. L'isolation multi-tenant `organizationId`, la validation Zod, la journalisation d'audit immuable et la sécurité sont appliquées sans compromis à chaque étape.

---

## Jalon 1 (PROMPT 1/5) — Fondations & Gestion Immobilière (LIVRÉ & VALIDÉ)

- Architecture Monorepo workspaces (`apps/web`, `apps/api`, `packages/shared`).
- Documentation complète (`ARCHITECTURE.md`, `PRODUCT_REQUIREMENTS.md`, `DATABASE_SCHEMA.md`, `API_SPECIFICATION.md`, `SECURITY.md`, `ROADMAP.md`, `PROJECT_STATUS.md`).
- Authentification complète : inscription, connexion, déconnexion, refresh tokens avec rotation & familles, vérification email, réinitialisation et changement de mot de passe.
- Organisations & Multi-tenancy : isolation stricte par tenant, profil d'organisation étendu (logo, adresse, téléphone, email, pays, devises, langue, fuseau horaire, paramètres de notification et facturation).
- Rôles & Permissions : 7 rôles (`SUPER_ADMIN`, `ADMIN`, `OWNER`, `PROPERTY_MANAGER`, `ACCOUNTANT`, `AGENT`, `TENANT`), 73 permissions granulaires, middleware `requirePermission`.
- Parc immobilier : 10 types de biens (immeuble, maison, appartement, villa, studio, bureau, boutique, local commercial, terrain, autre), CRUD, filtres, recherche, archivage, export CSV.
- Hiérarchie Bâtiments & Logements : Organisation → Propriété → Bâtiment → Logement, 5 statuts, calcul du taux d'occupation et des revenus locatifs potentiels.
- Fiches locataires : profil complet, chiffrement des pièces d'identité (AES-256-GCM), contact d'urgence, documents.
- Contrats de bail : création, activation, renouvellement, résiliation, cycle de vie (brouillon, actif, bientôt expiré, expiré, résilié, renouvelé), export PDF, alertes d'expiration, chronologie d'événements.

---

## Jalon 2 (PROMPT 2/5) — Finances, Loyers & Trésorerie (LIVRÉ & VALIDÉ)

- Système complet de gestion des loyers : échéanciers mensuels, trimestriels, semestriels et annuels.
- Suivi précis : payés, impayés, partiellement payés, en retard, annulés.
- Moteur de pénalités de retard : application automatisée selon seuil de jours, période de grâce et taux.
- Gestion des cautions et dépôts de garantie : encaissement (RECEIVED), restitution (REFUNDED), déduction sur impayé (DEDUCTION).
- Historique financier par locataire : soldes restants, arriérés, échéances et paiements passés.
- Encaissements et paiements : partiels, multiples, référence unique, protection anti-doublon idempotente.
- Confirmation et circuit de paiement : validation des transactions en attente (Mobile Money MTN MoMo, Orange Money).
- Quittances de loyer et factures professionnelles : génération PDF et distribution par email / notification in-app.
- Gestion des dépenses et circuit de validation : entretien, rénovation, eau, électricité, salaires, impôts, validation (PENDING, APPROVED, REJECTED, PAID) et justificatifs.
- Répartition des charges communes entre locataires : parts égales ou au prorata des surfaces (m²).
- Tableau de bord financier & Trésorerie : KPI (revenus, dépenses, bénéfice net, taux de recouvrement, dettes locataires), graphiques Recharts (12 mois, catégories, rentabilité par bien, débiteurs), exports XLSX et CSV.
- Sécurité financière : isolation multi-tenant stricte, journal d'audit immuable, validation côté serveur.

---

## Jalon 3 (PROMPT 3/5) — Portails, Documents, Maintenance, Analytics & IA (LIVRÉ & VALIDÉ)

- **Portail Locataire autonome** : Tableau de bord personnel, consultation du bail actif, suivi des loyers et échéances, téléchargement des quittances et factures PDF, signalement d'incidents avec photos et priorités, messagerie directe avec le gestionnaire.
- **Portail Propriétaire professionnel** : Vue consolidée multi-immeubles, tableau de bord des rendements (taux d'occupation, loyers perçus, dépenses, cashflow net, arriérés), état détaillé par propriété, suivi des baux et des interventions, journal d'audit des actions gestionnaires, téléchargement du rapport exécutif PDF.
- **Gestion documentaire centrale** : Classement par 10 catégories (Baux, Pièces d'identité, Dossiers locataires, Propriétaires, Titres de propriété, Factures, Quittances, Rapports, Maintenance, Photos), suivi en temps réel de la jauge de stockage SaaS (Mo utilisés / forfait), recherche textuelle, alertes d'expiration à 60 jours, archivage, restauration et suppression sécurisée.
- **Système de maintenance immobilière complet** : Cycle de vie des tickets (Ouvert, Attribué, En cours, En attente, Résolu, Clos, Annulé), gestion des artisans et prestataires avec corps de métier, devis et coût réel, liaison comptable automatique (création automatique d'une dépense financière MAINTENANCE lors de la validation des travaux).
- **Analytics et rapports avancés** : Calculs dynamiques sur données réelles (taux d'occupation et vacance, revenus, charges, rentabilité nette par propriété, taux de recouvrement, délais moyens de maintenance), exports PDF et Excel.
- **Intelligence Artificielle DOMORA AI** :
  - Conseiller virtuel connecté en direct à la base de données (synthèse chiffrée exacte et fiable, sans risque d'hallucination de montants).
  - Générateur automatique de courriers officiels : relances pour impayés, rappels d'échéances, mise en demeure avec délai légal de 8 jours, proposition de renouvellement de bail, suivi de travaux avec copie en un clic.
- **Recherche universelle & Command Palette (Ctrl+K)** : Moteur de recherche global sur 10 types de ressources avec navigation instantanée.
- **Messagerie interne** : Échanges sécurisés et catégorisés entre locataires, propriétaires et gestionnaires.

---

## Jalon 4 (PROMPT 4/5) — Communication avancée, Intégrations & Comptabilité SYSCOHADA

- Passerelles de paiement Mobile Money en production (MTN MoMo, Orange Money, Wave) et webhooks sécurisés.
- Rapprochement bancaire et plan comptable SYSCOHADA révisé.
- Automatisations avancées et relances programmées (SMS / WhatsApp).

---

## Jalon 5 (PROMPT 5/5) — Optimisations PWA, Mode Hors-ligne & Mise en Production

- Optimisations PWA complètes, synchronisation hors-ligne avec cache IndexedDB.
- Monitoring de production, audit de sécurité et déploiement cloud final.

### Périmètre livré

- Dépôt Git et monorepo npm workspaces (`apps/api`, `apps/web`, `packages/shared`).
- Documentation architecture, produit, données, API, sécurité et roadmap.
- TypeScript strict, Prettier, ESLint, Vitest ; le paquet partagé est compilé avant les apps.
- API : **configuration centralisée** (`config/env.ts` valide, `config/index.ts` gelé, chargement
  `.env` via `process.loadEnvFile()` sans dépendance), logger Pino avec redaction, enveloppe de
  réponse uniforme `{ success, data | error }`, request ID, Helmet, CORS en allowlist,
  sanitation MongoDB, rate limits (général/auth/sensible) configurables, validation Zod,
  health `GET /api/health` (+ `live`/`ready`) avec ping MongoDB réel, script `npm run db:check`,
  Socket.IO préparatoire.
- Contrats partagés : rôles, catalogue de 73 permissions, schémas Zod d’auth et de pagination,
  types de réponse d’API (`success`, `ApiSuccess`, `ApiErrorBody`, `API_ERROR_CODES`).
- Web : providers (thème, cache, session, organisation, permissions, temps réel, toasts), routeur
  dérivé du catalogue de navigation avec routes protégées, shell responsive (sidebar, drawer
  mobile, topbar), palette de commandes (Ctrl/Cmd+K), thème clair/sombre, toasts, confirmation,
  états vides, squelettes, formatage monétaire adapté aux devises sans décimales, manifeste PWA
  et service worker.
- Web — couche données et session : client HTTP **Axios** unique (token en mémoire,
  rafraîchissement sur 401 avec rejeu, normalisation des erreurs réseau), contexte
  d’authentification, écran de connexion relié au contrat partagé, chargement global, protection
  des routes privées et garde de permissions (`Can`, `RequirePermission`).
- Outillage : lockfile versionné (`npm ci` reproductible), CI GitHub Actions exécutant
  `npm run verify`, `.editorconfig`, `.nvmrc`, `docker-compose.yml` pour MongoDB en local,
  README d’installation pas à pas pour un développeur débutant.

### Restant avant de clore le Milestone 0

- Routes d’authentification serveur (`/auth/*`) : le client les appelle déjà, l’interface affiche
  un mode aperçu explicite tant qu’elles sont absentes (middlewares `authenticate` /
  `requireOrganizationMembership` sont des refus explicites aujourd’hui).
- Tests d’intégration repository contre une MongoDB de test isolée (aucun modèle n’existe encore).

### Critères de sortie

Les workspaces installent, compilent et passent les contrôles (`npm run verify`) ; l’API expose
`/api/health` ; le web rend le shell navigable ; les invariants RBAC sont testés ; aucune capacité
métier n’est simulée comme terminée. **Vérifié** : format, lint, types, 42 tests (28 API, 3 web,
11 partagés) et build passent ; le serveur démarre et répond (`/api/health/live` → 200,
`/api/health` → 503 sans base, cause explicite).

## Milestone 1 — Identité et organisations

### Périmètre

Inscription/connexion, vérification email ou téléphone à décider, refresh rotation, logout, sessions, création d’organisation, invitations, memberships, sélection d’organisation, RBAC et audit.

### Sortie et sécurité

Tests token/rejeu/révocation, rate limit auth, changements de rôle, membership inactive, cross-tenant et récupération de compte. Décider transport refresh, MFA et fournisseur email/OTP.

## Milestone 2 — Opérations locatives

Propriétés, immeubles, unités, locataires, baux, disponibilité, portail initial et dashboard occupation. Ajouter validations, indexes, pagination, soft delete explicite et tests de droits par rôle.

## Milestone 3 — Finance

Échéanciers, appels/factures, paiements manuels, reçus, dépôts, dépenses, impayés, rapprochement et exports. Stocker montants mineurs/devise, idempotence et audit append-only. Décider pays, devises, fiscalité et fournisseurs avant paiements en ligne/mobile money.

## Milestone 4 — Maintenance et communication

Tickets, tâches, fournisseurs, compteurs, notifications internes, Socket.IO, email/SMS/WhatsApp/push via adaptateurs et préférences. Prévoir outbox/queue, consentement, retry contrôlé et observabilité.

## Milestone 5 — Production et SaaS

Abonnements/plans, limites d’usage, administration SaaS, API keys/webhooks, documents avec stockage objet privé, analytics, sauvegardes/restore drills, monitoring, tests de charge, sécurité applicative, CI/CD et disaster recovery.

## Après MVP

IA immobilière, API publique avancée, PWA offline ciblée, marketplace/intégrations et fonctionnalités multi-régions selon validation produit.

## Questions bloquantes à décider

- Pays de lancement, devises XOF/XAF/autres, langues, fiscalité et fuseaux.
- Utilisateur principal et profondeur des portails propriétaire/locataire.
- Permissions personnalisables ou rôle fixe par organisation.
- Email/password, téléphone/OTP, SSO et MFA.
- Refresh cookie navigateur et futurs clients mobiles.
- Paiement : manuel, mobile money, banque, carte ; rôle de RentFlow.
- Fournisseurs SMS, WhatsApp, email et notifications push.
- Documents/images, stockage objet, résidence et rétention.
- Cloud, MongoDB managé, région, RPO/RTO et budget.
- Terminologie canonique : organisation client versus locataire résident.

## Règle de statut

Un élément marqué planifié ou en cours n’est pas une fonctionnalité livrée. Les versions et décisions seront ajoutées ici au fur et à mesure des validations et tests.
