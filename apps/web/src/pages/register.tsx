import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registerSchema } from '@rentflow/shared';
import { 
  Building2, 
  Home, 
  Briefcase, 
  Crown, 
  ShieldCheck, 
  Users, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Phone,
  Mail,
  User,
  Lock
} from 'lucide-react';
import { useSession } from '../app/session';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ApiError } from '../lib/api-client';

type RegisterFormValues = z.input<typeof registerSchema>;

interface RoleCard {
  id: 'OWNER' | 'TENANT' | 'AGENT' | 'NEIGHBORHOOD_LEADER' | 'BLOCK_LEADER' | 'RESIDENT';
  title: string;
  badge: string;
  icon: typeof Building2;
  gradient: string;
  description: string;
  features: string[];
}

const ROLES_LIST: RoleCard[] = [
  {
    id: 'OWNER',
    title: 'Propriétaire / Bailleur',
    badge: 'Patrimoine & Baux',
    icon: Building2,
    gradient: 'from-blue-600 to-indigo-600',
    description: 'Pilotez votre parc immobilier, suivez vos encaissements et automatisez vos quittances.',
    features: ['Gestion des biens & logements', 'Paiements Mobile Money', 'Quittances automatiques'],
  },
  {
    id: 'TENANT',
    title: 'Locataire',
    badge: 'Espace Résidentiel',
    icon: Home,
    gradient: 'from-emerald-600 to-teal-600',
    description: 'Payez votre loyer en toute sérénité et accédez à vos quittances certifiées.',
    features: ['Paiement Ikeepay (Orange, MTN, Wave)', 'Reçus officiels instantanés', 'Signalement pannes & requêtes'],
  },
  {
    id: 'AGENT',
    title: 'Agent Immobilier',
    badge: 'Affaires & Mandats',
    icon: Briefcase,
    gradient: 'from-amber-600 to-orange-600',
    description: 'Diffusez vos mandats sur la marketplace nationale et gérez vos commissions.',
    features: ['Diffusion Marketplace', 'Suivi des prospects & visites', 'Commissions & transactions'],
  },
  {
    id: 'NEIGHBORHOOD_LEADER',
    title: 'Chef de Quartier / Chefferie',
    badge: 'Autorité Territoriale',
    icon: Crown,
    gradient: 'from-purple-600 to-violet-700',
    description: 'Supervisez le recensement, validez les transactions foncières et délivrez les certificats officiels.',
    features: ['Certificats avec QR Code officiel', 'Enregistrement ventes & locations', 'Commissions coutumières'],
  },
  {
    id: 'BLOCK_LEADER',
    title: 'Chef de Bloc',
    badge: 'Sécurité de Proximité',
    icon: ShieldCheck,
    gradient: 'from-cyan-600 to-blue-700',
    description: 'Enrôlez les résidences de votre bloc, générez le QR d’adhésion et sécurisez votre secteur.',
    features: ['Recensement des foyers & maisons', 'Génération QR Code du bloc', 'Gestion des alertes de sécurité'],
  },
  {
    id: 'RESIDENT',
    title: 'Résident / Citoyen',
    badge: 'Communauté',
    icon: Users,
    gradient: 'from-rose-600 to-pink-600',
    description: 'Rattachez votre foyer à votre quartier, recevez les alertes et restez informé.',
    features: ['Attestation de résidence', 'Alertes de quartier en direct', 'Participation citoyenne'],
  },
];

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as any) || 'OWNER';
  const [selectedRole, setSelectedRole] = useState<RoleCard['id']>(
    ROLES_LIST.some((r) => r.id === initialRole) ? initialRole : 'OWNER'
  );
  const [formError, setFormError] = useState<string | null>(null);
  const { registerUser } = useSession();
  const navigate = useNavigate();

  const { register, handleSubmit, formState, setError } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      phone: '',
      role: selectedRole,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser({
        displayName: values.displayName,
        email: values.email,
        password: values.password,
        phone: values.phone,
        role: selectedRole,
      });

      // Redirection selon le rôle sélectionné
      if (selectedRole === 'TENANT') {
        navigate('/portal', { replace: true });
      } else if (selectedRole === 'AGENT') {
        navigate('/agent', { replace: true });
      } else if (selectedRole === 'NEIGHBORHOOD_LEADER' || selectedRole === 'BLOCK_LEADER' || selectedRole === 'RESIDENT') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        for (const detail of error.details ?? []) {
          if (detail.path === 'email' || detail.path === 'password' || detail.path === 'displayName') {
            setError(detail.path as any, { message: detail.message });
          }
        }
        setFormError(error.message);
        return;
      }
      setFormError('Une erreur est survenue lors de la création de votre compte. Veuillez réessayer.');
    }
  });

  const currentRoleCard: RoleCard = ROLES_LIST.find((r) => r.id === selectedRole) || ROLES_LIST[0]!;
  const IconComp = currentRoleCard.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 backdrop-blur-md"
          >
            <ArrowLeft className="size-4" />
            Retour à l'accueil
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:inline">Vous avez déjà un compte ?</span>
            <Link
              to="/sign-in"
              className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-4 py-2 rounded-xl transition-all"
            >
              Se connecter
            </Link>
          </div>
        </div>

        {/* Brand Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium tracking-wide">
            <Sparkles className="size-3.5" />
            Inscription Officielle KadtEstate
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Rejoignez l'écosystème immobilier de référence
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Choisissez votre statut pour activer votre interface sur-mesure : gestion locative, chefferie, sécurité de bloc ou marketplace.
          </p>
        </div>

        {/* Step 1: Select Role Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500 text-black text-xs font-bold">1</span>
              Sélectionnez votre profil
            </h2>
            <span className="text-xs text-slate-400">Profil actif : <strong className="text-emerald-400">{currentRoleCard.title}</strong></span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLES_LIST.map((role) => {
              const isSelected = selectedRole === role.id;
              const CardIcon = role.icon;
              return (
                <button
                  type="button"
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`text-left p-5 rounded-2xl border transition-all duration-300 relative group overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                      : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${role.gradient} text-white shadow-md`}>
                      <CardIcon className="size-5" />
                    </div>
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="size-3.5" /> Choisi
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-md">
                        {role.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-white text-base group-hover:text-emerald-300 transition-colors">
                    {role.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {role.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1">
                    {role.features.map((feat, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="size-1 rounded-full bg-emerald-400" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Registration Form */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500 text-black text-xs font-bold">2</span>
              <div>
                <h2 className="text-lg font-semibold text-white">Vos informations d'inscription</h2>
                <p className="text-xs text-slate-400">Création de votre compte <span className="text-emerald-400 font-medium">{currentRoleCard.title}</span></p>
              </div>
            </div>

            <form
              onSubmit={onSubmit}
              noValidate
              className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl"
            >
              {formError && (
                <div className="flex items-start gap-3 rounded-2xl bg-destructive/15 border border-destructive/30 p-4 text-xs text-rose-300">
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
                  <p>{formError}</p>
                </div>
              )}

              {/* Rôle Badge Display */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${currentRoleCard.gradient} text-white`}>
                  <IconComp className="size-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">Profil : {currentRoleCard.title}</p>
                  <p className="text-slate-400 text-[11px]">{currentRoleCard.description}</p>
                </div>
              </div>

              {/* Nom complet */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <User className="size-3.5 text-slate-400" />
                  Nom complet ou Raison sociale
                </label>
                <Input
                  placeholder="Ex: Jean Kouassi ou Cabinet Kouassi"
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-emerald-500 rounded-xl"
                  {...register('displayName')}
                />
                {formState.errors.displayName?.message && (
                  <p className="text-[11px] text-rose-400">{formState.errors.displayName.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-slate-400" />
                  Adresse email
                </label>
                <Input
                  type="email"
                  placeholder="nom@exemple.com"
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-emerald-500 rounded-xl"
                  {...register('email')}
                />
                {formState.errors.email?.message && (
                  <p className="text-[11px] text-rose-400">{formState.errors.email.message}</p>
                )}
              </div>

              {/* Numéro de téléphone */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Phone className="size-3.5 text-slate-400" />
                  Numéro Mobile Money (Optionnel mais recommandé pour les retraits Ikeepay)
                </label>
                <Input
                  type="tel"
                  placeholder="+225 0700000000"
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-emerald-500 rounded-xl"
                  {...register('phone')}
                />
                <p className="text-[10px] text-slate-500">Permet les réceptions et virements instantanés Orange Money, MTN MoMo, Wave, Moov.</p>
              </div>

              {/* Mot de passe */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Lock className="size-3.5 text-slate-400" />
                  Mot de passe sécurisé
                </label>
                <Input
                  type="password"
                  placeholder="Au moins 10 car., 1 majuscule, 1 chiffre"
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-emerald-500 rounded-xl"
                  {...register('password')}
                />
                {formState.errors.password?.message && (
                  <p className="text-[11px] text-rose-400">{formState.errors.password.message}</p>
                )}
              </div>

              {/* Bouton de soumission */}
              <Button
                type="submit"
                disabled={formState.isSubmitting}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-3.5 rounded-2xl shadow-xl shadow-emerald-500/20 text-sm transition-all transform active:scale-[0.99]"
              >
                {formState.isSubmitting ? 'Création de votre espace en cours...' : `Créer mon compte ${currentRoleCard.title}`}
              </Button>

              <p className="text-center text-[11px] text-slate-500">
                En créant un compte, vous acceptez les conditions d'utilisation de la plateforme KadtEstate et la charte de confidentialité foncière.
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}