import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Bike,
  Car,
  Compass,
  Footprints,
  LocateFixed,
  Volume2,
  VolumeX,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { GpsNavigationState } from '../../lib/geo/gps-navigation-tracker';
import type { TransportMode } from '../../lib/geo/routing-engine';
import { Button } from '../ui/button';

export interface GpsNavigationHUDProps {
  state: GpsNavigationState;
  destinationName: string;
  isVoiceMuted: boolean;
  onToggleVoice: () => void;
  onRecenter: () => void;
  onStopNavigation: () => void;
  onModeChange: (mode: TransportMode) => void;
  currentMode: TransportMode;
}

function getManeuverIcon(maneuverType: string, modifier?: string) {
  if (maneuverType === 'arrive') return <ArrowDown className="size-6 text-emerald-400" />;
  if (modifier === 'left' || modifier === 'sharp left') return <ArrowLeft className="size-6 text-emerald-400" />;
  if (modifier === 'right' || modifier === 'sharp right') return <ArrowRight className="size-6 text-emerald-400" />;
  if (modifier === 'slight left') return <ArrowUpLeft className="size-6 text-emerald-400" />;
  if (modifier === 'slight right') return <ArrowUpRight className="size-6 text-emerald-400" />;
  if (modifier === 'uturn') return <ArrowDown className="size-6 text-emerald-400" />;
  return <ArrowUp className="size-6 text-emerald-400" />;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours} h ${remMins > 0 ? `${remMins} min` : ''}`;
}

export function GpsNavigationHUD({
  state,
  destinationName,
  isVoiceMuted,
  onToggleVoice,
  onRecenter,
  onStopNavigation,
  onModeChange,
  currentMode,
}: GpsNavigationHUDProps) {
  const nextStep = state.nextStep;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col justify-between p-3 sm:p-4">
      {/* 1. Bandeau supérieur : Prochaine Manœuvre Turn-by-Turn */}
      <div className="pointer-events-auto mx-auto w-full max-w-lg animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/95 p-3.5 text-white shadow-2xl backdrop-blur-md">
          {state.isRecalculating ? (
            <div className="flex items-center gap-3">
              <RefreshCw className="size-6 animate-spin text-amber-400" />
              <div>
                <p className="text-sm font-bold text-amber-400">Recalcul de l'itinéraire en cours...</p>
                <p className="text-xs text-slate-300">Vous avez quitté votre parcours, recherche du chemin optimal.</p>
              </div>
            </div>
          ) : state.hasArrived ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-black text-emerald-400">Arrivé à destination !</p>
                <p className="text-xs text-slate-300">{destinationName}</p>
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 font-bold hover:bg-emerald-500"
                onClick={onStopNavigation}
              >
                Terminer
              </Button>
            </div>
          ) : nextStep ? (
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40">
                {getManeuverIcon(nextStep.maneuverType, nextStep.modifier)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xl font-black text-emerald-400">
                    {formatDistance(state.distanceToNextStepMeters)}
                  </span>
                  <span className="text-xs text-slate-400">puis</span>
                </div>
                <p className="truncate text-sm font-bold text-white">
                  {nextStep.instruction}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Compass className="size-5 text-emerald-400" />
              <p className="text-sm font-semibold">Suivi GPS actif vers {destinationName}</p>
            </div>
          )}

          {state.errorMessage && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-2 py-1 text-xs text-rose-300 border border-rose-500/30">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{state.errorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Boutons d'actions rapides latéraux (Son / Recentrage / Quitter) */}
      <div className="pointer-events-auto flex justify-end gap-2 pr-1">
        <Button
          size="sm"
          variant="secondary"
          className="size-11 p-0 rounded-full border border-border/80 bg-background/90 shadow-lg backdrop-blur hover:bg-background"
          onClick={onToggleVoice}
          title={isVoiceMuted ? 'Activer la voix' : 'Couper le guidage vocal'}
        >
          {isVoiceMuted ? (
            <VolumeX className="size-5 text-slate-400" />
          ) : (
            <Volume2 className="size-5 text-emerald-500" />
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="size-11 p-0 rounded-full border border-border/80 bg-background/90 shadow-lg backdrop-blur hover:bg-background"
          onClick={onRecenter}
          title="Recentrer sur ma position"
        >
          <LocateFixed className="size-5 text-primary" />
        </Button>
      </div>

      {/* 3. Bandeau inférieur : ETA, Distance restante, Vitesse, Modes, Arrêt */}
      <div className="pointer-events-auto mx-auto w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatDuration(state.remainingDurationSeconds)}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  ({formatDistance(state.remainingDistanceMeters)})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Arrivée estimée : <strong className="font-mono text-foreground">{state.eta}</strong>
                {state.speedKmh !== null && (
                  <span> • {state.speedKmh} km/h</span>
                )}
              </p>
            </div>

            <Button
              size="sm"
              variant="danger"
              className="gap-1.5 rounded-xl font-bold text-xs h-9 px-3"
              onClick={onStopNavigation}
            >
              <X className="size-4" />
              <span>Quitter</span>
            </Button>
          </div>

          {/* Sélecteur de mode de transport */}
          <div className="mt-2.5 flex items-center justify-between gap-1 text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground">Mode :</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={currentMode === 'driving' ? 'default' : 'ghost'}
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => onModeChange('driving')}
              >
                <Car className="size-3.5" />
                <span>Voiture</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={currentMode === 'walking' ? 'default' : 'ghost'}
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => onModeChange('walking')}
              >
                <Footprints className="size-3.5" />
                <span>À pied</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={currentMode === 'cycling' ? 'default' : 'ghost'}
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => onModeChange('cycling')}
              >
                <Bike className="size-3.5" />
                <span>Vélo</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
