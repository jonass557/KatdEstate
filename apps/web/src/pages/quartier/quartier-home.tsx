import { useState } from 'react';
import { useSession } from '../../app/session';
import { BackButton } from '../../components/ui/back-button';
import { ResidentPortal } from './resident-portal';
import { BlockLeaderDashboard } from './block-leader-dashboard';
import { NeighborhoodLeaderDashboard } from './neighborhood-leader-dashboard';
import { ChefferieDashboard } from './chefferie-dashboard';
import { InteractiveQuartierMap } from './interactive-map';
import { AdminQuartierPage } from './admin-quartier';

export function QuartierHomePage() {
  const { user, memberships } = useSession();
  const userRole = memberships?.[0]?.role || (user as any)?.platformRole || 'RESIDENT';

  const getDefaultView = (
    role: string,
  ): 'resident' | 'block-leader' | 'neighborhood-leader' | 'chefferie' | 'map' | 'admin' => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'chefferie';
      case 'NEIGHBORHOOD_LEADER':
        return 'chefferie';
      case 'BLOCK_LEADER':
        return 'block-leader';
      case 'RESIDENT':
      default:
        return 'resident';
    }
  };

  const [activeView, setActiveView] = useState<
    'resident' | 'block-leader' | 'neighborhood-leader' | 'chefferie' | 'map' | 'admin'
  >(() => getDefaultView(userRole));

  return (
    <div className="space-y-6">
      {/* Branch Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-amber-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div>
            <BackButton to="/dashboard" label="Retour au Dashboard" />
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white font-bold text-xs shadow-sm">
              KE
            </span>
            <h1 className="text-xl font-black text-foreground">KatdEstate Quartier & Chefferie</h1>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              Recensement, Foncier, Actes & Sécurité
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Outil numérique de gestion foncière, administrative et sécuritaire. Accès cloisonné
            selon votre profil certifié.
          </p>
        </div>

        {/* View Switcher Pills - Strictly filtered by role permissions */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card/80 p-1.5 text-xs shadow-sm">
          {/* Chefferie & Foncier: Only for Super Admin & Neighborhood Leader */}
          {(userRole === 'SUPER_ADMIN' || userRole === 'NEIGHBORHOOD_LEADER') && (
            <button
              type="button"
              onClick={() => setActiveView('chefferie')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
                activeView === 'chefferie'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>👑</span>
              <span>Chefferie & Foncier</span>
            </button>
          )}

          {/* Espace Résident: For Residents, Block Leaders, and Super Admin */}
          {(userRole === 'SUPER_ADMIN' ||
            userRole === 'RESIDENT' ||
            userRole === 'BLOCK_LEADER' ||
            userRole === 'OWNER' ||
            userRole === 'TENANT') && (
            <button
              type="button"
              onClick={() => setActiveView('resident')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
                activeView === 'resident'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>👥</span>
              <span>Espace Résident</span>
            </button>
          )}

          {/* Chef de Bloc: Only for Block Leaders & Super Admin */}
          {(userRole === 'SUPER_ADMIN' || userRole === 'BLOCK_LEADER') && (
            <button
              type="button"
              onClick={() => setActiveView('block-leader')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
                activeView === 'block-leader'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>🛡️</span>
              <span>Chef de Bloc</span>
            </button>
          )}

          {/* Chef de Quartier: Only for Neighborhood Leader & Super Admin */}
          {(userRole === 'SUPER_ADMIN' || userRole === 'NEIGHBORHOOD_LEADER') && (
            <button
              type="button"
              onClick={() => setActiveView('neighborhood-leader')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
                activeView === 'neighborhood-leader'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>🏛️</span>
              <span>Chef de Quartier</span>
            </button>
          )}

          {/* Carte Interactive: Accessible to all community members */}
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              activeView === 'map'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span>🗺️</span>
            <span>Carte Interactive</span>
          </button>

          {/* Super Admin: Exclusively for Super Admin */}
          {userRole === 'SUPER_ADMIN' && (
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
                activeView === 'admin'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>⚙️</span>
              <span>Super Admin</span>
            </button>
          )}
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
