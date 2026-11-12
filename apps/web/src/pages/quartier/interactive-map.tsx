import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Crown,
  Eye,
  Filter,
  History,
  Layers,
  MapPin,
  Search,
  Shield,
  UserCheck,
} from 'lucide-react';
import { computePolygonAreaM2, type GeoJsonBoundary, type LatLngPoint } from '@rentflow/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useSession } from '../../app/session';
import { useOrgPath } from '../../lib/query';
import { apiRequest } from '../../lib/api-client';
import {
  getBlockOwners,
  getGeoAuditLogsLocal,
  getStoredBlocks,
  getStoredNeighborhoods,
  type BlockOwnerRecord,
  type BlockRecord,
  type GeoAuditRecord,
  type NeighborhoodGeoRecord,
} from '../../lib/katdestate-store';
import { getLocalProperties, type Property } from '../properties';
import type { GeoMarkerOverlay, GeoPolygonOverlay } from '../../lib/geo/map-provider';
import { GeoMapCanvas } from '../../components/geo/GeoMapCanvas';

interface ApiGeoLayersPayload {
  neighborhoods?: Array<{
    _id: string;
    name: string;
    region?: string;
    department?: string;
    arrondissement?: string;
    administrativeAddress?: string;
    leaderName?: string;
    leaderPhone?: string;
    boundary?: GeoJsonBoundary;
  }>;
  blocks?: Array<{
    _id: string;
    neighborhoodId: string;
    code: string;
    name: string;
    leaderName?: string;
    leaderEmail?: string;
    leaderPhone?: string;
    color?: string;
    isActive?: boolean;
    boundary?: GeoJsonBoundary;
    totalResidences?: number;
    totalHabitants?: number;
  }>;
  owners?: Array<{
    _id: string;
    blockId: string;
    neighborhoodId?: string;
    fullName: string;
    phone?: string;
    email?: string;
    propertyName?: string;
    assignedBoundary?: GeoJsonBoundary;
  }>;
  properties?: Array<Property>;
}

interface ApiGeoLayersResponse extends ApiGeoLayersPayload {
  layers?: ApiGeoLayersPayload;
}

export function InteractiveQuartierMap() {
  const { user, memberships } = useSession();
  const base = useOrgPath();
  const userRole = memberships?.[0]?.role || (user as any)?.platformRole || 'OWNER';

  const [apiData, setApiData] = useState<ApiGeoLayersResponse | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<ApiGeoLayersResponse>(`${base}/quartier/geo/layers`)
      .then((res) => {
        if (active && res) setApiData(res);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [base]);

  // Fusion propre API + Store Local
  const rawNeighborhoods: NeighborhoodGeoRecord[] = useMemo(() => {
    const local = getStoredNeighborhoods();
    const apiList = apiData?.layers?.neighborhoods ?? apiData?.neighborhoods ?? [];
    if (apiList.length === 0) return local;
    const map = new Map<string, NeighborhoodGeoRecord>();
    local.forEach((n) => map.set(n.id, n));
    apiList.forEach((n) =>
      map.set(n._id, {
        id: n._id,
        name: n.name,
        region: n.region,
        department: n.department,
        arrondissement: n.arrondissement,
        administrativeAddress: n.administrativeAddress,
        leaderName: n.leaderName,
        leaderPhone: n.leaderPhone,
        boundary: n.boundary,
        updatedAt: new Date().toISOString(),
      }),
    );
    return Array.from(map.values());
  }, [apiData]);

  const rawBlocks: BlockRecord[] = useMemo(() => {
    const local = getStoredBlocks();
    const apiList = apiData?.layers?.blocks ?? apiData?.blocks ?? [];
    if (apiList.length === 0) return local;
    const map = new Map<string, BlockRecord>();
    local.forEach((b) => map.set(b.id, b));
    apiList.forEach((b) => {
      const existing = map.get(b._id);
      map.set(b._id, {
        id: b._id,
        code: b.code,
        name: b.name,
        neighborhoodId: b.neighborhoodId,
        neighborhoodName: existing?.neighborhoodName || 'Quartier',
        leaderName: b.leaderName ?? existing?.leaderName,
        leaderEmail: b.leaderEmail ?? existing?.leaderEmail,
        leaderPhone: b.leaderPhone ?? existing?.leaderPhone,
        color: b.color ?? existing?.color ?? '#06b6d4',
        isActive: b.isActive ?? true,
        boundary: b.boundary ?? existing?.boundary,
        totalResidences: b.totalResidences ?? existing?.totalResidences ?? 0,
        totalHabitants: b.totalHabitants ?? existing?.totalHabitants ?? 0,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    });
    return Array.from(map.values());
  }, [apiData]);

  const rawOwners: BlockOwnerRecord[] = useMemo(() => {
    const local = getBlockOwners();
    const apiList = apiData?.layers?.owners ?? apiData?.owners ?? [];
    if (apiList.length === 0) return local;
    const map = new Map<string, BlockOwnerRecord>();
    local.forEach((o) => map.set(o.id, o));
    apiList.forEach((o) => {
      const existing = map.get(o._id);
      map.set(o._id, {
        id: o._id,
        fullName: o.fullName,
        email: o.email ?? existing?.email ?? '',
        phone: o.phone ?? existing?.phone ?? '',
        password: existing?.password ?? '',
        blockId: o.blockId,
        blockName: existing?.blockName ?? '',
        neighborhoodId: o.neighborhoodId ?? existing?.neighborhoodId,
        assignedBoundary: o.assignedBoundary ?? existing?.assignedBoundary,
        propertyName: o.propertyName ?? existing?.propertyName ?? '',
        propertyType: existing?.propertyType ?? 'Résidence',
        monthlyRentOrDues: existing?.monthlyRentOrDues ?? 0,
        status: existing?.status ?? 'ACTIVE',
        paymentStatus: existing?.paymentStatus ?? 'PAID',
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    });
    return Array.from(map.values());
  }, [apiData]);

  const rawProperties: Property[] = useMemo(() => {
    const local = getLocalProperties();
    const apiList = apiData?.layers?.properties ?? apiData?.properties ?? [];
    if (apiList.length === 0) return local;
    const map = new Map<string, Property>();
    local.forEach((p) => map.set(p._id, p));
    apiList.forEach((p) => map.set(p._id, p));
    return Array.from(map.values());
  }, [apiData]);

  // Cloisonnement strict selon le rôle connecté
  const scopedData = useMemo(() => {
    const emailNorm = user?.email?.trim().toLowerCase();
    if (userRole === 'BLOCK_LEADER') {
      const myBlock =
        (emailNorm && rawBlocks.find((b) => b.leaderEmail?.trim().toLowerCase() === emailNorm)) ||
        rawBlocks[0];
      const blockId = myBlock?.id;
      return {
        neighborhoods: rawNeighborhoods.filter((n) => !myBlock || n.id === myBlock.neighborhoodId),
        blocks: rawBlocks.filter((b) => b.id === blockId),
        owners: rawOwners.filter((o) => o.blockId === blockId),
        properties: rawProperties.filter((p) => !p.blockId || p.blockId === blockId),
      };
    }

    if (userRole === 'OWNER') {
      const myOwnerRecord = emailNorm
        ? rawOwners.find((o) => o.email.trim().toLowerCase() === emailNorm)
        : undefined;
      return {
        neighborhoods: rawNeighborhoods,
        blocks: rawBlocks.filter((b) => !myOwnerRecord || b.id === myOwnerRecord.blockId),
        owners: myOwnerRecord ? [myOwnerRecord] : rawOwners,
        properties: myOwnerRecord
          ? rawProperties.filter(
              (p) =>
                !p.geoOwnerId ||
                p.geoOwnerId === myOwnerRecord.id ||
                p.blockId === myOwnerRecord.blockId,
            )
          : rawProperties,
      };
    }

    return {
      neighborhoods: rawNeighborhoods,
      blocks: rawBlocks,
      owners: rawOwners,
      properties: rawProperties,
    };
  }, [rawBlocks, rawNeighborhoods, rawOwners, rawProperties, user?.email, userRole]);

  // Couches activables / désactivables indépendamment
  const [showNeighborhoods, setShowNeighborhoods] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);
  const [showOwners, setShowOwners] = useState(true);
  const [showProperties, setShowProperties] = useState(true);

  // Recherche & filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNeighborhoodFilter, setSelectedNeighborhoodFilter] = useState('');
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('');

  // Focus auto-zoom & sélection de fiche détail
  const [focusTarget, setFocusTarget] = useState<{
    boundary?: GeoJsonBoundary | null;
    point?: LatLngPoint | null;
    key?: string;
  } | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{
    title: string;
    subtitle?: string | undefined;
    level: string;
    color: string;
    propertyId?: string | undefined;
    metadata: Record<string, string | number | boolean | undefined>;
  } | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Application des filtres de recherche
  const filteredNeighborhoods = useMemo(
    () =>
      scopedData.neighborhoods.filter((n) => {
        if (selectedNeighborhoodFilter && n.id !== selectedNeighborhoodFilter) return false;
        if (!normalizedQuery) return true;
        return (
          n.name.toLowerCase().includes(normalizedQuery) ||
          (n.leaderName || '').toLowerCase().includes(normalizedQuery)
        );
      }),
    [normalizedQuery, scopedData.neighborhoods, selectedNeighborhoodFilter],
  );

  const filteredBlocks = useMemo(
    () =>
      scopedData.blocks.filter((b) => {
        if (selectedNeighborhoodFilter && b.neighborhoodId !== selectedNeighborhoodFilter)
          return false;
        if (selectedBlockFilter && b.id !== selectedBlockFilter) return false;
        if (!normalizedQuery) return true;
        return (
          b.name.toLowerCase().includes(normalizedQuery) ||
          b.code.toLowerCase().includes(normalizedQuery) ||
          (b.leaderName || '').toLowerCase().includes(normalizedQuery)
        );
      }),
    [normalizedQuery, scopedData.blocks, selectedBlockFilter, selectedNeighborhoodFilter],
  );

  const filteredOwners = useMemo(
    () =>
      scopedData.owners.filter((o) => {
        if (selectedNeighborhoodFilter && o.neighborhoodId && o.neighborhoodId !== selectedNeighborhoodFilter)
          return false;
        if (selectedBlockFilter && o.blockId !== selectedBlockFilter) return false;
        if (!normalizedQuery) return true;
        return (
          o.fullName.toLowerCase().includes(normalizedQuery) ||
          o.propertyName.toLowerCase().includes(normalizedQuery) ||
          o.phone.toLowerCase().includes(normalizedQuery)
        );
      }),
    [normalizedQuery, scopedData.owners, selectedBlockFilter, selectedNeighborhoodFilter],
  );

  const filteredProperties = useMemo(
    () =>
      scopedData.properties.filter((p) => {
        if (selectedNeighborhoodFilter && p.neighborhoodId && p.neighborhoodId !== selectedNeighborhoodFilter)
          return false;
        if (selectedBlockFilter && p.blockId && p.blockId !== selectedBlockFilter) return false;
        if (!normalizedQuery) return true;
        return (
          p.name.toLowerCase().includes(normalizedQuery) ||
          (p.geoUniqueId || '').toLowerCase().includes(normalizedQuery) ||
          (p.neighborhoodName || '').toLowerCase().includes(normalizedQuery) ||
          (p.sectorName || '').toLowerCase().includes(normalizedQuery) ||
          p.address.toLowerCase().includes(normalizedQuery)
        );
      }),
    [normalizedQuery, scopedData.properties, selectedBlockFilter, selectedNeighborhoodFilter],
  );

  // Construction des polygones & marqueurs pour Google Maps
  const mapOverlays = useMemo<GeoPolygonOverlay[]>(() => {
    const list: GeoPolygonOverlay[] = [];

    if (showNeighborhoods) {
      filteredNeighborhoods.forEach((n) => {
        if (!n.boundary) return;
        list.push({
          id: n.id,
          level: 'NEIGHBORHOOD',
          label: `Quartier : ${n.name}`,
          sublabel: n.leaderName || 'Chef de Quartier',
          boundary: n.boundary,
          color: '#7c3aed',
          fillOpacity: 0.08,
          strokeWeight: 3,
          metadata: {
            type: 'Niveau 1 — Quartier',
            chefQuartier: n.leaderName || '-',
            telephone: n.leaderPhone || '-',
            adresse: n.administrativeAddress || '-',
            surface: `${Math.round(computePolygonAreaM2(n.boundary)).toLocaleString('fr-FR')} m²`,
          },
        });
      });
    }

    if (showBlocks) {
      filteredBlocks.forEach((b) => {
        if (!b.boundary) return;
        list.push({
          id: b.id,
          level: 'BLOCK',
          label: `${b.name} (${b.code})`,
          sublabel: b.leaderName || 'Chef de Bloc',
          boundary: b.boundary,
          color: b.color || '#06b6d4',
          fillOpacity: b.isActive === false ? 0.06 : 0.18,
          strokeWeight: 2,
          metadata: {
            type: 'Niveau 2 — Zone Chef de Bloc',
            code: b.code,
            chefBloc: b.leaderName || 'En attente',
            telephone: b.leaderPhone || '-',
            statut: b.isActive === false ? 'Désactivée' : 'Active',
            surface: `${Math.round(computePolygonAreaM2(b.boundary)).toLocaleString('fr-FR')} m²`,
          },
        });
      });
    }

    if (showOwners) {
      filteredOwners.forEach((o) => {
        if (!o.assignedBoundary) return;
        list.push({
          id: o.id,
          level: 'OWNER',
          label: `Secteur ${o.fullName}`,
          sublabel: o.propertyName,
          boundary: o.assignedBoundary,
          color: '#10b981',
          fillOpacity: 0.25,
          strokeWeight: 2,
          metadata: {
            type: 'Niveau 3 — Secteur Propriétaire',
            proprietaire: o.fullName,
            telephone: o.phone || '-',
            bloc: o.blockName || '-',
            bienPrincipal: o.propertyName || '-',
            surface: `${Math.round(computePolygonAreaM2(o.assignedBoundary)).toLocaleString('fr-FR')} m²`,
          },
        });
      });
    }

    if (showProperties) {
      filteredProperties.forEach((p) => {
        if (!p.boundary) return;
        list.push({
          id: `prop-poly-${p._id}`,
          level: 'PROPERTY',
          label: p.name,
          sublabel: p.geoUniqueId || p.address,
          boundary: p.boundary,
          color: '#f59e0b',
          fillOpacity: 0.36,
          strokeWeight: 2,
          metadata: {
            type: 'Niveau 3B — Parcelle Immobilière',
            identifiantGeo: p.geoUniqueId || p._id,
            adresse: `${p.address}, ${p.city}`,
            quartier: p.neighborhoodName || p.zone || '-',
            bloc: p.sectorName || '-',
            statut: p.status,
            propertyId: p._id,
          },
        });
      });
    }

    return list;
  }, [
    filteredBlocks,
    filteredNeighborhoods,
    filteredOwners,
    filteredProperties,
    showBlocks,
    showNeighborhoods,
    showOwners,
    showProperties,
  ]);

  const mapMarkers = useMemo<GeoMarkerOverlay[]>(() => {
    if (!showProperties) return [];
    return filteredProperties
      .filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .map((p) => ({
        id: p._id,
        level: 'PROPERTY' as const,
        title: p.name,
        subtitle: p.geoUniqueId || p.address,
        position: { lat: p.latitude!, lng: p.longitude! },
        color: '#f59e0b',
        metadata: {
          type: 'Bien Immobilier Géolocalisé',
          identifiantGeo: p.geoUniqueId || p._id,
          adresse: `${p.address}, ${p.city}`,
          quartier: p.neighborhoodName || p.zone || '-',
          bloc: p.sectorName || '-',
          chefQuartier: p.neighborhoodLeaderName || '-',
          chefBloc: p.blockLeaderName || '-',
          coordonnees: `${p.latitude?.toFixed(6)}, ${p.longitude?.toFixed(6)}`,
          statut: p.status,
          propertyId: p._id,
        },
      }));
  }, [filteredProperties, showProperties]);

  const auditLogs: GeoAuditRecord[] = useMemo(() => getGeoAuditLogsLocal().slice(0, 15), []);

  return (
    <div className="space-y-6">
      {/* En-tête Carte Générale */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-card via-card to-primary/5 p-5">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Carte Géographique Générale DOMORA / KatdEstate (3 Niveaux)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Superposition interactive Google Maps (Normal / Satellite / Hybride) : Quartiers, Zones
            Chefs de Bloc, Secteurs Propriétaires et Propriétés Immobilières.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 font-bold text-primary">
            <Shield className="size-3.5" /> Rôle actif : {userRole}
          </span>
        </div>
      </div>

      {/* Statistiques géographiques globales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3.5 border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Niveau 1 : Quartiers</span>
            <Crown className="size-4 text-purple-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-foreground">
            {scopedData.neighborhoods.filter((n) => Boolean(n.boundary)).length}
          </p>
          <p className="text-[11px] text-muted-foreground">
            sur {scopedData.neighborhoods.length} quartier(s) visibles
          </p>
        </Card>

        <Card className="p-3.5 border-cyan-500/30 bg-cyan-500/5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Niveau 2 : Zones Chefs de Bloc</span>
            <MapPin className="size-4 text-cyan-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-foreground">
            {scopedData.blocks.filter((b) => b.isActive !== false && Boolean(b.boundary)).length}
          </p>
          <p className="text-[11px] text-muted-foreground">
            sur {scopedData.blocks.length} bloc(s) rattaché(s)
          </p>
        </Card>

        <Card className="p-3.5 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Niveau 2B : Secteurs Propriétaires</span>
            <UserCheck className="size-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-foreground">
            {scopedData.owners.filter((o) => Boolean(o.assignedBoundary)).length}
          </p>
          <p className="text-[11px] text-muted-foreground">
            sur {scopedData.owners.length} propriétaire(s) recensé(s)
          </p>
        </Card>

        <Card className="p-3.5 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Niveau 3 : Biens Géolocalisés</span>
            <Building2 className="size-4 text-amber-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-foreground">
            {
              scopedData.properties.filter(
                (p) => typeof p.latitude === 'number' || Boolean(p.boundary),
              ).length
            }
          </p>
          <p className="text-[11px] text-muted-foreground">
            sur {scopedData.properties.length} propriété(s) du portefeuille
          </p>
        </Card>
      </div>

      {/* Panneau de contrôle des 4 couches & recherche multi-critères */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-foreground flex items-center gap-1">
              <Eye className="size-3.5 text-primary" /> Couches visibles :
            </span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-border px-2.5 py-1">
              <input
                type="checkbox"
                checked={showNeighborhoods}
                onChange={(e) => setShowNeighborhoods(e.target.checked)}
              />
              <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
              <span>Quartiers ({filteredNeighborhoods.length})</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-border px-2.5 py-1">
              <input
                type="checkbox"
                checked={showBlocks}
                onChange={(e) => setShowBlocks(e.target.checked)}
              />
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
              <span>Zones Blocs ({filteredBlocks.length})</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-border px-2.5 py-1">
              <input
                type="checkbox"
                checked={showOwners}
                onChange={(e) => setShowOwners(e.target.checked)}
              />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Propriétaires ({filteredOwners.length})</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-border px-2.5 py-1">
              <input
                type="checkbox"
                checked={showProperties}
                onChange={(e) => setShowProperties(e.target.checked)}
              />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Biens Immobiliers ({filteredProperties.length})</span>
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 text-xs">
          <div className="sm:col-span-2 relative">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-3" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par quartier, chef de bloc, propriétaire ou ID immobilier (DOM-PROP-...)"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground shrink-0" />
            <select
              value={selectedNeighborhoodFilter}
              onChange={(e) => {
                setSelectedNeighborhoodFilter(e.target.value);
                setSelectedBlockFilter('');
              }}
              className="h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs"
            >
              <option value="">Tous les quartiers</option>
              {scopedData.neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedBlockFilter}
              onChange={(e) => setSelectedBlockFilter(e.target.value)}
              className="h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs"
            >
              <option value="">Tous les blocs</option>
              {scopedData.blocks
                .filter(
                  (b) =>
                    !selectedNeighborhoodFilter || b.neighborhoodId === selectedNeighborhoodFilter,
                )
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Raccourcis de centrage rapide */}
        {(filteredBlocks.length > 0 || filteredProperties.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground font-semibold mr-1">Centrer sur :</span>
            {filteredNeighborhoods
              .filter((n) => Boolean(n.boundary))
              .slice(0, 3)
              .map((n) => (
                <Button
                  key={n.id}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-2"
                  onClick={() =>
                    setFocusTarget({ boundary: n.boundary ?? null, key: `n-${n.id}-${Date.now()}` })
                  }
                >
                  Quartier {n.name}
                </Button>
              ))}
            {filteredBlocks
              .filter((b) => Boolean(b.boundary))
              .slice(0, 5)
              .map((b) => (
                <Button
                  key={b.id}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-2"
                  onClick={() =>
                    setFocusTarget({ boundary: b.boundary ?? null, key: `b-${b.id}-${Date.now()}` })
                  }
                >
                  {b.name}
                </Button>
              ))}
            {filteredProperties
              .filter((p) => typeof p.latitude === 'number' || Boolean(p.boundary))
              .slice(0, 4)
              .map((p) => (
                <Button
                  key={p._id}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-2 border-amber-500/40"
                  onClick={() =>
                    setFocusTarget({
                      boundary: p.boundary ?? null,
                      point:
                        typeof p.latitude === 'number' && typeof p.longitude === 'number'
                          ? { lat: p.latitude, lng: p.longitude }
                          : null,
                      key: `p-${p._id}-${Date.now()}`,
                    })
                  }
                >
                  {p.name}
                </Button>
              ))}
          </div>
        )}
      </Card>

      {/* Carte Google Maps Centrale */}
      <GeoMapCanvas
        title="Vue Cartographique Consolidée"
        subtitle="Cliquez sur n’importe quel polygone ou marqueur pour afficher la fiche complète de l’entité"
        heightClassName="h-[540px]"
        overlays={mapOverlays}
        markers={mapMarkers}
        focusTarget={focusTarget}
        legendItems={[
          { label: 'Niveau 1 : Quartiers', color: '#7c3aed' },
          { label: 'Niveau 2 : Zones Chefs de Bloc', color: '#06b6d4' },
          { label: 'Niveau 2B : Secteurs Propriétaires', color: '#10b981' },
          { label: 'Niveau 3 : Biens Immobiliers', color: '#f59e0b' },
        ]}
        onOverlayClick={(ov) => {
          const propId =
            typeof ov.metadata?.propertyId === 'string' ? ov.metadata.propertyId : undefined;
          setSelectedDetail({
            title: ov.label,
            subtitle: ov.sublabel,
            level: ov.level,
            color: ov.color,
            propertyId: propId,
            metadata: (ov.metadata as Record<string, string | number | boolean | undefined>) || {},
          });
        }}
        onMarkerClick={(mk) => {
          const propId =
            typeof mk.metadata?.propertyId === 'string' ? mk.metadata.propertyId : mk.id;
          setSelectedDetail({
            title: mk.title,
            subtitle: mk.subtitle,
            level: 'PROPERTY',
            color: mk.color || '#f59e0b',
            propertyId: propId,
            metadata: (mk.metadata as Record<string, string | number | boolean | undefined>) || {},
          });
        }}
      />

      {/* Fiche détail au clic */}
      {selectedDetail && (
        <Card className="p-4 border-primary/40 bg-primary/5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: selectedDetail.color }}
              />
              <h3 className="text-sm font-black text-foreground">{selectedDetail.title}</h3>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">
                {selectedDetail.level}
              </span>
            </div>
            {selectedDetail.subtitle && (
              <p className="text-muted-foreground">{selectedDetail.subtitle}</p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
              {Object.entries(selectedDetail.metadata).map(([k, v]) =>
                v !== undefined && k !== 'propertyId' ? (
                  <span key={k}>
                    <strong className="text-foreground capitalize">{k} :</strong> {String(v)}
                  </span>
                ) : null,
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedDetail.propertyId && (
              <Link
                to={`/properties/${selectedDetail.propertyId}`}
                className="inline-flex items-center rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500"
              >
                Ouvrir la fiche du bien
              </Link>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedDetail(null)}>
              Fermer
            </Button>
          </div>
        </Card>
      )}

      {/* Journal d'audit des modifications géographiques */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
          <History className="size-4 text-primary" />
          Journal d’audit des délimitations et dérogations ({auditLogs.length})
        </h3>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucune opération cartographique enregistrée pour le moment.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground truncate">{log.entityName}</span>
                  <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                    {log.action}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {log.entityType} • Par {log.performedByName} ({log.performedByRole})
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString('fr-FR')}
                </p>
                {log.justification && (
                  <p className="text-[11px] text-amber-600">Motif : {log.justification}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
