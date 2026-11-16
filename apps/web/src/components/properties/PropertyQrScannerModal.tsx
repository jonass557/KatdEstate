import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import {
  Camera,
  Upload,
  Keyboard,
  X,
  AlertCircle,
  CheckCircle2,
  Scan,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface PropertyQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: ((code: string) => void) | undefined;
}

export function PropertyQrScannerModal({
  isOpen,
  onClose,
  onSuccess,
}: PropertyQrScannerModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // La note A5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(120);
      }
    } catch {
      // AudioContext fallback
    }
  };

  const handleExtractedCode = (rawText: string) => {
    let cleanCode = rawText.trim();
    // Si c'est une URL type https://.../property-qr/IMM-2026-0001
    const match = cleanCode.match(/\/property-qr\/([^/?#]+)/i);
    if (match && match[1]) {
      cleanCode = decodeURIComponent(match[1]);
    }
    setScanResult(cleanCode);
    playBeep();
    stopCamera();

    setTimeout(() => {
      if (onSuccess) {
        onSuccess(cleanCode);
      } else {
        navigate(`/property-qr/${encodeURIComponent(cleanCode)}`);
      }
      onClose();
    }, 600);
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);
    setScanResult(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("L'accès à la caméra n'est pas supporté par ce navigateur.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanVideoFrame();
      }
    } catch (err: unknown) {
      setIsScanning(false);
      const msg =
        err instanceof Error
          ? err.message
          : 'Impossible d’accéder à la caméra. Vérifiez les autorisations de votre navigateur.';
      setCameraError(msg);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const scanVideoFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      handleExtractedCode(code.data);
      return;
    }

    animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          handleExtractedCode(code.data);
        } else {
          setCameraError("Aucun code QR valide n'a pu être détecté sur cette image.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleExtractedCode(manualCode.trim());
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Scan className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Scanner un Code QR de Propriété
              </h3>
              <p className="text-xs text-muted-foreground">
                Accédez immédiatement à la fiche certifiée du bien et du propriétaire
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

        {/* Onglets : Caméra, Importer image, Saisie manuelle */}
        <div className="flex rounded-xl bg-muted p-1 text-xs font-semibold">
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'camera'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('camera')}
          >
            <Camera className="size-4" />
            Caméra en direct
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'upload'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload className="size-4" />
            Importer une photo
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'manual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('manual')}
          >
            <Keyboard className="size-4" />
            Saisie matricule
          </button>
        </div>

        {/* Contenu selon l'onglet */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="relative aspect-video sm:aspect-square w-full max-h-[320px] rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 border-border shadow-inner">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                autoPlay
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viseur animé de scan */}
              {isScanning && !scanResult && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative size-48 sm:size-56 border-2 border-primary/80 rounded-2xl">
                    {/* Coins renforcés */}
                    <span className="absolute -top-1 -left-1 size-4 border-t-4 border-l-4 border-primary" />
                    <span className="absolute -top-1 -right-1 size-4 border-t-4 border-r-4 border-primary" />
                    <span className="absolute -bottom-1 -left-1 size-4 border-b-4 border-l-4 border-primary" />
                    <span className="absolute -bottom-1 -right-1 size-4 border-b-4 border-r-4 border-primary" />
                    {/* Ligne laser animée */}
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                  </div>
                </div>
              )}

              {/* Résultat détecté avec succès */}
              {scanResult && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-4 backdrop-blur-sm animate-in zoom-in-95">
                  <CheckCircle2 className="size-12 text-emerald-400 mb-2 animate-bounce" />
                  <p className="text-white font-bold text-sm">Code QR identifié !</p>
                  <p className="text-emerald-400 font-mono text-xs mt-1">{scanResult}</p>
                  <p className="text-white/70 text-xs mt-2">Redirection vers la fiche...</p>
                </div>
              )}

              {/* Message d'erreur caméra */}
              {cameraError && (
                <div className="absolute inset-0 bg-background/95 p-5 flex flex-col items-center justify-center text-center space-y-3">
                  <AlertCircle className="size-10 text-destructive" />
                  <p className="text-xs text-muted-foreground max-w-xs">{cameraError}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void startCamera()}>
                      <RefreshCw className="mr-1.5 size-3.5" />
                      Réessayer
                    </Button>
                    <Button size="sm" onClick={() => setActiveTab('upload')}>
                      <Upload className="mr-1.5 size-3.5" />
                      Choisir une image
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Placez le code QR de la plaque ou de l’écran au centre du repère.
            </p>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-2xl p-8 text-center space-y-3 hover:border-primary/50 transition cursor-pointer bg-muted/20"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="size-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Upload className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Sélectionnez une photo ou capture d’écran
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG ou WebP contenant un code QR DOMORA
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button size="sm" variant="secondary" type="button">
                Parcourir mes fichiers
              </Button>
            </div>
            {cameraError && (
              <p className="text-xs text-destructive text-center">{cameraError}</p>
            )}
          </div>
        )}

        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Matricule unique de la propriété (ex : IMM-2026-0042)
              </label>
              <Input
                type="text"
                placeholder="Ex : IMM-2026-0042 ou identifiant MongoDB"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="font-mono text-sm uppercase"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!manualCode.trim()}>
              Consulter la fiche certifiée
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
