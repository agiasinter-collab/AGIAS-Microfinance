import { useAuth } from '@/contexts/AuthContext';
import { getRoleLabel } from '@/data/agias-data';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { Mail, Calendar, FileText, TrendingUp, Users, CreditCard, Wallet, Camera, ImageIcon, ArrowUpRight, Plus, Hash, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  name: string;
  email: string | null;
  initials: string;
  color: string;
  photo_url: string | null;
  created_at: string;
  sub: string | null;
  active: boolean;
}

interface DocumentData {
  id: string;
  nom: string;
  type: string;
  file_url: string;
  created_at: string;
}

interface StatsData {
  totalBeneficiaires: number;
  totalCreditsActifs: number;
  totalMontant: number;
  tauxRecouvrement: number;
}

export default function MonProfilPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [stats, setStats] = useState<StatsData>({ totalBeneficiaires: 0, totalCreditsActifs: 0, totalMontant: 0, tauxRecouvrement: 0 });
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; preview: string } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'admin';

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error("Veuillez sélectionner une image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("L'image ne doit pas dépasser 5 Mo"); return; }
    const reader = new FileReader();
    reader.onload = () => setPendingPhoto({ file, preview: reader.result as string });
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const confirmPhotoUpload = async () => {
    if (!pendingPhoto || !user) return;
    setUploadingPhoto(true);
    try {
      const ext = pendingPhoto.file.name.split('.').pop();
      const path = `profiles/${user.id}/photo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('user-files').upload(path, pendingPhoto.file, { upsert: true });
      if (uploadError) { toast.error('Erreur upload photo'); setUploadingPhoto(false); return; }
      const { data: urlData } = supabase.storage.from('user-files').getPublicUrl(path);
      const photoUrl = urlData.publicUrl + '?t=' + Date.now();
      const { error: updateError } = await supabase.from('profiles').update({ photo_url: photoUrl }).eq('id', user.id);
      if (updateError) { toast.error('Erreur mise à jour du profil'); setUploadingPhoto(false); return; }
      setProfile(prev => prev ? { ...prev, photo_url: photoUrl } : prev);
      toast.success('Photo de profil mise à jour !');
    } catch {
      toast.error('Erreur lors de la mise à jour de la photo');
    }
    setUploadingPhoto(false);
    setPendingPhoto(null);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `profiles/${user.id}/cover.${ext}`;
      const { error: uploadError } = await supabase.storage.from('user-files').upload(path, file, { upsert: true });
      if (uploadError) { toast.error('Erreur upload couverture'); setUploadingCover(false); return; }
      const { data: urlData } = supabase.storage.from('user-files').getPublicUrl(path);
      setCoverUrl(urlData.publicUrl + '?t=' + Date.now());
      toast.success('Photo de couverture mise à jour !');
    } catch {
      toast.error('Erreur lors de la mise à jour de la couverture');
    }
    setUploadingCover(false);
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [profileRes, docsRes, benefRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('documents_utilisateur').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('beneficiaires').select('montant, paye, total, statut').eq('agent_name', user.name),
        ]);

        if (profileRes.error) toast.error('Erreur chargement du profil');
        if (docsRes.error) toast.error('Erreur chargement des documents');
        if (benefRes.error) toast.error('Erreur chargement des statistiques');

        if (profileRes.data) setProfile(profileRes.data);
        if (docsRes.data) setDocuments(docsRes.data);

        if (benefRes.data) {
          const b = benefRes.data;
          const actifs = b.filter(x => x.statut === 'Actif');
          const totalMontant = actifs.reduce((s, x) => s + (x.montant || 0), 0);
          const totalPaye = b.reduce((s, x) => s + (x.paye || 0), 0);
          const totalDu = b.reduce((s, x) => s + (x.total || 0), 0);
          setStats({
            totalBeneficiaires: b.length,
            totalCreditsActifs: actifs.length,
            totalMontant,
            tauxRecouvrement: totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0,
          });
        }
      } catch {
        toast.error('Erreur réseau lors du chargement du profil');
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    fetchData();

    const channel = supabase
      .channel('mon-profil-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents_utilisateur', filter: `user_id=eq.${user.id}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beneficiaires' }, () => fetchData())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') toast.error('Erreur de connexion temps réel — actualisez la page');
      });
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
      </div>
    );
  }

  const createdDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const identifiant = profile?.sub || (user.id.slice(0, 8) + '…').toUpperCase();

  const statsConfig = [
    { label: 'Bénéficiaires', value: stats.totalBeneficiaires.toString(), icon: Users },
    { label: 'Crédits actifs', value: stats.totalCreditsActifs.toString(), icon: CreditCard },
    { label: 'Volume (FCFA)', value: stats.totalMontant.toLocaleString('fr-FR'), icon: Wallet },
    { label: 'Recouvrement', value: `${stats.tauxRecouvrement}%`, icon: TrendingUp },
  ];

  return (
    <div className="min-h-full bg-background animate-in fade-in-0 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 xl:gap-12 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-12">

        {/* LEFT — Identity column */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="bg-primary text-primary-foreground rounded-3xl overflow-hidden shadow-[0_20px_50px_-15px_hsl(var(--primary)/0.4)] relative">
            {/* Cover strip */}
            <div className="relative h-28 overflow-hidden">
              {coverUrl ? (
                <img src={coverUrl} alt="Couverture" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary-lighter via-primary to-primary" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/40" />
              {isAdmin && (
                <>
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-foreground/15 backdrop-blur-md text-primary-foreground text-[10px] font-semibold hover:bg-primary-foreground/25 transition-all border border-primary-foreground/20 disabled:opacity-50"
                  >
                    <ImageIcon className="w-3 h-3" />
                    {uploadingCover ? '...' : 'Couverture'}
                  </button>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </>
              )}
            </div>

            <div className="px-8 pt-0 pb-8 -mt-14 relative">
              {/* Filet accent */}
              <div className="w-10 h-[3px] bg-accent mb-5 mt-16" />

              {/* Portrait */}
              <div className="relative inline-block mb-6 group/avatar">
                {profile?.photo_url ? (
                  <img
                    src={profile.photo_url}
                    alt={user.name}
                    className="w-28 h-28 rounded-2xl object-cover border-2 border-primary-foreground/20 shadow-2xl"
                  />
                ) : (
                  <div
                    className="w-28 h-28 rounded-2xl flex items-center justify-center text-3xl font-black text-primary-foreground border-2 border-primary-foreground/20 shadow-2xl"
                    style={{ background: `linear-gradient(135deg, ${user.color}, ${user.color}dd)` }}
                  >
                    {user.initials}
                  </div>
                )}
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-accent text-primary-foreground flex items-center justify-center hover:bg-accent-light transition-all shadow-lg border-2 border-primary disabled:opacity-50"
                  title="Changer la photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>

              {/* Name */}
              <h1 className="font-serif text-[28px] leading-[1.1] font-semibold tracking-tight mb-2 break-words">
                {user.name}
              </h1>
              <p className="text-primary-foreground/60 text-[10px] uppercase tracking-[0.22em] font-bold mb-8">
                {getRoleLabel(user.role)}
              </p>

              {/* Meta list */}
              <div className="space-y-6 pt-6 border-t border-primary-foreground/10">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-primary-foreground/40 uppercase tracking-[0.2em] font-bold">Identifiant</span>
                  <span className="text-[13px] font-mono tracking-wider text-primary-foreground/90">{identifiant}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-primary-foreground/40 uppercase tracking-[0.2em] font-bold">Membre depuis</span>
                  <span className="text-[13px]">{createdDate}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-primary-foreground/40 uppercase tracking-[0.2em] font-bold">Statut du compte</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${profile?.active !== false ? 'bg-accent' : 'bg-destructive'}`} />
                    <span className="text-[13px]">{profile?.active !== false ? 'Vérifié & Actif' : 'Inactif'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-primary-foreground/40 uppercase tracking-[0.2em] font-bold">Email</span>
                  <span className="text-[13px] break-all">{user.email || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT — Editorial content */}
        <main className="min-w-0">
          {/* Header */}
          <header className="mb-14">
            <div className="flex items-center gap-3 mb-4 text-accent">
              <div className="h-[1px] w-8 bg-accent" />
              <span className="text-[11px] uppercase tracking-[0.25em] font-bold italic font-serif">Espace privé</span>
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl text-foreground leading-[1.05] mb-4 tracking-tight">
              Mon profil personnel
            </h2>
            <p className="text-muted-foreground max-w-2xl text-[15px] leading-relaxed">
              Consultez et gérez les informations constituant votre identité opérationnelle chez AGIAS Microfinance. Ces données servent au suivi de vos activités et à la vérification interne.
            </p>
          </header>

          {/* 01 — Stats (agents only) */}
          {user.role === 'agent' && (
            <section className="mb-20">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
                <div className="flex items-baseline gap-4">
                  <span className="font-serif text-sm text-accent italic">01</span>
                  <h3 className="font-serif text-2xl text-foreground">Performance opérationnelle</h3>
                </div>
                <span className="text-[10px] bg-muted text-muted-foreground px-3 py-1 font-bold uppercase tracking-widest rounded-full">Temps réel</span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statsConfig.map((s) => (
                  <div key={s.label} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg transition-all group/stat">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-primary group-hover/stat:bg-primary group-hover/stat:text-primary-foreground transition-colors">
                        <s.icon className="w-4 h-4" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover/stat:text-accent group-hover/stat:-translate-y-0.5 group-hover/stat:translate-x-0.5 transition-all" />
                    </div>
                    <p className="font-serif text-2xl font-semibold text-foreground tracking-tight leading-none mb-2">{s.value}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {stats.tauxRecouvrement > 0 && (
                <div className="mt-8 bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-1">Taux de recouvrement</p>
                      <p className="font-serif text-3xl font-semibold text-foreground">{stats.tauxRecouvrement}<span className="text-xl text-muted-foreground">%</span></p>
                    </div>
                    <span className="text-[11px] italic font-serif text-accent">Objectif · 100%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(stats.tauxRecouvrement, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 02 — Données contractuelles */}
          <section className="mb-20">
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-border">
              <div className="flex items-baseline gap-4">
                <span className="font-serif text-sm text-accent italic">{user.role === 'agent' ? '02' : '01'}</span>
                <h3 className="font-serif text-2xl text-foreground">Données contractuelles</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {[
                { label: 'Email de contact', value: user.email || '—', icon: Mail },
                { label: 'Rôle attribué', value: getRoleLabel(user.role), icon: Hash },
                { label: 'Date d\'adhésion', value: createdDate, icon: Calendar },
                { label: 'Identifiant unique', value: identifiant, icon: Hash },
              ].map((item) => (
                <div key={item.label} className="group/field">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-2 opacity-70 group-hover/field:opacity-100 transition-opacity">
                    {item.label}
                  </label>
                  <p className="font-serif text-lg text-foreground border-b border-border pb-3 group-hover/field:border-primary/30 transition-colors">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 03 — Documents */}
          <section className="pb-20">
            <div className="flex items-center justify-between mb-10 pb-4 border-b border-border">
              <div className="flex items-baseline gap-4">
                <span className="font-serif text-sm text-accent italic">{user.role === 'agent' ? '03' : '02'}</span>
                <h3 className="font-serif text-2xl text-foreground">Dossier documentaire</h3>
              </div>
              <span className="text-[10px] bg-muted text-muted-foreground px-3 py-1 font-bold uppercase tracking-widest rounded-full">
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="bg-card border-2 border-dashed border-border rounded-2xl px-8 py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-5 h-5 text-muted-foreground/60" />
                </div>
                <p className="font-serif text-lg text-foreground mb-1">Aucun document associé</p>
                <p className="text-xs text-muted-foreground">Les documents ajoutés par l'administrateur apparaîtront ici.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-card p-6 border border-border rounded-2xl hover:shadow-xl hover:border-primary/30 transition-all relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-muted -mr-8 -mt-8 rotate-45 group-hover:bg-primary transition-colors" />
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground mb-2">{doc.type}</p>
                      <h5 className="font-serif text-lg text-foreground mb-4 leading-tight">{doc.nom}</h5>
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-accent uppercase">
                        Consulter
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-3">
                        Ajouté le {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </a>
                ))}
                {/* Ghost slot */}
                <div className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-6 text-center min-h-[180px]">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Plus className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] leading-relaxed">
                    Nouveau document<br />via l'administrateur
                  </span>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Photo Preview Confirmation Modal */}
      {pendingPhoto && (
        <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setPendingPhoto(null)}>
          <div className="bg-card rounded-3xl p-6 w-[90%] max-w-[400px] shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div className="font-serif text-xl text-foreground">Confirmer la photo</div>
              <button onClick={() => setPendingPhoto(null)} className="text-[22px] text-muted-foreground hover:text-destructive transition-colors">✕</button>
            </div>
            <div className="flex justify-center mb-5">
              <img src={pendingPhoto.preview} alt="Aperçu" className="w-36 h-36 rounded-2xl object-cover border-4 border-border shadow-lg" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-5">Voulez-vous utiliser cette image comme photo de profil ?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPendingPhoto(null)} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border-2 border-border text-muted-foreground hover:bg-muted transition-colors">Annuler</button>
              <button onClick={confirmPhotoUpload} disabled={uploadingPhoto} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary-lighter transition-colors disabled:opacity-50">
                {uploadingPhoto ? 'Upload...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
