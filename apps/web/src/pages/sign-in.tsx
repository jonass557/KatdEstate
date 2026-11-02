import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@rentflow/shared';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useSession } from '../app/session';
import { Button } from '../components/ui/button';
import { FormField } from '../components/ui/form';
import { Input } from '../components/ui/input';
import { ApiError } from '../lib/api-client';

type SignInValues = z.input<typeof loginSchema>;

/**
 * Écran de connexion.
 *
 * Le formulaire valide les données avec le **même schéma** que celui utilisé par
 * l'API (`loginSchema` partagé), ce qui évite qu'une règle diverge entre client
 * et serveur. Les erreurs renvoyées par l'API sont rattachées au champ concerné
 * quand c'est possible, et affichées globalement sinon.
 */
export function SignInPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState, setError } = useForm<SignInValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const memberships = await signIn({ email: values.email, password: values.password });

      const destination = memberships.some((membership) => membership.role === 'TENANT')
        ? '/portal'
        : '/';
      const state = location.state as { from?: string } | null;
      navigate(state?.from && state.from !== '/' ? state.from : destination, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        // Rattache chaque détail à son champ pour un retour précis à l'utilisateur.
        for (const detail of error.details ?? []) {
          if (detail.path === 'email' || detail.path === 'password') {
            setError(detail.path, { message: detail.message });
          }
        }
        setFormError(error.message);
        return;
      }

      setFormError('Une erreur inattendue est survenue. Merci de réessayer.');
    }
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            RF
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Connexion à RentFlow Africa</h1>
          <p className="text-sm text-muted-foreground">
            Gérez votre parc immobilier, vos contrats et vos loyers.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          {formError ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{formError}</span>
            </p>
          ) : null}

          <FormField
            label="Adresse email"
            {...(formState.errors.email?.message ? { error: formState.errors.email.message } : {})}
          >
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="vous@exemple.com"
              {...register('email')}
            />
          </FormField>

          <FormField
            label="Mot de passe"
            {...(formState.errors.password?.message
              ? { error: formState.errors.password.message }
              : {})}
          >
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
            />
          </FormField>

          <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Les routes <code className="font-mono">/auth/*</code> de l’API sont livrées au jalon
          suivant. Tant qu’elles sont absentes, l’application propose un mode aperçu clairement
          signalé.
        </p>
      </div>
    </div>
  );
}
