import { useState } from 'react';
import { Briefcase, CheckCircle2, ShieldCheck, UserCheck, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';

export interface DelegationData {
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  agencyName?: string;
  scope: 'ALL_PORTFOLIO' | 'PROPERTY';
  permissions: string[];
  commissionRate: number;
  startDate?: string;
  endDate?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  notes?: string;
}

interface PropertyDelegationModalProps {
  propertyName: string;
  propertyId: string;
  initial?: DelegationData;
  onSave: (data: DelegationData) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export function PropertyDelegationModal({
  propertyName,
  initial,
  onSave,
  onClose,
  isSubmitting = false,
}: PropertyDelegationModalProps) {
  const { toast } = useToast();
  const [managerName, setManagerName] = useState(initial?.managerName || '');
  const [managerEmail, setManagerEmail] = useState(initial?.managerEmail || '');
  const [managerPhone, setManagerPhone] = useState(initial?.managerPhone || '');
  const [agencyName, setAgencyName] = useState(initial?.agencyName || '');
  const [scope, setScope] = useState<'ALL_PORTFOLIO' | 'PROPERTY'>(initial?.scope || 'PROPERTY');
  const [commissionRate, setCommissionRate] = useState(initial?.commissionRate ?? 8);
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 10) || '');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'REVOKED'>(initial?.status || 'ACTIVE');
  const [notes, setNotes] = useState(initial?.notes || '');

  const [permissions, setPermissions] = useState<string[]>(
    initial?.permissions || ['COLLECTION', 'LEASES', 'MAINTENANCE', 'VISITS']
  );

  const togglePermission = (perm: string) => {
    if (permissions.includes(perm)) {
      setPermissions(permissions.filter((p) => p !== perm));
    } else {
      setPermissions([...permissions, perm]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerName.trim()) {
      toast({ title: 'Le nom du mandataire est requis', variant: 'error' });
      return;
    }
    if (!managerPhone.trim() && !managerEmail.trim()) {
      toast({ title: 'Veuillez renseigner au moins un téléphone ou un email pour le mandataire', variant: 'error' });
      return;
    }

    onSave({
      managerName: managerName.trim(),
      managerEmail: managerEmail.trim(),
      managerPhone: managerPhone.trim(),
      agencyName: agencyName.trim() || undefined,
      scope,
      permissions,
      commissionRate: Number(commissionRate) || 0,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-7 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Briefcase className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-black">Délégation de Gestion / Mandat</h3>
              <p className="text-xs text-muted-foreground">{propertyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Périmètre */}
          <div className="space-y-1.5">
            <span className="font-semibold text-muted-foreground uppercase text-[11px]">Périmètre de la délégation</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('PROPERTY')}
                className={`p-3 rounded-xl border text-left transition ${
                  scope === 'PROPERTY'
                    ? 'border-amber-500 bg-amber-500/10 text-foreground font-bold'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                <span className="block font-semibold">Cette propriété</span>
                <span className="text-[10px] text-muted-foreground">{propertyName}</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('ALL_PORTFOLIO')}
                className={`p-3 rounded-xl border text-left transition ${
                  scope === 'ALL_PORTFOLIO'
                    ? 'border-amber-500 bg-amber-500/10 text-foreground font-bold'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                <span className="block font-semibold">Tout le patrimoine</span>
                <span className="text-[10px] text-muted-foreground">Toutes vos propriétés</span>
              </button>
            </div>
          </div>

          {/* Mandataire / Gérant */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-foreground font-bold text-xs">
              <UserCheck className="size-4 text-amber-500" />
              <span>Identité du Mandataire ou Gestionnaire</span>
            </div>

            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Nom complet de la personne déléguée *</span>
              <Input
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Ex: M. Kouassi Stéphane ou Cabinet Immo Pro"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-muted-foreground font-medium">Téléphone / WhatsApp</span>
                <Input
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  placeholder="+225 07..."
                />
              </label>

              <label className="block space-y-1">
                <span className="text-muted-foreground font-medium">Email</span>
                <Input
                  type="email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  placeholder="gerant@domaine.com"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Agence ou Entreprise (optionnel)</span>
              <Input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ex: Agence Immobilière Abidjan Sud"
              />
            </label>
          </div>

          {/* Droits & Permissions délégués */}
          <div className="space-y-2">
            <span className="font-semibold text-muted-foreground uppercase text-[11px]">Droits & Missions délégués</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'COLLECTION', label: 'Encaissement des loyers' },
                { id: 'LEASES', label: 'Gestion des locataires & baux' },
                { id: 'MAINTENANCE', label: 'Suivi des travaux & pannes' },
                { id: 'VISITS', label: 'Visites & annonces marketplace' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => togglePermission(item.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition ${
                    permissions.includes(item.id)
                      ? 'border-emerald-500 bg-emerald-500/10 font-bold text-foreground'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <span>{item.label}</span>
                  {permissions.includes(item.id) && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* Rémunération & Durée */}
          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Commission (%)</span>
              <Input
                type="number"
                min="0"
                max="100"
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Début mandat</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Fin mandat (optionnel)</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          {/* Statut de la délégation */}
          <div className="space-y-1">
            <span className="text-muted-foreground font-medium">Statut de la délégation</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'SUSPENDED' | 'REVOKED')}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
            >
              <option value="ACTIVE">Actif (Délégation en vigueur)</option>
              <option value="SUSPENDED">Suspendu temporairement</option>
              <option value="REVOKED">Révoqué (Mandat terminé)</option>
            </select>
          </div>

          <label className="block space-y-1">
            <span className="text-muted-foreground font-medium">Instructions & Notes confidentielles</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions particulières de gestion..."
              className="w-full rounded-xl border border-input bg-background p-2.5 text-xs"
            />
          </label>

          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Le mandataire désigné sera habilité à représenter le propriétaire dans la limite des missions conférées et conformément au droit OHADA.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
            >
              {isSubmitting ? 'Enregistrement...' : 'Valider la délégation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
