import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './ui/card';

export interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="shrink-0 rounded-xl bg-accent p-2 text-accent-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
}
