import { PageHeader } from '../components/page-header';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Skeleton } from '../components/ui/skeleton';
import { useToast } from '../components/ui/toast';

/**
 * Generic placeholder for a module that is scheduled but not implemented yet.
 * It deliberately shows structure (skeletons) instead of fake records.
 */
export function ModulePlaceholderPage({ title, phase }: { title: string; phase: string }) {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`Module planifié — ${phase}. Aucune fonctionnalité métier n’est encore livrée ici.`}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Bientôt disponible',
                description: `Le module « ${title} » sera livré avec le ${phase}.`,
                variant: 'info',
              })
            }
          >
            Notifier à la sortie
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Aperçu de la structure à venir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-10 w-3/5" />
        </CardContent>
      </Card>

      <EmptyState
        title="Module en préparation"
        description={`Les écrans de « ${title} » seront construits sur l’API versionnée, avec isolation par organisation, permissions granulaires et journal d’audit.`}
      />
    </div>
  );
}
