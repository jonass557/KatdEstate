import { Link } from 'react-router-dom';
import { buttonVariants } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <EmptyState
        title="Page introuvable"
        description="L’adresse demandée n’existe pas ou a été déplacée. Vérifiez le lien ou revenez au tableau de bord."
        action={
          <Link to="/" className={buttonVariants()}>
            Retour au tableau de bord
          </Link>
        }
      />
    </div>
  );
}
