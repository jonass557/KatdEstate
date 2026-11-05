import { LayoutDashboard, LogOut, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useOrganization } from '../app/organization';
import { useSession } from '../app/session';
import { useSocket } from '../app/socket';
import { initials } from '../lib/format';
import { cn } from '../lib/utils';
import { CommandPalette } from '../components/command-palette';
import { OrganizationSwitcher } from '../components/organization-switcher';
import { ThemeToggle } from '../components/theme-toggle';
import { Badge } from '../components/ui/badge';

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2 group cursor-pointer" title="Retour au tableau de bord KatdEstate">
      <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 text-sm font-black shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
        KE
      </span>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black tracking-tight text-foreground group-hover:text-emerald-400 transition-colors">
            KatdEstate
          </span>
          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            PRO
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground leading-none hidden sm:block">
          Plateforme Immobilière & Sécurité Urbaine
        </span>
      </div>
    </Link>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { activeOrganization } = useOrganization();
  const { user, signOut } = useSession();
  const { isConnected } = useSocket();

  const userInitials = user ? initials(user.displayName) : 'KE';

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/sign-in', { replace: true });
    }
  };

  // Global command palette shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu principal
      </a>

      {/* Header unifié sans menu déroulant / hamburger : navigation exclusivement sur le tableau de bord */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 backdrop-blur-md sm:px-6">
        
        {/* Logo Brand + Organisation */}
        <div className="flex items-center gap-3">
          <Brand />
          <div className="hidden md:block border-l border-border/60 pl-3">
            <OrganizationSwitcher />
          </div>
        </div>

        {/* Centre : Raccourci vers Dashboard & Recherche */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition-all shadow-sm"
            title="Revenir au tableau de bord des fonctionnalités"
          >
            <LayoutDashboard className="size-4 shrink-0" />
            <span className="hidden sm:inline">Tableau de bord</span>
          </Link>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 text-left text-xs text-muted-foreground transition hover:bg-muted"
          >
            <Search className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Rechercher une action…</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] sm:block">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Droite : Statut, Thème, Profil et Déconnexion immédiate */}
        <div className="flex items-center gap-2">
          <span
            className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex"
            title={isConnected ? 'Temps réel connecté' : 'Temps réel inactif'}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50',
              )}
              aria-hidden
            />
            {isConnected ? 'En direct' : 'Hors ligne'}
          </span>

          {activeOrganization?.currency && (
            <Badge className="hidden sm:inline-flex bg-card border-border text-[11px] font-bold">
              {activeOrganization.currency}
            </Badge>
          )}

          <ThemeToggle />

          <span
            className="flex size-8.5 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 text-xs font-black"
            title={user?.displayName ?? 'Profil'}
          >
            {userInitials}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500 hover:text-white shadow-sm"
            title="Se déconnecter pour changer de compte"
          >
            <LogOut className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Contenu principal plein écran sans barre latérale parasite */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
      >
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
