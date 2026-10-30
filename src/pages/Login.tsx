import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleLabel } from '@/data/agias-data';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Shield, BarChart3, Globe, Zap, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    setError('');
    const success = await login(email, password);
    if (!success) {
      setError('Email ou mot de passe incorrect. Vérifiez vos identifiants.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-primary/95 flex flex-col items-center justify-center gap-5 z-50">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-[28px] font-black text-primary mb-5 shadow-[0_0_60px_rgba(217,79,43,0.5)]"
        >
          AM
        </motion.div>
        <div className="w-[60px] h-[60px] border-[5px] border-accent/30 border-t-accent rounded-full animate-spin-custom" />
        <div className="text-card font-semibold text-base">Connexion en cours...</div>
      </div>
    );
  }

  const features = [
    { icon: Shield, label: 'Sécurisé', desc: 'Données protégées' },
    { icon: BarChart3, label: 'Performant', desc: 'Analyses en temps réel' },
    { icon: Globe, label: 'Accessible', desc: 'Partout, tout le temps' },
    { icon: Zap, label: 'Rapide', desc: 'Interface fluide' },
  ];

  const stats = [
    { num: '52+', label: 'Bénéficiaires' },
    { num: '47', label: 'Crédits Actifs' },
    { num: '80.7%', label: 'Taux Remboursement' },
  ];

  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(201,100%,22%)] via-primary to-primary-light" />
      
      {/* Animated decorative elements */}
      <div className="absolute -top-[300px] -left-[200px] w-[700px] h-[700px] bg-accent/[0.06] rounded-full blur-3xl" />
      <div className="absolute -bottom-[200px] -right-[150px] w-[600px] h-[600px] bg-accent/[0.04] rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-card/[0.02] rounded-full blur-3xl" />
      
      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(hsl(var(--card)) 1px, transparent 1px)',
        backgroundSize: '30px 30px'
      }} />

      {/* Left branding panel */}
      <div className="hidden lg:flex flex-[1.3] flex-col justify-center items-center px-12 py-16 relative z-[1]">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          {/* Logo */}
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl scale-150" />
            <div className="relative w-[130px] h-[130px] bg-gradient-to-br from-accent via-accent-light to-accent rounded-full flex items-center justify-center text-[46px] font-black text-primary shadow-[0_8px_40px_rgba(217,79,43,0.4)] animate-pulse-accent">
              AM
            </div>
          </div>

          <h1 className="text-[46px] font-extrabold text-card text-center mb-3 tracking-tight leading-tight">
            AGIAS
            <span className="block text-[28px] font-bold text-accent/90 tracking-wide">Microfinance</span>
          </h1>
          
          <p className="text-[15px] text-card/60 italic text-center mb-14 max-w-[360px] leading-relaxed font-light">
            "Ensemble, nous construisons l'avenir financier de nos communautés"
          </p>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="grid grid-cols-4 gap-4 mb-14 w-full max-w-[520px]"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              whileHover={{ y: -4, scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="flex flex-col items-center gap-2.5 bg-card/[0.08] border border-card/[0.1] rounded-2xl px-3 py-5 backdrop-blur-md cursor-default group"
            >
              <div className="w-11 h-11 rounded-xl bg-card/[0.1] flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-300">
                <f.icon className="w-5 h-5 text-accent" />
              </div>
              <span className="text-[12px] text-card/80 font-semibold">{f.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
          className="flex gap-12"
        >
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-[32px] font-extrabold text-accent tracking-tight">{s.num}</div>
              <div className="text-[11px] text-card/50 mt-1 font-medium uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative z-[1]">
        <motion.div
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="bg-card/[0.97] backdrop-blur-xl rounded-[28px] p-8 sm:p-10 w-full max-w-[440px] shadow-[0_30px_100px_rgba(0,0,0,0.35)] border border-card/50 relative overflow-hidden"
        >
          {/* Subtle top accent line */}
          <div className="absolute top-0 left-8 right-8 h-[3px] bg-gradient-to-r from-transparent via-accent to-transparent rounded-full" />

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-lighter rounded-2xl flex items-center justify-center text-[15px] font-black text-accent shadow-md">
              AM
            </div>
            <div>
              <div className="text-[15px] font-bold text-primary">AGIAS Microfinance</div>
              <div className="text-[11px] text-muted-foreground font-medium">Système de Gestion v2.0</div>
            </div>
          </div>

          <h2 className="text-[28px] font-extrabold text-foreground mb-1">Bienvenue 👋</h2>
          <p className="text-[14px] text-muted-foreground mb-8">Connectez-vous à votre espace de travail</p>

          {error && (
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-destructive/5 border border-destructive/20 text-destructive rounded-xl px-4 py-3 text-[13px] mb-5 flex items-center gap-2.5"
            >
              <span className="text-base">⚠️</span>
              <span className="font-medium">{error}</span>
            </motion.div>
          )}

          {/* Email field */}
          <div className="mb-5">
            <label className="text-[13px] font-semibold text-foreground mb-2 block">Adresse Email</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Mail className="w-[18px] h-[18px]" />
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={`w-full py-3.5 px-4 pl-11 border-2 ${error ? 'border-destructive/40' : 'border-border'} rounded-xl text-[14px] outline-none bg-muted/50 focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)] focus:bg-card transition-all duration-200 placeholder:text-muted-foreground/50`}
                placeholder="votre@email.com"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="mb-5">
            <label className="text-[13px] font-semibold text-foreground mb-2 block">Mot de passe</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Lock className="w-[18px] h-[18px]" />
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className={`w-full py-3.5 px-4 pl-11 pr-12 border-2 ${error ? 'border-destructive/40' : 'border-border'} rounded-xl text-[14px] outline-none bg-muted/50 focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)] focus:bg-card transition-all duration-200 placeholder:text-muted-foreground/50`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0 transition-colors"
              >
                {showPwd ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2.5 mb-6">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 accent-primary rounded"
              id="remember"
            />
            <label htmlFor="remember" className="text-[13px] text-muted-foreground cursor-pointer select-none">
              Se souvenir de moi
            </label>
          </div>

          {/* Login button */}
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            className="w-full py-4 bg-gradient-to-r from-primary via-primary-light to-primary text-card border-none rounded-xl text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2.5 tracking-wide shadow-[0_4px_20px_hsl(var(--primary)/0.35)] hover:shadow-[0_8px_30px_hsl(var(--primary)/0.45)] transition-shadow duration-300"
          >
            <LogIn className="w-5 h-5" />
            SE CONNECTER
          </motion.button>

          {/* Forgot password */}
          <div className="text-center mt-4">
            <button
              onClick={() => toast.info("Contactez l'administrateur système.")}
              className="text-[13px] text-primary font-semibold bg-transparent border-none cursor-pointer hover:underline underline-offset-4 transition-all"
            >
              Mot de passe oublié ?
            </button>
          </div>


        </motion.div>
      </div>
    </div>
  );
}
