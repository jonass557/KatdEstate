import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  ExternalLink,
  QrCode,
  Printer,
  Maximize2,
  Copy,
  Check,
  Globe,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';

export interface PropertyQrCodeCardProps {
  matricule: string;
  propertyName: string;
  address?: string | undefined;
  city?: string | undefined;
  ownerName?: string | undefined;
  compact?: boolean | undefined;
}

const PRODUCTION_DOMAIN = 'https://katdestate.vercel.app';

export function PropertyQrCodeCard({
  matricule,
  propertyName,
  address,
  city,
  ownerName,
  compact = false,
}: PropertyQrCodeCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usePublicDomain, setUsePublicDomain] = useState(true);

  // Détecte si l'application tourne en localhost ou IP locale
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local'));

  // Paramètres embarqués dans l'URL pour garantir la lecture hors-ligne ou cross-device
  const params = new URLSearchParams();
  if (propertyName) params.set('n', propertyName);
  if (address) params.set('a', address);
  if (city) params.set('c', city);
  if (ownerName) params.set('o', ownerName);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const publicPath = `/property-qr/${encodeURIComponent(matricule)}${queryStr}`;

  // Base URL : si l'utilisateur est sur localhost et que usePublicDomain est vrai,
  // on utilise https://katdestate.vercel.app pour que le scan avec son smartphone fonctionne réellement !
  const resolvedBase =
    isLocalhost && usePublicDomain
      ? PRODUCTION_DOMAIN
      : typeof window !== 'undefined'
        ? window.location.origin
        : PRODUCTION_DOMAIN;

  const qrTargetUrl = `${resolvedBase}${publicPath}`;

  useEffect(() => {
    let active = true;
    // Haute résolution (512px), marge standard ISO de 4 modules pour capture caméra infaillible,
    // correction d'erreur niveau H (High - 30% de tolérance aux reflets/détériorations) et contraste noir/blanc pur
    QRCode.toDataURL(qrTargetUrl, {
      width: 512,
      margin: 4,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrTargetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-code-${matricule}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadPoster = async () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fond blanc pur
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bandeau d'en-tête officiel
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, 0, canvas.width, 160);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DOMORA / KatdEstate', canvas.width / 2, 70);
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('PLAQUE D’IDENTIFICATION IMMOBILIÈRE OFFICIELLE', canvas.width / 2, 118);

    // Badge matricule
    ctx.fillStyle = '#f0fdfa';
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(120, 200, 760, 95, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('MATRICULE UNIQUE DE LA PROPRIÉTÉ', canvas.width / 2, 236);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(matricule, canvas.width / 2, 278);

    // Image QR Code en très haute définition
    const img = new Image();
    img.src = qrDataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    // Cadre blanc protecteur autour du QR Code
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(240, 330, 520, 520, 24);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(img, 260, 350, 480, 480);

    // Détails de la propriété
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.fillText(propertyName.slice(0, 44), canvas.width / 2, 910);

    ctx.fillStyle = '#475569';
    ctx.font = '24px system-ui, -apple-system, sans-serif';
    const locationLine = [address, city].filter(Boolean).join(' · ');
    if (locationLine) {
      ctx.fillText(locationLine.slice(0, 62), canvas.width / 2, 955);
    }
    if (ownerName) {
      ctx.fillText(`Propriétaire : ${ownerName}`.slice(0, 56), canvas.width / 2, 1000);
    }

    // Ligne de séparation
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(150, 1050);
    ctx.lineTo(850, 1050);
    ctx.stroke();

    // Instructions de scan
    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      'Scannez ce QR Code avec l’appareil photo de votre smartphone',
      canvas.width / 2,
      1110,
    );
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Accès instantané à la fiche du bien, du propriétaire et à la navigation GPS.', canvas.width / 2, 1145);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px monospace';
    ctx.fillText(qrTargetUrl.slice(0, 80), canvas.width / 2, 1220);

    const posterUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = posterUrl;
    link.download = `affiche-officielle-${matricule}.png`;
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
            className="size-16 rounded-lg border border-border bg-white p-1 shrink-0 cursor-pointer hover:opacity-90 transition"
            onClick={() => setIsZoomOpen(true)}
            title="Cliquer pour agrandir le QR Code"
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
              PNG
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={() => setIsZoomOpen(true)}
            >
              <Maximize2 className="mr-1 size-3" />
              Agrandir
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
    <>
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <QrCode className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Matricule & Code QR Officiel de la Propriété
              </h3>
              <p className="text-xs text-muted-foreground">
                Scannable par n’importe quel smartphone ou caméra pour afficher immédiatement le propriétaire et le bien.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
            {matricule}
          </span>
        </div>

        {isLocalhost && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <Globe className="size-4 shrink-0" />
              <span>
                {usePublicDomain
                  ? 'URL en ligne activée (Permet à votre smartphone de scanner et ouvrir la page)'
                  : 'URL locale (Accessible uniquement sur cette machine)'}
              </span>
            </div>
            <button
              type="button"
              className="font-semibold underline hover:opacity-80"
              onClick={() => setUsePublicDomain((prev) => !prev)}
            >
              Basculer vers {usePublicDomain ? 'Local' : 'En Ligne'}
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Cadre QR Code Haute Définition avec marges blanches ISO */}
          <div
            className="group relative rounded-2xl border-2 border-border bg-white p-4 shadow-md shrink-0 cursor-pointer transition hover:border-primary/50"
            onClick={() => setIsZoomOpen(true)}
            title="Cliquer pour afficher en plein écran"
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Code QR de ${propertyName} (${matricule})`}
                className="size-48 sm:size-52 object-contain"
              />
            ) : (
              <div className="size-48 sm:size-52 flex items-center justify-center text-muted-foreground">
                <QrCode className="size-10 animate-pulse" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition group-hover:opacity-100 backdrop-blur-[2px]">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow">
                <Maximize2 className="size-3.5" />
                Agrandir pour scanner
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-3.5 text-sm w-full">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Bien référencé
              </p>
              <p className="font-bold text-foreground text-base">{propertyName}</p>
              {(address || city) && (
                <p className="text-xs text-muted-foreground">
                  {[address, city].filter(Boolean).join(' · ')}
                </p>
              )}
              {ownerName && (
                <p className="text-xs text-muted-foreground">
                  Propriétaire légal : <span className="font-semibold text-foreground">{ownerName}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setIsZoomOpen(true)}
                className="inline-flex items-center gap-1.5"
              >
                <Maximize2 className="size-3.5" />
                Plein Écran
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
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
                Télécharger Affiche Murale HD
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copied ? 'Copié !' : 'Copier le lien'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => window.open(publicPath, '_blank', 'noopener')}
                className="inline-flex items-center gap-1.5"
              >
                <ExternalLink className="size-3.5" />
                Ouvrir la fiche publique
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Plein Écran pour scanner facilement depuis n'importe quel écran */}
      {isZoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl text-center space-y-4">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              onClick={() => setIsZoomOpen(false)}
            >
              <X className="size-5" />
            </button>

            <div className="space-y-1">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
                {matricule}
              </span>
              <h3 className="text-lg font-bold text-foreground mt-2">{propertyName}</h3>
              <p className="text-xs text-muted-foreground">
                Pointez l’appareil photo de votre smartphone pour ouvrir la fiche
              </p>
            </div>

            <div className="flex justify-center p-3 bg-white rounded-2xl shadow-inner border border-slate-200">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`QR Code ${matricule}`}
                  className="size-72 sm:size-80 object-contain"
                />
              )}
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-mono break-all text-[11px] bg-muted/60 p-2 rounded-lg border border-border/80">
                {qrTargetUrl}
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Button size="sm" onClick={handleDownloadPng}>
                  <Download className="mr-1.5 size-3.5" />
                  Télécharger PNG
                </Button>
                <Button size="sm" variant="secondary" onClick={handleCopyLink}>
                  {copied ? <Check className="mr-1.5 size-3.5 text-emerald-500" /> : <Copy className="mr-1.5 size-3.5" />}
                  {copied ? 'Lien copié !' : 'Copier l’URL'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setIsZoomOpen(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
