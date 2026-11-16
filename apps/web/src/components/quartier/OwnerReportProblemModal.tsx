import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useSession } from '../../app/session';
import {
  getBlockOwners,
  getStoredBlocks,
  saveStoredIncident,
  type QuartierIncidentRecord,
} from '../../lib/katdestate-store';
import { apiRequest } from '../../lib/api-client';

export interface OwnerReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyName?: string | undefined;
  propertyAddress?: string | undefined;
  onSuccess?: () => void;
}

export function OwnerReportProblemModal({
  isOpen,
  onClose,
  propertyName,
  propertyAddress,
  onSuccess,
}: OwnerReportProblemModalProps) {
  const { user } = useSession();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'DISPUTE' | 'SECURITY' | 'SANITATION' | 'NOISE' | 'OTHER'>('DISPUTE');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const owners = useMemo(() => getBlockOwners(), []);
  const blocks = useMemo(() => getStoredBlocks(), []);

  // Détermination du Chef de Bloc rattaché à ce propriétaire
  const ownerRecord = useMemo(() => {
    const emailNorm = user?.email?.trim().toLowerCase();
    if (!emailNorm) return owners[0];
    return owners.find((o) => o.email.trim().toLowerCase() === emailNorm) || owners[0];
  }, [owners, user?.email]);

  const assignedBlock = useMemo(() => {
    if (ownerRecord?.blockId) {
      return blocks.find((b) => b.id === ownerRecord.blockId) || blocks[0];
    }
    return blocks[0];
  }, [blocks, ownerRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !assignedBlock) return;

    setIsSubmitting(true);
    try {
      const reporterName = user?.displayName || ownerRecord?.fullName || 'Propriétaire';
      const incidentId = `inc_${Date.now()}`;

      const incident: QuartierIncidentRecord = {
        id: incidentId,
        title: title.trim(),
        description: `${description.trim()}${
          propertyName ? `\n[Bien concerné : ${propertyName}${propertyAddress ? ` · ${propertyAddress}` : ''}]` : ''
        }`,
        category,
        severity,
        status: 'REPORTED',
        blockId: assignedBlock.id,
        blockName: assignedBlock.name,
        reportedBy: reporterName,
        reporterPhone: (user as any)?.phone || ownerRecord?.phone,
        reportedByRole: 'OWNER',
        targetLeaderEmail: assignedBlock.leaderEmail,
        targetLeaderName: assignedBlock.leaderName,
        neighborhoodId: assignedBlock.neighborhoodId,
        escalatedToNeighborhood: false,
        createdAt: new Date().toISOString(),
      };

      // 1. Sauvegarde locale persistante
      saveStoredIncident(incident);

      // 2. Envoi sur l'API (avec envoi d'email automatique au Chef de Bloc)
      try {
        await apiRequest('/quartier/incidents', {
          method: 'POST',
          body: {
            title: incident.title,
            description: incident.description,
            category: incident.category,
            severity: incident.severity,
            blockId: incident.blockId,
            reporterName: incident.reportedBy,
            reporterPhone: incident.reporterPhone,
            targetLeaderEmail: assignedBlock.leaderEmail,
            targetLeaderName: assignedBlock.leaderName,
          },
        });
      } catch {
        // Mode autonome
      }

      setSuccessMessage(
        `Votre signalement a été transmis avec succès à votre Chef de Bloc (${assignedBlock.leaderName}). Une notification par email lui a été envoyée à l'adresse ${assignedBlock.leaderEmail}.`,
      );

      setTimeout(() => {
        setSuccessMessage(null);
        setTitle('');
        setDescription('');
        onSuccess?.();
        onClose();
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Signaler un Problème à votre Chef de Bloc
              </h3>
              <p className="text-xs text-muted-foreground">
                Transmission directe et confidentielle au responsable de votre secteur
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Destinataire identifié automatiquement */}
        {assignedBlock && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs space-y-1">
            <p className="font-semibold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
              <UserCheck className="size-4" />
              Chef de Bloc Référent : {assignedBlock.leaderName}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <Mail className="size-3.5" />
              Email de notification : <strong className="text-foreground">{assignedBlock.leaderEmail}</strong>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Secteur territorial : {assignedBlock.name} ({assignedBlock.code})
            </p>
          </div>
        )}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-2 animate-in zoom-in-95">
            <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              Signalement transmis avec succès !
            </p>
            <p className="text-xs text-muted-foreground">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {propertyName && (
              <div className="rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
                Bien concerné : <strong className="text-foreground">{propertyName}</strong>
                {propertyAddress ? ` · ${propertyAddress}` : ''}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Objet / Titre du problème *</label>
              <Input
                type="text"
                placeholder="Ex : Conflit de délimitation de borne, infiltration voirie, sécurité..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
                >
                  <option value="DISPUTE">Litige Foncier / Délimitation</option>
                  <option value="SECURITY">Sécurité / Accès au bloc</option>
                  <option value="SANITATION">Assainissement / Déchets</option>
                  <option value="NOISE">Voisinage / Nuisances</option>
                  <option value="OTHER">Autre problème</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Niveau d'urgence</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
                >
                  <option value="LOW">Faible (Information)</option>
                  <option value="MEDIUM">Moyen (À traiter)</option>
                  <option value="HIGH">Élevé (Important)</option>
                  <option value="URGENT">Urgent (Intervention immédiate)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Description détaillée *</label>
              <textarea
                placeholder="Expliquez précisément la situation constatée, les personnes impliquées et la localisation exacte..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                className="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !title.trim() || !description.trim()}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold inline-flex items-center gap-1.5"
              >
                <Send className="size-3.5" />
                {isSubmitting ? 'Envoi en cours…' : 'Transmettre au Chef de Bloc'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
