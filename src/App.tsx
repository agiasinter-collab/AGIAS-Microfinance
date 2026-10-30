import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster as Sonner, toast } from '@/components/ui/sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WifiOff, RefreshCw } from 'lucide-react';
import LoginPage from '@/pages/Login';
import AppLayout from '@/components/layout/AppLayout';
import DashboardPage from '@/pages/Dashboard';
import BeneficiairesPage from '@/pages/Beneficiaires';
import ProfilBeneficiaire from '@/pages/ProfilBeneficiaire';
import PresidentesPage from '@/pages/Presidentes';
import CreditsPage from '@/pages/Credits';
import RemboursementsPage from '@/pages/Remboursements';
import RetardsPage from '@/pages/Retards';
import AgentsTerrainPage from '@/pages/AgentsTerrain';
import TransactionsPage from '@/pages/Transactions';
import RapportsPage from '@/pages/Rapports';
import UtilisateursPage from '@/pages/Utilisateurs';
import ParametresPage from '@/pages/Parametres';
import MonProfilPage from '@/pages/MonProfil';
import AccessDeniedPage from '@/pages/AccessDenied';

const queryClient = new QueryClient();

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [profilId, setProfilId] = useState<string>('');
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [dbError, setDbError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setDbStatus('checking');
    setDbError(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setDbStatus('ok');
    } catch (err: any) {
      setDbStatus('error');
      const msg = err?.message || 'Impossible de joindre la base de données.';
      setDbError(msg);
      toast.error('Connexion à la base de données impossible', { description: msg });
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (user?.role === 'agent' && currentPage === 'dashboard') {
      setCurrentPage('beneficiaires');
    }
  }, [user, currentPage]);

  if (dbStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <WifiOff className="w-16 h-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-2 text-foreground">Connexion impossible</h2>
          <p className="text-muted-foreground mb-6">
            Le serveur de données ne répond pas. Veuillez vérifier votre connexion internet et réessayer.
          </p>
          {dbError && (
            <p className="text-sm text-destructive mb-6 bg-destructive/10 p-3 rounded-md">
              {dbError}
            </p>
          )}
          <button
            onClick={checkConnection}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const showProfil = (id: string) => { setProfilId(id); setCurrentPage('profil'); };
  const navigate = (page: string) => { setCurrentPage(page); window.scrollTo(0, 0); };

  const PAGE_ROLES: Record<string, string[]> = {
    dashboard: ['admin', 'superviseur'],
    utilisateurs: ['admin'],
    parametres: ['admin'],
    agents: ['admin', 'superviseur'],
    rapports: ['admin', 'superviseur'],
  };

  const renderPage = () => {
    const allowedRoles = PAGE_ROLES[currentPage];
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <AccessDeniedPage onBack={() => navigate('dashboard')} />;
    }

    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={navigate} onShowProfil={showProfil} />;
      case 'beneficiaires': return <BeneficiairesPage onShowProfil={showProfil} />;
      case 'profil': return <ProfilBeneficiaire beneficiaireId={profilId} onBack={() => navigate('beneficiaires')} />;
      case 'credits': return <CreditsPage onShowProfil={showProfil} />;
      case 'presidentes': return <PresidentesPage onShowProfil={showProfil} />;
      case 'remboursements': return <RemboursementsPage />;
      case 'retards': return <RetardsPage />;
      case 'agents': return <AgentsTerrainPage />;
      case 'transactions': return <TransactionsPage />;
      case 'rapports': return <RapportsPage />;
      case 'utilisateurs': return <UtilisateursPage />;
      case 'parametres': return <ParametresPage />;
      case 'mon-profil': return <MonProfilPage />;
      case 'access-denied': return <AccessDeniedPage onBack={() => navigate('dashboard')} />;
      default: return <DashboardPage onNavigate={navigate} onShowProfil={showProfil} />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={navigate}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage + (currentPage === 'profil' ? profilId : '')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Sonner />
      <AppContent />
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
