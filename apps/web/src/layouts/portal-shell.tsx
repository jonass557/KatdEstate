import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { BackButton } from '../components/ui/back-button';
import { useSession } from '../app/session';

/**
 * Coque isolée du portail locataire.
 * Affiche uniquement la barre d'en-tête avec le bouton de retour vers le Dashboard des fonctionnalités
 * et le bouton de déconnexion, sans barre de liens transversaux.
 */
export function PortalShell() {
  const { user, signOut } = useSession();

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <BackButton to="/dashboard" label="Retour au Dashboard" />
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
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
