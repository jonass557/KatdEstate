import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiRequest } from '../../lib/api-client';
import { Shield, Key, CheckCircle, AlertCircle, Loader2, X, RefreshCw } from 'lucide-react';

export function IkeepaySettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [environment, setEnvironment] = useState<'SANDBOX' | 'LIVE'>('LIVE');
  const [isActive, setIsActive] = useState(true);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<any>('/payments/ikeepay/config');
      if (data) {
        setPublicKey(data.publicKey || '');
        setSecretKey(data.secretKeyMasked || '');
        setEnvironment(data.environment || 'LIVE');
        setIsActive(data.isActive ?? true);
        if (data.hasWebhookSecret) {
          setWebhookSecret('••••••••••••');
        }
      }
    } catch {
      setError('Impossible de charger la configuration Ikeepay.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await apiRequest('/payments/ikeepay/config', {
        method: 'PUT',
        body: {
          publicKey,
          secretKey,
          environment,
          isActive,
          webhookSecret: webhookSecret.includes('•••') ? undefined : webhookSecret,
        },
      });
      setMessage('Configuration Ikeepay enregistrée avec succès.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour des clés Ikeepay.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Passerelle de Paiement Ikeepay
            </h3>
            <p className="text-xs text-slate-500">
              Configuration des clés API H2H pour Orange, MTN, Wave & Moov
            </p>
          </div>
        </div>

        {message ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 p-3 text-xs border border-emerald-200">
            <CheckCircle className="h-4 w-4" />
            <span>{message}</span>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 text-red-800 p-3 text-xs border border-red-200">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="py-8 flex justify-center items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Chargement des paramètres...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="pubKey" className="text-xs font-semibold">
                Clé Publique Ikeepay (Public Key) *
              </Label>
              <Input
                id="pubKey"
                required
                placeholder="Ex: ikp_pub_live_..."
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div>
              <Label htmlFor="secKey" className="text-xs font-semibold">
                Clé Secrète Ikeepay (Secret Key) *
              </Label>
              <Input
                id="secKey"
                required
                type="password"
                placeholder="Ex: ikp_sec_live_..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="mt-1 text-xs font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Utilisée dans le header x-api-key pour les appels Payin/Payout.
              </p>
            </div>

            <div>
              <Label htmlFor="whSec" className="text-xs font-semibold">
                Secret Webhook (HMAC SHA-256) (Optionnel)
              </Label>
              <Input
                id="whSec"
                type="password"
                placeholder="Ex: ikp_whsec_..."
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="mt-1 text-xs font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Pour la validation de l'en-tête X-Ikeepay-Signature.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label htmlFor="env" className="text-xs font-semibold">
                  Environnement
                </Label>
                <select
                  id="env"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="LIVE">Live (Production)</option>
                  <option value="SANDBOX">Sandbox (Test)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="status" className="text-xs font-semibold">
                  Statut Passerelle
                </Label>
                <select
                  id="status"
                  value={isActive ? 'ACTIVE' : 'DISABLED'}
                  onChange={(e) => setIsActive(e.target.value === 'ACTIVE')}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="ACTIVE">Actif (Encaissements autorisés)</option>
                  <option value="DISABLED">Désactivé (En maintenance)</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-purple-600" />
                <span>URL de Webhook à renseigner chez Ikeepay :</span>
              </div>
              <code className="block bg-slate-200/70 dark:bg-slate-800 p-1.5 rounded text-[11px] select-all font-mono">
                https://katdestate-api.onrender.com/api/v1/payments/ikeepay/webhook
              </code>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={saving || !publicKey || !secretKey}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Enregistrement...</span>
                  </span>
                ) : (
                  <span>Enregistrer les clés</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
