import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AVATAR_COLORS, getInitials, formatXOF } from '@/data/agias-data';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function RetardsPage() {
  const { user } = useAuth();
  const [echeances, setEcheances] = useState<any[]>([]);
  const [benefRetards, setBenefRetards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const fetchAll = useCallback(async () => {
    let echQuery = supabase.from('echeances').select('*, beneficiaires(id, nom, dossier, agent_name, quartier, montant, photo_url)').or('statut.eq.Retard,statut.eq.Impayé,retard.gt.0').order('retard', { ascending: false });
    let benQuery = supabase.from('beneficiaires').select('*').in('statut', ['Retard', 'Défaut']).order('statut');
    if (user?.role === 'agent') {
      benQuery = benQuery.eq('agent_name', user.name);
    }
    const [echRes, benRes] = await Promise.all([echQuery, benQuery]);
    if (echRes.error) console.error(echRes.error);
    setEcheances(echRes.data || []);
    setBenefRetards(benRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch1 = supabase.channel('retards-ech-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'echeances' }, () => fetchAll()).subscribe();
    const ch2 = supabase.channel('retards-benef-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiaires' }, () => fetchAll()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [fetchAll]);

  const getParGroup = (jours: number) => {
    if (jours <= 30) return '1-30';
    if (jours <= 60) return '31-60';
    if (jours <= 90) return '61-90';
    return '90+';
  };

  const retardList = benefRetards.map(b => {
    const bEch = echeances.filter(e => e.beneficiaire_id === b.id);
    const maxRetard = bEch.reduce((max, e) => Math.max(max, e.retard || 0), 0);
    return { ...b, maxRetard, parGroup: getParGroup(maxRetard) };
  });

  const par1_30 = retardList.filter(r => r.parGroup === '1-30').length;
  const par31_60 = retardList.filter(r => r.parGroup === '31-60').length;
  const par61_90 = retardList.filter(r => r.parGroup === '61-90').length;
  const par90plus = retardList.filter(r => r.parGroup === '90+').length;

  const filtered = activeTab === 'all' ? retardList : retardList.filter(r => r.parGroup === activeTab);

  const tabs = [
    { id: 'all', label: `Tous les retards (${retardList.length})` },
    { id: '1-30', label: `PAR 1-30j (${par1_30})` },
    { id: '31-60', label: `PAR 31-60j (${par31_60})` },
    { id: '61-90', label: `PAR 61-90j (${par61_90})` },
    { id: '90+', label: `PAR 90j+ (${par90plus})` },
  ];

  // Action handlers
  const handleSMS = async (benef: any) => {
    await supabase.from('notifications').insert({
      text: `📱 SMS de rappel envoyé à ${benef.nom} (${benef.tel || 'N/A'}) — Retard de ${benef.maxRetard} jours`,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      icon: '📱',
    });
    toast.success(`📱 SMS de rappel envoyé à ${benef.nom} !`);
  };

  const handleWhatsApp = async (benef: any) => {
    await supabase.from('notifications').insert({
      text: `💬 Message WhatsApp envoyé à ${benef.nom} — Relance retard ${benef.maxRetard}j`,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      icon: '💬',
    });
    toast.success(`💬 Message WhatsApp envoyé à ${benef.nom} !`);
  };

  const handleRecouvrement = async (benef: any) => {
    // Change status to Défaut if not already
    if (benef.statut !== 'Défaut') {
      await supabase.from('beneficiaires').update({ statut: 'Défaut' }).eq('id', benef.id);
    }
    await supabase.from('notifications').insert({
      text: `⚖️ Procédure de recouvrement lancée pour ${benef.nom} — ${formatXOF(benef.montant)} en impayé`,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      icon: '⚖️',
    });
    toast.info(`⚖️ Procédure de recouvrement lancée pour ${benef.nom} !`);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6"><h2 className="text-[22px] font-extrabold text-primary">⚠️ Retards & Alertes</h2><p className="text-[13px] text-muted-foreground mt-0.5">Suivi des impayés et gestion des relances</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
        {[
          { val: par1_30, label: 'PAR 1-30 jours', color: 'text-warning' },
          { val: par31_60, label: 'PAR 31-60 jours', color: 'text-destructive' },
          { val: par61_90, label: 'PAR 61-90 jours', color: 'text-[#7b2d2d]' },
          { val: par90plus, label: 'PAR 90+ jours', color: 'text-[#4a0000]' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-[10px] p-4 shadow-[var(--shadow)] text-center">
            <div className={`text-xl font-extrabold ${k.color}`}>{k.val}</div>
            <div className="text-[11px] text-muted-foreground mt-1 font-semibold">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-[18px] py-2 rounded-[20px] text-[13px] font-semibold border-2 transition-all ${activeTab === t.id ? 'border-primary bg-primary text-card' : 'border-border bg-card text-muted-foreground hover:border-primary-lighter'}`}>{t.label}</button>
        ))}
      </div>

      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['Bénéficiaire', 'N° Dossier', 'Montant Crédit', 'Retard Max', 'PAR', 'Statut', 'Agent', 'Actions'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((r, idx) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <div className="flex items-center gap-2">
                      {r.photo_url ? (
                        <img src={r.photo_url} alt={r.nom} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-card shrink-0" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>{getInitials(r.nom)}</div>
                      )}
                      {r.nom}
                    </div>
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><code className="bg-muted px-2 py-0.5 rounded-md text-xs">{r.dossier}</code></td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-bold text-destructive">{formatXOF(r.montant)}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <span className={`${r.maxRetard > 30 ? 'bg-destructive/[0.12] text-destructive' : 'bg-warning/[0.12] text-warning'} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{r.maxRetard} jours</span>
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">PAR {r.parGroup}j</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <span className={`${r.statut === 'Défaut' ? 'bg-destructive/[0.12] text-destructive' : 'bg-warning/[0.12] text-warning'} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{r.statut === 'Défaut' ? '🚨' : '⚠️'} {r.statut}</span>
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{r.agent_name || '—'}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <div className="flex gap-1.5">
                      {r.maxRetard < 30 ? (
                        <>
                          <button onClick={() => handleSMS(r)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">📱 SMS</button>
                          <button onClick={() => handleWhatsApp(r)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-success/15 text-[#128c7e] hover:bg-success/25 transition-colors">💬 WA</button>
                        </>
                      ) : (
                        <button onClick={() => handleRecouvrement(r)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-destructive text-card hover:opacity-90 transition-colors">⚖️ Recouvrement</button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-3.5 py-6 text-center text-muted-foreground text-[13px]">Aucun retard enregistré 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
