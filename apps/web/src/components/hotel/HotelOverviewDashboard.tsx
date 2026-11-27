import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BedDouble,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  DoorOpen,
  Hotel,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  PieChart as PieChartIcon,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSession } from '../../app/session';
import { apiRequest } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import type { HotelEstablishmentRecord } from './EstablishmentsManager';

type PeriodFilter = 'TODAY' | '7D' | '30D' | '90D' | '1Y';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  TODAY: 'Aujourd’hui',
  '7D': '7 derniers jours',
  '30D': '30 derniers jours',
  '90D': '90 derniers jours',
  '1Y': '12 derniers mois',
};

const ACTIVE_ESTABLISHMENT_KEY = 'katdestate_active_hotel_establishment_id';

function readLocalEstablishments(email?: string): HotelEstablishmentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(
      `katdestate_hotel_establishments_${(email || 'default').trim().toLowerCase()}`,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface HotelDashboardData {
  establishment: HotelEstablishmentRecord | null;
  period: PeriodFilter;
  kpis: {
    dailyRevenue: number;
    weeklyRevenue: number;
    monthlyRevenue: number;
    periodRevenue: number;
    revenueGrowthPct: number;
    currency: string;
    todayReservations: number;
    periodReservations: number;
    totalRooms: number;
    availableRooms: number;
    occupiedRooms: number;
    cleaningRooms: number;
    maintenanceRooms: number;
    occupancyRate: number;
    arrivalsToday: number;
    departuresToday: number;
  };
  charts: {
    revenueSeries: Array<{
      dateLabel: string;
      roomRevenue: number;
      restaurantRevenue: number;
      serviceRevenue: number;
      totalRevenue: number;
    }>;
    occupancySeries: Array<{ dateLabel: string; occupancyRate: number }>;
    bookingBreakdown: Array<{
      source: string;
      label: string;
      color: string;
      count: number;
      percentage: number;
    }>;
    monthlyComparison: Array<{
      month: string;
      revenue: number;
      reservations: number;
    }>;
  };
  recentReservations: Array<{
    _id: string;
    guestName: string;
    roomNumber?: string;
    source?: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    currency?: string;
    status: string;
  }>;
  recentTransactions: Array<{
    id: string;
    label: string;
    category: string;
    method: string;
    amount: number;
    currency: string;
    status: string;
    date: string;
  }>;
  recentActivities: Array<{
    _id: string;
    title: string;
    description?: string;
    actorName?: string;
    severity?: string;
    createdAt: string;
  }>;
  alerts: Array<{
    id: string;
    severity: 'WARNING' | 'ALERT' | 'INFO';
    title: string;
    detail: string;
  }>;
}

function buildEmptyDashboard(
  est: HotelEstablishmentRecord | null,
  period: PeriodFilter,
): HotelDashboardData {
  const totalRooms = est?.totalRooms ?? 0;
  const occupiedRooms = est?.occupiedRooms ?? 0;
  const availableRooms = Math.max(0, totalRooms - occupiedRooms);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return {
    establishment: est,
    period,
    kpis: {
      dailyRevenue: 0,
      weeklyRevenue: 0,
      monthlyRevenue: est?.estimatedMonthlyRevenue ?? 0,
      periodRevenue: 0,
      revenueGrowthPct: 0,
      currency: est?.currency || 'FCFA',
      todayReservations: 0,
      periodReservations: 0,
      totalRooms,
      availableRooms,
      occupiedRooms,
      cleaningRooms: 0,
      maintenanceRooms: est?.status === 'MAINTENANCE' ? totalRooms : 0,
      occupancyRate,
      arrivalsToday: 0,
      departuresToday: 0,
    },
    charts: {
      revenueSeries: [],
      occupancySeries: [],
      bookingBreakdown: [
        { source: 'DIRECT', label: 'Direct', color: '#2563eb', count: 0, percentage: 0 },
        { source: 'OTA', label: 'OTA (Booking, Expedia)', color: '#d97706', count: 0, percentage: 0 },
        { source: 'CORPORATE', label: 'Entreprise', color: '#10b981', count: 0, percentage: 0 },
        { source: 'WALK_IN', label: 'Passage (Walk-in)', color: '#8b5cf6', count: 0, percentage: 0 },
      ],
      monthlyComparison: [],
    },
    recentReservations: [],
    recentTransactions: [],
    recentActivities: [],
    alerts: [],
  };
}

export function HotelOverviewDashboard() {
  const { user, memberships } = useSession();
  const orgId = memberships?.[0]?.organizationId;

  const [establishments, setEstablishments] = useState<HotelEstablishmentRecord[]>(() =>
    readLocalEstablishments(user?.email),
  );
  const [activeEstablishmentId, setActiveEstablishmentId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(ACTIVE_ESTABLISHMENT_KEY) || '';
  });
  const [period, setPeriod] = useState<PeriodFilter>('30D');
  const [data, setData] = useState<HotelDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeEst = useMemo(
    () =>
      establishments.find((e) => e._id === activeEstablishmentId) || establishments[0] || null,
    [establishments, activeEstablishmentId],
  );

  const loadEstablishmentsAndDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    let estList = readLocalEstablishments(user?.email);
    let selectedId = activeEstablishmentId || estList[0]?._id || '';

    if (orgId) {
      try {
        const fetchedEst = await apiRequest<HotelEstablishmentRecord[]>(
          `/organizations/${orgId}/establishments`,
        );
        if (Array.isArray(fetchedEst) && fetchedEst.length > 0) {
          estList = fetchedEst;
          setEstablishments(fetchedEst);
          if (!selectedId || !fetchedEst.some((e) => e._id === selectedId)) {
            selectedId = fetchedEst[0]!._id;
            setActiveEstablishmentId(selectedId);
            localStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, selectedId);
          }
        }
      } catch {
        setEstablishments(estList);
      }

      try {
        const query = new URLSearchParams({ period });
        if (selectedId) query.set('establishmentId', selectedId);
        const dash = await apiRequest<HotelDashboardData>(
          `/organizations/${orgId}/hotel-dashboard?${query.toString()}`,
        );
        setData(dash);
        setLoading(false);
        return;
      } catch (err: any) {
        // Si l'API renvoie une vraie erreur serveur (500/403) alors qu'on a un orgId, on propose de réessayer tout en affichant les données disponibles
        if (err?.status >= 500) {
          setError('Impossible de charger les statistiques en temps réel depuis MongoDB.');
        }
      }
    }

    const fallbackEst = estList.find((e) => e._id === selectedId) || estList[0] || null;
    setData(buildEmptyDashboard(fallbackEst, period));
    setLoading(false);
  }, [orgId, user?.email, activeEstablishmentId, period]);

  useEffect(() => {
    void loadEstablishmentsAndDashboard();
  }, [loadEstablishmentsAndDashboard]);

  const handleSelectEstablishment = (id: string) => {
    setActiveEstablishmentId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, id);
    }
  };

  const kpis = data?.kpis ?? buildEmptyDashboard(activeEst, period).kpis;
  const charts = data?.charts ?? buildEmptyDashboard(activeEst, period).charts;

  const occupancyPieData = [
    { name: 'Occupées', value: kpis.occupiedRooms, color: '#10b981' },
    {
      name: 'Disponibles',
      value: Math.max(0, kpis.availableRooms),
      color: '#2563eb',
    },
    ...(kpis.maintenanceRooms > 0
      ? [{ name: 'Maintenance', value: kpis.maintenanceRooms, color: '#f43f5e' }]
      : []),
  ];
  const hasRoomsForPie = occupancyPieData.some((d) => d.value > 0);

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row min-h-[720px]">
      {/* Sidebar Bleu Nuit fidèle au design de référence */}
      <aside className="w-full lg:w-60 bg-[#0B1E40] text-white flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="size-9 rounded-xl bg-white text-[#0B1E40] flex items-center justify-center font-black text-lg shadow">
              K
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight block leading-none">
                KadtEstate
              </span>
              <span className="text-[10px] text-blue-200/80 uppercase tracking-wider font-semibold">
                Gestion Hôtelière
              </span>
            </div>
          </div>

          <nav className="space-y-1 text-sm">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium bg-blue-600 text-white shadow-md shadow-blue-900/40"
            >
              <LayoutDashboard className="size-4 shrink-0" />
              <span>Vue générale</span>
            </Link>
            <Link
              to="/hotel/establishments"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <Hotel className="size-4 shrink-0" />
              <span>Établissements</span>
            </Link>
            <Link
              to="/hotel/reservations"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <CalendarCheck className="size-4 shrink-0" />
              <span>Réservations</span>
            </Link>
            <Link
              to="/hotel/rooms"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <BedDouble className="size-4 shrink-0" />
              <span>Chambres</span>
            </Link>
            <Link
              to="/hotel/crm"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <Users className="size-4 shrink-0" />
              <span>Clients</span>
            </Link>
            <Link
              to="/hotel/checkin-out"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <DoorOpen className="size-4 shrink-0" />
              <span>Réception (In/Out)</span>
            </Link>
            <Link
              to="/hotel/billing"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <Receipt className="size-4 shrink-0" />
              <span>Facturation</span>
            </Link>
            <Link
              to="/hotel/restaurant"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <UtensilsCrossed className="size-4 shrink-0" />
              <span>Restaurant</span>
            </Link>
            <Link
              to="/hotel/services"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <Sparkles className="size-4 shrink-0" />
              <span>Services</span>
            </Link>
            <Link
              to="/hotel/accounting"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <PieChartIcon className="size-4 shrink-0" />
              <span>Rapports</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
        {/* Top Bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {activeEst?.name || data?.establishment?.name || 'Mon Établissement Hôtelier'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Bienvenue, {user?.displayName || 'Admin'} !
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sélecteur d'établissement actif */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Building2 className="size-4 text-blue-600 shrink-0" />
              <select
                aria-label="Sélectionner l'établissement actif"
                value={activeEst?._id || ''}
                onChange={(e) => handleSelectEstablishment(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                {establishments.length === 0 ? (
                  <option value="">Aucun établissement</option>
                ) : (
                  establishments.map((est) => (
                    <option key={est._id} value={est._id} className="text-slate-900">
                      {est.name} ({est.city})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Filtre par période */}
            <select
              aria-label="Filtre par période"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              {Object.entries(PERIOD_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadEstablishmentsAndDashboard()}
              disabled={loading}
              className="h-9 gap-1.5 text-xs font-bold rounded-xl"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </Button>

            <div className="hidden sm:flex items-center justify-center size-9 rounded-full bg-blue-600 text-white text-xs font-bold shadow-sm">
              {(user?.displayName || 'A').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-center justify-between gap-3 text-xs text-rose-600">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => void loadEstablishmentsAndDashboard()}>
                Réessayer
              </Button>
            </div>
          )}

          {loading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="size-8 animate-spin text-blue-600" />
              <p className="text-sm font-semibold">Chargement des données hôtelières…</p>
            </div>
          ) : (
            <>
              {/* 4 Cartes KPI principales (style exact de l'image de référence) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* KPI 1 : Revenus */}
                <Card className="border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                        <DollarSign className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-black text-slate-900 dark:text-white truncate">
                          {kpis.monthlyRevenue.toLocaleString('fr-FR')}{' '}
                          <span className="text-xs font-bold text-slate-500">{kpis.currency}</span>
                        </p>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-500 font-medium">Revenus (mois)</span>
                          <span
                            className={`inline-flex items-center font-bold ${
                              kpis.revenueGrowthPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {kpis.revenueGrowthPct >= 0 ? (
                              <ArrowUpRight className="size-3" />
                            ) : (
                              <ArrowDownRight className="size-3" />
                            )}
                            {kpis.revenueGrowthPct >= 0 ? '+' : ''}
                            {kpis.revenueGrowthPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-emerald-200/50 dark:border-emerald-900/30">
                      <span>Jour : {kpis.dailyRevenue.toLocaleString('fr-FR')}</span>
                      <span>Semaine : {kpis.weeklyRevenue.toLocaleString('fr-FR')}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* KPI 2 : Réservations */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-2xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                        <CalendarCheck className="size-5" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-slate-900 dark:text-white">
                          {kpis.periodReservations}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          Réservations ({PERIOD_LABELS[period]})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Aujourd’hui : {kpis.todayReservations}</span>
                      <span className="text-blue-600 font-semibold">
                        {charts.bookingBreakdown[0]?.percentage ?? 0}% Direct
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* KPI 3 : Taux d'occupation & Chambres */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                        <BedDouble className="size-5" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-slate-900 dark:text-white">
                          {kpis.occupancyRate}%
                        </p>
                        <p className="text-xs text-slate-500 font-medium">Taux d’occupation</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-emerald-600 font-semibold">
                        {kpis.availableRooms} disponibles
                      </span>
                      <span className="text-blue-600 font-semibold">
                        {kpis.occupiedRooms} occupées
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* KPI 4 : Arrivées & Départs prévus */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-2xl bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
                        <LogOut className="size-5" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-slate-900 dark:text-white">
                          {kpis.departuresToday}{' '}
                          <span className="text-xs font-semibold text-slate-400">départs</span>
                        </p>
                        <p className="text-xs text-slate-500 font-medium">Mouvements du jour</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <LogIn className="size-3" /> {kpis.arrivalsToday} arrivées prévues
                      </span>
                      <span>{kpis.totalRooms} ch. total</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Rangée 2 : Évolution des revenus + Taux d'occupation (Donut) + Répartition */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Graphique 1 : Évolution des revenus */}
                <Card className="lg:col-span-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Évolution des revenus ({PERIOD_LABELS[period]})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Chambres, Restaurant & Services
                      </p>
                    </div>
                    <TrendingUp className="size-4 text-blue-600" />
                  </div>

                  {charts.revenueSeries.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                      Aucune transaction enregistrée sur cette période
                    </div>
                  ) : (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={charts.revenueSeries}>
                          <defs>
                            <linearGradient id="hotelRevGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={45} />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="totalRevenue"
                            name={`Revenus (${kpis.currency})`}
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            fill="url(#hotelRevGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                {/* Graphique 2 : Taux d'occupation (Donut + Courbe) */}
                <Card className="lg:col-span-3 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white text-center">
                    Taux d’occupation
                  </h3>
                  <div className="h-44 relative flex items-center justify-center">
                    {hasRoomsForPie ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={occupancyPieData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={52}
                              outerRadius={72}
                              paddingAngle={3}
                            >
                              {occupancyPieData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-black text-slate-900 dark:text-white">
                            {kpis.occupancyRate}%
                          </span>
                          <span className="text-[10px] text-slate-400">Occupé</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 text-center px-4">
                        Ajoutez des chambres pour suivre le taux d’occupation
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="size-2.5 rounded-full bg-emerald-500" />
                      Occupées ({kpis.occupiedRooms})
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="size-2.5 rounded-full bg-blue-600" />
                      Dispo ({kpis.availableRooms})
                    </span>
                  </div>
                </Card>

                {/* Graphique 3 : Répartition des réservations */}
                <Card className="lg:col-span-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Répartition des réservations
                  </h3>
                  <div className="space-y-3">
                    {charts.bookingBreakdown.map((item) => (
                      <div key={item.source} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            {item.label}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.percentage}% ({item.count})
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Rangée 3 : Comparaison des performances mensuelles + Alertes */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <Card className="lg:col-span-8 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Comparaison des performances mensuelles (6 mois)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Revenus encaissés & volume de réservations
                      </p>
                    </div>
                  </div>
                  {charts.monthlyComparison.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                      Aucune donnée mensuelle disponible
                    </div>
                  ) : (
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.monthlyComparison}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 10 }} width={45} />
                          <Tooltip />
                          <Bar
                            dataKey="revenue"
                            name={`Revenus (${kpis.currency})`}
                            fill="#2563eb"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="reservations"
                            name="Réservations"
                            fill="#10b981"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                {/* Alertes */}
                <Card className="lg:col-span-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Bell className="size-4 text-rose-500" />
                      Alertes opérationnelles
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">
                      {data?.alerts.length ?? 0}
                    </span>
                  </div>
                  {!data?.alerts || data.alerts.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                      <CheckCircle2 className="size-6 text-emerald-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Aucune alerte critique
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Tous les services hôteliers fonctionnent normalement.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                      {data.alerts.map((al) => (
                        <div
                          key={al.id}
                          className={`p-3 rounded-xl border text-xs ${
                            al.severity === 'ALERT'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                              : al.severity === 'WARNING'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                                : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          <p className="font-bold">{al.title}</p>
                          <p className="text-[11px] opacity-85 mt-0.5">{al.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Rangée 4 : Dernières réservations + Dernières transactions + Activités récentes */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Dernières réservations */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CalendarCheck className="size-4 text-blue-600" />
                      Dernières réservations
                    </h3>
                    <Link to="/hotel/reservations" className="text-xs font-semibold text-blue-600">
                      Tout voir
                    </Link>
                  </div>
                  {!data?.recentReservations || data.recentReservations.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      Aucune réservation enregistrée pour cet établissement.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.recentReservations.map((r) => (
                        <div
                          key={r._id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {r.guestName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {r.roomNumber ? `Ch. ${r.roomNumber} • ` : ''}
                              {new Date(r.checkInDate).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-emerald-600">
                              {r.totalAmount.toLocaleString('fr-FR')} {r.currency || kpis.currency}
                            </p>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {r.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Dernières transactions */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="size-4 text-emerald-600" />
                      Dernières transactions
                    </h3>
                    <Link to="/hotel/billing" className="text-xs font-semibold text-blue-600">
                      Facturation
                    </Link>
                  </div>
                  {!data?.recentTransactions || data.recentTransactions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      Aucune transaction enregistrée (chambres, restaurant, services).
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.recentTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {tx.label}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {tx.category} • {tx.method}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-blue-600">
                              +{tx.amount.toLocaleString('fr-FR')} {tx.currency}
                            </p>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {new Date(tx.date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Activités récentes */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Activity className="size-4 text-purple-600" />
                      Activités récentes
                    </h3>
                  </div>
                  {!data?.recentActivities || data.recentActivities.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      Aucune activité récente enregistrée.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.recentActivities.map((act) => (
                        <div
                          key={act._id}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs"
                        >
                          <Clock className="size-3.5 text-purple-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {act.title}
                            </p>
                            {act.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1">
                                {act.description}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400">
                              {new Date(act.createdAt).toLocaleString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
