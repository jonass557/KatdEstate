import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Indicateur de chargement plein écran.
 *
 * Affiché uniquement pendant la résolution de la session, c'est-à-dire avant que
 * l'application sache qui est l'utilisateur. Afficher l'interface avant de le
 * savoir provoquerait un « flash » de contenu protégé puis une redirection.
 */
export function GlobalLoading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
      <span className="sr-only">Veuillez patienter</span>
    </div>
  );
}

/** Barre de progression fine, pour un chargement local dans une page. */
export function LoadingBar({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)}
      role="status"
      aria-label="Chargement"
    >
      <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
    </div>
  );
}
