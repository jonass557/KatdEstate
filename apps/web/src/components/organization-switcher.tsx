import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOrganization } from '../app/organization';
import { cn } from '../lib/utils';

/**
 * Active-tenant switcher. Server-side isolation is enforced with `organizationId`
 * on every request; this control only selects which tenant the UI is viewing.
 */
export function OrganizationSwitcher() {
  const { organizations, activeOrganization, setActiveOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition hover:bg-muted"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
          {activeOrganization.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{activeOrganization.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {activeOrganization.location}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Organisations accessibles"
          className="animate-in absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          {organizations.map((organization) => {
            const isActive = organization.id === activeOrganization.id;
            return (
              <button
                key={organization.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setActiveOrganization(organization.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted',
                  isActive && 'bg-muted/60',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{organization.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {organization.location} · {organization.currency}
                  </span>
                </span>
                {isActive ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
