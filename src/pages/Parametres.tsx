import { useState } from 'react';
import { toast } from 'sonner';

export default function ParametresPage() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({ sms: true, whatsapp: true, email: false, fraud: true, doubleVal: true, audit: true });

  const toggle = (key: string) => setToggles(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      <div className="mb-6"><h2 className="text-[22px] font-extrabold text-primary">⚙️ Paramètres</h2><p className="text-[13px] text-muted-foreground mt-0.5">Configuration du système AGIAS Microfinance</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
          <div className="text-[15px] font-bold text-primary mb-4 pb-2 border-b-2 border-border">🏢 Informations AGIAS</div>
          {[["Nom de l'organisation", 'AGIAS Microfinance'], ['Adresse', 'Abidjan, Côte d\'Ivoire'], ['Téléphone', '+225 07 00 00 00 00'], ['Email', 'contact@agias.org']].map(([l, v]) => (
            <div key={l as string} className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">{l}</label><input defaultValue={v as string} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" /></div>
          ))}
          <button onClick={() => toast.success('Informations sauvegardées !')} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">💾 Sauvegarder</button>
        </div>

        <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
          <div className="text-[15px] font-bold text-primary mb-4 pb-2 border-b-2 border-border">💳 Paramètres Crédit</div>
          {[["Taux d'intérêt par défaut (%/semaine)", 2], ['Montant minimum (FCFA)', 50000], ['Montant maximum (FCFA)', 2000000], ['Durée maximale (semaines)', 52]].map(([l, v]) => (
            <div key={l as string} className="mb-4"><label className="text-[13px] font-semibold text-foreground mb-1.5 block">{l}</label><input type="number" defaultValue={v as number} className="w-full p-[11px_14px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" /></div>
          ))}
          <button onClick={() => toast.success('Paramètres crédit sauvegardés !')} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">💾 Sauvegarder</button>
        </div>

        <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
          <div className="text-[15px] font-bold text-primary mb-4 pb-2 border-b-2 border-border">🔔 Notifications & Alertes</div>
          {[{ key: 'sms', label: 'Rappels SMS automatiques', desc: 'Envoi 24h avant chaque échéance' }, { key: 'whatsapp', label: 'Alertes WhatsApp', desc: 'Messages WhatsApp pour les retards' }, { key: 'email', label: 'Notifications Email', desc: 'Rapports hebdomadaires par email' }, { key: 'fraud', label: 'Alertes de fraude', desc: 'Détection des transactions suspectes' }].map(t => (
            <div key={t.key} className="flex justify-between items-center py-3 border-b border-muted last:border-b-0">
              <div><div className="text-sm font-semibold text-foreground">{t.label}</div><div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div></div>
              <button onClick={() => toggle(t.key)} className={`w-11 h-6 rounded-xl cursor-pointer relative border-none transition-colors ${toggles[t.key] ? 'bg-success' : 'bg-border'}`}>
                <div className={`w-[18px] h-[18px] bg-card rounded-full absolute top-[3px] left-[3px] shadow-sm transition-transform ${toggles[t.key] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
          <div className="text-[15px] font-bold text-primary mb-4 pb-2 border-b-2 border-border">🔐 Sécurité & Accès</div>
          {[{ key: 'doubleVal', label: 'Double validation des crédits', desc: 'Approbation requise avant décaissement' }, { key: 'audit', label: "Journal d'audit complet", desc: 'Enregistrement de toutes les actions' }].map(t => (
            <div key={t.key} className="flex justify-between items-center py-3 border-b border-muted last:border-b-0">
              <div><div className="text-sm font-semibold text-foreground">{t.label}</div><div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div></div>
              <button onClick={() => toggle(t.key)} className={`w-11 h-6 rounded-xl cursor-pointer relative border-none transition-colors ${toggles[t.key] ? 'bg-success' : 'bg-border'}`}>
                <div className={`w-[18px] h-[18px] bg-card rounded-full absolute top-[3px] left-[3px] shadow-sm transition-transform ${toggles[t.key] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
          <div className="flex justify-between items-center py-3 border-b border-muted">
            <div><div className="text-sm font-semibold text-foreground">Expiration de session (minutes)</div></div>
            <input type="number" defaultValue={30} className="w-20 p-[6px_10px] border-2 border-border rounded-[10px] text-sm outline-none focus:border-primary-lighter" />
          </div>
          <div className="flex gap-2.5 mt-4">
            <button onClick={() => toast.success('Sauvegarde de la base de données lancée !')} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors">💾 Sauvegarder BDD</button>
            <button onClick={() => { if (confirm('Réinitialiser tous les paramètres ?')) toast.info('Paramètres réinitialisés.'); }} className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-destructive text-card hover:bg-destructive/80 transition-colors">🔄 Réinitialiser</button>
          </div>
        </div>
      </div>
    </div>
  );
}
