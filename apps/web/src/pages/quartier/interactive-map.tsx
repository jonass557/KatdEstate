import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, ShieldCheck } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { apiRequest } from '../../lib/api-client';

export function InteractiveQuartierMap() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: residences } = useQuery<any[]>({
    queryKey: ['quartier-map-residences', selectedCategory, selectedStatus, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('buildingType', selectedCategory);
      if (selectedStatus) params.set('censusStatus', selectedStatus);
      if (search) params.set('q', search);
      return apiRequest(`/quartier/residences?${params.toString()}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Layers className="h-3.5 w-3.5" />
            Cartographie Citoyenne & Respect de la Vie Privée
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
            <ShieldCheck className="h-3 w-3" /> Données Personnelles Anonymisées
          </span>
        </div>
        <h1 className="text-2xl font-black text-foreground">Carte Interactive du Recensement</h1>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Visualisez l'état d'avancement du recensement par secteur. Conformément à la réglementation sur la protection de la vie privée, aucun nom, numéro de téléphone ni donnée familiale n'est affiché publiquement.
        </p>

        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-3 pt-3">
          <Input
            placeholder="Rechercher par adresse ou ID KatdEstate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-md border border-input bg-background p-2 text-xs"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Tous les types de résidences</option>
            <option value="INDIVIDUAL_HOUSE">Maison individuelle</option>
            <option value="RESIDENTIAL_BUILDING">Immeuble résidentiel</option>
            <option value="APARTMENT">Appartement</option>
            <option value="STUDIO">Studio</option>
            <option value="COLLECTIVE_RESIDENCE">Résidence collective</option>
            <option value="COMMERCIAL_RESIDENTIAL">Mixte commercial & résidentiel</option>
          </select>
          <select
            className="rounded-md border border-input bg-background p-2 text-xs"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Tous les statuts de recensement</option>
            <option value="VALIDATED">Validé par le chef</option>
            <option value="PENDING">En attente de vérification</option>
            <option value="TO_UPDATE">À mettre à jour</option>
          </select>
        </div>
      </div>

      {/* Visual Simulated Map Canvas */}
      <div className="relative h-96 w-full rounded-2xl border border-border bg-slate-900/90 overflow-hidden flex flex-col justify-between p-5 text-white">
        {/* Background Grid Pattern */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Top Overlay Stats */}
        <div className="relative z-10 flex flex-wrap gap-2 text-xs">
          <div className="rounded-lg bg-black/60 backdrop-blur-md px-3 py-1.5 border border-white/10">
            Résidences localisées : <strong>{residences?.length || 0}</strong>
          </div>
          <div className="rounded-lg bg-emerald-500/20 backdrop-blur-md px-3 py-1.5 border border-emerald-500/40 text-emerald-300">
            ● Validées : <strong>{residences?.filter((r) => r.censusStatus === 'VALIDATED').length || 0}</strong>
          </div>
          <div className="rounded-lg bg-amber-500/20 backdrop-blur-md px-3 py-1.5 border border-amber-500/40 text-amber-300">
            ● En attente : <strong>{residences?.filter((r) => r.censusStatus === 'PENDING').length || 0}</strong>
          </div>
        </div>

        {/* Floating Simulated Sector Nodes */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 my-auto">
          {residences?.slice(0, 8).map((r, idx) => (
            <div
              key={r._id || idx}
              className="rounded-xl border border-white/15 bg-black/50 backdrop-blur-sm p-3 text-xs space-y-1 transition-transform hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-primary text-[10px]">{r.residenceDomoraId}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    r.censusStatus === 'VALIDATED' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </div>
              <p className="font-semibold text-white truncate">{r.address}</p>
              <p className="text-[10px] text-white/60 truncate">{r.buildingType}</p>
            </div>
          ))}
        </div>

        {/* Bottom Legend */}
        <div className="relative z-10 text-[11px] text-white/70 flex items-center justify-between border-t border-white/10 pt-2">
          <span>Secteurs géographiques couverts par KatdEstate Quartier & Chefferie</span>
          <span>Précision cadastrale locale sécurisée</span>
        </div>
      </div>
    </div>
  );
}
