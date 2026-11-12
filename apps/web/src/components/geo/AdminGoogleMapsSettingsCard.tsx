import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Eye, EyeOff, KeyRound, Map, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/api-client';
import {
  loadGoogleMapsSdk,
  resetGoogleMapsLoader,
  saveGoogleMapsBrowserKey,
} from '../../lib/geo/google-maps-loader';
import { Button } from '../ui/button';
import { Card, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';

export interface AdminGeoSettingsResponse {
  googleMapsBrowserApiKey: string;
  browserKeyConfiguredInDb?: boolean;
  hasServerKey: boolean;
  serverKeyConfiguredInDb?: boolean;
  serverKeyMasked?: string;
  hasEnvBrowserKey?: boolean;
  hasEnvServerKey?: boolean;
  updatedAt?: string | null;
}

interface AdminGoogleMapsSettingsCardProps {
  /** Endpoint API utilisé (ex: `/platform/geo-settings` ou `/orgs/:orgId/quartier/geo/settings`) */
  endpoint: string;
}

export function AdminGoogleMapsSettingsCard({ endpoint }: AdminGoogleMapsSettingsCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [browserKey, setBrowserKey] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [showBrowserKey, setShowBrowserKey] = useState(false);
  const [showServerKey, setShowServerKey] = useState(false);
  const [testingMap, setTestingMap] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-geo-settings', endpoint],
    queryFn: () => apiRequest<AdminGeoSettingsResponse>(endpoint),
    retry: false,
  });

  useEffect(() => {
    if (data?.googleMapsBrowserApiKey !== undefined) {
      setBrowserKey(data.googleMapsBrowserApiKey);
    }
  }, [data?.googleMapsBrowserApiKey]);

  const saveMutation = useMutation({
    mutationFn: (payload: { googleMapsBrowserApiKey?: string; googleMapsServerApiKey?: string }) =>
      apiRequest<AdminGeoSettingsResponse>(endpoint, {
        method: 'PUT',
        body: payload,
      }),
    onSuccess: (res) => {
      saveGoogleMapsBrowserKey(res.googleMapsBrowserApiKey ?? '');
      resetGoogleMapsLoader();
      setServerKey('');
      setTestResult(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-geo-settings'] });
      toast({
        title: 'Clés Google Maps enregistrées',
        description:
          'La configuration est désormais active en base de données pour tous les utilisateurs.',
        variant: 'success',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Enregistrement impossible',
        description: err.message,
        variant: 'error',
      });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: { googleMapsBrowserApiKey?: string; googleMapsServerApiKey?: string } = {
      googleMapsBrowserApiKey: browserKey.trim(),
    };
    if (serverKey.trim()) {
      payload.googleMapsServerApiKey = serverKey.trim();
    }
    saveMutation.mutate(payload);
  };

  const handleClearServerKey = () => {
    saveMutation.mutate({ googleMapsServerApiKey: '' });
  };

  const handleTestGoogleMaps = async () => {
    setTestingMap(true);
    setTestResult(null);
    try {
      if (browserKey.trim()) {
        saveGoogleMapsBrowserKey(browserKey.trim());
      }
      resetGoogleMapsLoader();
      const state = await loadGoogleMapsSdk();
      if (state.status === 'READY') {
        setTestResult({
          ok: true,
          message: 'Connexion Google Maps Platform validée (Maps JS, Places & Geocoding prêts).',
        });
      } else {
        setTestResult({
          ok: false,
          message: state.errorMessage ?? `Échec d'initialisation (${state.status}).`,
        });
      }
    } finally {
      setTestingMap(false);
    }
  };

  return (
    <Card className="p-5 space-y-5 border-primary/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Map className="h-4 w-4 text-primary" />
            Configuration Google Maps Platform (API Cartographie)
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Enregistrez vos clés Google Maps directement depuis le dashboard administrateur. Elles
            sont stockées en base de données et appliquées immédiatement aux cartes Quartiers, Blocs,
            Propriétés et Carte globale.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
              data?.googleMapsBrowserApiKey
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
            }`}
          >
            <KeyRound className="h-3 w-3" />
            {data?.googleMapsBrowserApiKey ? 'Clé Frontend active' : 'Clé Frontend manquante'}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
              data?.hasServerKey
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <ShieldCheck className="h-3 w-3" />
            {data?.hasServerKey ? 'Clé Serveur configurée' : 'Clé Serveur optionnelle'}
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Impossible de charger la configuration Google Maps ({(error as Error).message}).
        </p>
      ) : null}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Clé API Google Maps Frontend (Navigateur)
            </label>
            <div className="flex gap-1.5">
              <Input
                type={showBrowserKey ? 'text' : 'password'}
                value={browserKey}
                onChange={(e) => setBrowserKey(e.target.value)}
                placeholder={isLoading ? 'Chargement...' : 'AIzaSy... (Maps JS + Places + Geocoding)'}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowBrowserKey((v) => !v)}
                aria-label="Afficher ou masquer la clé frontend"
              >
                {showBrowserKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Utilisée par le navigateur pour la carte satellite/hybride, le tracé des polygones et
              la recherche d’adresses. Restreignez-la par <strong>HTTP Referrer</strong> dans Google
              Cloud Console.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Clé API Google Maps Serveur (Optionnelle)
            </label>
            <div className="flex gap-1.5">
              <Input
                type={showServerKey ? 'text' : 'password'}
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
                placeholder={
                  data?.serverKeyMasked
                    ? `Actuelle : ${data.serverKeyMasked} (laisser vide pour conserver)`
                    : 'AIzaSy... (strictement privée côté serveur)'
                }
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowServerKey((v) => !v)}
                aria-label="Afficher ou masquer la clé serveur"
              >
                {showServerKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              {data?.serverKeyConfiguredInDb ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearServerKey}
                  disabled={saveMutation.isPending}
                  title="Supprimer la clé serveur enregistrée en base"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Jamais exposée au frontend. Laissez vide pour conserver la clé existante.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">
            APIs à activer sur Google Cloud Console :
          </p>
          <p>
            1. <strong>Maps JavaScript API</strong> · 2. <strong>Places API</strong> · 3.{' '}
            <strong>Geocoding API</strong>
          </p>
        </div>

        {testResult ? (
          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
              testResult.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{testResult.message}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer les clés API'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTestGoogleMaps}
            disabled={testingMap || !browserKey.trim()}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${testingMap ? 'animate-spin' : ''}`} />
            Tester le chargement Google Maps
          </Button>
        </div>
      </form>
    </Card>
  );
}
