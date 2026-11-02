import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Building,
  Clock,
  Coins,
  FileCheck,
  Filter,
  Home,
  MapPin,
  Percent,
  Printer,
  Sliders,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { apiRequest } from '../../lib/api-client';
import { useOrgPath, useOrgQuery } from '../../lib/query';

export function ChefferieDashboard() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<
    'overview' | 'house-sales' | 'house-rentals' | 'land-sales' | 'certificates' | 'commissions-config'
  >('overview');

  // Selected neighborhood filter
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState('');

  // 1. Territories queries
  const { data: cities } = useQuery<any[]>({
    queryKey: ['quartier-cities'],
    queryFn: () => apiRequest('/quartier/cities'),
  });

  const [selectedCityId, setSelectedCityId] = useState('');
  const { data: neighborhoods } = useQuery<any[]>({
    queryKey: ['quartier-neighborhoods', selectedCityId],
    queryFn: () => apiRequest(`/quartier/neighborhoods?cityId=${selectedCityId}`),
    enabled: Boolean(selectedCityId),
  });

  const { data: blocks } = useQuery<any[]>({
    queryKey: ['quartier-blocks', selectedNeighborhoodId],
    queryFn: () => apiRequest(`/quartier/blocks?neighborhoodId=${selectedNeighborhoodId}`),
    enabled: Boolean(selectedNeighborhoodId),
  });

  // 2. Chefferie Dashboard stats
  const { data: statsData } = useOrgQuery<any>(
    ['chefferie-dashboard-stats', selectedNeighborhoodId],
    selectedNeighborhoodId
      ? `/quartier/chefferie/dashboard?neighborhoodId=${selectedNeighborhoodId}`
      : '/quartier/chefferie/dashboard'
  );

  // 3. Transactions queries
  const { data: houseSales } = useOrgQuery<any[]>(
    ['chefferie-house-sales', selectedNeighborhoodId],
    selectedNeighborhoodId
      ? `/quartier/chefferie/house-sales?neighborhoodId=${selectedNeighborhoodId}`
      : '/quartier/chefferie/house-sales'
  );

  const { data: houseRentalsData } = useOrgQuery<any>(
    ['chefferie-house-rentals', selectedNeighborhoodId],
    selectedNeighborhoodId
      ? `/quartier/chefferie/house-rentals?neighborhoodId=${selectedNeighborhoodId}`
      : '/quartier/chefferie/house-rentals'
  );
  const houseRentals = houseRentalsData?.rentals || [];

  const { data: landSales } = useOrgQuery<any[]>(
    ['chefferie-land-sales', selectedNeighborhoodId],
    selectedNeighborhoodId
      ? `/quartier/chefferie/land-sales?neighborhoodId=${selectedNeighborhoodId}`
      : '/quartier/chefferie/land-sales'
  );

  const { data: certificates } = useOrgQuery<any[]>(
    ['chefferie-certificates', selectedNeighborhoodId],
    selectedNeighborhoodId
      ? `/quartier/chefferie/certificates?neighborhoodId=${selectedNeighborhoodId}`
      : '/quartier/chefferie/certificates'
  );

  const { data: commissionSettingsData } = useOrgQuery<any>(
    ['chefferie-commissions-settings', selectedNeighborhoodId],
    selectedNeighborhoodId
      ? `/quartier/chefferie/commissions/settings?neighborhoodId=${selectedNeighborhoodId}`
      : '/quartier/chefferie/commissions/settings',
    Boolean(selectedNeighborhoodId)
  );

  // Active service hours status
  const serviceHours = statsData?.serviceHours || houseRentalsData?.serviceHours || {
    isOpen: new Date().getHours() >= 5 && new Date().getHours() < 22,
    openingTime: '05:00',
    closingTime: '22:00',
    currentServerTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
    statusMessage: 'Service locatif ouvert de 05h00 à 22h00',
  };

  // State for printable certificate modal
  const [selectedCertificate, setSelectedCertificate] = useState<any | null>(null);

  // Mutations
  const recordHouseSaleMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/quartier/chefferie/house-sales`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Vente de maison enregistrée avec succès', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['chefferie-dashboard-stats'] });
      void client.invalidateQueries({ queryKey: ['chefferie-house-sales'] });
      setTab('house-sales');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const recordHouseRentalMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/quartier/chefferie/house-rentals`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Location enregistrée avec succès', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['chefferie-dashboard-stats'] });
      void client.invalidateQueries({ queryKey: ['chefferie-house-rentals'] });
      setTab('house-rentals');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const recordLandSaleMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/quartier/chefferie/land-sales`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Vente de terrain enregistrée avec succès', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['chefferie-dashboard-stats'] });
      void client.invalidateQueries({ queryKey: ['chefferie-land-sales'] });
      setTab('land-sales');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const issueCertificateMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/quartier/chefferie/certificates`, { method: 'POST', body }),
    onSuccess: (res: any) => {
      toast({ title: 'Certificat officiel délivré !', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['chefferie-dashboard-stats'] });
      void client.invalidateQueries({ queryKey: ['chefferie-certificates'] });
      if (res?.certificate) {
        setSelectedCertificate(res.certificate);
      }
      setTab('certificates');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const updateCommissionsMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/quartier/chefferie/commissions/settings`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Taux de commission enregistrés', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['chefferie-commissions-settings'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const kpis = statsData?.kpis;

  return (
    <div className="space-y-6">
      {/* Chefferie Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-amber-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white font-bold text-xs shadow-sm">
              👑
            </span>
            <h1 className="text-xl font-black text-foreground">Chefferie Traditionnelle & Immobilière</h1>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              KadtEstate Chefferie
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enregistrement des ventes de maisons, locations, transactions foncières, calcul automatique des commissions et délivrance des certificats officiels.
          </p>
        </div>

        {/* Operating Hours Dynamic Badge */}
        <div className="flex flex-col sm:items-end gap-1 text-xs">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${
              serviceHours.isOpen
                ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{serviceHours.isOpen ? 'Service Locatif : OUVERT' : 'Service Locatif : FERMÉ'}</span>
            <span className="font-normal opacity-90">({serviceHours.openingTime} - {serviceHours.closingTime})</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Heure locale : <strong>{serviceHours.currentServerTime}</strong>
          </span>
        </div>
      </div>

      {/* Neighborhood selector filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border text-xs">
        <span className="font-semibold text-muted-foreground flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" /> Filtrer par secteur :
        </span>
        <select
          className="rounded-md border border-input bg-background p-1.5 text-xs"
          value={selectedCityId}
          onChange={(e) => {
            setSelectedCityId(e.target.value);
            setSelectedNeighborhoodId('');
            setSelectedBlockId('');
          }}
        >
          <option value="">Toutes les villes</option>
          {cities?.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-input bg-background p-1.5 text-xs"
          value={selectedNeighborhoodId}
          onChange={(e) => {
            setSelectedNeighborhoodId(e.target.value);
            setSelectedBlockId('');
          }}
          disabled={!selectedCityId}
        >
          <option value="">Tous les quartiers</option>
          {neighborhoods?.map((n) => (
            <option key={n._id} value={n._id}>{n.name}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-input bg-background p-1.5 text-xs"
          value={selectedBlockId}
          onChange={(e) => setSelectedBlockId(e.target.value)}
          disabled={!selectedNeighborhoodId}
        >
          <option value="">Tous les blocs</option>
          {blocks?.map((b) => (
            <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-xs">
        {[
          { key: 'overview', label: 'Tableau de bord Chefferie', icon: Award },
          { key: 'house-sales', label: `Ventes de Maisons (${houseSales?.length || 0})`, icon: Home },
          { key: 'house-rentals', label: `Locations de Maisons (${houseRentals?.length || 0})`, icon: Building },
          { key: 'land-sales', label: `Ventes de Terrains (${landSales?.length || 0})`, icon: MapPin },
          { key: 'certificates', label: `Certificats Officiels (${certificates?.length || 0})`, icon: FileCheck },
          { key: 'commissions-config', label: 'Taux de Commission Chefferie', icon: Sliders },
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
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & KPIS CHEFFERIE */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Ventes de Maisons</CardTitle>
                <Home className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.totalHousesSold || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Volume : {(kpis?.totalHousesSoldVolumeMinor || 0).toLocaleString('fr-FR')} XOF
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Maisons en Location</CardTitle>
                <Building className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{kpis?.totalHousesRented || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Loyers mensuels : {(kpis?.totalRentalsVolumeMinor || 0).toLocaleString('fr-FR')} XOF
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Terrains Vendus</CardTitle>
                <MapPin className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{kpis?.totalLandsSold || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Volume : {(kpis?.totalLandsSoldVolumeMinor || 0).toLocaleString('fr-FR')} XOF
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Certificats Délivrés</CardTitle>
                <FileCheck className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{kpis?.totalCertificatesIssued || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Documents officiels vérifiables</p>
              </CardContent>
            </Card>
          </div>

          {/* Financial summary: commissions due vs paid */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4 bg-muted/20 border-border text-xs space-y-1">
              <span className="text-muted-foreground font-semibold">Total Transactions Enregistrées</span>
              <div className="text-xl font-black text-foreground">
                {(kpis?.totalTransactionsVolumeMinor || 0).toLocaleString('fr-FR')} XOF
              </div>
              <p className="text-[11px] text-muted-foreground">{kpis?.totalTransactionsCount || 0} actes notifiés</p>
            </Card>

            <Card className="p-4 bg-emerald-500/10 border-emerald-500/30 text-xs space-y-1">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Coins className="h-4 w-4" /> Commissions Chefferie Encaissées
              </span>
              <div className="text-xl font-black text-emerald-600">
                {(kpis?.totalCommissionsPaidMinor || 0).toLocaleString('fr-FR')} XOF
              </div>
              <p className="text-[11px] text-muted-foreground">Montant net perçu</p>
            </Card>

            <Card className="p-4 bg-amber-500/10 border-amber-500/30 text-xs space-y-1">
              <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                <Percent className="h-4 w-4" /> Solde Restant à Percevoir
              </span>
              <div className="text-xl font-black text-amber-600">
                {(kpis?.totalCommissionsPendingMinor || 0).toLocaleString('fr-FR')} XOF
              </div>
              <p className="text-[11px] text-muted-foreground">
                Total dû : {(kpis?.totalCommissionsDueMinor || 0).toLocaleString('fr-FR')} XOF
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: VENTES DE MAISONS */}
      {tab === 'house-sales' && (
        <div className="space-y-6">
          {/* New House Sale Form */}
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-5 w-5 text-amber-600" /> Enregistrer une Vente de Maison
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Saisie de l'ancien propriétaire, nouvel acquéreur, prix de vente et calcul automatique de la commission chefferie.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4 text-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  recordHouseSaleMutation.mutate({
                    cityId: selectedCityId,
                    neighborhoodId: form.get('neighborhoodId'),
                    blockId: form.get('blockId'),
                    houseDescription: form.get('houseDescription'),
                    address: form.get('address'),
                    landmark: form.get('landmark') || undefined,
                    formerOwnerFullName: form.get('formerOwnerFullName'),
                    formerOwnerPhone: form.get('formerOwnerPhone'),
                    formerOwnerNationalId: form.get('formerOwnerNationalId') || undefined,
                    newBuyerFullName: form.get('newBuyerFullName'),
                    newBuyerPhone: form.get('newBuyerPhone'),
                    newBuyerNationalId: form.get('newBuyerNationalId') || undefined,
                    salePriceMinor: Number(form.get('salePriceMinor')),
                    customCommissionPercent: form.get('customCommissionPercent')
                      ? Number(form.get('customCommissionPercent'))
                      : undefined,
                    commissionPaidMinor: Number(form.get('commissionPaidMinor') || 0),
                    notes: form.get('notes') || undefined,
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">Quartier *</label>
                    <select
                      name="neighborhoodId"
                      className="w-full rounded-md border border-input bg-background p-2 text-xs"
                      value={selectedNeighborhoodId}
                      onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                      required
                    >
                      <option value="">Sélectionnez le quartier...</option>
                      {neighborhoods?.map((n) => (
                        <option key={n._id} value={n._id}>{n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Bloc / Carré *</label>
                    <select name="blockId" className="w-full rounded-md border border-input bg-background p-2 text-xs" required>
                      <option value="">Sélectionnez le bloc...</option>
                      {blocks?.map((b) => (
                        <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">Désignation du bien vendu *</label>
                    <Input name="houseDescription" placeholder="Ex: Villa R+1 avec 4 chambres et cour" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Adresse ou numéro de rue *</label>
                    <Input name="address" placeholder="Ex: Rue 12 x Angle Boulevard" required />
                  </div>
                </div>

                {/* Parties : Vendeur & Acheteur */}
                <div className="grid gap-4 sm:grid-cols-2 p-3 bg-muted/20 rounded-xl border border-border">
                  <div className="space-y-2">
                    <h4 className="font-bold text-primary">Ancien Propriétaire (Vendeur)</h4>
                    <Input name="formerOwnerFullName" placeholder="Nom et prénom *" required />
                    <Input name="formerOwnerPhone" placeholder="Téléphone *" required />
                    <Input name="formerOwnerNationalId" placeholder="Numéro CNI / Passeport" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-emerald-600">Nouvel Acquéreur (Acheteur)</h4>
                    <Input name="newBuyerFullName" placeholder="Nom et prénom *" required />
                    <Input name="newBuyerPhone" placeholder="Téléphone *" required />
                    <Input name="newBuyerNationalId" placeholder="Numéro CNI / Passeport" />
                  </div>
                </div>

                {/* Financier */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-semibold block mb-1">Prix de vente total (XOF) *</label>
                    <Input name="salePriceMinor" type="number" min="1" placeholder="Ex: 45000000" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Taux Chefferie (% configurable)</label>
                    <Input
                      name="customCommissionPercent"
                      type="number"
                      step="0.1"
                      placeholder={`Par défaut : ${commissionSettingsData?.effectiveRates?.houseSalePercent || 3}%`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Montant perçu par la chefferie (XOF)</label>
                    <Input name="commissionPaidMinor" type="number" min="0" placeholder="Ex: 1350000" defaultValue="0" />
                  </div>
                </div>

                <Button type="submit" disabled={recordHouseSaleMutation.isPending} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  {recordHouseSaleMutation.isPending ? 'Enregistrement...' : 'Enregistrer la vente de maison'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List of House Sales */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm">Historique des Ventes de Maisons Enregistrées</h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Réf.</th>
                    <th className="p-3">Bien & Adresse</th>
                    <th className="p-3">Vendeur & Acheteur</th>
                    <th className="p-3">Prix de vente</th>
                    <th className="p-3">Commission Chefferie</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3">Certificat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {houseSales?.map((h) => (
                    <tr key={h._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-primary">{h.transactionNumber}</td>
                      <td className="p-3">
                        <span className="font-semibold block">{h.houseDescription}</span>
                        <span className="text-[11px] text-muted-foreground">{h.address}</span>
                      </td>
                      <td className="p-3">
                        <span className="block text-[11px]">De : <strong>{h.formerOwner?.fullName}</strong></span>
                        <span className="block text-[11px]">À : <strong>{h.newBuyer?.fullName}</strong></span>
                      </td>
                      <td className="p-3 font-bold">{h.salePriceMinor?.toLocaleString('fr-FR')} XOF</td>
                      <td className="p-3">
                        <span className="font-bold text-emerald-600">
                          {h.commissionPaidMinor?.toLocaleString('fr-FR')} XOF
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          Dû : {h.commissionDueMinor?.toLocaleString('fr-FR')} XOF ({h.commissionPercent}%)
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            h.paymentStatus === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-600'
                              : h.paymentStatus === 'PARTIAL'
                                ? 'bg-amber-500/20 text-amber-600'
                                : 'bg-red-500/20 text-red-600'
                          }`}
                        >
                          {h.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        {h.certificateNumber ? (
                          <span className="font-mono text-[11px] font-bold text-purple-600">
                            {h.certificateNumber}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              const chefName = prompt('Nom du Chef signataire (ex: El Hadj Amadou Diop) :');
                              if (chefName) {
                                issueCertificateMutation.mutate({
                                  operationType: 'HOUSE_SALE',
                                  transactionId: h._id,
                                  chefferieName: 'Chefferie Traditionnelle et Communautaire',
                                  signatoryName: chefName,
                                  signatoryTitle: 'Chef de Quartier Habilité',
                                });
                              }
                            }}
                          >
                            Délivrer Certificat
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LOCATIONS DE MAISONS (GESTION LOCATIVE CHEFFERIE) */}
      {tab === 'house-rentals' && (
        <div className="space-y-6">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-5 w-5 text-emerald-600" /> Enregistrer un Contrat de Location
                </CardTitle>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    serviceHours.isOpen ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
                  }`}
                >
                  Horaires : 05h00 - 22h00
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Enregistrement du bailleur, du locataire, du loyer mensuel et calcul automatique de la commission de la chefferie.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4 text-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  recordHouseRentalMutation.mutate({
                    cityId: selectedCityId,
                    neighborhoodId: form.get('neighborhoodId'),
                    blockId: form.get('blockId'),
                    houseDescription: form.get('houseDescription'),
                    address: form.get('address'),
                    ownerFullName: form.get('ownerFullName'),
                    ownerPhone: form.get('ownerPhone'),
                    ownerNationalId: form.get('ownerNationalId') || undefined,
                    tenantFullName: form.get('tenantFullName'),
                    tenantPhone: form.get('tenantPhone'),
                    tenantProfession: form.get('tenantProfession') || undefined,
                    rentAmountMinor: Number(form.get('rentAmountMinor')),
                    rentalDurationMonths: Number(form.get('rentalDurationMonths') || 12),
                    startDate: form.get('startDate'),
                    endDate: form.get('endDate') || undefined,
                    customCommissionPercent: form.get('customCommissionPercent')
                      ? Number(form.get('customCommissionPercent'))
                      : undefined,
                    commissionPaidMinor: Number(form.get('commissionPaidMinor') || 0),
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">Quartier *</label>
                    <select
                      name="neighborhoodId"
                      className="w-full rounded-md border border-input bg-background p-2 text-xs"
                      value={selectedNeighborhoodId}
                      onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                      required
                    >
                      <option value="">Sélectionnez le quartier...</option>
                      {neighborhoods?.map((n) => (
                        <option key={n._id} value={n._id}>{n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Bloc *</label>
                    <select name="blockId" className="w-full rounded-md border border-input bg-background p-2 text-xs" required>
                      <option value="">Sélectionnez le bloc...</option>
                      {blocks?.map((b) => (
                        <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">Logement loué *</label>
                    <Input name="houseDescription" placeholder="Ex: Appartement 3 pièces au 2ème étage" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Adresse précise *</label>
                    <Input name="address" placeholder="Ex: Rue 4, Immeuble Baobab" required />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 p-3 bg-muted/20 rounded-xl border border-border">
                  <div className="space-y-2">
                    <h4 className="font-bold text-primary">Propriétaire (Bailleur)</h4>
                    <Input name="ownerFullName" placeholder="Nom et prénom *" required />
                    <Input name="ownerPhone" placeholder="Téléphone *" required />
                    <Input name="ownerNationalId" placeholder="CNI / Passeport" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-emerald-600">Locataire</h4>
                    <Input name="tenantFullName" placeholder="Nom et prénom *" required />
                    <Input name="tenantPhone" placeholder="Téléphone *" required />
                    <Input name="tenantProfession" placeholder="Profession" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="font-semibold block mb-1">Montant Loyer / mois *</label>
                    <Input name="rentAmountMinor" type="number" min="1" placeholder="Ex: 200000" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Durée (mois) *</label>
                    <Input name="rentalDurationMonths" type="number" min="1" defaultValue="12" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Date d'effet *</label>
                    <Input name="startDate" type="date" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Commission perçue (XOF)</label>
                    <Input name="commissionPaidMinor" type="number" min="0" placeholder="Ex: 20000" defaultValue="0" />
                  </div>
                </div>

                <Button type="submit" disabled={recordHouseRentalMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  {recordHouseRentalMutation.isPending ? 'Enregistrement...' : 'Enregistrer la location'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List of Rentals */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm">Registre des Locations de la Chefferie</h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">N° Bail</th>
                    <th className="p-3">Logement</th>
                    <th className="p-3">Bailleur & Locataire</th>
                    <th className="p-3">Loyer Mensuel</th>
                    <th className="p-3">Commission Chefferie</th>
                    <th className="p-3">Certificat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {houseRentals?.map((r: any) => (
                    <tr key={r._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-primary">{r.rentalNumber}</td>
                      <td className="p-3">
                        <span className="font-semibold block">{r.houseDescription}</span>
                        <span className="text-[11px] text-muted-foreground">{r.address}</span>
                      </td>
                      <td className="p-3">
                        <span className="block text-[11px]">Bailleur : <strong>{r.owner?.fullName}</strong></span>
                        <span className="block text-[11px]">Locataire : <strong>{r.tenant?.fullName}</strong></span>
                      </td>
                      <td className="p-3 font-bold">{r.rentAmountMinor?.toLocaleString('fr-FR')} XOF</td>
                      <td className="p-3 font-bold text-emerald-600">
                        {r.commissionPaidMinor?.toLocaleString('fr-FR')} XOF
                        <span className="block text-[10px] text-muted-foreground">Dû : {r.commissionDueMinor?.toLocaleString('fr-FR')} XOF</span>
                      </td>
                      <td className="p-3">
                        {r.certificateNumber ? (
                          <span className="font-mono text-[11px] font-bold text-purple-600">{r.certificateNumber}</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              const chefName = prompt('Nom du Chef signataire :');
                              if (chefName) {
                                issueCertificateMutation.mutate({
                                  operationType: 'HOUSE_RENTAL',
                                  transactionId: r._id,
                                  chefferieName: 'Chefferie Traditionnelle et Communautaire',
                                  signatoryName: chefName,
                                  signatoryTitle: 'Chef de Quartier Habilité',
                                });
                              }
                            }}
                          >
                            Délivrer Certificat
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: VENTES DE TERRAINS (FONCIER) */}
      {tab === 'land-sales' && (
        <div className="space-y-6">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber-600" /> Enregistrer une Transaction Foncière (Vente de Terrain)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Identification du cédant, de l'acquéreur, superficie, localisation précise et calcul de la commission chefferie.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4 text-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  recordLandSaleMutation.mutate({
                    cityId: selectedCityId,
                    neighborhoodId: form.get('neighborhoodId'),
                    blockId: form.get('blockId'),
                    plotNumber: form.get('plotNumber') || undefined,
                    locationText: form.get('locationText'),
                    surfaceM2: Number(form.get('surfaceM2')),
                    initialOwnerFullName: form.get('initialOwnerFullName'),
                    initialOwnerPhone: form.get('initialOwnerPhone'),
                    initialOwnerNationalId: form.get('initialOwnerNationalId') || undefined,
                    newBuyerFullName: form.get('newBuyerFullName'),
                    newBuyerPhone: form.get('newBuyerPhone'),
                    newBuyerNationalId: form.get('newBuyerNationalId') || undefined,
                    salePriceMinor: Number(form.get('salePriceMinor')),
                    customCommissionPercent: form.get('customCommissionPercent')
                      ? Number(form.get('customCommissionPercent'))
                      : undefined,
                    commissionPaidMinor: Number(form.get('commissionPaidMinor') || 0),
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">Quartier *</label>
                    <select
                      name="neighborhoodId"
                      className="w-full rounded-md border border-input bg-background p-2 text-xs"
                      value={selectedNeighborhoodId}
                      onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                      required
                    >
                      <option value="">Sélectionnez le quartier...</option>
                      {neighborhoods?.map((n) => (
                        <option key={n._id} value={n._id}>{n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Bloc / Secteur *</label>
                    <select name="blockId" className="w-full rounded-md border border-input bg-background p-2 text-xs" required>
                      <option value="">Sélectionnez le bloc...</option>
                      {blocks?.map((b) => (
                        <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-semibold block mb-1">Superficie (en m²) *</label>
                    <Input name="surfaceM2" type="number" min="1" placeholder="Ex: 500" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Numéro de Parcelle / Lot</label>
                    <Input name="plotNumber" placeholder="Ex: Lot n° 42-B" />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Localisation précise & Repères *</label>
                    <Input name="locationText" placeholder="Ex: En face de l'école primaire" required />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 p-3 bg-muted/20 rounded-xl border border-border">
                  <div className="space-y-2">
                    <h4 className="font-bold text-primary">Propriétaire Initial (Cédant)</h4>
                    <Input name="initialOwnerFullName" placeholder="Nom et prénom *" required />
                    <Input name="initialOwnerPhone" placeholder="Téléphone *" required />
                    <Input name="initialOwnerNationalId" placeholder="CNI / Passeport" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-emerald-600">Nouvel Acquéreur (Bénéficiaire)</h4>
                    <Input name="newBuyerFullName" placeholder="Nom et prénom *" required />
                    <Input name="newBuyerPhone" placeholder="Téléphone *" required />
                    <Input name="newBuyerNationalId" placeholder="CNI / Passeport" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-semibold block mb-1">Prix de vente du terrain (XOF) *</label>
                    <Input name="salePriceMinor" type="number" min="1" placeholder="Ex: 25000000" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Taux Chefferie (% foncier)</label>
                    <Input
                      name="customCommissionPercent"
                      type="number"
                      step="0.1"
                      placeholder={`Défaut : ${commissionSettingsData?.effectiveRates?.landSalePercent || 5}%`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Montant perçu par chefferie (XOF)</label>
                    <Input name="commissionPaidMinor" type="number" min="0" placeholder="Ex: 1250000" defaultValue="0" />
                  </div>
                </div>

                <Button type="submit" disabled={recordLandSaleMutation.isPending} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  {recordLandSaleMutation.isPending ? 'Enregistrement...' : 'Enregistrer la transaction foncière'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List of Land Sales */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm">Registre Foncier des Terrains Vendus</h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">N° Foncier</th>
                    <th className="p-3">Terrain & Superficie</th>
                    <th className="p-3">Cédant & Acquéreur</th>
                    <th className="p-3">Prix de vente</th>
                    <th className="p-3">Commission Chefferie</th>
                    <th className="p-3">Certificat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {landSales?.map((l: any) => (
                    <tr key={l._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-primary">{l.transactionNumber}</td>
                      <td className="p-3">
                        <span className="font-semibold block">{l.locationText}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {l.surfaceM2} m² {l.plotNumber ? `(Lot ${l.plotNumber})` : ''}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="block text-[11px]">De : <strong>{l.initialOwner?.fullName}</strong></span>
                        <span className="block text-[11px]">À : <strong>{l.newBuyer?.fullName}</strong></span>
                      </td>
                      <td className="p-3 font-bold">{l.salePriceMinor?.toLocaleString('fr-FR')} XOF</td>
                      <td className="p-3 font-bold text-amber-600">
                        {l.commissionPaidMinor?.toLocaleString('fr-FR')} XOF
                        <span className="block text-[10px] text-muted-foreground">Dû : {l.commissionDueMinor?.toLocaleString('fr-FR')} XOF</span>
                      </td>
                      <td className="p-3">
                        {l.certificateNumber ? (
                          <span className="font-mono text-[11px] font-bold text-purple-600">{l.certificateNumber}</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              const chefName = prompt('Nom du Chef signataire :');
                              if (chefName) {
                                issueCertificateMutation.mutate({
                                  operationType: 'LAND_SALE',
                                  transactionId: l._id,
                                  chefferieName: 'Chefferie Traditionnelle et Communautaire',
                                  signatoryName: chefName,
                                  signatoryTitle: 'Chef de Quartier / Chef de Terre',
                                });
                              }
                            }}
                          >
                            Délivrer Certificat
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CERTIFICATS OFFICIELS DE LA CHEFFERIE */}
      {tab === 'certificates' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Registre des Certificats Officiels Délivrés</h2>
              <p className="text-xs text-muted-foreground">
                Documents officiels téléchargeables en PDF, imprimables directement et authentifiables par QR code.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates?.map((cert: any) => (
              <Card key={cert._id} className="p-4 flex flex-col justify-between border-amber-500/30 text-xs space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary">{cert.certificateNumber}</span>
                    <span className="rounded bg-emerald-500/20 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                      {cert.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-foreground">{cert.chefferieName}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Opération : <strong>{cert.operationType}</strong> • Réf : {cert.transactionNumber}
                  </p>
                  <div className="pt-2 border-t border-border space-y-1">
                    <p className="text-[11px]">
                      Partie A : <strong>{cert.parties?.partyA}</strong> ({cert.parties?.partyARole})
                    </p>
                    <p className="text-[11px]">
                      Partie B : <strong>{cert.parties?.partyB}</strong> ({cert.parties?.partyBRole})
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Lieu : {cert.propertyDetails?.address}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">{cert.verificationCode}</span>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 h-7 text-xs font-bold"
                    onClick={() => setSelectedCertificate(cert)}
                  >
                    <Printer className="h-3 w-3 mr-1" /> Imprimer / PDF
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: CONFIGURATION DES TAUX DE COMMISSION CHEFFERIE */}
      {tab === 'commissions-config' && (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-5 w-5 text-amber-600" /> Paramétrage des Pourcentages de la Chefferie
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Définissez les taux de commission légaux et coutumiers applicables aux transactions dans votre secteur.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                updateCommissionsMutation.mutate({
                  neighborhoodId: selectedNeighborhoodId,
                  houseSalePercent: Number(form.get('houseSalePercent')),
                  houseRentPercent: Number(form.get('houseRentPercent')),
                  landSalePercent: Number(form.get('landSalePercent')),
                });
              }}
            >
              <div>
                <label className="font-semibold block mb-1">Quartier concerné *</label>
                <select
                  name="neighborhoodId"
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                  value={selectedNeighborhoodId}
                  onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                  required
                >
                  <option value="">Sélectionnez le quartier...</option>
                  {neighborhoods?.map((n) => (
                    <option key={n._id} value={n._id}>{n.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Pourcentage applicable à chaque maison vendue (%) *</label>
                <Input
                  name="houseSalePercent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  defaultValue={commissionSettingsData?.settings?.houseSalePercent ?? 3}
                  required
                />
                <span className="text-[10px] text-muted-foreground">Ex: 3% ou 5% de la valeur totale de vente.</span>
              </div>

              <div>
                <label className="font-semibold block mb-1">Pourcentage applicable à chaque maison louée (%) *</label>
                <Input
                  name="houseRentPercent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  defaultValue={commissionSettingsData?.settings?.houseRentPercent ?? 10}
                  required
                />
                <span className="text-[10px] text-muted-foreground">Ex: 10% du premier mois de loyer.</span>
              </div>

              <div>
                <label className="font-semibold block mb-1">Pourcentage applicable à chaque terrain vendu (%) *</label>
                <Input
                  name="landSalePercent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  defaultValue={commissionSettingsData?.settings?.landSalePercent ?? 5}
                  required
                />
                <span className="text-[10px] text-muted-foreground">Ex: 5% ou 10% sur les transactions foncières.</span>
              </div>

              <Button
                type="submit"
                disabled={updateCommissionsMutation.isPending || !selectedNeighborhoodId}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {updateCommissionsMutation.isPending ? 'Enregistrement...' : 'Enregistrer les pourcentages'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* PRINTABLE OFFICIAL CERTIFICATE MODAL */}
      {selectedCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white text-slate-900 p-8 shadow-2xl space-y-6 border-4 border-amber-600">
            {/* Header with Coat of Arms representation */}
            <div className="text-center space-y-1 border-b-2 border-amber-600 pb-4">
              <div className="text-2xl font-black uppercase tracking-widest text-amber-800">
                {selectedCertificate.chefferieName}
              </div>
              <p className="text-xs uppercase font-semibold text-slate-600 tracking-wider">
                République du Sénégal — Collectivité Territoriale & Coutumière
              </p>
              <div className="inline-block bg-amber-100 text-amber-900 border border-amber-400 font-mono font-bold px-3 py-1 text-xs rounded-full mt-2">
                N° CERTIFICAT : {selectedCertificate.certificateNumber}
              </div>
            </div>

            {/* Certificate Title */}
            <div className="text-center py-2">
              <h2 className="text-lg font-black uppercase tracking-wide underline underline-offset-4 text-slate-900">
                CERTIFICAT OFFICIEL DE {selectedCertificate.operationType === 'HOUSE_SALE' ? 'VENTE DE MAISON' : selectedCertificate.operationType === 'HOUSE_RENTAL' ? 'LOCATION RÉSIDENTIELLE' : 'TRANSACTION FONCIÈRE'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">Délivré sous l'autorité du Chef compétent</p>
            </div>

            {/* Certificate Content */}
            <div className="space-y-4 text-xs leading-relaxed text-slate-800">
              <p>
                La Chefferie atteste par le présent document que la transaction ci-après désignée a été légalement enregistrée, vérifiée et répertoriée dans le registre officiel :
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Partie A :</strong> {selectedCertificate.parties?.partyA} ({selectedCertificate.parties?.partyARole})</div>
                  <div><strong>Partie B :</strong> {selectedCertificate.parties?.partyB} ({selectedCertificate.parties?.partyBRole})</div>
                </div>
                <div><strong>Désignation du bien :</strong> {selectedCertificate.propertyDetails?.description}</div>
                <div><strong>Localisation :</strong> {selectedCertificate.propertyDetails?.address}</div>
                {selectedCertificate.propertyDetails?.surfaceM2 && (
                  <div><strong>Superficie :</strong> {selectedCertificate.propertyDetails?.surfaceM2} m²</div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <div><strong>Montant déclaré :</strong> {selectedCertificate.financialDetails?.transactionAmountMinor?.toLocaleString('fr-FR')} {selectedCertificate.financialDetails?.currency}</div>
                  <div><strong>Droits Chefferie acquittés :</strong> {selectedCertificate.financialDetails?.commissionPaidMinor?.toLocaleString('fr-FR')} {selectedCertificate.financialDetails?.currency}</div>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 italic">
                En foi de quoi, le présent certificat officiel est délivré aux parties pour servir et valoir ce que de droit.
              </p>
            </div>

            {/* Seal & Signature Area */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-200 text-center text-xs">
              <div className="border border-dashed border-amber-500/60 p-4 rounded-xl bg-amber-50/50 flex flex-col items-center justify-center min-h-[120px]">
                <Award className="h-8 w-8 text-amber-600 mb-1" />
                <span className="font-black text-amber-900 uppercase">Cachet Officiel</span>
                <span className="text-[10px] text-amber-800">Chefferie Territoriale</span>
                <span className="font-mono text-[9px] text-slate-500 mt-1">SCEAU AUTHENTIFIÉ</span>
              </div>

              <div className="border border-dashed border-slate-300 p-4 rounded-xl flex flex-col items-center justify-between min-h-[120px]">
                <span className="text-[11px] text-slate-600">Fait le {new Date(selectedCertificate.issuedDate).toLocaleDateString('fr-FR')}</span>
                <div className="font-serif italic font-bold text-sm text-slate-900">{selectedCertificate.signatoryName}</div>
                <span className="text-[10px] font-bold text-slate-700">{selectedCertificate.signatoryTitle}</span>
              </div>
            </div>

            {/* Verification Footer */}
            <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 border-t border-slate-200 font-mono">
              <span>Code vérification : {selectedCertificate.verificationCode}</span>
              <span>Plateforme KadtEstate</span>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2 print:hidden">
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => setSelectedCertificate(null)}
              >
                Fermer
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5 mr-1" /> Imprimer le Certificat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
