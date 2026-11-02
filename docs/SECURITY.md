# Sécurité & Conformité — DOMORA

## Objectif et modèle de menace

DOMORA traite des identités, coordonnées de locataires, pièces d'identité, contrats de bail, documents administratifs et flux financiers. Les menaces prioritaires traitées sont : la prise de compte, la fuite inter-organisation, l'escalade de privilèges, l'injection NoSQL/MongoDB, le rejeu de requêtes sensibles, l'altération de fichiers, l'abus d’API et l'exposition de secrets.

## Authentification

- Mots de passe hachés avec Argon2id, jamais chiffrés ni journalisés.
- Access tokens JWT courts, signés avec clé gérée hors dépôt et vérification stricte de l’issuer/audience.
- Refresh sessions persistées avec `jti`, hash du token, utilisateur, famille, expiration, rotation et révocation.
- Rotation à chaque renouvellement ; réutilisation d’un token révoqué déclenche la révocation de sa famille.
- Cookies de refresh recommandés pour le navigateur : `HttpOnly`, `Secure`, `SameSite` adapté et protection CSRF.
- Déconnexion : révocation serveur, suppression du cookie et invalidation côté client.
- Éviter les réponses révélant si un compte existe lors de l’authentification.

## Autorisation et isolation

Le refus est la valeur par défaut. Les rôles `SUPER_ADMIN`, `ADMIN`, `OWNER`, `PROPERTY_MANAGER`, `ACCOUNTANT`, `AGENT`, `TENANT` sont traduits en permissions granulaires centralisées. Une route vérifie token, membership active et permission.

Règles multi-tenant obligatoires :

1. Chaque document organisationnel contient `organizationId`.
2. Chaque repository reçoit le scope organisation explicitement.
3. Les recherches, mises à jour et suppressions incluent `organizationId` et l’identifiant de ressource.
4. Le body, les query params et les headers client ne peuvent pas imposer le scope de sécurité.
5. Les agrégations et populations conservent le filtre organisationnel.
6. Les exports, tâches asynchrones, webhooks et rooms Socket.IO portent un contexte vérifié.
7. L’accès platform-admin est séparé et audité.

Les tests doivent tenter lecture, modification, suppression, export, rôle excessif et abonnement Socket.IO entre deux organisations.

## Validation et sanitation

Zod valide les entrées à la frontière HTTP ; Mongoose ajoute les contraintes de persistance. Les paramètres sont bornés, les champs inconnus rejetés ou ignorés explicitement, les ObjectId validés et les tris/filtres limités à des listes blanches. Les clés `$` et les clés contenant des points sont rejetées/sanitisées avant MongoDB. Ne jamais construire une requête Mongo à partir d’un objet utilisateur non validé.

## Réseau et middleware

- Helmet avec CSP adaptée au frontend et protections HTTP standards.
- CORS par allowlist d’origines, credentials uniquement pour les origines autorisées.
- Limites de taille et de profondeur des payloads.
- Rate limits séparés pour login/refresh, API générale et actions sensibles.
- TLS obligatoire hors développement local.
- Timeouts et limites sur les appels sortants.
- Request ID sans accepter de valeur dangereuse ou excessivement longue.

## Socket.IO

La socket est authentifiée pendant le handshake. Une room organisationnelle n’est rejointe qu’après vérification de membership et de permission côté serveur. Les événements entrants sont validés, limités et ne permettent pas d’écrire directement en base. Le client resynchronise ses données via REST après reconnexion.

## Données personnelles et fichiers

Minimiser les PII, documenter finalité/rétention/consentement et limiter les accès par rôle. Les logs excluent tokens, mots de passe, secrets, documents et données financières détaillées. Les fichiers futurs utiliseront un stockage objet privé, clés générées côté serveur, URLs signées courtes, limite de taille/type, nom nettoyé, antivirus et audit.

## Paiements et webhooks

Les montants sont des entiers en unités mineures et devise ISO. Toute opération sensible utilise une clé d’idempotence scoped organisation. Les webhooks exigent signature, timestamp, anti-rejeu, validation de schéma et traitement idempotent. Les transactions financières ne sont pas supprimées ni écrasées ; les corrections sont compensatoires et auditées.

## Secrets et dépendances

Aucun secret dans Git, logs, bundle web ou message d’erreur. Utiliser des variables d’environnement en développement et un secret manager en production. Rotation documentée des clés JWT, cookies, API keys et fournisseurs. Verrouiller les versions via `package-lock.json`, surveiller les dépendances, lancer audit/SCA en CI et refuser les paquets non nécessaires.

## Audit, logs et réponse à incident

Les logs techniques structurés servent au diagnostic et sont séparés des `auditLogs` append-only. Un audit contient acteur, organisation, action, ressource, résultat, request ID, timestamp et changement expurgé. Prévoir alertes sur échecs répétés, refresh reuse, accès refusés anormaux, erreurs webhook et anomalies de paiement. Incident response : contenir, révoquer, préserver les preuves, notifier selon obligations et réaliser un post-mortem.

## Tests de sécurité avant production

- JWT expiré, signature/issuer/audience incorrects.
- Rotation, révocation et rejeu de refresh token.
- Membership inactive et tentative de changement de rôle.
- Lecture/update/delete/export cross-tenant.
- Socket room non autorisée.
- Injection `$where`, opérateurs et clés pointées.
- CORS, cookies, CSRF et rate limits.
- Payload excessif, validation et erreurs sans fuite d’informations.
- Upload de type, taille et contenu malveillant.
- Redaction des secrets dans logs et erreurs.
- Idempotence et signature de webhooks/paiements.

## État actuel

Cette phase branche les protections d’infrastructure prévues et documente les invariants. Elle ne constitue pas une certification de sécurité et ne livre pas encore l’authentification complète, les modèles métier, les paiements ni un audit de production.
