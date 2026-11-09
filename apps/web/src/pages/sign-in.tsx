import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { loginSchema } from '@rentflow/shared';
import {
  Building2,
  AlertCircle,
  ArrowLeft,
  Crown,
  ShieldCheck,
  Users,
  Briefcase,
  Home,
  Lock,
  Mail,
  Key,
} from 'lucide-react';
import { useSession } from '../app/session';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ApiError } from '../lib/api-client';

type SignInValues = z.input<typeof loginSchema>;

const TEST_ACCOUNTS = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    email: 'admin@katdestate.immo',
    icon: Crown,
    color: 'text-amber-400 bg-amber-400/10',
  },
  {
    role: 'OWNER',
    label: 'Propriétaire',
    email: 'proprietaire@katdestate.immo',
    icon: Building2,
    color: 'text-blue-400 bg-blue-400/10',
  },
  {
    role: 'TENANT',
    label: 'Locataire',
    email: 'locataire@katdestate.immo',
    icon: Home,
    color: 'text-emerald-400 bg-emerald-400/10',
  },
  {
    role: 'AGENT',
    label: 'Agent Immobilier',
    email: 'agent@katdestate.immo',
    icon: Briefcase,
    color: 'text-orange-400 bg-orange-400/10',
  },
  {
    role: 'NEIGHBORHOOD_LEADER',
    label: 'Chef de Quartier',
    email: 'chef.quartier@katdestate.immo',
    icon: Crown,
    color: 'text-purple-400 bg-purple-400/10',
  },
  {
    role: 'BLOCK_LEADER',
    label: 'Chef de Bloc',
    email: 'chef.bloc@katdestate.immo',
    icon: ShieldCheck,
    color: 'text-cyan-400 bg-cyan-400/10',
  },
  {
    role: 'RESIDENT',
    label: 'Résident',
    email: 'resident@katdestate.immo',
    icon: Users,
    color: 'text-rose-400 bg-rose-400/10',
  },
];

export function SignInPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState, setError, setValue } = useForm<SignInValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const memberships = await signIn({ email: values.email, password: values.password });

      const isTenant = memberships.some((m) => m.role === 'TENANT');
      const isSuperAdmin = memberships.some((m) => (m as any).role === 'SUPER_ADMIN');

      let destination = '/dashboard';
      if (isTenant) destination = '/portal';
      else if (isSuperAdmin) destination = '/dashboard';

      const state = location.state as { from?: string } | null;
      const validFrom =
        state?.from && !['/', '/sign-in', '/register'].includes(state.from) ? state.from : null;
      navigate(validFrom || destination, { replace: true });
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

  const handleFillAccount = async (email: string) => {
    setValue('email', email);
    setValue('password', 'Password123!');
    setFormError(null);
    try {
      const memberships = await signIn({ email, password: 'Password123!' });
      const isTenant = memberships.some((m) => m.role === 'TENANT');
      navigate(isTenant ? '/portal' : '/dashboard', { replace: true });
    } catch (err: any) {
      setFormError(err?.message || 'Erreur de connexion');
    }
  };

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

          {/* Quick Demo Test Accounts Box */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-slate-300">
                <Key className="size-3 text-emerald-400" />
                Comptes de Test (1 clic) :
              </span>
              <span className="font-mono text-[10px] text-slate-500">Mdp : Password123!</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TEST_ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                return (
                  <button
                    type="button"
                    key={acc.email}
                    onClick={() => handleFillAccount(acc.email)}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-left transition-all group"
                  >
                    <div className={`p-1.5 rounded-lg ${acc.color} shrink-0`}>
                      <Icon className="size-3" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold text-slate-200 group-hover:text-emerald-400 truncate">
                        {acc.label}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate">{acc.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
