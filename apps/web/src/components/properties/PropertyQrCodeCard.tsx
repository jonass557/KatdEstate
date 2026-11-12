import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, ExternalLink, QrCode, Printer } from 'lucide-react';
import { Button } from '../ui/button';

export interface PropertyQrCodeCardProps {
  matricule: string;
  propertyName: string;
  address?: string | undefined;
  city?: string | undefined;
  ownerName?: string | undefined;
  compact?: boolean | undefined;
}

export function PropertyQrCodeCard({
  matricule,
  propertyName,
  address,
  city,
  ownerName,
  compact = false,
}: PropertyQrCodeCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const publicPath = `/property-qr/${encodeURIComponent(matricule)}`;
  const qrTargetUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrTargetUrl, {
      width: 360,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [qrTargetUrl]);

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-${matricule}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadPoster = async () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header band
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, 0, canvas.width, 150);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DOMORA / KatdEstate', canvas.width / 2, 65);
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('PLAQUE D’IDENTIFICATION IMMOBILIÈRE OFFICIELLE', canvas.width / 2, 112);

    // Matricule badge
    ctx.fillStyle = '#f0fdfa';
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(140, 190, 620, 90, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('MATRICULE UNIQUE DE LA PROPRIÉTÉ', canvas.width / 2, 224);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(matricule, canvas.width / 2, 265);

    // QR Code image
    const img = new Image();
    img.src = qrDataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    ctx.drawImage(img, 245, 315, 410, 410);

    // Property details
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.fillText(propertyName.slice(0, 42), canvas.width / 2, 790);

    ctx.fillStyle = '#475569';
    ctx.font = '22px system-ui, -apple-system, sans-serif';
    const locationLine = [address, city].filter(Boolean).join(' · ');
    if (locationLine) {
      ctx.fillText(locationLine.slice(0, 60), canvas.width / 2, 835);
    }
    if (ownerName) {
      ctx.fillText(`Propriétaire : ${ownerName}`.slice(0, 56), canvas.width / 2, 880);
    }

    // Footer instruction
    ctx.fillStyle = '#0f766e';
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      'Scannez ce QR Code pour consulter toutes les informations',
      canvas.width / 2,
      970,
    );
    ctx.fillText('du propriétaire et de la propriété enregistrée.', canvas.width / 2, 1002);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText(qrTargetUrl.slice(0, 75), canvas.width / 2, 1065);

    const posterUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = posterUrl;
    link.download = `affiche-qr-${matricule}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR Code ${matricule}`}
            className="size-16 rounded-lg border border-border bg-white p-1 shrink-0"
          />
        ) : (
          <div className="size-16 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0">
            <QrCode className="size-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Matricule unique
          </p>
          <p className="font-mono text-sm font-bold text-primary truncate">{matricule}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={handleDownloadPng}
              disabled={!qrDataUrl}
            >
              <Download className="mr-1 size-3" />
              QR PNG
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={() => window.open(publicPath, '_blank', 'noopener')}
            >
              <ExternalLink className="mr-1 size-3" />
              Aperçu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <QrCode className="size-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Matricule & Code QR d’identification
            </h3>
            <p className="text-xs text-muted-foreground">
              À télécharger et afficher sur la propriété pour vérification instantanée.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
          {matricule}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="rounded-xl border border-border bg-white p-3 shadow-sm shrink-0">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Code QR de ${propertyName} (${matricule})`}
              className="size-44 object-contain"
            />
          ) : (
            <div className="size-44 flex items-center justify-center text-muted-foreground">
              <QrCode className="size-10 animate-pulse" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 text-sm">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Bien enregistré</p>
            <p className="font-semibold text-foreground">{propertyName}</p>
            {(address || city) && (
              <p className="text-xs text-muted-foreground">
                {[address, city].filter(Boolean).join(' · ')}
              </p>
            )}
            {ownerName && (
              <p className="text-xs text-muted-foreground">
                Propriétaire : <span className="font-medium text-foreground">{ownerName}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleDownloadPng}
              disabled={!qrDataUrl}
              className="inline-flex items-center gap-1.5"
            >
              <Download className="size-3.5" />
              Télécharger QR (PNG)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void handleDownloadPoster()}
              disabled={!qrDataUrl}
              className="inline-flex items-center gap-1.5"
            >
              <Printer className="size-3.5" />
              Télécharger Affiche à afficher
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => window.open(publicPath, '_blank', 'noopener')}
              className="inline-flex items-center gap-1.5"
            >
              <ExternalLink className="size-3.5" />
              Voir la fiche QR
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
