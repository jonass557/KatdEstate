import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  CheckCircle,
  Copy,
  FileCheck,
  Flame,
  Home,
  Plus,
  QrCode,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { apiRequest } from '../../lib/api-client';
import { useOrgPath, useOrgQuery } from '../../lib/query';

export function BlockLeaderDashboard() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<
    | 'overview'
    | 'validations'
    | 'new-residence'
    | 'registry'
    | 'incidents'
    | 'broadcast'
    | 'subscription'
  >('overview');

  // Queries
  const { data: dashboard } = useOrgQuery<any>(
    ['block-leader-dashboard'],
    '/quartier/dashboard/block-leader',
  );

  const { data: residences } = useOrgQuery<any[]>(
    ['block-residences'],
    dashboard?.block?._id
      ? `/quartier/residences?blockId=${dashboard.block._id}`
      : '/quartier/residences',
  );

  const { data: pendingSubmissions } = useOrgQuery<any[]>(
    ['block-pending-submissions'],
    dashboard?.block?._id
      ? `/quartier/submissions/pending?blockId=${dashboard.block._id}`
      : '/quartier/submissions/pending',
  );

  const { data: incidents } = useOrgQuery<any[]>(
    ['block-incidents'],
    dashboard?.block?._id
      ? `/quartier/incidents?blockId=${dashboard.block._id}`
      : '/quartier/incidents',
  );

  // Mutation: Validate / Reject submission
  const validateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      decisionReason,
    }: {
      id: string;
      status: 'VALIDATED' | 'REJECTED';
      decisionReason?: string;
    }) =>
      apiRequest(`${base}/quartier/submissions/${id}/validate`, {
        method: 'POST',
        body: { status, decisionReason },
      }),
    onSuccess: () => {
      toast({ title: 'Validation enregistrée', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['block-leader-dashboard'] });
      void client.invalidateQueries({ queryKey: ['block-pending-submissions'] });
      void client.invalidateQueries({ queryKey: ['block-residences'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Manual residence creation
  const createResidenceMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/quartier/residences`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Résidence recensée avec succès', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['block-leader-dashboard'] });
      void client.invalidateQueries({ queryKey: ['block-residences'] });
      setTab('registry');
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur de création', description: err.message, variant: 'error' }),
  });

  // Mutation: Incident status update
  const updateIncidentMutation = useMutation({
    mutationFn: ({
      id,
      status,
      resolutionNotes,
    }: {
      id: string;
      status: string;
      resolutionNotes?: string;
    }) =>
      apiRequest(`${base}/quartier/incidents/${id}`, {
        method: 'PATCH',
        body: { status, resolutionNotes },
      }),
    onSuccess: () => {
      toast({ title: 'Statut mis à jour', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['block-incidents'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Broadcast announcement
  const broadcastMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/quartier/announcements`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Annonce diffusée aux habitants du bloc', variant: 'success' });
      setTab('overview');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const block = dashboard?.block;
  const kpis = dashboard?.kpis;
  const sub = dashboard?.subscription;

  const joinUrl = block?.registrationToken
    ? `https://kadtestate.immo/quartier/join/${block.registrationToken}`
    : '';

  return (
    <div className="space-y-6">
      {/* Block Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Chef de Bloc : {block?.name || 'Mon Secteur'}
            </h1>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              Code : {block?.code || 'BLOC'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quartier : <strong>{block?.neighborhoodName || 'Quartier'}</strong> • Forfait :{' '}
            <strong>{sub?.plan?.name || 'Découverte'}</strong>
          </p>
        </div>

        {/* Invitation Link & QR Code helper */}
        <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-2.5 rounded-xl border border-border text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <QrCode className="h-4 w-4 text-primary" />
            <span>Lien d'enregistrement des habitants :</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              if (joinUrl) {
                navigator.clipboard.writeText(joinUrl);
                toast({ title: 'Lien copié dans le presse-papier !', variant: 'success' });
              }
            }}
          >
            <Copy className="h-3 w-3 mr-1" /> Copier le lien du bloc
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-xs">
        {[
          { key: 'overview', label: 'Vue d’ensemble & KPIs', icon: Home },
          {
            key: 'validations',
            label: `Demandes en attente (${pendingSubmissions?.length || 0})`,
            icon: FileCheck,
          },
          { key: 'new-residence', label: '+ Recenser une maison', icon: Plus },
          {
            key: 'registry',
            label: `Registre du bloc (${residences?.length || 0})`,
            icon: Building,
          },
          {
            key: 'incidents',
            label: `Sécurité & Signalements (${incidents?.length || 0})`,
            icon: Flame,
          },
          { key: 'broadcast', label: 'Diffuser une annonce', icon: Send },
          { key: 'subscription', label: 'Mon Abonnement', icon: Sparkles },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & KPIS */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Maisons Recensées
                </CardTitle>
                <Home className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.totalResidences || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.totalDwellings || 0} logements au total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Occupation
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {kpis?.occupiedResidences || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.vacantResidences || 0} résidences vacantes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Population Déclarée
                </CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.totalResidents || 0} hab.</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.totalHouseholds || 0} foyers ({kpis?.totalMinors || 0} enfants)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Taux de Couverture
                </CardTitle>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {kpis?.censusCompletionRate || 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.pendingValidations || 0} en attente
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick sections: Pending validations preview & QR code card */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" /> Dernières demandes à valider
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setTab('validations')}
                >
                  Voir tout
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {!pendingSubmissions || pendingSubmissions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Aucune demande en attente pour ce bloc.
                  </p>
                ) : (
                  pendingSubmissions.slice(0, 3).map((s) => (
                    <div
                      key={s._id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {s.submittedBy?.name || 'Résident'}
                        </p>
                        <p className="text-muted-foreground truncate max-w-[200px]">
                          {s.residenceId?.address}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                        onClick={() => validateMutation.mutate({ id: s._id, status: 'VALIDATED' })}
                      >
                        Valider
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border p-5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <QrCode className="h-5 w-5 text-primary" />
                  <span>Enrôlement autonome des habitants par QR code</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Invitez les habitants de votre bloc à s'enregistrer eux-mêmes. Partagez le lien de
                  votre bloc sur WhatsApp ou imprimez le QR code pour l'afficher à l'entrée de la
                  rue.
                </p>
                <div className="rounded-lg bg-muted p-2 font-mono text-[11px] truncate">
                  {joinUrl || 'Lien en cours de chargement...'}
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  if (joinUrl) {
                    navigator.clipboard.writeText(joinUrl);
                    toast({ title: 'Lien d’enregistrement copié !', variant: 'success' });
                  }
                }}
              >
                Copier le lien public du bloc
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: DEMANDES EN ATTENTE */}
      {tab === 'validations' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">
            Demandes d'enregistrement en attente de vérification
          </h2>
          {!pendingSubmissions || pendingSubmissions.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              Toutes les demandes de recensement de votre bloc ont été traitées !
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingSubmissions.map((s) => (
                <Card
                  key={s._id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs border-border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {s.submittedBy?.name}
                      </span>
                      <span className="rounded bg-amber-500/20 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                        En attente
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Adresse déclarée : <strong>{s.residenceId?.address}</strong>{' '}
                      {s.residenceId?.landmark ? `(${s.residenceId.landmark})` : ''}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Contact : {s.submittedBy?.phone || 'Non renseigné'} • Foyer :{' '}
                      {s.householdId?.householdSize || 1} personne(s)
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs font-bold"
                      onClick={() => validateMutation.mutate({ id: s._id, status: 'VALIDATED' })}
                    >
                      Valider le rattachement
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-red-600"
                      onClick={() => {
                        const reason = prompt(
                          'Motif du rejet (ex: mauvais bloc, adresse erronée) :',
                        );
                        if (reason)
                          validateMutation.mutate({
                            id: s._id,
                            status: 'REJECTED',
                            decisionReason: reason,
                          });
                      }}
                    >
                      Refuser
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ENREGISTRER UNE MAISON DIRECTEMENT */}
      {tab === 'new-residence' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base">
              Enregistrement manuel d'une résidence par le Chef
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Saisie directe par vos soins lors d'une tournée dans votre bloc avec détection
              anti-doublon.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                createResidenceMutation.mutate({
                  cityId: block?.neighborhoodId?.cityId || dashboard?.block?.neighborhoodId,
                  neighborhoodId: block?.neighborhoodId?._id || dashboard?.block?.neighborhoodId,
                  blockId: block?._id,
                  buildingType: form.get('buildingType'),
                  address: form.get('address'),
                  landmark: form.get('landmark') || undefined,
                  dwellingsCount: Number(form.get('dwellingsCount')),
                  occupancyStatus: form.get('occupancyStatus'),
                  ownerName: form.get('ownerName') || undefined,
                  ownerPhone: form.get('ownerPhone') || undefined,
                  notes: form.get('notes') || undefined,
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1">Type d'habitation *</label>
                  <select
                    name="buildingType"
                    className="w-full rounded-md border border-input bg-background p-2 text-xs"
                    defaultValue="INDIVIDUAL_HOUSE"
                  >
                    <option value="INDIVIDUAL_HOUSE">Maison individuelle</option>
                    <option value="RESIDENTIAL_BUILDING">Immeuble résidentiel</option>
                    <option value="APARTMENT">Appartement</option>
                    <option value="STUDIO">Studio</option>
                    <option value="COLLECTIVE_RESIDENCE">Résidence collective</option>
                    <option value="COMMERCIAL_RESIDENTIAL">
                      Logement commercial & résidentiel
                    </option>
                    <option value="OTHER_BUILDING">Autre type</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Nombre de logements *</label>
                  <Input name="dwellingsCount" type="number" min="1" defaultValue="1" required />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Adresse ou numéro dans le bloc *</label>
                <Input name="address" placeholder="Ex: Porte 12, Rue de la Paix" required />
              </div>

              <div>
                <label className="font-semibold block mb-1">Repère visuel</label>
                <Input name="landmark" placeholder="Ex: Maison bleue à côté de l'arbre mango" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1">Statut d'occupation *</label>
                  <select
                    name="occupancyStatus"
                    className="w-full rounded-md border border-input bg-background p-2 text-xs"
                    defaultValue="OCCUPIED"
                  >
                    <option value="OCCUPIED">Occupé</option>
                    <option value="VACANT">Vacant</option>
                    <option value="UNDER_CONSTRUCTION">En construction</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Propriétaire connu (Nom)</label>
                  <Input name="ownerName" placeholder="Nom du bailleur / propriétaire" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={createResidenceMutation.isPending}
                className="w-full font-bold"
              >
                {createResidenceMutation.isPending
                  ? 'Enregistrement...'
                  : 'Enregistrer la résidence'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: REGISTRE DU BLOC */}
      {tab === 'registry' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Registre officiel des résidences du bloc</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">ID KatdEstate</th>
                  <th className="p-3">Adresse & Repère</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Logements</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {residences?.map((r) => (
                  <tr key={r._id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono font-bold text-primary">{r.residenceDomoraId}</td>
                    <td className="p-3">
                      <span className="font-semibold block">{r.address}</span>
                      {r.landmark && (
                        <span className="text-[11px] text-muted-foreground">{r.landmark}</span>
                      )}
                    </td>
                    <td className="p-3">{r.buildingType}</td>
                    <td className="p-3 font-bold">{r.dwellingsCount || 1}</td>
                    <td className="p-3">
                      <span className="rounded bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                        {r.occupancyStatus}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: INCIDENTS & SÉCURITÉ */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">
            Signalements de sécurité & urgences communautaires
          </h2>
          <div className="space-y-3">
            {incidents?.map((inc) => (
              <Card
                key={inc._id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border-border"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{inc.incidentNumber}</span>
                    <span className="rounded bg-red-600 text-white px-2 py-0.5 text-[10px] font-bold">
                      {inc.category}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">
                      Urgence : {inc.severity}
                    </span>
                  </div>
                  <p className="text-foreground mt-1 font-medium">{inc.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Lieu : {inc.locationText || 'Dans le bloc'} • Déclarant :{' '}
                    <strong>{inc.reporterName || 'Habitant'}</strong> (
                    {inc.reporterPhone || 'Non renseigné'})
                  </p>
                </div>

                <div className="flex gap-2">
                  {inc.status === 'NEW' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() =>
                        updateIncidentMutation.mutate({ id: inc._id, status: 'VERIFYING' })
                      }
                    >
                      Prendre en charge
                    </Button>
                  )}
                  {inc.status !== 'RESOLVED' && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs font-bold"
                      onClick={() => {
                        const notes = prompt('Notes de résolution de l’incident :');
                        updateIncidentMutation.mutate({
                          id: inc._id,
                          status: 'RESOLVED',
                          resolutionNotes: notes || 'Incident réglé.',
                        });
                      }}
                    >
                      Clôturer comme résolu
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: DIFFUSER UNE ANNONCE */}
      {tab === 'broadcast' && (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base">
              Diffuser une communication aux habitants du bloc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                broadcastMutation.mutate({
                  scope: 'BLOCK',
                  type: form.get('type'),
                  title: form.get('title'),
                  message: form.get('message'),
                  neighborhoodId: block?.neighborhoodId?._id || dashboard?.block?.neighborhoodId,
                  blockId: block?._id,
                  eventDate: form.get('eventDate') || undefined,
                });
              }}
            >
              <div>
                <label className="font-semibold block mb-1">Type d'annonce *</label>
                <select
                  name="type"
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                  defaultValue="INFO"
                >
                  <option value="INFO">Information générale</option>
                  <option value="MEETING">Réunion de bloc</option>
                  <option value="WORKS">Travaux & Voirie</option>
                  <option value="URGENT_ALERT">Alerte urgente</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Titre de l'annonce *</label>
                <Input
                  name="title"
                  placeholder="Ex: Réunion de propreté et éclairage public samedi à 17h"
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Message aux résidents *</label>
                <textarea
                  name="message"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                  placeholder="Écrivez votre message..."
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Date et heure de l'événement (facultatif)
                </label>
                <Input name="eventDate" type="datetime-local" />
              </div>

              <Button
                type="submit"
                disabled={broadcastMutation.isPending}
                className="w-full font-bold"
              >
                {broadcastMutation.isPending ? 'Diffusion en cours...' : 'Diffuser l’annonce'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 7: ABONNEMENT DU CHEF */}
      {tab === 'subscription' && (
        <Card className="max-w-xl mx-auto p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Formule {sub?.plan?.name || 'Découverte'}
              </h3>
              <p className="text-muted-foreground">
                Statut :{' '}
                <strong className="text-emerald-600">{sub?.subscription?.status || 'Actif'}</strong>
              </p>
            </div>
            <span className="text-xl font-black text-primary">
              {sub?.plan?.priceMinor === 0
                ? 'Gratuit'
                : `${sub?.plan?.priceMinor?.toLocaleString('fr-FR')} XOF`}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Résidences recensées :</span>
              <span className="font-bold">
                {sub?.usage?.residencesCount || 0} / {sub?.usage?.maxResidences || 500}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Blocs attribués :</span>
              <span className="font-bold">
                {sub?.usage?.blocksCount || 1} / {sub?.usage?.maxBlocks || 1}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accès Carte interactive :</span>
              <span className="font-bold text-emerald-600">Oui</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
