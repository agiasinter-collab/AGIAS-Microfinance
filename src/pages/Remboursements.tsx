import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatXOF } from '@/data/agias-data';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function RemboursementsPage() {
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBenef, setSelectedBenef] = useState('');
  const [montant, setMontant] = useState('');
  const [methode, setMethode] = useState('Cash');
  const { user } = useAuth();
  const canRecord = true; // tous les rôles peuvent saisir des remboursements

  const fetchData = useCallback(async () => {
    let bQuery = supabase.from('beneficiaires').select('id, nom, dossier, statut, montant, paye, total, pct, agent_name').order('nom');
    if (user?.role === 'agent') bQuery = bQuery.eq('agent_name', user?.name || '');
    const [bRes, tRes] = await Promise.all([
      bQuery,
      supabase.from('transactions').select('*').eq('type', 'Remboursement').order('created_at', { ascending: false }).limit(50),
    ]);
    setBeneficiaires(bRes.data || []);
    setTransactions(tRes.data || []);
    if (bRes.data?.length && !selectedBenef) setSelectedBenef(bRes.data[0].id);
    setLoading(false);
  }, [selectedBenef]);

  useEffect(() => {
    fetchData();
    const ch1 = supabase.channel('remb-benef-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiaires' }, () => fetchData()).subscribe();
    const ch2 = supabase.channel('remb-tx-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!selectedBenef || !montant) { toast.error('Sélectionnez un bénéficiaire et un montant'); return; }
    const amt = parseInt(montant);
    if (isNaN(amt) || amt <= 0) { toast.error('Montant invalide'); return; }

    const benef = beneficiaires.find(b => b.id === selectedBenef);
    if (!benef) return;

    setSubmitting(true);

    const { error: txErr } = await supabase.from('transactions').insert({
      beneficiaire_id: benef.id,
      beneficiaire_nom: benef.nom,
      type: 'Remboursement',
      montant: amt,
      methode,
      agent_name: 'Agent',
      reference: `RMB-${Date.now().toString(36).toUpperCase()}`,
    });

    if (txErr) { toast.error('Erreur lors de l\'enregistrement'); console.error(txErr); setSubmitting(false); return; }

    const newPaye = Math.min(benef.paye + amt, benef.total);
    const newPct = benef.total > 0 ? Math.round((newPaye / benef.total) * 100) : 0;
    const newStatut = newPct >= 100 ? 'Soldé' : benef.statut;

    await supabase.from('beneficiaires').update({ paye: newPaye, pct: newPct, statut: newStatut }).eq('id', benef.id);

    // Update matching echeance if exists
    const { data: nextEch } = await supabase.from('echeances').select('*').eq('beneficiaire_id', benef.id).eq('statut', 'À venir').order('date').limit(1);
    if (nextEch?.length) {
      const ech = nextEch[0];
      const newEchPaye = ech.paye + amt;
      const echStatut = newEchPaye >= ech.prevu ? 'Payé' : 'Partiel';
      await supabase.from('echeances').update({ paye: newEchPaye, statut: echStatut }).eq('id', ech.id);
    }

    setSubmitting(false);
    toast.success(`✅ Remboursement de ${formatXOF(amt)} enregistré pour ${benef.nom} !`);
    setMontant('');
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6"><h2 className="text-[22px] font-extrabold text-primary">💰 Remboursements</h2><p className="text-[13px] text-muted-foreground mt-0.5">Saisie et suivi des remboursements</p></div>

      {/* Saisie — visible uniquement pour admin/superviseur */}
      {canRecord ? (
        <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)] mb-5">
          <div className="text-base font-bold text-primary mb-[18px]">➕ Saisir un Remboursement</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="text-[13px] font-semibold text-foreground mb-[7px] block">Bénéficiaire</label>
              <select value={selectedBenef} onChange={e => setSelectedBenef(e.target.value)} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                {beneficiaires.filter(b => b.statut !== 'Soldé').map(b => (
                  <option key={b.id} value={b.id}>{b.nom} — {b.dossier} (reste: {formatXOF(b.total - b.paye)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[13px] font-semibold text-foreground mb-[7px] block">Montant (FCFA)</label>
              <input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="Ex: 25000" className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
            </div>
            <div>
              <label className="text-[13px] font-semibold text-foreground mb-[7px] block">Mode de Paiement</label>
              <select value={methode} onChange={e => setMethode(e.target.value)} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                <option>Cash</option><option>Orange Money</option><option>MTN Money</option><option>Wave</option><option>Virement</option>
              </select>
            </div>
            <button onClick={handleSubmit} disabled={submitting} className="h-11 px-[18px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors mt-[22px] disabled:opacity-50">
              {submitting ? '⏳...' : '✅ Enregistrer'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-4 mb-5 text-center text-[13px] text-muted-foreground font-semibold">
          🔒 Seuls les administrateurs et superviseurs peuvent saisir des remboursements.
        </div>
      )}

      {/* Liste */}
      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
        <div className="flex justify-between items-center mb-[18px]">
          <div className="text-base font-bold text-primary">📋 Derniers Remboursements</div>
          <span className="bg-success/[0.12] text-success px-2.5 py-1 rounded-[20px] text-[11px] font-bold">{transactions.length} récents</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['Date', 'Bénéficiaire', 'Montant', 'Mode', 'Agent', 'Référence'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
            <tbody>
              {transactions.length > 0 ? transactions.map(t => (
                <tr key={t.id} className="hover:bg-muted/50">
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.beneficiaire_nom || '—'}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-bold text-success">+{formatXOF(t.montant)}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.methode || '—'}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.agent_name || '—'}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><code className="bg-muted px-2 py-0.5 rounded-md text-xs">{t.reference || '—'}</code></td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-3.5 py-6 text-center text-muted-foreground text-[13px]">Aucun remboursement enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
