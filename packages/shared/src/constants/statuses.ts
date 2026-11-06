export const MEMBERSHIP_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const PROPERTY_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_TYPES = [
  'BUILDING',
  'HOUSE',
  'APARTMENT',
  'VILLA',
  'STUDIO',
  'OFFICE',
  'SHOP',
  'COMMERCIAL',
  'LAND',
  'OTHER',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  BUILDING: 'Immeuble',
  HOUSE: 'Maison',
  APARTMENT: 'Appartement',
  VILLA: 'Villa',
  STUDIO: 'Studio',
  OFFICE: 'Bureau',
  SHOP: 'Boutique',
  COMMERCIAL: 'Local commercial',
  LAND: 'Terrain',
  OTHER: 'Autre',
};

export const UNIT_TYPES = [
  'ROOM',
  'STUDIO',
  'APARTMENT',
  'HOUSE',
  'OFFICE',
  'SHOP',
  'COMMERCIAL',
  'PARKING',
  'OTHER',
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_STATUSES = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'MAINTENANCE',
  'UNAVAILABLE',
] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const TENANT_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const IDENTITY_DOCUMENT_TYPES = [
  'NATIONAL_ID',
  'PASSPORT',
  'RESIDENCE_PERMIT',
  'OTHER',
] as const;
export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

export const LEASE_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'EXPIRING',
  'EXPIRED',
  'TERMINATED',
  'RENEWED',
] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

export const LEASE_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'] as const;
export type LeaseFrequency = (typeof LEASE_FREQUENCIES)[number];

export const SIGNATURE_STATUSES = ['NOT_REQUESTED', 'PENDING', 'SIGNED'] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

export const RENT_SCHEDULE_STATUSES = [
  'PENDING',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'CANCELLED',
] as const;
export type RentScheduleStatus = (typeof RENT_SCHEDULE_STATUSES)[number];

export const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  'MTN_MOMO',
  'ORANGE_MONEY',
  'CARD',
  'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['PENDING', 'CONFIRMED', 'REFUNDED', 'CANCELLED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const INVOICE_STATUSES = ['ISSUED', 'PARTIAL', 'PAID', 'CANCELLED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const DEPOSIT_TRANSACTION_TYPES = ['RECEIVED', 'REFUNDED', 'DEDUCTION'] as const;
export type DepositTransactionType = (typeof DEPOSIT_TRANSACTION_TYPES)[number];

export const PENALTY_TYPES = ['NONE', 'FIXED', 'PERCENTAGE'] as const;
export type PenaltyType = (typeof PENALTY_TYPES)[number];

export const MAINTENANCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

export const MAINTENANCE_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const DOCUMENT_CATEGORIES = [
  'LEASE_CONTRACT',
  'IDENTITY',
  'TENANT_DOCUMENT',
  'OWNER_DOCUMENT',
  'PROPERTY_TITLE',
  'INVOICE',
  'RECEIPT',
  'REPORT',
  'ADMINISTRATIVE',
  'PHOTO',
  'MAINTENANCE',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const MESSAGE_CATEGORIES = ['GENERAL', 'PAYMENT', 'MAINTENANCE', 'LEASE', 'URGENT'] as const;
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

export const VENDOR_TRADES = ['PLUMBER', 'ELECTRICIAN', 'TECHNICIAN', 'PAINTER', 'OTHER'] as const;
export type VendorTrade = (typeof VENDOR_TRADES)[number];

export const EXPENSE_CATEGORIES = [
  'MAINTENANCE',
  'ELECTRICITY',
  'WATER',
  'SALARIES',
  'TAXES',
  'INSURANCE',
  'INTERNET',
  'SECURITY',
  'CLEANING',
  'REPAIR',
  'RENOVATION',
  'ADMINISTRATIVE',
  'OTHER',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const TRANSACTION_DIRECTIONS = ['INCOME', 'EXPENSE'] as const;
export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];

export const UTILITY_TYPES = ['ELECTRICITY', 'WATER', 'GAS', 'OTHER'] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['EMAIL', 'IN_APP', 'SMS', 'WHATSAPP'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_EVENTS = [
  'RENT_DUE_SOON',
  'RENT_OVERDUE',
  'PAYMENT_RECEIVED',
  'LEASE_EXPIRING',
  'MAINTENANCE_CREATED',
  'MAINTENANCE_UPDATED',
  'DOCUMENT_EXPIRING',
  'PAYMENT_FAILED',
  'INVOICE_DUE',
  'EXPENSE_PENDING_APPROVAL',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = ['SENT', 'FAILED', 'SKIPPED_UNCONFIGURED'] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

/** Variables autorisées dans un template de notification. Toute autre est rejetée. */
export const NOTIFICATION_TEMPLATE_VARIABLES = [
  'tenantName',
  'rentAmount',
  'dueDate',
  'propertyName',
  'unitName',
  'paymentLink',
] as const;
export type NotificationTemplateVariable = (typeof NOTIFICATION_TEMPLATE_VARIABLES)[number];

// ==========================================
// MODULE AGENTS IMMOBILIERS & MARKETPLACE
// ==========================================

export const MARKETPLACE_PROPERTY_CATEGORIES = [
  'RESIDENTIAL',
  'COMMERCIAL',
  'LAND',
  'OTHER',
] as const;
export type MarketplacePropertyCategory = (typeof MARKETPLACE_PROPERTY_CATEGORIES)[number];

export const MARKETPLACE_PROPERTY_TYPES = [
  // Résidentiels
  'HOUSE',
  'VILLA',
  'APARTMENT',
  'STUDIO',
  'DUPLEX',
  'ROOM',
  'FURNISHED_RESIDENCE',
  'RESIDENTIAL_BUILDING',
  // Commerciaux
  'OFFICE',
  'SHOP',
  'STORE',
  'WAREHOUSE',
  'COMMERCIAL_PREMISES',
  'SHOPPING_CENTER',
  'PROFESSIONAL_BUILDING',
  // Terrains
  'RESIDENTIAL_LAND',
  'COMMERCIAL_LAND',
  'AGRICULTURAL_LAND',
  'INDUSTRIAL_LAND',
  'TITLED_LAND',
  'UNTITLED_LAND',
  // Autres biens
  'HOTEL',
  'TOURIST_RESIDENCE',
  'PARKING',
  'MIXED_USE_BUILDING',
  'NEW_DEVELOPMENT',
] as const;
export type MarketplacePropertyType = (typeof MARKETPLACE_PROPERTY_TYPES)[number];

export const MARKETPLACE_PROPERTY_TYPE_LABELS: Record<MarketplacePropertyType, string> = {
  // Résidentiels
  HOUSE: 'Maison',
  VILLA: 'Villa',
  APARTMENT: 'Appartement',
  STUDIO: 'Studio',
  DUPLEX: 'Duplex',
  ROOM: 'Chambre',
  FURNISHED_RESIDENCE: 'Résidence meublée',
  RESIDENTIAL_BUILDING: 'Immeuble résidentiel',
  // Commerciaux
  OFFICE: 'Bureau',
  SHOP: 'Boutique',
  STORE: 'Magasin',
  WAREHOUSE: 'Entrepôt',
  COMMERCIAL_PREMISES: 'Local commercial',
  SHOPPING_CENTER: 'Centre commercial',
  PROFESSIONAL_BUILDING: 'Bâtiment professionnel',
  // Terrains
  RESIDENTIAL_LAND: 'Terrain résidentiel',
  COMMERCIAL_LAND: 'Terrain commercial',
  AGRICULTURAL_LAND: 'Terrain agricole',
  INDUSTRIAL_LAND: 'Terrain industriel',
  TITLED_LAND: 'Terrain titré',
  UNTITLED_LAND: 'Terrain non titré',
  // Autres biens
  HOTEL: 'Hôtel',
  TOURIST_RESIDENCE: 'Résidence touristique',
  PARKING: 'Parking',
  MIXED_USE_BUILDING: 'Immeuble mixte',
  NEW_DEVELOPMENT: 'Projet immobilier neuf',
};

export const LISTING_TRANSACTION_TYPES = ['SALE', 'RENT', 'SEASONAL_RENTAL'] as const;
export type ListingTransactionType = (typeof LISTING_TRANSACTION_TYPES)[number];

export const LISTING_TRANSACTION_TYPE_LABELS: Record<ListingTransactionType, string> = {
  SALE: 'Vente',
  RENT: 'Location',
  SEASONAL_RENTAL: 'Location saisonnière',
};

export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'SUSPENDED',
  'SOLD',
  'RENTED',
  'ARCHIVED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Brouillon',
  PENDING_REVIEW: 'En attente de validation',
  PUBLISHED: 'Publiée',
  REJECTED: 'Refusée',
  SUSPENDED: 'Suspendue',
  SOLD: 'Vendu',
  RENTED: 'Loué',
  ARCHIVED: 'Archivée',
};

export const MANDATE_TYPES = [
  'SALE',
  'RENT',
  'MANAGEMENT',
  'MARKETING',
  'EXCLUSIVE',
  'NON_EXCLUSIVE',
] as const;
export type MandateType = (typeof MANDATE_TYPES)[number];

export const MANDATE_TYPE_LABELS: Record<MandateType, string> = {
  SALE: 'Mandat de vente',
  RENT: 'Mandat de location',
  MANAGEMENT: 'Mandat de gestion',
  MARKETING: 'Mandat de commercialisation',
  EXCLUSIVE: 'Mandat exclusif',
  NON_EXCLUSIVE: 'Mandat non exclusif',
};

export const MANDATE_STATUSES = ['PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED', 'REVOKED'] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

export const MANDATE_STATUS_LABELS: Record<MandateStatus, string> = {
  PENDING: 'En attente',
  ACTIVE: 'Actif',
  REJECTED: 'Refusé',
  EXPIRED: 'Expiré',
  REVOKED: 'Révoqué',
};

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'VIEWING_SCHEDULED',
  'NEGOTIATING',
  'CONVERTED',
  'LOST',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Nouveau',
  CONTACTED: 'Contacté',
  INTERESTED: 'Intéressé',
  VIEWING_SCHEDULED: 'Visite programmée',
  NEGOTIATING: 'En négociation',
  CONVERTED: 'Converti',
  LOST: 'Perdu',
};

export const VIEWING_STATUSES = [
  'SCHEDULED',
  'CONFIRMED_BY_OWNER',
  'CONFIRMED_BY_PROSPECT',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULED',
] as const;
export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

export const VIEWING_STATUS_LABELS: Record<ViewingStatus, string> = {
  SCHEDULED: 'Planifiée',
  CONFIRMED_BY_OWNER: 'Confirmée par propriétaire',
  CONFIRMED_BY_PROSPECT: 'Confirmée par prospect',
  COMPLETED: 'Effectuée',
  CANCELLED: 'Annulée',
  RESCHEDULED: 'Reportée',
};

export const OFFER_STATUSES = [
  'SUBMITTED',
  'TRANSMITTED_TO_OWNER',
  'COUNTER_OFFERED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  SUBMITTED: 'Soumise',
  TRANSMITTED_TO_OWNER: 'Transmise au propriétaire',
  COUNTER_OFFERED: 'Contre-proposition émise',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  EXPIRED: 'Expirée',
};

export const COMMISSION_TYPES = ['FIXED', 'PERCENTAGE'] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const COMMISSION_STATUSES = ['ESTIMATED', 'VALIDATED', 'DUE', 'PAID'] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  ESTIMATED: 'Estimée',
  VALIDATED: 'Validée',
  DUE: 'Due',
  PAID: 'Payée',
};

export const AGENT_TYPES = [
  'INDEPENDENT',
  'AGENCY_AGENT',
  'AGENCY_DIRECTOR',
  'AGENCY_COLLABORATOR',
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  INDEPENDENT: 'Agent indépendant',
  AGENCY_AGENT: 'Agent en agence',
  AGENCY_DIRECTOR: 'Responsable d’agence',
  AGENCY_COLLABORATOR: 'Collaborateur d’agence',
};

export const AGENT_VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const;
export type AgentVerificationStatus = (typeof AGENT_VERIFICATION_STATUSES)[number];

export const AGENT_VERIFICATION_STATUS_LABELS: Record<AgentVerificationStatus, string> = {
  UNVERIFIED: 'Non vérifié',
  PENDING: 'Vérification en cours',
  VERIFIED: 'Agent vérifié',
  REJECTED: 'Refusé',
};

export const AGENT_PLAN_CODES = [
  'AGENT_FREE',
  'AGENT_STARTER',
  'AGENT_PRO',
  'AGENT_BUSINESS',
] as const;
export type AgentPlanCode = (typeof AGENT_PLAN_CODES)[number];

export const AGENT_PLAN_LABELS: Record<AgentPlanCode, string> = {
  AGENT_FREE: 'Agent Free',
  AGENT_STARTER: 'Agent Starter',
  AGENT_PRO: 'Agent Professional',
  AGENT_BUSINESS: 'Agent Business',
};

// ==========================================
// DOMORA QUARTIER — RECENSEMENT & SÉCURITÉ
// ==========================================

export const RESIDENCE_TYPES = [
  'INDIVIDUAL_HOUSE',
  'RESIDENTIAL_BUILDING',
  'APARTMENT',
  'STUDIO',
  'COLLECTIVE_RESIDENCE',
  'COMMERCIAL_RESIDENTIAL',
  'OTHER_BUILDING',
] as const;
export type ResidenceType = (typeof RESIDENCE_TYPES)[number];

export const RESIDENCE_TYPE_LABELS: Record<ResidenceType, string> = {
  INDIVIDUAL_HOUSE: 'Maison individuelle',
  RESIDENTIAL_BUILDING: 'Immeuble résidentiel',
  APARTMENT: 'Appartement',
  STUDIO: 'Studio',
  COLLECTIVE_RESIDENCE: 'Résidence collective',
  COMMERCIAL_RESIDENTIAL: 'Logement commercial et résidentiel',
  OTHER_BUILDING: 'Autre type de bâtiment',
};

export const RESIDENCE_OCCUPANCY_STATUSES = [
  'OCCUPIED',
  'VACANT',
  'UNDER_CONSTRUCTION',
  'OTHER',
] as const;
export type ResidenceOccupancyStatus = (typeof RESIDENCE_OCCUPANCY_STATUSES)[number];

export const RESIDENCE_OCCUPANCY_STATUS_LABELS: Record<ResidenceOccupancyStatus, string> = {
  OCCUPIED: 'Occupé',
  VACANT: 'Vacant',
  UNDER_CONSTRUCTION: 'En construction',
  OTHER: 'Autre',
};

export const CENSUS_STATUSES = ['PENDING', 'VALIDATED', 'TO_UPDATE', 'REJECTED'] as const;
export type CensusStatus = (typeof CENSUS_STATUSES)[number];

export const CENSUS_STATUS_LABELS: Record<CensusStatus, string> = {
  PENDING: 'En attente de validation',
  VALIDATED: 'Validé',
  TO_UPDATE: 'À mettre à jour',
  REJECTED: 'Rejeté',
};

export const INCIDENT_CATEGORIES = [
  'FIRE',
  'FLOOD',
  'THEFT',
  'ACCIDENT',
  'NEIGHBORHOOD_HAZARD',
  'DAMAGED_INFRASTRUCTURE',
  'PUBLIC_SERVICES_EMERGENCY',
  'OTHER',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  FIRE: 'Incendie',
  FLOOD: 'Inondation',
  THEFT: 'Vol / Cambriolage',
  ACCIDENT: 'Accident',
  NEIGHBORHOOD_HAZARD: 'Danger dans le quartier',
  DAMAGED_INFRASTRUCTURE: 'Infrastructure endommagée',
  PUBLIC_SERVICES_EMERGENCY: 'Intervention services compétents',
  OTHER: 'Autre incident',
};

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Élevé',
  CRITICAL: 'Critique / Urgence absolue',
};

export const INCIDENT_STATUSES = [
  'NEW',
  'VERIFYING',
  'DISPATCHED',
  'RESOLVED',
  'DISMISSED',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  NEW: 'Nouveau',
  VERIFYING: 'En cours de vérification',
  DISPATCHED: 'Transmis aux services compétents',
  RESOLVED: 'Résolu',
  DISMISSED: 'Classé sans suite',
};

export const ANNOUNCEMENT_TYPES = ['INFO', 'MEETING', 'WORKS', 'URGENT_ALERT'] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  INFO: 'Information générale',
  MEETING: 'Réunion de quartier / bloc',
  WORKS: 'Travaux & Voirie',
  URGENT_ALERT: 'Alerte communautaire urgente',
};

export const ANNOUNCEMENT_SCOPES = ['BLOCK', 'NEIGHBORHOOD'] as const;
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];

export const ANNOUNCEMENT_SCOPE_LABELS: Record<AnnouncementScope, string> = {
  BLOCK: 'Habitants du bloc',
  NEIGHBORHOOD: 'Tout le quartier',
};

export const QUARTIER_PLAN_CODES = [
  'QUARTIER_DISCOVERY',
  'QUARTIER_STANDARD',
  'QUARTIER_PRO',
  'QUARTIER_DISTRICT',
] as const;
export type QuartierPlanCode = (typeof QUARTIER_PLAN_CODES)[number];

export const QUARTIER_PLAN_LABELS: Record<QuartierPlanCode, string> = {
  QUARTIER_DISCOVERY: 'Formule Découverte',
  QUARTIER_STANDARD: 'Formule Standard (1 Bloc)',
  QUARTIER_PRO: 'Formule Professionnelle (Multi-Blocs)',
  QUARTIER_DISTRICT: 'Formule Quartier Complet',
};

// --- Chefferie Immobilière, Foncière & Certification ---
export const CHEFFERIE_OPERATION_TYPES = ['HOUSE_SALE', 'HOUSE_RENTAL', 'LAND_SALE'] as const;
export type ChefferieOperationType = (typeof CHEFFERIE_OPERATION_TYPES)[number];

export const CHEFFERIE_OPERATION_LABELS: Record<ChefferieOperationType, string> = {
  HOUSE_SALE: 'Vente de maison',
  HOUSE_RENTAL: 'Location de maison',
  LAND_SALE: 'Vente de terrain',
};

export const CHEFFERIE_PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID'] as const;
export type ChefferiePaymentStatus = (typeof CHEFFERIE_PAYMENT_STATUSES)[number];

export const CHEFFERIE_PAYMENT_STATUS_LABELS: Record<ChefferiePaymentStatus, string> = {
  PENDING: 'En attente',
  PARTIAL: 'Partiellement réglé',
  PAID: 'Intégralement payé',
};

export const CHEFFERIE_CERTIFICATE_STATUSES = ['DRAFT', 'ISSUED', 'REVOKED'] as const;
export type ChefferieCertificateStatus = (typeof CHEFFERIE_CERTIFICATE_STATUSES)[number];

export const CHEFFERIE_CERTIFICATE_STATUS_LABELS: Record<ChefferieCertificateStatus, string> = {
  DRAFT: 'Brouillon',
  ISSUED: 'Délivré & Certifié',
  REVOKED: 'Révoqué / Annulé',
};
