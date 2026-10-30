import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type UserRow = {
  id: string;
  name: string;
  sub: string | null;
  email: string | null;
  initials: string;
  color: string;
  active: boolean;
  role: 'admin' | 'superviseur' | 'agent';
  photo_url: string | null;
};

type AuditRow = {
  id: string;
  admin_name: string;
  action: string;
  target_user: string;
  detail: string;
  created_at: string;
};

type DocFile = { file: File; type: string };

const roleBadge = (role: string) => {
  switch (role) {
    case 'admin': return { label: '👑 Admin', cls: 'bg-primary text-accent' };
    case 'superviseur': return { label: '🔵 Superviseur', cls: 'bg-info text-card' };
    default: return { label: '🟢 Agent Terrain', cls: 'bg-success text-card' };
  }
};

const actionClass = (action: string) => {
  if (action.includes('Création')) return 'bg-info/[0.12] text-info';
  if (action.includes('Modification') || action.includes('rôle')) return 'bg-warning/[0.12] text-warning';
  if (action.includes('Activation') || action.includes('activé')) return 'bg-success/[0.12] text-success';
  if (action.includes('Désactivation') || action.includes('désactivé')) return 'bg-destructive/[0.12] text-destructive';
  return 'bg-muted text-muted-foreground';
};

const DOC_TYPES = ["Carte d'identité", "Passeport", "Permis de conduire", "Attestation", "Contrat", "Autre"];

export default function UtilisateursPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<UserRow | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', tel: '', role: '', password: '', sub: '' });
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [docFiles, setDocFiles] = useState<DocFile[]>([]);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [changingPhotoFor, setChangingPhotoFor] = useState<string | null>(null);
  const [pendingUserPhoto, setPendingUserPhoto] = useState<{ file: File; preview: string; userId: string } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const changePhotoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');
    if (profiles && roles) {
      const merged: UserRow[] = profiles.map(p => {
        const r = roles.find(r => r.user_id === p.id);
        return {
          id: p.id,
          name: p.name,
          sub: (p as any).sub || null,
          email: (p as any).email || null,
          initials: p.initials,
          color: p.color,
          active: (p as any).active ?? true,
          role: (r?.role || 'agent') as UserRow['role'],
          photo_url: (p as any).photo_url || null,
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  }, []);

  const fetchAuditLog = useCallback(async () => {
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setAuditLog(data as AuditRow[]);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAuditLog();
    const channel = supabase
      .channel('utilisateurs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchUsers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => fetchUsers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, () => fetchAuditLog())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchUsers, fetchAuditLog]);

  const toggleStatus = async (user: UserRow) => {
    const newActive = !user.active;
    const { error } = await supabase.from('profiles').update({ active: newActive } as any).eq('id', user.id);
    if (error) { toast.error("Erreur lors de la modification du statut"); return; }
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data: adminProfile } = await supabase.from('profiles').select('name').eq('id', currentUser?.id || '').single();
    await supabase.from('audit_log').insert({
      admin_name: adminProfile?.name || 'Admin',
      action: newActive ? 'Activation' : 'Désactivation',
      target_user: user.name,
      detail: newActive ? 'Compte réactivé' : 'Compte désactivé',
    } as any);
    toast.success(`✅ ${user.name} ${newActive ? 'activé' : 'désactivé'} avec succès !`);
  };

  const changeRole = async (user: UserRow, newRole: string) => {
    const { error } = await supabase.from('user_roles').update({ role: newRole as any }).eq('user_id', user.id);
    if (error) { toast.error("Erreur lors de la modification du rôle"); return; }
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data: adminProfile } = await supabase.from('profiles').select('name').eq('id', currentUser?.id || '').single();
    const oldLabel = roleBadge(user.role).label;
    const newLabel = roleBadge(newRole).label;
    await supabase.from('audit_log').insert({
      admin_name: adminProfile?.name || 'Admin',
      action: 'Modification rôle',
      target_user: user.name,
      detail: `${oldLabel} → ${newLabel}`,
    } as any);
    toast.success(`✅ Rôle de ${user.name} modifié avec succès !`);
    setShowRoleModal(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error("Veuillez sélectionner une image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("L'image ne doit pas dépasser 5 Mo"); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDocAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Le fichier ne doit pas dépasser 10 Mo"); return; }
    setDocFiles(prev => [...prev, { file, type: docType }]);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const removeDoc = (idx: number) => {
    setDocFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleChangePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !changingPhotoFor) return;
    if (!file.type.startsWith('image/')) { toast.error("Veuillez sélectionner une image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("L'image ne doit pas dépasser 5 Mo"); return; }
    const reader = new FileReader();
    reader.onload = () => setPendingUserPhoto({ file, preview: reader.result as string, userId: changingPhotoFor });
    reader.readAsDataURL(file);
    if (changePhotoInputRef.current) changePhotoInputRef.current.value = '';
  };

  const confirmUserPhotoUpload = async () => {
    if (!pendingUserPhoto) return;
    const { file, userId } = pendingUserPhoto;
    const ext = file.name.split('.').pop();
    const path = `photos/${userId}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('user-files').upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Erreur lors de l'upload"); setPendingUserPhoto(null); return; }
    const { data: urlData } = supabase.storage.from('user-files').getPublicUrl(path);
    const photoUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('profiles').update({ photo_url: photoUrl } as any).eq('id', userId);
    toast.success('✅ Photo de profil mise à jour !');
    setPendingUserPhoto(null);
    setChangingPhotoFor(null);
  };

  const resetForm = () => {
    setNewUser({ name: '', email: '', tel: '', role: '', password: '', sub: '' });
    setPhotoFile(null);
    setPhotoPreview(null);
    setDocFiles([]);
    setDocType(DOC_TYPES[0]);
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.role) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    if (newUser.password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    setSaving(true);
    try {
      // 1. Create user via edge function
      const res = await supabase.functions.invoke('create-user', {
        body: { name: newUser.name, email: newUser.email, password: newUser.password, role: newUser.role, sub: newUser.sub },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);
      const userId = res.data.user_id;

      // 2. Upload photo if provided
      if (photoFile && userId) {
        const ext = photoFile.name.split('.').pop();
        const path = `photos/${userId}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('user-files').upload(path, photoFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('user-files').getPublicUrl(path);
          await supabase.from('profiles').update({ photo_url: urlData.publicUrl } as any).eq('id', userId);
        }
      }

      // 3. Upload documents if any
      for (const doc of docFiles) {
        const ext = doc.file.name.split('.').pop();
        const docPath = `documents/${userId}/${Date.now()}-${doc.file.name}`;
        const { error: docUploadErr } = await supabase.storage.from('user-files').upload(docPath, doc.file);
        if (!docUploadErr) {
          const { data: docUrl } = supabase.storage.from('user-files').getPublicUrl(docPath);
          await supabase.from('documents_utilisateur' as any).insert({
            user_id: userId,
            nom: doc.file.name,
            type: doc.type,
            file_name: doc.file.name,
            file_url: docUrl.publicUrl,
          });
        }
      }

      toast.success('✅ Compte utilisateur créé avec succès !');
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`);
    }
    setSaving(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const activeCount = users.filter(u => u.active).length;
  const isProtected = (user: UserRow) => user.role === 'admin';

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div><h2 className="text-[22px] font-extrabold text-primary">🔐 Gestion des Utilisateurs</h2><p className="text-[13px] text-muted-foreground mt-0.5">Attribution des rôles et gestion des accès — Réservé à l'Administrateur</p></div>
        <button onClick={() => setShowAddModal(true)} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">➕ Ajouter un Utilisateur</button>
      </div>

      <div className="bg-accent/[0.08] border border-accent/30 rounded-lg p-[22px] mb-5 flex items-center gap-3">
        <span className="text-2xl">👑</span>
        <div><div className="text-sm font-bold text-primary">Espace Administrateur — Attribution des Rôles</div><div className="text-[13px] text-muted-foreground">Seule la Présidente (Admin) peut créer des comptes, modifier les rôles et désactiver les accès.</div></div>
      </div>

      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)] mb-5">
        <div className="flex justify-between items-center mb-[18px]">
          <div className="text-base font-bold text-primary">👥 Utilisateurs du Système</div>
          <span className="bg-success/[0.12] text-success px-2.5 py-1 rounded-[20px] text-[11px] font-bold">{activeCount} comptes actifs</span>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['Utilisateur', 'Email', 'Rôle', 'Statut', 'Actions'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
              <tbody>
                {users.map(u => {
                  const badge = roleBadge(u.role);
                  return (
                    <tr key={u.id} className="hover:bg-muted/50">
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                        <div className="flex items-center gap-2.5">
                          {u.photo_url ? (
                            <img src={u.photo_url} alt={u.name} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-card" style={{ background: u.color }}>{u.initials}</div>
                          )}
                          <div><div className="font-bold">{u.name}</div>{u.sub && <div className="text-[11px] text-muted-foreground">{u.sub}</div>}</div>
                        </div>
                      </td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{u.email || '—'}</td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className={`${badge.cls} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{badge.label}</span></td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className={`${u.active ? 'bg-success/[0.12] text-success' : 'bg-destructive/[0.12] text-destructive'} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>● {u.active ? 'Actif' : 'Inactif'}</span></td>
                      <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setChangingPhotoFor(u.id); setTimeout(() => changePhotoInputRef.current?.click(), 100); }} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-transparent border-2 border-accent text-accent hover:bg-accent hover:text-primary transition-colors">📷 Photo</button>
                          <button onClick={() => setShowRoleModal(u)} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors">✏️ Rôle</button>
                          {isProtected(u) ? (
                            <button disabled className="px-2 py-1 rounded-md text-[11px] font-semibold bg-muted text-muted-foreground border-none cursor-not-allowed">🔒 Protégé</button>
                          ) : (
                            <button onClick={() => toggleStatus(u)} className={`px-2 py-1 rounded-md text-[11px] font-semibold ${u.active ? 'bg-destructive text-card' : 'bg-primary text-card'}`}>{u.active ? '🚫 Désactiver' : '✅ Activer'}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
        <div className="text-base font-bold text-primary mb-4">📋 Journal d'Audit — Modifications Récentes</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>{['Date', 'Administrateur', 'Action', 'Utilisateur Concerné', 'Détails'].map(h => <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>)}</tr></thead>
            <tbody>
              {auditLog.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Aucune action enregistrée</td></tr>
              ) : auditLog.map(a => (
                <tr key={a.id} className="hover:bg-muted/50">
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{formatDate(a.created_at)}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{a.admin_name}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted"><span className={`${actionClass(a.action)} px-2.5 py-1 rounded-[20px] text-[11px] font-bold`}>{a.action}</span></td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{a.target_user}</td>
                  <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden input for changing existing user photo */}
      <input ref={changePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleChangePhotoSelect} />

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div className="bg-card rounded-[20px] p-8 w-[90%] max-w-[560px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="text-lg font-extrabold text-primary">➕ Ajouter un Utilisateur</div>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="bg-transparent border-none text-[22px] cursor-pointer text-muted-foreground hover:text-destructive">✕</button>
            </div>

            {/* Photo Upload */}
            <div className="mb-5">
              <label className="text-[13px] font-semibold text-foreground mb-2 block">📷 Photo de profil</label>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="w-20 h-20 rounded-full border-2 border-dashed border-border hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden transition-colors bg-muted/30"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-muted-foreground">📷</span>
                  )}
                </div>
                <div>
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    Choisir une photo
                  </button>
                  {photoFile && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">{photoFile.name}</span>
                      <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="text-destructive text-[11px] font-bold hover:underline">✕</button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG — Max 5 Mo</p>
                </div>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </div>

            {/* Form fields */}
            <div className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">Nom complet *</label><input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" placeholder="Ex: Aminata Camara" /></div>
            <div className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">Poste / Description</label><input value={newUser.sub} onChange={e => setNewUser(p => ({ ...p, sub: e.target.value }))} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" placeholder="Ex: Agent de Terrain — Zone Est" /></div>
            <div className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">Email *</label><input value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" placeholder="email@agias.org" /></div>
            <div className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">Téléphone</label><input value={newUser.tel} onChange={e => setNewUser(p => ({ ...p, tel: e.target.value }))} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" placeholder="+225 07 XX XX XX XX" /></div>
            <div className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">Rôle *</label>
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                <option value="">— Sélectionner un rôle —</option>
                <option value="admin">👑 Administrateur</option>
                <option value="superviseur">🔵 Superviseur</option>
                <option value="agent">🟢 Agent de Terrain</option>
              </select>
            </div>
            <div className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">Mot de passe temporaire *</label><input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" placeholder="Minimum 8 caractères" /></div>

            {/* Documents Upload Section */}
            <div className="mb-4">
              <label className="text-[13px] font-semibold text-foreground mb-2 block">📎 Pièces justificatives</label>
              <div className="border-2 border-dashed border-border rounded-[10px] p-4 bg-muted/20">
                <div className="flex gap-2 mb-3">
                  <select value={docType} onChange={e => setDocType(e.target.value)} className="flex-1 p-[9px_12px] border-2 border-border rounded-lg text-[12px] outline-none focus:border-primary-lighter">
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button type="button" onClick={() => docInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors whitespace-nowrap">
                    📎 Ajouter
                  </button>
                </div>
                <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleDocAdd} />

                {docFiles.length === 0 ? (
                  <p className="text-center text-[11px] text-muted-foreground py-2">Aucune pièce ajoutée — Carte d'identité, passeport, attestation...</p>
                ) : (
                  <div className="space-y-2">
                    {docFiles.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">📄</span>
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-foreground truncate">{doc.file.name}</div>
                            <div className="text-[10px] text-muted-foreground">{doc.type} — {(doc.file.size / 1024).toFixed(0)} Ko</div>
                          </div>
                        </div>
                        <button onClick={() => removeDoc(idx)} className="text-destructive text-[13px] font-bold hover:bg-destructive/10 rounded px-1.5 py-0.5 transition-colors">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">PDF, JPG, PNG, DOC — Max 10 Mo par fichier</p>
              </div>
            </div>

            <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 mb-4 text-xs text-muted-foreground">⚠️ L'utilisateur devra changer son mot de passe lors de sa première connexion.</div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors">Annuler</button>
              <button disabled={saving} onClick={createUser} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors disabled:opacity-50">{saving ? '⏳ Création...' : '✅ Créer le compte'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowRoleModal(null)}>
          <div className="bg-card rounded-[20px] p-8 w-[90%] max-w-[500px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6"><div className="text-lg font-extrabold text-primary">✏️ Modifier le Rôle</div><button onClick={() => setShowRoleModal(null)} className="bg-transparent border-none text-[22px] cursor-pointer text-muted-foreground hover:text-destructive">✕</button></div>
            <div className="bg-muted/50 rounded-[10px] p-3.5 mb-5"><div className="text-[13px] text-muted-foreground">Utilisateur concerné</div><div className="text-base font-bold text-primary mt-1">{showRoleModal.name}</div></div>
            <div className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">Nouveau rôle *</label>
              <select id="new-role-select" defaultValue={showRoleModal.role} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter">
                <option value="admin">👑 Administrateur</option>
                <option value="superviseur">🔵 Superviseur</option>
                <option value="agent">🟢 Agent de Terrain</option>
              </select>
            </div>
            <div className="bg-destructive/[0.08] border border-destructive/20 rounded-lg p-3 mb-4 text-xs text-destructive">⚠️ Cette action modifie immédiatement les droits d'accès de l'utilisateur.</div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRoleModal(null)} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors">Annuler</button>
              <button onClick={() => {
                const sel = (document.getElementById('new-role-select') as HTMLSelectElement).value;
                changeRole(showRoleModal, sel);
              }} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">✅ Confirmer le changement</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Confirmation Modal */}
      {pendingUserPhoto && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setPendingUserPhoto(null)}>
          <div className="bg-card rounded-[20px] p-6 w-[90%] max-w-[400px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-in fade-in-0 zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div className="text-lg font-extrabold text-foreground">📷 Confirmer la photo</div>
              <button onClick={() => setPendingUserPhoto(null)} className="bg-transparent border-none text-[22px] cursor-pointer text-muted-foreground hover:text-destructive">✕</button>
            </div>
            <div className="flex justify-center mb-5">
              <img src={pendingUserPhoto.preview} alt="Aperçu" className="w-36 h-36 rounded-2xl object-cover border-4 border-border shadow-lg" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-1">
              Changer la photo de <span className="font-bold text-foreground">{users.find(u => u.id === pendingUserPhoto.userId)?.name}</span> ?
            </p>
            <p className="text-xs text-muted-foreground text-center mb-5">Cette action remplacera la photo actuelle.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPendingUserPhoto(null)} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border-2 border-border text-muted-foreground hover:bg-muted transition-colors">Annuler</button>
              <button onClick={confirmUserPhotoUpload} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">✅ Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
