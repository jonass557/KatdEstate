import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../lib/navigation';
import { apiRequest } from '../lib/api-client';
import { useOrgPath } from '../lib/query';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';
import { Modal } from './ui/dialog';

interface Command {
  id: string;
  label: string;
  hint: string;
  type?: string | undefined;
  subtitle?: string | undefined;
  run: () => void;
}

interface SearchHit {
  type: string;
  id: string;
  label: string;
  subtitle?: string;
  url: string;
}

const TYPE_LABELS: Record<string, string> = {
  property: 'Propriété',
  building: 'Bâtiment',
  unit: 'Logement',
  tenant: 'Locataire',
  lease: 'Contrat',
  invoice: 'Facture',
  payment: 'Paiement',
  maintenance: 'Maintenance',
  document: 'Document',
  vendor: 'Artisan',
};

/**
 * Keyboard-first command palette (Ctrl/Cmd + K). Combines local navigation with
 * universal real-time database search across all portfolio entities.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const base = useOrgPath();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteHits, setRemoteHits] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const localCommands = useMemo<readonly Command[]>(
    () =>
      NAV_ITEMS.map((item) => ({
        id: item.path,
        label: item.label,
        hint: item.phase,
        type: 'Navigation',
        run: () => {
          navigate(item.path);
          onOpenChange(false);
        },
      })),
    [navigate, onOpenChange],
  );

  // Déclenche la recherche serveur universelle dès 2 caractères
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setRemoteHits([]);
      return;
    }

    const timer = window.setTimeout(() => {
      apiRequest<SearchHit[]>(`${base}/search?q=${encodeURIComponent(term)}`)
        .then((hits) => setRemoteHits(hits))
        .catch(() => setRemoteHits([]));
    }, 150);

    return () => window.clearTimeout(timer);
  }, [base, query]);

  const results = useMemo<Command[]>(() => {
    const term = query.trim().toLowerCase();
    const filteredNav = term
      ? localCommands.filter(
          (c) => c.label.toLowerCase().includes(term) || c.hint.toLowerCase().includes(term),
        )
      : [...localCommands];

    const mappedRemote: Command[] = remoteHits.map((hit) => ({
      id: `${hit.type}-${hit.id}`,
      label: hit.label,
      hint: TYPE_LABELS[hit.type] ?? hit.type,
      subtitle: hit.subtitle,
      type: hit.type,
      run: () => {
        navigate(hit.url);
        onOpenChange(false);
      },
    }));

    return [...mappedRemote, ...filteredNav];
  }, [localCommands, query, remoteHits, navigate, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    setRemoteHits([]);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runAt = (index: number) => {
    results[index]?.run();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Palette de commandes & recherche globale"
      hideCloseButton
      className="max-w-xl"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                runAt(activeIndex);
              }
            }}
            role="combobox"
            aria-expanded
            aria-controls="command-palette-results"
            aria-activedescendant={results[activeIndex] ? `command-${activeIndex}` : undefined}
            placeholder="Rechercher un module, un locataire, un logement, une facture…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            Échap
          </kbd>
        </div>

        <ul
          id="command-palette-results"
          role="listbox"
          aria-label="Résultats"
          className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin"
        >
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucun résultat pour « {query} ».
            </li>
          ) : (
            results.map((command, index) => (
              <li key={command.id}>
                <button
                  id={`command-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => command.run()}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition',
                    index === activeIndex ? 'bg-muted' : 'hover:bg-muted/60',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{command.label}</p>
                    {command.subtitle && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {command.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Badge className="text-[10px] border border-border bg-muted">
                      {command.hint}
                    </Badge>
                    {index === activeIndex ? (
                      <CornerDownLeft className="size-3.5" aria-hidden />
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </Modal>
  );
}
