import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  PenTool,
  Search,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  computePolygonAreaM2,
  fromGeoJsonBoundary,
  toGeoJsonPolygon,
  type GeoJsonBoundary,
  type LatLngPoint,
} from '@rentflow/shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DEFAULT_MAP_PROVIDER_CONFIG,
  type GeoMarkerOverlay,
  type GeoPolygonOverlay,
  type GeocodeResult,
} from '../../lib/geo/map-provider';
import { TILE_LAYERS, type TileLayerId } from '../../lib/geo/leaflet-tile-providers';
import {
  reverseGeocodeWithNominatim,
  searchAddressWithNominatim,
} from '../../lib/geo/nominatim-geocoder';
import {
  GpsNavigationTracker,
  type GpsNavigationState,
} from '../../lib/geo/gps-navigation-tracker';
import { VoiceNavigator } from '../../lib/geo/voice-navigator';
import { GpsNavigationHUD } from './GpsNavigationHUD';
import type { TransportMode } from '../../lib/geo/routing-engine';
import { getPreciseUserLocation } from '../../lib/geo/geolocation-helper';

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
  focusTarget?:
    | {
        boundary?: GeoJsonBoundary | null | undefined;
        point?: LatLngPoint | null | undefined;
        lat?: number | undefined;
        lng?: number | undefined;
        zoom?: number | undefined;
        key?: string | undefined;
      }
    | null
    | undefined;
  legendItems?: Array<{ label: string; color: string }> | undefined;
  /** Déclenchement externe de la navigation vers une destination */
  targetDestination?: LatLngPoint | null | undefined;
  targetDestinationName?: string | undefined;
}

export function GeoMapCanvas({
  title,
  subtitle,
  heightClassName = 'h-[460px]',
  initialCenter,
  initialZoom = 14,
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
  targetDestination = null,
  targetDestinationName,
}: GeoMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);

  // Groupes de calques Leaflet
  const overlaysLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const markersLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const drawLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const routeLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const userGpsLayerGroupRef = useRef<L.FeatureGroup | null>(null);

  // État local des calques et de l'affichage
  const [activeTileId, setActiveTileId] = useState<TileLayerId>('osm');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<LatLngPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  // Système de navigation GPS Turn-by-Turn
  const [navDestinationName, setNavDestinationName] = useState<string>('');
  const [navTransportMode, setNavTransportMode] = useState<TransportMode>('driving');
  const [voiceNavigator] = useState(() => new VoiceNavigator(false));
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [navState, setNavState] = useState<GpsNavigationState | null>(null);
  const navTrackerRef = useRef<GpsNavigationTracker | null>(null);

  // 1. Initialisation Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const defaultCenter = initialCenter || DEFAULT_MAP_PROVIDER_CONFIG.defaultCenter;

    const map = L.map(mapContainerRef.current, {
      center: [defaultCenter.lat, defaultCenter.lng],
      zoom: initialZoom,
      zoomControl: false, // Boutons personnalisés
      attributionControl: true,
    });

    mapInstanceRef.current = map;

    // Couche de tuiles initiale (OpenStreetMap)
    const initialConfig = TILE_LAYERS[activeTileId];
    baseTileLayerRef.current = L.tileLayer(initialConfig.url, {
      attribution: initialConfig.attribution,
      maxZoom: initialConfig.maxZoom,
    }).addTo(map);

    // Initialisation des feature groups
    overlaysLayerGroupRef.current = L.featureGroup().addTo(map);
    markersLayerGroupRef.current = L.featureGroup().addTo(map);
    drawLayerGroupRef.current = L.featureGroup().addTo(map);
    routeLayerGroupRef.current = L.featureGroup().addTo(map);
    userGpsLayerGroupRef.current = L.featureGroup().addTo(map);

    // Invalidation de taille après le premier rendu
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Gestion du changement de style de carte (OSM, Satellite, Hybride, Dark)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const config = TILE_LAYERS[activeTileId];

    // Supprimer l'ancienne couche de base
    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }
    // Supprimer l'éventuelle couche overlay
    if (overlayTileLayerRef.current) {
      map.removeLayer(overlayTileLayerRef.current);
      overlayTileLayerRef.current = null;
    }

    baseTileLayerRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map);

    // Ajouter la couche overlay si elle existe (ex: routes sur vue satellite)
    if (config.overlayUrl) {
      overlayTileLayerRef.current = L.tileLayer(config.overlayUrl, {
        attribution: config.overlayAttribution || '',
        maxZoom: config.maxZoom,
      }).addTo(map);
    }
  }, [activeTileId]);

  // 3. Mise à jour de drawingPoints depuis activeBoundary externe
  useEffect(() => {
    if (activeBoundary) {
      const pts = fromGeoJsonBoundary(activeBoundary);
      setDrawingPoints(pts);
    } else {
      setDrawingPoints([]);
    }
  }, [activeBoundary]);

  // 4. Gestion des clics sur la carte (dessin de polygone ou placement de marqueur)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const clickedPoint: LatLngPoint = { lat: e.latlng.lat, lng: e.latlng.lng };

      if (allowPolygonDraw) {
        setDrawingPoints((prev) => {
          const next = [...prev, clickedPoint];
          if (onBoundaryChange) {
            onBoundaryChange(next.length >= 3 ? toGeoJsonPolygon(next) : null);
          }
          return next;
        });
      } else if (allowMarkerPlacement) {
        let geocode: GeocodeResult | null = null;
        try {
          geocode = await reverseGeocodeWithNominatim(clickedPoint.lat, clickedPoint.lng);
        } catch {}
        if (onMarkerChange) {
          onMarkerChange(clickedPoint, geocode);
        }
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [allowPolygonDraw, allowMarkerPlacement, onBoundaryChange, onMarkerChange]);

  // 5. Rendu du tracé en cours d'édition (Polygone + Poignées)
  useEffect(() => {
    const group = drawLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    if (drawingPoints.length === 0) return;

    // Sommets individuels
    drawingPoints.forEach((pt, idx) => {
      const marker = L.circleMarker([pt.lat, pt.lng], {
        radius: idx === 0 ? 8 : 6,
        color: idx === 0 ? '#10b981' : '#3b82f6',
        fillColor: '#ffffff',
        fillOpacity: 1,
        weight: 2,
      });
      group.addLayer(marker);
    });

    // Lignes ou polygone fermé
    if (drawingPoints.length >= 3) {
      const latlngs = drawingPoints.map((p) => [p.lat, p.lng] as [number, number]);
      const polygon = L.polygon(latlngs, {
        color: '#10b981',
        weight: 3,
        fillColor: '#10b981',
        fillOpacity: 0.25,
      });
      group.addLayer(polygon);
    } else if (drawingPoints.length === 2) {
      const latlngs = drawingPoints.map((p) => [p.lat, p.lng] as [number, number]);
      const polyline = L.polyline(latlngs, {
        color: '#10b981',
        weight: 3,
        dashArray: '5, 5',
      });
      group.addLayer(polyline);
    }
  }, [drawingPoints]);

  // 6. Rendu des Polygones existants (`overlays`)
  useEffect(() => {
    const group = overlaysLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    overlays.forEach((overlay) => {
      const pts = fromGeoJsonBoundary(overlay.boundary);
      if (pts.length < 3) return;

      const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
      const polygon = L.polygon(latlngs, {
        color: overlay.color,
        weight: overlay.strokeWeight || 2.5,
        fillColor: overlay.color,
        fillOpacity: overlay.fillOpacity ?? 0.18,
      });

      // Tooltip élégant au survol du polygone
      polygon.bindTooltip(
        `<div class="font-bold text-xs">${overlay.label}</div>${overlay.sublabel ? `<div class="text-[10px] text-gray-500">${overlay.sublabel}</div>` : ''}`,
        { permanent: false, direction: 'center', className: 'domora-leaflet-tooltip' },
      );

      if (onOverlayClick) {
        polygon.on('click', () => onOverlayClick(overlay));
      }

      group.addLayer(polygon);

      // Pointeur permanent au centroïde avec le nom de la localisation délimitée (quartier / bloc / zone)
      const cLat = pts.reduce((acc, p) => acc + p.lat, 0) / pts.length;
      const cLng = pts.reduce((acc, p) => acc + p.lng, 0) / pts.length;
      const pinColor = overlay.color || '#0284c7';
      const centroidPinIcon = L.divIcon({
        className: 'domora-zone-centroid-pin',
        html: `
          <div style="background-color: ${pinColor}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; cursor: pointer;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });
      const centroidPin = L.marker([cLat, cLng], { icon: centroidPinIcon, zIndexOffset: 200 });
      centroidPin.bindTooltip(
        `<div style="font-weight:700;font-size:11px;line-height:1.2;color:#0f172a;">📍 ${overlay.label}</div>${
          overlay.sublabel ? `<div style="font-size:10px;color:#475569;">${overlay.sublabel}</div>` : ''
        }`,
        {
          permanent: true,
          direction: 'top',
          offset: [0, -22],
          className: 'domora-leaflet-tooltip',
        },
      );
      if (onOverlayClick) {
        centroidPin.on('click', () => onOverlayClick(overlay));
      }
      group.addLayer(centroidPin);
    });
  }, [overlays, onOverlayClick]);

  // 7. Rendu des Marqueurs de Propriétés et Points d'intérêt (`markers`)
  useEffect(() => {
    const group = markersLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    // Marqueur actif en cours d'édition (ex: formulaire de création)
    if (activeMarker) {
      const activeIcon = L.divIcon({
        className: 'custom-active-marker',
        html: `
          <div style="background-color: #f59e0b; width: 34px; height: 34px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const m = L.marker([activeMarker.lat, activeMarker.lng], { icon: activeIcon });
      const hasMatchingPropertyMarker = markers.some(
        (mk) => Math.abs(mk.position.lat - activeMarker.lat) < 1e-6 && Math.abs(mk.position.lng - activeMarker.lng) < 1e-6,
      );
      if (!hasMatchingPropertyMarker) {
        m.bindTooltip(
          `<div style="font-weight:700;font-size:11px;">📍 Position sélectionnée</div>`,
          { permanent: true, direction: 'top', offset: [0, -30], className: 'domora-leaflet-tooltip' },
        );
      }
      group.addLayer(m);
    }

    // Marqueurs des propriétés recensées
    markers.forEach((markerOverlay) => {
      const { position, title: mTitle, subtitle: mSubtitle, color = '#10b981', propertyDetails } = markerOverlay;

      const markerColor = color || '#10b981';
      const customIcon = L.divIcon({
        className: 'domora-property-marker',
        html: `
          <div style="background-color: ${markerColor}; width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; transition: transform 0.15s ease;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const m = L.marker([position.lat, position.lng], { icon: customIcon });

      // Étiquette visible directement sur la carte avec nom et adresse de la propriété
      m.bindTooltip(
        `<div style="font-weight:700;font-size:11px;line-height:1.2;">${mTitle}</div>${
          mSubtitle ? `<div style="font-size:10px;color:#334155;">📍 ${mSubtitle}</div>` : ''
        }`,
        {
          permanent: markers.length <= 20,
          direction: 'top',
          offset: [0, -28],
          className: 'domora-leaflet-tooltip',
        },
      );

      // Popup Leaflet complet conforme aux exigences
      const propId = propertyDetails?.propertyId || markerOverlay.id;
      const popupContent = document.createElement('div');
      popupContent.className = 'p-1 space-y-2 text-xs font-sans max-w-[270px]';

      const photoHtml = propertyDetails?.photoUrl
        ? `<img src="${propertyDetails.photoUrl}" alt="${mTitle}" style="width: 100%; height: 115px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;" />`
        : `<div style="width: 100%; height: 60px; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 11px; margin-bottom: 6px;">Propriété DOMORA</div>`;

      const priceHtml = propertyDetails?.priceMinor
        ? `<div style="font-size: 13px; font-weight: 800; color: #059669;">${(propertyDetails.priceMinor).toLocaleString('fr-FR')} ${propertyDetails.currency || 'FCFA'}</div>`
        : '';

      const roomsHtml = propertyDetails?.roomsCount
        ? `<span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">${propertyDetails.roomsCount} pièces</span>`
        : '';

      const geoInfo = [propertyDetails?.neighborhood, propertyDetails?.city, propertyDetails?.country]
        .filter(Boolean)
        .join(' • ');

      const statusBadge = propertyDetails?.status
        ? `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${propertyDetails.status}</span>`
        : '';

      popupContent.innerHTML = `
        ${photoHtml}
        <div>
          <div style="font-weight: 800; font-size: 13px; color: #0f172a; line-height: 1.2;">${mTitle}</div>
          <div style="color: #64748b; font-size: 11px; margin-top: 2px;">${mSubtitle || propertyDetails?.address || ''}</div>
          ${geoInfo ? `<div style="color: #059669; font-size: 10px; font-weight: 600; margin-top: 2px;">📍 ${geoInfo}</div>` : ''}
        </div>
        ${priceHtml}
        <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
          ${roomsHtml}
          ${propertyDetails?.type ? `<span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500;">${propertyDetails.type}</span>` : ''}
          ${statusBadge}
        </div>
        <div style="display: flex; gap: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
          <button id="btn-details-${propId}" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; color: #334155;">
            Voir détails
          </button>
          <button id="btn-go-${propId}" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 700; background: #059669; border: none; border-radius: 6px; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            Y aller
          </button>
        </div>
      `;

      m.bindPopup(popupContent, { maxWidth: 280, className: 'domora-property-popup' });

      m.on('popupopen', () => {
        const btnDetails = document.getElementById(`btn-details-${propId}`);
        const btnGo = document.getElementById(`btn-go-${propId}`);

        if (btnDetails) {
          btnDetails.onclick = () => {
            if (onMarkerClick) onMarkerClick(markerOverlay);
            else window.location.href = `/properties/${propId}`;
          };
        }

        if (btnGo) {
          btnGo.onclick = () => {
            startGpsNavigation(position, mTitle);
          };
        }
      });

      group.addLayer(m);
    });
  }, [markers, activeMarker, onMarkerClick]);

  // 8. Focus automatique vers cible (focusTarget)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusTarget) return;

    const applyFocus = () => {
      map.invalidateSize();
      if (focusTarget.boundary) {
        const pts = fromGeoJsonBoundary(focusTarget.boundary);
        if (pts.length >= 3) {
          const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17, animate: true });
          return;
        }
      }

      if (focusTarget.point) {
        map.setView([focusTarget.point.lat, focusTarget.point.lng], focusTarget.zoom || 16, {
          animate: true,
        });
        return;
      }

      if (typeof focusTarget.lat === 'number' && typeof focusTarget.lng === 'number') {
        map.setView([focusTarget.lat, focusTarget.lng], focusTarget.zoom || 15, { animate: true });
      }
    };

    applyFocus();
    const t = setTimeout(applyFocus, 260);
    return () => clearTimeout(t);
  }, [focusTarget]);

  // 9. Déclenchement externe de la navigation (targetDestination)
  useEffect(() => {
    if (targetDestination) {
      startGpsNavigation(targetDestination, targetDestinationName || 'Destination sélectionnée');
    }
  }, [targetDestination, targetDestinationName]);

  // Fonction de démarrage de la navigation GPS
  const startGpsNavigation = useCallback(
    (destination: LatLngPoint, destName: string) => {
      setNavDestinationName(destName);

      if (navTrackerRef.current) {
        navTrackerRef.current.stop();
      }

      const tracker = new GpsNavigationTracker({
        destination,
        destinationName: destName,
        initialMode: navTransportMode,
        voiceNavigator,
        onStateUpdate: (state) => {
          setNavState(state);
          updateRouteOnMap(state);
        },
        onArrived: () => {
          // Arrivé à bon port
        },
        onRecalculate: () => {
          // Itinéraire recalculé
        },
      });

      navTrackerRef.current = tracker;
      void tracker.start();
    },
    [navTransportMode, voiceNavigator],
  );

  // Arrêt de la navigation GPS
  const stopGpsNavigation = useCallback(() => {
    if (navTrackerRef.current) {
      navTrackerRef.current.stop();
      navTrackerRef.current = null;
    }
    setNavState(null);
    if (routeLayerGroupRef.current) routeLayerGroupRef.current.clearLayers();
    if (userGpsLayerGroupRef.current) userGpsLayerGroupRef.current.clearLayers();
  }, []);

  // Mise à jour de la ligne d'itinéraire et de la position GPS de l'utilisateur sur la carte Leaflet
  const updateRouteOnMap = useCallback((state: GpsNavigationState) => {
    const routeGroup = routeLayerGroupRef.current;
    const userGpsGroup = userGpsLayerGroupRef.current;
    const map = mapInstanceRef.current;
    if (!routeGroup || !userGpsGroup || !map) return;

    routeGroup.clearLayers();
    userGpsGroup.clearLayers();

    // 1. Tracé de l'itinéraire
    if (state.route && state.route.coordinates.length >= 2) {
      const latlngs = state.route.coordinates.map((p) => [p.lat, p.lng] as [number, number]);

      // Ligne d'ombrage extérieure
      const routeHalo = L.polyline(latlngs, {
        color: '#047857',
        weight: 9,
        opacity: 0.45,
      });
      // Ligne centrale lumineuse
      const routeMain = L.polyline(latlngs, {
        color: '#10b981',
        weight: 6,
        opacity: 0.95,
      });

      routeGroup.addLayer(routeHalo);
      routeGroup.addLayer(routeMain);

      // Si premier rendu du trajet, cadrer
      if (!state.currentPosition) {
        map.fitBounds(routeMain.getBounds(), { padding: [60, 60], animate: true });
      }
    }

    // 2. Marqueur position GPS en direct de l'utilisateur avec cap d'orientation
    if (state.currentPosition) {
      const pos = state.currentPosition;
      const headingDeg = state.heading !== null ? state.heading : 0;

      const userIcon = L.divIcon({
        className: 'domora-user-gps-marker',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(16, 185, 129, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #059669; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; transform: rotate(${headingDeg}deg);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none"><polygon points="12 2 19 21 12 17 5 21 12 2"></polygon></svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const userMarker = L.marker([pos.lat, pos.lng], { icon: userIcon, zIndexOffset: 1000 });
      userGpsGroup.addLayer(userMarker);

      // Si navigation active, recentrer automatiquement et fluidement
      map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 });
    }
  }, []);

  // Recherche d'adresse mondiale avec Nominatim (OpenStreetMap)
  const handleSearch = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchAddressWithNominatim(searchQuery, 5);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: GeocodeResult) => {
    const map = mapInstanceRef.current;
    if (map) {
      map.setView([result.lat, result.lng], 16, { animate: true });
    }
    setSearchResults([]);
    setSearchQuery(result.address);
    if (onAddressSelected) {
      onAddressSelected(result);
    }
  };

  // Récupérer ma position GPS actuelle (Triple fallback : Haute précision -> Réseau/WiFi -> IP)
  const handleLocateMe = async () => {
    setIsLocating(true);
    setGpsStatus('Recherche position GPS / réseau...');
    try {
      const loc = await getPreciseUserLocation();
      const pt: LatLngPoint = { lat: loc.lat, lng: loc.lng };
      const map = mapInstanceRef.current;
      if (map) {
        map.setView([pt.lat, pt.lng], 17, { animate: true });

        if (userGpsLayerGroupRef.current) {
          userGpsLayerGroupRef.current.clearLayers();
          const halo = L.circle([pt.lat, pt.lng], {
            radius: Math.max(loc.accuracy || 20, 25),
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.18,
            weight: 1.5,
          });
          const dot = L.circleMarker([pt.lat, pt.lng], {
            radius: 8,
            color: '#ffffff',
            fillColor: '#2563eb',
            fillOpacity: 1,
            weight: 3,
          }).bindTooltip('Votre position actuelle', { permanent: false });
          userGpsLayerGroupRef.current.addLayer(halo);
          userGpsLayerGroupRef.current.addLayer(dot);
        }
      }

      // Si le mode de placement de marqueur est actif, on place automatiquement le marqueur
      if (allowMarkerPlacement && onMarkerChange) {
        let geocode: GeocodeResult | null = null;
        try {
          geocode = await reverseGeocodeWithNominatim(pt.lat, pt.lng);
        } catch {}
        onMarkerChange(pt, geocode);
      }

      setGpsStatus(
        loc.source === 'GPS_HIGH_ACCURACY'
          ? 'Position GPS satellite acquise (± ' + loc.accuracy + ' m)'
          : 'Position réseau / IP acquise',
      );
      setTimeout(() => setGpsStatus(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de géolocalisation';
      setGpsStatus('Erreur : ' + msg);
      setTimeout(() => setGpsStatus(null), 4000);
    } finally {
      setIsLocating(false);
    }
  };

  // Contrôles du tracé de polygone
  const handleUndoPoint = () => {
    setDrawingPoints((prev) => {
      const next = prev.slice(0, -1);
      if (onBoundaryChange) {
        onBoundaryChange(next.length >= 3 ? toGeoJsonPolygon(next) : null);
      }
      return next;
    });
  };

  const handleClearDraw = () => {
    setDrawingPoints([]);
    if (onBoundaryChange) onBoundaryChange(null);
  };

  const handleValidateDraw = () => {
    if (drawingPoints.length < 3) return;
    const boundary = toGeoJsonPolygon(drawingPoints);
    if (onBoundaryValidate) onBoundaryValidate(boundary);
    if (onBoundaryChange) onBoundaryChange(boundary);
  };

  const currentAreaM2 = useMemo(() => {
    if (drawingPoints.length < 3) return 0;
    return Math.round(computePolygonAreaM2(toGeoJsonPolygon(drawingPoints)));
  }, [drawingPoints]);

  return (
    <div
      className={`flex flex-col w-full gap-2.5 transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] bg-background p-4 h-screen w-screen'
          : ''
      }`}
    >
      {/* 1. PANNEAU DE CONTRÔLES HORS DE LA CARTE (Titre / Positionnement mondial, styles satellite, recherche & tracé) */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Titre & Positionnement mondial */}
          {title && (
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <MapPin className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground leading-tight">{title}</p>
                {subtitle && <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>}
              </div>
            </div>
          )}

          {/* Sélecteur de style de tuiles (Plan Rues / Satellite HD / Hybride / Nuit) */}
          <div className="flex rounded-xl border border-border bg-muted/40 p-0.5 shadow-xs">
            <button
              type="button"
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                activeTileId === 'osm'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTileId('osm')}
            >
              Plan Rues
            </button>
            <button
              type="button"
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                activeTileId === 'satellite'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTileId('satellite')}
            >
              Satellite HD
            </button>
            <button
              type="button"
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                activeTileId === 'hybrid'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTileId('hybrid')}
            >
              Hybride
            </button>
            <button
              type="button"
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                activeTileId === 'dark'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTileId('dark')}
            >
              Nuit
            </button>
          </div>

          {/* Barre de recherche mondiale d'adresses (Nominatim OSM — sans balise form imbriquée) */}
          <div className="relative min-w-[240px] max-w-sm flex-1">
            <div className="flex items-center gap-1.5">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Rechercher ville, quartier, pays..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSearch();
                    }
                  }}
                  className="h-8 rounded-xl pl-8 pr-3 text-xs bg-background border-input text-foreground"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 px-2.5 text-xs font-semibold shrink-0"
                disabled={isSearching}
                onClick={() => void handleSearch()}
              >
                {isSearching ? '...' : 'Chercher'}
              </Button>
            </div>

            {/* Suggestions de recherche */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-10 z-[1200] max-h-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left rounded-lg p-2 text-xs hover:bg-accent transition text-foreground"
                    onClick={() => handleSelectSearchResult(res)}
                  >
                    <p className="font-semibold line-clamp-1">{res.address}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {[res.neighborhood, res.city, res.country].filter(Boolean).join(' • ')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contrôles de dessin de polygone (placés hors de la carte) */}
        {allowPolygonDraw && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <PenTool className="size-3.5 text-primary" />
              <span>{drawingPoints.length} point{drawingPoints.length > 1 ? 's' : ''} tracé{drawingPoints.length > 1 ? 's' : ''}</span>
              {currentAreaM2 > 0 && (
                <span className="text-muted-foreground font-normal">
                  ({currentAreaM2 >= 10000 ? `${(currentAreaM2 / 10000).toFixed(2)} ha` : `${currentAreaM2.toLocaleString('fr-FR')} m²`})
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                onClick={handleUndoPoint}
                disabled={drawingPoints.length === 0}
              >
                <Undo2 className="size-3 mr-1" />
                Annuler point
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                onClick={handleClearDraw}
                disabled={drawingPoints.length === 0}
              >
                <Trash2 className="size-3 mr-1" />
                Effacer tracé
              </Button>

              {onBoundaryValidate && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleValidateDraw}
                  disabled={drawingPoints.length < 3}
                >
                  <CheckCircle2 className="size-3 mr-1" />
                  Valider le contour
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Messages d'état GPS et de validation géométrique (hors de la carte) */}
        {gpsStatus && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-2 text-xs text-primary flex items-center gap-2">
            <LocateFixed className="size-4 shrink-0 text-primary animate-pulse" />
            <span className="font-semibold">{gpsStatus}</span>
          </div>
        )}

        {validationError && !gpsStatus && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {validationSuccess && !validationError && !gpsStatus && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{validationSuccess}</span>
          </div>
        )}
      </div>

      {/* 2. CONTENEUR CARTE LEAFLET - TOTALEMENT DÉGAGÉ, PROPRE ET ULTRA-LISIBLE */}
      <div
        className={`relative isolate w-full overflow-hidden rounded-2xl border border-border bg-slate-900 shadow-sm transition-all duration-300 ${
          isFullscreen ? 'flex-1 h-full' : heightClassName
        }`}
      >
        {/* HUD de Navigation GPS en temps réel (uniquement lors du guidage actif) */}
        {navState && navState.isNavigating && (
          <GpsNavigationHUD
            state={navState}
            destinationName={navDestinationName}
            isVoiceMuted={isVoiceMuted}
            onToggleVoice={() => {
              const muted = voiceNavigator.toggleMute();
              setIsVoiceMuted(muted);
            }}
            onRecenter={() => {
              if (navState.currentPosition && mapInstanceRef.current) {
                mapInstanceRef.current.setView(
                  [navState.currentPosition.lat, navState.currentPosition.lng],
                  17,
                  { animate: true },
                );
              }
            }}
            onStopNavigation={stopGpsNavigation}
            onModeChange={(mode) => {
              setNavTransportMode(mode);
              if (navTrackerRef.current) {
                void navTrackerRef.current.setTransportMode(mode);
              }
            }}
            currentMode={navTransportMode}
          />
        )}

        {/* Boutons d'actions minimalistes en bas à droite (Zoom, Ma Position, Plein Écran) */}
        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-1.5 pointer-events-auto">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="size-9 p-0 rounded-xl border border-border/80 bg-background/95 shadow-md backdrop-blur flex items-center justify-center hover:bg-accent"
            onClick={handleLocateMe}
            disabled={isLocating}
            title="Ma position GPS actuelle (Haute précision & réseau)"
          >
            <LocateFixed className={`size-4 text-primary ${isLocating ? 'animate-spin' : ''}`} />
          </Button>

          <div className="flex flex-col rounded-xl border border-border/80 bg-background/95 shadow-md backdrop-blur overflow-hidden">
            <button
              type="button"
              className="flex size-8 items-center justify-center text-foreground hover:bg-muted transition"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              title="Zoom avant"
            >
              <ZoomIn className="size-4" />
            </button>
            <div className="h-px bg-border/60" />
            <button
              type="button"
              className="flex size-8 items-center justify-center text-foreground hover:bg-muted transition"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              title="Zoom arrière"
            >
              <ZoomOut className="size-4" />
            </button>
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="size-9 p-0 rounded-xl border border-border/80 bg-background/95 shadow-md backdrop-blur flex items-center justify-center hover:bg-accent"
            onClick={() => {
              setIsFullscreen((prev) => !prev);
              setTimeout(() => mapInstanceRef.current?.invalidateSize(), 300);
            }}
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>

        {/* Légende discrète en bas à gauche */}
        {legendItems && legendItems.length > 0 && (
          <div className="absolute bottom-4 left-4 z-[990] hidden sm:flex items-center gap-3 rounded-xl border border-border/80 bg-background/95 px-3 py-1.5 text-[11px] shadow-md backdrop-blur pointer-events-none">
            {legendItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Canvas DOM Leaflet */}
        <div ref={mapContainerRef} className="h-full w-full bg-slate-900" />
      </div>
    </div>
  );
}
