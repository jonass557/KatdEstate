import { LogOut, Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useOrganization } from '../app/organization';
import { useCan } from '../app/permissions';
import { useSession } from '../app/session';
import { useSocket } from '../app/socket';
import { NAVIGATION } from '../lib/navigation';
import { initials } from '../lib/format';
import { cn } from '../lib/utils';
import { CommandPalette } from '../components/command-palette';
import { OrganizationSwitcher } from '../components/organization-switcher';
import { ThemeToggle } from '../components/theme-toggle';
import { Badge } from '../components/ui/badge';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const can = useCan();

  const sections = NAVIGATION.map((section) => ({
    label: section.label,
    items: section.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto scrollbar-thin px-3 py-4">
      {sections.map((section) => (
        <div key={section.label} className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-3 pt-5 group cursor-pointer" title="Retour à l'accueil KadtEstate">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground group-hover:scale-105 transition-transform">
        KE
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">KadtEstate</span>
        <span className="block truncate text-[11px] text-muted-foreground">Immobilier & Chefferie</span>
      </span>
    </Link>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const { activeOrganization } = useOrganization();
  const { isPreview, user, signOut } = useSession();
  const { isConnected } = useSocket();

  const userInitials = user ? initials(user.displayName) : 'AP';

  const handleSignOut = () => {
    void signOut();
  };

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu principal
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <Brand />
        <div className="px-3 pt-4">
          <OrganizationSwitcher />
        </div>
        <NavLinks />
        <div className="space-y-2 border-t border-border p-3">
          {isPreview ? (
            <p className="rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
              Mode aperçu — l’API d’identité est indisponible, aucune session réelle n’est ouverte.
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <aside className="animate-in absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-border bg-card">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Fermer la navigation"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="px-3 pt-4">
              <OrganizationSwitcher />
            </div>
            <NavLinks onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Ouvrir la navigation"
          >
            <Menu className="size-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border px-3 text-left text-sm text-muted-foreground transition hover:bg-muted sm:max-w-sm"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Rechercher…</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] sm:block">
              Ctrl K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
              title={isConnected ? 'Temps réel connecté' : 'Temps réel inactif'}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  isConnected ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                )}
                aria-hidden
              />
              {isConnected ? 'Temps réel' : 'Hors ligne'}
            </span>
            <Badge className="hidden md:inline-flex">{activeOrganization.currency}</Badge>
            <ThemeToggle />
            <span
              className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
              title={user?.displayName ?? 'Mode aperçu'}
            >
              {userInitials}
            </span>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
        >
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
