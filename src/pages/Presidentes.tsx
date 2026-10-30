import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Phone, MapPin, Crown, Plus, Edit2, Trash2, Users, Camera, X as XIcon, Eye, ChevronRight, UserPlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';


interface Beneficiaire {
  id: string;
  nom: string;
  dossier: string;
  tel: string | null;
  statut: string;
  montant: number;
  paye: number;
  pct: number;
  photo_url: string | null;
  activite: string | null;
}

interface Presidente {
  id: string;
  nom: string;
  tel: string | null;
  ville: string | null;
  quartier: string | null;
  localite: string | null;
  photo_url: string | null;
  groupe: string | null;
  notes: string | null;
  agent_name: string | null;
  active: boolean;
  created_at: string;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

const EMPTY_FORM = { nom: '', tel: '', ville: 'Abidjan', quartier: '', localite: '', groupe: '', notes: '' };

export default function PresidentesPage({ onShowProfil }: { onShowProfil?: (id: string) => void }) {
  const { user } = useAuth();
  const [presidentes, setPresidentes] = useState<Presidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLocalite, setFilterLocalite] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Members dialog state
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState<Beneficiaire[]>([]);
  const [selectedPresidente, setSelectedPresidente] = useState<Presidente | null>(null);

  // Assign beneficiary state
  const [assignSearch, setAssignSearch] = useState('');
  const [assignResults, setAssignResults] = useState<Beneficiaire[]>([]);
  const [assignSearching, setAssignSearching] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showAssignPanel, setShowAssignPanel] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'superviseur';

  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const fetchPresidentes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('presidentes').select('*').order('localite').order('nom');
      if (user?.role === 'agent') {
        query = query.eq('agent_name', user.name);
      }
      const { data, error } = await query;
      if (error) {
        toast.error('Erreur chargement des présidentes');
      } else if (data) {
        setPresidentes(data as Presidente[]);
      }
    } catch (err) {
      toast.error('Erreur réseau lors du chargement des présidentes');
    }
    setLoading(false);
  }, [user]);

  // Fetch member counts per group
  const fetchMemberCounts = useCallback(async () => {
    const groupes = [...new Set(presidentes.map(p => p.groupe).filter(Boolean))] as string[];
    if (groupes.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('beneficiaires')
        .select('groupe')
        .in('groupe', groupes);
      if (error) {
        toast.error('Erreur chargement des effectifs');
      } else if (data) {
        const counts: Record<string, number> = {};
        data.forEach(b => { if (b.groupe) counts[b.groupe] = (counts[b.groupe] || 0) + 1; });
        setMemberCounts(counts);
      }
    } catch (err) {
      toast.error('Erreur réseau lors du chargement des effectifs');
    }
  }, [presidentes]);

  useEffect(() => { fetchPresidentes(); }, [fetchPresidentes]);
  useEffect(() => { fetchMemberCounts(); }, [fetchMemberCounts]);

  useEffect(() => {
    const channel = supabase
      .channel('presidentes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presidentes' }, () => { fetchPresidentes(); fetchMemberCounts(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiaires' }, () => fetchMemberCounts())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          toast.error('Erreur de connexion temps réel — actualisez la page');
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [fetchPresidentes, fetchMemberCounts]);

  const localites = [...new Set(presidentes.map(p => p.localite).filter(Boolean))] as string[];

  const filtered = presidentes.filter(p => {
    const matchSearch =
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      (p.localite || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.groupe || '').toLowerCase().includes(search.toLowerCase());
    const matchLocalite = !filterLocalite || p.localite === filterLocalite;
    return matchSearch && matchLocalite;
  });

  const resetPhotoState = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingPhotoUrl(null);
  };

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); resetPhotoState(); setDialogOpen(true); };
  const openEdit = (p: Presidente) => {
    setEditingId(p.id);
    setForm({ nom: p.nom, tel: p.tel || '', ville: p.ville || '', quartier: p.quartier || '', localite: p.localite || '', groupe: p.groupe || '', notes: p.notes || '' });
    resetPhotoState();
    setExistingPhotoUrl(p.photo_url);
    setDialogOpen(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La photo ne doit pas dépasser 5 Mo'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (presidenteId: string): Promise<string | null> => {
    if (!photoFile) return existingPhotoUrl;
    const ext = photoFile.name.split('.').pop() || 'jpg';
    const path = `${presidenteId}.${ext}`;
    const { error } = await supabase.storage.from('presidentes-photos').upload(path, photoFile, { upsert: true });
    if (error) { toast.error("Erreur lors de l'upload de la photo"); return existingPhotoUrl; }
    const { data } = supabase.storage.from('presidentes-photos').getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const handleSave = async () => {
    if (!form.nom.trim()) { toast.error('Le nom est obligatoire'); return; }
    if (!form.localite.trim()) { toast.error('La localité est obligatoire'); return; }
    setSaving(true);

    const payload = {
      nom: form.nom.trim(),
      tel: form.tel.trim() || null,
      ville: form.ville.trim() || null,
      quartier: form.quartier.trim() || null,
      localite: form.localite.trim(),
      groupe: form.groupe.trim() || null,
      notes: form.notes.trim() || null,
      agent_name: user?.name || null,
      agent_id: user?.id || null,
    };

    if (editingId) {
      const photoUrl = await uploadPhoto(editingId);
      const { error } = await supabase.from('presidentes').update({ ...payload, photo_url: photoUrl }).eq('id', editingId);
      if (error) toast.error("Erreur lors de la modification");
      else toast.success('Présidente modifiée');
    } else {
      const { data, error } = await supabase.from('presidentes').insert(payload).select('id').single();
      if (error || !data) { toast.error("Erreur lors de l'ajout"); }
      else {
        if (photoFile) {
          const photoUrl = await uploadPhoto(data.id);
          if (photoUrl) await supabase.from('presidentes').update({ photo_url: photoUrl }).eq('id', data.id);
        }
        toast.success('Présidente ajoutée');
      }
    }

    setSaving(false);
    setDialogOpen(false);
    fetchPresidentes();
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer la présidente "${nom}" ?`)) return;
    const { error } = await supabase.from('presidentes').delete().eq('id', id);
    if (error) toast.error('Erreur lors de la suppression');
    else { toast.success('Présidente supprimée'); fetchPresidentes(); }
  };

  const viewMembers = async (p: Presidente) => {
    if (!p.groupe) { toast.info('Cette présidente n\'a pas de groupe assigné'); return; }
    setSelectedPresidente(p);
    setMembersLoading(true);
    setMembersOpen(true);
    setShowAssignPanel(false);
    setAssignSearch('');
    setAssignResults([]);
    try {
      const { data, error } = await supabase
        .from('beneficiaires')
        .select('id, nom, dossier, tel, statut, montant, paye, pct, photo_url, activite')
        .eq('groupe', p.groupe)
        .order('nom');
      if (error) {
        toast.error('Erreur chargement des membres');
        setMembers([]);
      } else {
        setMembers(data as Beneficiaire[]);
      }
    } catch (err) {
      toast.error('Erreur réseau lors du chargement des membres');
      setMembers([]);
    }
    setMembersLoading(false);
  };

  const searchUnassigned = async (term: string) => {
    setAssignSearch(term);
    if (term.trim().length < 2) { setAssignResults([]); return; }
    setAssignSearching(true);
    try {
      const memberIds = members.map(m => m.id);
      let query = supabase
        .from('beneficiaires')
        .select('id, nom, dossier, tel, statut, montant, paye, pct, photo_url, activite')
        .or(`nom.ilike.%${term.trim()}%,dossier.ilike.%${term.trim()}%`)
        .order('nom')
        .limit(10);
      // Exclude current members
      if (memberIds.length > 0) {
        query = query.not('id', 'in', `(${memberIds.join(',')})`);
      }
      const { data, error } = await query;
      if (error) {
        toast.error('Erreur recherche bénéficiaires');
      }
      setAssignResults(data as Beneficiaire[] || []);
    } catch (err) {
      toast.error('Erreur réseau lors de la recherche');
      setAssignResults([]);
    }
    setAssignSearching(false);
  };

  const assignToGroup = async (beneficiaireId: string) => {
    if (!selectedPresidente?.groupe) return;
    setAssigning(beneficiaireId);
    const { error } = await supabase
      .from('beneficiaires')
      .update({ groupe: selectedPresidente.groupe })
      .eq('id', beneficiaireId);
    if (error) {
      toast.error('Erreur lors de l\'assignation');
    } else {
      toast.success('Bénéficiaire ajouté au groupe');
      // Move from results to members
      const assigned = assignResults.find(r => r.id === beneficiaireId);
      if (assigned) {
        setMembers(prev => [...prev, assigned].sort((a, b) => a.nom.localeCompare(b.nom)));
        setAssignResults(prev => prev.filter(r => r.id !== beneficiaireId));
      }
      fetchMemberCounts();
    }
    setAssigning(null);
  };

  const removeFromGroup = async (beneficiaireId: string) => {
    setAssigning(beneficiaireId);
    const { error } = await supabase
      .from('beneficiaires')
      .update({ groupe: null })
      .eq('id', beneficiaireId);
    if (error) {
      toast.error('Erreur lors du retrait');
    } else {
      toast.success('Bénéficiaire retiré du groupe');
      setMembers(prev => prev.filter(m => m.id !== beneficiaireId));
      fetchMemberCounts();
    }
    setAssigning(null);
  };

  const inputCls = "w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all";
  const currentPhoto = photoPreview || existingPhotoUrl;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={item} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Crown className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{presidentes.length}</div>
            <div className="text-xs text-muted-foreground">Total Présidentes</div>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-accent" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{localites.length}</div>
            <div className="text-xs text-muted-foreground">Localités couvertes</div>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{presidentes.filter(p => p.active).length}</div>
            <div className="text-xs text-muted-foreground">Actives</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-card rounded-xl px-4 py-2.5 border border-border/40 shadow-sm">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Rechercher par nom, localité ou groupe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none text-sm text-foreground w-full"
          />
        </div>

        {localites.length > 0 && (
          <select
            value={filterLocalite}
            onChange={(e) => setFilterLocalite(e.target.value)}
            className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm text-foreground outline-none shadow-sm"
          >
            <option value="">Toutes les localités</option>
            {localites.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}

        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Ajouter une Présidente
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Crown className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Aucune présidente trouvée</p>
          {canEdit && <p className="text-sm mt-1">Cliquez sur "Ajouter" pour commencer</p>}
        </div>
      ) : (
        <>
          {(filterLocalite ? [filterLocalite] : localites.concat(presidentes.some(p => !p.localite) ? [''] : [])).map(loc => {
            const group = filtered.filter(p => (p.localite || '') === loc);
            if (group.length === 0) return null;
            return (
              <div key={loc || '__sans'} className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{loc || 'Sans localité'}</h3>
                  <span className="text-xs text-muted-foreground">({group.length})</span>
                </div>

                <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.map((p) => (
                    <motion.div
                      key={p.id}
                      variants={item}
                      whileHover={{ y: -4, transition: { type: 'spring' as const, stiffness: 400 } }}
                      className="group bg-card rounded-2xl border border-border/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                    <div className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="relative shrink-0">
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.nom} className="w-16 h-16 rounded-2xl object-cover border-2 border-primary/20 shadow-sm transition-transform duration-300 hover:scale-110" />
                            ) : (
                              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                                <Crown className="w-7 h-7 text-primary" />
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-accent rounded-full border-2 border-card flex items-center justify-center">
                              <Crown className="w-3 h-3 text-primary" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-foreground truncate">{p.nom}</div>
                            {p.groupe && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Users className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate">{p.groupe}</span>
                                <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full leading-none">
                                  {memberCounts[p.groupe] || 0}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {p.groupe && (
                                <button onClick={() => viewMembers(p)} className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors" title="Voir les membres">
                                  <Eye className="w-3.5 h-3.5 text-primary" />
                                </button>
                              )}
                              {canEdit && (
                                <>
                                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Modifier">
                                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                  {user?.role === 'admin' && (
                                    <button onClick={() => handleDelete(p.id, p.nom)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Supprimer">
                                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                          {p.tel && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span className="truncate">{p.tel}</span>
                            </div>
                          )}
                          {(p.quartier || p.ville) && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{[p.quartier, p.ville].filter(Boolean).join(', ')}</span>
                            </div>
                          )}
                        </div>

                        {p.notes && (
                          <p className="mt-3 text-xs text-muted-foreground line-clamp-2 italic">{p.notes}</p>
                        )}

                        {p.groupe && (
                          <button
                            onClick={() => viewMembers(p)}
                            className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors text-xs font-medium text-primary"
                          >
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" />
                              Voir les membres du groupe
                            </span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            );
          })}
        </>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              {editingId ? 'Modifier la Présidente' : 'Ajouter une Présidente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Photo upload */}
            <div className="flex flex-col items-center gap-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full cursor-pointer group overflow-hidden border-2 border-dashed border-border hover:border-primary/50 transition-colors"
              >
                {currentPhoto ? (
                  <>
                    <img src={currentPhoto} alt="Photo" className="w-full h-full object-cover rounded-full" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px] mt-0.5">Photo</span>
                  </div>
                )}
              </div>
              {currentPhoto && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPhotoFile(null); setPhotoPreview(null); setExistingPhotoUrl(null); }}
                  className="text-xs text-destructive hover:underline flex items-center gap-1"
                >
                  <XIcon className="w-3 h-3" /> Supprimer la photo
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Nom complet *</label>
              <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className={inputCls} placeholder="Ex: Aminata Koné" />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Localité *</label>
              <input value={form.localite} onChange={e => setForm(f => ({ ...f, localite: e.target.value }))} className={inputCls} placeholder="Ex: Abobo, Yopougon, Bouaké..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Téléphone</label>
                <input value={form.tel} onChange={e => setForm(f => ({ ...f, tel: e.target.value }))} className={inputCls} placeholder="07 XX XX XX XX" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Groupe</label>
                <input value={form.groupe} onChange={e => setForm(f => ({ ...f, groupe: e.target.value }))} className={inputCls} placeholder="Nom du groupe" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Ville</label>
                <input value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} className={inputCls} placeholder="Abidjan" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Quartier</label>
                <input value={form.quartier} onChange={e => setForm(f => ({ ...f, quartier: e.target.value }))} className={inputCls} placeholder="Quartier" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls + ' resize-none'} rows={2} placeholder="Remarques..." />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setDialogOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : editingId ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersOpen} onOpenChange={(open) => { setMembersOpen(open); if (!open) setShowAssignPanel(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="truncate">
                Membres — {selectedPresidente?.groupe || 'Groupe'}
              </span>
            </DialogTitle>
            {selectedPresidente && (
              <div className="flex items-center gap-3 mt-2">
                {selectedPresidente.photo_url ? (
                  <img src={selectedPresidente.photo_url} alt={selectedPresidente.nom} className="w-10 h-10 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                    <Crown className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedPresidente.nom}</p>
                  <p className="text-xs text-muted-foreground">{selectedPresidente.localite}</p>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Add member button */}
          {canEdit && !membersLoading && (
            <button
              onClick={() => { setShowAssignPanel(v => !v); setAssignSearch(''); setAssignResults([]); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {showAssignPanel ? 'Fermer' : 'Ajouter un bénéficiaire au groupe'}
            </button>
          )}

          {/* Assign panel */}
          <AnimatePresence>
            {showAssignPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pb-3 border-b border-border/40">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Rechercher un bénéficiaire par nom ou dossier..."
                      value={assignSearch}
                      onChange={(e) => searchUnassigned(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/60 bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  {assignSearching && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Recherche...
                    </div>
                  )}
                  {!assignSearching && assignSearch.length >= 2 && assignResults.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Aucun bénéficiaire trouvé</p>
                  )}
                  {assignResults.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      {r.photo_url ? (
                        <img src={r.photo_url} alt={r.nom} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent/50 flex items-center justify-center shrink-0 text-xs font-bold text-accent-foreground">
                          {r.nom.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{r.nom}</div>
                        <div className="text-xs text-muted-foreground">{r.dossier}</div>
                      </div>
                      <button
                        onClick={() => assignToGroup(r.id)}
                        disabled={assigning === r.id}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {assigning === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-2 mt-2">
            {membersLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : members.length === 0 && !showAssignPanel ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Aucun bénéficiaire dans ce groupe</p>
                <p className="text-xs mt-1">Cliquez sur "Ajouter un bénéficiaire" pour assigner des membres.</p>
              </div>
            ) : members.length > 0 ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-xs font-semibold text-muted-foreground">{members.length} membre{members.length > 1 ? 's' : ''}</span>
                  <span className="text-xs text-muted-foreground">
                    Total crédits : {members.reduce((s, m) => s + m.montant, 0).toLocaleString('fr-FR')} F
                  </span>
                </div>
                <AnimatePresence>
                  {members.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex-1 flex items-center gap-3 min-w-0" onClick={() => { setMembersOpen(false); onShowProfil?.(m.id); }}>
                        {m.photo_url ? (
                          <img src={m.photo_url} alt={m.nom} className="w-9 h-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                            {m.nom.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{m.nom}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{m.dossier}</span>
                            {m.activite && <span>· {m.activite}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-foreground">{m.pct}%</div>
                          <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            m.statut === 'Actif' ? 'bg-green-100 text-green-700' :
                            m.statut === 'Terminé' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {m.statut}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromGroup(m.id); }}
                          disabled={assigning === m.id}
                          className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          title="Retirer du groupe"
                        >
                          {assigning === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XIcon className="w-4 h-4" />}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
