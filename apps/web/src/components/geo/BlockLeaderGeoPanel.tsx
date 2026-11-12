import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Edit3,
  History,
  Lock,
  MapPin,
  Plus,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import {
  computePolygonAreaM2,
  isPolygonInsidePolygon,
  validatePolygonGeometry,
  type GeoJsonBoundary,
} from '@rentflow/shared';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';
import { useSession } from '../../app/session';
import { useOrgPath } from '../../lib/query';
import { ApiError, apiRequest } from '../../lib/api-client';
import {
  appendGeoAuditLogLocal,
  getGeoAuditLogsLocal,
  getBlockOwners,
  getStoredBlocks,
  getStoredNeighborhoods,
  saveBlockOwner,
  type BlockOwnerRecord,
  type BlockRecord,
  type GeoAuditRecord,
} from '../../lib/katdestate-store';
import type { GeoPolygonOverlay } from '../../lib/geo/map-provider';
import { GeoMapCanvas } from './GeoMapCanvas';

const OWNER_COLORS = ['#10b981', '#14b8a6', '#059669', '#0d9488', '#22c55e', '#06b6d4'];

function readLocalPropertiesSafe(): Array<{
  _id?: string;
  name?: string;
  geoOwnerId?: string;
  sectorName?: string;
  blockId?: string;
}> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('katdestate_custom_properties');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

interface BlockLeaderGeoPanelProps {
  activeBlockId?: string | undefined;
  onDataChanged?: (() => void) | undefined;
}

export function BlockLeaderGeoPanel({ activeBlockId, onDataChanged }: BlockLeaderGeoPanelProps) {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const base = useOrgPath();
  const userRole = memberships?.[0]?.role || (user as any)?.platformRole || 'BLOCK_LEADER';

  const neighborhoods = useMemo(() => getStoredNeighborhoods(), []);
  const blocks = useMemo(() => getStoredBlocks(), []);
  const [owners, setOwners] = useState<BlockOwnerRecord[]>(() => getBlockOwners());
  const [auditLogs, setAuditLogs] = useState<GeoAuditRecord[]>(() => getGeoAuditLogsLocal());

  // Identifie strictement le bloc assigné à ce Chef de Bloc (aucun accès aux autres blocs)
  const activeBlock: BlockRecord | undefined = useMemo(() => {
    const userEmail = user?.email?.trim().toLowerCase();
    if (activeBlockId) {
      return blocks.find((b) => b.id === activeBlockId) || blocks[0];
    }
    if (userEmail) {
      const byLeader = blocks.find((b) => b.leaderEmail?.trim().toLowerCase() === userEmail);
      if (byLeader) return byLeader;
    }
    return blocks[0];
  }, [activeBlockId, blocks, user?.email]);

  const parentNeighborhood = useMemo(() => {
    if (!activeBlock) return neighborhoods[0];
    return (
      neighborhoods.find((n) => n.id === activeBlock.neighborhoodId) || neighborhoods[0]
    );
  }, [activeBlock, neighborhoods]);

  const blockOwners = useMemo(() => {
    if (!activeBlock) return [];
    return owners.filter((o) => o.blockId === activeBlock.id);
  }, [activeBlock, owners]);

  const localProperties = useMemo(() => readLocalPropertiesSafe(), [owners]);

  // Mode d'édition sur la carte : 'VIEW' | 'CREATE_OWNER' | 'EDIT_OWNER'
  const [mapMode, setMapMode] = useState<'VIEW' | 'CREATE_OWNER' | 'EDIT_OWNER'>('VIEW');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [draftBoundary, setDraftBoundary] = useState<GeoJsonBoundary | null>(null);

  // Champs formulaire création / modification secteur propriétaire
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [password, setPassword] = useState('Prop@2026!');
  const [propertyName, setPropertyName] = useState('');
  const [propertyType] = useState('Résidence / Immeuble');
  const [monthlyRentOrDues, setMonthlyRentOrDues] = useState('50000');
  const [saving, setSaving] = useState(false);

  const [clickedOverlay, setClickedOverlay] = useState<GeoPolygonOverlay | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    boundary?: GeoJsonBoundary | null;
    key?: string;
  } | null>(null);

  const refreshLocal = () => {
    setOwners(getBlockOwners());
    setAuditLogs(getGeoAuditLogsLocal());
    onDataChanged?.();
  };

  // Comptage des biens par propriétaire dans ce bloc
  const ownerPropertyCounts = useMemo(() => {
    const map = new Map<string, number>();
    blockOwners.forEach((o) => {
      const matching = localProperties.filter(
        (p) =>
          p.geoOwnerId === o.id ||
          (p.blockId === activeBlock?.id &&
            p.name &&
            o.propertyName &&
            p.name.toLowerCase().includes(o.propertyName.toLowerCase())),
      );
      map.set(o.id, Math.max(matching.length, o.propertyName ? 1 : 0));
    });
    return map;
  }, [activeBlock?.id, blockOwners, localProperties]);

  // Validation géométrique en temps réel :
  // - Polygone valide (>= 3 points, pas d'auto-intersection)
  // - Strictement inclus dans les limites du Bloc assigné (et du Quartier)
  const validation = useMemo(() => {
    if (mapMode === 'VIEW' || !draftBoundary) {
      return { valid: true, error: null as string | null, info: null as string | null };
    }

    const geom = validatePolygonGeometry(draftBoundary);
    if (!geom.valid) {
      return {
        valid: false,
        error: geom.error || 'Polygone invalide.',
        info: null,
      };
    }

    if (activeBlock?.boundary) {
      const insideBlock = isPolygonInsidePolygon(draftBoundary, activeBlock.boundary);
      if (!insideBlock) {
        return {
          valid: false,
          error: `Zone refusée : le secteur du propriétaire sort des limites autorisées de votre bloc (${activeBlock.name}).`,
          info: null,
        };
      }
    }

    if (parentNeighborhood?.boundary) {
      const insideNeighborhood = isPolygonInsidePolygon(
        draftBoundary,
        parentNeighborhood.boundary,
      );
      if (!insideNeighborhood) {
        return {
          valid: false,
          error: `Zone refusée : le secteur sort des limites du quartier ${parentNeighborhood.name}.`,
          info: null,
        };
      }
    }

    const areaM2 = Math.round(computePolygonAreaM2(draftBoundary));
    return {
      valid: true,
      error: null,
      info: `Secteur propriétaire conforme au périmètre de ${activeBlock?.name || 'votre bloc'} (${areaM2.toLocaleString('fr-FR')} m²).`,
    };
  }, [activeBlock, draftBoundary, mapMode, parentNeighborhood]);

  // Couches affichées sur la carte (Strictement : Quartier parent + Bloc du chef connecté + Propriétaires de ce bloc)
  const overlays = useMemo<GeoPolygonOverlay[]>(() => {
    const list: GeoPolygonOverlay[] = [];

    if (parentNeighborhood?.boundary) {
      list.push({
        id: parentNeighborhood.id,
        level: 'NEIGHBORHOOD',
        label: `Quartier : ${parentNeighborhood.name}`,
        sublabel: parentNeighborhood.leaderName || 'Chef de Quartier',
        boundary: parentNeighborhood.boundary,
        color: '#7c3aed',
        fillOpacity: 0.04,
        strokeWeight: 2,
        locked: true,
        metadata: {
          type: 'Quartier de rattachement (lecture seule)',
          chefQuartier: parentNeighborhood.leaderName || 'Chef de Quartier',
          telephoneChef: parentNeighborhood.leaderPhone || '-',
        },
      });
    }

    if (activeBlock?.boundary) {
      list.push({
        id: activeBlock.id,
        level: 'BLOCK',
        label: `Votre Bloc (verrouillé) : ${activeBlock.name}`,
        sublabel: `Code ${activeBlock.code}`,
        boundary: activeBlock.boundary,
        color: activeBlock.color || '#06b6d4',
        fillOpacity: 0.1,
        strokeWeight: 3,
        locked: true,
        metadata: {
          type: 'Zone Chef de Bloc (verrouillée)',
          code: activeBlock.code,
          quartier: activeBlock.neighborhoodName,
          proprietaires: blockOwners.length,
        },
      });
    }

    blockOwners.forEach((owner, idx) => {
      if (!owner.assignedBoundary) return;
      if (mapMode === 'EDIT_OWNER' && owner.id === selectedOwnerId) return;
      const propCount = ownerPropertyCounts.get(owner.id) ?? 1;
      list.push({
        id: owner.id,
        level: 'OWNER',
        label: owner.fullName,
        sublabel: `${owner.propertyName} (${propCount} bien${propCount > 1 ? 's' : ''})`,
        boundary: owner.assignedBoundary,
        color: OWNER_COLORS[idx % OWNER_COLORS.length]!,
        fillOpacity: 0.28,
        strokeWeight: 2,
        metadata: {
          type: 'Secteur Propriétaire',
          proprietaire: owner.fullName,
          telephone: owner.phone,
          email: owner.email,
          bienPrincipal: owner.propertyName,
          nombreBiens: propCount,
          statut: owner.status,
        },
      });
    });

    return list;
  }, [
    activeBlock,
    blockOwners,
    mapMode,
    ownerPropertyCounts,
    parentNeighborhood,
    selectedOwnerId,
  ]);

  const legendItems = useMemo(() => {
    const items: Array<{ label: string; color: string }> = [];
    if (parentNeighborhood?.boundary) {
      items.push({ label: `Quartier (${parentNeighborhood.name})`, color: '#7c3aed' });
    }
    if (activeBlock?.boundary) {
      items.push({
        label: `Votre Bloc (${activeBlock.code} - verrouillé)`,
        color: activeBlock.color || '#06b6d4',
      });
    }
    blockOwners.forEach((o, idx) => {
      if (o.assignedBoundary) {
        items.push({
          label: `Secteur ${o.fullName}`,
          color: OWNER_COLORS[idx % OWNER_COLORS.length]!,
        });
      }
    });
    return items;
  }, [activeBlock, blockOwners, parentNeighborhood]);

  const handleSaveOwnerBoundary = async () => {
    if (!activeBlock || !draftBoundary || !validation.valid || validation.error) return;

    if (mapMode === 'CREATE_OWNER' && (!fullName.trim() || !email.trim() || !phone.trim())) {
      toast({
        title: 'Informations du propriétaire requises',
        description: 'Renseignez le nom complet, le téléphone et l’email du propriétaire.',
        variant: 'error',
      });
      return;
    }

    setSaving(true);
    try {
      if (mapMode === 'CREATE_OWNER') {
        try {
          await apiRequest(`${base}/quartier/owners`, {
            method: 'POST',
            body: {
              blockId: activeBlock.id,
              neighborhoodId: activeBlock.neighborhoodId,
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim(),
              password: password.trim() || undefined,
              propertyName: propertyName.trim() || 'Propriété du secteur',
              propertyType,
              monthlyRentOrDues: Number(monthlyRentOrDues) || 0,
              assignedBoundary: draftBoundary,
            },
          });
        } catch (err) {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            toast({ title: 'Validation serveur refusée', description: err.message, variant: 'error' });
            return;
          }
          // Mode hors ligne / session démo locale : persistance locale conservée
        }

        const created: BlockOwnerRecord = {
          id: `own-${Date.now()}`,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password: password.trim() || 'Prop@2026!',
          blockId: activeBlock.id,
          blockName: activeBlock.name,
          neighborhoodId: activeBlock.neighborhoodId,
          assignedBoundary: draftBoundary,
          propertyName: propertyName.trim() || 'Propriété du secteur',
          propertyType,
          monthlyRentOrDues: Number(monthlyRentOrDues) || 0,
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          createdAt: new Date().toISOString(),
        };
        saveBlockOwner(created);

        appendGeoAuditLogLocal({
          entityType: 'OWNER',
          entityId: created.id,
          entityName: created.fullName,
          action: 'CREATE_BOUNDARY',
          performedByName: user?.displayName || activeBlock.leaderName || 'Chef de Bloc',
          performedByRole: userRole,
          newBoundary: draftBoundary,
        });

        toast({
          title: 'Propriétaire et secteur enregistrés !',
          description: `Zone administrative créée dans ${activeBlock.name} pour ${created.fullName}.`,
          variant: 'success',
        });

        setFullName('');
        setEmail('');
        setPropertyName('');
        setDraftBoundary(null);
        setMapMode('VIEW');
        refreshLocal();
      } else if (mapMode === 'EDIT_OWNER' && selectedOwnerId) {
        const target = blockOwners.find((o) => o.id === selectedOwnerId);
        if (!target) return;

        try {
          await apiRequest(`${base}/quartier/owners/${selectedOwnerId}/boundary`, {
            method: 'PATCH',
            body: {
              assignedBoundary: draftBoundary,
            },
          });
        } catch (err) {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            toast({ title: 'Modification refusée par le serveur', description: err.message, variant: 'error' });
            return;
          }
        }

        const previousBoundary = target.assignedBoundary;
        saveBlockOwner({
          ...target,
          assignedBoundary: draftBoundary,
        });

        appendGeoAuditLogLocal({
          entityType: 'OWNER',
          entityId: target.id,
          entityName: target.fullName,
          action: previousBoundary ? 'UPDATE_BOUNDARY' : 'CREATE_BOUNDARY',
          performedByName: user?.displayName || activeBlock.leaderName || 'Chef de Bloc',
          performedByRole: userRole,
          previousBoundary,
          newBoundary: draftBoundary,
        });

        toast({
          title: 'Zone du propriétaire mise à jour',
          description: `Secteur redéfini pour ${target.fullName}.`,
          variant: 'success',
        });

        setSelectedOwnerId(null);
        setDraftBoundary(null);
        setMapMode('VIEW');
        refreshLocal();
      }
    } finally {
      setSaving(false);
    }
  };

  // Audit filtré sur ce bloc & les propriétaires de ce bloc uniquement
  const blockAuditLogs = useMemo(() => {
    const ownerIds = new Set(blockOwners.map((o) => o.id));
    return auditLogs
      .filter(
        (log) =>
          (log.entityType === 'BLOCK' && log.entityId === activeBlock?.id) ||
          (log.entityType === 'OWNER' && ownerIds.has(log.entityId)),
      )
      .slice(0, 12);
  }, [activeBlock?.id, auditLogs, blockOwners]);

  const totalPropertiesCount = useMemo(
    () =>
      blockOwners.reduce((sum, owner) => sum + (ownerPropertyCounts.get(owner.id) ?? 1), 0),
    [blockOwners, ownerPropertyCounts],
  );

  if (!activeBlock) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Aucun bloc actif n’est rattaché à votre compte Chef de Bloc.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bandeau de contexte Chef de Bloc (limites verrouillées + rattachement quartier) */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-3.5 border-cyan-500/30 bg-cyan-500/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-cyan-600" />
            <span>Votre Bloc (verrouillé)</span>
          </div>
          <p className="mt-1 text-sm font-black text-foreground">{activeBlock.name}</p>
          <p className="text-[11px] text-muted-foreground">
            Code {activeBlock.code} • Surface{' '}
            {activeBlock.boundary
              ? `${Math.round(computePolygonAreaM2(activeBlock.boundary)).toLocaleString('fr-FR')} m²`
              : 'Non délimitée'}
          </p>
        </Card>

        <Card className="p-3.5 border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-purple-600" />
            <span>Quartier & Chef de Quartier</span>
          </div>
          <p className="mt-1 text-sm font-black text-foreground">
            {parentNeighborhood?.name || activeBlock.neighborhoodName}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {parentNeighborhood?.leaderName || 'Chef de Quartier'} •{' '}
            {parentNeighborhood?.leaderPhone || '+225 07 00 00 00'}
          </p>
        </Card>

        <Card className="p-3.5 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Propriétaires du Bloc</span>
          </div>
          <p className="mt-1 text-2xl font-black text-foreground">{blockOwners.length}</p>
          <p className="text-[11px] text-muted-foreground">
            {blockOwners.filter((o) => Boolean(o.assignedBoundary)).length} avec secteur délimité
          </p>
        </Card>

        <Card className="p-3.5 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 text-amber-600" />
            <span>Biens recensés</span>
          </div>
          <p className="mt-1 text-2xl font-black text-foreground">{totalPropertiesCount}</p>
          <p className="text-[11px] text-muted-foreground">Dans le périmètre de votre bloc</p>
        </Card>
      </div>

      {/* Alerte de sécurité périmètre */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-foreground">
          <ShieldAlert className="h-4 w-4 text-cyan-600 shrink-0" />
          <span>
            <strong>Accès territorial restreint :</strong> Vous visualisez les limites de votre bloc{' '}
            <strong>{activeBlock.name}</strong> en lecture seule et vous pouvez uniquement dessiner ou
            modifier les secteurs de vos propriétaires à l’intérieur de ce périmètre.
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {mapMode === 'VIEW' ? (
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                setMapMode('CREATE_OWNER');
                setSelectedOwnerId(null);
                setDraftBoundary(null);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Ajouter un propriétaire & tracer son secteur</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMapMode('VIEW');
                setSelectedOwnerId(null);
                setDraftBoundary(null);
              }}
            >
              Annuler l’édition
            </Button>
          )}
        </div>
      </div>

      {/* Formulaire de création / édition de secteur propriétaire */}
      {mapMode !== 'VIEW' && (
        <Card className="p-4 border-emerald-500/40 bg-emerald-500/5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-foreground">
                {mapMode === 'CREATE_OWNER'
                  ? 'Nouveau Propriétaire & Délimitation de sa Zone Administrative'
                  : `Modification du secteur de ${blockOwners.find((o) => o.id === selectedOwnerId)?.fullName || 'Propriétaire'}`}
              </h3>
              <p className="text-xs text-muted-foreground">
                Cliquez sur « Dessiner un polygone » sur la carte pour placer les points du secteur
                strictement à l’intérieur du contour cyan de votre bloc.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!draftBoundary || !validation.valid || Boolean(validation.error) || saving}
              onClick={handleSaveOwnerBoundary}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{saving ? 'Enregistrement...' : 'Valider & Enregistrer le secteur'}</span>
            </Button>
          </div>

          {mapMode === 'CREATE_OWNER' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Nom complet *
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Mme Mariam Koné"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Email *</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="proprio@katdestate.ci"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Téléphone *
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Mot de passe provisoire
                </label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Bien / Résidence principale
                </label>
                <Input
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="Ex: Résidence Les Oliviers"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Cotisation mensuelle (FCFA)
                </label>
                <Input
                  type="number"
                  value={monthlyRentOrDues}
                  onChange={(e) => setMonthlyRentOrDues(e.target.value)}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Carte Interactive Google Maps (Niveau 2) */}
      <GeoMapCanvas
        title={`Carte du ${activeBlock.name}`}
        subtitle="Niveau 2 : Secteurs des propriétaires immobiliers à l’intérieur de votre bloc"
        heightClassName="h-[460px]"
        overlays={overlays}
        activeBoundary={draftBoundary}
        onBoundaryChange={setDraftBoundary}
        allowPolygonDraw={mapMode !== 'VIEW'}
        validationError={validation.error}
        validationSuccess={validation.info}
        focusTarget={focusTarget}
        legendItems={legendItems}
        onOverlayClick={(ov) => setClickedOverlay(ov)}
      />

      {/* Fiche de détail sur clic polygone */}
      {clickedOverlay && (
        <Card className="p-4 border-primary/40 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: clickedOverlay.color }}
              />
              <span className="text-sm font-bold text-foreground">{clickedOverlay.label}</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold">
                {clickedOverlay.level}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              {Object.entries(clickedOverlay.metadata || {}).map(([k, v]) => (
                <span key={k}>
                  <strong className="text-foreground capitalize">{k}:</strong> {String(v)}
                </span>
              ))}
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setClickedOverlay(null)}>
            Fermer
          </Button>
        </Card>
      )}

      {/* Liste des propriétaires du bloc + historique des modifications */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <span>Propriétaires enregistrés dans {activeBlock.name}</span>
          </h3>
          {blockOwners.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun propriétaire délimité pour le moment dans ce bloc.
            </p>
          ) : (
            <div className="space-y-2">
              {blockOwners.map((owner, idx) => {
                const count = ownerPropertyCounts.get(owner.id) ?? 1;
                const area = owner.assignedBoundary
                  ? Math.round(computePolygonAreaM2(owner.assignedBoundary))
                  : null;
                return (
                  <div
                    key={owner.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: OWNER_COLORS[idx % OWNER_COLORS.length]!,
                          }}
                        />
                        <span className="font-bold text-foreground">{owner.fullName}</span>
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                          {count} bien{count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {owner.phone} • {owner.propertyName} •{' '}
                        {area ? `${area.toLocaleString('fr-FR')} m²` : 'Secteur non tracé'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {owner.assignedBoundary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setFocusTarget({
                              boundary: owner.assignedBoundary ?? null,
                              key: `${owner.id}-${Date.now()}`,
                            })
                          }
                        >
                          Centrer
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setMapMode('EDIT_OWNER');
                          setSelectedOwnerId(owner.id);
                          setDraftBoundary(owner.assignedBoundary ?? null);
                          if (owner.assignedBoundary) {
                            setFocusTarget({
                              boundary: owner.assignedBoundary,
                              key: `edit-${owner.id}-${Date.now()}`,
                            });
                          }
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>{owner.assignedBoundary ? 'Modifier zone' : 'Tracer zone'}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-600" />
            <span>Historique des modifications de votre bloc</span>
          </h3>
          {blockAuditLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucune modification géographique enregistrée récemment dans ce bloc.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {blockAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-border bg-muted/20 p-2.5 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground">{log.entityName}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    Par {log.performedByName} ({log.performedByRole}) •{' '}
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
    </div>
  );
}
