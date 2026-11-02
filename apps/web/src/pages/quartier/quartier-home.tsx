import { useState } from 'react';
import { ResidentPortal } from './resident-portal';
import { BlockLeaderDashboard } from './block-leader-dashboard';
import { NeighborhoodLeaderDashboard } from './neighborhood-leader-dashboard';
import { ChefferieDashboard } from './chefferie-dashboard';
import { InteractiveQuartierMap } from './interactive-map';
import { AdminQuartierPage } from './admin-quartier';

export function QuartierHomePage() {
  const [activeView, setActiveView] = useState<'resident' | 'block-leader' | 'neighborhood-leader' | 'chefferie' | 'map' | 'admin'>('chefferie');

  return (
    <div className="space-y-6">
      {/* Branch Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-amber-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white font-bold text-xs shadow-sm">
              KE
            </span>
            <h1 className="text-xl font-black text-foreground">KadtEstate Quartier & Chefferie</h1>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              Recensement, Foncier, Actes & Sécurité
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Outil numérique de gestion immobilière, foncière, financière et administrative de la chefferie : ventes, locations, parcelles, commissions et certificats officiels.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveView('chefferie')}
            className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              activeView === 'chefferie'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            👑 Chefferie & Foncier
          </button>
          <button
            type="button"
            onClick={() => setActiveView('resident')}
            className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              activeView === 'resident'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Habitant / Résident
          </button>
          <button
            type="button"
            onClick={() => setActiveView('block-leader')}
            className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              activeView === 'block-leader'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Chef de Bloc
          </button>
          <button
            type="button"
            onClick={() => setActiveView('neighborhood-leader')}
            className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              activeView === 'neighborhood-leader'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Chef de Quartier
          </button>
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              activeView === 'map'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Carte
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
              activeView === 'admin'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Super Admin
          </button>
        </div>
      </div>

      {/* Render selected view */}
      {activeView === 'chefferie' && <ChefferieDashboard />}
      {activeView === 'resident' && <ResidentPortal />}
      {activeView === 'block-leader' && <BlockLeaderDashboard />}
      {activeView === 'neighborhood-leader' && <NeighborhoodLeaderDashboard />}
      {activeView === 'map' && <InteractiveQuartierMap />}
      {activeView === 'admin' && <AdminQuartierPage />}
    </div>
  );
}
