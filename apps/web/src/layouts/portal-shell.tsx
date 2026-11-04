import { NavLink, Outlet } from 'react-router-dom';
import { BackButton } from '../components/ui/back-button';
import {
  Bell,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  MessageSquare,
  Receipt,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useSession } from '../app/session';
import { cn } from '../lib/utils';

/**
 * Coque du portail locataire.
 *
 * Volontairement distincte de l'interface de gestion : une seule rangée de
 * liens, aucun graphique, aucune action de gestion. Le locataire ne voit que
 * ce qui le concerne.
 */
const LINKS = [
  { to: '/portal', label: 'Accueil', icon: Home, end: true },
  { to: '/portal/rent', label: 'Mes loyers', icon: Wallet, end: false },
  { to: '/portal/payments', label: 'Mes paiements', icon: Receipt, end: false },
  { to: '/portal/invoices', label: 'Mes factures', icon: Receipt, end: false },
  { to: '/portal/receipts', label: 'Mes reçus', icon: FileText, end: false },
  { to: '/portal/lease', label: 'Mon contrat', icon: FileText, end: false },
  { to: '/portal/documents', label: 'Mes documents', icon: FolderOpen, end: false },
  { to: '/portal/maintenance', label: 'Maintenance', icon: Wrench, end: false },
  { to: '/portal/messages', label: 'Mon gestionnaire', icon: MessageSquare, end: false },
  { to: '/portal/notifications', label: 'Notifications', icon: Bell, end: false },
  { to: '/portal/profile', label: 'Mon profil', icon: UserRound, end: false },
] as const;

export function PortalShell() {
  const { user, signOut } = useSession();

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <BackButton to="/" label="Accueil KadtEstate" />
            <div>
              <p className="text-sm font-semibold">Mon espace locataire</p>
              <p className="text-xs text-muted-foreground">{user?.displayName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500 hover:text-white"
            title="Se déconnecter pour changer de compte"
          >
            <LogOut className="size-3.5" aria-hidden />
            <span>Déconnexion</span>
          </button>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                )
              }
            >
              <link.icon className="size-3.5" aria-hidden />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
