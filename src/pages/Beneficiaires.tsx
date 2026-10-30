import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AVATAR_COLORS, getInitials, formatXOF } from '@/data/agias-data';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props { onShowProfil: (id: string) => void; }

const statusMap: Record<string, string> = { Actif: 'bg-success/[0.12] text-success', Retard: 'bg-warning/[0.12] text-warning', Défaut: 'bg-destructive/[0.12] text-destructive', Soldé: 'bg-accent/15 text-[#8a6d1a]' };
const statusIcon: Record<string, string> = { Actif: '✅', Retard: '⚠️', Défaut: '🚨', Soldé: '✅' };

const emptyForm = { nom: '', tel: '', dob: '', ville: 'Abidjan', quartier: 'Cocody', adresse: '', activite: '', groupe: '', montant: '', duree: '', taux: '2%/semaine', credit_num: '1er crédit', agent: 'Moussa Coulibaly', notes: '', frequence: 'mensuel' };

const VILLES_QUARTIERS: Record<string, string[]> = {
  'Abidjan': ['Cocody', 'Adjamé', 'Plateau', 'Yopougon', 'Abobo', 'Marcory', 'Treichville', 'Koumassi', 'Port-Bouët', 'Attécoubé', 'Anyama', 'Bingerville', 'Songon'],
  'Agboville': ['Centre-ville', 'Rubino', 'Agneby', 'Grand-Morié', 'Offa', 'Azaguié-gare'],
  'Sikensi': ['Centre', 'Gare routière', 'Quartier résidentiel'],
  'Adzopé': ['Centre-ville', 'Dioulakro', 'Bécoukro', 'Agneby'],
  'Dabou': ['Centre-ville', 'Lopou', 'Agnéby', 'Orbaff'],
  'Grand-Bassam': ['Ancien Bassam', 'Nouveau Bassam', 'Phare', 'Mondoukou', 'Azuretti', 'Modeste'],
  'Aboisso': ['Centre-ville', 'Commerce', 'Résidentiel', 'Dioulakro'],
  'Tiassalé': ['Centre-ville', 'N\'douci-gare', 'Bandama'],
  'Divo': ['Centre-ville', 'Dioulakro', 'Commerce', 'Lôh-Djiboua', 'Gbagbam'],
  'Jacqueville': ['Centre', 'Addah', 'Ahua'],
  'Alépé': ['Centre-ville', 'Dioulakro', 'Mé'],
  'Bonoua': ['Centre-ville', 'Commerce', 'Abouré'],
  'Assinie': ['Assinie-Mafia', 'Assinie-France', 'Centre'],
  'Grand-Lahou': ['Centre', 'Lahou-Plage', 'Braffedon'],
  'Bouaké': ['Commerce', 'Dar-es-Salam', 'Air France', 'Koko', 'Belleville', 'Zone Industrielle'],
  'Yamoussoukro': ['Habitat', 'Dioulakro', 'Morofé', '220 Logements', 'Millionnaire'],
  'San Pedro': ['Bardot', 'Cité', 'Séwéké', 'Balmer', 'Zimbabwe'],
  'Daloa': ['Commerce', 'Orly', 'Lobia', 'Soleil', 'Tazibouo'],
  'Korhogo': ['Soba', 'Koko', 'Petit Paris', 'Dem', 'Sinistré'],
  'Man': ['Commerce', 'Doyagouiné', 'Libreville', 'Gbêpleu'],
  'Gagnoa': ['Dioulabougou', 'Commerce', 'Garahio'],
};

export default function BeneficiairesPage({ onShowProfil }: Props) {
  const [search, setSearch] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterS, setFilterS] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'superviseur';
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBeneficiaires();
    const channel = supabase
      .channel('beneficiaires-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiaires' }, () => fetchBeneficiaires())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchBeneficiaires = async () => {
    let query = supabase.from('beneficiaires').select('*').order('created_at');
    // Agent voit uniquement ses clients
    if (user?.role === 'agent') {
      query = query.eq('agent_name', user.name);
    }
    const { data, error } = await query;
    if (error) { toast.error('Erreur de chargement'); console.error(error); }
    else setBeneficiaires(data || []);
    setLoading(false);
  };

  const handleChange = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // Supprimer les échéances, documents et transactions liés
      await supabase.from('echeances').delete().eq('beneficiaire_id', deleteId);
      await supabase.from('documents_beneficiaire').delete().eq('beneficiaire_id', deleteId);
      await supabase.from('transactions').delete().eq('beneficiaire_id', deleteId);
      const { error } = await supabase.from('beneficiaires').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Bénéficiaire supprimé avec succès');
      setDeleteId(null);
      fetchBeneficiaires();
    } catch (err: any) {
      toast.error('Erreur lors de la suppression: ' + (err.message || ''));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    if (!beneficiaires.length) { toast.error('Aucune donnée à exporter'); return; }
    const headers = ['Nom', 'N° Dossier', 'Téléphone', 'Ville', 'Quartier', 'Activité', 'Montant', 'Remboursé %', 'Statut', 'Score'];
    const rows = beneficiaires.map(b => [b.nom, b.dossier, b.tel || '', b.ville || '', b.quartier || '', b.activite || '', b.montant, b.pct, b.statut, b.score]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `beneficiaires_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('📥 Export CSV téléchargé !');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Veuillez sélectionner une image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('L\'image ne doit pas dépasser 5 Mo'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.nom.trim() || !form.tel.trim() || !form.activite.trim() || !form.montant || !form.duree) {
      toast.error('Veuillez remplir tous les champs obligatoires (*)');
      return;
    }
    const montant = parseInt(form.montant);
    const duree = parseInt(form.duree);
    if (isNaN(montant) || montant <= 0) { toast.error('Montant invalide'); return; }
    if (isNaN(duree) || duree <= 0) { toast.error('Durée invalide'); return; }

    setSubmitting(true);
    const dossier = `AGS-${Date.now().toString(36).toUpperCase()}`;
    const inscription = new Date().toISOString().slice(0, 10);

    // Calculate total with interest adapted to frequency
    const tauxNum = parseFloat(form.taux) || 2;
    const freqDivisor = form.frequence === 'hebdomadaire' ? 4 : form.frequence === 'bimensuel' ? 2 : 1;
    const dureeMois = duree / freqDivisor; // convert to months
    const total = Math.round(montant * (1 + (tauxNum / 100) * dureeMois));

    const { data: inserted, error } = await supabase.from('beneficiaires').insert({
      nom: form.nom.trim(),
      tel: form.tel.trim(),
      dob: form.dob || null,
      ville: form.ville,
      quartier: form.quartier,
      adresse: form.adresse.trim() || null,
      activite: form.activite.trim(),
      groupe: form.groupe.trim() || null,
      montant,
      total,
      dossier,
      statut: 'Actif',
      agent_name: form.agent,
      inscription,
      taux: form.taux,
      credit_num: form.credit_num,
      notes: form.notes.trim() || null,
    }).select().maybeSingle();

    if (error || !inserted) {
      console.error(error);
      toast.error('Erreur lors de la création du dossier');
      setSubmitting(false);
      return;
    }

    // Upload photo if selected
    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      const path = `photos/${inserted.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from('beneficiaires-files').upload(path, photoFile, { upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('beneficiaires-files').getPublicUrl(path);
        await supabase.from('beneficiaires').update({ photo_url: urlData.publicUrl }).eq('id', inserted.id);
      }
    }

    // Generate échéances selon la fréquence choisie
    const echeanceAmount = Math.round(total / duree);
    const echeances = [];
    const now = new Date();
    for (let i = 0; i < duree; i++) {
      let date: Date;
      if (form.frequence === 'hebdomadaire') {
        date = new Date(now);
        date.setDate(date.getDate() + 7 * (i + 1));
      } else if (form.frequence === 'bimensuel') {
        // 1er et 15 de chaque mois
        const baseMonth = now.getMonth() + Math.floor((i) / 2) + 1;
        const day = i % 2 === 0 ? 15 : 0; // 15 or last day
        if (day === 15) {
          date = new Date(now.getFullYear(), baseMonth, 15);
        } else {
          date = new Date(now.getFullYear(), baseMonth + 1, 0); // last day
        }
      } else {
        // mensuel — fin de mois
        date = new Date(now.getFullYear(), now.getMonth() + 1 + i + 1, 0);
      }
      echeances.push({
        beneficiaire_id: inserted.id,
        date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        prevu: i === duree - 1 ? total - echeanceAmount * (duree - 1) : echeanceAmount,
        statut: 'À venir',
      });
    }
    await supabase.from('echeances').insert(echeances);

    // Create initial disbursement transaction
    await supabase.from('transactions').insert({
      beneficiaire_id: inserted.id,
      beneficiaire_nom: inserted.nom,
      type: 'Décaissement',
      montant,
      agent_name: form.agent,
      methode: 'Wave',
      reference: `TXN-${dossier}`,
    });

    setSubmitting(false);
    toast.success('📤 Dossier créé avec succès !');
    setForm(emptyForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowModal(false);
    fetchBeneficiaires();
  };

  let data = beneficiaires;
  if (search) { const q = search.toLowerCase(); data = data.filter(b => b.nom.toLowerCase().includes(q) || b.dossier.toLowerCase().includes(q) || (b.tel || '').includes(q)); }
  if (filterQ) data = data.filter(b => b.quartier === filterQ);
  if (filterS) data = data.filter(b => b.statut === filterS);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div><h2 className="text-[22px] font-extrabold text-primary">👥 Bénéficiaires</h2><p className="text-[13px] text-muted-foreground mt-0.5">Gestion et suivi des bénéficiaires de crédit</p></div>
        <div className="flex gap-2.5">
          <button onClick={handleExport} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-accent text-accent-foreground hover:bg-accent-light transition-colors">📥 Exporter</button>
          {canWrite && <button onClick={() => setShowModal(true)} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">➕ Nouveau Dossier</button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-card border-2 border-border rounded-[10px] px-3.5 py-[9px] flex-1 min-w-[200px] focus-within:border-primary-lighter">
          <span>🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, téléphone, numéro dossier..." className="border-none outline-none text-[13px] w-full bg-transparent" />
        </div>
        <select value={filterQ} onChange={e => setFilterQ(e.target.value)} className="px-3.5 py-[10px] border-2 border-border rounded-[10px] text-[13px] bg-card text-foreground outline-none cursor-pointer focus:border-primary-lighter">
          <option value="">Tous les quartiers</option>
          {Object.values(VILLES_QUARTIERS).flat().filter((v, i, a) => a.indexOf(v) === i).map(q => <option key={q}>{q}</option>)}
        </select>
        <select value={filterS} onChange={e => setFilterS(e.target.value)} className="px-3.5 py-[10px] border-2 border-border rounded-[10px] text-[13px] bg-card text-foreground outline-none cursor-pointer focus:border-primary-lighter">
          <option value="">Tous les statuts</option><option>Actif</option><option>Retard</option><option>Défaut</option><option>Soldé</option>
        </select>
      </div>

      <div className="bg-card rounded-lg shadow-[var(--shadow)] p-[22px]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>{['Bénéficiaire', 'N° Dossier', 'Téléphone', 'Ville', 'Quartier', 'Montant Crédit', 'Remboursé', 'Statut', 'Score', 'Actions'].map(h => (
                <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide text-left border-b-2 border-border">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {data.map((b, idx) => (
                <tr key={b.id} className="hover:bg-muted/50">
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <div className="flex items-center gap-2.5">
                      {b.photo_url ? (
                        <img src={b.photo_url} alt={b.nom} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-card shrink-0" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>{getInitials(b.nom)}</div>
                      )}
                      <div className="font-semibold">{b.nom}</div>
                    </div>
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><code className="bg-muted px-2 py-0.5 rounded-md text-xs">{b.dossier}</code></td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{b.tel}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{b.ville || 'Abidjan'}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{b.quartier}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-bold">{formatXOF(b.montant)}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <div className="flex items-center gap-2">
                      <div className="w-[70px] h-2 bg-border rounded-[10px] overflow-hidden"><div className="h-full rounded-[10px] transition-all" style={{ width: `${b.pct}%`, background: b.pct >= 70 ? '#38a169' : b.pct >= 40 ? '#dd6b20' : '#e53e3e' }} /></div>
                      {b.pct}%
                    </div>
                  </td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className={`${statusMap[b.statut]} px-2.5 py-1 rounded-[20px] text-[11px] font-bold inline-flex items-center gap-1`}>{statusIcon[b.statut]} {b.statut}</span></td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className="text-accent text-sm">{'⭐'.repeat(b.score)}{'☆'.repeat(5 - b.score)}</span></td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onShowProfil(b.id)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">👁️ Voir</button>
                      {user?.role === 'admin' && (
                        <button onClick={() => setDeleteId(b.id)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors">🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-[20px] p-8 w-[90%] max-w-[640px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="text-lg font-extrabold text-primary">➕ Nouveau Dossier de Crédit</div>
              <button onClick={() => { setShowModal(false); setPhotoFile(null); setPhotoPreview(null); }} className="bg-transparent border-none text-[22px] cursor-pointer text-muted-foreground hover:text-destructive">✕</button>
            </div>

            {/* Photo upload */}
            <div className="flex items-center gap-4 mb-5 p-3.5 bg-muted/30 rounded-[10px]">
              <div className="relative">
                {photoPreview ? (
                  <img src={photoPreview} alt="Photo" className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl border-2 border-dashed border-border">👤</div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-foreground mb-1">Photo de la bénéficiaire</div>
                <button onClick={() => photoInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">
                  📷 {photoPreview ? 'Changer la photo' : 'Ajouter une photo'}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Nom complet *</label>
                <input type="text" value={form.nom} onChange={e => handleChange('nom', e.target.value)} placeholder="Nom de la bénéficiaire" className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Téléphone *</label>
                <input type="text" value={form.tel} onChange={e => handleChange('tel', e.target.value)} placeholder="+225 07 XX XX XX XX" className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Date de naissance</label>
                <input type="date" value={form.dob} onChange={e => handleChange('dob', e.target.value)} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Ville *</label>
                <select value={form.ville} onChange={e => { handleChange('ville', e.target.value); handleChange('quartier', VILLES_QUARTIERS[e.target.value]?.[0] || ''); }} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                  {Object.keys(VILLES_QUARTIERS).map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Quartier *</label>
                <select value={form.quartier} onChange={e => handleChange('quartier', e.target.value)} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                  {(VILLES_QUARTIERS[form.ville] || []).map(q => <option key={q}>{q}</option>)}
                </select>
              </div>
              <div className="mb-2 col-span-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Adresse complète</label>
                <input type="text" value={form.adresse} onChange={e => handleChange('adresse', e.target.value)} placeholder="Ex: Cocody Riviera, Abidjan" className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Activité commerciale *</label>
                <input type="text" value={form.activite} onChange={e => handleChange('activite', e.target.value)} placeholder="Ex: Commerce de détail" className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Groupe solidaire</label>
                <input type="text" value={form.groupe} onChange={e => handleChange('groupe', e.target.value)} placeholder="Nom du groupe" className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Montant demandé (FCFA) *</label>
                <input type="number" value={form.montant} onChange={e => handleChange('montant', e.target.value)} placeholder="Ex: 300000" className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Fréquence de remboursement *</label>
                <select value={form.frequence} onChange={e => handleChange('frequence', e.target.value)} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                  <option value="hebdomadaire">Hebdomadaire</option>
                  <option value="bimensuel">Bimensuel (2x/mois)</option>
                  <option value="mensuel">Mensuel (fin de mois)</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">
                  Nombre d'échéances *
                </label>
                <input type="number" value={form.duree} onChange={e => handleChange('duree', e.target.value)} placeholder={form.frequence === 'hebdomadaire' ? 'Ex: 16' : form.frequence === 'bimensuel' ? 'Ex: 8' : 'Ex: 6'} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Taux d'intérêt *</label>
                <select value={form.taux} onChange={e => handleChange('taux', e.target.value)} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                  <option>2%/semaine</option><option>1.5%/semaine</option><option>1%/semaine</option><option>2%/mois</option><option>1.5%/mois</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">N° de crédit</label>
                <select value={form.credit_num} onChange={e => handleChange('credit_num', e.target.value)} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                  <option>1er crédit</option><option>2ème crédit</option><option>3ème crédit</option><option>4ème crédit</option><option>5ème crédit</option>
                </select>
              </div>
            </div>
            <div className="mb-3 mt-1">
              <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Agent assigné *</label>
              <select value={form.agent} onChange={e => handleChange('agent', e.target.value)} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                <option>Moussa Coulibaly</option><option>Adjoua Kouassi</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Notes / Observations</label>
              <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="Observations sur la bénéficiaire..." className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter resize-y min-h-[60px]" />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setShowModal(false); setPhotoFile(null); setPhotoPreview(null); }} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors">Annuler</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors disabled:opacity-50">
                {submitting ? '⏳ Enregistrement...' : '📤 Soumettre pour approbation'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteId && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[1100] backdrop-blur-sm" onClick={() => setDeleteId(null)}>
          <div className="bg-card rounded-[16px] p-6 w-[90%] max-w-[420px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold text-destructive mb-2">🗑️ Confirmer la suppression</div>
            <p className="text-sm text-muted-foreground mb-5">
              Cette action est irréversible. Le dossier du bénéficiaire ainsi que toutes ses échéances, transactions et documents seront définitivement supprimés.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-transparent border-2 border-border text-foreground hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors disabled:opacity-50">
                {deleting ? '⏳ Suppression...' : '🗑️ Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}