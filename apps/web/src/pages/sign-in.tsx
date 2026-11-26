import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { loginSchema } from '@rentflow/shared';
import {
  Building2,
  AlertCircle,
  ArrowLeft,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useSession } from '../app/session';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ApiError } from '../lib/api-client';

type SignInValues = z.input<typeof loginSchema>;

export function SignInPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get('registered') === '1';
  const prefillEmail = searchParams.get('email') || '';
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState, setError } = useForm<SignInValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefillEmail, password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await signIn({ email: values.email, password: values.password });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        for (const detail of error.details ?? []) {
          if (detail.path === 'email' || detail.path === 'password') {
            setError(detail.path, { message: detail.message });
          }
        }
        setFormError(error.message);
        return;
      }

      if (error instanceof Error) {
        setFormError(error.message);
        return;
      }

      setFormError('Une erreur inattendue est survenue. Merci de réessayer.');
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Navigation & Brand */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10"
          >
            <ArrowLeft className="size-3.5" />
            Retour à l'accueil
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Pas encore de compte ?</span>
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold">
              S'inscrire
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center pt-2">
          <div className="size-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-0.5 shadow-xl shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Building2 className="size-7 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-mono">
            Katd<span className="text-emerald-400">Estate</span>
          </h1>
          <p className="text-xs text-slate-400">
            Connectez-vous avec votre compte inscrit, vos identifiants locataire/mandataire ou un compte démo
          </p>
        </div>

        {/* Form Container */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-5">
          {justRegistered && (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-xs text-emerald-300">
              <ShieldCheck className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>
                Compte créé avec succès ! Veuillez vous connecter avec vos identifiants pour accéder à votre tableau de bord.
              </span>
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2.5 rounded-xl bg-destructive/15 border border-destructive/30 p-3.5 text-xs text-rose-300">
              <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Mail className="size-3.5 text-slate-400" />
                Adresse email
              </label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="vous@exemple.com"
                className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus:border-emerald-500 rounded-xl"
                {...register('email')}
              />
              {formState.errors.email?.message && (
                <p className="text-[11px] text-rose-400">{formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="size-3.5 text-slate-400" />
                Mot de passe
              </label>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-600 focus:border-emerald-500 rounded-xl"
                {...register('password')}
              />
              {formState.errors.password?.message && (
                <p className="text-[11px] text-rose-400">{formState.errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={formState.isSubmitting}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 text-sm transition-all"
            >
              {formState.isSubmitting ? 'Connexion en cours…' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
