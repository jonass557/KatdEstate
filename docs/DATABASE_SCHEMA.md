# Schéma de données — KadtEstate (anciennement DOMORA)

## Conventions

- MongoDB ObjectId pour les identifiants techniques `_id`.
- Timestamps `createdAt`/`updatedAt` en UTC ; `deletedAt` pour soft delete.
- Toute donnée appartenant à un tenant contient `organizationId`, premier champ des index composés.
- Montants stockés en entier d’unités mineures et code devise ISO 4217 (ex. `rentAmountMinor: 250000`, `currency: "XOF"`). Aucun flottant n'est utilisé.
- Données sensibles (ex. numéro de carte d'identité/passeport) chiffrées au repos via AES-256-GCM (`identityDocumentNumberEnc`) et masquées par défaut.

## Collections et relations

### 1. Identité et multi-tenancy

- **users** : email normalisé (index unique), displayName, passwordHash (Argon2 / PBKDF2), status (ACTIVE, SUSPENDED), emailVerifiedAt, platformRole (SUPER_ADMIN).
- **organizations** : nom, slug (unique), logo, adresse, téléphone, email, country (ISO 2 lettres), currency (ISO 3 lettres), timezone (IANA), locale ('fr'), notificationSettings (rappels email/sms/whatsapp, délai), billingSettings (préfixes factures/quittances, pénalités de retard), status (ACTIVE, SUSPENDED).
- **memberships** : `organizationId`, `userId`, `role` (ADMIN, OWNER, PROPERTY_MANAGER, ACCOUNTANT, AGENT, TENANT), grantedPermissions, revokedPermissions, status (INVITED, ACTIVE, SUSPENDED, REMOVED). Index unique composé `{ organizationId, userId }`.
- **sessions** : userId, jti (unique), tokenHash, familyId, expiresAt, revokedAt, userAgent, ipHash.
- **verificationTokens** : userId, tokenHash, purpose (EMAIL_VERIFICATION, PASSWORD_RESET), expiresAt, consumedAt.
- **auditLogs** : organizationId, actorId, action, resourceType, resourceId, result, requestId, changes. Append-only immuable.

### 2. Hiérarchie immobilière

- **properties** : organizationId, name, type (BUILDING, HOUSE, APARTMENT, VILLA, STUDIO, OFFICE, SHOP, COMMERCIAL, LAND, OTHER), address, city, country, description, status (DRAFT, ACTIVE, ARCHIVED), owner, manager, acquisitionDate, value, photos, documents, deletedAt.
- **buildings** : organizationId, propertyId, name, address, floors, deletedAt.
- **units** : organizationId, propertyId, buildingId (optionnel), name, number, floor, type (ROOM, STUDIO, APARTMENT, HOUSE, OFFICE, SHOP, COMMERCIAL, PARKING, OTHER), surfaceM2, bedrooms, bathrooms, rentAmountMinor, chargesAmountMinor, depositAmountMinor, status (AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE, UNAVAILABLE), description, amenities, photos, documents, deletedAt.

### 3. Locataires et Baux

- **tenants** : organizationId, firstName, lastName, fullName, phone, email, address, identityDocumentType (NATIONAL_ID, PASSPORT, RESIDENCE_PERMIT, OTHER), identityDocumentNumberEnc (chiffré AES-256-GCM), emergencyContactName, emergencyContactPhone, profession, documents, notes, status (ACTIVE, INACTIVE, ARCHIVED), userId (lien espace locataire).
- **leases** : organizationId, number (unique par org), tenantId, unitId, propertyId, ownerId, startDate, endDate, rentAmountMinor, depositAmountMinor, chargesAmountMinor, currency, frequency (MONTHLY, QUARTERLY, YEARLY), dueDay (1-28), penalty (type, value, graceDays), terms, status (DRAFT, ACTIVE, EXPIRING, EXPIRED, TERMINATED, RENEWED), renewedFromId, terminationDate, terminationReason, signature.
- **rentSchedules** : organizationId, leaseId, dueDate, amountDueMinor, amountPaidMinor, penaltyMinor, currency, status (PENDING, PARTIAL, PAID, OVERDUE, CANCELLED), frequency (MONTHLY, QUARTERLY, SEMI_ANNUAL, YEARLY). Traçabilité des modifications via auditLogs.
- **invoices** : organizationId, rentScheduleId (optionnel pour factures de charges), propertyId, unitId, tenantId, number (unique par org), dueDate, amountTotalMinor, amountPaidMinor, currency, status (DRAFT, ISSUED, PAID, OVERDUE, CANCELLED), type, items [{ label, quantity, unitPriceMinor, totalMinor }].
- **payments** : organizationId, rentScheduleId, invoiceId, amountMinor, currency, method (CASH, TRANSFER, MTN_MOMO, ORANGE_MONEY, CARD, OTHER), status (PENDING, CONFIRMED, REFUNDED, CANCELLED), idempotencyKey (unique par org), paidAt, reconciledAt.
- **receipts** : organizationId, paymentId, number (unique par org), issuedAt, url.
- **depositTransactions** : organizationId, leaseId, type (RECEIVED, REFUNDED, DEDUCTION), amountMinor, currency, note, createdAt. Journal financier append-only.
- **expenses / transactions** : organizationId, propertyId, buildingId, unitId, tenantId, vendorId, direction (EXPENSE, INCOME), category (MAINTENANCE, REPAIR, RENOVATION, WATER, ELECTRICITY, SALARIES, ADMINISTRATIVE, TAXES, INSURANCE, INTERNET, SECURITY, CLEANING, OTHER), payee, receiptFileId, amountMinor, currency, date, label, note, status (PENDING, APPROVED, REJECTED, PAID), rejectionReason, approvedBy, approvedAt, deletedAt. Circuit de validation avec audit immuable.

### Opérations

- **maintenanceRequests** : organizationId, unitId, tenantId optionnel, titre, description, priorité, statut, pièces jointes, dates.
- **maintenanceTasks** : organizationId, requestId, assigné/fournisseur, échéance, coût estimé/réel, état et audit.
- **vendors** : organizationId, coordonnées, catégories, contrats et état.
- **utilityMeters** : organizationId, unitId, type compteur, identifiant, unité, état.
- **utilityReadings** : organizationId, meterId, valeur, date de relevé, auteur, photo/justificatif ; index meter/date.
- **documents** : organizationId, ownerType/ownerId, objectKey privé, nom original nettoyé, type, taille, checksum, classification, état de scan et visibilité.
- **notifications** : organizationId, recipientUserId, type, payload minimisé, lu/envoyé, dates et canal.
- **messages** : organizationId, conversationId, senderId, contenu, pièces jointes, date, états de livraison ; règles de visibilité explicites.

### Plateforme, intégrations et suivi

- **auditLogs** : organizationId optionnel pour événements plateforme, actorId, action, resourceType/resourceId, résultat, requestId, changements expurgés, horodatage. Append-only, indexes organization/date et acteur/date.
- **subscriptions** : organizationId, planId, état, périodes, provider, références de facturation.
- **plans** : code, version, fonctionnalités, limites, prix par devise, état.
- **automations** : organizationId, déclencheur, critères validés, action, état, historique d’exécution séparé à prévoir.
- **webhooks** : organizationId, URL, événements, secret hashé/chiffré, état, dernière livraison ; les tentatives sont stockées séparément ou dans une outbox.
- **apiKeys** : organizationId, label, prefix public, secret hashé, scopes, expiration, dernière utilisation/révocation. Le secret n’est affiché qu’une fois.

### 4. Marketplace & Module Agents Immobiliers

- **agentProfiles** : userId (unique), organizationId, firstName, lastName, phone, email, city, country, activityZone, bio, experienceYears, specialties, agencyName, agentType (INDEPENDENT, AGENCY_AGENT, AGENCY_DIRECTOR, COLLABORATOR), photoUrl, documents [{ name, url }], verificationStatus (UNVERIFIED, PENDING, VERIFIED, REJECTED), verifiedAt, rejectionReason, rating, reviewCount, activeSubscriptionPlan (AGENT_FREE, AGENT_STARTER, AGENT_PRO, AGENT_BUSINESS), subscriptionExpiresAt.
- **agentPlans** : code (unique), name, priceMinor, currency, durationMonths, trialDays, maxActiveListings, maxPhotosPerListing, maxVideosPerListing, featuredListingsQuota, advancedAnalytics, leadManagement, maxCollaborators, isActive.
- **listings** : organizationId, publisherId, publisherRole (OWNER, AGENT, ADMIN), agentProfileId, mandateId, propertyId, unitId, title, description, category (RESIDENTIAL, COMMERCIAL, LAND, OTHER), propertyType (APARTMENT, VILLA, STUDIO, BUILDING, ROOM, OFFICE, RETAIL, WAREHOUSE, LAND_RESIDENTIAL, etc.), transactionType (SALE, RENT), priceMinor, currency, location (country, city, district, address, hideExactAddress), surfaceM2, bedrooms, bathrooms, roomsCount, floorsCount, condition, availabilityDate, isTitled (booléen), landTitleNumber (numéro de Titre Foncier explicite), amenities, photos [{ url, isPrimary, caption }], videos, documents, status (DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED, SUSPENDED, SOLD, RENTED, WITHDRAWN), moderationComment, isVerified (badge de confiance), isFeatured, viewsCount, inquiriesCount, deletedAt.
- **mandates** : organizationId, ownerId, agentId, agentProfileId, propertyId, listingId, mandateType (SALE, RENT, MANAGEMENT, MARKETING, EXCLUSIVE, NON_EXCLUSIVE), commissionType (PERCENTAGE, FIXED), commissionRate, startDate, endDate, status (PENDING, ACTIVE, REJECTED, EXPIRED, REVOKED), authorizedRights, terms, documents, history [{ action, performedBy, date, note }].
- **leads** : organizationId, agentId, fullName, phone, email, searchType (BUY, RENT), budgetMinor, currency, targetCity, targetDistrict, targetPropertyType, status (NEW, CONTACTED, VIEWING_SCHEDULED, VIEWED, OFFER_MADE, UNDER_CONTRACT, CONVERTED, LOST), associatedListings, notes, contactDate.
- **viewings** : organizationId, listingId, agentId, ownerId, prospectName, prospectPhone, prospectEmail, date, status (SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW), notes, feedback.
- **offers** : organizationId, listingId, buyerId, agentId, ownerId, prospectName, prospectPhone, prospectEmail, offeredAmountMinor, counterOfferAmountMinor, currency, status (SUBMITTED, UNDER_REVIEW, ACCEPTED, COUNTERED, REJECTED, EXPIRED, WITHDRAWN), message, ownerDecisionNote, decidedAt.
- **commissions** : organizationId, mandateId, listingId, agentId, ownerId, transactionAmountMinor, commissionAmountMinor, currency, status (ESTIMATED, VALIDATED, INVOICED, PAID, CANCELLED), paidAt, paymentReference, notes.

### 5. DOMORA QUARTIER — Recensement & Sécurité Communautaire

- **geoCities** : name, region, country (ISO 2 lettres), coordinates { latitude, longitude }, isActive. Index `{ name: 1, country: 1 }`.
- **geoDistricts** : cityId, name, code, coordinates. Index `{ cityId: 1, name: 1 }`.
- **geoNeighborhoods** : cityId, districtId, name, code (normalisé en majuscules), boundaryCoordinates [{ latitude, longitude }], isActive. Index unique `{ cityId: 1, name: 1 }`.
- **geoBlocks** : neighborhoodId, name, code, description, registrationToken (jeton d'enrôlement unique aléatoire de 24 caractères pour URL / QR code), qrCodeUrl, boundaryCoordinates. Index unique `{ neighborhoodId: 1, code: 1 }`, index unique `{ registrationToken: 1 }`.
- **sectorAssignments** : organizationId, userId, role (BLOCK_LEADER, NEIGHBORHOOD_LEADER), cityId, neighborhoodId, blockId (optionnel pour chef de quartier), assignedBy, startDate, endDate, status (ACTIVE, SUSPENDED, REVOKED), notes. Index `{ userId: 1, status: 1 }`, index `{ neighborhoodId: 1, blockId: 1, status: 1 }`.
- **quartierResidences** : organizationId, residenceDomoraId (format officiel `DOM-[NEIGH]-[BLOCK]-[NUM]`), cityId, neighborhoodId, blockId, buildingType (INDIVIDUAL_HOUSE, RESIDENTIAL_BUILDING, APARTMENT, STUDIO, COLLECTIVE_RESIDENCE, COMMERCIAL_RESIDENTIAL, OTHER_BUILDING), address, landmark, coordinates { latitude, longitude }, dwellingsCount, occupancyStatus (OCCUPIED, VACANT, UNDER_CONSTRUCTION, OTHER), censusStatus (PENDING, VALIDATED, TO_UPDATE, REJECTED), ownerName, ownerPhone, recordedBy, verifiedBy, verifiedAt, notes. Index unique `{ residenceDomoraId: 1 }`, index composé `{ blockId: 1, address: 1 }`.
- **quartierDwellings** : residenceId, dwellingNumber, floor, type, occupancyStatus (OCCUPIED, VACANT, OTHER), householdId. Index `{ residenceId: 1, dwellingNumber: 1 }`.
- **residentHouseholds** : residenceId, dwellingId, headOfHouseholdUserId, fullName, phone, email, householdSize (entier), minorsCount (agrégé), arrivalDate, emergencyContactName, emergencyContactPhone, isCurrentResident (booléen), departureDate, departureReason, consentAcceptedAt.
- **censusSubmissions** : blockId, residenceId, householdId, submittedBy, submissionType (SELF_ENROLLMENT, LEADER_RECORD), status (PENDING, VALIDATED, REJECTED), decisionReason, verifiedBy, verifiedAt, initialDataSnapshot. Index `{ blockId: 1, status: 1 }`.
- **incidentReports** : organizationId, incidentNumber (ex: `INC-202611-0001`), blockId, neighborhoodId, cityId, category (FIRE, FLOOD, THEFT, ACCIDENT, NEIGHBORHOOD_HAZARD, DAMAGED_INFRASTRUCTURE, PUBLIC_SERVICES_EMERGENCY, OTHER), severity (LOW, MEDIUM, HIGH, CRITICAL), description, locationText, coordinates, reporterUserId, reporterName, reporterPhone, isAnonymous (booléen pour masquer l'identité du déclarant), status (NEW, VERIFYING, DISPATCHED, RESOLVED, DISMISSED), assignedLeaderId, resolutionNotes, resolvedAt. Index `{ neighborhoodId: 1, status: 1, createdAt: -1 }`.
- **communityAnnouncements** : organizationId, authorId, authorRole, scope (BLOCK, NEIGHBORHOOD), cityId, neighborhoodId, blockId, type (INFO, MEETING, WORKS, URGENT_ALERT), title, message, eventDate, isPinned, expiresAt. Index `{ neighborhoodId: 1, scope: 1, createdAt: -1 }`.
- **emergencyContacts** : cityId, neighborhoodId, serviceType (POMPIERS, POLICE, GENDARMERIE, SAMU, SERVICE_EAU, SERVICE_ELECTRICITE, DISPENSAIRE, OTHER), name, shortNumber (18, 17, 15...), phone, alternativePhone, address, isAvailable24h.
- **quartierPlans** : code (DISCOVERY, BLOCK_STANDARD, BLOCK_PRO, DISTRICT_PRO), name, description, priceMinor, currency, billingFrequency (MONTHLY, YEARLY), maxBlocks, maxResidences, maxBroadcastsPerMonth, hasInteractiveMap, hasAdvancedAnalytics, hasUrgentAlertsSMS, isActive. Index unique `{ code: 1 }`.
- **quartierSubscriptions** : organizationId, leaderUserId, planId, status (ACTIVE, TRIAL, SUSPENDED, EXPIRED, CANCELLED), startDate, endDate, autoRenew, assignedBlocksCount, recordedResidencesCount, paymentReference. Index `{ leaderUserId: 1, status: 1 }`.

### 6. KadtEstate Chefferie — Foncier, Ventes, Locations & Certificats Officiels

- **chefferieCommissionSettings** : organizationId, neighborhoodId (unique), houseSaleRatePercent (défaut 5%), houseRentalRatePercent (défaut 10%), landSaleRatePercent (défaut 5%), openingTime (05:00), closingTime (22:00), updatedBy, notes. Index unique `{ organizationId: 1, neighborhoodId: 1 }`.
- **houseSaleTransactions** : organizationId, transactionNumber (ex: `VTE-202611-0001`), neighborhoodId, blockId, residenceId, propertyAddress, sellerInfo { fullName, phone, email, identityNumber }, buyerInfo { fullName, phone, email, identityNumber }, salePriceMinor, currency, chefferieRatePercent, chefferieAmountDueMinor, chefferieAmountPaidMinor, paymentStatus (PENDING, PARTIAL, PAID), paymentDate, recordedBy, witnessNames, notes. Index `{ neighborhoodId: 1, paymentStatus: 1 }`, index unique `{ transactionNumber: 1 }`.
- **houseRentalRecords** : organizationId, recordNumber (ex: `LOC-202611-0001`), neighborhoodId, blockId, residenceId, dwellingId, propertyAddress, ownerInfo { fullName, phone, email }, tenantInfo { fullName, phone, email, emergencyContact }, rentAmountMinor, chargesAmountMinor, currency, contractDurationMonths, startDate, endDate, chefferieCommissionRatePercent, chefferieCommissionDueMinor, chefferieCommissionPaidMinor, paymentStatus (PENDING, PARTIAL, PAID), recordedBy, notes. Index `{ neighborhoodId: 1, paymentStatus: 1 }`, index unique `{ recordNumber: 1 }`.
- **landSaleTransactions** : organizationId, transactionNumber (ex: `TER-202611-0001`), neighborhoodId, blockId, plotNumber (numéro de lot/parcelle), landLocationDescription, surfaceM2, initialOwnerInfo { fullName, phone, email, titleDeedNumber }, newBuyerInfo { fullName, phone, email, identityNumber }, salePriceMinor, currency, chefferieRatePercent, chefferieAmountDueMinor, chefferieAmountPaidMinor, paymentStatus (PENDING, PARTIAL, PAID), boundaryNeighbors { north, south, east, west }, recordedBy, notes. Index `{ neighborhoodId: 1, paymentStatus: 1 }`, index unique `{ transactionNumber: 1 }`.
- **chefferieCertificates** : organizationId, certificateNumber (ex: `CERT-202611-0001`), verificationCode (jeton sécurisé unique à 16 caractères), operationType (HOUSE_SALE, HOUSE_RENTAL, LAND_SALE), operationReferenceId, neighborhoodId, chefferieName, applicantName, applicantPhone, propertySummary, financialSummary, issueDate, status (DRAFT, ISSUED, REVOKED), issuedBy, signatoryTitle, sealUrl, digitalSignatureHash, qrCodeDataUrl. Index unique `{ certificateNumber: 1 }`, index unique `{ verificationCode: 1 }`, index `{ neighborhoodId: 1, operationType: 1 }`.

## Relations principales

```text
users ──< memberships >── organizations
organizations ──< properties ──< buildings
properties ──< units ──< leases >── tenants
leases ──< rentSchedules / invoices ──< payments ── receipts
leases ──< depositTransactions
units ──< maintenanceRequests ──< maintenanceTasks >── vendors
units ──< utilityMeters ──< utilityReadings
organizations ──< documents / notifications / messages / auditLogs
organizations ── subscriptions >── plans
```

## Indexes essentiels

| Collection          | Index                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| users               | unique `{ emailNormalized: 1 }`                                                                  |
| memberships         | unique `{ organizationId: 1, userId: 1 }`, `{ userId: 1, status: 1 }`                            |
| properties          | unique `{ organizationId: 1, code: 1 }`, `{ organizationId: 1, status: 1 }`                      |
| buildings           | `{ organizationId: 1, propertyId: 1, code: 1 }`                                                  |
| units               | unique `{ organizationId: 1, propertyId: 1, code: 1 }`, `{ organizationId: 1, status: 1 }`       |
| leases              | `{ organizationId: 1, unitId: 1, status: 1 }`, `{ organizationId: 1, endDate: 1 }`               |
| invoices            | unique `{ organizationId: 1, number: 1 }`, `{ organizationId: 1, dueAt: 1, status: 1 }`          |
| payments            | unique sparse `{ organizationId: 1, idempotencyKey: 1 }`, `{ organizationId: 1, createdAt: -1 }` |
| maintenanceRequests | `{ organizationId: 1, status: 1, priority: 1, createdAt: -1 }`                                   |
| auditLogs           | `{ organizationId: 1, createdAt: -1 }`, `{ actorId: 1, createdAt: -1 }`                          |
| sessions            | unique `{ jti: 1 }`, TTL `{ expiresAt: 1 }`                                                      |

Index definitions must be reviewed against actual query shapes and cardinality before production. Partial/unique indexes must define soft-delete semantics deliberately.

## Isolation invariants

Every tenant-owned model has required `organizationId`. Repository methods require it in their signature. Find/update/delete predicates include both organizationId and target ID; unique keys and idempotency keys are organization-scoped. Population/aggregation pipelines preserve the organization scope at each collection boundary. Background jobs, exports, webhooks and sockets carry verified organization context. Never permit mass assignment of organizationId from request body.

## Validation and deletion

Use enums/status transitions enforced in services, bounds on strings/arrays/numbers, required currency and timezone validation, and unique constraints at MongoDB. Soft delete only for recoverable records; financial ledger and audit records are immutable, corrected by compensating entries. Retention and legal hold requirements vary by jurisdiction and remain an implementation decision.

## Demandé mais à détailler avant réalisation

La demande initiale prévoit également `users`, `organizations`, `memberships`, `roles`, `permissions`, `properties`, `buildings`, `units`, `tenants`, `leases`, `rentSchedules`, `invoices`, `payments`, `receipts`, `expenses`, `depositTransactions`, `maintenanceRequests`, `maintenanceTasks`, `vendors`, `utilityMeters`, `utilityReadings`, `documents`, `notifications`, `messages`, `auditLogs`, `subscriptions`, `plans`, `automations`, `webhooks`, `apiKeys` et `sessions`. Les modèles ci-dessus constituent une proposition conceptuelle ; ils ne sont pas encore des modèles Mongoose implémentés.
