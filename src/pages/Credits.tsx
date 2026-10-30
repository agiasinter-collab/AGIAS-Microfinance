import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatXOF } from '@/data/agias-data';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props { onShowProfil: (id: string) => void; }

const statutClass = (statut: string) => {
  if (statut === 'Défaut') return 'bg-destructive/[0.12] text-destructive';
  if (statut === 'Retard') return 'bg-warning/[0.12] text-warning';
  if (statut === 'En attente') return 'bg-warning/[0.12] text-warning';
  if (statut === 'Soldé') return 'bg-accent/15 text-[#8a6d1a]';
  if (statut === 'Rejeté') return 'bg-destructive/[0.12] text-destructive';
  return 'bg-success/[0.12] text-success';
};
const statutIcon = (s: string) => {
  if (s === 'Défaut') return '🚨';
  if (s === 'Retard') return '⚠️';
  if (s === 'En attente') return '⏳';
  if (s === 'Rejeté') return '❌';
  return '✅';
};

export default function CreditsPage({ onShowProfil }: Props) {
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Tous');
  const { user } = useAuth();
  const canApprove = user?.role === 'admin';

  const fetchData = useCallback(async () => {
    let query = supabase.from('beneficiaires').select('*').order('created_at');
    if (user?.role === 'agent') query = query.eq('agent_name', user.name);
    const { data } = await query;
    setBeneficiaires(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    // Realtime subscription
    const channel = supabase
      .channel('credits-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiaires' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const stats = {
    actifs: beneficiaires.filter(b => b.statut === 'Actif').length,
    attente: beneficiaires.filter(b => b.statut === 'En attente').length,
    soldes: beneficiaires.filter(b => b.statut === 'Soldé').length,
    defaut: beneficiaires.filter(b => b.statut === 'Défaut').length,
  };

  const filtered = filter === 'Tous' ? beneficiaires : beneficiaires.filter(b => b.statut === filter);

  // === EXPORT CSV ===
  const handleExport = () => {
    if (!filtered.length) { toast.error('Aucune donnée à exporter'); return; }
    const headers = ['N° Crédit', 'Bénéficiaire', 'Montant', 'Taux', 'Remboursé%', 'Statut'];
    const rows = filtered.map(b => [b.credit_num || '', b.nom, b.montant, b.taux || '', `${b.pct}%`, b.statut]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `credits_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('📥 Export CSV téléchargé !');
  };

  // === APPROUVER ===
  const handleApprouver = async (id: string) => {
    const ben = beneficiaires.find(b => b.id === id);
    if (!ben) return;
    const { error } = await supabase.from('beneficiaires').update({ statut: 'Actif' }).eq('id', id);
    if (error) { toast.error('Erreur lors de l\'approbation'); return; }
    // Create disbursement transaction
    await supabase.from('transactions').insert({
      type: 'Décaissement', montant: ben.montant, beneficiaire_id: id, beneficiaire_nom: ben.nom,
      methode: 'Espèces', reference: `DEC-${Date.now()}`, notes: 'Crédit approuvé et décaissé'
    });
    // Generate echeances (fin de chaque mois)
    if (ben.total > 0) {
      const nbMois = 12;
      const monthlyAmount = Math.round(ben.total / nbMois);
      const now = new Date();
      const echeances = Array.from({ length: nbMois }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + 1 + i + 1, 0); // last day of month
        return { beneficiaire_id: id, date: d.toISOString().slice(0, 10), prevu: i === nbMois - 1 ? ben.total - monthlyAmount * (nbMois - 1) : monthlyAmount, paye: 0, retard: 0, statut: 'À venir' };
      });
      await supabase.from('echeances').insert(echeances);
    }
    toast.success('✅ Crédit approuvé et décaissé !');
  };

  // === REJETER ===
  const handleRejeter = async (id: string) => {
    const { error } = await supabase.from('beneficiaires').update({ statut: 'Rejeté' }).eq('id', id);
    if (error) { toast.error('Erreur lors du rejet'); return; }
    toast.error('❌ Crédit rejeté.');
  };


  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div><h2 className="text-[22px] font-extrabold text-primary">💳 Gestion des Crédits</h2><p className="text-[13px] text-muted-foreground mt-0.5">Suivi et approbation des dossiers de crédit</p></div>
        
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
        {[
          { val: stats.actifs, label: 'Crédits Actifs', color: 'text-success', f: 'Actif' },
          { val: stats.attente, label: 'En Attente Approbation', color: 'text-warning', f: 'En attente' },
          { val: stats.soldes, label: 'Soldés ce mois', color: 'text-info', f: 'Soldé' },
          { val: stats.defaut, label: 'En Défaut', color: 'text-destructive', f: 'Défaut' },
        ].map(k => (
          <div key={k.label} onClick={() => setFilter(filter === k.f ? 'Tous' : k.f)} className={`bg-card rounded-[10px] p-4 shadow-[var(--shadow)] text-center cursor-pointer transition-all hover:scale-[1.02] ${filter === k.f ? 'ring-2 ring-primary' : ''}`}>
            <div className={`text-xl font-extrabold ${k.color}`}>{k.val}</div>
            <div className="text-[11px] text-muted-foreground mt-1 font-semibold">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
        <div className="flex justify-between items-center mb-[18px]">
          <div className="text-base font-bold text-primary">📋 Liste des Crédits {filter !== 'Tous' && <span className="text-xs font-normal text-muted-foreground ml-2">— filtre: {filter}</span>}</div>
          <button onClick={handleExport} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-foreground hover:opacity-90 transition-colors">📥 Exporter</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['N° Crédit', 'Bénéficiaire', 'Montant', 'Taux', 'Remboursé%', 'Statut', 'Actions'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Aucun crédit trouvé</td></tr>}
              {filtered.map(c => (
                <tr key={c.id} className={`hover:bg-muted/50 ${c.statut === 'En attente' ? 'bg-warning/[0.04]' : ''}`}>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-bold">{c.credit_num || c.dossier}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{c.nom}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{formatXOF(c.montant)}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{c.taux}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    {c.statut === 'En attente' ? '—' : (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-border rounded-[10px] overflow-hidden">
                          <div className="h-full rounded-[10px]" style={{ width: `${c.pct}%`, background: c.pct >= 70 ? 'hsl(var(--success))' : c.pct >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }} />
                        </div>{c.pct}%
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className={`${statutClass(c.statut)} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{statutIcon(c.statut)} {c.statut}</span></td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    {c.statut === 'En attente' && canApprove ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleApprouver(c.id)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:opacity-90">✅ Approuver</button>
                        <button onClick={() => handleRejeter(c.id)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-destructive text-destructive-foreground hover:opacity-90">❌ Rejeter</button>
                      </div>
                    ) : c.statut === 'En attente' ? (
                      <span className="text-[11px] text-muted-foreground font-semibold">⏳ En attente d'approbation</span>
                    ) : (
                      <button onClick={() => onShowProfil(c.id)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors">Voir</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
