import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatXOF, AVATAR_COLORS, getInitials } from '@/data/agias-data';
import { toast } from 'sonner';

export default function AgentsTerrainPage() {
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [echeances, setEcheances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [bRes, tRes, eRes] = await Promise.all([
      supabase.from('beneficiaires').select('*'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('echeances').select('*, beneficiaires(nom, quartier, agent_name)').order('date'),
    ]);
    setBeneficiaires(bRes.data || []);
    setTransactions(tRes.data || []);
    setEcheances(eRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channels = [
      supabase.channel('agents-benef-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiaires' }, () => fetchAll()).subscribe(),
      supabase.channel('agents-tx-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchAll()).subscribe(),
      supabase.channel('agents-ech-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'echeances' }, () => fetchAll()).subscribe(),
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [fetchAll]);

  // Build agent stats
  const agentMap: Record<string, { benefs: any[]; totalDu: number; totalPaye: number; remb: number }> = {};
  beneficiaires.forEach(b => {
    const name = b.agent_name || 'Non assigné';
    if (!agentMap[name]) agentMap[name] = { benefs: [], totalDu: 0, totalPaye: 0, remb: 0 };
    agentMap[name].benefs.push(b);
    agentMap[name].totalDu += b.total || 0;
    agentMap[name].totalPaye += b.paye || 0;
  });

  // Count remboursements per agent this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  transactions.forEach(t => {
    if (t.type === 'Remboursement' && new Date(t.created_at) >= monthStart) {
      const name = t.agent_name || 'Non assigné';
      if (!agentMap[name]) agentMap[name] = { benefs: [], totalDu: 0, totalPaye: 0, remb: 0 };
      agentMap[name].remb += t.montant;
    }
  });

  const agents = Object.entries(agentMap).filter(([name]) => name !== 'Non assigné').map(([name, data], idx) => {
    const actifs = data.benefs.filter(b => b.statut === 'Actif').length;
    const taux = data.totalDu > 0 ? Math.round((data.totalPaye / data.totalDu) * 100) : 0;
    return { name, initials: getInitials(name), color: AVATAR_COLORS[idx % AVATAR_COLORS.length], benefs: data.benefs.length, actifs, collecte: data.remb, taux };
  });

  // Global stats
  const totalAgents = agents.length;
  const tauxMoyen = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.taux, 0) / agents.length) : 0;
  const totalCollecte = agents.reduce((s, a) => s + a.collecte, 0);
  const totalRembCount = transactions.filter(t => t.type === 'Remboursement' && new Date(t.created_at) >= monthStart).length;

  // Build tournées from upcoming/overdue echeances
  const todayStr = now.toISOString().slice(0, 10);
  const tournees = echeances
    .filter(e => e.statut !== 'Payé' && e.beneficiaires)
    .map(e => {
      const b = e.beneficiaires as any;
      const isOverdue = (e.retard || 0) > 0;
      const isUrgent = (e.retard || 0) > 30;
      return {
        agent: b.agent_name || '—',
        benef: b.nom || '—',
        quartier: b.quartier || '—',
        montant: e.prevu || 0,
        retard: e.retard || 0,
        date: e.date,
        statut: isUrgent ? '🚨 Urgent' : isOverdue ? '⏳ En retard' : '📍 Planifié',
        sClass: isUrgent ? 'bg-destructive/[0.12] text-destructive' : isOverdue ? 'bg-warning/[0.12] text-warning' : 'bg-info/[0.12] text-info',
        obj: isUrgent ? 'Mise en demeure + négociation' : isOverdue ? 'Collecte remboursement en retard' : 'Collecte remboursement',
      };
    })
    .sort((a, b) => (b.retard - a.retard))
    .slice(0, 15);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[22px] font-extrabold text-primary">👷 Agents de Terrain</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Suivi des performances et tournées</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
        {[
          { val: String(totalAgents), label: 'Agents Actifs', color: 'text-primary' },
          { val: `${tauxMoyen}%`, label: 'Taux Recouvrement Moy.', color: 'text-success' },
          { val: String(tournees.length), label: 'Échéances en cours', color: 'text-info' },
          { val: String(totalRembCount), label: 'Remboursements ce mois', color: 'text-accent-foreground' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-[10px] p-4 shadow-[var(--shadow)] text-center">
            <div className={`text-xl font-extrabold ${k.color}`}>{k.val}</div>
            <div className="text-[11px] text-muted-foreground mt-1 font-semibold">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)] mb-5">
        <div className="text-base font-bold text-primary mb-4">📊 Performance des Agents</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['Agent', 'Bénéficiaires', 'Crédits Actifs', 'Collecté ce mois', 'Taux Recouvrement', 'Statut'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
            <tbody>
              {agents.length > 0 ? agents.map(a => (
                <tr key={a.name} className="hover:bg-muted/50">
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-card shrink-0" style={{ background: a.color }}>{a.initials}</div>
                      <div className="font-semibold">{a.name}</div>
                    </div>
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{a.benefs}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{a.actifs}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-bold text-success">{formatXOF(a.collecte)}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-border rounded-[10px] overflow-hidden">
                        <div className="h-full rounded-[10px] transition-all" style={{ width: `${a.taux}%`, background: a.taux >= 70 ? 'hsl(var(--success))' : a.taux >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }} />
                      </div>
                      {a.taux}%
                    </div>
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className="bg-success/[0.12] text-success px-2.5 py-1 rounded-[20px] text-[11px] font-bold">🟢 Actif</span></td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-3.5 py-6 text-center text-muted-foreground text-[13px]">Aucun agent enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
        <div className="text-base font-bold text-primary mb-4">📅 Tournées & Échéances à Traiter</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['Agent', 'Bénéficiaire', 'Quartier', 'Montant', 'Retard', 'Objectif', 'Statut'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
            <tbody>
              {tournees.length > 0 ? tournees.map((t, i) => (
                <tr key={i} className="hover:bg-muted/50">
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.agent}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-semibold">{t.benef}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.quartier}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-bold">{formatXOF(t.montant)}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    {t.retard > 0 ? (
                      <span className={`${t.retard > 30 ? 'bg-destructive/[0.12] text-destructive' : 'bg-warning/[0.12] text-warning'} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{t.retard}j</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.obj}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className={`${t.sClass} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{t.statut}</span></td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-3.5 py-6 text-center text-muted-foreground text-[13px]">Aucune tournée planifiée 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
