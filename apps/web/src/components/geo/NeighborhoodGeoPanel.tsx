import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Compass,
  Edit3,
  History,
  Layers,
  LocateFixed,
  Navigation,
  Plus,
  Power,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import {
  computePolygonAreaM2,
  doPolygonsOverlap,
  isPolygonInsidePolygon,
  toGeoJsonPolygon,
  validatePolygonGeometry,
  type GeoJsonBoundary,
} from '@rentflow/shared';
import { getPreciseUserLocation } from '../../lib/geo/geolocation-helper';
import {
  fetchRealPlaceBoundary,
  reverseGeocodeWithNominatim,
  searchAddressWithNominatim,
} from '../../lib/geo/nominatim-geocoder';
import { getBlockLeaders } from '../../lib/katdestate-store';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';
import { useSession } from '../../app/session';
import { useOrgPath } from '../../lib/query';
import { apiRequest } from '../../lib/api-client';
import {
  appendGeoAuditLogLocal,
  getGeoAuditLogsLocal,
  getStoredBlocks,
  getStoredNeighborhoods,
  saveNeighborhoodGeo,
  saveStoredBlocks,
  updateStoredBlock,
  type BlockRecord,
  type GeoAuditRecord,
  type NeighborhoodGeoRecord,
} from '../../lib/katdestate-store';
import type { GeoPolygonOverlay } from '../../lib/geo/map-provider';
import { GeoMapCanvas } from './GeoMapCanvas';

const BLOCK_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#f97316'];

interface NeighborhoodGeoPanelProps {
  onDataChanged?: (() => void) | undefined;
}

export function NeighborhoodGeoPanel({ onDataChanged }: NeighborhoodGeoPanelProps) {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const base = useOrgPath();
  const userRole = memberships?.[0]?.role || (user as any)?.platformRole || 'NEIGHBORHOOD_LEADER';
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodGeoRecord[]>(() =>
    getStoredNeighborhoods(),
  );
  const [blocks, setBlocks] = useState<BlockRecord[]>(() => getStoredBlocks());
  const [auditLogs, setAuditLogs] = useState<GeoAuditRecord[]>(() => getGeoAuditLogsLocal());

  const activeNeighborhood = neighborhoods[0]!;

  // Mode d'édition sur la carte : 'VIEW' | 'EDIT_NEIGHBORHOOD' | 'CREATE_BLOCK' | 'EDIT_BLOCK'
  const [mapMode, setMapMode] = useState<'VIEW' | 'EDIT_NEIGHBORHOOD' | 'CREATE_BLOCK' | 'EDIT_BLOCK'>('VIEW');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draftBoundary, setDraftBoundary] = useState<GeoJsonBoundary | null>(
    activeNeighborhood.boundary ?? null,
  );

  // Champs administratifs & hiérarchie géographique du quartier (Pays -> Ville -> Quartier -> Nom de Zone)
  const [countryName, setCountryName] = useState(activeNeighborhood.country ?? 'Côte d’Ivoire');
  const [cityName, setCityName] = useState(activeNeighborhood.city ?? 'Abidjan');
  const [neighborhoodLabel, setNeighborhoodLabel] = useState(
    activeNeighborhood.neighborhoodLabel ?? 'Cocody',
  );
  const [zoneCustomName, setZoneCustomName] = useState(activeNeighborhood.name ?? '');
  const [adminAddress, setAdminAddress] = useState(activeNeighborhood.administrativeAddress ?? '');
  const [regionName, setRegionName] = useState(activeNeighborhood.region ?? '');
  const [departmentName, setDepartmentName] = useState(activeNeighborhood.department ?? '');
  const [arrondissementName, setArrondissementName] = useState(
    activeNeighborhood.arrondissement ?? '',
  );

  // Formulaire bloc (Nom, Code, Superficie, Chef de Bloc assigné)
  const availableLeaders = useMemo(() => getBlockLeaders(), [blocks]);
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockCode, setNewBlockCode] = useState('');
  const [blockTargetArea, setBlockTargetArea] = useState('');
  const [newBlockColor, setNewBlockColor] = useState(BLOCK_COLORS[0]!);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('+225 ');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [overrideOverlap, setOverrideOverlap] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [clickedOverlay, setClickedOverlay] = useState<GeoPolygonOverlay | null>(null);

  // États GPS Temps Réel & Délimitation Automatique
  const [isAutoDelimitingGps, setIsAutoDelimitingGps] = useState(false);
  const [autoRadiusMeters, setAutoRadiusMeters] = useState<number>(350);
  const [gpsFocusTarget, setGpsFocusTarget] = useState<{
    boundary?: GeoJsonBoundary | null;
    lat?: number;
    lng?: number;
    zoom?: number;
    key: string;
  } | null>(null);

  const focusMapOnQuery = async (query: string, zoom: number) => {
    if (!query.trim()) return;
    try {
      const results = await searchAddressWithNominatim(query, 1);
      if (results.length > 0 && results[0]) {
        setGpsFocusTarget({
          lat: results[0].lat,
          lng: results[0].lng,
          zoom,
          key: `geo-zoom-${Date.now()}`,
        });
      }
    } catch {}
  };
  const [isRecordingWalk, setIsRecordingWalk] = useState(false);
  const [walkPoints, setWalkPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const walkWatchRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (walkWatchRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(walkWatchRef.current);
      }
    };
  }, []);

  const buildAutoPolygonAroundPoint = (lat: number, lng: number, radiusMeters: number): GeoJsonBoundary => {
    const dLat = radiusMeters / 111320;
    const dLng = radiusMeters / (111320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    const sides = 8;
    const pts: Array<{ lat: number; lng: number }> = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      pts.push({
        lat: Number((lat + dLat * Math.sin(angle)).toFixed(6)),
        lng: Number((lng + dLng * Math.cos(angle)).toFixed(6)),
      });
    }
    return toGeoJsonPolygon(pts);
  };

  const handleAutoDelimitFromGps = async (targetMode: 'EDIT_NEIGHBORHOOD' | 'CREATE_BLOCK') => {
    setIsAutoDelimitingGps(true);
    try {
      const loc = await getPreciseUserLocation({ requireRealGps: true });
      let geocode: any = null;
      try {
        geocode = await reverseGeocodeWithNominatim(loc.lat, loc.lng);
      } catch {}

      const detectedCity = geocode?.city || '';
      const detectedNeigh = geocode?.neighborhood || '';

      if (targetMode === 'EDIT_NEIGHBORHOOD' && geocode) {
        if (geocode.country) setCountryName(geocode.country);
        if (detectedCity) setCityName(detectedCity);
        if (detectedNeigh) {
          setNeighborhoodLabel(detectedNeigh);
          setZoneCustomName(detectedNeigh);
        } else if (detectedCity) {
          setNeighborhoodLabel(detectedCity);
          setZoneCustomName(detectedCity);
        }
        if (geocode.address) setAdminAddress(geocode.address);
        if (geocode.region) setRegionName(geocode.region);
        if (geocode.department) setDepartmentName(geocode.department);
        if (geocode.arrondissement || detectedCity) {
          setArrondissementName(geocode.arrondissement || detectedCity);
        }
      }

      const radius =
        targetMode === 'EDIT_NEIGHBORHOOD'
          ? Math.max(autoRadiusMeters, 300)
          : Math.min(autoRadiusMeters, 350);
      const poly = buildAutoPolygonAroundPoint(loc.lat, loc.lng, radius);
      setMapMode(targetMode);
      setDraftBoundary(poly);
      setGpsFocusTarget({
        boundary: poly,
        lat: loc.lat,
        lng: loc.lng,
        zoom: 16,
        key: `gps-auto-${Date.now()}`,
      });

      const isCoarseNetwork = (loc.accuracy || 0) > 2500;
      if (isCoarseNetwork) {
        toast({
          title: `Position réseau approximative (±${loc.accuracy} m)`,
          description: `Votre appareil sans GPS satellite a renvoyé le nœud réseau (${detectedCity || `${loc.lat}, ${loc.lng}`}). Activez le GPS sur téléphone ou saisissez votre ville (ex: Mbanga) ci-dessous puis cliquez sur « Délimiter cette zone ».`,
          variant: 'info',
        });
      } else {
        toast({
          title: `GPS réel acquis (${detectedCity || 'Position exacte'}) !`,
          description: `Position : ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (précision ±${loc.accuracy ?? 15} m). Délimitation générée sur votre position réelle.`,
          variant: 'success',
        });
      }
    } catch (err: any) {
      toast({
        title: 'GPS réel indisponible',
        description:
          err?.message ||
          'Impossible d’obtenir le signal GPS réel. Utilisez les champs Pays → Ville → Quartier pour délimiter votre zone réelle.',
        variant: 'error',
      });
    } finally {
      setIsAutoDelimitingGps(false);
    }
  };

  const handleAutoDelimitByEnteredPlace = async () => {
    const queryParts = [neighborhoodLabel.trim(), cityName.trim(), countryName.trim()].filter(Boolean);
    if (queryParts.length === 0) return;
    setIsAutoDelimitingGps(true);
    try {
      const real = await fetchRealPlaceBoundary(queryParts.join(', '));
      if (!real) {
        toast({
          title: 'Zone introuvable sur OpenStreetMap',
          description: 'Vérifiez l’orthographe de la ville ou du quartier.',
          variant: 'error',
        });
        return;
      }
      setMapMode('EDIT_NEIGHBORHOOD');
      setDraftBoundary(real.boundary);
      setGpsFocusTarget({
        boundary: real.boundary,
        lat: real.center.lat,
        lng: real.center.lng,
        zoom: 14,
        key: `osm-real-${Date.now()}`,
      });
      if (real.geocode.department) setDepartmentName(real.geocode.department);
      if (real.geocode.region) setRegionName(real.geocode.region);
      if (real.geocode.address) setAdminAddress(real.geocode.address);
      if (!zoneCustomName.trim()) {
        setZoneCustomName(neighborhoodLabel.trim() || cityName.trim());
      }
      toast({
        title: `Limites réelles chargées pour « ${queryParts[0]} » !`,
        description: `Polygone réel OpenStreetMap affiché sur la carte (${real.center.lat.toFixed(4)}, ${real.center.lng.toFixed(4)}).`,
        variant: 'success',
      });
    } finally {
      setIsAutoDelimitingGps(false);
    }
  };

  const toggleLiveGpsWalk = () => {
    if (isRecordingWalk) {
      if (walkWatchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(walkWatchRef.current);
        walkWatchRef.current = null;
      }
      setIsRecordingWalk(false);
      toast({
        title: 'Tracé GPS en temps réel arrêté',
        description: `${walkPoints.length} point(s) enregistré(s) sur la carte.`,
        variant: 'success',
      });
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast({ title: 'GPS non supporté sur cet appareil', variant: 'error' });
      return;
    }

    if (mapMode === 'VIEW') {
      setMapMode('EDIT_NEIGHBORHOOD');
    }
    setWalkPoints([]);
    setIsRecordingWalk(true);
    toast({
      title: 'Mode Tracé GPS en marchant activé',
      description: 'Déplacez-vous le long des limites de la zone : les points s’ajoutent automatiquement en temps réel.',
    });

    walkWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setWalkPoints((prev) => {
          const last = prev[prev.length - 1];
          if (last) {
            const dist = Math.hypot((pt.lat - last.lat) * 111320, (pt.lng - last.lng) * 111320);
            if (dist < 6) return prev;
          }
          const next = [...prev, pt];
          if (next.length >= 3) {
            const poly = toGeoJsonPolygon(next);
            setDraftBoundary(poly);
            setGpsFocusTarget({ boundary: poly, key: `walk-${next.length}` });
          }
          return next;
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
  };

  const refreshLocal = () => {
    setNeighborhoods(getStoredNeighborhoods());
    setBlocks(getStoredBlocks());
    setAuditLogs(getGeoAuditLogsLocal());
    onDataChanged?.();
  };

  // Validation géométrique en temps réel selon le mode actif
  const validation = useMemo(() => {
    if (mapMode === 'VIEW' || !draftBoundary) {
      return { error: null as string | null, success: null as string | null };
    }

    const validGeom = validatePolygonGeometry(draftBoundary);
    if (!validGeom.valid) {
      return { error: validGeom.error ?? 'Polygone invalide.', success: null };
    }

    if (mapMode === 'EDIT_NEIGHBORHOOD') {
      return {
        error: null,
        success: 'Contour du quartier géométriquement valide. Cliquez sur « Enregistrer les limites du quartier ».',
      };
    }

    // CREATE_BLOCK ou EDIT_BLOCK : vérifier inclusion dans le quartier + non-chevauchement
    if (activeNeighborhood.boundary) {
      const inside = isPolygonInsidePolygon(draftBoundary, activeNeighborhood.boundary);
      if (!inside) {
        return {
          error: `Zone refusée : le périmètre tracé sort des limites du quartier « ${activeNeighborhood.name} ».`,
          success: null,
        };
      }
    }

    const siblings = blocks.filter(
      (b) =>
        b.neighborhoodId === activeNeighborhood.id &&
        b.isActive !== false &&
        b.id !== (mapMode === 'EDIT_BLOCK' ? selectedBlockId : '') &&
        b.boundary,
    );

    const overlapping = siblings.filter((s) => doPolygonsOverlap(draftBoundary, s.boundary!));
    if (overlapping.length > 0) {
      const names = overlapping.map((o) => o.name).join(', ');
      if (isAdmin && overrideOverlap && overrideReason.trim()) {
        return {
          error: null,
          success: `Dérogation administrateur active sur chevauchement avec : ${names}.`,
        };
      }
      return {
        error: `Chevauchement interdit avec : ${names}. Les zones peuvent partager une frontière commune mais ne doivent pas se superposer.`,
        success: null,
      };
    }

    return {
      error: null,
      success: 'Zone du Chef de Bloc valide : incluse dans le quartier et sans chevauchement.',
    };
  }, [
    mapMode,
    draftBoundary,
    activeNeighborhood,
    blocks,
    selectedBlockId,
    isAdmin,
    overrideOverlap,
    overrideReason,
  ]);

  // Couches à afficher sur la carte
  const overlays = useMemo<GeoPolygonOverlay[]>(() => {
    const list: GeoPolygonOverlay[] = [];

    if (activeNeighborhood.boundary && mapMode !== 'EDIT_NEIGHBORHOOD') {
      list.push({
        id: activeNeighborhood.id,
        level: 'NEIGHBORHOOD',
        label: `Quartier : ${activeNeighborhood.name}`,
        sublabel: activeNeighborhood.leaderName,
        boundary: activeNeighborhood.boundary,
        color: '#7c3aed',
        fillOpacity: 0.06,
        strokeWeight: 3,
        locked: true,
        metadata: {
          type: 'Quartier',
          responsable: activeNeighborhood.leaderName || 'Chef de Quartier',
          telephone: activeNeighborhood.leaderPhone,
          adresse: activeNeighborhood.administrativeAddress,
        },
      });
    }

    blocks.forEach((blk, idx) => {
      if (!blk.boundary) return;
      if (mapMode === 'EDIT_BLOCK' && blk.id === selectedBlockId) return;
      const areaM2 = blk.targetAreaM2 || Math.round(computePolygonAreaM2(blk.boundary));
      list.push({
        id: blk.id,
        level: 'BLOCK',
        label: `${blk.name} (${areaM2.toLocaleString('fr-FR')} m²)`,
        sublabel: blk.leaderName ? `Chef : ${blk.leaderName}` : 'Sans chef assigné',
        boundary: blk.boundary,
        color: blk.color || BLOCK_COLORS[idx % BLOCK_COLORS.length]!,
        fillOpacity: blk.isActive === false ? 0.05 : 0.24,
        strokeWeight: 2,
        metadata: {
          type: 'Zone Chef de Bloc',
          code: blk.code,
          superficie: `${areaM2.toLocaleString('fr-FR')} m²`,
          responsable: blk.leaderName || 'Non assigné',
          telephone: blk.leaderPhone || '-',
          email: blk.leaderEmail || '-',
          residences: blk.totalResidences,
          habitants: blk.totalHabitants,
          actif: blk.isActive !== false,
        },
      });
    });

    return list;
  }, [activeNeighborhood, blocks, mapMode, selectedBlockId]);

  const legendItems = useMemo(() => {
    const items = [{ label: `Quartier (${activeNeighborhood.name})`, color: '#7c3aed' }];
    blocks.forEach((b, idx) => {
      if (b.boundary) {
        items.push({
          label: `${b.name}${b.leaderName ? ` (${b.leaderName})` : ''}`,
          color: b.color || BLOCK_COLORS[idx % BLOCK_COLORS.length]!,
        });
      }
    });
    return items;
  }, [activeNeighborhood, blocks]);

  const handleSaveNeighborhoodBoundary = async () => {
    if (!draftBoundary || validation.error) return;
    setSaving(true);
    try {
      await apiRequest(`${base}/quartier/neighborhoods/${activeNeighborhood.id}/boundary`, {
        method: 'PATCH',
        body: {
          boundary: draftBoundary,
          administrativeAddress: adminAddress,
          region: regionName,
          department: departmentName,
          arrondissement: arrondissementName,
        },
      }).catch(() => null);

      const previousBoundary = activeNeighborhood.boundary;
      const finalZoneName = zoneCustomName.trim() || neighborhoodLabel.trim() || activeNeighborhood.name;
      saveNeighborhoodGeo({
        ...activeNeighborhood,
        name: finalZoneName,
        country: countryName.trim() || undefined,
        city: cityName.trim() || undefined,
        neighborhoodLabel: neighborhoodLabel.trim() || undefined,
        boundary: draftBoundary,
        administrativeAddress: adminAddress,
        region: regionName,
        department: departmentName,
        arrondissement: arrondissementName,
        updatedAt: new Date().toISOString(),
      });

      appendGeoAuditLogLocal({
        entityType: 'NEIGHBORHOOD',
        entityId: activeNeighborhood.id,
        entityName: activeNeighborhood.name,
        action: previousBoundary ? 'UPDATE_BOUNDARY' : 'CREATE_BOUNDARY',
        performedByName: user?.displayName || 'Chef de Quartier',
        performedByRole: userRole,
        previousBoundary,
        newBoundary: draftBoundary,
      });

      setMapMode('VIEW');
      refreshLocal();
      toast({
        title: 'Limites du quartier enregistrées',
        description: 'Le polygone GeoJSON du quartier a été sauvegardé avec succès.',
        variant: 'success',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBlockBoundary = async () => {
    if (!draftBoundary || validation.error) return;
    if (mapMode === 'CREATE_BLOCK' && !newBlockName.trim()) {
      toast({ title: 'Nom du bloc requis', variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      if (mapMode === 'CREATE_BLOCK') {
        const code =
          newBlockCode.trim().toUpperCase() ||
          `BLOC-${Date.now().toString(36).toUpperCase().slice(-4)}`;

        await apiRequest(`${base}/quartier/blocks`, {
          method: 'POST',
          body: {
            neighborhoodId: activeNeighborhood.id,
            name: newBlockName.trim(),
            code,
            color: newBlockColor,
            boundary: draftBoundary,
            overrideOverlap: isAdmin ? overrideOverlap : false,
            overrideReason: isAdmin ? overrideReason : undefined,
          },
        }).catch(() => null);

        const computedArea = Math.round(computePolygonAreaM2(draftBoundary));
        const created: BlockRecord = {
          id: `block-${Date.now()}`,
          code,
          name: newBlockName.trim(),
          neighborhoodId: activeNeighborhood.id,
          neighborhoodName: activeNeighborhood.name,
          leaderName: leaderName.trim() || undefined,
          leaderEmail: leaderEmail.trim().toLowerCase() || undefined,
          leaderPhone: leaderPhone.trim() || undefined,
          color: newBlockColor,
          isActive: true,
          boundary: draftBoundary,
          targetAreaM2: Number(blockTargetArea) || computedArea,
          totalResidences: 0,
          totalHabitants: 0,
          createdAt: new Date().toISOString(),
        };
        saveStoredBlocks([...blocks, created]);

        appendGeoAuditLogLocal({
          entityType: 'BLOCK',
          entityId: created.id,
          entityName: created.name,
          action: overrideOverlap && isAdmin ? 'DEROGATION_GRANTED' : 'CREATE_BOUNDARY',
          performedByName: user?.displayName || 'Chef de Quartier',
          performedByRole: userRole,
          newBoundary: draftBoundary,
          justification: overrideOverlap && isAdmin ? overrideReason : undefined,
        });

        setNewBlockName('');
        setNewBlockCode('');
        setLeaderName('');
        setLeaderEmail('');
        toast({
          title: 'Zone Chef de Bloc créée',
          description: `${created.name} est désormais délimitée dans le quartier.`,
          variant: 'success',
        });
      } else if (mapMode === 'EDIT_BLOCK' && selectedBlockId) {
        const current = blocks.find((b) => b.id === selectedBlockId);
        await apiRequest(`${base}/quartier/blocks/${selectedBlockId}/boundary`, {
          method: 'PATCH',
          body: {
            boundary: draftBoundary,
            name: newBlockName.trim() || current?.name,
            color: newBlockColor,
            overrideOverlap: isAdmin ? overrideOverlap : false,
            overrideReason: isAdmin ? overrideReason : undefined,
          },
        }).catch(() => null);

        updateStoredBlock(selectedBlockId, {
          boundary: draftBoundary,
          ...(newBlockName.trim() || current?.name
            ? { name: (newBlockName.trim() || current?.name)! }
            : {}),
          color: newBlockColor,
          ...(leaderName.trim() ? { leaderName: leaderName.trim() } : {}),
          ...(leaderEmail.trim() ? { leaderEmail: leaderEmail.trim().toLowerCase() } : {}),
          ...(leaderPhone.trim() ? { leaderPhone: leaderPhone.trim() } : {}),
        });

        appendGeoAuditLogLocal({
          entityType: 'BLOCK',
          entityId: selectedBlockId,
          entityName: newBlockName.trim() || current?.name || selectedBlockId,
          action: overrideOverlap && isAdmin ? 'DEROGATION_GRANTED' : 'UPDATE_BOUNDARY',
          performedByName: user?.displayName || 'Chef de Quartier',
          performedByRole: userRole,
          previousBoundary: current?.boundary,
          newBoundary: draftBoundary,
          justification: overrideOverlap && isAdmin ? overrideReason : undefined,
        });

        toast({
          title: 'Frontière du bloc mise à jour',
          variant: 'success',
        });
      }

      setMapMode('VIEW');
      setSelectedBlockId(null);
      setOverrideOverlap(false);
      setOverrideReason('');
      refreshLocal();
    } finally {
      setSaving(false);
    }
  };

  const toggleBlockActive = async (blk: BlockRecord) => {
    const nextActive = blk.isActive === false;
    await apiRequest(`${base}/quartier/blocks/${blk.id}/status`, {
      method: 'PATCH',
      body: { isActive: nextActive },
    }).catch(() => null);
    updateStoredBlock(blk.id, { isActive: nextActive });
    appendGeoAuditLogLocal({
      entityType: 'BLOCK',
      entityId: blk.id,
      entityName: blk.name,
      action: nextActive ? 'REASSIGN_ZONE' : 'DEACTIVATE',
      performedByName: user?.displayName || 'Chef de Quartier',
      performedByRole: userRole,
      justification: nextActive ? 'Réactivation de la zone du bloc' : 'Désactivation du bloc',
    });
    refreshLocal();
    toast({
      title: nextActive ? `Bloc « ${blk.name} » activé` : `Bloc « ${blk.name} » désactivé`,
      variant: 'success',
    });
  };

  return (
    <div className="space-y-5">
      {/* Actions principales Niveau 1 */}
      <Card className="p-4 border-purple-500/30 bg-purple-500/5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Layers className="size-4 text-purple-500" />
            Niveau 1 — Délimitation du Quartier & Zones des Chefs de Bloc
          </h2>
          <p className="text-xs text-muted-foreground">
            Délimitez les frontières exactes de « {activeNeighborhood.name} » et attribuez à chaque Chef de Bloc un secteur sans chevauchement à l’intérieur du quartier.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={mapMode === 'EDIT_NEIGHBORHOOD' ? 'primary' : 'outline'}
            onClick={() => {
              setMapMode('EDIT_NEIGHBORHOOD');
              setSelectedBlockId(null);
              setDraftBoundary(activeNeighborhood.boundary ?? null);
            }}
            className="text-xs gap-1.5"
          >
            <Edit3 className="size-3.5" /> Délimiter mon quartier
          </Button>
          <Button
            size="sm"
            variant={mapMode === 'CREATE_BLOCK' ? 'primary' : 'outline'}
            onClick={() => {
              setMapMode('CREATE_BLOCK');
              setSelectedBlockId(null);
              setDraftBoundary(null);
              setNewBlockName('');
              setNewBlockCode('');
              setNewBlockColor(BLOCK_COLORS[blocks.length % BLOCK_COLORS.length]!);
            }}
            className="text-xs gap-1.5 border-cyan-500/40 text-cyan-500 hover:bg-cyan-500/10"
          >
            <Plus className="size-3.5" /> Créer une zone Chef de Bloc
          </Button>
          {mapMode !== 'VIEW' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMapMode('VIEW');
                setSelectedBlockId(null);
              }}
              className="text-xs"
            >
              Retour à la vue globale
            </Button>
          )}
        </div>
      </Card>

      {/* Barre GPS Temps Réel & Délimitation Automatique */}
      <Card className="p-3.5 border-emerald-500/30 bg-emerald-500/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <LocateFixed className="size-4 text-emerald-500 shrink-0" />
          <div>
            <p className="font-bold text-foreground">Délimitation GPS en Temps Réel & Automatique</p>
            <p className="text-[11px] text-muted-foreground">
              Activez votre GPS pour récupérer automatiquement les coordonnées de votre quartier et générer sa délimitation avec précision.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={autoRadiusMeters}
            onChange={(e) => setAutoRadiusMeters(Number(e.target.value))}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold"
            title="Rayon de délimitation automatique"
          >
            <option value={150}>Rayon 150 m (Bloc)</option>
            <option value={350}>Rayon 350 m (Secteur)</option>
            <option value={600}>Rayon 600 m (Quartier)</option>
            <option value={1000}>Rayon 1 km (Grand Quartier)</option>
          </select>

          <Button
            size="sm"
            variant="secondary"
            disabled={isAutoDelimitingGps}
            onClick={() => void handleAutoDelimitFromGps(mapMode === 'CREATE_BLOCK' ? 'CREATE_BLOCK' : 'EDIT_NEIGHBORHOOD')}
            className="h-8 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Compass className={`size-3.5 ${isAutoDelimitingGps ? 'animate-spin' : ''}`} />
            {isAutoDelimitingGps ? 'Localisation GPS...' : 'Activer GPS & Délimiter auto'}
          </Button>

          <Button
            size="sm"
            variant={isRecordingWalk ? 'danger' : 'outline'}
            onClick={toggleLiveGpsWalk}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Navigation className={`size-3.5 ${isRecordingWalk ? 'animate-pulse' : ''}`} />
            {isRecordingWalk
              ? `Arrêter tracé GPS (${walkPoints.length} pts)`
              : 'Tracé en marchant (Temps réel)'}
          </Button>
        </div>
      </Card>

      {/* Formulaire contextuel selon le mode d'édition */}
      {mapMode === 'EDIT_NEIGHBORHOOD' && (
        <Card className="p-4 border-purple-500/30 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              A. Localisation hiérarchique (Pays → Ville → Quartier → Nom de la Zone)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Sélectionnez votre pays, votre ville et votre quartier pour positionner automatiquement la carte, puis nommez votre zone et tracez ses limites (manuellement ou via GPS).
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-foreground">1. Pays *</label>
              <div className="flex gap-1">
                <select
                  value={countryName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCountryName(val);
                    void focusMapOnQuery(val, 6);
                  }}
                  className="h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs font-medium"
                >
                  <option value="Côte d’Ivoire">Côte d’Ivoire</option>
                  <option value="Cameroun">Cameroun</option>
                  <option value="Sénégal">Sénégal</option>
                  <option value="Burkina Faso">Burkina Faso</option>
                  <option value="Mali">Mali</option>
                  <option value="Bénin">Bénin</option>
                  <option value="Togo">Togo</option>
                  <option value="Gabon">Gabon</option>
                  <option value="Congo">Congo</option>
                  <option value="RD Congo">RD Congo</option>
                  <option value="France">France</option>
                  <option value="Maroc">Maroc</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-semibold text-foreground">2. Ville *</label>
              <div className="flex gap-1">
                <Input
                  placeholder="Ex: Abidjan, Douala, Dakar..."
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  onBlur={() => {
                    if (cityName.trim()) void focusMapOnQuery(`${cityName}, ${countryName}`, 12);
                  }}
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 px-2.5 text-[11px] shrink-0"
                  onClick={() => void focusMapOnQuery(`${cityName}, ${countryName}`, 12)}
                >
                  Zoom
                </Button>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-semibold text-foreground">3. Quartier de la ville *</label>
              <div className="flex gap-1">
                <Input
                  placeholder="Ex: Cocody, Bonamoussadi, Plateau..."
                  value={neighborhoodLabel}
                  onChange={(e) => setNeighborhoodLabel(e.target.value)}
                  onBlur={() => {
                    if (neighborhoodLabel.trim()) {
                      void focusMapOnQuery(`${neighborhoodLabel}, ${cityName}, ${countryName}`, 14);
                    }
                  }}
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 px-2.5 text-[11px] shrink-0"
                  onClick={() =>
                    void focusMapOnQuery(`${neighborhoodLabel}, ${cityName}, ${countryName}`, 14)
                  }
                >
                  Zoom
                </Button>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-semibold text-foreground">4. Nom de votre zone *</label>
              <Input
                placeholder="Ex: Zone Riviera Palmeraie"
                value={zoneCustomName}
                onChange={(e) => setZoneCustomName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Adresse administrative"
              value={adminAddress}
              onChange={(e) => setAdminAddress(e.target.value)}
            />
            <Input
              placeholder="Région / District"
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
            />
            <Input
              placeholder="Département"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
            />
            <Input
              placeholder="Arrondissement / Commune"
              value={arrondissementName}
              onChange={(e) => setArrondissementName(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isAutoDelimitingGps}
              onClick={() => void handleAutoDelimitByEnteredPlace()}
              className="gap-1.5"
            >
              <LocateFixed className="size-4 text-emerald-500" />
              Délimiter automatiquement cette ville / quartier
            </Button>
            <Button
              size="sm"
              disabled={!draftBoundary || Boolean(validation.error) || saving}
              onClick={() => void handleSaveNeighborhoodBoundary()}
              className="bg-purple-600 hover:bg-purple-500 text-white gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer les limites du quartier'}
            </Button>
          </div>
        </Card>
      )}

      {(mapMode === 'CREATE_BLOCK' || mapMode === 'EDIT_BLOCK') && (
        <Card className="p-4 border-cyan-500/30 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">
              {mapMode === 'CREATE_BLOCK'
                ? 'B. Délimiter une zone de Bloc et attribuer un Chef de Bloc'
                : 'Modifier la zone géographique du Chef de Bloc'}
            </h3>
            {draftBoundary && (
              <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-0.5 text-xs font-bold text-cyan-600">
                Superficie tracée : {Math.round(computePolygonAreaM2(draftBoundary)).toLocaleString('fr-FR')} m²
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              placeholder="Nom de la zone / Bloc *"
              value={newBlockName}
              onChange={(e) => setNewBlockName(e.target.value)}
            />
            <Input
              placeholder="Code bloc (ex: BLOC-PALM-5)"
              value={newBlockCode}
              onChange={(e) => setNewBlockCode(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Superficie prévue (m²)"
              value={blockTargetArea}
              onChange={(e) => setBlockTargetArea(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Couleur :</label>
              <div className="flex gap-1.5">
                {BLOCK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewBlockColor(c)}
                    className={`size-6 rounded-full border-2 transition-transform ${
                      newBlockColor === c ? 'border-white scale-110' : 'border-transparent opacity-70'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              Attribuer un Chef de Bloc existant ou saisir un responsable :
            </label>
            <div className="grid gap-3 sm:grid-cols-4">
              <select
                value={selectedLeaderId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedLeaderId(id);
                  const found = availableLeaders.find((l) => l.id === id);
                  if (found) {
                    setLeaderName(found.name);
                    setLeaderPhone(found.phone);
                    setLeaderEmail(found.email);
                  }
                }}
                className="h-9 rounded-xl border border-input bg-background px-2.5 text-xs"
              >
                <option value="">— Choisir un Chef de Bloc créé —</option>
                {availableLeaders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.email})
                  </option>
                ))}
              </select>
              <Input
                placeholder="Nom du Chef de Bloc responsable"
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
              />
              <Input
                placeholder="Téléphone du Chef de Bloc"
                value={leaderPhone}
                onChange={(e) => setLeaderPhone(e.target.value)}
              />
              <Input
                placeholder="Email de connexion"
                value={leaderEmail}
                onChange={(e) => setLeaderEmail(e.target.value)}
              />
            </div>
          </div>

          {isAdmin && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 text-xs">
              <label className="flex items-center gap-2 font-semibold text-amber-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideOverlap}
                  onChange={(e) => setOverrideOverlap(e.target.checked)}
                />
                <ShieldAlert className="size-4" />
                Exception Administrateur : autoriser le chevauchement avec un autre bloc (traçabilité obligatoire)
              </label>
              {overrideOverlap && (
                <Input
                  placeholder="Justification administrative obligatoire de la dérogation..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              disabled={!draftBoundary || Boolean(validation.error) || saving}
              onClick={() => void handleSaveBlockBoundary()}
              className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              {saving ? 'Validation...' : 'Valider et enregistrer la zone du bloc'}
            </Button>
          </div>
        </Card>
      )}

      {/* Carte Interactive Google Maps */}
      <GeoMapCanvas
        title="Carte du Quartier et des Zones de Chefs de Bloc"
        subtitle="Cliquez sur « Dessiner une zone » ou « Modifier les frontières » pour tracer les polygones directement sur l’imagerie satellite ou routière."
        heightClassName="h-[500px]"
        overlays={overlays}
        activeBoundary={mapMode === 'VIEW' ? null : draftBoundary}
        onBoundaryChange={mapMode === 'VIEW' ? undefined : setDraftBoundary}
        allowPolygonDraw={mapMode !== 'VIEW'}
        validationError={validation.error}
        validationSuccess={validation.success}
        legendItems={legendItems}
        onOverlayClick={(overlay) => setClickedOverlay(overlay)}
        focusTarget={
          gpsFocusTarget ?? {
            boundary: activeNeighborhood.boundary ?? null,
            key: `${activeNeighborhood.id}-${mapMode}`,
          }
        }
      />

      {/* Fiche de détails au clic sur une zone */}
      {clickedOverlay && (
        <Card className="p-4 border-primary/40 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-sm"
                style={{ backgroundColor: clickedOverlay.color }}
              />
              <h4 className="font-bold text-sm text-foreground">{clickedOverlay.label}</h4>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setClickedOverlay(null)} className="h-7 text-xs">
              Fermer
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
            <p>Responsable : <strong className="text-foreground">{String(clickedOverlay.metadata?.responsable ?? '-')}</strong></p>
            <p>Téléphone : <strong className="text-foreground">{String(clickedOverlay.metadata?.telephone ?? '-')}</strong></p>
            <p>
              Superficie :{' '}
              <strong className="text-foreground">
                {Math.round(computePolygonAreaM2(clickedOverlay.boundary)).toLocaleString('fr-FR')} m²
              </strong>
            </p>
          </div>
        </Card>
      )}

      {/* Liste des zones de blocs et actions rapides */}
      <div className="grid gap-3 md:grid-cols-2">
        {blocks.map((blk, idx) => (
          <Card key={blk.id} className="p-4 border-border flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span
                  className="size-3.5 rounded-sm mt-1 shrink-0"
                  style={{ backgroundColor: blk.color || BLOCK_COLORS[idx % BLOCK_COLORS.length]! }}
                />
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    {blk.name}
                    {blk.isActive === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500">
                        Désactivé
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Code : <span className="font-mono">{blk.code}</span> ·{' '}
                    {blk.boundary
                      ? `${Math.round(computePolygonAreaM2(blk.boundary)).toLocaleString('fr-FR')} m²`
                      : 'Non délimité'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setMapMode('EDIT_BLOCK');
                    setSelectedBlockId(blk.id);
                    setDraftBoundary(blk.boundary ?? null);
                    setNewBlockName(blk.name);
                    setNewBlockCode(blk.code);
                    setNewBlockColor(blk.color || BLOCK_COLORS[idx % BLOCK_COLORS.length]!);
                    setLeaderName(blk.leaderName ?? '');
                    setLeaderEmail(blk.leaderEmail ?? '');
                    setLeaderPhone(blk.leaderPhone ?? '+225 ');
                  }}
                >
                  <Edit3 className="size-3.5 mr-1" /> Limites
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void toggleBlockActive(blk)}
                  className={`h-7 px-2 text-xs ${blk.isActive === false ? 'text-emerald-500' : 'text-rose-500'}`}
                  title={blk.isActive === false ? 'Réactiver ce bloc' : 'Désactiver ce bloc'}
                >
                  <Power className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center justify-between border-t border-border/60 pt-2">
              <span className="flex items-center gap-1">
                <UserCheck className="size-3.5 text-cyan-500" />
                {blk.leaderName || 'Aucun chef affecté'}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="size-3.5 text-emerald-500" />
                {blk.totalResidences} résidences · {blk.totalHabitants} habitants
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Journal des modifications géographiques */}
      {auditLogs.length > 0 && (
        <Card className="p-4 border-border space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <History className="size-3.5" /> Historique des modifications géographiques récentes
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
            {auditLogs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5"
              >
                <span>
                  <strong className="text-foreground">{log.entityName}</strong> · {log.action} par{' '}
                  <span className="text-primary font-medium">{log.performedByName}</span>
                  {log.justification ? ` (${log.justification})` : ''}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
