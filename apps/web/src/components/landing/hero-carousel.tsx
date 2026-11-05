import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Edit2, Image as ImageIcon, Settings, Check, X } from 'lucide-react';
import { useSession } from '../../app/session';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface CarouselSlide {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor?: string;
}

const DEFAULT_SLIDES: CarouselSlide[] = [
  {
    id: 'slide-1',
    imageUrl: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=80',
    title: 'Résidences de Prestige & Villas Modernes',
    subtitle: 'Découvrez des biens d’exception vérifiés, baux juridiques certifiés et quittances infalsifiables.',
    badge: 'IMMOBILIER D’EXCEPTION',
    badgeColor: 'bg-emerald-500 text-slate-950',
  },
  {
    id: 'slide-2',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
    title: 'Chefferie Coutumière & Sécurité Urbaine',
    subtitle: 'Enrôlement citoyen, actes fonciers authentifiés par QR Code et veille communautaire de bloc.',
    badge: 'AUTORITÉ & SÉCURITÉ',
    badgeColor: 'bg-purple-500 text-white',
  },
  {
    id: 'slide-3',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1600&q=80',
    title: 'Paiements Instantanés Ikeepay H2H',
    subtitle: 'Réglez vos loyers et encaissez vos commissions en un clic via Orange Money, MTN, Wave et Moov.',
    badge: 'MOBILE MONEY EN DIRECT',
    badgeColor: 'bg-amber-400 text-slate-950',
  },
  {
    id: 'slide-4',
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80',
    title: 'Studios & Appartements Meublés',
    subtitle: 'Locations journalières, mensuelles et chambres modernes adaptées à tous vos séjours.',
    badge: 'LOCATION JOURNALIÈRE & MENSUELLE',
    badgeColor: 'bg-cyan-400 text-slate-950',
  },
];

const STORAGE_KEY = 'katdestate_hero_slides';

export function HeroCarousel() {
  const { user, memberships } = useSession();
  const userRole = memberships?.[0]?.role || (user as any)?.platformRole;
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const [slides, setSlides] = useState<CarouselSlide[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_SLIDES;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  // Auto-play
  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 5500);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide, slides.length]);

  const saveSlides = (newSlides: CarouselSlide[]) => {
    setSlides(newSlides);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSlides));
  };

  const currentSlide: CarouselSlide = slides[currentIndex] ?? slides[0] ?? DEFAULT_SLIDES[0]!;

  return (
    <div className="relative w-full max-w-5xl mx-auto my-6">
      
      {/* Super Admin Manage Button */}
      {isSuperAdmin && (
        <div className="absolute -top-10 right-0 z-20">
          <Button
            size="sm"
            onClick={() => setManagerOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg border border-purple-400/40 flex items-center gap-1.5"
          >
            <Settings className="size-3.5" />
            <span>Gérer le Carrousel (Admin)</span>
          </Button>
        </div>
      )}

      {/* Main Carousel Screen */}
      <div 
        className="relative h-[340px] sm:h-[420px] md:h-[480px] w-full rounded-3xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-950/80 group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Background Image with Smooth Fade */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 transform scale-100 group-hover:scale-105"
          style={{ backgroundImage: `url(${currentSlide.imageUrl})` }}
        />

        {/* Dynamic Multi-layered Gradient Overlays for readable text and brand colors */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#110222] via-[#110222]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#110222]/80 via-transparent to-[#110222]/40" />

        {/* Slide Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 md:p-12 text-left space-y-3 sm:space-y-4">
          
          {/* Badge */}
          {currentSlide.badge && (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] sm:text-xs font-black uppercase px-3 py-1 rounded-full shadow-md tracking-wider ${currentSlide.badgeColor || 'bg-[#00e676] text-slate-950'}`}>
                {currentSlide.badge}
              </span>
            </div>
          )}

          {/* Title */}
          <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight max-w-2xl drop-shadow-lg">
            {currentSlide.title}
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-base text-purple-200/90 max-w-xl font-medium leading-relaxed drop-shadow">
            {currentSlide.subtitle}
          </p>
        </div>

        {/* Navigation Arrows */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Image précédente"
              className="absolute left-3 top-1/2 -translate-y-1/2 size-10 sm:size-12 rounded-full bg-slate-950/60 hover:bg-[#00e676] text-white hover:text-slate-950 border border-white/20 backdrop-blur-md flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 shadow-xl"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Image suivante"
              className="absolute right-3 top-1/2 -translate-y-1/2 size-10 sm:size-12 rounded-full bg-slate-950/60 hover:bg-[#00e676] text-white hover:text-slate-950 border border-white/20 backdrop-blur-md flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 shadow-xl"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}

        {/* Bullet Indicators */}
        <div className="absolute bottom-4 right-6 sm:right-10 z-10 flex items-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Aller au slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'w-7 sm:w-8 bg-[#00e676] shadow-md shadow-[#00e676]/50'
                  : 'w-2 bg-white/40 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Super Admin Manager Modal */}
      {managerOpen && (
        <CarouselManagerModal
          slides={slides}
          onClose={() => setManagerOpen(false)}
          onSave={saveSlides}
        />
      )}
    </div>
  );
}

function CarouselManagerModal({
  slides,
  onClose,
  onSave,
}: {
  slides: CarouselSlide[];
  onClose: () => void;
  onSave: (slides: CarouselSlide[]) => void;
}) {
  const [list, setList] = useState<CarouselSlide[]>(slides);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states for adding or editing
  const [imageUrl, setImageUrl] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [badge, setBadge] = useState('NOUVEAU');

  const startEdit = (slide: CarouselSlide) => {
    setEditingId(slide.id);
    setImageUrl(slide.imageUrl);
    setTitle(slide.title);
    setSubtitle(slide.subtitle);
    setBadge(slide.badge);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setImageUrl('');
    setTitle('');
    setSubtitle('');
    setBadge('NOUVEAU');
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl || !title) return;

    if (editingId) {
      const updated = list.map((s) =>
        s.id === editingId
          ? { ...s, imageUrl, title, subtitle, badge }
          : s
      );
      setList(updated);
      onSave(updated);
      cancelEdit();
    } else {
      const newSlide: CarouselSlide = {
        id: `slide-${Date.now()}`,
        imageUrl,
        title,
        subtitle,
        badge,
        badgeColor: 'bg-emerald-500 text-slate-950',
      };
      const updated = [...list, newSlide];
      setList(updated);
      onSave(updated);
      cancelEdit();
    }
  };

  const handleDelete = (id: string) => {
    if (list.length <= 1) {
      alert('Il doit rester au moins une image dans le carrousel.');
      return;
    }
    const updated = list.filter((s) => s.id !== id);
    setList(updated);
    onSave(updated);
  };

  const handleResetDefaults = () => {
    if (confirm('Rétablir les images de démonstration par défaut ?')) {
      setList(DEFAULT_SLIDES);
      onSave(DEFAULT_SLIDES);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#180533] border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl text-white">
        
        <div className="flex items-center justify-between border-b border-purple-800/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <ImageIcon className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">Gestion du Carrousel d'Accueil</h3>
              <p className="text-xs text-purple-300">Ajoutez, modifiez ou retirez les visuels défilants en direct.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-purple-900/40 text-purple-300 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Formulaire d'ajout / modification */}
        <form onSubmit={handleSaveItem} className="p-4 rounded-2xl bg-purple-950/50 border border-purple-800/60 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#00e676]">
            {editingId ? 'Modifier cette diapositive' : 'Ajouter une nouvelle image'}
          </h4>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-purple-200">URL de l'image (haute résolution)</label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              required
              className="bg-purple-900/30 border-purple-700/60 text-white placeholder:text-purple-400/50 text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-purple-200">Titre principal</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Résidences de Standing"
                required
                className="bg-purple-900/30 border-purple-700/60 text-white placeholder:text-purple-400/50 text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-purple-200">Badge flottant</label>
              <Input
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Ex : NOUVEAU, OFFICIEL, PROMO"
                className="bg-purple-900/30 border-purple-700/60 text-white placeholder:text-purple-400/50 text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-purple-200">Sous-titre / Description</label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Ex : Découvrez les logements disponibles avec contrat certifié..."
              className="bg-purple-900/30 border-purple-700/60 text-white placeholder:text-purple-400/50 text-xs h-9"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            {editingId && (
              <Button type="button" variant="outline" size="sm" onClick={cancelEdit} className="text-xs">
                Annuler
              </Button>
            )}
            <Button type="submit" size="sm" className="bg-[#00e676] hover:bg-[#00c853] text-slate-950 font-bold text-xs">
              <Check className="size-3.5 mr-1" />
              {editingId ? 'Mettre à jour' : 'Ajouter au Carrousel'}
            </Button>
          </div>
        </form>

        {/* Liste des diapositives existantes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
              Diapositives actuelles ({list.length})
            </h4>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-[11px] text-purple-400 hover:text-white underline"
            >
              Rétablir visuels par défaut
            </button>
          </div>

          <div className="space-y-2">
            {list.map((slide, idx) => (
              <div
                key={slide.id}
                className="p-3 rounded-2xl bg-purple-950/40 border border-purple-900/60 flex items-center gap-3 justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="size-14 rounded-xl object-cover shrink-0 border border-purple-700/40"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        #{idx + 1}
                      </span>
                      <p className="text-xs font-bold truncate text-white">{slide.title}</p>
                    </div>
                    <p className="text-[11px] text-purple-300/80 truncate mt-0.5">{slide.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(slide)}
                    className="size-8 p-0 text-purple-300 hover:text-white border-purple-700/40"
                    title="Modifier"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(slide.id)}
                    className="size-8 p-0 text-rose-400 hover:text-white hover:bg-rose-600 border-rose-500/30"
                    title="Supprimer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-purple-800/60">
          <Button onClick={onClose} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-6">
            Terminer
          </Button>
        </div>

      </div>
    </div>
  );
}
