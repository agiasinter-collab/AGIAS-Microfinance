import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AVATAR_COLORS, getInitials, formatXOF } from '@/data/agias-data';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const statusMap: Record<string, string> = { Actif: 'bg-success/[0.12] text-success', Retard: 'bg-warning/[0.12] text-warning', Défaut: 'bg-destructive/[0.12] text-destructive', Soldé: 'bg-accent/15 text-[#8a6d1a]' };
const echStatusMap: Record<string, string> = { Payé: 'bg-success/[0.12] text-success', 'En cours': 'bg-info/[0.12] text-info', Retard: 'bg-warning/[0.12] text-warning', 'À venir': 'bg-muted text-muted-foreground', Impayé: 'bg-destructive/[0.12] text-destructive' };
const echIcon: Record<string, string> = { Payé: '✅', 'En cours': '🔵', Retard: '⚠️', 'À venir': '📅', Impayé: '🚨' };

const DOC_TYPES = [
  'Carte Nationale d\'Identité', 'Passeport', 'Permis de conduire',
  'Attestation de résidence', 'Photo de l\'activité', 'Contrat signé',
  'Document de garantie', 'Autre',
];

interface Props { beneficiaireId: string; onBack: () => void; }

export default function ProfilBeneficiaire({ beneficiaireId, onBack }: Props) {
  const { user } = useAuth();
  const canEdit = user?.role !== 'agent';
  const [b, setB] = useState<any>(null);
  const [echeances, setEcheances] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docName, setDocName] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; preview: string } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, [beneficiaireId]);

  const fetchAll = async () => {
    const [benefRes, echRes, txnRes, docRes] = await Promise.all([
      supabase.from('beneficiaires').select('*').eq('id', beneficiaireId).maybeSingle(),
      supabase.from('echeances').select('*').eq('beneficiaire_id', beneficiaireId).order('created_at'),
      supabase.from('transactions').select('*').eq('beneficiaire_id', beneficiaireId).order('created_at', { ascending: false }),
      supabase.from('documents_beneficiaire').select('*').eq('beneficiaire_id', beneficiaireId).order('created_at', { ascending: false }),
    ]);
    setB(benefRes.data);
    setEcheances(echRes.data || []);
    setTransactions(txnRes.data || []);
    setDocuments(docRes.data || []);
    setNotes(benefRes.data?.notes || '');
    setLoading(false);
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('beneficiaires-files').getPublicUrl(path);
    return data.publicUrl;
  };

  // --- Photo ---
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Veuillez sélectionner une image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('L\'image ne doit pas dépasser 5 Mo'); return; }
    const reader = new FileReader();
    reader.onload = () => setPendingPhoto({ file, preview: reader.result as string });
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const confirmPhotoUpload = async () => {
    if (!pendingPhoto) return;
    setUploadingPhoto(true);
    const ext = pendingPhoto.file.name.split('.').pop();
    const path = `photos/${beneficiaireId}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('beneficiaires-files').upload(path, pendingPhoto.file, { upsert: true });
    if (uploadErr) { toast.error('Erreur lors de l\'upload'); console.error(uploadErr); setUploadingPhoto(false); return; }
    const publicUrl = getPublicUrl(path) + '?t=' + Date.now();
    const { error: updateErr } = await supabase.from('beneficiaires').update({ photo_url: publicUrl }).eq('id', beneficiaireId);
    setUploadingPhoto(false);
    if (updateErr) { toast.error('Erreur de mise à jour'); console.error(updateErr); }
    else { toast.success('📸 Photo mise à jour !'); setB((prev: any) => ({ ...prev, photo_url: publicUrl })); }
    setPendingPhoto(null);
  };

  // --- Documents ---
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Le fichier ne doit pas dépasser 10 Mo'); return; }
    setUploadingDoc(true);
    const ext = file.name.split('.').pop();
    const path = `documents/${beneficiaireId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('beneficiaires-files').upload(path, file);
    if (uploadErr) { toast.error('Erreur lors de l\'upload'); console.error(uploadErr); setUploadingDoc(false); return; }
    const publicUrl = getPublicUrl(path);
    const { error: insertErr } = await supabase.from('documents_beneficiaire').insert({
      beneficiaire_id: beneficiaireId, nom: docName.trim() || docType, type: docType, file_url: publicUrl, file_name: file.name,
    });
    setUploadingDoc(false);
    if (insertErr) { toast.error('Erreur de sauvegarde du document'); console.error(insertErr); }
    else { toast.success('📎 Document ajouté !'); setDocName(''); fetchAll(); }
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleDeleteDoc = async (doc: any) => {
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return;
    const urlParts = doc.file_url.split('/beneficiaires-files/');
    if (urlParts[1]) await supabase.storage.from('beneficiaires-files').remove([decodeURIComponent(urlParts[1])]);
    const { error } = await supabase.from('documents_beneficiaire').delete().eq('id', doc.id);
    if (error) { toast.error('Erreur de suppression'); console.error(error); }
    else { toast.success('Document supprimé'); fetchAll(); }
  };

  // --- Notes ---
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const { error } = await supabase.from('beneficiaires').update({ notes }).eq('id', beneficiaireId);
    setSavingNotes(false);
    if (error) { toast.error('Erreur lors de la sauvegarde'); console.error(error); }
    else toast.success('📝 Note enregistrée !');
  };

  // --- Edit ---
  const openEdit = () => {
     setEditForm({
      nom: b.nom || '', tel: b.tel || '', dob: b.dob || '', ville: b.ville || 'Abidjan', quartier: b.quartier || 'Cocody',
      adresse: b.adresse || '', activite: b.activite || '', groupe: b.groupe || '',
      agent_name: b.agent_name || 'Moussa Coulibaly', taux: b.taux || '2%/semaine',
      credit_num: b.credit_num || '1er crédit', statut: b.statut || 'Actif',
      score: b.score ?? 3,
    });
    setShowEdit(true);
  };

  const handleEditChange = (field: string, value: string | number) => setEditForm((f: any) => ({ ...f, [field]: value }));

  const handleEditSubmit = async () => {
    if (!editForm.nom.trim() || !editForm.tel.trim() || !editForm.activite.trim()) {
      toast.error('Nom, téléphone et activité sont obligatoires');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('beneficiaires').update({
      nom: editForm.nom.trim(),
      tel: editForm.tel.trim(),
      dob: editForm.dob || null,
      ville: editForm.ville,
      quartier: editForm.quartier,
      adresse: editForm.adresse.trim() || null,
      activite: editForm.activite.trim(),
      groupe: editForm.groupe.trim() || null,
      agent_name: editForm.agent_name,
      taux: editForm.taux,
      credit_num: editForm.credit_num,
      statut: editForm.statut,
      score: parseInt(editForm.score) || 3,
    }).eq('id', beneficiaireId);
    setSaving(false);

    if (error) { toast.error('Erreur lors de la mise à jour'); console.error(error); }
    else { toast.success('✅ Dossier mis à jour !'); setShowEdit(false); fetchAll(); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!b) return <div className="text-center py-20 text-muted-foreground">Bénéficiaire introuvable</div>;

  const modeIcons: Record<string, string> = { Cash: '💵', 'Orange Money': '🟠', 'MTN Money': '🟡', Wave: '🔵', Virement: '🏦' };
  const inputCls = "w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter bg-card";

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div><h2 className="text-[22px] font-extrabold text-primary">📋 Fiche Bénéficiaire</h2><p className="text-[13px] text-muted-foreground mt-0.5">{b.nom} — {b.dossier}</p></div>
        <div className="flex gap-2.5">
          {canEdit && <button onClick={openEdit} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">✏️ Modifier le dossier</button>}
          <button onClick={onBack} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors">← Retour</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* Left */}
        <div className="space-y-5">
          <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)] text-center">
            <div className="relative mx-auto mb-4 w-24 h-24 group">
              {b.photo_url ? (
                <img src={b.photo_url} alt={b.nom} className="w-24 h-24 rounded-full object-cover border-4 border-primary/20" />
              ) : (
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-[28px] font-extrabold text-card border-4 border-primary/20" style={{ background: AVATAR_COLORS[0] }}>{getInitials(b.nom)}</div>
              )}
              {canEdit && (
                <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-card flex items-center justify-center text-sm hover:bg-primary-lighter transition-colors shadow-md border-2 border-card cursor-pointer disabled:opacity-50" title="Changer la photo">
                  {uploadingPhoto ? '⏳' : '📷'}
                </button>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </div>
            <h3 className="text-lg font-extrabold text-primary mb-2">{b.nom}</h3>
            <div className="mb-3"><span className={`${statusMap[b.statut]} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{b.statut}</span></div>
            <div className="text-lg mb-3">{'⭐'.repeat(b.score)}{'☆'.repeat(5 - b.score)}</div>
            <div className="bg-muted/50 rounded-[10px] p-3 text-left space-y-0">
              {[['📞 Téléphone', b.tel], ['🏙️ Ville', b.ville || 'Abidjan'], ['🏘️ Quartier', b.quartier], ['💼 Activité', b.activite]].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2.5 border-b border-muted last:border-b-0 text-[13px]"><span className="text-muted-foreground font-semibold">{l}</span><span className="text-foreground font-medium text-right">{v}</span></div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
            <div className="text-base font-bold text-primary mb-3.5">📝 Informations Personnelles</div>
            {[['🎂 Date de naissance', b.dob], ['📍 Adresse', b.adresse], ['🤝 Groupe solidaire', b.groupe], ['👷 Agent assigné', b.agent_name], ['📅 Inscrite le', b.inscription]].map(([l, v]) => (
              <div key={l} className="flex justify-between py-2.5 border-b border-muted last:border-b-0 text-[13px]"><span className="text-muted-foreground font-semibold">{l}</span><span className="text-foreground font-medium text-right">{v || '—'}</span></div>
            ))}
          </div>

          {/* Documents */}
          <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
            <div className="text-base font-bold text-primary mb-3.5">📎 Pièces Jointes</div>
            {canEdit && (
              <div className="bg-muted/30 rounded-[10px] p-3.5 mb-4 space-y-2.5">
                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full p-2 border-2 border-border rounded-lg text-[13px] outline-none focus:border-primary-lighter bg-card">
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Nom du document (optionnel)" className="w-full p-2 border-2 border-border rounded-lg text-[13px] outline-none focus:border-primary-lighter bg-card" />
                <button onClick={() => docInputRef.current?.click()} disabled={uploadingDoc} className="w-full px-3 py-2 rounded-lg text-[12px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors disabled:opacity-50">
                  {uploadingDoc ? '⏳ Upload en cours...' : '📤 Ajouter un document'}
                </button>
                <input ref={docInputRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleDocUpload} />
              </div>
            )}
            {documents.length > 0 ? (
              <div className="space-y-0">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between py-2.5 border-b border-muted last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground truncate">{doc.type.includes('Identité') ? '🪪' : doc.type.includes('Passeport') ? '🛂' : doc.type.includes('Permis') ? '🚗' : doc.type.includes('Attestation') ? '🏠' : doc.type.includes('Photo') ? '📷' : doc.type.includes('Contrat') ? '📝' : doc.type.includes('garantie') ? '🔒' : '📄'} {doc.nom}</div>
                      <div className="text-[11px] text-muted-foreground">{doc.file_name} — {new Date(doc.created_at).toLocaleDateString('fr-FR')}</div>
                    </div>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors">Voir</a>
                        {canEdit && <button onClick={() => handleDeleteDoc(doc)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-transparent border-2 border-destructive text-destructive hover:bg-destructive hover:text-card transition-colors">✕</button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-[13px]">Aucun document ajouté</div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-5">
          <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
            <div className="flex justify-between items-center mb-4">
              <div className="text-base font-bold text-primary">💳 Crédit Actuel</div>
              <span className={`${statusMap[b.statut]} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{b.statut}</span>
            </div>
            <div className="grid grid-cols-3 gap-3.5 mb-4">
              {[['N° CRÉDIT', b.credit_num], ['MONTANT', formatXOF(b.montant)], ['TAUX', b.taux]].map(([l, v]) => (
                <div key={l} className="bg-muted/50 rounded-[10px] p-3.5 text-center"><div className="text-[11px] text-muted-foreground font-semibold mb-1">{l}</div><div className="text-sm font-bold text-primary">{v || '—'}</div></div>
              ))}
            </div>
            <div className="my-4">
              <div className="flex justify-between text-[13px] mb-1.5"><span className="font-semibold text-foreground">Progression du remboursement</span><span className="font-extrabold text-success">{b.pct}%</span></div>
              <div className="h-3 bg-border rounded-md overflow-hidden"><div className="h-full rounded-md bg-gradient-to-r from-success to-[#68d391] transition-all" style={{ width: `${b.pct}%` }} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mt-3.5">
              <div className="text-center p-2.5 bg-success/[0.08] rounded-lg"><div className="text-[11px] text-muted-foreground font-semibold">PAYÉ</div><div className="text-[15px] font-extrabold text-success">{formatXOF(b.paye)}</div></div>
              <div className="text-center p-2.5 bg-warning/[0.08] rounded-lg"><div className="text-[11px] text-muted-foreground font-semibold">RESTANT</div><div className="text-[15px] font-extrabold text-warning">{formatXOF(b.total - b.paye)}</div></div>
              <div className="text-center p-2.5 bg-info/[0.08] rounded-lg"><div className="text-[11px] text-muted-foreground font-semibold">TOTAL DÛ</div><div className="text-[15px] font-extrabold text-info">{formatXOF(b.total)}</div></div>
            </div>
          </div>

          <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
            <div className="text-base font-bold text-primary mb-3.5">📆 Échéancier de Remboursement</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr>{['#', 'Date Échéance', 'Montant Prévu', 'Montant Payé', 'Retard', 'Statut'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
                <tbody>
                  {echeances.length > 0 ? echeances.map((e, i) => (
                    <tr key={e.id} className="hover:bg-muted/50">
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{i + 1}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{e.date}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{formatXOF(e.prevu)}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{e.paye > 0 ? formatXOF(e.paye) : '—'}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{e.retard > 0 ? <span className="bg-destructive/[0.12] text-destructive px-2 py-0.5 rounded-[20px] text-[11px] font-bold">{e.retard}j</span> : '—'}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className={`${echStatusMap[e.statut] || 'bg-muted text-muted-foreground'} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{echIcon[e.statut] || '📅'} {e.statut}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="px-3.5 py-6 text-center text-muted-foreground text-[13px]">Aucune échéance enregistrée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
            <div className="text-base font-bold text-primary mb-3.5">💸 Historique des Transactions</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr>{['Date', 'Type', 'Montant', 'Mode', 'Agent', 'Référence'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
                <tbody>
                  {transactions.length > 0 ? transactions.map(t => (
                    <tr key={t.id} className="hover:bg-muted/50">
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-semibold">
                        <span className={`${t.type === 'Décaissement' ? 'bg-info/[0.12] text-info' : 'bg-success/[0.12] text-success'} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>
                          {t.type === 'Décaissement' ? '📤' : '💰'} {t.type}
                        </span>
                      </td>
                      <td className={`px-3.5 py-[13px] text-[13px] border-b border-muted font-bold ${t.type === 'Décaissement' ? 'text-info' : 'text-success'}`}>
                        {t.type === 'Décaissement' ? '-' : '+'}{formatXOF(t.montant)}
                      </td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{modeIcons[t.methode || ''] || '💳'} {t.methode || '—'}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{t.agent_name || '—'}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><code className="bg-muted px-2 py-0.5 rounded-md text-xs">{t.reference || '—'}</code></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="px-3.5 py-6 text-center text-muted-foreground text-[13px]">Aucune transaction enregistrée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
            <div className="text-base font-bold text-primary mb-3.5">📝 Notes de l'Agent</div>
            <textarea value={notes} onChange={e => { if (canEdit) setNotes(e.target.value); }} readOnly={!canEdit} className={`w-full p-3 border-2 border-border rounded-[10px] text-[13px] resize-y min-h-[80px] outline-none focus:border-primary-lighter ${!canEdit ? 'bg-muted cursor-not-allowed' : ''}`} placeholder={canEdit ? 'Ajouter une note...' : 'Aucune note'} />
            {canEdit && (
              <button onClick={handleSaveNotes} disabled={savingNotes} className="mt-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors disabled:opacity-50">
                {savingNotes ? '⏳ Enregistrement...' : '💾 Enregistrer la note'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowEdit(false)}>
          <div className="bg-card rounded-[20px] p-8 w-[90%] max-w-[640px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="text-lg font-extrabold text-primary">✏️ Modifier le Dossier</div>
              <button onClick={() => setShowEdit(false)} className="bg-transparent border-none text-[22px] cursor-pointer text-muted-foreground hover:text-destructive">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Nom complet *</label>
                <input type="text" value={editForm.nom} onChange={e => handleEditChange('nom', e.target.value)} className={inputCls} />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Téléphone *</label>
                <input type="text" value={editForm.tel} onChange={e => handleEditChange('tel', e.target.value)} className={inputCls} />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Date de naissance</label>
                <input type="text" value={editForm.dob} onChange={e => handleEditChange('dob', e.target.value)} placeholder="Ex: 15/04/1985" className={inputCls} />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Ville</label>
                <select value={editForm.ville || 'Abidjan'} onChange={e => { handleEditChange('ville', e.target.value); const vq: Record<string,string[]> = {'Abidjan':['Cocody','Adjamé','Plateau','Yopougon','Abobo','Marcory','Treichville','Koumassi','Port-Bouët','Attécoubé','Anyama','Bingerville','Songon'],'Agboville':['Centre-ville','Rubino','Agneby','Grand-Morié','Offa','Azaguié-gare'],'Sikensi':['Centre','Gare routière','Quartier résidentiel'],'Adzopé':['Centre-ville','Dioulakro','Bécoukro','Agneby'],'Dabou':['Centre-ville','Lopou','Agnéby','Orbaff'],'Grand-Bassam':['Ancien Bassam','Nouveau Bassam','Phare','Mondoukou','Azuretti','Modeste'],'Aboisso':['Centre-ville','Commerce','Résidentiel','Dioulakro'],'Tiassalé':['Centre-ville','N\'douci-gare','Bandama'],'Divo':['Centre-ville','Dioulakro','Commerce','Lôh-Djiboua','Gbagbam'],'Jacqueville':['Centre','Addah','Ahua'],'Alépé':['Centre-ville','Dioulakro','Mé'],'Bonoua':['Centre-ville','Commerce','Abouré'],'Assinie':['Assinie-Mafia','Assinie-France','Centre'],'Grand-Lahou':['Centre','Lahou-Plage','Braffedon'],'Bouaké':['Commerce','Dar-es-Salam','Air France','Koko','Belleville','Zone Industrielle'],'Yamoussoukro':['Habitat','Dioulakro','Morofé','220 Logements','Millionnaire'],'San Pedro':['Bardot','Cité','Séwéké','Balmer','Zimbabwe'],'Daloa':['Commerce','Orly','Lobia','Soleil','Tazibouo'],'Korhogo':['Soba','Koko','Petit Paris','Dem','Sinistré'],'Man':['Commerce','Doyagouiné','Libreville','Gbêpleu'],'Gagnoa':['Dioulabougou','Commerce','Garahio']}; handleEditChange('quartier', vq[e.target.value]?.[0] || ''); }} className={inputCls}>
                  {['Abidjan','Agboville','Sikensi','Adzopé','Dabou','Grand-Bassam','Aboisso','Tiassalé','Divo','Jacqueville','Alépé','Bonoua','Assinie','Grand-Lahou','Bouaké','Yamoussoukro','San Pedro','Daloa','Korhogo','Man','Gagnoa'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Quartier</label>
                <select value={editForm.quartier} onChange={e => handleEditChange('quartier', e.target.value)} className={inputCls}>
                  {(({'Abidjan':['Cocody','Adjamé','Plateau','Yopougon','Abobo','Marcory','Treichville','Koumassi','Port-Bouët','Attécoubé','Anyama','Bingerville','Songon'],'Agboville':['Centre-ville','Rubino','Agneby','Grand-Morié','Offa','Azaguié-gare'],'Sikensi':['Centre','Gare routière','Quartier résidentiel'],'Adzopé':['Centre-ville','Dioulakro','Bécoukro','Agneby'],'Dabou':['Centre-ville','Lopou','Agnéby','Orbaff'],'Grand-Bassam':['Ancien Bassam','Nouveau Bassam','Phare','Mondoukou','Azuretti','Modeste'],'Aboisso':['Centre-ville','Commerce','Résidentiel','Dioulakro'],'Tiassalé':['Centre-ville','N\'douci-gare','Bandama'],'Divo':['Centre-ville','Dioulakro','Commerce','Lôh-Djiboua','Gbagbam'],'Jacqueville':['Centre','Addah','Ahua'],'Alépé':['Centre-ville','Dioulakro','Mé'],'Bonoua':['Centre-ville','Commerce','Abouré'],'Assinie':['Assinie-Mafia','Assinie-France','Centre'],'Grand-Lahou':['Centre','Lahou-Plage','Braffedon'],'Bouaké':['Commerce','Dar-es-Salam','Air France','Koko','Belleville','Zone Industrielle'],'Yamoussoukro':['Habitat','Dioulakro','Morofé','220 Logements','Millionnaire'],'San Pedro':['Bardot','Cité','Séwéké','Balmer','Zimbabwe'],'Daloa':['Commerce','Orly','Lobia','Soleil','Tazibouo'],'Korhogo':['Soba','Koko','Petit Paris','Dem','Sinistré'],'Man':['Commerce','Doyagouiné','Libreville','Gbêpleu'],'Gagnoa':['Dioulabougou','Commerce','Garahio']} as Record<string,string[]>)[editForm.ville || 'Abidjan'] || []).map((q: string) => <option key={q}>{q}</option>)}
                </select>
              </div>
              <div className="mb-2 col-span-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Adresse complète</label>
                <input type="text" value={editForm.adresse} onChange={e => handleEditChange('adresse', e.target.value)} placeholder="Ex: Cocody Riviera, Abidjan" className={inputCls} />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Activité commerciale *</label>
                <input type="text" value={editForm.activite} onChange={e => handleEditChange('activite', e.target.value)} className={inputCls} />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Groupe solidaire</label>
                <input type="text" value={editForm.groupe} onChange={e => handleEditChange('groupe', e.target.value)} className={inputCls} />
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Taux d'intérêt</label>
                <select value={editForm.taux} onChange={e => handleEditChange('taux', e.target.value)} className={inputCls}>
                  <option>2%/semaine</option><option>1.5%/semaine</option><option>1%/semaine</option><option>2%/mois</option><option>1.5%/mois</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">N° de crédit</label>
                <select value={editForm.credit_num} onChange={e => handleEditChange('credit_num', e.target.value)} className={inputCls}>
                  <option>1er crédit</option><option>2ème crédit</option><option>3ème crédit</option><option>4ème crédit</option><option>5ème crédit</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Statut</label>
                <select value={editForm.statut} onChange={e => handleEditChange('statut', e.target.value)} className={inputCls}>
                  <option>Actif</option><option>Retard</option><option>Défaut</option><option>Soldé</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Score (1-5)</label>
                <select value={editForm.score} onChange={e => handleEditChange('score', parseInt(e.target.value))} className={inputCls}>
                  <option value={1}>⭐ 1</option><option value={2}>⭐⭐ 2</option><option value={3}>⭐⭐⭐ 3</option><option value={4}>⭐⭐⭐⭐ 4</option><option value={5}>⭐⭐⭐⭐⭐ 5</option>
                </select>
              </div>
            </div>
            <div className="mb-3 mt-1">
              <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Agent assigné</label>
              <select value={editForm.agent_name} onChange={e => handleEditChange('agent_name', e.target.value)} className={inputCls}>
                <option>Mamadou Diallo</option><option>Fatoumata Sow</option>
              </select>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowEdit(false)} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors">Annuler</button>
              <button onClick={handleEditSubmit} disabled={saving} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors disabled:opacity-50">
                {saving ? '⏳ Enregistrement...' : '✅ Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Confirmation Modal */}
      {pendingPhoto && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setPendingPhoto(null)}>
          <div className="bg-card rounded-[20px] p-6 w-[90%] max-w-[400px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-in fade-in-0 zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div className="text-lg font-extrabold text-foreground">📷 Confirmer la photo</div>
              <button onClick={() => setPendingPhoto(null)} className="bg-transparent border-none text-[22px] cursor-pointer text-muted-foreground hover:text-destructive">✕</button>
            </div>
            <div className="flex justify-center mb-5">
              <img src={pendingPhoto.preview} alt="Aperçu" className="w-36 h-36 rounded-full object-cover border-4 border-border shadow-lg" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-1">
              Changer la photo de <span className="font-bold text-foreground">{b?.nom}</span> ?
            </p>
            <p className="text-xs text-muted-foreground text-center mb-5">Cette action remplacera la photo actuelle.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPendingPhoto(null)} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border-2 border-border text-muted-foreground hover:bg-muted transition-colors">Annuler</button>
              <button onClick={confirmPhotoUpload} disabled={uploadingPhoto} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors disabled:opacity-50">
                {uploadingPhoto ? '⏳ Upload...' : '✅ Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
