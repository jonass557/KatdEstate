import { useState } from 'react';
import { Home, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';

interface AddUnitModalProps {
  propertyId: string;
  propertyName: string;
  onSave: (unitData: {
    propertyId: string;
    name: string;
    number: string;
    type: string;
    floor: number;
    surfaceM2: number;
    bedrooms: number;
    rentAmountMinor: number;
    chargesAmountMinor: number;
    depositAmountMinor: number;
  }) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export function AddUnitModal({
  propertyId,
  propertyName,
  onSave,
  onClose,
  isSubmitting = false,
}: AddUnitModalProps) {
  const { toast } = useToast();
  const [unitType, setUnitType] = useState('STUDIO');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitName, setUnitName] = useState('');
  const [floor, setFloor] = useState(0);
  const [surfaceM2, setSurfaceM2] = useState(25);
  const [bedrooms, setBedrooms] = useState(1);
  const [rentAmount, setRentAmount] = useState(100000);
  const [chargesAmount, setChargesAmount] = useState(5000);
  const [depositAmount, setDepositAmount] = useState(200000);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitNumber.trim()) {
      toast({ title: 'Le numéro de chambre ou porte est requis', variant: 'error' });
      return;
    }

    const calculatedName = unitName.trim() || `${unitType === 'ROOM' ? 'Chambre' : unitType === 'STUDIO' ? 'Studio' : 'Appartement'} ${unitNumber.trim()}`;

    onSave({
      propertyId,
      name: calculatedName,
      number: unitNumber.trim(),
      type: unitType,
      floor: Number(floor) || 0,
      surfaceM2: Number(surfaceM2) || 0,
      bedrooms: Number(bedrooms) || 0,
      rentAmountMinor: Number(rentAmount) || 0,
      chargesAmountMinor: Number(chargesAmount) || 0,
      depositAmountMinor: Number(depositAmount) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Home className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-black">Ajouter un Logement / Unité</h3>
              <p className="text-xs text-muted-foreground">{propertyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Type de logement</span>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
              >
                <option value="ROOM">Chambre</option>
                <option value="STUDIO">Studio</option>
                <option value="APARTMENT">Appartement</option>
                <option value="HOUSE">Maison / Villa</option>
                <option value="SHOP">Boutique / Magasin</option>
                <option value="OFFICE">Bureau</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">N° Porte / Chambre *</span>
              <Input
                value={unitNumber}
                onChange={(e) => {
                  setUnitNumber(e.target.value);
                  if (!unitName) {
                    setUnitName(`${unitType === 'ROOM' ? 'Chambre' : unitType === 'STUDIO' ? 'Studio' : 'Appt'} ${e.target.value}`);
                  }
                }}
                placeholder="Ex: Porte 3, Ch. B2..."
                required
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-muted-foreground font-medium">Désignation complète du logement</span>
            <Input
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="Ex: Studio Moderne Porte 3B"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Étage</span>
              <Input
                type="number"
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Surface (m²)</span>
              <Input
                type="number"
                value={surfaceM2}
                onChange={(e) => setSurfaceM2(Number(e.target.value))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Chambres</span>
              <Input
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Loyer (FCFA)</span>
              <Input
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(Number(e.target.value))}
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Charges (FCFA)</span>
              <Input
                type="number"
                value={chargesAmount}
                onChange={(e) => setChargesAmount(Number(e.target.value))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground font-medium">Caution (FCFA)</span>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {isSubmitting ? 'Ajout...' : 'Créer le logement'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
