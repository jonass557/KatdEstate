# Spécification API — DOMORA

## Principes

- Base : `https://api.domora.sn/api/v1` (local : `http://localhost:4000/api/v1`).
- JSON UTF-8 ; dates ISO-8601 UTC ; montants `{ amountMinor, currency }`.
- Chaque réponse retourne `requestId` et le header HTTP `X-Request-Id`.
- L’API n’accepte jamais `organizationId` comme autorité depuis le body ; le scope est issu de l’URL/session et de la membership vérifiée.
- Versions majeures explicites ; changements incompatibles dans `/api/v2`.

## Réponse et erreurs

Toute réponse porte un booléen `success` discriminant. Un client décide donc quoi faire
sans inspecter le code HTTP.

Succès collection :

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "hasNextPage": false },
  "requestId": "req_..."
}
```

Succès ressource :

```json
{
  "success": true,
  "data": { "id": "…" },
  "requestId": "req_..."
}
```

Erreur uniforme :

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La requête est invalide.",
    "details": [
      { "path": "email", "message": "Adresse e-mail invalide", "code": "invalid_string" }
    ],
    "requestId": "req_..."
  }
}
```

Codes : `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500, `SERVICE_UNAVAILABLE` 503. Les détails internes et stacks ne sortent pas en production.

Les réponses sont produites exclusivement par `sendSuccess`/`sendError`
(`apps/api/src/common/http.ts`) : aucun contrôleur ne construit son JSON à la main, ce qui
empêche la dérive du format.

Les erreurs connues sont traduites automatiquement par le middleware terminal :
`ZodError` → `VALIDATION_ERROR` (avec un `details` par champ), JSON mal formé →
`VALIDATION_ERROR`, `ValidationError` Mongoose → `VALIDATION_ERROR`, `CastError` →
`VALIDATION_ERROR`, clé dupliquée MongoDB (11000) → `CONFLICT`.

## Authentification

Access token court via `Authorization: Bearer <token>` pour clients autorisés. Pour SPA navigateur, refresh token recommandé en cookie HttpOnly Secure SameSite adapté. Les tokens sont renouvelés/rotés côté serveur. Le client envoie `X-Request-Id` optionnel ; le serveur le valide/génère et le retourne.

## Routes de fondation

Sondes d'infrastructure, **hors versionnement** (contrat stable et indépendant de l'API
métier) :

| Méthode | Route               | Auth | Description                                            |
| ------- | ------------------- | ---- | ------------------------------------------------------ |
| GET     | `/api/health`       | non  | Vue d'ensemble : `200` si la base répond, sinon `503`. |
| GET     | `/api/health/live`  | non  | Processus vivant. Ne touche aucune dépendance.         |
| GET     | `/api/health/ready` | non  | Instance prête à servir du trafic (base joignable).    |

`/api/v1/health`, `/api/v1/health/live` et `/api/v1/health/ready` restent exposés comme
alias versionnés. Les sondes effectuent un `ping` réel vers MongoDB : lire le seul état
déclaré renverrait « ok » alors que la base est devenue injoignable.

Routes opérationnelles livrées :

| Méthode | Route                                                      | Auth    | Permission           | Description                                                 |
| ------- | ---------------------------------------------------------- | ------- | -------------------- | ----------------------------------------------------------- |
| GET     | `/api/health`                                              | non     | aucune               | Sonde de santé avec ping MongoDB                            |
| POST    | `/api/v1/auth/register`                                    | non     | aucune               | Inscription utilisateur + création organisation initiale    |
| POST    | `/api/v1/auth/login`                                       | non     | aucune               | Connexion, délivrance token + refresh cookie                |
| POST    | `/api/v1/auth/refresh`                                     | refresh | aucune               | Rotation de session refresh token                           |
| POST    | `/api/v1/auth/logout`                                      | session | aucune               | Révocation de la session                                    |
| GET     | `/api/v1/auth/me`                                          | oui     | aucune               | Profil utilisateur & organisations rattachées               |
| POST    | `/api/v1/auth/request-password-reset`                      | non     | aucune               | Demande de réinitialisation de mot de passe                 |
| POST    | `/api/v1/auth/reset-password`                              | non     | aucune               | Validation réinitialisation de mot de passe                 |
| POST    | `/api/v1/auth/change-password`                             | oui     | aucune               | Changement de mot de passe pour utilisateur connecté        |
| POST    | `/api/v1/auth/verify-email`                                | non     | aucune               | Validation d'adresse email                                  |
| GET     | `/api/v1/organizations`                                    | oui     | aucune               | Liste des organisations de l'utilisateur                    |
| POST    | `/api/v1/organizations`                                    | oui     | aucune               | Création d'une organisation SaaS multi-tenant               |
| GET     | `/api/v1/organizations/:id`                                | oui     | organizations.view   | Paramètres complets d'une organisation                      |
| PATCH   | `/api/v1/organizations/:id`                                | oui     | organizations.update | Mise à jour des paramètres (logo, devises, biling, etc.)    |
| GET     | `/api/v1/organizations/:id/members`                        | oui     | users.view           | Liste des membres d'une organisation                        |
| POST    | `/api/v1/organizations/:id/members`                        | oui     | users.invite         | Invitation d'un nouveau membre                              |
| PATCH   | `/api/v1/organizations/:id/members/:memberId`              | oui     | users.manage         | Modification de rôle ou statut de membre                    |
| DELETE  | `/api/v1/organizations/:id/members/:memberId`              | oui     | users.remove         | Retrait d'un membre de l'organisation                       |
| GET     | `/api/v1/organizations/:id/properties`                     | oui     | properties.view      | Liste paginée des biens (10 types, filtres, recherche)      |
| POST    | `/api/v1/organizations/:id/properties`                     | oui     | properties.create    | Création d'un bien immobilier                               |
| GET     | `/api/v1/organizations/:id/properties/:propId/stats`       | oui     | properties.view      | Métriques du bien : taux occupation, loyers potentiels      |
| GET     | `/api/v1/organizations/:id/tenants/:tenantId/timeline`     | oui     | tenants.view         | Chronologie locataire (arrivée, bail, paiements, etc.)      |
| GET     | `/api/v1/organizations/:id/leases/:leaseId/pdf`            | oui     | leases.view          | Génération PDF du contrat de bail                           |
| GET     | `/api/v1/organizations/:id/rent-schedules`                 | oui     | rentSchedules.view   | Liste des échéances de loyers, filtrage statut              |
| PATCH   | `/api/v1/organizations/:id/rent-schedules/:schedId`        | oui     | rentSchedules.manage | Modification d'échéance (date, montant, pénalité) + audit   |
| POST    | `/api/v1/organizations/:id/rent-schedules/:schedId/cancel` | oui     | invoices.cancel      | Annulation motivée d'une échéance                           |
| POST    | `/api/v1/organizations/:id/rent-schedules/apply-penalties` | oui     | rentSchedules.manage | Calcul et application automatisée des pénalités de retard   |
| GET     | `/api/v1/organizations/:id/finance/summary`                | oui     | payments.view        | Synthèse loyers (attendu, encaissé, restant, en retard)     |
| GET     | `/api/v1/organizations/:id/finance/dashboard`              | oui     | payments.view        | Dashboard financier complet (Revenus, KPI, Recharts)        |
| GET     | `/api/v1/organizations/:id/finance/tenants/:tId/history`   | oui     | payments.view        | Historique financier complet d'un locataire                 |
| POST    | `/api/v1/organizations/:id/finance/split-charges`          | oui     | invoices.create      | Répartition charges communes (parts égales ou surface)      |
| GET     | `/api/v1/organizations/:id/payments`                       | oui     | payments.view        | Liste des paiements enregistrés, filtres mode et statut     |
| POST    | `/api/v1/organizations/:id/payments`                       | oui     | payments.create      | Encaissement partiel/total avec clé d'idempotence           |
| POST    | `/api/v1/organizations/:id/payments/:pId/confirm`          | oui     | payments.create      | Confirmation d'un paiement en attente (Mobile Money)        |
| POST    | `/api/v1/organizations/:id/payments/:pId/refund`           | oui     | payments.refund      | Remboursement avec motif et réouverture d'échéance          |
| GET     | `/api/v1/organizations/:id/payments/export`                | oui     | reports.export       | Export des transactions financières (XLSX, CSV)             |
| GET     | `/api/v1/organizations/:id/invoices`                       | oui     | invoices.view        | Liste des factures locataires émises                        |
| GET     | `/api/v1/organizations/:id/invoices/:invId/pdf`            | oui     | invoices.view        | Téléchargement officiel PDF de la facture                   |
| GET     | `/api/v1/organizations/:id/receipts/:recId/pdf`            | oui     | receipts.view        | Téléchargement officiel PDF de la quittance de loyer        |
| POST    | `/api/v1/organizations/:id/receipts/:recId/send`           | oui     | receipts.generate    | Envoi quittance par email et notification in-app            |
| POST    | `/api/v1/organizations/:id/deposits`                       | oui     | deposits.manage      | Gestion des cautions (perçue, restituée, retenue déduction) |
| GET     | `/api/v1/organizations/:id/transactions`                   | oui     | expenses.view        | Liste des dépenses et recettes comptables, filtres statut   |
| POST    | `/api/v1/organizations/:id/transactions`                   | oui     | expenses.create      | Création d'une dépense avec bénéficiaire et justificatif    |
| PATCH   | `/api/v1/organizations/:id/transactions/:txId`             | oui     | expenses.update      | Modification d'une dépense avec traçabilité d'audit         |
| POST    | `/api/v1/organizations/:id/transactions/:txId/approve`     | oui     | expenses.update      | Validation / approbation d'une dépense en attente           |
| POST    | `/api/v1/organizations/:id/transactions/:txId/reject`      | oui     | expenses.update      | Rejet d'une dépense avec motif obligatoire                  |
| POST    | `/api/v1/organizations/:id/transactions/:txId/pay`         | oui     | expenses.update      | Passage au statut payé après décaissement                   |
| DELETE  | `/api/v1/organizations/:id/transactions/:txId`             | oui     | expenses.delete      | Suppression logique (soft-delete) d'une dépense             |
| GET     | `/api/v1/organizations/:id/transactions/export`            | oui     | reports.export       | Export CSV du journal des dépenses                          |
| GET     | `/api/v1/organizations/:id/reports/finance`                | oui     | reports.view         | Rapport comptable période libre                             |
| GET     | `/api/v1/organizations/:id/reports/finance/pdf`            | oui     | reports.export       | Téléchargement PDF du rapport financier                     |
| GET     | `/api/v1/organizations/:id/reports/forecast`               | oui     | reports.view         | Prévision de trésorerie sur échéances connues futures       |

Les routes métier à implémenter par incréments :

```text
/organizations/:organizationId/properties
/organizations/:organizationId/buildings
/organizations/:organizationId/units
/organizations/:organizationId/tenants
/organizations/:organizationId/leases
/organizations/:organizationId/rent-schedules
/organizations/:organizationId/invoices
/organizations/:organizationId/payments
/organizations/:organizationId/maintenance-requests
/organizations/:organizationId/notifications
/organizations/:organizationId/audit-logs
```

## Pagination, filtres et tri

Paramètres bornés : `page` (>=1), `pageSize` (1..100), `sort` sur liste blanche, `order=asc|desc`, filtres documentés par ressource. Les recherches textuelles utilisent des champs/index prévus ; pas de filtre Mongo brut exposé au client. Les exports volumineux sont asynchrones avec autorisation, expiration et audit.

## Mutations et idempotence

`POST` de création est non idempotent par défaut sauf ressource documentée. Les paiements, webhooks et opérations externes exigent `Idempotency-Key` bornée et persistée sous scope organisation ; une répétition retourne le même résultat compatible ou un conflit si le payload diffère. Les transitions financières sont append-only/compensatoires.

## Organisation et permissions

Une route organisationnelle vérifie successivement token, organisation syntaxique, membership active et permission. Le contrôleur utilise uniquement `req.organizationContext.organizationId`, jamais un champ body arbitraire. Toute agrégation/population conserve le filtre organisationnel. Le rôle `SUPER_ADMIN` doit passer par un endpoint platform explicitement séparé.

## Socket.IO

Connexion authentifiée et autorisation lors de l’inscription dans une room. Formats :

```text
organization:{organizationId}:dashboard
organization:{organizationId}:maintenance
organization:{organizationId}:payments
```

Événements prévus : `dashboard.updated`, `maintenance.request.updated`, `payment.recorded`, `notification.created`. Le serveur ne rejoint pas une room sur simple tenant ID fourni par le client ; il vérifie membership et permission. Socket.IO est un complément temps réel : le client resynchronise via REST après reconnexion.

## Rate limiting et headers

Limiter auth par IP + identifiant, général par IP/session, opérations sensibles par utilisateur/membership. Retourner `Retry-After` et informations de limite sans révéler de détails d’authentification. CORS est une allowlist d’origines ; credentials uniquement pour origines explicitement autorisées.

## Endpoints ajoutés au Jalon 3 (PROMPT 3/5)

### Portail Locataire (`/portal/*`)

- `GET /organizations/:orgId/portal/invoices` : Liste des factures du locataire authentifié.
- `GET /organizations/:orgId/portal/invoices/:id/pdf` : Téléchargement sécurisé de la facture au format PDF.

### Espace Propriétaire (`/owner/*`)

- `GET /organizations/:orgId/owner/overview` : Synthèse consolidée multi-immeubles (taux d'occupation, loyers encaissés, dépenses, cashflow net, arriérés, répartition par bien, audit gestionnaire).
- `GET /organizations/:orgId/owner/report/pdf` : Téléchargement du rapport exécutif de gestion pour propriétaire (PDF).

### Intelligence Artificielle DOMORA AI (`/ai/*`)

- `POST /organizations/:orgId/ai/chat` : Conseiller virtuel analysant les données financières et d'occupation réelles de la base (zéro hallucination de chiffres).
- `POST /organizations/:orgId/ai/draft` : Générateur de correspondances juridiques et de relances (`RENT_REMINDER`, `LATE_NOTICE`, `FORMAL_NOTICE` avec délai de 8 jours, `RENEWAL_PROPOSAL`, `MAINTENANCE_UPDATE`).
- `GET /organizations/:orgId/ai/conversations` : Historique des échanges avec l'assistant.

### Gestion Documentaire (`/documents/*`)

- `GET /organizations/:orgId/documents` : Liste avec filtres (`category`, `q`, `archived`).
- `GET /organizations/:orgId/documents/storage-usage` : Consommation de l'espace de stockage SaaS en Mo et calcul du pourcentage de quota.
- `POST /organizations/:orgId/documents/:id/archive` : Archivage d'une pièce.
- `POST /organizations/:orgId/documents/:id/restore` : Restauration d'une pièce archivée.
- `DELETE /organizations/:orgId/documents/:id` : Suppression sécurisée.

### Messagerie Interne (`/messages/*`)

- `GET /organizations/:orgId/messages` : Liste des conversations (filtres par `category` et `status`).
- `POST /organizations/:orgId/messages` : Création d'un fil de discussion.
- `GET /organizations/:orgId/messages/:id` : Détails d'un fil et de ses réponses.
- `POST /organizations/:orgId/messages/:id/reply` : Réponse à un fil de discussion.
- `POST /organizations/:orgId/messages/:id/read` : Marquage comme lu.

### Recherche Universelle (`/search`)

- `GET /organizations/:orgId/search?q=...` : Recherche globale temps réel sur 10 types d'entités (propriétés, bâtiments, logements, locataires, baux, factures, paiements, tickets de maintenance, documents, artisans).

## Endpoints ajoutés au Module Agents Immobiliers & Marketplace

### Marketplace Publique (`/api/v1/marketplace/*`)

- `GET /marketplace/listings` : Recherche multi-critères (mots-clés, ville, quartier, catégorie, type de bien, vente/location, fourchette de prix, superficie, chambres, titre foncier vérifié, badge bien vérifié, tri).
- `GET /marketplace/listings/:id` : Consultation détaillée d'un bien (incrémentation vue, masquage de l'adresse exacte si requis, données agent/propriétaire).
- `POST /marketplace/listings/:id/inquiries` : Demande de renseignement public (crée un lead dans le CRM de l'agent).
- `POST /marketplace/listings/:id/viewings` : Demande de programmation de visite en ligne.
- `POST /marketplace/listings/:id/offers` : Soumission d'une proposition formelle d'achat ou de loyer.

### Espace Agent Immobilier (`/organizations/:orgId/agent/*`)

- `GET /organizations/:orgId/agent/dashboard` : Synthèse KPIs (annonces actives, ventes/locations conclues, leads, visites, mandats, commissions estimées vs encaissées).
- `GET /organizations/:orgId/agent/profile` : Profil professionnel de l'agent.
- `PATCH /organizations/:orgId/agent/profile` : Mise à jour du profil professionnel (champs d'audit et de vérification protégés).
- `GET /organizations/:orgId/agent/subscription` : Formule d'abonnement active, grille des limites et consommation réelle des quotas.
- `POST /organizations/:orgId/agent/subscription/change` : Changement ou surclassement de formule d'abonnement agent.
- `GET /organizations/:orgId/agent/listings` : Liste des annonces de l'agent.
- `POST /organizations/:orgId/agent/listings` : Publication d'une annonce (contrôle strict des quotas : annonces max, photos, vidéos, mise en avant, et vérification préalable de mandat si bien rattaché).
- `PATCH /organizations/:orgId/agent/listings/:id` : Modification d'annonce.
- `DELETE /organizations/:orgId/agent/listings/:id` : Retrait / suppression logique d'annonce.
- `GET /organizations/:orgId/agent/leads` : Pipeline CRM des prospects.
- `POST /organizations/:orgId/agent/leads` : Ajout manuel de prospect dans le CRM.
- `PATCH /organizations/:orgId/agent/leads/:id` : Mise à jour du prospect (statut de pipeline, budget, notes).
- `DELETE /organizations/:orgId/agent/leads/:id` : Suppression de prospect.
- `GET /organizations/:orgId/agent/viewings` : Calendrier des visites de l'agent.
- `PATCH /organizations/:orgId/agent/viewings/:id` : Mise à jour du statut d'une visite et enregistrement du feedback.
- `GET /organizations/:orgId/agent/offers` : Négociations et offres reçues sur les annonces.
- `PATCH /organizations/:orgId/agent/offers/:id` : Décision sur offre (acceptation, contre-proposition, rejet) avec calcul automatique de commission estimée.
- `GET /organizations/:orgId/agent/commissions` : Suivi financier strict des commissions (estimée, validée, encaissée).
- `GET /organizations/:orgId/agent/mandates` : Mandats confiés par les propriétaires.
- `POST /organizations/:orgId/agent/mandates/:id/accept` : Acceptation d'un mandat de commercialisation.
- `POST /organizations/:orgId/agent/mandates/:id/reject` : Refus d'un mandat avec motif.

### Espace Propriétaire — Annonces & Mandats (`/organizations/:orgId/owner/*`)

- `GET /organizations/:orgId/owner/listings` : Annonces créées directement par le propriétaire.
- `POST /organizations/:orgId/owner/listings` : Publication directe par le propriétaire.
- `PATCH /organizations/:orgId/owner/listings/:id` : Modification d'annonce propriétaire.
- `DELETE /organizations/:orgId/owner/listings/:id` : Retrait d'annonce propriétaire.
- `GET /organizations/:orgId/owner/offers` : Offres reçues par le propriétaire sur ses biens.
- `PATCH /organizations/:orgId/owner/offers/:id` : Décision du propriétaire sur l'offre.
- `GET /organizations/:orgId/owner/mandates` : Liste des mandats délégués à des agents.
- `POST /organizations/:orgId/owner/mandates` : Proposition de mandat formel (vente, location, exclusif, etc.) avec taux de commission.
- `POST /organizations/:orgId/owner/mandates/:id/revoke` : Révocation immédiate d'un mandat (suspension automatique de toutes les annonces publiées par l'agent sur ce bien).

### Modération Super Admin & Administration Marketplace (`/organizations/:orgId/admin/marketplace/*`)

- `GET /organizations/:orgId/admin/marketplace/listings` : File de modération des annonces.
- `POST /organizations/:orgId/admin/marketplace/listings/:id/approve` : Approbation et publication officielle sur la marketplace.
- `POST /organizations/:orgId/admin/marketplace/listings/:id/reject` : Rejet avec motif obligatoire.
- `POST /organizations/:orgId/admin/marketplace/listings/:id/suspend` : Suspension administrative.
- `POST /organizations/:orgId/admin/marketplace/listings/:id/verify` : Attribution / retrait du badge de confiance "Bien vérifié DOMORA".
- `GET /organizations/:orgId/admin/marketplace/agents` : Liste des profils agents à certifier.
- `POST /organizations/:orgId/admin/marketplace/agents/:id/verify` : Certification officielle de l'agent immobilier.
- `POST /organizations/:orgId/admin/marketplace/agents/:id/reject` : Rejet de la demande de vérification de l'agent.
- `GET /organizations/:orgId/admin/marketplace/plans` : Grilles tarifaires des abonnements agents (Gratuit, Starter, Pro, Business).
- `PATCH /organizations/:orgId/admin/marketplace/plans/:id` : Modification des tarifs, quotas d'annonces, quotas de photos et vidéos par le Super Admin.

## KadtEstate Quartier & Chefferie — Recensement, Foncier, Actes & Sécurité

Branche citoyenne, foncière et coutumière de KadtEstate dédiée au recensement cadastral local des résidences et parcelles, à la gestion administrative et financière de la chefferie (ventes de maisons, gestion locative de 05h00 à 22h00, transactions foncières, commissions et certificats officiels) et à la sécurité communautaire.

### Accès Public Résidents & Citoyens (`/quartier/*`)

- `GET /quartier/cities` : Liste des villes configurées.
- `GET /quartier/neighborhoods?cityId=` : Quartiers d'une ville donnée.
- `GET /quartier/blocks?neighborhoodId=` : Blocs / carrés d'un quartier avec jetons d'enregistrement QR code.
- `GET /quartier/blocks/by-token/:token` : Données du bloc résolues pour l'enrôlement direct via QR code ou lien WhatsApp.
- `POST /quartier/residents/register` : Formulaire d'auto-recensement citoyen gratuit (création/rattachement du logement, déclaration de foyer respectueuse de la vie privée sans profils nominatifs de mineurs, transmission au chef de bloc pour vérification).
- `POST /quartier/incidents` : Signalement confidentiel d'incidents communautaires (incendie, vol, inondation, accident, danger, coupure électrique/eau). L'identité du déclarant est protégée et n'est jamais exposée aux autres résidents.
- `GET /quartier/incidents/public` : Fil public des alertes et incidents vérifiés (anonymisés).
- `GET /quartier/emergency-contacts?neighborhoodId=` : Répertoire des services d'urgence locaux (Pompiers 18, Police 17, Gendarmerie, SAMU 15, SDE, Senelec/CIE).
- `GET /quartier/announcements?neighborhoodId=` : Annonces et communications publiques du secteur.
- `GET /quartier/residences` : Répertoire cartographique public avec données strictement anonymisées.
- `GET /quartier/certificates/verify/:code` : Vérification publique instantanée d'authenticité d'un certificat officiel délivré par la chefferie.
- `GET /quartier/chefferie/service-hours` : Statut en temps réel des horaires d'ouverture du service de gestion locative (Ouverture: 05h00 - Fermeture: 22h00).

### Espace Chefferie Traditionnelle & Immobilière (`/organizations/:orgId/quartier/chefferie/*`)

- `GET /organizations/:orgId/quartier/chefferie/dashboard` : Tableau de bord de suivi consolidé de la chefferie (KPIs : maisons vendues, maisons en location, terrains vendus, volume total des transactions, commissions chefferie générées vs encaissées, solde restant, nombre de certificats délivrés, historique complet).
- `GET /organizations/:orgId/quartier/chefferie/commissions/settings?neighborhoodId=` : Consultation des taux de commission configurés pour le quartier.
- `POST /organizations/:orgId/quartier/chefferie/commissions/settings` : Paramétrage des taux de commission par l'administration supérieure (% maison vendue, % maison louée, % terrain vendu).
- `POST /organizations/:orgId/quartier/chefferie/house-sales` : Enregistrement d'une vente de maison (ancien propriétaire, nouvel acquéreur, prix de vente, calcul automatique du pourcentage chefferie, montant perçu, historique).
- `GET /organizations/:orgId/quartier/chefferie/house-sales` : Registre officiel des ventes de maisons de la chefferie.
- `POST /organizations/:orgId/quartier/chefferie/house-rentals` : Enregistrement d'un contrat de location (propriétaire, locataire, montant du loyer, durée du bail, calcul automatique de commission chefferie, paiements perçus) respectant la plage horaire 05h00 - 22h00.
- `GET /organizations/:orgId/quartier/chefferie/house-rentals` : Registre des locations résidentielles sous l'autorité de la chefferie.
- `POST /organizations/:orgId/quartier/chefferie/land-sales` : Enregistrement d'une transaction foncière (propriétaire initial cédant, nouvel acquéreur bénéficiaire, superficie en m², localisation précise et numéro de lot, prix de vente, calcul automatique de la commission foncière chefferie).
- `GET /organizations/:orgId/quartier/chefferie/land-sales` : Registre foncier des terrains vendus.
- `POST /organizations/:orgId/quartier/chefferie/certificates` : Générateur automatique de document officiel de certification (identification chefferie, numéro unique `CERT-KE-YYYYMM-XXXX`, nature de l'opération, parties, description et localisation du bien, date, montants financiers, espace signature du chef et cachet officiel, code de vérification cryptographique).
- `GET /organizations/:orgId/quartier/chefferie/certificates` : Registre et conservation des copies numériques des certificats délivrés pour consultation, téléchargement PDF et réimpression.

### Espace Chef de Bloc (`/organizations/:orgId/quartier/*` avec rôle `BLOCK_LEADER`)

- `GET /organizations/:orgId/quartier/dashboard/block-leader` : Tableau de bord du bloc (KPIs : maisons recensées, logements, taux de couverture, résidents déclarés, alertes actives, consommation du quota de forfait).
- `GET /organizations/:orgId/quartier/submissions/pending?blockId=` : File des demandes d'enregistrement citoyennes en attente de vérification géographique.
- `POST /organizations/:orgId/quartier/submissions/:id/validate` : Décision du chef de bloc (validation officielle ou rejet avec motif obligatoire notifié au déclarant).
- `POST /organizations/:orgId/quartier/residences` : Enregistrement manuel direct d'une résidence lors d'une tournée physique dans le bloc avec détection automatique de doublons (adresse / repère).
- `POST /organizations/:orgId/quartier/residences/move-out` : Déclaration officielle de départ d'un foyer (libération du logement sans suppression de l'historique cadastral).
- `GET /organizations/:orgId/quartier/incidents?blockId=` : Signalements d'incidents survenus dans le bloc.
- `PATCH /organizations/:orgId/quartier/incidents/:id` : Prise en charge (`VERIFYING`), transmission aux secours (`DISPATCHED`) ou clôture résolue (`RESOLVED`) avec notes de résolution.
- `POST /organizations/:orgId/quartier/announcements` : Diffusion d'une communication ciblée aux résidents du bloc (Information, Réunion de bloc, Travaux/Voirie, Alerte urgente).

### Espace Chef de Quartier (`/organizations/:orgId/quartier/*` avec rôle `NEIGHBORHOOD_LEADER`)

- `GET /organizations/:orgId/quartier/dashboard/neighborhood-leader` : Tableau de bord consolidé du quartier (comparatif des blocs, taux de couverture respectifs, chefs actifs vs blocs sans responsable).
- `GET /organizations/:orgId/quartier/incidents?neighborhoodId=` : Vue consolidée des incidents et urgences à l'échelle du quartier.
- `POST /organizations/:orgId/quartier/announcements` : Diffusion d'un communiqué officiel à l'ensemble des blocs et habitants du quartier.

### Supervision Nationale & Administration Super Admin (`/organizations/:orgId/quartier/*` avec rôle `SUPER_ADMIN`)

- `GET /organizations/:orgId/quartier/dashboard/super-admin` : Statistiques nationales de recensement (villes, quartiers, blocs, résidences, foyers, taux de couverture moyen, incidents traités).
- `POST /organizations/:orgId/quartier/cities` : Création et administration d'une ville.
- `POST /organizations/:orgId/quartier/neighborhoods` : Création et découpage d'un quartier.
- `POST /organizations/:orgId/quartier/blocks` : Création d'un bloc avec génération automatique du token QR code unique.
- `GET /organizations/:orgId/quartier/sectors/assignments` : Registre des nominations et affectations des chefs de quartier et de bloc.
- `POST /organizations/:orgId/quartier/sectors/assign` : Nomination officielle d'un responsable de secteur (chef de bloc ou chef de quartier) avec validation stricte de non-chevauchement des compétences territoriales.
- `POST /organizations/:orgId/quartier/sectors/revoke/:assignmentId` : Révocation ou transfert d'un mandat de chef de secteur.
- `GET /organizations/:orgId/quartier/plans` : Grilles des forfaits d'abonnements des chefs de secteur (Découverte gratuit, Bloc Standard, Multi-blocs Pro, Quartier Intégral).
- `POST /organizations/:orgId/quartier/plans` : Définition des tarifs, limites de blocs, limites de résidences et fonctionnalités par le Super Admin.
- `GET /organizations/:orgId/quartier/subscriptions/my` : Suivi de l'abonnement du responsable connecté et respect des quotas.

## Webhooks et API publique (futur)

Webhooks entrants authentifiés par signature, timestamp et anti-rejeu ; payload journalisé minimalement et traité idempotemment. API keys scoped par organisation, hashées, expirables et révocables, avec quota et audit. Aucun endpoint public métier n’est livré dans cette fondation.
