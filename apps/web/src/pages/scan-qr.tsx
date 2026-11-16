import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scan, ArrowLeft, Building2 } from 'lucide-react';
import { PropertyQrScannerModal } from '../components/properties/PropertyQrScannerModal';
import { Button } from '../components/ui/button';

export function ScanQrPage() {
  const navigate = useNavigate();
  const [isScannerOpen, setIsScannerOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-6">
      <div className="mx-auto max-w-md w-full space-y-6 pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-4" />
          Retour à l’accueil
        </Link>

        <div className="text-center space-y-2">
          <div className="size-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
            <Scan className="size-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Scanner une Propriété</h1>
          <p className="text-sm text-muted-foreground">
            Scannez la plaque murale ou le code QR DOMORA pour consulter immédiatement toutes les informations certifiées du bien et de son propriétaire.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Le scanner utilise la caméra de votre smartphone ou vous permet de sélectionner une image depuis votre galerie.
          </p>
          <Button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2"
            onClick={() => setIsScannerOpen(true)}
          >
            <Scan className="size-4" />
            Ouvrir la caméra de scan
          </Button>
          <Link to="/properties" className="block">
            <Button variant="secondary" className="w-full">
              <Building2 className="mr-2 size-4" />
              Consulter la liste de mes propriétés
            </Button>
          </Link>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-6">
        DOMORA / KatdEstate · Système Officiel de Cadastre et Cartographie Immobilière
      </p>

      <PropertyQrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={(code) => {
          navigate(`/property-qr/${encodeURIComponent(code)}`);
        }}
      />
    </div>
  );
}
