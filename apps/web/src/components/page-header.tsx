import type { ReactNode } from 'react';
import { BackButton } from './ui/back-button';

export function PageHeader({
  title,
  description,
  actions,
  showBack = true,
  backTo,
  backLabel = 'Retour',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {showBack ? (
          <div>
            <BackButton to={backTo} label={backLabel} />
          </div>
        ) : null}
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
