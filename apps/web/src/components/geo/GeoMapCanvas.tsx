import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Crosshair,
  Edit3,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  PenTool,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  computePolygonAreaM2,
  computePolygonCentroid,
  fromGeoJsonBoundary,
  toGeoJsonPolygon,
  type GeoJsonBoundary,
  type LatLngPoint,
} from '@rentflow/shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  geocodeAddressWithGoogle,
  getBrowserGpsPosition,
  loadGoogleMapsSdk,
  resetGoogleMapsLoader,
  reverseGeocodeWithGoogle,
  saveGoogleMapsBrowserKey,
  type GoogleMapsLoadState,
} from '../../lib/geo/google-maps-loader';
import {
  DEFAULT_MAP_PROVIDER_CONFIG,
  type GeoMarkerOverlay,
  type GeoPolygonOverlay,
  type GeocodeResult,
  type MapViewMode,
} from '../../lib/geo/map-provider';

export interface GeoMapCanvasProps {
  title?: string | undefined;
  subtitle?: string | undefined;
  heightClassName?: string | undefined;
  initialCenter?: LatLngPoint | undefined;
  initialZoom?: number | undefined;
  overlays?: GeoPolygonOverlay[] | undefined;
  markers?: GeoMarkerOverlay[] | undefined;
  /** Polygone actuellement édité ou dessiné */
  activeBoundary?: GeoJsonBoundary | null | undefined;
  onBoundaryChange?: ((boundary: GeoJsonBoundary | null) => void) | undefined;
  onBoundaryValidate?: ((boundary: GeoJsonBoundary) => void) | undefined;
  /** Marqueur (Niveau 3 Propriété) */
  activeMarker?: LatLngPoint | null | undefined;
  onMarkerChange?: ((point: LatLngPoint, geocode?: GeocodeResult | null) => void) | undefined;
  onAddressSelected?: ((geocode: GeocodeResult) => void) | undefined;
  onOverlayClick?: ((overlay: GeoPolygonOverlay) => void) | undefined;
  onMarkerClick?: ((marker: GeoMarkerOverlay) => void) | undefined;
  allowPolygonDraw?: boolean | undefined;
  allowMarkerPlacement?: boolean | undefined;
  /** Message d'erreur de validation géométrique (affiché sur la carte) */
  validationError?: string | null | undefined;
  validationSuccess?: string | null | undefined;
  /** Permet le zoom automatique vers un polygone ou marqueur cible */
  focusTarget?: { boundary?: GeoJsonBoundary | null; point?: LatLngPoint | null; key?: string } | null | undefined;
  legendItems?: Array<{ label: string; color: string }> | undefined;
}

export function GeoMapCanvas({
  title,
  subtitle,
  heightClassName = 'h-[460px]',
  initialCenter,
  initialZoom = 15,
  overlays = [],
  markers = [],
  activeBoundary = null,
  onBoundaryChange,
  onBoundaryValidate,
  activeMarker = null,
  onMarkerChange,
  onAddressSelected,
  onOverlayClick,
  onMarkerClick,
  allowPolygonDraw = false,
  allowMarkerPlacement = false,
  validationError,
  validationSuccess,
  focusTarget,
  legendItems,
}: GeoMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlayPolygonsRef = useRef<any[]>([]);
  const overlayMarkersRef = useRef<any[]>([]);
  const activePolyRef = useRef<any>(null);
  const draftPolylineRef = useRef<any>(null);
  const draftPointMarkersRef = useRef<any[]>([]);
  const activeMarkerRef = useRef<any>(null);

  const [sdkState, setSdkState] = useState<GoogleMapsLoadState>({ status: 'LOADING' });
  const [viewMode, setViewMode] = useState<MapViewMode>('HYBRID');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<'PAN' | 'DRAW_POLYGON' | 'EDIT_POLYGON' | 'PLACE_MARKER'>('PAN');
  const [draftPoints, setDraftPoints] = useState<LatLngPoint[]>(() =>
    fromGeoJsonBoundary(activeBoundary),
  );
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Synchronise draftPoints si activeBoundary change depuis l'extérieur
  useEffect(() => {
    setDraftPoints(fromGeoJsonBoundary(activeBoundary));
  }, [activeBoundary]);

  const initLoader = useCallback(async () => {
    setSdkState({ status: 'LOADING' });
    const result = await loadGoogleMapsSdk();
    setSdkState(result);
  }, []);

  useEffect(() => {
    void initLoader();
  }, [initLoader]);

  // Initialisation de l'instance Google Maps
  useEffect(() => {
    if (sdkState.status !== 'READY' || !mapContainerRef.current || !window.google?.maps?.Map) {
      return;
    }

    if (!mapInstanceRef.current) {
      const center =
        activeMarker ??
        computePolygonCentroid(activeBoundary) ??
        initialCenter ??
        DEFAULT_MAP_PROVIDER_CONFIG.defaultCenter;

      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center,
        zoom: initialZoom,
        mapTypeId: viewMode.toLowerCase(),
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: false,
        tilt: 0,
      });

      // Places Autocomplete si disponible
      if (searchInputRef.current && window.google?.maps?.places?.Autocomplete) {
        const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ['formatted_address', 'geometry', 'address_components', 'name'],
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const loc = place?.geometry?.location;
          if (!loc) return;
          const lat = loc.lat();
          const lng = loc.lng();
          mapInstanceRef.current?.panTo({ lat, lng });
          mapInstanceRef.current?.setZoom(18);
          const geo: GeocodeResult = {
            address: place.formatted_address || place.name || searchInputRef.current?.value || '',
            lat,
            lng,
          };
          onAddressSelected?.(geo);
          if (allowMarkerPlacement && onMarkerChange) {
            onMarkerChange({ lat, lng }, geo);
          }
        });
      }
    }
  }, [sdkState.status]);

  // Synchroniser le mode d'affichage ROADMAP / SATELLITE / HYBRID
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current.setMapTypeId(viewMode.toLowerCase());
    }
  }, [viewMode]);

  // Click sur la carte selon l'outil actif (Dessiner polygone / Placer marqueur)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    map.setOptions({
      draggableCursor: toolMode === 'DRAW_POLYGON' || toolMode === 'PLACE_MARKER' ? 'crosshair' : undefined,
    });

    const listener = map.addListener('click', async (event: any) => {
      if (!event?.latLng) return;
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      if (toolMode === 'DRAW_POLYGON' && allowPolygonDraw) {
        setDraftPoints((prev) => {
          const next = [...prev, { lat, lng }];
          if (next.length >= 3) {
            onBoundaryChange?.(toGeoJsonPolygon(next));
          }
          return next;
        });
      } else if (toolMode === 'PLACE_MARKER' && allowMarkerPlacement) {
        const pt = { lat, lng };
        const geocode = await reverseGeocodeWithGoogle(lat, lng).catch(() => null);
        onMarkerChange?.(pt, geocode);
      }
    });

    return () => {
      window.google?.maps?.event?.removeListener(listener);
    };
  }, [sdkState.status, toolMode, allowPolygonDraw, allowMarkerPlacement, onBoundaryChange, onMarkerChange]);

  // Rendu des couches overlays (Quartiers, Blocs, Propriétaires, Propriétés)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    for (const p of overlayPolygonsRef.current) p.setMap(null);
    overlayPolygonsRef.current = [];

    for (const overlay of overlays) {
      const path = fromGeoJsonBoundary(overlay.boundary);
      if (path.length < 3) continue;

      const poly = new window.google.maps.Polygon({
        paths: path,
        strokeColor: overlay.color,
        strokeOpacity: overlay.locked ? 0.9 : 0.95,
        strokeWeight: overlay.strokeWeight ?? (overlay.level === 'NEIGHBORHOOD' ? 3 : 2),
        fillColor: overlay.color,
        fillOpacity: overlay.fillOpacity ?? (overlay.level === 'NEIGHBORHOOD' ? 0.08 : 0.2),
        clickable: Boolean(onOverlayClick),
        editable: false,
        zIndex: overlay.level === 'NEIGHBORHOOD' ? 1 : overlay.level === 'BLOCK' ? 2 : overlay.level === 'OWNER' ? 3 : 4,
      });
      poly.setMap(map);
      if (onOverlayClick) {
        poly.addListener('click', () => onOverlayClick(overlay));
      }
      overlayPolygonsRef.current.push(poly);
    }

    for (const m of overlayMarkersRef.current) m.setMap(null);
    overlayMarkersRef.current = [];

    for (const markerItem of markers) {
      const marker = new window.google.maps.Marker({
        position: markerItem.position,
        map,
        title: markerItem.title,
        icon: window.google.maps.SymbolPath
          ? {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: markerItem.color || '#10b981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }
          : undefined,
      });
      if (onMarkerClick) {
        marker.addListener('click', () => onMarkerClick(markerItem));
      }
      overlayMarkersRef.current.push(marker);
    }
  }, [sdkState.status, overlays, markers, onOverlayClick, onMarkerClick]);

  // Rendu du polygone en cours de dessin ou d'édition
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    if (activePolyRef.current) {
      activePolyRef.current.setMap(null);
      activePolyRef.current = null;
    }
    if (draftPolylineRef.current) {
      draftPolylineRef.current.setMap(null);
      draftPolylineRef.current = null;
    }
    for (const dm of draftPointMarkersRef.current) dm.setMap(null);
    draftPointMarkersRef.current = [];

    if (draftPoints.length === 0) return;

    if (draftPoints.length < 3) {
      draftPolylineRef.current = new window.google.maps.Polyline({
        path: draftPoints,
        strokeColor: '#f59e0b',
        strokeWeight: 3,
        map,
      });
      for (const pt of draftPoints) {
        const dot = new window.google.maps.Marker({
          position: pt,
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
          },
        });
        draftPointMarkersRef.current.push(dot);
      }
      return;
    }

    const isEditable = allowPolygonDraw && (toolMode === 'EDIT_POLYGON' || toolMode === 'DRAW_POLYGON');
    const polyColor = validationError ? '#ef4444' : '#10b981';

    const poly = new window.google.maps.Polygon({
      paths: draftPoints,
      strokeColor: polyColor,
      strokeWeight: 3,
      fillColor: polyColor,
      fillOpacity: 0.25,
      editable: isEditable,
      zIndex: 10,
      map,
    });

    if (isEditable) {
      const path = poly.getPath();
      const syncPath = () => {
        const updated: LatLngPoint[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          const pt = path.getAt(i);
          updated.push({ lat: pt.lat(), lng: pt.lng() });
        }
        setDraftPoints(updated);
        if (updated.length >= 3) {
          onBoundaryChange?.(toGeoJsonPolygon(updated));
        }
      };
      path.addListener('set_at', syncPath);
      path.addListener('insert_at', syncPath);
      path.addListener('remove_at', syncPath);
    }

    activePolyRef.current = poly;
  }, [sdkState.status, draftPoints, toolMode, allowPolygonDraw, validationError, onBoundaryChange]);

  // Rendu du marqueur actif (Niveau 3 Propriété)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    if (activeMarkerRef.current) {
      activeMarkerRef.current.setMap(null);
      activeMarkerRef.current = null;
    }

    if (!activeMarker) return;

    const marker = new window.google.maps.Marker({
      position: activeMarker,
      map,
      draggable: allowMarkerPlacement,
      title: 'Emplacement du bien',
      animation: window.google.maps.Animation?.DROP,
    });

    if (allowMarkerPlacement && onMarkerChange) {
      marker.addListener('dragend', async (event: any) => {
        if (!event?.latLng) return;
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        const geocode = await reverseGeocodeWithGoogle(lat, lng).catch(() => null);
        onMarkerChange({ lat, lng }, geocode);
      });
    }

    activeMarkerRef.current = marker;
  }, [sdkState.status, activeMarker, allowMarkerPlacement, onMarkerChange]);

  // Zoom automatique vers une cible ou un polygone
  const fitAllOnMap = useCallback((customBoundary?: GeoJsonBoundary | null, customPoint?: LatLngPoint | null) => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    if (customPoint) {
      map.panTo(customPoint);
      map.setZoom(18);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    const addPts = (pts: LatLngPoint[]) => {
      for (const p of pts) {
        bounds.extend(p);
        hasPoints = true;
      }
    };

    if (customBoundary) {
      addPts(fromGeoJsonBoundary(customBoundary));
    } else {
      addPts(draftPoints);
      for (const o of overlays) addPts(fromGeoJsonBoundary(o.boundary));
      for (const m of markers) addPts([m.position]);
      if (activeMarker) addPts([activeMarker]);
    }

    if (hasPoints) {
      map.fitBounds(bounds, 48);
    }
  }, [draftPoints, overlays, markers, activeMarker]);

  useEffect(() => {
    if (sdkState.status === 'READY' && focusTarget) {
      fitAllOnMap(focusTarget.boundary, focusTarget.point);
    }
  }, [sdkState.status, focusTarget, fitAllOnMap]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setMapNotice(null);
    try {
      const result = await geocodeAddressWithGoogle(q);
      mapInstanceRef.current?.panTo({ lat: result.lat, lng: result.lng });
      mapInstanceRef.current?.setZoom(18);
      onAddressSelected?.(result);
      if (allowMarkerPlacement && onMarkerChange) {
        onMarkerChange({ lat: result.lat, lng: result.lng }, result);
      }
      setMapNotice(`Localisé : ${result.address}`);
    } catch (err: any) {
      setMapNotice(err?.message ?? 'Adresse introuvable.');
    } finally {
      setSearching(false);
    }
  };

  const handleLocateGps = async () => {
    setGpsLoading(true);
    setMapNotice(null);
    try {
      const gps = await getBrowserGpsPosition();
      const pt = { lat: gps.lat, lng: gps.lng };
      mapInstanceRef.current?.panTo(pt);
      mapInstanceRef.current?.setZoom(19);
      const geocode = await reverseGeocodeWithGoogle(gps.lat, gps.lng).catch(() => null);
      if (allowMarkerPlacement && onMarkerChange) {
        onMarkerChange(pt, geocode);
      }
      if (geocode) onAddressSelected?.(geocode);
      setMapNotice(
        `Position GPS capturée (précision ±${Math.round(gps.accuracy)}m) : ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`,
      );
    } catch (err: any) {
      setMapNotice(err?.message ?? 'Impossible d’accéder au GPS.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleUndoVertex = () => {
    setDraftPoints((prev) => {
      const next = prev.slice(0, -1);
      onBoundaryChange?.(next.length >= 3 ? toGeoJsonPolygon(next) : null);
      return next;
    });
  };

  const handleClearPolygon = () => {
    setDraftPoints([]);
    onBoundaryChange?.(null);
    setToolMode('PAN');
  };

  const areaM2 = useMemo(() => {
    if (draftPoints.length < 3) return 0;
    return computePolygonAreaM2(toGeoJsonPolygon(draftPoints));
  }, [draftPoints]);

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-background p-3 sm:p-5 flex flex-col gap-3 overflow-y-auto'
          : 'space-y-3'
      }
    >
      {/* En-tête + Barre d'outils */}
      {(title || subtitle) && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Layers className="size-4 text-primary" /> {title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen((f) => !f)}
            className="h-8 text-xs gap-1.5"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          </Button>
        </div>
      )}

      {/* Recherche adresse + GPS + Modes Carte */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className="flex flex-1 min-w-[220px] items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="Rechercher adresse, quartier, rue..."
              className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 pl-8 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={searching || sdkState.status !== 'READY'}
            onClick={() => void handleSearch()}
            className="h-9 text-xs"
          >
            {searching ? '...' : 'Chercher'}
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={gpsLoading}
          onClick={() => void handleLocateGps()}
          className="h-9 text-xs gap-1.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
        >
          <LocateFixed className="size-3.5" />
          {gpsLoading ? 'Localisation...' : 'Ma position GPS'}
        </Button>

        {/* Sélecteur Normal / Satellite / Hybride */}
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-[11px]">
          {(['ROADMAP', 'SATELLITE', 'HYBRID'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                viewMode === mode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'ROADMAP' ? 'Normal' : mode === 'SATELLITE' ? 'Satellite' : 'Hybride'}
            </button>
          ))}
        </div>

        {/* Zoom +/- et recentrer */}
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current?.getZoom() ?? 15) + 1)}
            className="h-8 w-8 p-0"
            title="Zoom avant"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current?.getZoom() ?? 15) - 1)}
            className="h-8 w-8 p-0"
            title="Zoom arrière"
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => fitAllOnMap()}
            className="h-8 w-8 p-0"
            title="Recentrer sur les zones"
          >
            <Compass className="size-4" />
          </Button>
        </div>
      </div>

      {/* Barre de dessin de polygone et placement de marqueur */}
      {(allowPolygonDraw || allowMarkerPlacement) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-2">
          {allowMarkerPlacement && (
            <Button
              type="button"
              size="sm"
              variant={toolMode === 'PLACE_MARKER' ? 'primary' : 'outline'}
              onClick={() => setToolMode((m) => (m === 'PLACE_MARKER' ? 'PAN' : 'PLACE_MARKER'))}
              className="h-8 text-xs gap-1.5"
            >
              <MapPin className="size-3.5" />
              {toolMode === 'PLACE_MARKER' ? 'Cliquez sur le bâtiment...' : 'Placer marqueur bâtiment'}
            </Button>
          )}

          {allowPolygonDraw && (
            <>
              <Button
                type="button"
                size="sm"
                variant={toolMode === 'DRAW_POLYGON' ? 'primary' : 'outline'}
                onClick={() => setToolMode((m) => (m === 'DRAW_POLYGON' ? 'EDIT_POLYGON' : 'DRAW_POLYGON'))}
                className="h-8 text-xs gap-1.5"
              >
                <PenTool className="size-3.5" />
                {toolMode === 'DRAW_POLYGON' ? 'Cliquez pour placer les sommets...' : 'Dessiner une zone'}
              </Button>

              {draftPoints.length >= 3 && (
                <Button
                  type="button"
                  size="sm"
                  variant={toolMode === 'EDIT_POLYGON' ? 'secondary' : 'outline'}
                  onClick={() => setToolMode((m) => (m === 'EDIT_POLYGON' ? 'PAN' : 'EDIT_POLYGON'))}
                  className="h-8 text-xs gap-1.5"
                >
                  <Edit3 className="size-3.5" />
                  Modifier les frontières
                </Button>
              )}

              {draftPoints.length > 0 && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleUndoVertex}
                    className="h-8 text-xs gap-1"
                  >
                    <Undo2 className="size-3.5" /> Annuler point
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleClearPolygon}
                    className="h-8 text-xs gap-1 text-rose-500 hover:text-rose-400"
                  >
                    <Trash2 className="size-3.5" /> Effacer tracé
                  </Button>
                </>
              )}

              {draftPoints.length >= 3 && onBoundaryValidate && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setToolMode('PAN');
                    onBoundaryValidate(toGeoJsonPolygon(draftPoints));
                  }}
                  className="ml-auto h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <CheckCircle2 className="size-3.5" />
                  Valider la zone ({draftPoints.length} sommets)
                </Button>
              )}
            </>
          )}

          {areaM2 > 0 && (
            <span className="text-[11px] font-mono text-muted-foreground ml-auto">
              Surface estimée :{' '}
              <strong>
                {areaM2 > 10_000
                  ? `${(areaM2 / 10_000).toFixed(2)} ha`
                  : `${Math.round(areaM2).toLocaleString('fr-FR')} m²`}
              </strong>
            </span>
          )}
        </div>
      )}

      {/* Zone Carte Principale */}
      <div
        className={`relative w-full ${
          isFullscreen ? 'flex-1 min-h-[420px]' : heightClassName
        } rounded-2xl border border-border overflow-hidden bg-slate-950`}
      >
        {/* Canvas Google Maps */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* État de chargement ou d'erreur Google Maps (sans fausse imagerie vidéo) */}
        {sdkState.status !== 'READY' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/92 p-5 text-center text-white">
            {sdkState.status === 'LOADING' ? (
              <div className="space-y-2">
                <RefreshCw className="size-7 animate-spin text-emerald-400 mx-auto" />
                <p className="text-sm font-bold">Connexion à Google Maps Platform...</p>
              </div>
            ) : (
              <div className="max-w-lg space-y-3 rounded-2xl border border-amber-500/40 bg-slate-900/95 p-5 shadow-xl">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm">
                  <AlertTriangle className="size-5 shrink-0" />
                  <span>Google Maps non connecté ({sdkState.status})</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {sdkState.errorMessage}
                </p>
                <div className="rounded-lg bg-slate-950/80 border border-white/10 p-3 text-left text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-200">APIs requises sur Google Cloud Console :</p>
                  <p>• Maps JavaScript API · Places API · Geocoding API</p>
                  <p>• Variable frontend : <code className="text-emerald-400">VITE_GOOGLE_MAPS_API_KEY</code></p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Input
                    value={tempKeyInput}
                    onChange={(e) => setTempKeyInput(e.target.value)}
                    placeholder="Saisir clé navigateur Google Maps (test local)..."
                    className="flex-1 h-8 text-xs bg-slate-950 border-white/20 text-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      saveGoogleMapsBrowserKey(tempKeyInput);
                      resetGoogleMapsLoader();
                      void initLoader();
                    }}
                    className="h-8 text-xs"
                  >
                    Connecter
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetGoogleMapsLoader();
                      void initLoader();
                    }}
                    className="h-8 text-xs border-white/20 text-white"
                  >
                    <RotateCcw className="size-3.5 mr-1" /> Réessayer
                  </Button>
                </div>

                {/* Résumé des données géographiques chargées même sans fond satellite */}
                <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 flex flex-wrap justify-center gap-3">
                  <span>Couches chargées : {overlays.length} polygones</span>
                  <span>Points : {markers.length} marqueurs</span>
                  {draftPoints.length > 0 && <span>Tracé actif : {draftPoints.length} sommets</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Badge d'outil actif */}
        {sdkState.status === 'READY' && toolMode !== 'PAN' && (
          <div className="absolute top-3 left-3 z-10 rounded-xl bg-black/75 backdrop-blur-md px-3 py-1.5 text-xs text-white border border-white/15 flex items-center gap-2">
            <Crosshair className="size-3.5 text-emerald-400 animate-pulse" />
            <span>
              {toolMode === 'DRAW_POLYGON' &&
                `Mode tracé : cliquez sur la carte pour poser chaque point (${draftPoints.length} points)`}
              {toolMode === 'EDIT_POLYGON' &&
                'Mode édition : déplacez les sommets blancs pour ajuster la frontière'}
              {toolMode === 'PLACE_MARKER' &&
                'Mode marqueur : cliquez sur votre bâtiment ou déplacez le marqueur'}
            </span>
          </div>
        )}
      </div>

      {/* Notifications & erreurs de validation géométrique */}
      {mapNotice && (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
          {mapNotice}
        </div>
      )}

      {validationError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-500 flex items-start gap-2 font-medium">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {validationSuccess && !validationError && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-500 flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{validationSuccess}</span>
        </div>
      )}

      {/* Légende dynamique + Mention réglementaire */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
        {legendItems && legendItems.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {legendItems.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className="size-2.5 rounded-sm border border-white/40" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        ) : (
          <span>Imagerie Google Maps · Modes Normal, Satellite & Hybride</span>
        )}
        <span className="text-[10px] opacity-80">
          Images satellites fournies par le fournisseur (non temps réel). Délimitations à usage de gestion interne, ne constituant pas un titre foncier.
        </span>
      </div>
    </div>
  );
}
