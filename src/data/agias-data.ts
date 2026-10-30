export interface User {
  id: number;
  email: string;
  role: 'admin' | 'superviseur' | 'agent';
  name: string;
  initials: string;
  color: string;
}

export interface Beneficiaire {
  id: number;
  nom: string;
  dossier: string;
  tel: string;
  quartier: string;
  montant: number;
  pct: number;
  statut: 'Actif' | 'Retard' | 'Défaut' | 'Soldé';
  score: number;
  activite: string;
  groupe: string;
  agent: string;
  dob: string;
  adresse: string;
  inscription: string;
  creditNum: string;
  taux: string;
  paye: number;
  total: number;
  notes: string;
}

export interface Echeance {
  date: string;
  prevu: number;
  paye: number;
  retard: number;
  statut: 'Payé' | 'En cours' | 'Retard' | 'À venir' | 'Impayé';
}

export const USERS: User[] = [
  { id: 1, email: 'presidente@agias.org', role: 'admin', name: 'Présidente Kouyaté', initials: 'PK', color: '#0d3d26' },
  { id: 2, email: 'superviseur@agias.org', role: 'superviseur', name: 'Ibrahim Koné', initials: 'IK', color: '#3182ce' },
  { id: 3, email: 'agent1@agias.org', role: 'agent', name: 'Moussa Coulibaly', initials: 'MC', color: '#38a169' },
  { id: 4, email: 'agent2@agias.org', role: 'agent', name: 'Adjoua Kouassi', initials: 'AK', color: '#c9a84c' },
];

export const BENEFICIAIRES: Beneficiaire[] = [
  { id: 0, nom: 'Awa Touré', dossier: 'AGS-001', tel: '+225 07 21 23 45 67', quartier: 'Cocody', montant: 500000, pct: 75, statut: 'Actif', score: 5, activite: 'Commerce de détail', groupe: 'Groupe Espoir', agent: 'Moussa Coulibaly', dob: '15/04/1985', adresse: 'Cocody Riviera, Abidjan', inscription: '10/01/2026', creditNum: 'AGS-CR-001', taux: '2%/semaine', paye: 375000, total: 520000, notes: 'Cliente sérieuse, toujours ponctuelle dans ses paiements.' },
  { id: 1, nom: 'Aminata Koné', dossier: 'AGS-002', tel: '+225 05 22 34 56 78', quartier: 'Adjamé', montant: 300000, pct: 45, statut: 'Retard', score: 3, activite: 'Vente de légumes', groupe: 'Groupe Solidarité', agent: 'Adjoua Kouassi', dob: '22/08/1990', adresse: 'Adjamé Marché, Abidjan', inscription: '15/01/2026', creditNum: 'AGS-CR-002', taux: '2%/semaine', paye: 135000, total: 312000, notes: 'Difficultés financières ce mois. Visite prévue.' },
  { id: 2, nom: 'Mariam Cissé', dossier: 'AGS-003', tel: '+225 01 23 45 67 89', quartier: 'Plateau', montant: 750000, pct: 90, statut: 'Actif', score: 5, activite: 'Couture & Broderie', groupe: 'Groupe Avenir', agent: 'Adjoua Kouassi', dob: '03/12/1982', adresse: 'Plateau Centre, Abidjan', inscription: '05/01/2026', creditNum: 'AGS-CR-003', taux: '1.5%/semaine', paye: 675000, total: 750000, notes: 'Excellente cliente. Prête pour un 2ème crédit.' },
  { id: 3, nom: 'Fatou Diabaté', dossier: 'AGS-004', tel: '+225 07 24 56 78 90', quartier: 'Yopougon', montant: 200000, pct: 20, statut: 'Défaut', score: 2, activite: 'Restauration', groupe: 'Groupe Lumière', agent: 'Moussa Coulibaly', dob: '17/06/1988', adresse: 'Yopougon Selmer, Abidjan', inscription: '20/12/2025', creditNum: 'AGS-CR-004', taux: '2%/semaine', paye: 40000, total: 208000, notes: 'Activité fermée. Mise en demeure envoyée.' },
  { id: 4, nom: 'Rokia Ouattara', dossier: 'AGS-005', tel: '+225 05 25 67 89 01', quartier: 'Abobo', montant: 450000, pct: 60, statut: 'Actif', score: 4, activite: 'Teinture & Batik', groupe: 'Groupe Espoir', agent: 'Moussa Coulibaly', dob: '29/03/1987', adresse: 'Abobo Gare, Abidjan', inscription: '12/01/2026', creditNum: 'AGS-CR-005', taux: '2%/semaine', paye: 270000, total: 468000, notes: 'Bonne progression. Activité en croissance.' },
  { id: 5, nom: 'Bintou Traoré', dossier: 'AGS-006', tel: '+225 01 26 78 90 12', quartier: 'Marcory', montant: 600000, pct: 100, statut: 'Soldé', score: 5, activite: 'Épicerie', groupe: 'Groupe Solidarité', agent: 'Adjoua Kouassi', dob: '11/01/1980', adresse: 'Marcory Zone 4, Abidjan', inscription: '01/09/2025', creditNum: 'AGS-CR-006', taux: '2%/semaine', paye: 624000, total: 624000, notes: 'Crédit soldé avec succès. Fidèle cliente.' },
  { id: 6, nom: 'Kadiatou Sanogo', dossier: 'AGS-007', tel: '+225 07 27 89 01 23', quartier: 'Treichville', montant: 350000, pct: 35, statut: 'Retard', score: 3, activite: 'Coiffure', groupe: 'Groupe Avenir', agent: 'Moussa Coulibaly', dob: '05/09/1993', adresse: 'Treichville Marché, Abidjan', inscription: '18/01/2026', creditNum: 'AGS-CR-007', taux: '2%/semaine', paye: 122500, total: 364000, notes: '3 jours de retard. Contactée par téléphone.' },
  { id: 7, nom: 'Sita Bakayoko', dossier: 'AGS-008', tel: '+225 05 28 90 12 34', quartier: 'Koumassi', montant: 800000, pct: 55, statut: 'Actif', score: 4, activite: 'Import-Export', groupe: 'Groupe Lumière', agent: 'Adjoua Kouassi', dob: '20/07/1979', adresse: 'Koumassi Remblais, Abidjan', inscription: '22/01/2026', creditNum: 'AGS-CR-008', taux: '1.5%/semaine', paye: 440000, total: 832000, notes: 'Grande commerçante. Très fiable.' },
];

export const ECHEANCIERS: Echeance[][] = [
  [
    { date: '10/02/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
    { date: '17/02/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
    { date: '24/02/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
    { date: '03/03/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
    { date: '10/03/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
    { date: '17/03/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
    { date: '24/03/2026', prevu: 25000, paye: 0, retard: 0, statut: 'En cours' },
    { date: '31/03/2026', prevu: 25000, paye: 0, retard: 0, statut: 'À venir' },
  ],
  [
    { date: '05/02/2026', prevu: 18750, paye: 18750, retard: 0, statut: 'Payé' },
    { date: '12/02/2026', prevu: 18750, paye: 18750, retard: 0, statut: 'Payé' },
    { date: '19/02/2026', prevu: 18750, paye: 18750, retard: 0, statut: 'Payé' },
    { date: '26/02/2026', prevu: 18750, paye: 0, retard: 5, statut: 'Retard' },
    { date: '05/03/2026', prevu: 18750, paye: 0, retard: 12, statut: 'Retard' },
    { date: '12/03/2026', prevu: 18750, paye: 0, retard: 7, statut: 'Retard' },
    { date: '19/03/2026', prevu: 18750, paye: 0, retard: 0, statut: 'À venir' },
    { date: '26/03/2026', prevu: 18750, paye: 0, retard: 0, statut: 'À venir' },
  ],
  [
    { date: '25/01/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
    { date: '01/02/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
    { date: '08/02/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
    { date: '15/02/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
    { date: '22/02/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
    { date: '01/03/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
    { date: '08/03/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
    { date: '15/03/2026', prevu: 37500, paye: 0, retard: 0, statut: 'En cours' },
  ],
];

export const NAV_ITEMS = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard', roles: ['admin', 'superviseur'] },
  { id: 'beneficiaires', icon: '👥', label: 'Bénéficiaires', roles: ['admin', 'superviseur', 'agent'] },
  { id: 'presidentes', icon: '👑', label: 'Mes Présidentes', roles: ['admin', 'superviseur', 'agent'] },
  { id: 'credits', icon: '💳', label: 'Crédits', roles: ['admin', 'superviseur', 'agent'] },
  { id: 'remboursements', icon: '💰', label: 'Remboursements', roles: ['admin', 'superviseur', 'agent'] },
  { id: 'retards', icon: '⚠️', label: 'Retards', badge: '12', roles: ['admin', 'superviseur', 'agent'] },
  { id: 'agents', icon: '👷', label: 'Agents Terrain', roles: ['admin', 'superviseur'] },
  { id: 'transactions', icon: '💸', label: 'Transactions', roles: ['admin', 'superviseur', 'agent'] },
  { id: 'rapports', icon: '📊', label: 'Rapports', roles: ['admin', 'superviseur'] },
  { id: 'utilisateurs', icon: '🔐', label: 'Utilisateurs', roles: ['admin'] },
  { id: 'parametres', icon: '⚙️', label: 'Paramètres', roles: ['admin'] },
  { id: 'mon-profil', icon: '👤', label: 'Mon Profil', roles: ['admin', 'superviseur', 'agent'] },
];

export const NOTIFICATIONS = [
  { icon: '⚠️', text: "Aminata Koné — Retard de 7 jours sur l'échéance du 17/03/2026", time: 'Il y a 2 heures' },
  { icon: '✅', text: 'Remboursement reçu — Awa Touré — 25 000 FCFA via Orange Money', time: 'Il y a 4 heures' },
  { icon: '🚨', text: 'Fatou Diabaté — Crédit en défaut depuis 45 jours', time: 'Hier' },
  { icon: '💳', text: 'Nouveau crédit approuvé — Sita Bakayoko — 800 000 FCFA', time: 'Hier' },
  { icon: '📊', text: 'Rapport mensuel de mars 2026 disponible', time: 'Il y a 2 jours' },
];

export const AVATAR_COLORS = ['#0d3d26', '#3182ce', '#38a169', '#c9a84c', '#dd6b20', '#805ad5', '#e53e3e', '#319795'];

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2);
}

export function formatXOF(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' FCFA';
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: '👑 Administrateur',
    superviseur: '🔵 Superviseur',
    agent: '🟢 Agent Terrain',
  };
  return map[role] || role;
}
