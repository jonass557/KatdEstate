import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiRequest } from '../../lib/api-client';
import { CheckCircle2, AlertCircle, Loader2, Smartphone, ShieldCheck, ExternalLink, X } from 'lucide-react';

export interface IkeepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
  onPaymentSuccess?: (reference: string) => void;
  amount?: number;
  defaultAmount?: number;
  currency?: string;
  purpose?: 'RENT_PAYMENT' | 'CHEFFERIE_COMMISSION' | 'SUBSCRIPTION_PAYMENT' | 'MARKETPLACE_DEPOSIT' | 'OTHER';
  referenceId?: string;
  title?: string;
  description?: string;
}

const OPERATORS = [
  { id: 'ORANGE', name: 'Orange Money', color: 'bg-orange-500 text-white', badge: 'OM' },
  { id: 'MTN', name: 'MTN Mobile Money', color: 'bg-yellow-400 text-black', badge: 'MoMo' },
  { id: 'WAVE', name: 'Wave Mobile Money', color: 'bg-sky-500 text-white', badge: 'Wave' },
  { id: 'MOOV', name: 'Moov Money', color: 'bg-blue-600 text-white', badge: 'Moov' },
];

export function IkeepayModal({
  isOpen,
  onClose,
  onSuccess,
  onPaymentSuccess,
  amount,
  defaultAmount,
  currency = 'XOF',
  purpose = 'RENT_PAYMENT',
  referenceId,
  title = 'Paiement Mobile Money Sécurisé',
  description,
}: IkeepayModalProps) {
  const finalAmount = amount ?? defaultAmount ?? 50000;
  const [operator, setOperator] = useState('ORANGE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('CI');
  const [otp, setOtp] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resData = await apiRequest<any>('/payments/ikeepay/payin', {
        method: 'POST',
        body: {
          amount: finalAmount,
          currency,
          country,
          phoneNumber,
          operator,
          customerEmail: customerEmail || undefined,
          otp: otp || undefined,
          purpose,
          referenceId,
          description: description || `Paiement ${purpose} sur KatdEstate`,
        },
      });

      setSuccessData(resData);
      if (onSuccess) onSuccess(resData);
      if (onPaymentSuccess) onPaymentSuccess(resData?.external_reference || resData?.reference || 'REF_OK');
    } catch (err: any) {
      setError(err?.message || 'Échec de la transaction. Veuillez vérifier vos coordonnées.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        {/* En-tête */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Propulsé par Ikeepay Africa</p>
          </div>
        </div>

        {/* Montant */}
        <div className="mb-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 text-center border border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Montant total à payer
          </span>
          <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            {finalAmount.toLocaleString('fr-FR')} {currency}
          </div>
          {description ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        ) : null}

        {successData ? (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Demande transmise avec succès !</h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Un message de confirmation a été envoyé sur votre téléphone <strong>{phoneNumber}</strong>.
                Veuillez valider avec votre code secret Mobile Money.
              </p>
            </div>

            {successData.paymentLink ? (
              <a
                href={successData.paymentLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition"
              >
                <span>Finaliser sur la page de paiement</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}

            <Button onClick={onClose} variant="outline" className="w-full mt-2">
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Choix de l'opérateur */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Opérateur Mobile Money</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {OPERATORS.map((op) => {
                  const isSelected = operator === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setOperator(op.id)}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-600'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className={`flex h-6 w-8 items-center justify-center rounded text-[10px] font-bold ${op.color}`}>
                        {op.badge}
                      </span>
                      <span>{op.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pays & Téléphone */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="country" className="text-xs">Pays</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="CI">Côte d'Ivoire (+225)</option>
                  <option value="SN">Sénégal (+221)</option>
                  <option value="BF">Burkina Faso (+226)</option>
                  <option value="ML">Mali (+223)</option>
                  <option value="CM">Cameroun (+237)</option>
                  <option value="TG">Togo (+228)</option>
                  <option value="BJ">Bénin (+229)</option>
                  <option value="GN">Guinée (+224)</option>
                </select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="phone" className="text-xs">Numéro Mobile Money *</Label>
                <Input
                  id="phone"
                  required
                  placeholder="Ex: 0701020304"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {/* OTP optionnel */}
            <div>
              <Label htmlFor="otp" className="text-xs text-slate-500">Code OTP / Autorisation (si requis par l'opérateur)</Label>
              <Input
                id="otp"
                placeholder="Ex: #144# ou code reçu par SMS"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            {/* Email client */}
            <div>
              <Label htmlFor="email" className="text-xs text-slate-500">Email pour le reçu (optionnel)</Label>
              <Input
                id="email"
                type="email"
                placeholder="client@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading || !phoneNumber}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md py-2.5 rounded-xl transition"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Traitement en cours...</span>
                  </span>
                ) : (
                  <span>Payer {finalAmount.toLocaleString('fr-FR')} {currency}</span>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Paiement chiffré TLS 256 bits conforme PCI-DSS</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
