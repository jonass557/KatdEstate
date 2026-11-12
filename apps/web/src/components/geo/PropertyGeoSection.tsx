import { useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  MapPin,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import {
  computePolygonAreaM2,
  isPointInsideBoundary,
  isPolygonInsidePolygon,
  validatePolygonGeometry,
  type GeoJsonBoundary,
} from '@rentflow/shared';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { useSession } from '../../app/session';
import {
  getBlockOwners,
  getStoredBlocks,
  getStoredNeighborhoods,
} from '../../lib/katdestate-store';
import type { GeoPolygonOverlay, GeocodeResult } from '../../lib/geo/map-provider';
import { GeoMapCanvas } from './GeoMapCanvas';

export interface PropertyGeoValue {
  geoOwnerId?: string | undefined;
  neighborhoodId?: string | undefined;
  blockId?: string | undefined;
  geoUniqueId?: string | undefined;
  region?: string | undefined;
  department?: string | undefined;
  arrondissement?: string | undefined;
  neighborhoodName?: string | undefined;
  sectorName?: string | undefined;
  neighborhoodLeaderName?: string | undefined;
  blockLeaderName?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  location?: { type: 'Point'; coordinates: [number, number] } | undefined;
  boundary?: GeoJsonBoundary | undefined;
  geoDerogation?:
    | {
        granted?: boolean | undefined;
        justification?: string | undefined;
      }
    | undefined;
}

interface PropertyGeoSectionProps {
  value: PropertyGeoValue;
  onChange: (next: PropertyGeoValue) => void;
  onValidationChange?: ((valid: boolean, error?: string | null) => void) | undefined;
  onSuggestedAddress?: ((address: string, city?: string) => void) | undefined;
}

export function PropertyGeoSection({
  value,
  onChange,
  onValidationChange,
  onSuggestedAddress,
}: PropertyGeoSectionProps) {
  const { user, memberships } = useSession();
  const userRole = memberships?.[0]?.role || (user as any)?.platformRole || 'OWNER';
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  const neighborhoods = useMemo(() => getStoredNeighborhoods(), []);
  const blocks = useMemo(() => getStoredBlocks(), []);
  const owners = useMemo(() => getBlockOwners(), []);

  // Auto-sélection intelligente au premier affichage si vide
  useEffect(() => {
    if (value.neighborhoodId || value.blockId || value.geoOwnerId) return;
    const emailNorm = user?.email?.trim().toLowerCase();
    const matchedOwner = emailNorm
      ? owners.find((o) => o.email.trim().toLowerCase() === emailNorm)
      : undefined;
    const defaultBlock =
      (matchedOwner && blocks.find((b) => b.id === matchedOwner.blockId)) || blocks[0];
    const defaultNeigh =
      (defaultBlock && neighborhoods.find((n) => n.id === defaultBlock.neighborhoodId)) ||
      neighborhoods[0];

    if (matchedOwner || defaultBlock || defaultNeigh) {
      onChange({
        ...value,
        geoOwnerId: matchedOwner?.id ?? value.geoOwnerId,
        blockId: defaultBlock?.id ?? value.blockId,
        neighborhoodId: defaultNeigh?.id ?? value.neighborhoodId,
        neighborhoodName: defaultNeigh?.name ?? value.neighborhoodName,
        sectorName: defaultBlock?.name ?? value.sectorName,
        neighborhoodLeaderName: defaultNeigh?.leaderName ?? value.neighborhoodLeaderName,
        blockLeaderName: defaultBlock?.leaderName ?? value.blockLeaderName,
        region: defaultNeigh?.region ?? value.region ?? 'Lagunes',
        department: defaultNeigh?.department ?? value.department ?? 'Abidjan',
        arrondissement: defaultNeigh?.arrondissement ?? value.arrondissement ?? 'Cocody',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNeighborhood = useMemo(
    () => neighborhoods.find((n) => n.id === value.neighborhoodId) || neighborhoods[0],
    [neighborhoods, value.neighborhoodId],
  );
  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === value.blockId) || blocks[0],
    [blocks, value.blockId],
  );
  const selectedOwner = useMemo(
    () => (value.geoOwnerId ? owners.find((o) => o.id === value.geoOwnerId) : undefined),
    [owners, value.geoOwnerId],
  );

  // Synchroniser noms de chefs & quartier si sélection change
  const handleSelectNeighborhood = (neighId: string) => {
    const neigh = neighborhoods.find((n) => n.id === neighId);
    const childBlock = blocks.find((b) => b.neighborhoodId === neighId);
    onChange({
      ...value,
      neighborhoodId: neighId || undefined,
      neighborhoodName: neigh?.name,
      neighborhoodLeaderName: neigh?.leaderName,
      region: neigh?.region || value.region,
      department: neigh?.department || value.department,
      arrondissement: neigh?.arrondissement || value.arrondissement,
      blockId: childBlock?.id,
      sectorName: childBlock?.name,
      blockLeaderName: childBlock?.leaderName,
    });
  };

  const handleSelectBlock = (blockId: string) => {
    const blk = blocks.find((b) => b.id === blockId);
    const parentNeigh = blk ? neighborhoods.find((n) => n.id === blk.neighborhoodId) : undefined;
    onChange({
      ...value,
      blockId: blockId || undefined,
      sectorName: blk?.name,
      blockLeaderName: blk?.leaderName,
      neighborhoodId: parentNeigh?.id ?? value.neighborhoodId,
      neighborhoodName: parentNeigh?.name ?? value.neighborhoodName,
      neighborhoodLeaderName: parentNeigh?.leaderName ?? value.neighborhoodLeaderName,
    });
  };

  const handleSelectOwner = (ownerId: string) => {
    const own = owners.find((o) => o.id === ownerId);
    const blk = own ? blocks.find((b) => b.id === own.blockId) : undefined;
    const neigh = blk ? neighborhoods.find((n) => n.id === blk.neighborhoodId) : undefined;
    onChange({
      ...value,
      geoOwnerId: ownerId || undefined,
      blockId: blk?.id ?? value.blockId,
      sectorName: blk?.name ?? value.sectorName,
      blockLeaderName: blk?.leaderName ?? value.blockLeaderName,
      neighborhoodId: neigh?.id ?? value.neighborhoodId,
      neighborhoodName: neigh?.name ?? value.neighborhoodName,
      neighborhoodLeaderName: neigh?.leaderName ?? value.neighborhoodLeaderName,
    });
  };

  // Validation géographique multi-niveaux (Point + Polygone optionnel)
  const validation = useMemo(() => {
    const hasCoords =
      typeof value.latitude === 'number' &&
      Number.isFinite(value.latitude) &&
      typeof value.longitude === 'number' &&
      Number.isFinite(value.longitude);

    let outOfBoundsError: string | null = null;

    if (hasCoords) {
      const pt: [number, number] = [value.longitude!, value.latitude!];
      if (selectedOwner?.assignedBoundary) {
        if (!isPointInsideBoundary(pt, selectedOwner.assignedBoundary, true)) {
          outOfBoundsError = `La position du bien est hors du secteur attribué au propriétaire (${selectedOwner.fullName}).`;
        }
      }
      if (!outOfBoundsError && selectedBlock?.boundary) {
        if (!isPointInsideBoundary(pt, selectedBlock.boundary, true)) {
          outOfBoundsError = `La position du bien sort des limites du bloc (${selectedBlock.name}).`;
        }
      }
      if (!outOfBoundsError && selectedNeighborhood?.boundary) {
        if (!isPointInsideBoundary(pt, selectedNeighborhood.boundary, true)) {
          outOfBoundsError = `La position du bien sort des limites du quartier (${selectedNeighborhood.name}).`;
        }
      }
    }

    if (!outOfBoundsError && value.boundary) {
      const geom = validatePolygonGeometry(value.boundary);
      if (!geom.valid) {
        return {
          valid: false,
          error: geom.error || 'Contour de la propriété invalide.',
          info: null as string | null,
          requiresDerogation: false,
        };
      }
      if (selectedOwner?.assignedBoundary) {
        if (!isPolygonInsidePolygon(value.boundary, selectedOwner.assignedBoundary)) {
          outOfBoundsError = `Le contour tracé déborde hors du secteur attribué à ${selectedOwner.fullName}.`;
        }
      }
      if (!outOfBoundsError && selectedBlock?.boundary) {
        if (!isPolygonInsidePolygon(value.boundary, selectedBlock.boundary)) {
          outOfBoundsError = `Le contour tracé déborde hors du bloc ${selectedBlock.name}.`;
        }
      }
      if (!outOfBoundsError && selectedNeighborhood?.boundary) {
        if (!isPolygonInsidePolygon(value.boundary, selectedNeighborhood.boundary)) {
          outOfBoundsError = `Le contour tracé déborde hors du quartier ${selectedNeighborhood.name}.`;
        }
      }
      if (hasCoords && !isPointInsideBoundary([value.longitude!, value.latitude!], value.boundary, true)) {
        return {
          valid: false,
          error: 'Le repère GPS doit être positionné à l’intérieur du contour de votre propriété.',
          info: null,
          requiresDerogation: false,
        };
      }
    }

    if (outOfBoundsError) {
      const canDerogate =
        isAdmin &&
        Boolean(value.geoDerogation?.granted) &&
        Boolean(value.geoDerogation?.justification && value.geoDerogation.justification.trim().length >= 5);
      if (canDerogate) {
        return {
          valid: true,
          error: null,
          info: 'Dérogation Administrateur active (zone hors périmètre autorisée avec justificatif).',
          requiresDerogation: true,
        };
      }
      return {
        valid: false,
        error: outOfBoundsError,
        info: null,
        requiresDerogation: true,
      };
    }

    if (hasCoords || value.boundary) {
      const areaText = value.boundary
        ? ` • Surface parcelle : ${Math.round(computePolygonAreaM2(value.boundary)).toLocaleString('fr-FR')} m²`
        : '';
      return {
        valid: true,
        error: null,
        info: `Position validée dans le périmètre hiérarchique${areaText}.`,
        requiresDerogation: false,
      };
    }

    return {
      valid: true,
      error: null,
      info: null,
      requiresDerogation: false,
    };
  }, [
    isAdmin,
    selectedBlock,
    selectedNeighborhood,
    selectedOwner,
    value.boundary,
    value.geoDerogation,
    value.latitude,
    value.longitude,
  ]);

  useEffect(() => {
    onValidationChange?.(validation.valid, validation.error);
  }, [validation.valid, validation.error, onValidationChange]);

  const referenceOverlays = useMemo<GeoPolygonOverlay[]>(() => {
    const list: GeoPolygonOverlay[] = [];
    if (selectedNeighborhood?.boundary) {
      list.push({
        id: `ref-neigh-${selectedNeighborhood.id}`,
        level: 'NEIGHBORHOOD',
        label: `Quartier : ${selectedNeighborhood.name}`,
        boundary: selectedNeighborhood.boundary,
        color: '#7c3aed',
        fillOpacity: 0.05,
        strokeWeight: 2,
        locked: true,
      });
    }
    if (selectedBlock?.boundary) {
      list.push({
        id: `ref-blk-${selectedBlock.id}`,
        level: 'BLOCK',
        label: `Bloc : ${selectedBlock.name}`,
        boundary: selectedBlock.boundary,
        color: selectedBlock.color || '#06b6d4',
        fillOpacity: 0.08,
        strokeWeight: 2,
        locked: true,
      });
    }
    if (selectedOwner?.assignedBoundary) {
      list.push({
        id: `ref-own-${selectedOwner.id}`,
        level: 'OWNER',
        label: `Secteur Propriétaire : ${selectedOwner.fullName}`,
        boundary: selectedOwner.assignedBoundary,
        color: '#10b981',
        fillOpacity: 0.14,
        strokeWeight: 2,
        locked: true,
      });
    }
    return list;
  }, [selectedBlock, selectedNeighborhood, selectedOwner]);

  const activeMarker = useMemo(
    () =>
      typeof value.latitude === 'number' &&
      Number.isFinite(value.latitude) &&
      typeof value.longitude === 'number' &&
      Number.isFinite(value.longitude)
        ? { lat: value.latitude, lng: value.longitude }
        : null,
    [value.latitude, value.longitude],
  );

  const handleGeocodeFill = (geo?: GeocodeResult | null) => {
    if (!geo) return;
    if (geo.address) {
      onSuggestedAddress?.(geo.address, geo.city);
    }
    onChange({
      ...value,
      latitude: geo.lat,
      longitude: geo.lng,
      location: { type: 'Point', coordinates: [geo.lng, geo.lat] },
      region: geo.region || value.region,
      department: geo.department || value.department,
      arrondissement: geo.arrondissement || value.arrondissement,
      neighborhoodName: geo.neighborhood || value.neighborhoodName,
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MapPin className="size-4 text-amber-500" />
          Localisation géographique du bien (Niveau 3)
        </h3>
        {value.geoUniqueId && (
          <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-mono font-bold text-amber-600">
            ID Géo : {value.geoUniqueId}
          </span>
        )}
      </div>

      {/* Rattachement hiérarchique Quartier -> Bloc -> Secteur Propriétaire */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground">Quartier (Niveau 1)</span>
          <select
            value={value.neighborhoodId ?? ''}
            onChange={(e) => handleSelectNeighborhood(e.target.value)}
            className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
          >
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground">Bloc / Secteur (Niveau 2)</span>
          <select
            value={value.blockId ?? ''}
            onChange={(e) => handleSelectBlock(e.target.value)}
            className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
          >
            {blocks
              .filter((b) => !value.neighborhoodId || b.neighborhoodId === value.neighborhoodId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <UserCheck className="size-3.5 text-emerald-500" />
            Secteur Propriétaire attribué
          </span>
          <select
            value={value.geoOwnerId ?? ''}
            onChange={(e) => handleSelectOwner(e.target.value)}
            className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
          >
            <option value="">— Sélectionner un secteur propriétaire —</option>
            {owners
              .filter((o) => !value.blockId || o.blockId === value.blockId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName} {o.assignedBoundary ? '(Zone délimitée)' : '(Sans polygone)'}
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* Carte interactive Google Maps : placement marqueur + contour parcelle */}
      <GeoMapCanvas
        title="Carte satellite & positionnement du bien"
        subtitle="Placez le marqueur sur votre bien ou tracez les limites exactes de la parcelle à l’intérieur de votre zone autorisée."
        heightClassName="h-[380px]"
        overlays={referenceOverlays}
        activeMarker={activeMarker}
        activeBoundary={value.boundary ?? null}
        allowMarkerPlacement={true}
        allowPolygonDraw={true}
        validationError={validation.error}
        validationSuccess={validation.info}
        onMarkerChange={(pt, geocode) => {
          onChange({
            ...value,
            latitude: Number(pt.lat.toFixed(6)),
            longitude: Number(pt.lng.toFixed(6)),
            location: { type: 'Point', coordinates: [pt.lng, pt.lat] },
            region: geocode?.region || value.region,
            department: geocode?.department || value.department,
            arrondissement: geocode?.arrondissement || value.arrondissement,
            neighborhoodName: geocode?.neighborhood || value.neighborhoodName,
          });
          if (geocode?.address) {
            onSuggestedAddress?.(geocode.address, geocode.city);
          }
        }}
        onAddressSelected={handleGeocodeFill}
        onBoundaryChange={(boundary) => {
          onChange({
            ...value,
            boundary: boundary ?? undefined,
          });
        }}
        legendItems={[
          ...(selectedNeighborhood?.boundary ? [{ label: 'Quartier', color: '#7c3aed' }] : []),
          ...(selectedBlock?.boundary ? [{ label: 'Bloc', color: selectedBlock.color || '#06b6d4' }] : []),
          ...(selectedOwner?.assignedBoundary ? [{ label: 'Secteur Propriétaire', color: '#10b981' }] : []),
          { label: 'Votre propriété', color: '#f59e0b' },
        ]}
      />

      {/* Coordonnées & informations administratives auto-remplies */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Compass className="size-3.5 text-primary" /> Latitude
          </span>
          <Input
            type="number"
            step="0.000001"
            value={value.latitude ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              const lat = raw === '' ? undefined : Number(raw);
              const lng = value.longitude;
              onChange({
                ...value,
                latitude: lat,
                location:
                  typeof lat === 'number' && typeof lng === 'number'
                    ? { type: 'Point', coordinates: [lng, lat] }
                    : undefined,
              });
            }}
            placeholder="Ex: 5.369400"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Compass className="size-3.5 text-primary" /> Longitude
          </span>
          <Input
            type="number"
            step="0.000001"
            value={value.longitude ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              const lng = raw === '' ? undefined : Number(raw);
              const lat = value.latitude;
              onChange({
                ...value,
                longitude: lng,
                location:
                  typeof lat === 'number' && typeof lng === 'number'
                    ? { type: 'Point', coordinates: [lng, lat] }
                    : undefined,
              });
            }}
            placeholder="Ex: -3.965800"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground">Région</span>
          <Input
            value={value.region ?? ''}
            onChange={(e) => onChange({ ...value, region: e.target.value || undefined })}
            placeholder="Ex: Lagunes"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground">Département / Commune</span>
          <Input
            value={value.department ?? ''}
            onChange={(e) => onChange({ ...value, department: e.target.value || undefined })}
            placeholder="Ex: Abidjan"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground">Arrondissement</span>
          <Input
            value={value.arrondissement ?? ''}
            onChange={(e) => onChange({ ...value, arrondissement: e.target.value || undefined })}
            placeholder="Ex: Cocody"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground">Quartier</span>
          <Input
            value={value.neighborhoodName ?? ''}
            onChange={(e) => onChange({ ...value, neighborhoodName: e.target.value || undefined })}
            placeholder="Ex: Cocody"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground">Chef de Quartier</span>
          <Input
            value={value.neighborhoodLeaderName ?? ''}
            onChange={(e) =>
              onChange({ ...value, neighborhoodLeaderName: e.target.value || undefined })
            }
            placeholder="Chef de quartier"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-foreground">Chef de Bloc</span>
          <Input
            value={value.blockLeaderName ?? ''}
            onChange={(e) => onChange({ ...value, blockLeaderName: e.target.value || undefined })}
            placeholder="Chef de bloc"
          />
        </label>
      </div>

      {/* Statut de conformité & Dérogation Admin exceptionnelle */}
      {validation.error && (
        <Card className="p-3 border-red-500/40 bg-red-500/10 text-xs text-red-700 dark:text-red-300 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Validation géographique bloquante</p>
              <p>{validation.error}</p>
            </div>
          </div>

          {isAdmin && validation.requiresDerogation && (
            <div className="pt-2 border-t border-red-500/20 space-y-2">
              <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(value.geoDerogation?.granted)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      geoDerogation: {
                        granted: e.target.checked,
                        justification: value.geoDerogation?.justification ?? '',
                      },
                    })
                  }
                />
                <ShieldAlert className="size-3.5 text-amber-500" />
                <span>Accorder une dérogation exceptionnelle (Administrateur uniquement)</span>
              </label>
              {value.geoDerogation?.granted && (
                <Input
                  value={value.geoDerogation?.justification ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      geoDerogation: {
                        granted: true,
                        justification: e.target.value,
                      },
                    })
                  }
                  placeholder="Motif officiel de la dérogation géographique (min. 5 caractères)..."
                  className="bg-background"
                />
              )}
            </div>
          )}
        </Card>
      )}

      {!validation.error && validation.info && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{validation.info}</span>
        </div>
      )}
    </div>
  );
}
