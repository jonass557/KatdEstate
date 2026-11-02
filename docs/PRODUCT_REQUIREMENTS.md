# Product Requirements Document (PRD) — DOMORA

## Vision

Fournir aux acteurs de la gestion immobilière et locative en Afrique francophone (UEMOA / CEMAC) et à l'international une plateforme SaaS moderne, sécurisée et intuitive pour centraliser biens, logements, locataires, contrats, loyers, finances, maintenance et communications.

## Personas & Rôles

- **Propriétaire (`OWNER`)** : suit son patrimoine, le taux d'occupation, les revenus locatifs réels et potentiels, et consulte les contrats.
- **Administrateur (`ADMIN`)** : administre l'organisation, invite et gère les membres, configure les paramètres de notification et facturation.
- **Gestionnaire immobilier (`PROPERTY_MANAGER`)** : gère le parc immobilier (propriétés, bâtiments, logements), les locataires et les contrats de bail.
- **Comptable (`ACCOUNTANT`)** : suit les échéanciers, enregistre et réconcilie les paiements, gère les charges, quittances et rapports financiers.
- **Agent (`AGENT`)** : assure les tâches de terrain, visites, état des lieux et suivi direct de la maintenance.
- **Locataire (`TENANT`)** : accède au portail locataire pour consulter son bail, son historique de paiements, télécharger ses quittances et émettre des demandes.
- **Super administrateur (`SUPER_ADMIN`)** : supervise la plateforme SaaS, les plans d'abonnement et la sécurité globale de manière isolée.

## Rôles et permissions initiales

Les rôles demandés sont `SUPER_ADMIN`, `ADMIN`, `OWNER`, `PROPERTY_MANAGER`, `ACCOUNTANT`,
`AGENT`, `TENANT`. Les permissions sont granulaires et centralisées dans
`packages/shared/src/constants/permissions.ts` : 73 permissions en convention `domaine.action`
couvrant organisation et équipe, parc immobilier, locataires et baux, finance (loyers,
factures, paiements, reçus, dépôts, charges), opérations (maintenance, fournisseurs, compteurs,
documents), communication, rapports, comptabilité, automatisations, intégrations, abonnements,
audit et paramètres. Exemples : `properties.create`, `units.manage`, `payments.refund`,
`reports.export`, `users.manage`, `settings.manage`.

Le mapping par défaut rôle → permissions est un point de départ documenté, jamais un substitut à
l’autorisation serveur. Toute route déclare une permission ; les permissions de la membership
active sont évaluées côté API, avec refus par défaut.

## Capacités fonctionnelles cibles

| Domaine                     | Parcours principal                                                              | Phase     |
| --------------------------- | ------------------------------------------------------------------------------- | --------- |
| Organisation et équipe      | créer organisation, inviter membre, attribuer rôle, changer organisation active | 1         |
| Parc immobilier             | créer propriété/immeuble, unités, disponibilité, état                           | 2         |
| Locataires et baux          | profil, documents, contrat, dates, dépôt, renouvellement                        | 2         |
| Loyers et finance           | échéanciers, appels, paiements, reçus, impayés, relances                        | 3         |
| Maintenance                 | demande, ticket, priorité, fournisseur, tâche, résolution                       | 4         |
| Communications              | notifications, messages, préférences, portail locataire/propriétaire            | 4         |
| Rapports/analytics          | occupation, revenus, encaissement, dépenses, exports                            | 3/5       |
| Administration SaaS         | plans, abonnements, usage, audit platform                                       | 5         |
| IA immobilière/API publique | assistants, intégrations, webhooks, clés API                                    | après MVP |

## Exigences transverses par workflow

Tout parcours doit fournir états chargement, vide, erreur, succès et accès clavier ; valider données côté client pour feedback et côté serveur pour sécurité ; enregistrer les actions sensibles dans l’audit ; appliquer organisation et permission côté API ; ne pas exposer les données d’une organisation différente.

## MVP recommandé

Le MVP livrable après la fondation comprend identité/memberships, organisations, RBAC, propriétés, immeubles, unités, locataires, baux, tableau de bord de synthèse, échéanciers et enregistrement manuel de paiements, tickets de maintenance de base, notifications internes et audit. Les paiements en ligne, SMS/WhatsApp, documents avancés, abonnements et IA restent des incréments ultérieurs.

## UX et design

Interface moderne, premium, sobre, rapide, accessible, mobile-first et responsive. Light/dark mode, animations discrètes, sidebar adaptable, command palette, raccourcis clavier, toasts non bloquants, confirmations pour mutations destructives, skeletons, empty states orientés action et erreurs compréhensibles. Le dashboard présente immédiatement occupation, loyers attendus/encaissés, impayés et tickets, avec monnaie et période explicites.

## Exigences régionales

Prévoir français comme langue initiale et architecture i18n. Les pays, devises (XOF, XAF et autres), méthodes de paiement mobile money/bancaire, formats fiscaux, fuseaux et règles de conservation doivent être configurés, non hardcodés. Les montants sont exacts, en unités mineures et devise ISO ; dates persistées en UTC et affichées dans le fuseau de l’organisation.

## Non-fonctionnel

- Isolation organisationnelle vérifiable par tests cross-tenant.
- API versionnée avec erreurs stables et request ID.
- Authentification robuste, RBAC, rate limiting, sanitation, audit.
- Responsive mobile-first et accessibilité WCAG à préciser.
- Performance : pagination, indexes, requêtes bornées, cache contrôlé.
- Résilience : timeouts, retries maîtrisés, dégradation si Socket.IO indisponible.
- Observabilité : logs structurés, métriques, alertes et audit séparés.
- Données : sauvegardes, restauration testée, rétention documentée.

## Critères d’acceptation de la fondation

Les documents d’architecture existent et sont cohérents, les workspaces installent et compilent, l’API expose live/readiness avec erreurs contrôlées, le web rend le shell et ses routes d’état, les contrats partagés compilent, et aucune fonctionnalité métier non implémentée n’est annoncée comme terminée.

## Hors périmètre explicite

Pas de CRUD métier complet, de vraie authentification, d’intégration de paiement, d’envoi de messages externe, de gestion documentaire production, d’abonnement SaaS, d’IA ou d’application mobile complète dans cette phase.
