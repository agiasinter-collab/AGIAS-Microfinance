import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatXOF } from '@/data/agias-data';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMode, setFilterMode] = useState('');

  const fetchTransactions = useCallback(async () => {
    let query = supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(200);
    if (user?.role === 'agent') query = query.eq('agent_name', user.name);
    const { data, error } = await query;
    if (error) { console.error(error); toast.error('Erreur de chargement'); }
    setTransactions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTransactions();
    const channel = supabase
      .channel('transactions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchTransactions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTransactions]);

  let filtered = transactions;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t => (t.beneficiaire_nom || '').toLowerCase().includes(q) || (t.reference || '').toLowerCase().includes(q));
  }
  if (filterType) filtered = filtered.filter(t => t.type === filterType);
  if (filterMode) filtered = filtered.filter(t => t.methode === filterMode);

  const totalRemb = transactions.filter(t => t.type === 'Remboursement').reduce((s, t) => s + t.montant, 0);
  const totalDecaiss = transactions.filter(t => t.type === 'Décaissement').reduce((s, t) => s + t.montant, 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div><h2 className="text-[22px] font-extrabold text-primary">💸 Transactions</h2><p className="text-[13px] text-muted-foreground mt-0.5">Historique complet des mouvements financiers</p></div>
        <button onClick={() => {
          if (!transactions.length) { toast.error('Aucune donnée'); return; }
          const headers = ['Date', 'Type', 'Bénéficiaire', 'Montant', 'Mode', 'Agent', 'Référence'];
          const rows = transactions.map(t => [new Date(t.created_at).toLocaleDateString('fr-FR'), t.type, t.beneficiaire_nom || '', t.montant, t.methode || '', t.agent_name || '', t.reference || '']);
          const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
          const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
          toast.success('📥 Export CSV téléchargé !');
        }} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-accent text-accent-foreground hover:bg-accent-light transition-colors">📥 Exporter</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-5">
        <div className="bg-card rounded-[10px] p-4 shadow-[var(--shadow)] text-center">
          <div className="text-xl font-extrabold text-foreground">{transactions.length}</div>
          <div className="text-[11px] text-muted-foreground mt-1 font-semibold">Total Transactions</div>
        </div>
        <div className="bg-card rounded-[10px] p-4 shadow-[var(--shadow)] text-center">
          <div className="text-xl font-extrabold text-success">{formatXOF(totalRemb)}</div>
          <div className="text-[11px] text-muted-foreground mt-1 font-semibold">Total Remboursements</div>
        </div>
        <div className="bg-card rounded-[10px] p-4 shadow-[var(--shadow)] text-center">
          <div className="text-xl font-extrabold text-info">{formatXOF(totalDecaiss)}</div>
          <div className="text-[11px] text-muted-foreground mt-1 font-semibold">Total Décaissements</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-card border-2 border-border rounded-[10px] px-3.5 py-[9px] flex-1 min-w-[200px] focus-within:border-primary-lighter">
          <span>🔍</span><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou référence..." className="border-none outline-none text-[13px] w-full bg-transparent" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3.5 py-[10px] border-2 border-border rounded-[10px] text-[13px] bg-card text-foreground outline-none cursor-pointer focus:border-primary-lighter">
          <option value="">Tous les types</option><option>Décaissement</option><option>Remboursement</option>
        </select>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="px-3.5 py-[10px] border-2 border-border rounded-[10px] text-[13px] bg-card text-foreground outline-none cursor-pointer focus:border-primary-lighter">
          <option value="">Tous les modes</option><option>Cash</option><option>Orange Money</option><option>MTN Money</option><option>Wave</option><option>Virement</option>
        </select>
      </div>

      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['Date', 'Type', 'Bénéficiaire', 'Montant', 'Mode', 'Agent', 'Référence'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(t => (
                <tr key={t.id} className="hover:bg-muted/50">
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <span className={`${t.type === 'Décaissement' ? 'bg-info/[0.12] text-info' : 'bg-success/[0.12] text-success'} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>
                      {t.type === 'Décaissement' ? '📤' : '💰'} {t.type}
                    </span>
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.beneficiaire_nom || '—'}</td>
                  <td className={`px-3.5 py-[13px] text-[13px] border-b border-muted font-bold ${t.type === 'Décaissement' ? 'text-info' : 'text-success'}`}>
                    {t.type === 'Décaissement' ? '-' : '+'}{formatXOF(t.montant)}
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.methode || '—'}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.agent_name || '—'}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><code className="bg-muted px-2 py-0.5 rounded-md text-xs">{t.reference || '—'}</code></td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-3.5 py-6 text-center text-muted-foreground text-[13px]">Aucune transaction trouvée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
