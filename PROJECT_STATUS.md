# KadtEstate (anciennement DOMORA) — État d'avancement du projet (PROJECT_STATUS.md)

Date de dernière mise à jour : 1er novembre 2026  
Statut global : **PROMPT 1/5, 2/5, 3/5, MODULE AGENTS/MARKETPLACE, RECENSEMENT/SÉCURITÉ ET MODULE CHEFFERIE/FONCIER : ENTIÈREMENT DÉVELOPPÉS, TESTÉS ET VALIDÉS**

---

## 1. Synthèse globale

**KadtEstate** (anciennement DOMORA) est une plateforme SaaS professionnelle multi-tenant de gestion immobilière, locative, marketplace, citoyenne et de chefferie traditionnelle conçue pour l'Afrique francophone (espace UEMOA / CEMAC avec devises sans décimales XOF/XAF, baux conformes aux réglementations locales, intégration des moyens de paiement mobiles) avec une architecture évolutive pour l'international. Connectée à Cloudinary pour la gestion centralisée des médias et documents.

Les modules majeurs développés et pleinement opérationnels comprennent :
1. **PROMPT 1/5 — Fondations, Architecture et Gestion Immobilière** : Monorepo, Auth avec Argon2/PBKDF2 & refresh tokens, multi-tenancy strict, rôles & permissions, parc immobilier (10 types de biens), bâtiments, logements, locataires et contrats de bail.
2. **PROMPT 2/5 — Finances, Opérations, Loyers & Trésorerie** : Échéanciers automatisés, gestion des loyers (mensuel, trimestriel, semestriel, annuel), pénalités de retard, cautions et dépôts de garantie, quittances et factures PDF, charges communes réparties, dashboard financier interactif (Recharts), exports XLSX/CSV.
3. **PROMPT 3/5 — Portails, Documents, Maintenance, Analytics Avancés & Intelligence Artificielle (KadtEstate AI)** :
   - **Portail Locataire** : Espace autonome dédié, consultation de bail, suivi des échéances, téléchargement de quittances et factures PDF, signalement de pannes avec photos et priorités, messagerie directe avec le gestionnaire ("Contacter mon gestionnaire"), isolation stricte inter-locataires.
   - **Portail Propriétaire** : Vue consolidée multi-immeubles, KPI de rendement (loyers perçus, dépenses, cashflow net, arriérés, taux d'occupation et recouvrement), décomposition financière par bien, suivi des baux actifs/expirants, audit des actions gestionnaires, téléchargement du rapport exécutif PDF.
   - **Gestion Documentaire Centralisée & Cloudinary** : Stockage par catégorie (Baux, Pièces, Titres, Factures, Reçus, Rapports, Maintenance, Photos), suivi du quota de stockage SaaS (Mo utilisés / limite de forfait), recherche textuelle, alertes d'expiration à 60 jours, archivage/restauration et suppression sécurisée.
   - **Système de Maintenance Immobilière** : Cycle de vie complet des tickets (Ouvert, Attribué, En cours, En attente, Résolu, Clos, Annulé), gestion des prestataires/artisans avec spécialités, estimation et coûts réels, liaison comptable automatique.
   - **Intelligence Artificielle KadtEstate AI** : Conseiller virtuel déterministe connecté aux données réelles de la base (zéro hallucination) + Générateur de courriers juridiques et relances d'impayés.
   - **Recherche Globale (Ctrl+K) & Messagerie Interne**.
4. **MODULE AGENTS IMMOBILIERS & MARKETPLACE IMMOBILIÈRE** :
   - **Nouveau Profil Utilisateur : Agent Immobilier** : Rôle professionnel étendu (`AGENT`), profils indépendants ou agence, expérience, spécialités, zone d'activité, évaluation, documents professionnels et statut de vérification.
   - **Abonnements Spécifiques aux Agents Immobiliers** : 4 formules configurables (`AGENT_FREE`, `AGENT_STARTER`, `AGENT_PRO`, `AGENT_BUSINESS`).
   - **Espace Propriétaire : Mes annonces & Mandats** : Publication directe ou délégation à un agent certifié, révocation immédiate de mandat.
   - **Marketplace Publique Certifiée (`/marketplace`) & Espace Agent (`/agent`)**.
5. **MODULE DE RECENSEMENT IMMOBILIER, GESTION DES QUARTIERS ET SÉCURITÉ COMMUNAUTAIRE (KADTESTATE QUARTIER)** :
   - Hiérarchie territoriale (villes, arrondissements, quartiers, blocs) et rôles sectoriels (`SUPER_ADMIN`, `NEIGHBORHOOD_LEADER`, `BLOCK_LEADER`, `RESIDENT`).
   - Identifiant cadastral unique `KE-[QUARTIER]-[BLOC]-[NUM]` et protection anti-doublon.
   - Sécurité communautaire et signalements confidentiels d'incidents.
   - Carte interactive et forfaits spécifiques pour responsables.
6. **MODULE CHEFFERIE TRADITIONNELLE, GESTION FONCIÈRE & CERTIFICATS OFFICIELS** :
   - **Enregistrement des Ventes de Maisons** : Historique complet, ancien propriétaire, acquéreur, prix de vente, calcul automatique du pourcentage revenant à la chefferie, montants perçus et restants.
   - **Gestion des Locations de Maisons & Horaires de Service** : Propriétaire, locataire, loyer, durée du bail, commission calculée automatiquement. Horaires officiels d'ouverture du service locatif : 05h00 - 22h00 avec badge de disponibilité en temps réel.
   - **Enregistrement des Ventes de Terrains (Foncier)** : Propriétaire initial, acquéreur, numéro de lot/parcelle, superficie ($m^2$), localisation, prix, calcul de commission foncière et traçabilité des riverains limitrophes (nord, sud, est, ouest).
   - **Générateur & Vérificateur de Certificats Officiels de Chefferie** : Certificats officiels infalsifiables avec numéro unique d'enregistrement, sceau officiel de la chefferie, QR code et code de vérification public à 16 caractères pour contrôle d'authenticité (`/api/v1/quartier/certificates/verify/:code`). Téléchargeable en PDF et imprimable.
   - **Configuration Automatique des Commissions** : Taux personnalisables par quartier/chefferie (ventes de maisons, locations, ventes de terrains), suivi des commissions générées vs encaissées et du solde restant.
   - **Tableau de Bord de Suivi de la Chefferie** : Vue consolidée multi-onglets des indicateurs clés (ventes de maisons, locations, terrains, volume total des transactions, commissions dues/encaissées/restantes, certificats délivrés).

---

## 2. Stack Technique Validée

### Frontend (`apps/web`)
- **ReactJS 19** avec **Vite 6** et **TypeScript 5.7**
- **Tailwind CSS** & **shadcn/ui** (Design moderne, responsive mobile/desktop, mode sombre/clair)
- **React Router 7** avec protection déclarative des routes basée sur les permissions (`RequirePermission`)
- **TanStack Query (React Query v5)** pour la synchronisation serveur, caching et mutations
- **React Hook Form** & **Zod** pour la validation stricte des formulaires
- **Lucide React** pour l'iconographie
- **Recharts** pour les tableaux de bord et visualisations graphiques
- **Build de production vérifié** : `tsc -b && vite build` s'exécute avec succès (`dist/` généré sans aucune erreur).

### Backend (`apps/api`)
- **Node.js (>= 22)** avec **Express.js** et **TypeScript**
- **MongoDB** & **Mongoose** avec schémas typés et indexation optimisée
- **Architecture modulaire REST API** (`/modules/*`, `/middleware/*`, `/common/*`)
- **Isolation stricte multi-tenant** garantie par injection et vérification systématique de `organizationId`
- **Sécurité HTTP** : Helmet, CORS en allowlist, limitation de débit (`rate-limiters`), gestion centralisée des erreurs (`AppError`), journalisation d'audit immuable (`AuditLog`).

### Shared (`packages/shared`)
- Schémas Zod partagés, types, rôles, permissions et statuts.
- Typage strict validé (`tsc -p packages/shared/tsconfig.json` exit 0, tests unitaires passés 11/11).

---

## 3. Conformité aux Exigences du PROMPT 3/5

| Module / Fonctionnalité | Description fonctionnelle | Statut |
| :--- | :--- | :---: |
| **Portail Locataire** | Profil, logement, contrat, échéances, quittances, factures PDF, signalement de maintenance avec photos, contact gestionnaire, notifications. | **Validé** |
| **Portail Propriétaire** | Vue consolidée multi-biens, logements occupés/vacants, revenus, dépenses, impayés, cashflow net, performances financières, journal d'audit gestionnaires, rapport PDF téléchargeable. | **Validé** |
| **Gestion Documentaire** | Bibliothèque centrale, classement par catégorie (10 catégories), suivi du quota stockage SaaS en Mo, recherche, alertes d'expiration, archivage, restauration, suppression sécurisée. | **Validé** |
| **Maintenance & Travaux** | Demandes d'intervention, priorités, artisans/prestataires, estimation et coût réel, validation des travaux et création automatique de la dépense dans le module financier. | **Validé** |
| **Analytics & Rapports** | Indicateurs calculés sur données réelles (taux d'occupation, revenus, charges, rentabilité par bien, taux de recouvrement, retards, coût moyen maintenance), exports PDF et tableurs. | **Validé** |
| **Intelligence Artificielle DOMORA AI** | Assistant conversationnel connecté à la base de données réelle (chiffres exacts), suggestions en 1 clic, générateur de lettres juridiques (mise en demeure 8 jours, relances, renouvellement). | **Validé** |
| **Recherche Globale (Ctrl+K)** | Recherche universelle en temps réel sur 10 types d'entités avec redirection instantanée. | **Validé** |
| **Messagerie Interne** | Échanges sécurisés catégorisés (Général, Paiement, Maintenance, Bail, Urgent) avec historique et réponses imbriquées. | **Validé** |

---

## 4. Résultats des Vérifications et Tests

```bash
# Typecheck et tests du paquet partagé
node ./node_modules/typescript/bin/tsc -p packages/shared/tsconfig.json
npx vitest run packages/shared
# -> Exit 0, 11 tests passed

# Tests unitaires et d'intégration web
npx vitest run apps/web
# -> Exit 0, 3 tests passed (formatage monétaire XOF sans décimale)

# Compilation TypeScript et Build de production Vite Web
npm run build --workspace @rentflow/web
# -> Exit 0 (tsc -b && vite build avec 2395 modules transformés, bundle optimisé en dist/ sans aucune erreur)
```
