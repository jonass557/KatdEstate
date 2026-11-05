import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantInputSchema, type TenantInput } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgList, useOrgPath } from '../lib/query';
import { KeyRound, Copy, Check, Smartphone, ShieldCheck, RefreshCw, X, UserCheck } from 'lucide-react';

interface Tenant {
  _id: string;
  fullName: string;
  phone?: string;
  email?: string;
  profession?: string;
  status: string;
  identityDocumentNumber?: string;
  loginPassword?: string;
}

interface TenantAccessCard {
  fullName: string;
  email: string;
  password: string;
  phone?: string | undefined;
}

const STORAGE_CREDENTIALS_KEY = 'katdestate_tenant_credentials';

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [accessCard, setAccessCard] = useState<TenantAccessCard | null>(null);
  const [copied, setCopied] = useState(false);

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useOrgList<Tenant>(
    ['tenants', search],
    `/tenants?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ''}`
  );

  const create = useMutation({
    mutationFn: (input: TenantInput) => apiRequest(`${base}/tenants`, { method: 'POST', body: input }),
    onSuccess: () => {
      void client.invalidateQueries();
      setOpen(false);
      toast({ title: 'Locataire enregistré', description: 'Le compte d’accès a été configuré.', variant: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Enregistrement impossible', description: error.message, variant: 'error' }),
  });

  const getSavedPasswordForTenant = (email?: string, name?: string): string => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_CREDENTIALS_KEY) || '{}');
      if (email && stored[email]) return stored[email];
      if (name && stored[name]) return stored[name];
    } catch {
      // fallback
    }
    return 'Locataire2026!';
  };

  const handleCopyCredentials = (card: TenantAccessCard) => {
    const text = `Bonjour ${card.fullName},\nVoici vos identifiants d'accès à votre espace locataire KatdEstate :\n\n🌐 Lien de connexion : https://katdestate.vercel.app/sign-in\n👤 Identifiant : ${card.email}\n🔑 Mot de passe : ${card.password}\n\nDepuis votre espace, vous pourrez payer votre loyer par Mobile Money (Orange, MTN, Wave, Moov) et télécharger vos quittances officielles.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({ title: 'Identifiants copiés dans le presse-papier !', variant: 'success' });
  };

  const handleShareWhatsApp = (card: TenantAccessCard) => {
    const text = encodeURIComponent(
      `Bonjour ${card.fullName},\nVoici vos identifiants d'accès à votre espace locataire KatdEstate :\n\n🌐 Lien de connexion : https://katdestate.vercel.app/sign-in\n👤 Identifiant : ${card.email}\n🔑 Mot de passe : ${card.password}\n\nDepuis cet espace, vous pourrez régler votre loyer en toute sécurité et télécharger vos quittances certifiées.`
    );
    const cleanPhone = (card.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Répertoire des Locataires & Accès"
        description="Gérez les locataires et créez leurs identifiants de compte pour leur permettre de se connecter à leur espace."
        actions={
          <Button onClick={() => setOpen((value) => !value)} className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white">
            + Nouveau locataire & Identifiants
          </Button>
        }
      />

      {open ? (
        <TenantForm
          submitting={create.isPending}
          onSubmit={(values, generatedPassword) => {
            // Save credentials locally
            if (values.email) {
              try {
                const stored = JSON.parse(localStorage.getItem(STORAGE_CREDENTIALS_KEY) || '{}');
                stored[values.email] = generatedPassword;
                localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(stored));
              } catch {
                // fallback
              }
            }
            create.mutate(values);
            const tName = values.fullName || 'Locataire';
            const tEmail = values.email || `${tName.toLowerCase().replace(/\s+/g, '.')}@katdestate.immo`;
            setAccessCard({
              fullName: tName,
              email: tEmail,
              password: generatedPassword,
              phone: values.phone || undefined,
            });
          }}
        />
      ) : null}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher par nom, téléphone, email..."
          className="max-w-xs"
        />
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>Accès locataire sécurisé avec rôle certifié TENANT</span>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {!isLoading && (data?.data ?? []).length === 0 ? (
        <EmptyState title="Aucun locataire" description="Ajoutez le premier locataire et générez ses identifiants de connexion." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.data ?? []).map((tenant) => {
          const pass = getSavedPasswordForTenant(tenant.email, tenant.fullName);
          return (
            <Card key={tenant._id} className="border-border hover:shadow-md transition-shadow">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                      {tenant.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{tenant.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">{tenant.profession || 'Locataire'}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                    {tenant.status === 'ACTIVE' ? 'Actif' : tenant.status}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/60">
                  <p className="flex items-center justify-between">
                    <span>Téléphone :</span>
                    <strong className="text-foreground">{tenant.phone ?? 'Non renseigné'}</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Email de connexion :</span>
                    <strong className="text-foreground truncate max-w-[150px]">{tenant.email ?? 'Non renseigné'}</strong>
                  </p>
                </div>

                {/* Bouton pour afficher/copier les identifiants */}
                <div className="pt-1 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs font-semibold border-border hover:bg-emerald-500/10 hover:text-emerald-500 flex items-center justify-center gap-1.5 h-8"
                    onClick={() => {
                      setAccessCard({
                        fullName: tenant.fullName,
                        email: tenant.email || 'locataire@katdestate.immo',
                        password: pass,
                        phone: tenant.phone || undefined,
                      });
                    }}
                  >
                    <KeyRound className="size-3.5" />
                    <span>Identifiants d'accès</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal Fiche d'Accès Locataire */}
      {accessCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl text-foreground">
            
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Fiche d'Accès Locataire</h3>
                  <p className="text-xs text-muted-foreground">{accessCard.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setAccessCard(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 bg-muted/40 p-4 rounded-2xl border border-border">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Portail de Connexion</span>
                <p className="text-xs font-mono font-bold text-primary">https://katdestate.vercel.app/sign-in</p>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/60">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Identifiant (Email)</span>
                <p className="text-sm font-mono font-bold text-foreground bg-background p-2 rounded-xl border border-border select-all">
                  {accessCard.email}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Mot de Passe</span>
                <p className="text-sm font-mono font-bold text-emerald-500 bg-background p-2 rounded-xl border border-border select-all">
                  {accessCard.password}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Transmettez ces identifiants à votre locataire. Il pourra se connecter immédiatement, consulter son bail et régler son loyer par Mobile Money.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCredentials(accessCard)}
                className="text-xs font-bold flex items-center justify-center gap-1.5 h-10"
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleShareWhatsApp(accessCard)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 h-10"
              >
                <Smartphone className="size-4" />
                <span>WhatsApp</span>
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function TenantForm({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (values: TenantInput, generatedPassword: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('Locataire2026!');
  const [tenantEmail, setTenantEmail] = useState('');

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = 'Loc-';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += '!';
    setGeneratedPassword(pass);
  };

  return (
    <form
      className="max-w-2xl space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const emailValue = (form.get('email') as string) || tenantEmail || undefined;
        const parsed = tenantInputSchema.safeParse({
          fullName: form.get('fullName'),
          phone: form.get('phone') || undefined,
          email: emailValue,
          profession: form.get('profession') || undefined,
          identityDocumentType: form.get('identityDocumentType') || undefined,
          identityDocumentNumber: form.get('identityDocumentNumber') || undefined,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide');
          return;
        }
        setError(null);
        onSubmit(parsed.data, generatedPassword);
      }}
    >
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <UserCheck className="size-5 text-emerald-500" />
        <h3 className="font-bold text-base">Enregistrer un Locataire & Créer ses Accès</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-xs text-muted-foreground uppercase">Nom complet *</span>
          <Input name="fullName" placeholder="Ex : M. Mamadou Coulibaly" required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-xs text-muted-foreground uppercase">Téléphone (WhatsApp) *</span>
          <Input name="phone" placeholder="+225 07 00 00 00 00" required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-xs text-muted-foreground uppercase">Email de Connexion *</span>
          <Input
            name="email"
            type="email"
            placeholder="locataire@katdestate.immo"
            value={tenantEmail}
            onChange={(e) => setTenantEmail(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-xs text-muted-foreground uppercase">Profession</span>
          <Input name="profession" placeholder="Ex : Cadre bancaire, Commerçant..." />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-xs text-muted-foreground uppercase">Type de pièce d'identité</span>
          <select name="identityDocumentType" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs">
            <option value="">Sélectionnez…</option>
            <option value="NATIONAL_ID">Carte Nationale d’Identité (CNI)</option>
            <option value="PASSPORT">Passeport</option>
            <option value="RESIDENCE_PERMIT">Titre de Séjour / Carte Consulaire</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-xs text-muted-foreground uppercase">Numéro de pièce</span>
          <Input name="identityDocumentNumber" placeholder="Ex : C0123456789" autoComplete="off" />
        </label>
      </div>

      {/* Section Identifiants de connexion */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase">
            <KeyRound className="size-4" /> Identifiants de connexion générés pour ce locataire
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleGeneratePassword}
            className="text-[11px] h-7 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/20"
          >
            <RefreshCw className="size-3 mr-1" /> Générer nouveau
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Identifiant de connexion :</span>
            <strong className="text-foreground font-mono">{tenantEmail || 'Entrez l’email ci-dessus'}</strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Mot de passe temporaire :</span>
            <strong className="text-emerald-500 font-mono text-sm">{generatedPassword}</strong>
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-rose-500 font-semibold">{error}</p> : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl">
          {submitting ? 'Création en cours…' : 'Enregistrer le Locataire & Générer la Fiche d’Accès'}
        </Button>
      </div>
    </form>
  );
}
