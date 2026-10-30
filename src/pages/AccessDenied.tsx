interface Props { onBack: () => void; }

export default function AccessDeniedPage({ onBack }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-[64px] mb-5">🔒</div>
      <h3 className="text-[22px] font-extrabold text-destructive mb-2.5">Accès Refusé</h3>
      <p className="text-sm text-muted-foreground">
        Vous n'avez pas les permissions nécessaires pour accéder à cette section.<br />
        Contactez l'administrateur pour obtenir les droits d'accès.
      </p>
      <button onClick={onBack} className="mt-5 px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-primary text-card hover:bg-primary-lighter transition-colors">
        🏠 Retour au Dashboard
      </button>
    </div>
  );
}
