import { getStoredQuittances, saveStoredQuittances, type QuittanceItem } from './quittances';
import { toGeoJsonPolygon, type GeoJsonBoundary } from '@rentflow/shared';

// ============================================================================
// 1. AUTHENTICATION & CREDENTIALS STORE (Locataires, Mandataires, Inscrits)
// ============================================================================

export const STORAGE_REGISTERED_USERS_KEY = 'katdestate_registered_users';
export const STORAGE_TENANT_CREDENTIALS_KEY = 'katdestate_tenant_credentials';
export const STORAGE_TENANTS_LIST_KEY = 'katdestate_custom_tenants';
export const STORAGE_MANDATE_CREDENTIALS_KEY = 'katdestate_mandate_credentials';

export interface RegisteredUserRecord {
  email: string;
  password?: string | undefined;
  displayName: string;
  role: string;
  phone?: string | undefined;
  createdAt: string;
}

export interface MandateCredentialRecord {
  id: string;
  _id?: string | undefined;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  password: string;
  agencyName?: string | undefined;
  propertyId?: string | undefined;
  propertyName: string;
  scope: 'ALL_PORTFOLIO' | 'PROPERTY';
  permissions: string[];
  commissionRate: number;
  startDate?: string | undefined;
  endDate?: string | undefined;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  notes?: string | undefined;
  createdAt: string;
}

export function getRegisteredUsers(): RegisteredUserRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_REGISTERED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRegisteredUser(user: RegisteredUserRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getRegisteredUsers();
    const normEmail = user.email.trim().toLowerCase();
    const idx = list.findIndex((u) => u.email.trim().toLowerCase() === normEmail);
    const entry: RegisteredUserRecord = {
      ...user,
      email: normEmail,
    };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
    }
    localStorage.setItem(STORAGE_REGISTERED_USERS_KEY, JSON.stringify(list));
  } catch {}
}

export function getMandateCredentials(): MandateCredentialRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_MANDATE_CREDENTIALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMandateCredential(record: MandateCredentialRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getMandateCredentials();
    const normEmail = record.managerEmail.trim().toLowerCase();
    const idx = list.findIndex(
      (m) =>
        m.id === record.id ||
        m._id === record._id ||
        m.managerEmail.trim().toLowerCase() === normEmail,
    );
    const item: MandateCredentialRecord = {
      ...record,
      _id: record._id || record.id,
      managerEmail: normEmail,
    };
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem(STORAGE_MANDATE_CREDENTIALS_KEY, JSON.stringify(list));
  } catch {}
}

export function removeMandateCredential(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getMandateCredentials().filter((m) => m.id !== id && m._id !== id);
    localStorage.setItem(STORAGE_MANDATE_CREDENTIALS_KEY, JSON.stringify(list));
  } catch {}
}

// ============================================================================
// 2. RENT VALIDATION & TENANT STATUS STORE
// ============================================================================

export const STORAGE_RENT_VALIDATIONS_KEY = 'katdestate_rent_validations';

export interface RentValidationRecord {
  tenantId: string;
  tenantName: string;
  tenantEmail?: string | undefined;
  tenantPhone?: string | undefined;
  propertyId?: string | undefined;
  propertyName: string;
  unitName: string;
  unitNumber?: string | undefined;
  monthlyRent: number;
  paidAmount: number;
  status: 'PAID' | 'LATE' | 'UNPAID';
  paymentMethod: string;
  transferNature?: string | undefined;
  period: string;
  paidAt?: string | undefined;
  validatedBy: 'WALLET_AUTO' | 'OWNER_MANUAL';
}

export function getRentValidations(): Record<string, RentValidationRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_RENT_VALIDATIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRentValidation(record: RentValidationRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const map = getRentValidations();
    map[record.tenantId] = record;
    if (record.tenantEmail) {
      map[record.tenantEmail.trim().toLowerCase()] = record;
    }
    localStorage.setItem(STORAGE_RENT_VALIDATIONS_KEY, JSON.stringify(map));
  } catch {}
}

// ============================================================================
// 3. WALLETS STORE (Locataire, Propriétaire Loyers, Propriétaire Quittances)
// ============================================================================

export const STORAGE_TENANT_WALLETS_KEY = 'katdestate_tenant_wallets';
export const STORAGE_OWNER_RENT_WALLET_KEY = 'katdestate_owner_rent_wallet';
export const STORAGE_OWNER_QUITTANCE_WALLET_KEY = 'katdestate_owner_quittance_wallet';

export interface WalletTransaction {
  _id: string;
  type: 'DEPOSIT' | 'TRANSFER_RENT' | 'TRANSFER_QUITTANCE' | 'WITHDRAWAL' | 'MANUAL_VALIDATION';
  amount: number;
  nature: string;
  method: string;
  tenantId?: string | undefined;
  tenantName?: string | undefined;
  tenantEmail?: string | undefined;
  propertyName?: string | undefined;
  unitName?: string | undefined;
  quittanceId?: string | undefined;
  period?: string | undefined;
  createdAt: string;
}

export interface WalletState {
  balance: number;
  totalReceived: number;
  totalWithdrawn: number;
  transactions: WalletTransaction[];
}

export function getTenantWallet(emailOrId: string): WalletState {
  const key = (emailOrId || 'default-tenant').trim().toLowerCase();
  if (typeof window === 'undefined') {
    return { balance: 250000, totalReceived: 250000, totalWithdrawn: 0, transactions: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_TENANT_WALLETS_KEY);
    const all: Record<string, WalletState> = raw ? JSON.parse(raw) : {};
    if (!all[key]) {
      const initial: WalletState = {
        balance: 200000,
        totalReceived: 200000,
        totalWithdrawn: 0,
        transactions: [
          {
            _id: `tx-init-${Date.now()}`,
            type: 'DEPOSIT',
            amount: 200000,
            nature: 'Dépôt initial sur portefeuille locataire KatdEstate',
            method: 'Mobile Money (Wave / Orange Money)',
            createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          },
        ],
      };
      all[key] = initial;
      localStorage.setItem(STORAGE_TENANT_WALLETS_KEY, JSON.stringify(all));
    }
    return all[key];
  } catch {
    return { balance: 200000, totalReceived: 200000, totalWithdrawn: 0, transactions: [] };
  }
}

export function saveTenantWallet(emailOrId: string, state: WalletState): void {
  if (typeof window === 'undefined') return;
  try {
    const key = (emailOrId || 'default-tenant').trim().toLowerCase();
    const raw = localStorage.getItem(STORAGE_TENANT_WALLETS_KEY);
    const all: Record<string, WalletState> = raw ? JSON.parse(raw) : {};
    all[key] = state;
    localStorage.setItem(STORAGE_TENANT_WALLETS_KEY, JSON.stringify(all));
  } catch {}
}

export function depositToTenantWallet(
  emailOrId: string,
  amount: number,
  method: string = 'Mobile Money (Wave / Orange / MTN)',
  note: string = 'Rechargement du portefeuille locataire',
): WalletState {
  const current = getTenantWallet(emailOrId);
  const tx: WalletTransaction = {
    _id: `tx-dep-${Date.now()}`,
    type: 'DEPOSIT',
    amount,
    nature: note,
    method,
    createdAt: new Date().toISOString(),
  };
  const next: WalletState = {
    balance: current.balance + amount,
    totalReceived: current.totalReceived + amount,
    totalWithdrawn: current.totalWithdrawn,
    transactions: [tx, ...current.transactions],
  };
  saveTenantWallet(emailOrId, next);
  return next;
}

export function getOwnerRentWallet(): WalletState {
  if (typeof window === 'undefined') {
    return { balance: 150000, totalReceived: 150000, totalWithdrawn: 0, transactions: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_OWNER_RENT_WALLET_KEY);
    if (!raw) {
      const initial: WalletState = {
        balance: 150000,
        totalReceived: 150000,
        totalWithdrawn: 0,
        transactions: [
          {
            _id: 'tx-rent-init-1',
            type: 'TRANSFER_RENT',
            amount: 150000,
            nature: 'Paiement Loyer Novembre 2026 - Chambre Moderne Porte 3B',
            method: 'Transfert Portefeuille Locataire',
            tenantName: 'Kouamé Jean-Marc',
            propertyName: 'Résidence Katd Les Palmiers',
            unitName: 'Chambre Moderne Porte 3B',
            period: 'Novembre 2026',
            createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
          },
        ],
      };
      localStorage.setItem(STORAGE_OWNER_RENT_WALLET_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return { balance: 150000, totalReceived: 150000, totalWithdrawn: 0, transactions: [] };
  }
}

export function saveOwnerRentWallet(state: WalletState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_OWNER_RENT_WALLET_KEY, JSON.stringify(state));
  } catch {}
}

export function withdrawFromOwnerRentWallet(amount: number, method: string): WalletState {
  const current = getOwnerRentWallet();
  const withdrawAmount = Math.min(current.balance, amount);
  const tx: WalletTransaction = {
    _id: `tx-rent-wd-${Date.now()}`,
    type: 'WITHDRAWAL',
    amount: withdrawAmount,
    nature: `Retrait du Portefeuille Gestion des Loyers vers ${method}`,
    method,
    createdAt: new Date().toISOString(),
  };
  const next: WalletState = {
    balance: Math.max(0, current.balance - withdrawAmount),
    totalReceived: current.totalReceived,
    totalWithdrawn: current.totalWithdrawn + withdrawAmount,
    transactions: [tx, ...current.transactions],
  };
  saveOwnerRentWallet(next);
  return next;
}

export function getOwnerQuittanceWallet(): WalletState {
  if (typeof window === 'undefined') {
    return { balance: 42500, totalReceived: 42500, totalWithdrawn: 0, transactions: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_OWNER_QUITTANCE_WALLET_KEY);
    if (!raw) {
      const initial: WalletState = {
        balance: 42500,
        totalReceived: 42500,
        totalWithdrawn: 0,
        transactions: [
          {
            _id: 'tx-quit-init-1',
            type: 'TRANSFER_QUITTANCE',
            amount: 42500,
            nature: 'Règlement Quittances Eau SODECI & Électricité CIE',
            method: 'Transfert Portefeuille Locataire',
            tenantName: 'Kouamé Jean-Marc',
            propertyName: 'Résidence Katd Les Palmiers',
            unitName: 'Porte 3B',
            period: 'Novembre 2026',
            createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
          },
        ],
      };
      localStorage.setItem(STORAGE_OWNER_QUITTANCE_WALLET_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return { balance: 42500, totalReceived: 42500, totalWithdrawn: 0, transactions: [] };
  }
}

export function saveOwnerQuittanceWallet(state: WalletState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_OWNER_QUITTANCE_WALLET_KEY, JSON.stringify(state));
  } catch {}
}

export function withdrawFromOwnerQuittanceWallet(amount: number, method: string): WalletState {
  const current = getOwnerQuittanceWallet();
  const withdrawAmount = Math.min(current.balance, amount);
  const tx: WalletTransaction = {
    _id: `tx-quit-wd-${Date.now()}`,
    type: 'WITHDRAWAL',
    amount: withdrawAmount,
    nature: `Retrait du Portefeuille Quittances & Factures vers ${method}`,
    method,
    createdAt: new Date().toISOString(),
  };
  const next: WalletState = {
    balance: Math.max(0, current.balance - withdrawAmount),
    totalReceived: current.totalReceived,
    totalWithdrawn: current.totalWithdrawn + withdrawAmount,
    transactions: [tx, ...current.transactions],
  };
  saveOwnerQuittanceWallet(next);
  return next;
}

/**
 * Transfert depuis le portefeuille du locataire vers le portefeuille du propriétaire
 * (Loyer ou Quittance/Facture d'eau/électricité) avec validation automatique !
 */
export function transferFromTenantWalletToOwner(params: {
  tenantKey: string;
  tenantId: string;
  tenantName: string;
  tenantEmail?: string | undefined;
  tenantPhone?: string | undefined;
  propertyId?: string | undefined;
  propertyName: string;
  unitName: string;
  unitNumber?: string | undefined;
  amount: number;
  category: 'RENT' | 'QUITTANCE';
  nature: string;
  period?: string | undefined;
  quittanceId?: string | undefined;
}): { tenantWallet: WalletState; ownerWallet: WalletState } {
  const tenantWallet = getTenantWallet(params.tenantKey);
  if (tenantWallet.balance < params.amount) {
    throw new Error(
      `Solde insuffisant dans votre portefeuille (${tenantWallet.balance.toLocaleString('fr-FR')} FCFA disponibles). Veuillez d'abord faire un dépôt.`,
    );
  }

  const now = new Date().toISOString();
  const txType = params.category === 'RENT' ? 'TRANSFER_RENT' : 'TRANSFER_QUITTANCE';

  const tenantTx: WalletTransaction = {
    _id: `tx-tr-${Date.now()}`,
    type: txType,
    amount: params.amount,
    nature: params.nature,
    method: 'Transfert Portefeuille → Propriétaire',
    tenantId: params.tenantId,
    tenantName: params.tenantName,
    tenantEmail: params.tenantEmail,
    propertyName: params.propertyName,
    unitName: params.unitName,
    quittanceId: params.quittanceId,
    period: params.period || 'Novembre 2026',
    createdAt: now,
  };

  const nextTenantWallet: WalletState = {
    balance: tenantWallet.balance - params.amount,
    totalReceived: tenantWallet.totalReceived,
    totalWithdrawn: tenantWallet.totalWithdrawn + params.amount,
    transactions: [tenantTx, ...tenantWallet.transactions],
  };
  saveTenantWallet(params.tenantKey, nextTenantWallet);

  if (params.category === 'RENT') {
    const ownerRent = getOwnerRentWallet();
    const ownerTx: WalletTransaction = {
      ...tenantTx,
      _id: `tx-own-rent-${Date.now()}`,
      method: `Transfert Portefeuille (${params.nature})`,
    };
    const nextOwnerRent: WalletState = {
      balance: ownerRent.balance + params.amount,
      totalReceived: ownerRent.totalReceived + params.amount,
      totalWithdrawn: ownerRent.totalWithdrawn,
      transactions: [ownerTx, ...ownerRent.transactions],
    };
    saveOwnerRentWallet(nextOwnerRent);

    // Validation automatique du loyer du locataire
    saveRentValidation({
      tenantId: params.tenantId,
      tenantName: params.tenantName,
      tenantEmail: params.tenantEmail,
      tenantPhone: params.tenantPhone,
      propertyId: params.propertyId,
      propertyName: params.propertyName,
      unitName: params.unitName,
      unitNumber: params.unitNumber,
      monthlyRent: params.amount,
      paidAmount: params.amount,
      status: 'PAID',
      paymentMethod: `Transfert Portefeuille (${params.nature})`,
      transferNature: params.nature,
      period: params.period || 'Novembre 2026',
      paidAt: now,
      validatedBy: 'WALLET_AUTO',
    });

    return { tenantWallet: nextTenantWallet, ownerWallet: nextOwnerRent };
  } else {
    const ownerQuit = getOwnerQuittanceWallet();
    const ownerTx: WalletTransaction = {
      ...tenantTx,
      _id: `tx-own-quit-${Date.now()}`,
      method: `Transfert Portefeuille (${params.nature})`,
    };
    const nextOwnerQuit: WalletState = {
      balance: ownerQuit.balance + params.amount,
      totalReceived: ownerQuit.totalReceived + params.amount,
      totalWithdrawn: ownerQuit.totalWithdrawn,
      transactions: [ownerTx, ...ownerQuit.transactions],
    };
    saveOwnerQuittanceWallet(nextOwnerQuit);

    // Marquer automatiquement la quittance comme payée dans les délais !
    const quittances = getStoredQuittances();
    let matched = false;
    const updatedQuittances = quittances.map((q) => {
      if (
        (params.quittanceId && q._id === params.quittanceId) ||
        (!params.quittanceId &&
          q.status === 'PENDING' &&
          (q.tenantId === params.tenantId ||
            q.tenantName.toLowerCase() === params.tenantName.toLowerCase()))
      ) {
        matched = true;
        return {
          ...q,
          status: 'PAID' as const,
          paidAt: now,
          paymentMethod: `Payé dans les délais — Portefeuille (${params.nature})`,
          notes: q.notes ? `${q.notes} · Nature transfert: ${params.nature}` : params.nature,
        };
      }
      return q;
    });

    if (!matched) {
      // Créer une quittance acquittée correspondante si le locataire paie spontanément sa facture d'eau/élec
      const newPaidQuit: QuittanceItem = {
        _id: `quit-wallet-${Date.now()}`,
        number: `QUIT-PORT-${Date.now().toString().slice(-4)}`,
        type: params.nature.toLowerCase().includes('eau')
          ? 'WATER'
          : params.nature.toLowerCase().includes('élec') ||
              params.nature.toLowerCase().includes('cie')
            ? 'ELECTRICITY'
            : 'OTHER',
        typeLabel: params.nature,
        propertyId: params.propertyId || 'prop-default-1',
        propertyName: params.propertyName,
        tenantId: params.tenantId,
        tenantName: params.tenantName,
        tenantPhone: params.tenantPhone,
        tenantEmail: params.tenantEmail,
        amountMinor: params.amount,
        period: params.period || 'Novembre 2026',
        dueDate: now.slice(0, 10),
        status: 'PAID',
        paidAt: now,
        paymentMethod: `Payé dans les délais — Portefeuille (${params.nature})`,
        notes: `Nature du transfert : ${params.nature}`,
        createdAt: now,
      };
      saveStoredQuittances([newPaidQuit, ...updatedQuittances]);
    } else {
      saveStoredQuittances(updatedQuittances);
    }

    return { tenantWallet: nextTenantWallet, ownerWallet: nextOwnerQuit };
  }
}

// ============================================================================
// 4. OWNER <-> TENANT SHARED CHAT MESSAGES STORE
// ============================================================================

export const STORAGE_CHAT_THREADS_KEY = 'katdestate_chat_threads';

export interface ChatReply {
  senderId: string;
  senderName: string;
  senderRole: 'OWNER' | 'TENANT' | 'AGENT';
  body: string;
  createdAt: string;
}

export interface ChatThread {
  _id: string;
  subject: string;
  body: string;
  category: string;
  priority: string;
  status: string;
  senderId: string;
  senderName: string;
  senderRole: 'OWNER' | 'TENANT' | 'AGENT';
  tenantId?: string | undefined;
  tenantName?: string | undefined;
  tenantEmail?: string | undefined;
  propertyName?: string | undefined;
  unitName?: string | undefined;
  recipientName?: string | undefined;
  replies: ChatReply[];
  createdAt: string;
  updatedAt: string;
}

const INITIAL_CHAT_THREADS: ChatThread[] = [
  {
    _id: 'chat-thread-1',
    subject: 'Bienvenue dans votre logement - Résidence Katd Les Palmiers',
    body: 'Bonjour M. Kouamé Jean-Marc, votre contrat de bail numérique ainsi que vos quittances sont accessibles dans votre espace locataire. Vous pouvez également recharger votre portefeuille pour régler votre loyer ou votre facture d’eau.',
    category: 'LEASE',
    priority: 'MEDIUM',
    status: 'OPEN',
    senderId: 'owner-1',
    senderName: 'M. Amadou Diallo (Propriétaire)',
    senderRole: 'OWNER',
    tenantId: 'ten-default-1',
    tenantName: 'Kouamé Jean-Marc',
    tenantEmail: 'jean.kouame@gmail.com',
    propertyName: 'Résidence Katd Les Palmiers',
    unitName: 'Chambre Moderne Porte 3B',
    recipientName: 'Kouamé Jean-Marc',
    replies: [
      {
        senderId: 'ten-default-1',
        senderName: 'Kouamé Jean-Marc (Locataire)',
        senderRole: 'TENANT',
        body: 'Merci beaucoup Monsieur le Propriétaire ! J’ai bien reçu mes identifiants et mon contrat de bail.',
        createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
  },
];

export function getStoredChatThreads(): ChatThread[] {
  if (typeof window === 'undefined') return INITIAL_CHAT_THREADS;
  try {
    const raw = localStorage.getItem(STORAGE_CHAT_THREADS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_CHAT_THREADS_KEY, JSON.stringify(INITIAL_CHAT_THREADS));
      return INITIAL_CHAT_THREADS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_CHAT_THREADS;
  }
}

export function saveStoredChatThreads(threads: ChatThread[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_CHAT_THREADS_KEY, JSON.stringify(threads));
  } catch {}
}

export function createLocalChatThread(params: {
  subject: string;
  body: string;
  category?: string | undefined;
  priority?: string | undefined;
  senderName: string;
  senderRole: 'OWNER' | 'TENANT' | 'AGENT';
  tenantId?: string | undefined;
  tenantName?: string | undefined;
  tenantEmail?: string | undefined;
  propertyName?: string | undefined;
  unitName?: string | undefined;
  recipientName?: string | undefined;
}): ChatThread {
  const now = new Date().toISOString();
  const thread: ChatThread = {
    _id: `chat-${Date.now()}`,
    subject: params.subject,
    body: params.body,
    category: params.category || 'GENERAL',
    priority: params.priority || 'MEDIUM',
    status: 'OPEN',
    senderId: params.senderRole === 'OWNER' ? 'owner-1' : params.tenantId || 'tenant-1',
    senderName: params.senderName,
    senderRole: params.senderRole,
    tenantId: params.tenantId,
    tenantName: params.tenantName,
    tenantEmail: params.tenantEmail,
    propertyName: params.propertyName,
    unitName: params.unitName,
    recipientName: params.recipientName,
    replies: [],
    createdAt: now,
    updatedAt: now,
  };
  const current = getStoredChatThreads();
  saveStoredChatThreads([thread, ...current]);
  return thread;
}

export function replyToLocalChatThread(
  threadId: string,
  reply: {
    senderName: string;
    senderRole: 'OWNER' | 'TENANT' | 'AGENT';
    body: string;
  },
): ChatThread | null {
  const current = getStoredChatThreads();
  let updatedThread: ChatThread | null = null;
  const now = new Date().toISOString();

  const next = current.map((t) => {
    if (t._id === threadId) {
      updatedThread = {
        ...t,
        updatedAt: now,
        replies: [
          ...(t.replies || []),
          {
            senderId: reply.senderRole === 'OWNER' ? 'owner-1' : 'tenant-1',
            senderName: reply.senderName,
            senderRole: reply.senderRole,
            body: reply.body,
            createdAt: now,
          },
        ],
      };
      return updatedThread;
    }
    return t;
  });

  saveStoredChatThreads(next);
  return updatedThread;
}


// ============================================================================
// 6. CHEFFERIE, BLOCS & WORKFLOW ANNONCES STORE
// ============================================================================

export type ListingWorkflowStatus = 'EN_ATTENTE' | 'APPROUVE_BLOC' | 'PUBLIE' | 'REFUSE';

export interface BlockLeaderRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  blockId: string;
  blockName: string;
  neighborhoodId: string;
  neighborhoodName: string;
  createdAt: string;
}

export interface BlockRecord {
  id: string;
  code: string;
  name: string;
  neighborhoodId: string;
  neighborhoodName: string;
  leaderName?: string | undefined;
  leaderEmail?: string | undefined;
  leaderPhone?: string | undefined;
  color?: string | undefined;
  isActive?: boolean | undefined;
  boundary?: GeoJsonBoundary | undefined;
  totalResidences: number;
  totalHabitants: number;
  createdAt: string;
}

export interface NeighborhoodGeoRecord {
  id: string;
  name: string;
  region?: string | undefined;
  department?: string | undefined;
  arrondissement?: string | undefined;
  administrativeAddress?: string | undefined;
  leaderName?: string | undefined;
  leaderEmail?: string | undefined;
  leaderPhone?: string | undefined;
  boundary?: GeoJsonBoundary | undefined;
  updatedAt: string;
}

export interface GeoAuditRecord {
  id: string;
  entityType: 'NEIGHBORHOOD' | 'BLOCK' | 'OWNER' | 'PROPERTY';
  entityId: string;
  entityName: string;
  action: 'CREATE_BOUNDARY' | 'UPDATE_BOUNDARY' | 'REASSIGN_ZONE' | 'DEROGATION_GRANTED' | 'DEACTIVATE';
  performedByName: string;
  performedByRole: string;
  previousBoundary?: GeoJsonBoundary | undefined;
  newBoundary?: GeoJsonBoundary | undefined;
  justification?: string | undefined;
  createdAt: string;
}

export interface BlockOwnerRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  blockId: string;
  blockName: string;
  neighborhoodId?: string | undefined;
  assignedBoundary?: GeoJsonBoundary | undefined;
  propertyName: string;
  propertyType: string;
  monthlyRentOrDues: number;
  status: 'ACTIVE' | 'INACTIVE';
  paymentStatus: 'PAID' | 'PENDING' | 'OVERDUE';
  createdAt: string;
}

export interface HabitantRecord {
  id: string;
  fullName: string;
  phone: string;
  email?: string | undefined;
  blockId: string;
  blockName: string;
  residenceName: string;
  dwellingType: string;
  isOwner: boolean;
  rentOrCotisationAmount: number;
  isPaid: boolean;
  paidAt?: string | undefined;
  createdAt: string;
}

export interface QuartierIncidentRecord {
  id: string;
  title: string;
  description: string;
  category: 'SECURITY' | 'FIRE' | 'SANITATION' | 'NOISE' | 'DISPUTE' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'REPORTED' | 'IN_PROGRESS' | 'RESOLVED';
  blockId: string;
  blockName: string;
  reportedBy: string;
  reporterPhone?: string | undefined;
  resolutionNotes?: string | undefined;
  createdAt: string;
}

export interface QuartierAnnouncementRecord {
  id: string;
  title: string;
  body: string;
  scope: 'BLOCK' | 'ALL_NEIGHBORHOOD';
  blockId?: string | undefined;
  blockName?: string | undefined;
  authorName: string;
  authorRole: string;
  priority: 'NORMAL' | 'URGENT';
  createdAt: string;
}

export interface OfficialCertificateRecord {
  id: string;
  certificateNumber: string;
  type: 'RESIDENCE' | 'CUSTOMARY_LAND_SALE' | 'CESSION' | 'CUSTOMARY_ATTRIBUTION';
  title: string;
  beneficiaryName: string;
  beneficiaryPhone: string;
  beneficiaryNationalId?: string | undefined;
  blockId: string;
  blockName: string;
  plotNumber?: string | undefined;
  surfaceM2?: number | undefined;
  qrCodeUrl: string;
  issuedAt: string;
  issuedByName: string;
  status: 'DELIVERED' | 'REVOKED';
}

export interface WorkflowListingItem {
  _id: string;
  title: string;
  description: string;
  category: string;
  propertyType: string;
  transactionType: 'SALE' | 'RENT';
  billingFrequency?: 'DAILY' | 'MONTHLY' | 'TOTAL' | undefined;
  priceMinor: number;
  currency: string;
  surfaceM2?: number | undefined;
  bedrooms?: number | undefined;
  bathrooms?: number | undefined;
  location: {
    city: string;
    district?: string | undefined;
    blockId?: string | undefined;
    blockName?: string | undefined;
    address?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
  };
  photos: Array<{ url: string; label?: 'EXTERIEUR' | 'INTERIEUR' | 'AUTRE' | undefined; isPrimary?: boolean | undefined }>;
  contact: {
    name: string;
    phone: string;
    whatsapp: string;
    email?: string | undefined;
  };
  authorId?: string | undefined;
  authorRole?: string | undefined;
  authorName?: string | undefined;
  workflowStatus: ListingWorkflowStatus;
  status: 'PUBLISHED' | 'PENDING' | 'REJECTED';
  approvedByBlockLeaderAt?: string | undefined;
  approvedByBlockLeaderName?: string | undefined;
  publishedByNeighborhoodLeaderAt?: string | undefined;
  publishedByNeighborhoodLeaderName?: string | undefined;
  rejectionReason?: string | undefined;
  rejectedByRole?: 'BLOCK_LEADER' | 'NEIGHBORHOOD_LEADER' | undefined;
  rejectedAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export const STORAGE_NEIGHBORHOODS_KEY = 'katdestate_neighborhoods_geo';
export const STORAGE_GEO_AUDIT_KEY = 'katdestate_geo_audit_logs';
export const STORAGE_BLOCK_LEADERS_KEY = 'katdestate_block_leaders';
export const STORAGE_BLOCKS_KEY = 'katdestate_blocks';
export const STORAGE_BLOCK_OWNERS_KEY = 'katdestate_block_owners';
export const STORAGE_HABITANTS_KEY = 'katdestate_habitants';
export const STORAGE_QUARTIER_INCIDENTS_KEY = 'katdestate_quartier_incidents';
export const STORAGE_QUARTIER_ANNOUNCEMENTS_KEY = 'katdestate_quartier_announcements';
export const STORAGE_OFFICIAL_CERTIFICATES_KEY = 'katdestate_official_certificates';

const INITIAL_NEIGHBORHOODS: NeighborhoodGeoRecord[] = [
  {
    id: 'neigh-cocody',
    name: 'Cocody Riviera Palmeraie',
    region: 'District Autonome d’Abidjan',
    department: 'Abidjan',
    arrondissement: 'Cocody',
    administrativeAddress: 'Carrefour Duncan / Riviera Palmeraie, Cocody, Abidjan',
    leaderName: 'Nanan Kouamé N’Guessan',
    leaderEmail: 'chef.quartier@katdestate.immo',
    leaderPhone: '+225 07 00 11 00 01',
    boundary: toGeoJsonPolygon([
      { lat: 5.352, lng: -3.992 },
      { lat: 5.352, lng: -3.964 },
      { lat: 5.376, lng: -3.964 },
      { lat: 5.376, lng: -3.992 },
    ]),
    updatedAt: '2026-01-10T10:00:00Z',
  },
];

// Seed Blocs (délimités sans chevauchement à l'intérieur du quartier Cocody)
const INITIAL_BLOCKS: BlockRecord[] = [
  {
    id: 'block-1',
    code: 'BLOC-PALM-2',
    name: 'Bloc Riviera Palmeraie 2',
    neighborhoodId: 'neigh-cocody',
    neighborhoodName: 'Cocody Riviera Palmeraie',
    leaderName: 'M. Bakary Diarra',
    leaderEmail: 'chef.bloc@katdestate.immo',
    leaderPhone: '+225 07 11 22 33 44',
    color: '#06b6d4',
    isActive: true,
    boundary: toGeoJsonPolygon([
      { lat: 5.360, lng: -3.990 },
      { lat: 5.360, lng: -3.978 },
      { lat: 5.374, lng: -3.978 },
      { lat: 5.374, lng: -3.990 },
    ]),
    totalResidences: 48,
    totalHabitants: 165,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'block-2',
    code: 'BLOC-ROSIERS',
    name: 'Bloc Les Rosiers Programme 3',
    neighborhoodId: 'neigh-cocody',
    neighborhoodName: 'Cocody Riviera Palmeraie',
    leaderName: 'Mme Affoué Konan',
    leaderEmail: 'affoue.konan@katdestate.immo',
    leaderPhone: '+225 05 22 33 44 55',
    color: '#8b5cf6',
    isActive: true,
    boundary: toGeoJsonPolygon([
      { lat: 5.360, lng: -3.978 },
      { lat: 5.360, lng: -3.966 },
      { lat: 5.374, lng: -3.966 },
      { lat: 5.374, lng: -3.978 },
    ]),
    totalResidences: 36,
    totalHabitants: 128,
    createdAt: '2026-01-15T11:00:00Z',
  },
  {
    id: 'block-3',
    code: 'BLOC-AKOUEDO',
    name: 'Bloc Akouédo Attié Extension',
    neighborhoodId: 'neigh-cocody',
    neighborhoodName: 'Cocody Riviera Palmeraie',
    leaderName: 'M. Séka Patrick',
    leaderEmail: 'seka.patrick@katdestate.immo',
    leaderPhone: '+225 07 55 44 33 22',
    color: '#f59e0b',
    isActive: true,
    boundary: toGeoJsonPolygon([
      { lat: 5.353, lng: -3.990 },
      { lat: 5.353, lng: -3.978 },
      { lat: 5.360, lng: -3.978 },
      { lat: 5.360, lng: -3.990 },
    ]),
    totalResidences: 29,
    totalHabitants: 94,
    createdAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'block-4',
    code: 'BLOC-ABATTA',
    name: 'Bloc Abatta Village Sud',
    neighborhoodId: 'neigh-cocody',
    neighborhoodName: 'Cocody Riviera Palmeraie',
    leaderName: 'M. Gnakpa Denis',
    leaderEmail: 'gnakpa.denis@katdestate.immo',
    leaderPhone: '+225 01 44 55 66 77',
    color: '#ec4899',
    isActive: true,
    boundary: toGeoJsonPolygon([
      { lat: 5.353, lng: -3.978 },
      { lat: 5.353, lng: -3.966 },
      { lat: 5.360, lng: -3.966 },
      { lat: 5.360, lng: -3.978 },
    ]),
    totalResidences: 42,
    totalHabitants: 150,
    createdAt: '2026-02-10T08:30:00Z',
  },
];

// Seed Block Leaders
const INITIAL_BLOCK_LEADERS: BlockLeaderRecord[] = [
  {
    id: 'ldr-1',
    name: 'M. Bakary Diarra',
    email: 'chef.bloc@katdestate.immo',
    phone: '+225 07 11 22 33 44',
    password: 'ChefBloc2026!',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    neighborhoodId: 'neigh-cocody',
    neighborhoodName: 'Cocody',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'ldr-2',
    name: 'Mme Affoué Konan',
    email: 'affoue.konan@katdestate.immo',
    phone: '+225 05 22 33 44 55',
    password: 'ChefBloc2026!',
    blockId: 'block-2',
    blockName: 'Bloc Les Rosiers Programme 3',
    neighborhoodId: 'neigh-cocody',
    neighborhoodName: 'Cocody',
    createdAt: '2026-01-15T11:00:00Z',
  },
];

// Seed Habitants
const INITIAL_HABITANTS: HabitantRecord[] = [
  {
    id: 'hab-1',
    fullName: 'Yao Kouadio Serge',
    phone: '+225 07 44 55 66 77',
    email: 'yao.serge@gmail.com',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    residenceName: 'Villa N°14 Rue des Manguiers',
    dwellingType: 'Maison individuelle',
    isOwner: true,
    rentOrCotisationAmount: 15000,
    isPaid: true,
    paidAt: '2026-11-01T10:00:00Z',
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    id: 'hab-2',
    fullName: 'Aïcha Coulibaly',
    phone: '+225 05 55 66 77 88',
    email: 'aicha.coulibaly@yahoo.fr',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    residenceName: 'Cour Commune N°07 Porte B',
    dwellingType: 'Maison en carabot',
    isOwner: false,
    rentOrCotisationAmount: 30000,
    isPaid: false,
    createdAt: '2026-02-15T14:30:00Z',
  },
  {
    id: 'hab-3',
    fullName: 'Mamadou Touré',
    phone: '+225 01 22 33 44 55',
    email: 'toure.mamadou@hotmail.com',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    residenceName: 'Immeuble Le Grand Palmier Apto 3',
    dwellingType: 'Appartement 3 pièces',
    isOwner: false,
    rentOrCotisationAmount: 150000,
    isPaid: true,
    paidAt: '2026-11-03T11:20:00Z',
    createdAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'hab-4',
    fullName: 'Clarisse Bamba',
    phone: '+225 07 99 88 77 66',
    email: 'clarisse.bamba@gmail.com',
    blockId: 'block-2',
    blockName: 'Bloc Les Rosiers Programme 3',
    residenceName: 'Lot 245 Rue des Orchidées',
    dwellingType: 'Villa duplex',
    isOwner: true,
    rentOrCotisationAmount: 20000,
    isPaid: true,
    paidAt: '2026-11-02T16:00:00Z',
    createdAt: '2026-03-10T12:00:00Z',
  },
];

// Seed Block Owners
const INITIAL_BLOCK_OWNERS: BlockOwnerRecord[] = [
  {
    id: 'own-blk-1',
    fullName: 'M. Adama Koné',
    email: 'adama.kone@katdestate.immo',
    phone: '+225 07 33 44 55 66',
    password: 'Proprio2026!',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    neighborhoodId: 'neigh-cocody',
    assignedBoundary: toGeoJsonPolygon([
      { lat: 5.362, lng: -3.988 },
      { lat: 5.362, lng: -3.983 },
      { lat: 5.369, lng: -3.983 },
      { lat: 5.369, lng: -3.988 },
    ]),
    propertyName: 'Immeuble La Paix (8 logements)',
    propertyType: 'Immeuble résidentiel',
    monthlyRentOrDues: 1200000,
    status: 'ACTIVE',
    paymentStatus: 'PAID',
    createdAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'own-blk-2',
    fullName: 'Mme Simone Gnahoré',
    email: 'simone.gnahore@katdestate.immo',
    phone: '+225 05 66 77 88 99',
    password: 'Proprio2026!',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    neighborhoodId: 'neigh-cocody',
    assignedBoundary: toGeoJsonPolygon([
      { lat: 5.362, lng: -3.983 },
      { lat: 5.362, lng: -3.979 },
      { lat: 5.369, lng: -3.979 },
      { lat: 5.369, lng: -3.983 },
    ]),
    propertyName: 'Concession Gnahoré (3 Maisons en carabot)',
    propertyType: 'Maison en carabot',
    monthlyRentOrDues: 90000,
    status: 'ACTIVE',
    paymentStatus: 'PENDING',
    createdAt: '2026-02-12T14:00:00Z',
  },
];

// Seed Incidents
const INITIAL_INCIDENTS: QuartierIncidentRecord[] = [
  {
    id: 'inc-1',
    title: 'Coupure éclairage public Carrefour Duncan',
    description: 'Le candélabre principal ne fonctionne plus depuis 48h, zone sombre propice aux agressions.',
    category: 'SECURITY',
    severity: 'MEDIUM',
    status: 'REPORTED',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    reportedBy: 'Kouamé Jean (Habitant)',
    reporterPhone: '+225 07 00 11 22 33',
    createdAt: '2026-11-05T19:30:00Z',
  },
  {
    id: 'inc-2',
    title: 'Caniveau bouché avec risque de débordement',
    description: 'Encombrement de déchets plastiques après la dernière pluie devant la pharmacie.',
    category: 'SANITATION',
    severity: 'LOW',
    status: 'IN_PROGRESS',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    reportedBy: 'Bakary Diarra (Chef de Bloc)',
    reporterPhone: '+225 07 11 22 33 44',
    resolutionNotes: 'Équipe de curage municipale contactée',
    createdAt: '2026-11-04T10:15:00Z',
  },
];

// Seed Workflow Listings (including Maison en carabot)
const INITIAL_WORKFLOW_LISTINGS: WorkflowListingItem[] = [
  {
    _id: 'wlist-1',
    title: 'Maison en carabot moderne rénovée avec cour privative',
    description: 'Authentique maison en carabot parfaitement ventilée et renforcée. Composée d’un salon carrelé, une chambre séparée, point d’eau individuel et compteur prépayé. Proximité axe principal.',
    category: 'CARABOT',
    propertyType: 'CARABOT',
    transactionType: 'RENT',
    billingFrequency: 'MONTHLY',
    priceMinor: 35000,
    currency: 'FCFA',
    surfaceM2: 28,
    bedrooms: 1,
    bathrooms: 1,
    location: {
      city: 'Abidjan',
      district: 'Cocody Riviera Palmeraie',
      blockId: 'block-1',
      blockName: 'Bloc Riviera Palmeraie 2',
      address: 'Rue L12, Carré 4',
      latitude: 5.3621,
      longitude: -3.9785,
    },
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
        label: 'EXTERIEUR',
        isPrimary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        label: 'INTERIEUR',
      },
    ],
    contact: {
      name: 'Mme Simone Gnahoré',
      phone: '+225 05 66 77 88 99',
      whatsapp: '+2250566778899',
      email: 'simone.gnahore@katdestate.immo',
    },
    authorId: 'own-blk-2',
    authorRole: 'OWNER',
    authorName: 'Mme Simone Gnahoré',
    workflowStatus: 'PUBLIE',
    status: 'PUBLISHED',
    approvedByBlockLeaderAt: '2026-11-02T14:00:00Z',
    approvedByBlockLeaderName: 'M. Bakary Diarra',
    publishedByNeighborhoodLeaderAt: '2026-11-03T09:00:00Z',
    publishedByNeighborhoodLeaderName: 'Nanan Kouamé N’Guessan',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-03T09:00:00Z',
  },
  {
    _id: 'wlist-2',
    title: 'Maison en carabot 2 Chambres avec Terrasse Ombragée',
    description: 'Charmant logement en carabot de 32m² idéal pour jeune couple. 2 chambres, terrasse avant, installation électrique aux normes et eau potable disponible.',
    category: 'CARABOT',
    propertyType: 'CARABOT',
    transactionType: 'RENT',
    billingFrequency: 'MONTHLY',
    priceMinor: 45000,
    currency: 'FCFA',
    surfaceM2: 32,
    bedrooms: 2,
    bathrooms: 1,
    location: {
      city: 'Abidjan',
      district: 'Cocody Riviera Palmeraie',
      blockId: 'block-1',
      blockName: 'Bloc Riviera Palmeraie 2',
      address: 'Derrière le collège moderne',
      latitude: 5.364,
      longitude: -3.98,
    },
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
        label: 'EXTERIEUR',
        isPrimary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
        label: 'INTERIEUR',
      },
    ],
    contact: {
      name: 'Yao Kouadio Serge',
      phone: '+225 07 44 55 66 77',
      whatsapp: '+2250744556677',
      email: 'yao.serge@gmail.com',
    },
    authorId: 'hab-1',
    authorRole: 'RESIDENT',
    authorName: 'Yao Kouadio Serge',
    workflowStatus: 'APPROUVE_BLOC',
    status: 'PENDING',
    approvedByBlockLeaderAt: '2026-11-06T11:00:00Z',
    approvedByBlockLeaderName: 'M. Bakary Diarra',
    createdAt: '2026-11-05T15:00:00Z',
    updatedAt: '2026-11-06T11:00:00Z',
  },
  {
    _id: 'wlist-3',
    title: 'Studio Moderne Climatisation Riviera Palmeraie',
    description: 'Studio neuf carrelé dans immeuble sécurisé avec gardien. Balcon, placard et cuisine équipée.',
    category: 'STUDIO_MODERNE',
    propertyType: 'STUDIO_MODERNE',
    transactionType: 'RENT',
    billingFrequency: 'MONTHLY',
    priceMinor: 110000,
    currency: 'FCFA',
    surfaceM2: 35,
    bedrooms: 1,
    bathrooms: 1,
    location: {
      city: 'Abidjan',
      district: 'Cocody Riviera Palmeraie',
      blockId: 'block-1',
      blockName: 'Bloc Riviera Palmeraie 2',
      address: 'Boulevard Mitterrand',
    },
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        isPrimary: true,
      },
    ],
    contact: {
      name: 'M. Adama Koné',
      phone: '+225 07 33 44 55 66',
      whatsapp: '+2250733445566',
      email: 'adama.kone@katdestate.immo',
    },
    authorId: 'own-blk-1',
    authorRole: 'OWNER',
    authorName: 'M. Adama Koné',
    workflowStatus: 'EN_ATTENTE',
    status: 'PENDING',
    createdAt: '2026-11-07T08:00:00Z',
    updatedAt: '2026-11-07T08:00:00Z',
  },
];

// Seed Certificates
const INITIAL_CERTIFICATES: OfficialCertificateRecord[] = [
  {
    id: 'cert-1',
    certificateNumber: 'ACT-CHEFF-2026-0042',
    type: 'RESIDENCE',
    title: 'Certificat de Résidence & Recensement Coutumier',
    beneficiaryName: 'Yao Kouadio Serge',
    beneficiaryPhone: '+225 07 44 55 66 77',
    beneficiaryNationalId: 'CNI-CI-01293847',
    blockId: 'block-1',
    blockName: 'Bloc Riviera Palmeraie 2',
    plotNumber: 'Lot 14 Îlot 3',
    surfaceM2: 350,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=KATDESTATE-CERT-0042-VERIFIED',
    issuedAt: '2026-10-15T10:00:00Z',
    issuedByName: 'Nanan Kouamé N’Guessan',
    status: 'DELIVERED',
  },
];

// Helper functions for Blocs
export function getStoredBlocks(): BlockRecord[] {
  if (typeof window === 'undefined') return INITIAL_BLOCKS;
  try {
    const raw = localStorage.getItem(STORAGE_BLOCKS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(INITIAL_BLOCKS));
      return INITIAL_BLOCKS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_BLOCKS;
  }
}

export function saveStoredBlocks(blocks: BlockRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(blocks));
  } catch {}
}

export function createBlock(block: Omit<BlockRecord, 'id' | 'createdAt'>): BlockRecord {
  const newBlock: BlockRecord = {
    ...block,
    id: `block-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const list = getStoredBlocks();
  saveStoredBlocks([...list, newBlock]);
  return newBlock;
}

// Helper functions for Block Leaders
export function getBlockLeaders(): BlockLeaderRecord[] {
  if (typeof window === 'undefined') return INITIAL_BLOCK_LEADERS;
  try {
    const raw = localStorage.getItem(STORAGE_BLOCK_LEADERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_BLOCK_LEADERS_KEY, JSON.stringify(INITIAL_BLOCK_LEADERS));
      return INITIAL_BLOCK_LEADERS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_BLOCK_LEADERS;
  }
}

export function saveBlockLeader(leader: BlockLeaderRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getBlockLeaders();
    const normEmail = leader.email.trim().toLowerCase();
    const idx = list.findIndex(
      (l) => l.id === leader.id || l.email.trim().toLowerCase() === normEmail,
    );
    const item: BlockLeaderRecord = {
      ...leader,
      email: normEmail,
    };
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem(STORAGE_BLOCK_LEADERS_KEY, JSON.stringify(list));

    // Also link block's leaderName & leaderEmail
    const blocks = getStoredBlocks();
    const bIdx = blocks.findIndex((b) => b.id === leader.blockId);
    if (bIdx >= 0 && blocks[bIdx]) {
      const bObj = blocks[bIdx]!;
      blocks[bIdx] = {
        ...bObj,
        leaderName: leader.name,
        leaderEmail: normEmail,
      };
      saveStoredBlocks(blocks);
    }
  } catch {}
}

export function deleteBlockLeader(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getBlockLeaders().filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_BLOCK_LEADERS_KEY, JSON.stringify(list));
  } catch {}
}

// Helper functions for Block Owners (created by Chef de Bloc)
export function getBlockOwners(): BlockOwnerRecord[] {
  if (typeof window === 'undefined') return INITIAL_BLOCK_OWNERS;
  try {
    const raw = localStorage.getItem(STORAGE_BLOCK_OWNERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_BLOCK_OWNERS_KEY, JSON.stringify(INITIAL_BLOCK_OWNERS));
      return INITIAL_BLOCK_OWNERS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_BLOCK_OWNERS;
  }
}

export function saveBlockOwner(owner: BlockOwnerRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getBlockOwners();
    const normEmail = owner.email.trim().toLowerCase();
    const idx = list.findIndex(
      (o) => o.id === owner.id || o.email.trim().toLowerCase() === normEmail,
    );
    const item: BlockOwnerRecord = {
      ...owner,
      email: normEmail,
    };
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem(STORAGE_BLOCK_OWNERS_KEY, JSON.stringify(list));
  } catch {}
}

// Helper functions for Habitants
export function getStoredHabitants(): HabitantRecord[] {
  if (typeof window === 'undefined') return INITIAL_HABITANTS;
  try {
    const raw = localStorage.getItem(STORAGE_HABITANTS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_HABITANTS_KEY, JSON.stringify(INITIAL_HABITANTS));
      return INITIAL_HABITANTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_HABITANTS;
  }
}

export function saveStoredHabitant(habitant: HabitantRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getStoredHabitants();
    const idx = list.findIndex((h) => h.id === habitant.id);
    if (idx >= 0) {
      list[idx] = habitant;
    } else {
      list.unshift(habitant);
    }
    localStorage.setItem(STORAGE_HABITANTS_KEY, JSON.stringify(list));
  } catch {}
}

export function reassignHabitantBlock(habitantId: string, newBlockId: string, newBlockName: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getStoredHabitants();
    const idx = list.findIndex((h) => h.id === habitantId);
    if (idx >= 0 && list[idx]) {
      const hObj = list[idx]!;
      list[idx] = {
        ...hObj,
        blockId: newBlockId,
        blockName: newBlockName,
      };
      localStorage.setItem(STORAGE_HABITANTS_KEY, JSON.stringify(list));
    }
  } catch {}
}

// Helper functions for Incidents
export function getStoredIncidents(): QuartierIncidentRecord[] {
  if (typeof window === 'undefined') return INITIAL_INCIDENTS;
  try {
    const raw = localStorage.getItem(STORAGE_QUARTIER_INCIDENTS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_QUARTIER_INCIDENTS_KEY, JSON.stringify(INITIAL_INCIDENTS));
      return INITIAL_INCIDENTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_INCIDENTS;
  }
}

export function saveStoredIncident(incident: QuartierIncidentRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getStoredIncidents();
    const idx = list.findIndex((i) => i.id === incident.id);
    if (idx >= 0) {
      list[idx] = incident;
    } else {
      list.unshift(incident);
    }
    localStorage.setItem(STORAGE_QUARTIER_INCIDENTS_KEY, JSON.stringify(list));
  } catch {}
}

// Helper functions for Workflow Listings
export function getWorkflowListings(): WorkflowListingItem[] {
  if (typeof window === 'undefined') return INITIAL_WORKFLOW_LISTINGS;
  try {
    const raw = localStorage.getItem('katdestate_custom_listings');
    if (!raw) {
      localStorage.setItem('katdestate_custom_listings', JSON.stringify(INITIAL_WORKFLOW_LISTINGS));
      return INITIAL_WORKFLOW_LISTINGS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem('katdestate_custom_listings', JSON.stringify(INITIAL_WORKFLOW_LISTINGS));
      return INITIAL_WORKFLOW_LISTINGS;
    }
    // ensure each listing has a valid workflowStatus
    return parsed.map((item: any) => ({
      ...item,
      workflowStatus: item.workflowStatus || (item.status === 'PUBLISHED' ? 'PUBLIE' : 'EN_ATTENTE'),
      status: item.status || (item.workflowStatus === 'PUBLIE' ? 'PUBLISHED' : 'PENDING'),
    }));
  } catch {
    return INITIAL_WORKFLOW_LISTINGS;
  }
}

export function saveWorkflowListings(listings: WorkflowListingItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('katdestate_custom_listings', JSON.stringify(listings));
  } catch {}
}

export function createWorkflowListing(payload: Omit<WorkflowListingItem, '_id' | 'createdAt' | 'updatedAt' | 'workflowStatus' | 'status'> & { workflowStatus?: ListingWorkflowStatus | undefined }): WorkflowListingItem {
  const now = new Date().toISOString();
  const wfStatus = payload.workflowStatus || 'EN_ATTENTE';
  const newItem: WorkflowListingItem = {
    ...payload,
    _id: `listing-${Date.now()}`,
    workflowStatus: wfStatus,
    status: wfStatus === 'PUBLIE' ? 'PUBLISHED' : 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
  const list = getWorkflowListings();
  saveWorkflowListings([newItem, ...list]);
  return newItem;
}

export function updateListingWorkflow(
  listingId: string,
  updates: {
    workflowStatus: ListingWorkflowStatus;
    rejectionReason?: string | undefined;
    actorRole: 'BLOCK_LEADER' | 'NEIGHBORHOOD_LEADER';
    actorName: string;
  },
): WorkflowListingItem | null {
  const list = getWorkflowListings();
  const idx = list.findIndex((l) => l._id === listingId);
  if (idx < 0) return null;

  const now = new Date().toISOString();
  const item = list[idx]!;

  const updated: WorkflowListingItem = {
    ...item,
    workflowStatus: updates.workflowStatus,
    status: updates.workflowStatus === 'PUBLIE' ? 'PUBLISHED' : updates.workflowStatus === 'REFUSE' ? 'REJECTED' : 'PENDING',
    updatedAt: now,
    ...(updates.workflowStatus === 'APPROUVE_BLOC'
      ? {
          approvedByBlockLeaderAt: now,
          approvedByBlockLeaderName: updates.actorName,
          rejectionReason: undefined,
        }
      : {}),
    ...(updates.workflowStatus === 'PUBLIE'
      ? {
          publishedByNeighborhoodLeaderAt: now,
          publishedByNeighborhoodLeaderName: updates.actorName,
          rejectionReason: undefined,
        }
      : {}),
    ...(updates.workflowStatus === 'REFUSE'
      ? {
          rejectionReason: updates.rejectionReason || 'Non conforme aux normes du quartier',
          rejectedByRole: updates.actorRole,
          rejectedAt: now,
        }
      : {}),
  };

  list[idx] = updated;
  saveWorkflowListings(list);
  return updated;
}

export function deleteWorkflowListingPermanently(listingId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const list = getWorkflowListings().filter((l) => l._id !== listingId);
    saveWorkflowListings(list);
    return true;
  } catch {
    return false;
  }
}

// Helper functions for Official Certificates
export function getOfficialCertificates(): OfficialCertificateRecord[] {
  if (typeof window === 'undefined') return INITIAL_CERTIFICATES;
  try {
    const raw = localStorage.getItem(STORAGE_OFFICIAL_CERTIFICATES_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_OFFICIAL_CERTIFICATES_KEY, JSON.stringify(INITIAL_CERTIFICATES));
      return INITIAL_CERTIFICATES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_CERTIFICATES;
  }
}

export function saveOfficialCertificate(cert: OfficialCertificateRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getOfficialCertificates();
    list.unshift(cert);
    localStorage.setItem(STORAGE_OFFICIAL_CERTIFICATES_KEY, JSON.stringify(list));
  } catch {}
}

// ============================================================================
// 5. CARTOGRAPHIE GÉOGRAPHIQUE 3 NIVEAUX (Quartiers, Blocs, Propriétaires, Audit)
// ============================================================================

export function getStoredNeighborhoods(): NeighborhoodGeoRecord[] {
  if (typeof window === 'undefined') return INITIAL_NEIGHBORHOODS;
  try {
    const raw = localStorage.getItem(STORAGE_NEIGHBORHOODS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_NEIGHBORHOODS_KEY, JSON.stringify(INITIAL_NEIGHBORHOODS));
      return INITIAL_NEIGHBORHOODS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_NEIGHBORHOODS;
  }
}

export function saveNeighborhoodGeo(record: NeighborhoodGeoRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getStoredNeighborhoods();
    const idx = list.findIndex((n) => n.id === record.id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(STORAGE_NEIGHBORHOODS_KEY, JSON.stringify(list));
  } catch {}
}

export function updateStoredBlock(blockId: string, patch: Partial<BlockRecord>): BlockRecord | null {
  const list = getStoredBlocks();
  const idx = list.findIndex((b) => b.id === blockId);
  if (idx < 0 || !list[idx]) return null;
  const updated: BlockRecord = { ...list[idx]!, ...patch };
  list[idx] = updated;
  saveStoredBlocks(list);
  return updated;
}

export function getGeoAuditLogsLocal(): GeoAuditRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_GEO_AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function appendGeoAuditLogLocal(entry: Omit<GeoAuditRecord, 'id' | 'createdAt'>): GeoAuditRecord {
  const full: GeoAuditRecord = {
    ...entry,
    id: `geolog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      const list = getGeoAuditLogsLocal();
      list.unshift(full);
      localStorage.setItem(STORAGE_GEO_AUDIT_KEY, JSON.stringify(list.slice(0, 200)));
    } catch {}
  }
  return full;
}
