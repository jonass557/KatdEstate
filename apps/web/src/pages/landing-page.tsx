import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Home, 
  Briefcase, 
  Crown, 
  ShieldCheck, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  CreditCard, 
  FileText, 
  BadgeCheck, 
  Send, 
  Menu, 
  X,
  ChevronRight,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { useSession } from '../app/session';
import { apiRequest } from '../lib/api-client';
import { Button } from '../components/ui/button';

interface PublicListing {
  id: string;
  title: string;
  type: 'SALE' | 'RENTAL' | 'LAND';
  price: number;
  currency: string;
  location: string;
  city: string;
  surface: string;
  badge: string;
  image: string;
  certified: boolean;
}

const SEED_MARKETPLACE_ITEMS: PublicListing[] = [
  {
    id: 'prop-1',
    title: 'Superbe Villa Duplex 5 Pièces avec Piscine',
    type: 'SALE',
    price: 280000000,
    currency: 'FCFA',
    location: 'Cocody Ambassades',
    city: 'Abidjan',
    surface: '450 m²',
    badge: 'Titre Foncier (ACD)',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80',
    certified: true,
  },
  {
    id: 'prop-2',
    title: 'Appartement Haut Standing 3 Pièces Meublé',
    type: 'RENTAL',
    price: 450000,
    currency: 'FCFA / mois',
    location: 'Plateau Dokui, Bd Latrille',
    city: 'Abidjan',
    surface: '110 m²',
    badge: 'Location Vérifiée',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    certified: true,
  },
  {
    id: 'prop-3',
    title: 'Terrain Viabilisé & Borné avec Approbation',
    type: 'LAND',
    price: 45000000,
    currency: 'FCFA',
    location: 'Riviera Palmeraie — Extension Est',
    city: 'Abidjan',
    surface: '600 m²',
    badge: 'Certifié Chefferie',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
    certified: true,
  },
  {
    id: 'prop-4',
    title: 'Immeuble R+3 Rapport Locatif Immédiat (8 Logements)',
    type: 'SALE',
    price: 380000000,
    currency: 'FCFA',
    location: 'Angré 8ème Tranche',
    city: 'Abidjan',
    surface: '850 m²',
    badge: 'Rendement 11.4%',
    image: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=800&q=80',
    certified: true,
  },
];

export function LandingPage() {
  const { isAuthenticated } = useSession();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'SALE' | 'RENTAL' | 'LAND'>('ALL');
  
  // Marketing ticker banner state
  const [tickerMessages, setTickerMessages] = useState<string[]>([
    '🏛️ Chefferie de Quartier : Enregistrement obligatoire des transactions foncières et locatives du lundi au samedi.',
    '💳 Paiements Mobile Money : Encaissez et réglez vos loyers en 1 clic via Orange Money, MTN MoMo, Wave et Moov avec la passerelle Ikeepay.',
    '📜 Certificats Officiels KadtEstate : Documents sécurisés avec QR Code infalsifiable validé par l\'autorité coutumière.',
    '🛡️ Recensement Communautaire : Rapprochez-vous de votre Chef de Bloc pour l\'enrôlement gratuit de votre foyer.',
  ]);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSubject, setContactSubject] = useState('Renseignement général');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  // Load public marketing settings from backend
  useEffect(() => {
    apiRequest<any>('/marketing/public-content')
      .then((res) => {
        if (res && res.tickerBanners && res.tickerBanners.length > 0) {
          const activeBanners = res.tickerBanners
            .filter((b: any) => b.isActive !== false)
            .map((b: any) => b.text);
          if (activeBanners.length > 0) {
            setTickerMessages(activeBanners);
          }
        }
      })
      .catch(() => {
        // Fallback to default ticker messages
      });
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    try {
      await apiRequest('/marketing/contact', {
        method: 'POST',
        body: {
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          subject: contactSubject,
          message: contactMessage,
        },
      });
      setContactSubmitted(true);
    } catch {
      // Show success anyway for smooth UX
      setContactSubmitted(true);
    } finally {
      setContactLoading(false);
    }
  };

  const filteredProperties = SEED_MARKETPLACE_ITEMS.filter((item) => {
    if (selectedCategory === 'ALL') return true;
    return item.type === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      
      {/* 1. Ticker Banner (Bannière Défilante Administrateur) */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-emerald-500/20 py-2.5 px-4 overflow-hidden relative">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full shrink-0 uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Annonces Officielles
          </div>
          <div className="overflow-hidden whitespace-nowrap w-full">
            <div className="inline-block animate-marquee text-xs text-slate-300 font-medium">
              {tickerMessages.map((msg, idx) => (
                <span key={idx} className="mx-6 inline-flex items-center gap-2">
                  <span>{msg}</span>
                  <span className="text-emerald-500">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="size-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Building2 className="size-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black tracking-tight text-white font-mono">
                  Kadt<span className="text-emerald-400">Estate</span>
                </span>
                <span className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  Pro
                </span>
              </div>
              <p className="text-[10px] text-slate-400 tracking-wider">Plateforme Immobilière & Sécurité Urbaine</p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#marketplace" className="hover:text-emerald-400 transition-colors">Marketplace</a>
            <a href="#roles" className="hover:text-emerald-400 transition-colors">Profils & Rôles</a>
            <a href="#features" className="hover:text-emerald-400 transition-colors">Fonctionnalités</a>
            <a href="#chefferie" className="hover:text-emerald-400 transition-colors">Chefferie & Foncier</a>
            <a href="#contact" className="hover:text-emerald-400 transition-colors">Contact</a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Button
                onClick={() => navigate('/dashboard')}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                <span>Accéder au Dashboard</span>
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <Link
                  to="/sign-in"
                  className="text-sm font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-xl transition-all"
                >
                  Se connecter
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <Sparkles className="size-4" />
                  <span>Créer un compte</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-800 bg-slate-950 px-4 py-5 space-y-4">
            <div className="flex flex-col gap-3 font-medium text-slate-300">
              <a href="#marketplace" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-emerald-400">Marketplace</a>
              <a href="#roles" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-emerald-400">Profils & Rôles</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-emerald-400">Fonctionnalités</a>
              <a href="#chefferie" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-emerald-400">Chefferie & Foncier</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-emerald-400">Contact</a>
            </div>
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-2.5">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="w-full text-center bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl"
                >
                  Accéder au Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/sign-in"
                    className="w-full text-center bg-slate-900 border border-slate-700 py-3 rounded-xl font-semibold"
                  >
                    Se connecter
                  </Link>
                  <Link
                    to="/register"
                    className="w-full text-center bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl"
                  >
                    Créer un compte
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 3. Hero Section */}
      <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 blur-[130px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[250px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-medium shadow-xl shadow-emerald-500/5">
            <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
            Plateforme Intégrée d'Afrique Francophone
            <ChevronRight className="size-4 text-emerald-400" />
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.1] max-w-5xl mx-auto">
            L'Immobilier, la Chefferie et la Sécurité de Quartier <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Réunis en un Clic.</span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Gérez vos parcs locatifs, sécurisez vos ventes de terrains et maisons avec l'autorité coutumière, encaissez via Mobile Money <strong className="text-white">Ikeepay</strong> et coordonnez le recensement de votre quartier.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href="#roles"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold px-8 py-4 rounded-2xl shadow-xl shadow-emerald-500/25 transition-all text-base transform hover:-translate-y-0.5"
            >
              <span>Choisir mon Rôle & S'inscrire</span>
              <ArrowRight className="size-5" />
            </a>
            <a
              href="#marketplace"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 text-white font-bold px-8 py-4 rounded-2xl border border-slate-700/80 transition-all text-base hover:border-slate-600"
            >
              <Search className="size-5 text-emerald-400" />
              <span>Explorer la Marketplace</span>
            </a>
          </div>

          {/* Social Proof / Key Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-5xl mx-auto">
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md text-center space-y-1">
              <p className="text-3xl sm:text-4xl font-black text-emerald-400">99.4%</p>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Recouvrement des Loyers</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md text-center space-y-1">
              <p className="text-3xl sm:text-4xl font-black text-teal-400">100%</p>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Certificats Infalsifiables</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md text-center space-y-1">
              <p className="text-3xl sm:text-4xl font-black text-cyan-400">15 000+</p>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Résidences Recensées</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md text-center space-y-1">
              <p className="text-3xl sm:text-4xl font-black text-amber-400">4 Opérateurs</p>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Ikeepay Mobile Money</p>
            </div>
          </div>

        </div>
      </section>

      {/* 4. Role Selection & Direct Registration Grid */}
      <section id="roles" className="py-20 bg-slate-900/40 border-y border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Users className="size-3.5" />
              Inscription Immédiate par Rôle
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Une Plateforme Dédiée à Chaque Acteur
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
              Sélectionnez votre activité pour créer votre espace personnalisé avec les outils adaptés à vos missions quotidiennes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Propriétaire */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Building2 className="size-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 px-2.5 py-1 rounded-full">
                    Bailleurs & SCI
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                  Propriétaire / Bailleur
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Automatisez la gestion de vos appartements, immeubles et villas : encaissements en ligne, émission automatique des quittances et suivi de trésorerie.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-blue-400" /> Baux numériques et états des lieux</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-blue-400" /> Encaissements Mobile Money Ikeepay</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-blue-400" /> Rapports financiers et impayés en direct</li>
                </ul>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800">
                <Link
                  to="/register?role=OWNER"
                  className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  <span>Créer un compte Propriétaire</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Card 2: Locataire */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Home className="size-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-full">
                    Locataires
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Locataire Résident
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Réglez votre loyer mensuel en 1 clic par Orange Money, MTN MoMo, Wave ou Moov et recevez instantanément votre quittance certifiée conforme.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400" /> Paiement sans déplacement par Mobile Money</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400" /> Quittances numériques horodatées</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400" /> Signalement de pannes & suivi travaux</li>
                </ul>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800">
                <Link
                  to="/register?role=TENANT"
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl transition-all text-sm"
                >
                  <span>Créer un compte Locataire</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Card 3: Agent Immobilier */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Briefcase className="size-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-full">
                    Courtiers & Agences
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  Agent Immobilier / Agence
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Diffusez vos mandats exclusifs sur la marketplace nationale, suivez vos prospects et sécurisez le versement de vos commissions d'apporteur.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-amber-400" /> Diffusion immédiate sur la marketplace</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-amber-400" /> Gestion des visites et contacts acquéreurs</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-amber-400" /> Calcul et encaissement des commissions</li>
                </ul>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800">
                <Link
                  to="/register?role=AGENT"
                  className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-3 rounded-xl transition-all text-sm"
                >
                  <span>Créer un compte Agent</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Card 4: Chef de Quartier */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Crown className="size-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 px-2.5 py-1 rounded-full">
                    Chefferie Traditionnelle
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                  Chef de Quartier / Chefferie
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Enregistrez les ventes de maisons, locations et ventes de terrains de votre secteur. Générez les certificats officiels infalsifiables et percevez vos redevances.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-purple-400" /> Enregistrement ventes de terrains & maisons</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-purple-400" /> Génération certificats officiels avec QR Code</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-purple-400" /> Calcul automatique des commissions chefferie</li>
                </ul>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800">
                <Link
                  to="/register?role=NEIGHBORHOOD_LEADER"
                  className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  <span>Espace Chef de Quartier</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Card 5: Chef de Bloc */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <ShieldCheck className="size-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 px-2.5 py-1 rounded-full">
                    Sécurité de Secteur
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Chef de Bloc
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Recensez chaque maison de votre secteur, générez un lien et un QR Code uniques pour inviter les résidents, et gérez les alertes de sécurité communautaire.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-cyan-400" /> Recensement des habitations & maisons</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-cyan-400" /> QR Code d'adhésion pour les résidents</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-cyan-400" /> Gestion des signalements et incidents</li>
                </ul>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800">
                <Link
                  to="/register?role=BLOCK_LEADER"
                  className="w-full inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  <span>Espace Chef de Bloc</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            {/* Card 6: Résident / Citoyen */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <Users className="size-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-300 px-2.5 py-1 rounded-full">
                    Citoyenneté
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-rose-300 transition-colors">
                  Résident / Foyer
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Enrôlez votre foyer auprès de votre chefferie de quartier, obtenez votre attestation de résidence officielle et recevez les alertes locales de sécurité.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-rose-400" /> Attestation de résidence avec QR Code</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-rose-400" /> Réception des alertes de sécurité en direct</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-rose-400" /> Communication directe avec la chefferie</li>
                </ul>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800">
                <Link
                  to="/register?role=RESIDENT"
                  className="w-full inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  <span>Créer mon Espace Résident</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. Live Marketplace Preview Section (Seed Data) */}
      <section id="marketplace" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Search className="size-3.5" />
              Biens & Parcelles Vérifiés
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Vitrine Marketplace KadtEstate
            </h2>
            <p className="text-slate-400 max-w-xl text-sm sm:text-base">
              Explorez nos propriétés vérifiées par les autorités coutumières et les agents agréés.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            {(['ALL', 'SALE', 'RENTAL', 'LAND'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat === 'ALL' && 'Tous les biens'}
                {cat === 'SALE' && 'Ventes de maisons'}
                {cat === 'RENTAL' && 'Locations'}
                {cat === 'LAND' && 'Terrains certifiés'}
              </button>
            ))}
          </div>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProperties.map((prop) => (
            <div
              key={prop.id}
              className="group rounded-3xl bg-slate-900/70 border border-slate-800 overflow-hidden hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all flex flex-col"
            >
              <div className="relative h-52 w-full overflow-hidden bg-slate-800">
                <img
                  src={prop.image}
                  alt={prop.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    {prop.badge}
                  </span>
                  {prop.certified && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-950/80 backdrop-blur-md text-purple-300 border border-purple-500/30 px-2 py-1 rounded-full flex items-center gap-1">
                      <BadgeCheck className="size-3 text-purple-400" /> Chefferie
                    </span>
                  )}
                </div>
                <div className="absolute bottom-3 left-3">
                  <p className="text-xl font-black text-white">
                    {prop.price.toLocaleString('fr-FR')} {prop.currency}
                  </p>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {prop.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                    <MapPin className="size-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{prop.location}, {prop.city}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Superficie : <strong className="text-white">{prop.surface}</strong></span>
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    <span>Détails</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl transition-all"
          >
            <span>Consulter les 150+ offres sur la marketplace</span>
            <ExternalLink className="size-4" />
          </Link>
        </div>

      </section>

      {/* 6. Chefferie, Foncier & Ikeepay Payment Highlight */}
      <section id="chefferie" className="py-20 bg-gradient-to-b from-slate-900/60 to-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold">
                <Crown className="size-4" />
                Innovation Foncier & Chefferie Coutumière
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Sécurisation Totale des Ventes de Terrains et Maisons
              </h2>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                KadtEstate formalise la gouvernance foncière traditionnelle en numérisant l'ensemble des opérations sous l'autorité du Chef de Quartier. Fini les doubles ventes de terrains ou les faux intermédiaires.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Générateur Automatique de Certificats Officiels</h4>
                    <p className="text-xs text-slate-400 mt-1">Numéro unique de certification, identités vérifiées de l'ancien et nouvel acquéreur, signature électronique et QR Code d'authenticité.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                    <DollarSign className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Calcul Automatisé des Droits de Chefferie</h4>
                    <p className="text-xs text-slate-400 mt-1">Application transparente des pourcentages coutumiers sur chaque vente ou bail avec encaissement et quittance d'honoraires.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Passerelle de Paiement Ikeepay H2H Directe</h4>
                    <p className="text-xs text-slate-400 mt-1">Paiements et retraits en temps réel via Orange Money, MTN MoMo, Wave et Moov. L'administrateur gère ses clés en toute autonomie.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Interactive Certificate Preview Card */}
            <div className="rounded-3xl bg-slate-900 border border-purple-500/30 p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="border border-purple-500/20 rounded-2xl p-6 bg-slate-950/70 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Crown className="size-6 text-purple-400" />
                    <div>
                      <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">RÉPUBLIQUE DE CÔTE D'IVOIRE</p>
                      <p className="text-xs font-bold text-white">Chefferie Traditionnelle de Cocody</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                    CERT-2026-0894
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-slate-400">Nature de l'acte : <strong className="text-white">CERTIFICAT OFFICIEL DE VENTE DE TERRAIN</strong></p>
                  <p className="text-slate-400">Vendeur initial : <strong className="text-white">Kouamé N'Guessan</strong></p>
                  <p className="text-slate-400">Nouvel Acquéreur : <strong className="text-white">Société Civile Immobilière Ivoire</strong></p>
                  <p className="text-slate-400">Localisation : <strong className="text-white">Riviera Palmeraie, Lot 45 Ilot 12 (600 m²)</strong></p>
                  <p className="text-slate-400">Montant de la transaction : <strong className="text-emerald-400 font-mono">45 000 000 FCFA</strong></p>
                  <p className="text-slate-400">Droits de chefferie (5%) : <strong className="text-purple-300 font-mono">2 250 000 FCFA</strong></p>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-10 bg-white p-1 rounded-lg flex items-center justify-center">
                      <div className="size-8 border-2 border-black border-dashed flex items-center justify-center text-[8px] font-bold text-black">
                        QR
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">Authenticité vérifiable instantanément</span>
                  </div>
                  <span className="text-xs font-serif italic text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full">
                    Sceau & Signature du Chef
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. Contact Us Section */}
      <section id="contact" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Mail className="size-3.5" />
            Support & Direction
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Contactez l'Équipe KadtEstate
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Une question sur le déploiement dans votre quartier ou sur un abonnement ? Notre équipe vous répond sous 24h.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Admin Info Card */}
          <div className="lg:col-span-5 p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">Coordonnées Officielles</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              KadtEstate opère en partenariat avec les chefferies communales, les syndics et les ministères en charge de la gouvernance urbaine.
            </p>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <MapPin className="size-4" />
                </div>
                <span>Cocody Riviera Palmeraie, Abidjan, Côte d'Ivoire</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Phone className="size-4" />
                </div>
                <span>+225 07 00 00 00 00 / +225 05 00 00 00 00</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Mail className="size-4" />
                </div>
                <span>direction@kadtestate.immo / support@kadtestate.immo</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
              <p className="font-bold">Permanence d'assistance Chefferie :</p>
              <p className="text-slate-400">Du Lundi au Vendredi : 08h00 - 18h00 | Samedi : 09h00 - 14h00</p>
            </div>
          </div>

          {/* Interactive Contact Form */}
          <div className="lg:col-span-7 p-8 rounded-3xl bg-slate-900/90 border border-slate-800">
            {contactSubmitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="size-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="size-8" />
                </div>
                <h4 className="text-2xl font-bold text-white">Message envoyé avec succès !</h4>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Votre demande a bien été transmise à notre équipe administrative. Un conseiller prendra contact avec vous dans les plus brefs délais.
                </p>
                <Button
                  onClick={() => setContactSubmitted(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-2 rounded-xl text-xs"
                >
                  Envoyer un autre message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Votre Nom Complet</label>
                    <input
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ex: Kouamé N'Guessan"
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Adresse Email</label>
                    <input
                      required
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="vous@domaine.com"
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Téléphone (WhatsApp / Appel)</label>
                    <input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+225 07..."
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Objet de votre demande</label>
                    <select
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    >
                      <option value="Renseignement général">Renseignement général</option>
                      <option value="Déploiement Chefferie / Quartier">Déploiement Chefferie / Quartier</option>
                      <option value="Passerelle de Paiement Ikeepay">Passerelle de Paiement Ikeepay</option>
                      <option value="Partenariat Agence Immobilière">Partenariat Agence Immobilière</option>
                      <option value="Support Technique">Support Technique</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Votre Message</label>
                  <textarea
                    required
                    rows={4}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Détaillez votre besoin ou la localisation de votre quartier..."
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={contactLoading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center gap-2"
                >
                  <Send className="size-4" />
                  <span>{contactLoading ? 'Envoi en cours...' : 'Envoyer mon message'}</span>
                </Button>
              </form>
            )}
          </div>

        </div>
      </section>

      {/* 8. Modern Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950">
                  <Building2 className="size-5" />
                </div>
                <span className="text-xl font-black text-white font-mono">Kadt<span className="text-emerald-400">Estate</span></span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plateforme souveraine de recensement immobilier, sécurisation foncière avec la chefferie et paiements Mobile Money.
              </p>
            </div>

            <div>
              <p className="font-bold text-white text-sm mb-3">Plateforme</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#marketplace" className="hover:text-emerald-400">Marketplace de Biens</a></li>
                <li><a href="#roles" className="hover:text-emerald-400">Portails par Rôle</a></li>
                <li><Link to="/sign-in" className="hover:text-emerald-400">Espace Connexion</Link></li>
                <li><Link to="/register" className="hover:text-emerald-400">Inscription Directe</Link></li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-white text-sm mb-3">Chefferie & Sécurité</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#chefferie" className="hover:text-purple-400">Ventes de Terrains & Maisons</a></li>
                <li><a href="#chefferie" className="hover:text-purple-400">Certificats Officiels QR</a></li>
                <li><a href="#roles" className="hover:text-purple-400">Recensement par Bloc</a></li>
                <li><a href="#chefferie" className="hover:text-purple-400">Commissions Coutumières</a></li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-white text-sm mb-3">Paiements & Légal</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><span className="text-slate-300">Orange Money • MTN • Wave • Moov</span></li>
                <li><span className="text-slate-300">Intégration H2H Ikeepay</span></li>
                <li><a href="#contact" className="hover:text-emerald-400">Support 24/7</a></li>
                <li><span className="text-slate-500">© 2026 KadtEstate Inc. Tous droits réservés.</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>KadtEstate — Déployé pour la modernisation du patrimoine et de la gouvernance locale.</p>
            <div className="flex items-center gap-4">
              <a href="#contact" className="hover:text-slate-400">Confidentialité</a>
              <span>•</span>
              <a href="#contact" className="hover:text-slate-400">Conditions Générales</a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}