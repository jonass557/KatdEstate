import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Download,
  FileCheck,
  FileText,
  HardDrive,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '../components/page-header';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { Modal } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';

interface DocumentItem {
  _id: string;
  title: string;
  type: string;
  category: string;
  version: number;
  size?: number;
  fileUrl?: string;
  isArchived?: boolean;
  expiresAt?: string;
  createdAt: string;
}

interface StorageUsage {
  usedBytes: number;
  usedMb: number;
  quotaMb: number;
  percentage: number;
  tier: string;
  documentCount: number;
}

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tous' },
  { key: 'LEASE_CONTRACT', label: 'Baux & Contrats' },
  { key: 'IDENTITY', label: 'Pièces d’identité' },
  { key: 'TENANT_DOCUMENT', label: 'Dossiers Locataires' },
  { key: 'OWNER_DOCUMENT', label: 'Documents Propriétaires' },
  { key: 'PROPERTY_TITLE', label: 'Titres de propriété' },
  { key: 'INVOICE', label: 'Factures' },
  { key: 'RECEIPT', label: 'Quittances & Reçus' },
  { key: 'REPORT', label: 'Rapports financiers' },
  { key: 'MAINTENANCE', label: 'Maintenance' },
  { key: 'PHOTO', label: 'Photos' },
  { key: 'OTHER', label: 'Autres' },
];

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 Ko';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function DocumentsPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Queries
  const { data: storage } = useOrgQuery<StorageUsage>(
    ['storage-usage'],
    '/documents/storage-usage',
  );

  const queryUrl = `/documents?${new URLSearchParams({
    ...(selectedCategory !== 'ALL' ? { category: selectedCategory } : {}),
    ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
    ...(showArchived ? { archived: 'true' } : {}),
  }).toString()}`;

  const { data: documents, isLoading } = useOrgQuery<DocumentItem[]>(
    ['documents', selectedCategory, searchQuery, showArchived],
    queryUrl,
  );

  const expiringQuery = useOrgQuery<DocumentItem[]>(['documents-expiring'], '/documents/expiring');

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/documents`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['documents'] });
      void client.invalidateQueries({ queryKey: ['storage-usage'] });
      setUploadModalOpen(false);
      toast({ title: 'Document importé avec succès', variant: 'success' });
    },
    onError: (err: Error) => {
      toast({ title: 'Échec de l’import', description: err.message, variant: 'error' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${base}/documents/${id}/archive`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document archivé', variant: 'success' });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${base}/documents/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document restauré', variant: 'success' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${base}/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['documents'] });
      void client.invalidateQueries({ queryKey: ['storage-usage'] });
      toast({ title: 'Document supprimé', variant: 'success' });
    },
  });

  const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = form.get('title') as string;
    const category = form.get('category') as string;
    const fileUrl = form.get('fileUrl') as string;
    const expiresAt = form.get('expiresAt') as string;

    if (!title || !category) {
      toast({ title: 'Titre et catégorie obligatoires', variant: 'error' });
      return;
    }

    uploadMutation.mutate({
      title,
      type: category,
      category,
      fileUrl: fileUrl || `https://storage.domora.app/docs/${Date.now()}.pdf`,
      size: 512 * 1024,
      expiresAt: expiresAt || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion Documentaire"
        description="Bibliothèque centrale et sécurisée : baux, quittances, pièces d'identité et titres fonciers."
        actions={
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            Importer un document
          </Button>
        }
      />

      {/* Jauge d'utilisation du stockage SaaS */}
      {storage && (
        <Card className="bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <HardDrive className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Stockage SaaS · Formule {storage.tier}</p>
                  <p className="text-xs text-muted-foreground">
                    {storage.usedMb} Mo utilisés sur {storage.quotaMb} Mo ({storage.documentCount}{' '}
                    document{storage.documentCount > 1 ? 's' : ''})
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-64 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Capacité</span>
                  <span className="font-semibold">{storage.percentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${
                      storage.percentage > 85 ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, storage.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerte Expirations Proches */}
      {expiringQuery.data && expiringQuery.data.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
            <FileCheck className="size-4" />
            Documents expirant dans les 60 jours ({expiringQuery.data.length})
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {expiringQuery.data.map((doc) => (
              <div
                key={doc._id}
                className="flex items-center justify-between rounded-lg bg-background/80 p-2 text-xs"
              >
                <span className="truncate font-medium">{doc.title}</span>
                <Badge className="border border-border bg-muted text-muted-foreground">
                  {doc.expiresAt?.slice(0, 10)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par titre de document…"
            className="pl-9 h-10"
          />
        </div>
        <Button
          variant={showArchived ? 'primary' : 'secondary'}
          onClick={() => setShowArchived((v) => !v)}
          className="h-10 text-xs inline-flex items-center gap-1.5"
        >
          <Archive className="size-3.5" />
          {showArchived ? 'Afficher actifs' : 'Voir archives'}
        </Button>
      </div>

      {/* Onglets Catégories */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-2 overflow-x-auto">
        {CATEGORY_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={selectedCategory === tab.key ? 'primary' : 'secondary'}
            className="h-8 px-2.5 text-xs whitespace-nowrap"
            onClick={() => setSelectedCategory(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Liste des documents */}
      <div className="space-y-2">
        {isLoading && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Chargement des documents…
          </p>
        )}

        {!isLoading && documents?.length === 0 && (
          <EmptyState
            title="Aucun document trouvé"
            description="Aucune pièce ne correspond à vos critères de recherche dans cette catégorie."
          />
        )}

        {documents?.map((doc) => (
          <div
            key={doc._id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 transition hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  {doc.title}
                  {doc.isArchived && (
                    <Badge className="border border-border bg-muted text-muted-foreground">
                      Archivé
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Catégorie : {doc.category || doc.type} · Version {doc.version} ·{' '}
                  {formatBytes(doc.size)} · Déposé le{' '}
                  {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {doc.expiresAt && (
                <Badge className="border border-border bg-muted text-muted-foreground text-xs">
                  Exp : {doc.expiresAt.slice(0, 10)}
                </Badge>
              )}

              {doc.fileUrl && (
                <Button
                  variant="secondary"
                  className="h-8 px-2.5 text-xs inline-flex items-center gap-1"
                  onClick={() => window.open(doc.fileUrl, '_blank', 'noopener')}
                >
                  <Download className="size-3.5" />
                  Consulter
                </Button>
              )}

              {doc.isArchived ? (
                <Button
                  variant="secondary"
                  className="h-8 px-2 text-xs"
                  onClick={() => restoreMutation.mutate(doc._id)}
                  title="Restaurer"
                >
                  <ArchiveRestore className="size-3.5" />
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="h-8 px-2 text-xs"
                  onClick={() => archiveMutation.mutate(doc._id)}
                  title="Archiver"
                >
                  <Archive className="size-3.5" />
                </Button>
              )}

              <Button
                variant="secondary"
                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (window.confirm('Supprimer définitivement ce document ?')) {
                    deleteMutation.mutate(doc._id);
                  }
                }}
                title="Supprimer"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modale d'import de document */}
      <Modal open={uploadModalOpen} onOpenChange={setUploadModalOpen} title="Importer un document">
        <form onSubmit={handleUpload} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium">Titre du document *</label>
            <Input name="title" placeholder="ex: Contrat de bail - Lot A2" required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Catégorie *</label>
              <select
                name="category"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                required
              >
                {CATEGORY_TABS.filter((t) => t.key !== 'ALL').map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Date d’expiration (optionnel)</label>
              <Input name="expiresAt" type="date" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Fichier ou URL du document</label>
            <Input name="fileUrl" placeholder="https://… ou sélectionner un fichier local" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUploadModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Importation…' : 'Enregistrer le document'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
