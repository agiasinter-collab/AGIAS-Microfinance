import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleLabel, formatXOF } from '@/data/agias-data';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Users, CreditCard, AlertTriangle, CheckCircle, DollarSign, ShieldAlert, ArrowRight, Bell, Calendar, ChevronRight } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 28, scale: 0.92 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 20, mass: 0.8 } },
};

function ChartCard({ title, subtitle, icon, onClick, children, delay = 0 }: { title: string; subtitle: string; icon: React.ReactNode; onClick?: () => void; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 20 }}
      className="group bg-card/80 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-[var(--shadow)] hover:shadow-[var(--shadow-lg)] transition-[box-shadow,border-color] duration-500 border border-border/40 hover:border-primary/20 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <div className="text-sm sm:text-[15px] font-bold text-foreground tracking-tight group-hover:text-primary transition-colors duration-300">{title}</div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        {onClick ? (
          <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.15, rotate: 8 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 flex items-center justify-center transition-colors duration-300 cursor-pointer border border-primary/10"
          >
            {icon}
          </motion.button>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center border border-border/30 group-hover:border-primary/20 transition-colors duration-300">
            {icon}
          </div>
        )}
      </div>
      {children}
    </motion.div>
  );
}

interface DashboardProps {
  onNavigate: (page: string) => void;
  onShowProfil: (id: string) => void;
}

export default function DashboardPage({ onNavigate, onShowProfil }: DashboardProps) {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const firstName = user?.name.split(' ')[0] || '';

  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [echeances, setEcheances] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [bRes, tRes, eRes, nRes] = await Promise.all([
      supabase.from('beneficiaires').select('*'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('echeances').select('*'),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    setBeneficiaires(bRes.data || []);
    setTransactions(tRes.data || []);
    setEcheances(eRes.data || []);
    setNotifications(nRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channels = [
      supabase.channel('dash-benef').on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiaires' }, () => fetchAll()).subscribe(),
      supabase.channel('dash-tx').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchAll()).subscribe(),
      supabase.channel('dash-ech').on('postgres_changes', { event: '*', schema: 'public', table: 'echeances' }, () => fetchAll()).subscribe(),
      supabase.channel('dash-notif').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchAll()).subscribe(),
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [fetchAll]);

  // Compute KPIs
  const actifs = beneficiaires.filter(b => b.statut === 'Actif').length;
  const totalPrete = beneficiaires.reduce((s, b) => s + (b.montant || 0), 0);
  const totalRembourse = beneficiaires.reduce((s, b) => s + (b.paye || 0), 0);
  const enRetard = beneficiaires.filter(b => b.statut === 'Retard' || b.statut === 'Défaut').length;
  const montantRetard = beneficiaires.filter(b => b.statut === 'Retard' || b.statut === 'Défaut').reduce((s, b) => s + ((b.total || 0) - (b.paye || 0)), 0);
  const totalBenef = beneficiaires.length;
  const parGt30 = echeances.filter(e => (e.retard || 0) > 30).length;

  const kpis = [
    { label: 'Crédits Actifs', value: String(actifs), trend: `${totalBenef} total`, trendUp: true, icon: CreditCard, gradient: 'from-primary to-primary-lighter', iconBg: 'bg-primary', page: 'credits' },
    { label: 'Total Prêté', value: formatXOF(totalPrete), trend: 'Portefeuille', trendUp: true, icon: DollarSign, gradient: 'from-accent to-accent-light', iconBg: 'bg-accent', page: 'credits' },
    { label: 'Total Remboursé', value: formatXOF(totalRembourse), trend: totalPrete > 0 ? `${Math.round((totalRembourse / totalPrete) * 100)}%` : '0%', trendUp: true, icon: CheckCircle, gradient: 'from-info to-[hsl(212,60%,65%)]', iconBg: 'bg-info', page: 'remboursements' },
    { label: 'Montant en Retard', value: formatXOF(montantRetard), trend: `${enRetard} dossiers`, trendUp: false, icon: AlertTriangle, gradient: 'from-warning to-[hsl(24,80%,65%)]', iconBg: 'bg-warning', page: 'retards' },
    { label: 'Bénéficiaires', value: String(totalBenef), trend: `${actifs} actifs`, trendUp: true, icon: Users, gradient: 'from-teal to-[hsl(175,44%,55%)]', iconBg: 'bg-teal', page: 'beneficiaires' },
    { label: 'Échéances à Risque', value: String(parGt30), trend: 'PAR > 30j', trendUp: false, icon: ShieldAlert, gradient: 'from-destructive to-[hsl(0,72%,65%)]', iconBg: 'bg-destructive', page: 'retards' },
  ];

  // Charts data from real data
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const remboursementsData = monthNames.map((month, i) => {
    const monthTx = transactions.filter(t => t.type === 'Remboursement' && new Date(t.created_at).getMonth() === i);
    return { month, value: monthTx.reduce((s, t) => s + t.montant, 0) };
  });

  const quartierCounts: Record<string, number> = {};
  beneficiaires.forEach(b => { const q = b.quartier || 'Autre'; quartierCounts[q] = (quartierCounts[q] || 0) + 1; });
  const quartierColors = ['hsl(201, 100%, 36%)', 'hsl(12, 70%, 51%)', 'hsl(212, 60%, 50%)', 'hsl(24, 80%, 50%)', 'hsl(175, 44%, 40%)', 'hsl(0, 72%, 51%)'];
  const quartiersData = Object.entries(quartierCounts).map(([name, value], i) => ({ name, value, color: quartierColors[i % quartierColors.length] }));

  const statutCounts: Record<string, number> = {};
  beneficiaires.forEach(b => { statutCounts[b.statut] = (statutCounts[b.statut] || 0) + 1; });
  const statutColorMap: Record<string, string> = { Actif: 'hsl(145, 50%, 44%)', Retard: 'hsl(24, 80%, 50%)', Soldé: 'hsl(212, 60%, 50%)', Défaut: 'hsl(0, 72%, 51%)', 'En attente': 'hsl(12, 70%, 51%)' };
  const statutData = Object.entries(statutCounts).map(([name, value]) => ({ name, value, color: statutColorMap[name] || 'hsl(213, 11%, 51%)' }));

  // Agent performance
  const agentMap: Record<string, { total: number; paye: number }> = {};
  beneficiaires.forEach(b => {
    const a = b.agent_name || 'Non assigné';
    if (!agentMap[a]) agentMap[a] = { total: 0, paye: 0 };
    agentMap[a].total += b.total || 0;
    agentMap[a].paye += b.paye || 0;
  });
  const agentColors = ['hsl(201, 100%, 36%)', 'hsl(12, 70%, 51%)', 'hsl(212, 60%, 50%)', 'hsl(175, 44%, 40%)'];
  const agentsData = Object.entries(agentMap).map(([name, v], i) => ({
    name: name.length > 15 ? name.slice(0, 13) + '.' : name,
    value: v.total > 0 ? Math.round((v.paye / v.total) * 100) : 0,
    color: agentColors[i % agentColors.length],
  }));

  // Alerts
  const alerts = notifications.slice(0, 5).map(n => ({
    id: n.id,
    icon: n.icon || '🔔',
    title: n.text.slice(0, 40),
    desc: n.text,
    badge: n.icon === '🚨' ? 'bg-destructive/10 text-destructive' : n.icon === '⚠️' ? 'bg-warning/10 text-warning' : n.icon === '✅' ? 'bg-success/10 text-success' : n.icon === '💳' ? 'bg-info/10 text-info' : 'bg-accent/10 text-accent-foreground',
    badgeText: n.icon === '🚨' ? 'Urgent' : n.icon === '⚠️' ? 'Retard' : n.icon === '✅' ? 'Paiement' : n.icon === '💳' ? 'Crédit' : 'Info',
    page: n.icon === '🚨' || n.icon === '⚠️' ? 'retards' : n.icon === '✅' ? 'remboursements' : n.icon === '💳' ? 'credits' : 'rapports',
    read: n.read,
  }));

  // Forecasts
  const now = new Date();
  const weekForecasts = [0, 1, 2, 3].map(w => {
    const start = new Date(now); start.setDate(start.getDate() + w * 7);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const weekEch = echeances.filter(e => {
      if (e.statut === 'Payé') return false;
      const parts = (e.date || '').split(/[/-]/);
      let d: Date | null = null;
      if (parts.length === 3) {
        if (parts[0].length === 4) d = new Date(e.date);
        else d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      return d && d >= start && d <= end;
    });
    const amount = weekEch.reduce((s, e) => s + (e.prevu || 0), 0);
    return {
      week: `S${w + 1}`,
      period: `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`,
      amount: formatXOF(amount),
      dossiers: weekEch.length,
      status: w === 0 ? 'En cours' : 'À venir',
      statusClass: w === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
    };
  });

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-primary/20 rounded-full" />
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-light to-primary-lighter rounded-3xl p-6 sm:p-8 text-card"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent/15 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-card/8 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />
        
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        
        <div className="relative flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <p className="text-card/50 text-xs sm:text-sm font-medium mb-1.5 uppercase tracking-wider">{today}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Bonjour, {firstName} <span className="inline-block animate-[wave_2s_ease-in-out_infinite]">👋</span>
            </h1>
            <p className="text-card/60 text-sm sm:text-base mt-2 max-w-md">Voici un résumé de votre activité — restez au courant en temps réel.</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="bg-card/10 backdrop-blur-md border border-card/20 text-accent-light px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-lg">
              {getRoleLabel(user?.role || '')}
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              variants={item}
              onClick={() => onNavigate(kpi.page)}
              whileHover={{ y: -6, scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
              whileTap={{ scale: 0.97 }}
              className="group bg-card/80 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-[var(--shadow)] hover:shadow-[var(--shadow-lg)] transition-[box-shadow,border-color] duration-500 border border-border/40 hover:border-primary/20 relative overflow-hidden cursor-pointer"
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500`} />
              
              {/* Shine sweep effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none overflow-hidden">
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-card/10 to-transparent skew-x-12 group-hover:animate-[shimmer_1.5s_ease-in-out]" />
              </div>
              
              <div className="relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: -5 }}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg transition-shadow duration-300 group-hover:shadow-xl`}
                  >
                    <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px] text-card" />
                  </motion.div>
                  <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg transition-transform duration-300 group-hover:scale-105 ${kpi.trendUp ? 'text-success bg-success/8' : 'text-destructive bg-destructive/8'}`}>
                    {kpi.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpi.trend}
                  </div>
                </div>
                <div className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 group-hover:text-foreground/70 transition-colors duration-300">{kpi.label}</div>
                <div className="text-xl sm:text-2xl font-extrabold text-foreground leading-none tracking-tight group-hover:text-primary transition-colors duration-300">{kpi.value}</div>
              </div>
              
              {/* Bottom accent line with width animation */}
              <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-gradient-to-r ${kpi.gradient} w-0 group-hover:w-3/4 transition-all duration-500 ease-out`} />
              
              {/* Arrow indicator */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-60 transition-all duration-300 translate-x-1 group-hover:translate-x-0">
                <ArrowRight className="w-3.5 h-3.5 text-primary" />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <ChartCard title="Remboursements Mensuels" subtitle="Évolution sur 12 mois (FCFA)" icon={<TrendingUp className="w-4 h-4 text-primary" />} onClick={() => onNavigate('remboursements')} delay={0.1}>
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={remboursementsData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(201, 100%, 40%)" stopOpacity={0.25}/>
                    <stop offset="100%" stopColor="hsl(201, 100%, 40%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 93%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(213, 11%, 51%)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => (Number(v)/1000000).toFixed(1)+'M'} tick={{ fontSize: 11, fill: 'hsl(213, 11%, 51%)' }} width={42} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [v.toLocaleString('fr-FR') + ' FCFA', 'Montant']} contentStyle={{ borderRadius: '16px', border: '1px solid hsl(214, 20%, 91%)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)' }} />
                <Area type="monotone" dataKey="value" stroke="hsl(201, 100%, 36%)" strokeWidth={2.5} fill="url(#colorValue)" dot={{ fill: 'hsl(201, 100%, 36%)', r: 3, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7, strokeWidth: 3, stroke: 'white', fill: 'hsl(201, 100%, 36%)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Crédits par Quartier" subtitle="Distribution géographique" icon={<Users className="w-4 h-4 text-accent-foreground" />} onClick={() => onNavigate('beneficiaires')} delay={0.2}>
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quartiersData} barSize={28}>
                <defs>
                  {quartiersData.map((entry, i) => (
                    <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={entry.color} stopOpacity={1}/>
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.7}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 93%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(213, 11%, 51%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(213, 11%, 51%)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid hsl(214, 20%, 91%)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>{quartiersData.map((e, i) => <Cell key={i} fill={`url(#barGrad${i})`} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Statut du Portefeuille" subtitle="Répartition actuelle" icon={<CreditCard className="w-4 h-4 text-primary" />} onClick={() => onNavigate('credits')} delay={0.3}>
          <div className="h-[240px] sm:h-[280px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statutData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: 'hsl(213, 11%, 71%)', strokeWidth: 1 }}
                >
                  {statutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid hsl(214, 20%, 91%)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Performance des Agents" subtitle="Taux de recouvrement (%)" icon={<CheckCircle className="w-4 h-4 text-primary" />} onClick={() => onNavigate('agents')} delay={0.4}>
          <div className="space-y-4 mt-2">
            {agentsData.map((a, i) => (
              <motion.div
                key={a.name}
                whileHover={{ x: 4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                className="group/agent cursor-pointer rounded-xl p-2 -mx-2 hover:bg-muted/40 transition-colors duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: -8 }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-card shadow-sm group-hover/agent:shadow-md transition-shadow"
                      style={{ background: a.color }}
                    >
                      {a.name.charAt(0)}
                    </motion.div>
                    <span className="text-[13px] font-semibold text-foreground group-hover/agent:text-primary transition-colors duration-200">{a.name}</span>
                  </div>
                  <span className="text-sm font-extrabold tabular-nums group-hover/agent:scale-110 transition-transform duration-200 origin-right" style={{ color: a.color }}>{a.value}%</span>
                </div>
                <div className="h-2.5 bg-muted/80 rounded-full overflow-hidden group-hover/agent:h-3 transition-all duration-200">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${a.value}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${a.color}, ${a.color}cc)` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Alerts & Forecasts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
          className="bg-card/80 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-[var(--shadow)] border border-border/40"
        >
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <Bell className="w-4.5 h-4.5 text-destructive" />
              </div>
              <div>
                <div className="text-sm sm:text-[15px] font-bold text-foreground tracking-tight">Alertes Récentes</div>
                <div className="text-[11px] text-muted-foreground">Dernières notifications</div>
              </div>
            </div>
            <span className="bg-destructive/10 text-destructive px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              {alerts.length}
            </span>
          </div>
          <div className="space-y-1">
            {alerts.length > 0 ? alerts.map((a) => (
              <div key={a.id} onClick={async () => {
                if (!a.read) await supabase.from('notifications').update({ read: true }).eq('id', a.id);
                onNavigate(a.page);
              }} className={`flex items-center gap-3 py-3 px-3.5 rounded-xl hover:bg-muted/60 transition-all duration-200 cursor-pointer group ${!a.read ? 'bg-primary/[0.04] border-l-[3px] border-primary' : 'border-l-[3px] border-transparent'}`}>
                <div className="text-lg shrink-0 group-hover:scale-110 transition-transform">{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{a.desc}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`${a.badge} px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold whitespace-nowrap`}>{a.badgeText}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Aucune alerte récente
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 20 }}
          className="bg-card/80 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-[var(--shadow)] border border-border/40"
        >
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Calendar className="w-4.5 h-4.5 text-accent-foreground" />
              </div>
              <div>
                <div className="text-sm sm:text-[15px] font-bold text-foreground tracking-tight">Prévisions de Trésorerie</div>
                <div className="text-[11px] text-muted-foreground">4 prochaines semaines</div>
              </div>
            </div>
            <span className="bg-accent/10 text-accent-foreground px-3 py-1.5 rounded-xl text-[11px] font-bold">4 sem.</span>
          </div>

          <div className="sm:hidden space-y-2.5">
            {weekForecasts.map((f, i) => (
              <motion.div
                key={f.week}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                whileHover={{ scale: 1.02, x: 4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                className="bg-muted/30 rounded-xl p-4 border border-border/30 hover:border-primary/20 hover:bg-muted/50 transition-colors duration-200 cursor-pointer"
              >
                <div className="flex justify-between items-center mb-2.5">
                  <span className="font-bold text-sm text-foreground">{f.week} — {f.period}</span>
                  <span className={`${f.statusClass} px-2.5 py-0.5 rounded-lg text-[10px] font-bold`}>{f.status}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-extrabold text-primary">{f.amount}</span>
                  <span className="text-[11px] text-muted-foreground">{f.dossiers} dossiers</span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto rounded-xl border border-border/30">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {['Semaine', 'Période', 'Attendu', 'Dossiers', 'Statut'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-left first:rounded-tl-xl last:rounded-tr-xl">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekForecasts.map((f, i) => (
                  <tr key={f.week} className="hover:bg-primary/[0.03] transition-all duration-200 group/row cursor-pointer">
                    <td className="px-4 py-3.5 text-[13px] font-bold border-b border-border/20 group-hover/row:text-primary transition-colors">{f.week}</td>
                    <td className="px-4 py-3.5 text-[13px] text-muted-foreground border-b border-border/20">{f.period}</td>
                    <td className="px-4 py-3.5 text-[13px] font-extrabold text-primary border-b border-border/20 group-hover/row:scale-105 transition-transform origin-left">{f.amount}</td>
                    <td className="px-4 py-3.5 text-[13px] border-b border-border/20">
                      <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-semibold group-hover/row:bg-primary/10 group-hover/row:text-primary transition-colors">{f.dossiers}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] border-b border-border/20"><span className={`${f.statusClass} px-2.5 py-1 rounded-lg text-[11px] font-bold`}>{f.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
