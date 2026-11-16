import {
  computeBearing,
  computeDistanceMeters,
  isOffRoute,
  type LatLngPoint,
} from '@rentflow/shared';
import { calculateRoute, type RouteResult, type RouteStep, type TransportMode } from './routing-engine';
import { VoiceNavigator } from './voice-navigator';

export interface GpsNavigationState {
  currentPosition: LatLngPoint | null;
  heading: number | null; // Cap d'orientation en degrés
  speedKmh: number | null; // Vitesse en km/h
  accuracyMeters: number | null; // Précision GPS
  isNavigating: boolean;
  isRecalculating: boolean;
  hasArrived: boolean;
  route: RouteResult | null;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  nextStep: RouteStep | null;
  distanceToNextStepMeters: number;
  offRouteCount: number;
  eta: string; // Heure estimée d'arrivée (ex: 14:35)
  errorMessage: string | null;
}

export interface NavigationTrackerOptions {
  destination: LatLngPoint;
  destinationName: string;
  initialMode?: TransportMode;
  voiceNavigator: VoiceNavigator;
  onStateUpdate: (state: GpsNavigationState) => void;
  onArrived?: () => void;
  onRecalculate?: (newRoute: RouteResult) => void;
  customServerUrl?: string;
}

/**
 * Gestionnaire autonome de navigation GPS Turn-by-Turn en direct.
 */
export class GpsNavigationTracker {
  private watchId: number | null = null;
  private options: NavigationTrackerOptions;
  private currentMode: TransportMode;
  private state: GpsNavigationState;
  private lastAnnouncedStepIndex = -1;
  private lastOffRouteCheckTime = 0;
  private lastPosition: LatLngPoint | null = null;

  constructor(options: NavigationTrackerOptions) {
    this.options = options;
    this.currentMode = options.initialMode || 'driving';
    this.state = {
      currentPosition: null,
      heading: null,
      speedKmh: null,
      accuracyMeters: null,
      isNavigating: false,
      isRecalculating: false,
      hasArrived: false,
      route: null,
      remainingDistanceMeters: 0,
      remainingDurationSeconds: 0,
      nextStep: null,
      distanceToNextStepMeters: 0,
      offRouteCount: 0,
      eta: '--:--',
      errorMessage: null,
    };
  }

  public async start(): Promise<void> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.updateState({
        errorMessage: 'La géolocalisation GPS n’est pas supportée par votre navigateur.',
      });
      return;
    }

    this.updateState({ isNavigating: true, errorMessage: null });

    // 1. Obtenir la position immédiate pour calculer le trajet initial
    try {
      const initialPos = await this.getCurrentPositionAsync();
      this.lastPosition = initialPos;
      await this.initRoute(initialPos);
    } catch (err: any) {
      this.updateState({
        errorMessage:
          err.message || 'Impossible d’accéder à votre position GPS. Veuillez vérifier les autorisations.',
      });
    }

    // 2. Démarrer le suivi en temps réel continu
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePositionUpdate(pos),
      (err) => {
        let msg = 'Erreur GPS';
        if (err.code === err.PERMISSION_DENIED) msg = 'Autorisation GPS refusée';
        else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Signal GPS temporairement indisponible';
        else if (err.code === err.TIMEOUT) msg = 'Délai d’attente GPS dépassé';
        this.updateState({ errorMessage: msg });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      },
    );
  }

  private getCurrentPositionAsync(): Promise<LatLngPoint> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 },
      );
    });
  }

  private async initRoute(from: LatLngPoint): Promise<void> {
    this.updateState({ isRecalculating: true });
    try {
      const route = await calculateRoute(
        from,
        this.options.destination,
        this.currentMode,
        this.options.customServerUrl,
      );

      const nextStep = route.steps[0] || null;
      const distToNext = nextStep ? computeDistanceMeters(from, nextStep.location) : 0;
      const eta = this.computeEtaString(route.durationSeconds);

      this.updateState({
        route,
        isRecalculating: false,
        remainingDistanceMeters: route.distanceMeters,
        remainingDurationSeconds: route.durationSeconds,
        nextStep,
        distanceToNextStepMeters: distToNext,
        eta,
      });

      // Annonce vocale de départ
      const firstInstruction = nextStep?.instruction || `En route vers ${this.options.destinationName}`;
      this.options.voiceNavigator.speak(firstInstruction, true);
      this.lastAnnouncedStepIndex = 0;
    } catch (err: any) {
      this.updateState({
        isRecalculating: false,
        errorMessage: err.message || 'Impossible de calculer l’itinéraire',
      });
    }
  }

  private handlePositionUpdate(geoPos: GeolocationPosition): void {
    const lat = geoPos.coords.latitude;
    const lng = geoPos.coords.longitude;
    const current: LatLngPoint = { lat, lng };

    // Calcul du cap (soit fourni par l'accéléromètre/GPS, soit déduit du déplacement précédent)
    let heading = geoPos.coords.heading;
    if (heading === null || isNaN(heading)) {
      if (this.lastPosition && computeDistanceMeters(this.lastPosition, current) > 3) {
        heading = computeBearing(this.lastPosition, current);
      }
    }

    const speedKmh =
      geoPos.coords.speed !== null && !isNaN(geoPos.coords.speed)
        ? Math.round(geoPos.coords.speed * 3.6)
        : null;

    this.lastPosition = current;

    // Vérifier l'arrivée à destination (< 30m)
    const distanceToDest = computeDistanceMeters(current, this.options.destination);
    if (distanceToDest <= 30 && !this.state.hasArrived) {
      this.updateState({
        currentPosition: current,
        heading,
        speedKmh,
        accuracyMeters: geoPos.coords.accuracy,
        hasArrived: true,
        remainingDistanceMeters: 0,
        remainingDurationSeconds: 0,
      });
      this.options.voiceNavigator.speak('Vous êtes arrivé à votre propriété DOMORA !', true);
      if (this.options.onArrived) this.options.onArrived();
      return;
    }

    if (!this.state.route || this.state.hasArrived) {
      this.updateState({
        currentPosition: current,
        heading,
        speedKmh,
        accuracyMeters: geoPos.coords.accuracy,
      });
      return;
    }

    // 1. Détection de sortie d'itinéraire (Off-route)
    const now = Date.now();
    if (now - this.lastOffRouteCheckTime > 3000 && !this.state.isRecalculating) {
      this.lastOffRouteCheckTime = now;
      const offRoute = isOffRoute(current, this.state.route.coordinates, 45);

      if (offRoute) {
        const offCount = this.state.offRouteCount + 1;
        this.updateState({ offRouteCount: offCount });

        // Si confirmé 2 fois de suite (> ~6s) pour éviter les sauts GPS
        if (offCount >= 2) {
          this.options.voiceNavigator.speak('Vous avez quitté votre itinéraire, recalcul en cours...', true);
          void this.recalculate(current);
          return;
        }
      } else {
        if (this.state.offRouteCount > 0) {
          this.updateState({ offRouteCount: 0 });
        }
      }
    }

    // 2. Prochaine étape et guidage vocal dynamique
    this.updateProgressAndGuidance(current, distanceToDest);

    this.updateState({
      currentPosition: current,
      heading,
      speedKmh,
      accuracyMeters: geoPos.coords.accuracy,
    });
  }

  private updateProgressAndGuidance(current: LatLngPoint, distanceToDest: number): void {
    if (!this.state.route) return;

    const steps = this.state.route.steps;
    if (steps.length === 0) return;

    // Trouver l'étape la plus proche devant nous
    let closestStepIdx = 0;
    let minStepDist = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const d = computeDistanceMeters(current, step.location);
      if (d < minStepDist) {
        minStepDist = d;
        closestStepIdx = i;
      }
    }

    // L'étape suivante à franchir
    const nextStep = steps[closestStepIdx] || steps[0]!;
    const distToNext = computeDistanceMeters(current, nextStep.location);

    // Calcul de la distance restante le long du tracé
    const remainingDistance = Math.max(0, distanceToDest);
    // Estimation du temps restant basé sur la vitesse ou durée proportionnelle
    const progressRatio = Math.max(0, Math.min(1, 1 - remainingDistance / (this.state.route.distanceMeters || 1)));
    const remainingSeconds = Math.max(0, Math.round(this.state.route.durationSeconds * (1 - progressRatio)));
    const eta = this.computeEtaString(remainingSeconds);

    // Guidage vocal selon la distance de la prochaine manœuvre
    if (closestStepIdx !== this.lastAnnouncedStepIndex) {
      if (distToNext <= 200 && distToNext > 30) {
        const roundedDist = Math.round(distToNext / 10) * 10;
        this.options.voiceNavigator.speak(`Dans ${roundedDist} mètres, ${nextStep.instruction}`);
        this.lastAnnouncedStepIndex = closestStepIdx;
      } else if (distToNext <= 30) {
        this.options.voiceNavigator.speak(nextStep.instruction);
        this.lastAnnouncedStepIndex = closestStepIdx;
      }
    }

    this.updateState({
      nextStep,
      distanceToNextStepMeters: Math.round(distToNext),
      remainingDistanceMeters: Math.round(remainingDistance),
      remainingDurationSeconds: remainingSeconds,
      eta,
    });
  }

  private async recalculate(from: LatLngPoint): Promise<void> {
    this.updateState({ isRecalculating: true });
    try {
      const newRoute = await calculateRoute(
        from,
        this.options.destination,
        this.currentMode,
        this.options.customServerUrl,
      );

      const nextStep = newRoute.steps[0] || null;
      const distToNext = nextStep ? computeDistanceMeters(from, nextStep.location) : 0;
      const eta = this.computeEtaString(newRoute.durationSeconds);

      this.updateState({
        route: newRoute,
        isRecalculating: false,
        offRouteCount: 0,
        remainingDistanceMeters: newRoute.distanceMeters,
        remainingDurationSeconds: newRoute.durationSeconds,
        nextStep,
        distanceToNextStepMeters: distToNext,
        eta,
      });

      if (this.options.onRecalculate) {
        this.options.onRecalculate(newRoute);
      }

      if (nextStep) {
        this.options.voiceNavigator.speak(`Nouvel itinéraire calculé. ${nextStep.instruction}`, true);
      }
    } catch {
      this.updateState({ isRecalculating: false });
    }
  }

  public async setTransportMode(mode: TransportMode): Promise<void> {
    this.currentMode = mode;
    if (this.state.currentPosition) {
      await this.recalculate(this.state.currentPosition);
    }
  }

  private computeEtaString(secondsRemaining: number): string {
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + secondsRemaining * 1000);
    const hours = String(arrivalDate.getHours()).padStart(2, '0');
    const mins = String(arrivalDate.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  }

  private updateState(partial: Partial<GpsNavigationState>): void {
    this.state = { ...this.state, ...partial };
    this.options.onStateUpdate(this.state);
  }

  public stop(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.options.voiceNavigator.stop();
    this.updateState({ isNavigating: false });
  }
}
