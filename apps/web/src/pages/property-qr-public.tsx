import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Download,
  Home,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  User,
} from 'lucide-react';
import { apiRequest } from '../lib/api-client';
import { getLocalProperties, getLocalUnits } from './properties';
import { Button } from '../components/ui/button';

interface PublicPropertyPayload {
  property: {
    _id: string;
    geoUniqueId: string;
    name: string;
    type?: string | undefined;
    customPropertyType?: string | undefined;
    address: string;
    city: string;
    zone?: string | undefined;
    country?: string | undefined;
    status?: string | undefined;
    description?: string | undefined;
    region?: string | undefined;
    department?: string | undefined;
    arrondissement?: string | undefined;
    neighborhoodName?: string | undefined;
    sectorName?: string | undefined;
    neighborhoodLeaderName?: string | undefined;
    blockLeaderName?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    chambreSimpleCount?: number | undefined;
    chambreModerneCount?: number | undefined;
    studioSimpleCount?: number | undefined;
    studioModerneCount?: number | undefined;
    appartementCount?: number | undefined;
    otherCustomType?: string | undefined;
    otherCustomCount?: number | undefined;
    roomsCount?: number | undefined;
    studiosCount?: number | undefined;
    apartmentsCount?: number | undefined;
    otherUnitsCount?: number | undefined;
    createdAt?: string | undefined;
  };
  owner: {
    name: string;
    phone?: string | undefined;
    email?: string | undefined;
    address?: string | undefined;
    organizationName?: string | undefined;
    geoOwnerCode?: string | undefined;
    manager?: string | undefined;
  };
  units: Array<{
    _id: string;
    name: string;
    number?: string | undefined;
    type: string;
    status: string;
    rentAmountMinor?: number | undefined;
    surfaceM2?: number | undefined;
  }>;
}

export function PropertyQrPublicPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<PublicPropertyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!code) {
        setError('Code matricule manquant.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<PublicPropertyPayload>(
          `/properties/public/${encodeURIComponent(code)}`,
        );
        if (active) setData(res);
      } catch {
        // Fallback local (propriétés locales de démonstration)
        const localProps = getLocalProperties();
        const found = localProps.find(
          (p) =>
            p.geoUniqueId?.toUpperCase() === code.toUpperCase() ||
            p._id === code,
        );
        if (found && active) {
          const units = getLocalUnits()
            .filter((u) => u.propertyId === found._id)
            .map((u) => ({
              _id: u._id,
              name: u.name,
              number: u.number,
              type: u.type,
              status: u.status,
              rentAmountMinor: u.rentAmountMinor,
              surfaceM2: u.surfaceM2,
            }));
          setData({
            property: {
              _id: found._id,
              geoUniqueId: found.geoUniqueId || found._id,
              name: found.name,
              type: found.type,
              address: found.address,
              city: found.city,
              zone: found.zone,
              country: found.country,
              status: found.status,
              description: found.description,
              neighborhoodName: found.neighborhoodName,
              sectorName: found.sectorName,
              neighborhoodLeaderName: found.neighborhoodLeaderName,
              blockLeaderName: found.blockLeaderName,
              latitude: found.latitude,
              longitude: found.longitude,
              chambreSimpleCount: found.chambreSimpleCount,
              chambreModerneCount: found.chambreModerneCount,
              studioSimpleCount: found.studioSimpleCount,
              studioModerneCount: found.studioModerneCount,
              appartementCount: found.appartementCount,
              otherCustomType: found.otherCustomType,
              otherCustomCount: found.otherCustomCount,
            },
            owner: {
              name: found.owner || 'Propriétaire enregistré',
              manager: found.manager,
            },
            units,
          });
        } else if (active) {
          setError('Aucune propriété trouvée pour ce matricule ou code QR.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [code]);

  const handleDownloadFiche = () => {
    if (!data) return;
    const { property, owner, units } = data;
    const lines = [
      'FICHE OFFICIELLE D’IDENTIFICATION IMMOBILIÈRE — DOMORA / KatdEstate',
      '====================================================================',
      `Matricule unique : ${property.geoUniqueId}`,
      `Nom du bien : ${property.name}`,
      `Type : ${property.customPropertyType || property.type || 'Bien immobilier'}`,
      `Statut : ${property.status || 'ACTIVE'}`,
      `Adresse : ${property.address}`,
      `Ville : ${property.city}${property.zone ? ` (${property.zone})` : ''}`,
      property.neighborhoodName ? `Quartier : ${property.neighborhoodName}` : '',
      property.sectorName ? `Bloc / Secteur : ${property.sectorName}` : '',
      property.latitude !== undefined && property.longitude !== undefined
        ? `GPS : ${property.latitude}, ${property.longitude}`
        : '',
      '',
      'INFORMATIONS DU PROPRIÉTAIRE',
      '----------------------------',
      `Nom complet : ${owner.name}`,
      owner.organizationName ? `Organisation : ${owner.organizationName}` : '',
      owner.phone ? `Téléphone : ${owner.phone}` : '',
      owner.email ? `Email : ${owner.email}` : '',
      owner.address ? `Adresse propriétaire : ${owner.address}` : '',
      owner.manager ? `Gestionnaire : ${owner.manager}` : '',
      '',
      `UNITÉS ENREGISTRÉES (${units.length})`,
      '----------------------------',
      ...units.map(
        (u) =>
          `- ${u.name}${u.number ? ` (#${u.number})` : ''} · ${u.type} · ${u.status}${u.rentAmountMinor ? ` · ${u.rentAmountMinor.toLocaleString('fr-FR')} FCFA` : ''}`,
      ),
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fiche-propriete-${property.geoUniqueId}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3 max-w-md w-full">
          <QrCode className="size-10 text-primary mx-auto animate-pulse" />
          <p className="text-sm font-medium text-foreground">
            Vérification du matricule en cours…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4 max-w-md w-full">
          <QrCode className="size-10 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Propriété introuvable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link to="/">
            <Button variant="secondary">Retour à l’accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { property, owner, units } = data;

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-3.5" />
                Propriété vérifiée DOMORA / KatdEstate
              </div>
              <h1 className="text-2xl font-bold text-foreground pt-1">{property.name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="size-4 text-primary shrink-0" />
                {property.address}, {property.city}
                {property.zone ? ` (${property.zone})` : ''}
              </p>
            </div>
            <div className="text-right space-y-2">
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-sm font-bold text-primary">
                {property.geoUniqueId}
              </div>
              <div>
                <Button size="sm" variant="secondary" onClick={handleDownloadFiche}>
                  <Download className="mr-1.5 size-3.5" />
                  Télécharger la fiche
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="size-4 text-primary" />
              Informations du Propriétaire
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Nom complet</span>
                <span className="font-semibold text-foreground">{owner.name}</span>
              </div>
              {owner.organizationName && (
                <div>
                  <span className="text-xs text-muted-foreground block">Structure / Agence</span>
                  <span className="text-foreground">{owner.organizationName}</span>
                </div>
              )}
              {owner.phone && (
                <div className="flex items-center gap-2 text-foreground">
                  <Phone className="size-3.5 text-primary" />
                  <span>{owner.phone}</span>
                </div>
              )}
              {owner.email && (
                <div className="flex items-center gap-2 text-foreground">
                  <Mail className="size-3.5 text-primary" />
                  <span>{owner.email}</span>
                </div>
              )}
              {owner.manager && (
                <div>
                  <span className="text-xs text-muted-foreground block">Gestionnaire</span>
                  <span className="text-foreground">{owner.manager}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="size-4 text-primary" />
              Détails de la Propriété
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Type</span>
                <span className="font-medium text-foreground">
                  {property.customPropertyType || property.type || 'Immeuble'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Statut</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  {property.status || 'ACTIVE'}
                </span>
              </div>
              {property.neighborhoodName && (
                <div>
                  <span className="text-xs text-muted-foreground block">Quartier</span>
                  <span className="text-foreground">{property.neighborhoodName}</span>
                </div>
              )}
              {property.sectorName && (
                <div>
                  <span className="text-xs text-muted-foreground block">Bloc / Secteur</span>
                  <span className="text-foreground">{property.sectorName}</span>
                </div>
              )}
              {property.latitude !== undefined && property.longitude !== undefined && (
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground block">Coordonnées GPS</span>
                  <span className="font-mono text-xs text-foreground">
                    {property.latitude.toFixed(6)}, {property.longitude.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
            {property.description && (
              <p className="text-xs text-muted-foreground border-t border-border pt-2">
                {property.description}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Home className="size-4 text-primary" />
              Composition & Unités ({units.length})
            </div>
          </div>
          {units.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
              {(property.chambreSimpleCount ?? 0) > 0 && (
                <div className="rounded-lg border border-border p-2">
                  Chambres simples : <strong>{property.chambreSimpleCount}</strong>
                </div>
              )}
              {(property.chambreModerneCount ?? 0) > 0 && (
                <div className="rounded-lg border border-border p-2">
                  Chambres modernes : <strong>{property.chambreModerneCount}</strong>
                </div>
              )}
              {(property.studioSimpleCount ?? 0) > 0 && (
                <div className="rounded-lg border border-border p-2">
                  Studios simples : <strong>{property.studioSimpleCount}</strong>
                </div>
              )}
              {(property.studioModerneCount ?? 0) > 0 && (
                <div className="rounded-lg border border-border p-2">
                  Studios modernes : <strong>{property.studioModerneCount}</strong>
                </div>
              )}
              {(property.appartementCount ?? 0) > 0 && (
                <div className="rounded-lg border border-border p-2">
                  Appartements : <strong>{property.appartementCount}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {units.map((u) => (
                <div key={u._id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-foreground">
                      {u.name} {u.number ? `(${u.number})` : ''}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{u.type}</span>
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-semibold text-foreground">
                      {u.rentAmountMinor ? `${u.rentAmountMinor.toLocaleString('fr-FR')} FCFA` : '—'}
                    </span>
                    <span className="ml-2 text-muted-foreground">{u.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
