import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NAV_ITEMS, NOTIFICATIONS, getRoleLabel } from '@/data/agias-data';
import { Menu, X, Search, Bell } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function AppLayout({ children, currentPage, onNavigate }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPage]);

  if (!user) return null;

  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  const titles: Record<string, string> = {
    dashboard: '🏠 Dashboard',
    beneficiaires: '👥 Bénéficiaires',
    presidentes: '👑 Mes Présidentes',
    credits: '💳 Crédits',
    remboursements: '💰 Remboursements',
    retards: '⚠️ Retards',
    agents: '👷 Agents Terrain',
    transactions: '💸 Transactions',
    rapports: '📊 Rapports',
    utilisateurs: '🔐 Gestion Utilisateurs',
    parametres: '⚙️ Paramètres',
    profil: '📋 Fiche Bénéficiaire',
    'mon-profil': '👤 Mon Profil',
    'access-denied': '🔒 Accès Refusé',
  };

  const handleNav = (page: string) => {
    const restricted: Record<string, string[]> = {
      dashboard: ['admin', 'superviseur'],
      rapports: ['admin', 'superviseur'],
      utilisateurs: ['admin'],
      parametres: ['admin'],
      agents: ['admin', 'superviseur'],
    };
    if (restricted[page] && !restricted[page].includes(user.role)) {
      onNavigate('access-denied');
    } else {
      onNavigate(page);
    }
    setSidebarOpen(false);
  };

  const NavItem = ({ id, icon, label, badge, onClick: onItemClick }: { id: string; icon: string; label: string; badge?: string; onClick: () => void }) => {
    const isActive = currentPage === id;
    return (
      <div
        onClick={onItemClick}
        className={`group flex items-center gap-3.5 mx-3 px-3.5 py-[10px] cursor-pointer text-[13.5px] font-medium transition-all duration-200 rounded-xl relative
          ${isActive
            ? 'bg-accent/20 text-accent shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.25)] backdrop-blur-sm'
            : 'text-card/65 hover:bg-card/[0.07] hover:text-card/90'
          }`}
      >
        {isActive && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-l-full" />
        )}
        <span className="text-[17px] w-[24px] text-center transition-transform duration-200 group-hover:scale-110">{icon}</span>
        <span className="tracking-wide">{label}</span>
        {badge && (
          <span className="ml-auto bg-destructive text-card text-[10px] font-bold min-w-[22px] h-[20px] px-1.5 rounded-full flex items-center justify-center shadow-sm">{badge}</span>
        )}
      </div>
    );
  };

  const SidebarContent_ = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3.5">
        <div className="w-11 h-11 bg-gradient-to-br from-accent to-accent-light rounded-xl flex items-center justify-center text-[15px] font-black text-primary shrink-0 shadow-[0_4px_12px_hsl(var(--accent)/0.35)]">
          AM
        </div>
        <div>
          <div className="text-[14px] font-extrabold text-card tracking-wide">AGIAS Microfinance</div>
          <div className="text-[10.5px] text-card/40 font-medium">v2.0 — Système de Gestion</div>
        </div>
      </div>

      {/* User Card */}
      <div className="mx-3.5 mb-4 bg-gradient-to-br from-card/[0.1] to-card/[0.04] rounded-2xl p-3.5 flex items-center gap-3 border border-card/[0.08] backdrop-blur-sm">
        {user.photo_url ? (
          <img src={user.photo_url} alt={user.name} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-card/20 ring-offset-1 ring-offset-transparent shadow-lg" />
        ) : (
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-card shrink-0 ring-2 ring-card/20 ring-offset-1 ring-offset-transparent shadow-lg" style={{ background: user.color }}>
            {user.initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-card truncate">{user.name}</div>
          <span className={`text-[10px] px-2.5 py-[3px] rounded-full font-semibold mt-1 inline-flex items-center gap-1 shadow-sm ${
            user.role === 'admin' ? 'bg-gradient-to-r from-accent to-accent-light text-primary' :
            user.role === 'superviseur' ? 'bg-info/90 text-card' :
            'bg-success/90 text-card'
          }`}>
            {getRoleLabel(user.role)}
          </span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 py-1 overflow-y-auto space-y-0.5">
        {filteredNav.filter(item => item.id !== 'mon-profil').map(item => (
          <NavItem
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            onClick={() => handleNav(item.id)}
          />
        ))}

        {/* Séparateur + Mon Profil */}
        <div className="mx-5 my-3 border-t border-card/10" />
        <NavItem
          id="mon-profil"
          icon="👤"
          label="Mon Profil"
          onClick={() => handleNav('mon-profil')}
        />
      </div>

      {/* Footer */}
      <div className="p-3.5 pt-2">
        <button
          onClick={() => { if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) logout(); }}
          className="w-full py-[10px] bg-destructive/10 border border-destructive/20 text-destructive-foreground/70 rounded-xl text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-2 hover:bg-destructive/25 hover:text-destructive-foreground hover:border-destructive/35 transition-all duration-200 backdrop-blur-sm"
        >
          🚪 Se Déconnecter
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile Sidebar via Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-gradient-to-b from-primary to-primary-light border-r-0 [&>button]:text-card [&>button]:hover:text-accent">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent_ />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <nav className="w-[260px] min-h-screen bg-gradient-to-b from-primary to-primary-light flex-col fixed left-0 top-0 bottom-0 z-[100] overflow-y-auto hidden lg:flex shadow-[4px_0_24px_rgba(0,0,0,0.15)]">
        <SidebarContent_ />
      </nav>

      {/* Main content */}
      <div className="lg:ml-[260px] flex-1 flex flex-col min-h-screen">
        {/* Topbar */}
        <div className="bg-card px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sticky top-0 z-50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden bg-primary text-card p-2 rounded-lg hover:bg-primary-light transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="text-base sm:text-lg font-bold text-primary flex-1 truncate">
            {titles[currentPage] || currentPage}
          </div>

          {/* Mobile search toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="sm:hidden p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Desktop search */}
          <div className="hidden sm:flex items-center gap-2 bg-muted rounded-[10px] px-3.5 py-2 w-60">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Rechercher..." className="border-none bg-transparent outline-none text-[13px] text-foreground w-full" />
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-0.5 right-0.5 bg-destructive text-card text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">5</span>
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-[199] lg:hidden" onClick={() => setNotifOpen(false)} />
                <div className="absolute top-12 right-0 w-[calc(100vw-2rem)] sm:w-[340px] max-w-[340px] bg-card rounded-2xl shadow-[var(--shadow-lg)] border border-border z-[200] overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex justify-between items-center">
                    <h4 className="text-[15px] font-bold text-primary">🔔 Notifications</h4>
                    <button onClick={() => setNotifOpen(false)} className="bg-transparent border-none cursor-pointer p-1 rounded-lg hover:bg-muted transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {NOTIFICATIONS.map((n, i) => (
                      <div key={i} className="px-4 sm:px-5 py-3.5 border-b border-muted flex gap-3 items-start hover:bg-muted/50 cursor-pointer transition-colors">
                        <div className="text-xl shrink-0 mt-0.5">{n.icon}</div>
                        <div className="min-w-0">
                          <div className="text-[13px] text-foreground leading-relaxed">{n.text}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{n.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User avatar */}
          <div
            onClick={() => onNavigate('mon-profil')}
            className="flex items-center gap-2 cursor-pointer p-1 sm:p-1.5 sm:px-2.5 rounded-[10px] hover:bg-muted transition-colors"
          >
            {user.photo_url ? (
              <img src={user.photo_url} alt={user.name} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[12px] sm:text-[13px] font-bold text-card shrink-0" style={{ background: user.color }}>
                {user.initials}
              </div>
            )}
            <div className="hidden md:block">
              <div className="text-[13px] font-semibold text-foreground">{user.name}</div>
              <div className="text-[11px] text-muted-foreground">{getRoleLabel(user.role)}</div>
            </div>
          </div>
        </div>

        {/* Mobile search bar */}
        {searchOpen && (
          <div className="sm:hidden bg-card px-3 py-2 border-b border-border animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 bg-muted rounded-[10px] px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="border-none bg-transparent outline-none text-[13px] text-foreground w-full"
                autoFocus
              />
              <button onClick={() => setSearchOpen(false)} className="text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="p-3 sm:p-5 lg:p-7 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
