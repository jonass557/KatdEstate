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

interface Tenant {
  _id: string;
  fullName: string;
  phone?: string;
  email?: string;
  profession?: string;
  status: string;
  identityDocumentNumber?: string;
}

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useOrgList<Tenant>(['tenants', search], `/tenants?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ''}`);

  const create = useMutation({
    mutationFn: (input: TenantInput) => apiRequest(`${base}/tenants`, { method: 'POST', body: input }),
    onSuccess: () => {
      void client.invalidateQueries();
      setOpen(false);
      toast({ title: 'Locataire enregistré', description: 'Le numéro de pièce est chiffré au repos.', variant: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Enregistrement impossible', description: error.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locataires"
        description="Les numéros de pièce d’identité sont chiffrés et masqués."
        actions={<Button onClick={() => setOpen((value) => !value)}>Nouveau locataire</Button>}
      />

      {open ? <TenantForm submitting={create.isPending} onSubmit={(values) => create.mutate(values)} /> : null}

      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par nom" className="max-w-xs" />

      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {!isLoading && (data?.data ?? []).length === 0 ? <EmptyState title="Aucun locataire" description="Ajoutez le premier locataire de l’organisation." /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.data ?? []).map((tenant) => (
          <Card key={tenant._id}>
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{tenant.fullName}</p>
                <Badge>{tenant.status === 'ACTIVE' ? 'Actif' : tenant.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{tenant.phone ?? 'Pas de téléphone'}</p>
              <p className="text-sm text-muted-foreground">{tenant.email ?? 'Pas d’email'}</p>
              {tenant.profession ? <p className="text-xs text-muted-foreground">{tenant.profession}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TenantForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (values: TenantInput) => void }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="max-w-xl space-y-3 rounded-2xl border border-border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = tenantInputSchema.safeParse({
          fullName: form.get('fullName'),
          phone: form.get('phone') || undefined,
          email: form.get('email') || undefined,
          profession: form.get('profession') || undefined,
          identityDocumentType: form.get('identityDocumentType') || undefined,
          identityDocumentNumber: form.get('identityDocumentNumber') || undefined,
        });
        if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide'); return; }
        setError(null);
        onSubmit(parsed.data);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="font-medium">Nom complet</span><Input name="fullName" required /></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Téléphone</span><Input name="phone" /></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Email</span><Input name="email" type="email" /></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Profession</span><Input name="profession" /></label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Type de pièce</span>
          <select name="identityDocumentType" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="">—</option>
            <option value="NATIONAL_ID">Carte nationale</option>
            <option value="PASSPORT">Passeport</option>
            <option value="RESIDENCE_PERMIT">Titre de séjour</option>
          </select>
        </label>
        <label className="space-y-1 text-sm"><span className="font-medium">Numéro de pièce</span><Input name="identityDocumentNumber" autoComplete="off" /></label>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Le numéro de pièce est chiffré avant d’être stocké et n’est jamais affiché en clair sans autorisation.</p>
      <Button type="submit" disabled={submitting}>Enregistrer</Button>
    </form>
  );
}
