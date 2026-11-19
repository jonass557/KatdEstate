import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Mail,
  MessageSquare,
  PhoneCall,
  Settings,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';
import {
  getAdminNotificationApiConfig,
  saveAdminNotificationApiConfig,
  type AdminNotificationApiConfig,
} from '../../lib/katdestate-store';

export function AdminNotificationApiSettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'sms' | 'call' | 'email'>('sms');
  const [config, setConfig] = useState<AdminNotificationApiConfig>(() =>
    getAdminNotificationApiConfig(),
  );

  useEffect(() => {
    if (isOpen) {
      setConfig(getAdminNotificationApiConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveAdminNotificationApiConfig(config);
    toast({
      title: 'Paramètres API SMS / Appel / Email enregistrés !',
      description:
        'Les notifications d’expiration des meublés utiliseront désormais cette configuration.',
      variant: 'success',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl my-8 space-y-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <Settings className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              Configuration API Notifications (SMS, Appel Vocal & Email)
            </h3>
            <p className="text-xs text-slate-400">
              Paramètres Super Admin pour les alertes automatiques d’expiration des séjours meublés.
            </p>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 border-b border-slate-800 pb-3">
          <Button
            type="button"
            size="sm"
            variant={tab === 'sms' ? 'primary' : 'outline'}
            onClick={() => setTab('sms')}
            className="text-xs gap-1.5"
          >
            <MessageSquare className="size-3.5" />
            API SMS
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'call' ? 'primary' : 'outline'}
            onClick={() => setTab('call')}
            className="text-xs gap-1.5"
          >
            <PhoneCall className="size-3.5" />
            API Appel Vocal
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'email' ? 'primary' : 'outline'}
            onClick={() => setTab('email')}
            className="text-xs gap-1.5"
          >
            <Mail className="size-3.5" />
            API Email / SMTP
          </Button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {tab === 'sms' && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <label className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <input
                  type="checkbox"
                  checked={config.sms.enabled}
                  onChange={(e) =>
                    setConfig({ ...config, sms: { ...config.sms, enabled: e.target.checked } })
                  }
                />
                Activer les notifications par SMS
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Fournisseur SMS</label>
                  <Input
                    value={config.sms.provider}
                    onChange={(e) =>
                      setConfig({ ...config, sms: { ...config.sms, provider: e.target.value } })
                    }
                    placeholder="Twilio, Africa's Talking, Orange SMS, Nexah..."
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Sender ID</label>
                  <Input
                    value={config.sms.senderId}
                    onChange={(e) =>
                      setConfig({ ...config, sms: { ...config.sms, senderId: e.target.value } })
                    }
                    placeholder="KatdEstate"
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300">URL Endpoint API SMS</label>
                <Input
                  value={config.sms.apiUrl}
                  onChange={(e) =>
                    setConfig({ ...config, sms: { ...config.sms, apiUrl: e.target.value } })
                  }
                  placeholder="https://api.africastalking.com/version1/messaging"
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">API Key / Account SID</label>
                  <Input
                    value={config.sms.apiKey}
                    onChange={(e) =>
                      setConfig({ ...config, sms: { ...config.sms, apiKey: e.target.value } })
                    }
                    placeholder="Clé API..."
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">API Secret / Auth Token</label>
                  <Input
                    type="password"
                    value={config.sms.apiSecret}
                    onChange={(e) =>
                      setConfig({ ...config, sms: { ...config.sms, apiSecret: e.target.value } })
                    }
                    placeholder="Secret..."
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'call' && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <label className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <input
                  type="checkbox"
                  checked={config.call.enabled}
                  onChange={(e) =>
                    setConfig({ ...config, call: { ...config.call, enabled: e.target.checked } })
                  }
                />
                Activer les notifications par Appel Vocal Automatique
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Fournisseur Appel Vocal</label>
                  <Input
                    value={config.call.provider}
                    onChange={(e) =>
                      setConfig({ ...config, call: { ...config.call, provider: e.target.value } })
                    }
                    placeholder="Twilio Voice, Africa's Talking Voice..."
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Numéro Appelant</label>
                  <Input
                    value={config.call.callerNumber}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        call: { ...config.call, callerNumber: e.target.value },
                      })
                    }
                    placeholder="+225 00 00 00 00"
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300">URL Endpoint API Appel</label>
                <Input
                  value={config.call.apiUrl}
                  onChange={(e) =>
                    setConfig({ ...config, call: { ...config.call, apiUrl: e.target.value } })
                  }
                  placeholder="https://voice.africastalking.com/call"
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">API Key / SID</label>
                  <Input
                    value={config.call.apiKey}
                    onChange={(e) =>
                      setConfig({ ...config, call: { ...config.call, apiKey: e.target.value } })
                    }
                    placeholder="Clé API Voice..."
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Auth Token</label>
                  <Input
                    type="password"
                    value={config.call.apiSecret}
                    onChange={(e) =>
                      setConfig({ ...config, call: { ...config.call, apiSecret: e.target.value } })
                    }
                    placeholder="Token..."
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Modèle du message vocal (variables : {'{clientName}'}, {'{meubleTitle}'})
                </label>
                <textarea
                  rows={2}
                  value={config.call.voiceMessageTemplate}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      call: { ...config.call, voiceMessageTemplate: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                />
              </div>
            </div>
          )}

          {tab === 'email' && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <label className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <input
                  type="checkbox"
                  checked={config.email.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      email: { ...config.email, enabled: e.target.checked },
                    })
                  }
                />
                Activer les notifications par Email
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Fournisseur Email</label>
                  <Input
                    value={config.email.provider}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        email: { ...config.email, provider: e.target.value },
                      })
                    }
                    placeholder="Resend, SendGrid, SMTP..."
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Email Expéditeur</label>
                  <Input
                    value={config.email.fromEmail}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        email: { ...config.email, fromEmail: e.target.value },
                      })
                    }
                    placeholder="notifications@katdestate.immo"
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300">URL Endpoint API Email</label>
                <Input
                  value={config.email.apiUrl}
                  onChange={(e) =>
                    setConfig({ ...config, email: { ...config.email, apiUrl: e.target.value } })
                  }
                  placeholder="https://api.resend.com/emails"
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Clé API Email</label>
                <Input
                  type="password"
                  value={config.email.apiKey}
                  onChange={(e) =>
                    setConfig({ ...config, email: { ...config.email, apiKey: e.target.value } })
                  }
                  placeholder="re_xxxxxxxx..."
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              Enregistrer la configuration API
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
