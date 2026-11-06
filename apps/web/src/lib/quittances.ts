export interface QuittanceItem {
  _id: string;
  number: string;
  type: 'WATER' | 'ELECTRICITY' | 'RENT' | 'CHARGES' | 'OTHER';
  typeLabel: string;
  propertyId: string;
  propertyName: string;
  tenantId: string;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  amountMinor: number;
  period: string;
  dueDate: string;
  status: 'PENDING' | 'PAID';
  meterIndex?: string;
  notes?: string;
  paidAt?: string;
  paymentMethod?: string;
  createdAt: string;
}

export const STORAGE_QUITTANCES_KEY = 'katdestate_quittances_records';

export const INITIAL_QUITTANCES: QuittanceItem[] = [
  {
    _id: 'quit-001',
    number: 'QUIT-EAU-2026-001',
    type: 'WATER',
    typeLabel: 'Facture Eau (SODECI)',
    propertyId: 'prop-default-1',
    propertyName: 'Résidence Katd Les Palmiers (Cocody)',
    tenantId: 'ten-default-1',
    tenantName: 'Kouamé Jean-Marc',
    tenantPhone: '+225 07 12 34 56 78',
    tenantEmail: 'jean.kouame@gmail.com',
    amountMinor: 14500,
    period: 'Octobre - Novembre 2026',
    dueDate: '2026-11-20',
    status: 'PENDING',
    meterIndex: 'Index Ancien: 4210 - Nouveau: 4235 (25 m³)',
    notes: 'Consommation privative d’eau compteur N°4',
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'quit-002',
    number: 'QUIT-ELEC-2026-002',
    type: 'ELECTRICITY',
    typeLabel: 'Facture Électricité (CIE)',
    propertyId: 'prop-default-1',
    propertyName: 'Résidence Katd Les Palmiers (Cocody)',
    tenantId: 'ten-default-1',
    tenantName: 'Kouamé Jean-Marc',
    tenantPhone: '+225 07 12 34 56 78',
    tenantEmail: 'jean.kouame@gmail.com',
    amountMinor: 28000,
    period: 'Octobre - Novembre 2026',
    dueDate: '2026-11-25',
    status: 'PENDING',
    meterIndex: 'Index compteur prépayé CIE N° 014785',
    notes: 'Recharge crédit électricité & disjoncteur',
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'quit-003',
    number: 'QUIT-LOYER-2026-003',
    type: 'RENT',
    typeLabel: 'Quittance de Loyer d’Habitation',
    propertyId: 'prop-default-1',
    propertyName: 'Résidence Katd Les Palmiers (Cocody)',
    tenantId: 'ten-default-1',
    tenantName: 'Kouamé Jean-Marc',
    tenantPhone: '+225 07 12 34 56 78',
    tenantEmail: 'jean.kouame@gmail.com',
    amountMinor: 150000,
    period: 'Novembre 2026',
    dueDate: '2026-11-05',
    status: 'PAID',
    paidAt: new Date().toISOString(),
    paymentMethod: 'iKeepay Mobile Money (Wave)',
    notes: 'Règlement loyer Chambre Moderne Porte 3B',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
];

export function getStoredQuittances(): QuittanceItem[] {
  if (typeof window === 'undefined') return INITIAL_QUITTANCES;
  try {
    const raw = localStorage.getItem(STORAGE_QUITTANCES_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_QUITTANCES_KEY, JSON.stringify(INITIAL_QUITTANCES));
      return INITIAL_QUITTANCES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_QUITTANCES;
  }
}

export function saveStoredQuittances(items: QuittanceItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_QUITTANCES_KEY, JSON.stringify(items));
  } catch {}
}

export function markQuittanceAsPaid(id: string, method: string = 'iKeepay Mobile Money'): void {
  const items = getStoredQuittances();
  const updated = items.map((q) => {
    if (q._id === id) {
      return {
        ...q,
        status: 'PAID' as const,
        paidAt: new Date().toISOString(),
        paymentMethod: method,
      };
    }
    return q;
  });
  saveStoredQuittances(updated);
}
