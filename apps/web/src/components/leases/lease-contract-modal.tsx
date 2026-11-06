import { Printer, ShieldCheck, X, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';

export interface LeaseContractData {
  leaseNumber: string;
  propertyName: string;
  propertyAddress: string;
  propertyZone?: string | undefined;
  propertyCity: string;
  unitName: string;
  unitType: string;
  unitNumber?: string | undefined;
  floor?: number | undefined;
  tenantName: string;
  tenantPhone?: string | undefined;
  tenantEmail?: string | undefined;
  tenantIdNumber?: string | undefined;
  ownerName: string;
  ownerPhone?: string | undefined;
  ownerEmail?: string | undefined;
  startDate: string;
  endDate: string;
  dueDay: number;
  rentAmountMinor: number;
  chargesAmountMinor?: number | undefined;
  depositAmountMinor?: number | undefined;
  currency?: string | undefined;
  terms?: string | undefined;
}

interface LeaseContractModalProps {
  contract: LeaseContractData;
  onClose: () => void;
}

export function LeaseContractModal({ contract, onClose }: LeaseContractModalProps) {
  const currency = contract.currency || 'FCFA';
  const totalMonthly = contract.rentAmountMinor + (contract.chargesAmountMinor || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white animate-in fade-in">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 print:max-h-none print:shadow-none print:border-none print:w-full print:p-0">
        {/* Header - non imprimé pour les boutons */}
        <div className="flex items-center justify-between border-b border-border pb-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-black">Contrat de Bail d'Habitation Officiel</h2>
              <p className="text-xs text-muted-foreground">
                Réf : {contract.leaseNumber} · Plateforme KatdEstate
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer className="size-4" />
              <span>Imprimer / PDF</span>
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Corps officiel du bail */}
        <div className="space-y-6 text-sm leading-relaxed p-4 bg-muted/20 border border-border/80 rounded-2xl print:bg-transparent print:border-none print:p-0">
          {/* En-tête certifié */}
          <div className="text-center pb-4 border-b border-border/80 space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck className="size-4" />
              Bail d'Habitation Conforme & Certifié
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              CONTRAT DE BAIL À USAGE D'HABITATION
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Enregistré sous le N° {contract.leaseNumber} sur le portail KatdEstate
            </p>
          </div>

          {/* Parties contractantes */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                LE BAILLEUR (Propriétaire)
              </span>
              <p className="font-bold text-base">
                {contract.ownerName || 'Propriétaire KatdEstate'}
              </p>
              <p className="text-xs text-muted-foreground">
                Téléphone : {contract.ownerPhone || 'Enregistré sur la plateforme'}
              </p>
              <p className="text-xs text-muted-foreground">
                Email : {contract.ownerEmail || 'contact@katdestate.immo'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                LE PRENEUR (Locataire)
              </span>
              <p className="font-bold text-base">{contract.tenantName}</p>
              <p className="text-xs text-muted-foreground">
                Téléphone : {contract.tenantPhone || 'Non renseigné'}
              </p>
              <p className="text-xs text-muted-foreground">
                Email : {contract.tenantEmail || 'Non renseigné'}
              </p>
              {contract.tenantIdNumber && (
                <p className="text-xs text-muted-foreground">
                  Pièce d'identité : N° {contract.tenantIdNumber}
                </p>
              )}
            </div>
          </div>

          {/* Désignation du bien loué */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-2">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              ARTICLE 1 : DÉSIGNATION DES LIEUX LOUÉS
            </h3>
            <p className="text-xs text-muted-foreground">
              Le Bailleur donne en location au Preneur qui accepte les locaux désignés ci-après :
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Propriété
                </span>
                <strong className="text-foreground text-sm">{contract.propertyName}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Zone / Quartier
                </span>
                <strong className="text-foreground text-sm">
                  {contract.propertyZone || contract.propertyCity}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Type de logement
                </span>
                <strong className="text-foreground text-sm">{contract.unitType}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase font-bold">
                  N° de Chambre / Porte
                </span>
                <strong className="text-emerald-600 dark:text-emerald-300 text-sm font-black">
                  {contract.unitNumber || contract.unitName}
                </strong>
              </div>
              {contract.floor !== undefined && (
                <div className="p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    Étage
                  </span>
                  <strong className="text-foreground text-sm">
                    {contract.floor === 0 ? 'Rez-de-chaussée' : `${contract.floor}ème étage`}
                  </strong>
                </div>
              )}
              <div className="p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Localisation
                </span>
                <strong className="text-foreground text-sm">
                  {contract.propertyAddress}, {contract.propertyCity}
                </strong>
              </div>
            </div>
          </div>

          {/* Conditions financières et échéance */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-2">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              ARTICLE 2 : LOYER, CHARGES ET DATE D'ÉCHÉANCE DE PAIEMENT
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Loyer de base
                </span>
                <strong className="text-foreground text-sm">
                  {contract.rentAmountMinor.toLocaleString('fr-FR')} {currency}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Charges mensuelles
                </span>
                <strong className="text-foreground text-sm">
                  {(contract.chargesAmountMinor || 0).toLocaleString('fr-FR')} {currency}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase font-bold">
                  Total Mensuel
                </span>
                <strong className="text-emerald-600 dark:text-emerald-300 text-base font-black">
                  {totalMonthly.toLocaleString('fr-FR')} {currency}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-600 dark:text-amber-400 block text-[10px] uppercase font-bold">
                  Échéance de paiement
                </span>
                <strong className="text-amber-700 dark:text-amber-300 text-sm font-black">
                  Le {contract.dueDay} de chaque mois
                </strong>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Le loyer est payable d'avance le <strong>{contract.dueDay}</strong> de chaque mois
              civil. En cas de retard à cette date d'échéance, des alertes automatiques sont émises
              et transmises par email au propriétaire et au preneur.
            </p>
          </div>

          {/* Durée du bail */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-2">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              ARTICLE 3 : DURÉE ET EXPIRATION DU BAIL
            </h3>
            <p className="text-xs text-muted-foreground">
              Le présent bail est consenti et accepté pour une durée déterminée :
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold pt-1">
              <span className="px-3 py-1.5 rounded-lg bg-muted border border-border">
                📅 Prise d'effet :{' '}
                <strong className="text-foreground">
                  {new Date(contract.startDate).toLocaleDateString('fr-FR')}
                </strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-muted border border-border">
                🏁 Expiration du contrat :{' '}
                <strong className="text-foreground">
                  {new Date(contract.endDate).toLocaleDateString('fr-FR')}
                </strong>
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Conformément au système d'alertes KatdEstate, une notification automatique sera
              envoyée par email au bailleur et au locataire à l'approche de la date d'expiration
              pour statuer sur le renouvellement ou le congé.
            </p>
          </div>

          {/* Dépôt de garantie / Caution */}
          {contract.depositAmountMinor ? (
            <div className="p-4 rounded-xl bg-background border border-border space-y-1">
              <h3 className="font-bold text-sm text-foreground">
                ARTICLE 4 : DÉPÔT DE GARANTIE (CAUTION)
              </h3>
              <p className="text-xs text-muted-foreground">
                Le preneur verse ce jour à titre de dépôt de garantie la somme de{' '}
                <strong>
                  {contract.depositAmountMinor.toLocaleString('fr-FR')} {currency}
                </strong>
                , destinée à garantir l'exécution de ses obligations locatives.
              </p>
            </div>
          ) : null}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border">
            <div className="space-y-8 text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase">
                Signature du Bailleur
              </p>
              <div className="h-16 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-muted/10 p-2">
                <CheckCircle2 className="size-5 text-emerald-500 mb-1" />
                <span className="text-[10px] text-muted-foreground font-mono">
                  Signé numériquement KatdEstate
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground">{contract.ownerName}</p>
            </div>

            <div className="space-y-8 text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase">
                Signature du Preneur (Locataire)
              </p>
              <div className="h-16 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-muted/10 p-2">
                <CheckCircle2 className="size-5 text-emerald-500 mb-1" />
                <span className="text-[10px] text-muted-foreground font-mono">
                  Approuvé & Enregistré
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground">{contract.tenantName}</p>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] text-muted-foreground font-mono">
              Document certifié électroniquement et archivé dans les espaces Bailleur & Locataire
              KatdEstate.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-2 print:hidden">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            <Printer className="size-4 mr-2" />
            Imprimer / Enregistrer en PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
