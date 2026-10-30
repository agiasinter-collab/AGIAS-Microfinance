import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReportStats {
  performance: { tauxRemb: number; nouveauxCredits: number; montantDecaisse: number };
  portefeuille: { totalActif: number; par30: number; tauxPerte: number };
  beneficiaires: { total: number; actifs: number; nouveaux: number };
  impayes: { totalRetard: number; dossiers: number };
  agents: { data: { name: string; pct: number }[]; moyenne: number };
  evolution: { croissance: number };
}

interface GeneratedReport {
  id: string;
  name: string;
  period: string;
  generated_by: string;
  report_date: string;
  format: string;
  file_url: string | null;
  report_type: string;
  data: Record<string, unknown> | null;
}

const MONTHS = [
  'Mars 2026', 'Février 2026', 'Janvier 2026', 'Décembre 2025',
  'Novembre 2025', 'Octobre 2025',
];

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

export default function RapportsPage() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState(MONTHS[0]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Fetch live statistics
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [benRes, echRes, txRes, profilesRes] = await Promise.all([
        supabase.from('beneficiaires').select('*'),
        supabase.from('echeances').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('profiles').select('id, name'),
      ]);

      const bens = benRes.data || [];
      const echs = echRes.data || [];
      const txs = txRes.data || [];

      const actifs = bens.filter(b => b.statut === 'Actif');
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const nouveaux = bens.filter(b => {
        if (!b.created_at) return false;
        const d = new Date(b.created_at);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });

      const totalPaye = bens.reduce((s, b) => s + (b.paye || 0), 0);
      const totalDu = bens.reduce((s, b) => s + (b.total || 0), 0);
      const tauxRemb = totalDu > 0 ? Math.round((totalPaye / totalDu) * 1000) / 10 : 0;

      const totalActif = bens.reduce((s, b) => s + (b.montant || 0), 0);

      const retardEch = echs.filter(e => e.statut === 'En retard' || (e.retard && e.retard > 0));
      const totalRetard = retardEch.reduce((s, e) => s + (e.prevu - e.paye), 0);

      const decaissements = txs.filter(t => {
        const d = new Date(t.created_at);
        return t.type === 'Décaissement' && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
      const montantDecaisse = decaissements.reduce((s, t) => s + t.montant, 0);

      // Agent performance from beneficiaires
      const agentMap = new Map<string, { total: number; paye: number; name: string }>();
      bens.forEach(b => {
        if (b.agent_name) {
          const existing = agentMap.get(b.agent_name) || { total: 0, paye: 0, name: b.agent_name };
          existing.total += b.total || 0;
          existing.paye += b.paye || 0;
          agentMap.set(b.agent_name, existing);
        }
      });
      const agentsData = Array.from(agentMap.values()).map(a => ({
        name: a.name,
        pct: a.total > 0 ? Math.round((a.paye / a.total) * 100) : 0,
      }));
      const moyenne = agentsData.length > 0
        ? Math.round(agentsData.reduce((s, a) => s + a.pct, 0) / agentsData.length)
        : 0;

      const par30 = totalActif > 0 ? Math.round((totalRetard / totalActif) * 1000) / 10 : 0;

      setStats({
        performance: { tauxRemb, nouveauxCredits: nouveaux.length, montantDecaisse },
        portefeuille: { totalActif, par30, tauxPerte: Math.round(par30 * 0.17 * 10) / 10 },
        beneficiaires: { total: bens.length, actifs: actifs.length, nouveaux: nouveaux.length },
        impayes: { totalRetard: Math.abs(totalRetard), dossiers: retardEch.length },
        agents: { data: agentsData, moyenne },
        evolution: { croissance: tauxRemb > 0 ? Math.round((tauxRemb - 75) / 75 * 100) : 0 },
      });
    } catch (err) {
      console.error('Stats fetch error:', err);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch generated reports
  const fetchReports = useCallback(async () => {
    const { data } = await supabase
      .from('generated_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(20);
    if (data) setReports(data as GeneratedReport[]);
  }, []);

  useEffect(() => {
    fetchStats();
    fetchReports();
  }, [fetchStats, fetchReports]);

  // Realtime subscription for reports
  useEffect(() => {
    const channel = supabase
      .channel('generated_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generated_reports' }, () => {
        fetchReports();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchReports]);

  const rapportCards = stats ? [
    {
      icon: '📊', name: 'Performance Mensuelle', desc: 'Indicateurs clés du mois en cours',
      info: `Taux de remboursement: ${stats.performance.tauxRemb}%\nNouveaux crédits: ${stats.performance.nouveauxCredits}\nMontant décaissé: ${formatFCFA(stats.performance.montantDecaisse)}`,
    },
    {
      icon: '💼', name: 'État du Portefeuille', desc: 'Santé globale du portefeuille de crédit',
      info: `Total actif: ${formatFCFA(stats.portefeuille.totalActif)}\nPAR 30: ${stats.portefeuille.par30}%\nTaux de perte: ${stats.portefeuille.tauxPerte}%`,
    },
    {
      icon: '👥', name: 'Rapport Bénéficiaires', desc: 'Statistiques sur les bénéficiaires',
      info: `Total inscrites: ${stats.beneficiaires.total}\nActives: ${stats.beneficiaires.actifs}\nNouvelles ce mois: ${stats.beneficiaires.nouveaux}`,
    },
    {
      icon: '🚨', name: 'Rapport des Impayés', desc: 'Analyse détaillée des retards et défauts',
      info: `Total en retard: ${formatFCFA(stats.impayes.totalRetard)}\nDossiers: ${stats.impayes.dossiers}`,
    },
    {
      icon: '👷', name: 'Performance Agents', desc: 'Évaluation des agents de terrain',
      info: stats.agents.data.map(a => `${a.name}: ${a.pct}%`).join('\n') + `\nMoyenne: ${stats.agents.moyenne}%`,
    },
    {
      icon: '📈', name: 'Évolution du Portefeuille', desc: 'Tendances et projections annuelles',
      info: `Croissance: ${stats.evolution.croissance > 0 ? '+' : ''}${stats.evolution.croissance}% vs objectif`,
    },
  ] : [];

  // Generate real PDF
  const generatePDF = async (reportType?: string) => {
    if (!stats || !user) return;
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(13, 61, 38);
      doc.text('AGIAS Microfinance', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Rapport - ${selectedPeriod}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Généré par: ${user.name}`, pageWidth / 2, 35, { align: 'center' });
      doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, pageWidth / 2, 42, { align: 'center' });

      doc.setDrawColor(13, 61, 38);
      doc.setLineWidth(0.5);
      doc.line(20, 46, pageWidth - 20, 46);

      let yPos = 55;

      // Performance Mensuelle
      doc.setFontSize(14);
      doc.setTextColor(13, 61, 38);
      doc.text('📊 Performance Mensuelle', 20, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Taux de remboursement', `${stats.performance.tauxRemb}%`],
          ['Nouveaux crédits', `${stats.performance.nouveauxCredits}`],
          ['Montant décaissé', formatFCFA(stats.performance.montantDecaisse)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [13, 61, 38] },
        margin: { left: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // État du Portefeuille
      doc.setFontSize(14);
      doc.text('💼 État du Portefeuille', 20, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Total actif', formatFCFA(stats.portefeuille.totalActif)],
          ['PAR 30', `${stats.portefeuille.par30}%`],
          ['Taux de perte', `${stats.portefeuille.tauxPerte}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [13, 61, 38] },
        margin: { left: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Bénéficiaires
      doc.setFontSize(14);
      doc.text('👥 Rapport Bénéficiaires', 20, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Total inscrites', `${stats.beneficiaires.total}`],
          ['Actives', `${stats.beneficiaires.actifs}`],
          ['Nouvelles ce mois', `${stats.beneficiaires.nouveaux}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [13, 61, 38] },
        margin: { left: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Check if we need a new page
      if (yPos > 230) { doc.addPage(); yPos = 20; }

      // Impayés
      doc.setFontSize(14);
      doc.text('🚨 Rapport des Impayés', 20, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Total en retard', formatFCFA(stats.impayes.totalRetard)],
          ['Dossiers en retard', `${stats.impayes.dossiers}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [13, 61, 38] },
        margin: { left: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      if (yPos > 230) { doc.addPage(); yPos = 20; }

      // Performance Agents
      if (stats.agents.data.length > 0) {
        doc.setFontSize(14);
        doc.text('👷 Performance Agents', 20, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [['Agent', 'Taux de recouvrement']],
          body: [
            ...stats.agents.data.map(a => [a.name, `${a.pct}%`]),
            ['Moyenne', `${stats.agents.moyenne}%`],
          ],
          theme: 'grid',
          headStyles: { fillColor: [13, 61, 38] },
          margin: { left: 20 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`AGIAS Microfinance - Page ${i}/${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      // Save PDF as blob and trigger download
      const pdfBlob = doc.output('blob');
      const fileName = `rapport_${reportType || 'complet'}_${selectedPeriod.replace(/\s/g, '_')}.pdf`;

      // Download immediately
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      // Save report record to database
      await supabase.from('generated_reports').insert({
        name: reportType || 'Rapport Complet',
        period: selectedPeriod,
        generated_by: user.name,
        generated_by_id: user.id,
        format: 'PDF',
        file_name: fileName,
        report_type: reportType || 'complet',
        data: stats as unknown as Record<string, unknown>,
      } as any);

      toast.success('Rapport PDF généré et téléchargé !');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setGenerating(false);
    }
  };

  // Generate individual card report
  const generateCardReport = async (cardName: string) => {
    if (!stats || !user) return;
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(20);
      doc.setTextColor(13, 61, 38);
      doc.text('AGIAS Microfinance', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(100);
      doc.text(cardName, pageWidth / 2, 30, { align: 'center' });
      doc.text(`Période: ${selectedPeriod} | ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`, pageWidth / 2, 38, { align: 'center' });

      doc.line(20, 44, pageWidth - 20, 44);

      let body: string[][] = [];
      switch (cardName) {
        case 'Performance Mensuelle':
          body = [
            ['Taux de remboursement', `${stats.performance.tauxRemb}%`],
            ['Nouveaux crédits', `${stats.performance.nouveauxCredits}`],
            ['Montant décaissé', formatFCFA(stats.performance.montantDecaisse)],
          ]; break;
        case 'État du Portefeuille':
          body = [
            ['Total actif', formatFCFA(stats.portefeuille.totalActif)],
            ['PAR 30', `${stats.portefeuille.par30}%`],
            ['Taux de perte', `${stats.portefeuille.tauxPerte}%`],
          ]; break;
        case 'Rapport Bénéficiaires':
          body = [
            ['Total inscrites', `${stats.beneficiaires.total}`],
            ['Actives', `${stats.beneficiaires.actifs}`],
            ['Nouvelles ce mois', `${stats.beneficiaires.nouveaux}`],
          ]; break;
        case 'Rapport des Impayés':
          body = [
            ['Total en retard', formatFCFA(stats.impayes.totalRetard)],
            ['Dossiers en retard', `${stats.impayes.dossiers}`],
          ]; break;
        case 'Performance Agents':
          body = [
            ...stats.agents.data.map(a => [a.name, `${a.pct}%`]),
            ['Moyenne', `${stats.agents.moyenne}%`],
          ]; break;
        case 'Évolution du Portefeuille':
          body = [['Croissance', `${stats.evolution.croissance > 0 ? '+' : ''}${stats.evolution.croissance}%`]];
          break;
      }

      autoTable(doc, {
        startY: 52,
        head: [['Indicateur', 'Valeur']],
        body,
        theme: 'grid',
        headStyles: { fillColor: [13, 61, 38] },
        margin: { left: 20 },
      });

      const fileName = `rapport_${cardName.replace(/\s/g, '_')}_${selectedPeriod.replace(/\s/g, '_')}.pdf`;
      const url = URL.createObjectURL(doc.output('blob'));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      await supabase.from('generated_reports').insert({
        name: cardName,
        period: selectedPeriod,
        generated_by: user.name,
        generated_by_id: user.id,
        format: 'PDF',
        file_name: fileName,
        report_type: cardName,
        data: stats as unknown as Record<string, unknown>,
      } as any);

      toast.success(`Rapport "${cardName}" généré !`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de génération');
    } finally {
      setGenerating(false);
    }
  };

  // Re-download a saved report (regenerate from stored data)
  const downloadReport = (report: GeneratedReport) => {
    if (!report.data) {
      toast.error('Données du rapport non disponibles');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const data = report.data as unknown as ReportStats;

      doc.setFontSize(20);
      doc.setTextColor(13, 61, 38);
      doc.text('AGIAS Microfinance', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`${report.name} - ${report.period}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Généré par: ${report.generated_by} | ${format(new Date(report.report_date), 'dd/MM/yyyy', { locale: fr })}`, pageWidth / 2, 36, { align: 'center' });
      doc.line(20, 42, pageWidth - 20, 42);

      const sections: { title: string; rows: string[][] }[] = [
        { title: 'Performance', rows: [
          ['Taux remboursement', `${data.performance?.tauxRemb ?? '-'}%`],
          ['Nouveaux crédits', `${data.performance?.nouveauxCredits ?? '-'}`],
          ['Montant décaissé', formatFCFA(data.performance?.montantDecaisse ?? 0)],
        ]},
        { title: 'Portefeuille', rows: [
          ['Total actif', formatFCFA(data.portefeuille?.totalActif ?? 0)],
          ['PAR 30', `${data.portefeuille?.par30 ?? '-'}%`],
        ]},
        { title: 'Bénéficiaires', rows: [
          ['Total', `${data.beneficiaires?.total ?? '-'}`],
          ['Actives', `${data.beneficiaires?.actifs ?? '-'}`],
        ]},
        { title: 'Impayés', rows: [
          ['Total en retard', formatFCFA(data.impayes?.totalRetard ?? 0)],
          ['Dossiers', `${data.impayes?.dossiers ?? '-'}`],
        ]},
      ];

      let y = 50;
      sections.forEach(s => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(13);
        doc.setTextColor(13, 61, 38);
        doc.text(s.title, 20, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [['Indicateur', 'Valeur']],
          body: s.rows,
          theme: 'grid',
          headStyles: { fillColor: [13, 61, 38] },
          margin: { left: 20 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      });

      const url = URL.createObjectURL(doc.output('blob'));
      const a = document.createElement('a');
      a.href = url;
      a.download = (report as any).file_name || `rapport_${report.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Téléchargement lancé !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur de téléchargement');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold text-primary">📊 Rapports</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">Génération et export des rapports de performance</p>
        </div>
        <div className="flex gap-2.5 items-center">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="px-3.5 py-[10px] border-2 border-border rounded-[10px] text-[13px] bg-card text-foreground outline-none cursor-pointer"
          >
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          <button
            onClick={() => generatePDF()}
            disabled={generating || loadingStats}
            className="px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-accent text-accent-foreground hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {generating ? '⏳ Génération...' : '📄 Générer PDF'}
          </button>
        </div>
      </div>

      {/* Report cards with live data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        {loadingStats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg p-6 shadow-[var(--shadow)] text-center animate-pulse">
              <div className="h-10 w-10 bg-muted rounded-full mx-auto mb-3" />
              <div className="h-4 w-32 bg-muted rounded mx-auto mb-2" />
              <div className="h-3 w-24 bg-muted rounded mx-auto" />
            </div>
          ))
        ) : (
          rapportCards.map(r => (
            <div
              key={r.name}
              onClick={() => generateCardReport(r.name)}
              className="bg-card rounded-lg p-6 shadow-[var(--shadow)] cursor-pointer border-2 border-transparent hover:border-primary-lighter hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] transition-all text-center group"
              title={`Cliquer pour générer le rapport "${r.name}"`}
            >
              <div className="text-4xl mb-3">{r.icon}</div>
              <div className="text-sm font-bold text-primary mb-1.5">{r.name}</div>
              <div className="text-xs text-muted-foreground mb-2">{r.desc}</div>
              <div className="text-[11px] text-muted-foreground whitespace-pre-line opacity-0 group-hover:opacity-100 transition-opacity border-t border-border pt-2 mt-1">
                {r.info}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent generated reports */}
      <div className="bg-card rounded-lg p-[22px] shadow-[var(--shadow)]">
        <div className="text-base font-bold text-primary mb-4">📋 Rapports Récents Générés</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Rapport', 'Période', 'Généré par', 'Date', 'Format', 'Action'].map(h => (
                  <th key={h} className="bg-muted/50 px-3.5 py-3 text-xs font-bold text-muted-foreground uppercase text-left border-b-2 border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3.5 py-8 text-center text-sm text-muted-foreground">
                    Aucun rapport généré. Cliquez sur "Générer PDF" ou sur une carte pour créer un rapport.
                  </td>
                </tr>
              ) : (
                reports.map(r => (
                  <tr key={r.id} className="hover:bg-muted/50">
                    <td className="px-3.5 py-[13px] text-[13px] border-b border-muted font-medium">{r.name}</td>
                    <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{r.period}</td>
                    <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">{r.generated_by}</td>
                    <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                      {format(new Date(r.report_date), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                      <span className={`px-2.5 py-1 rounded-[20px] text-[11px] font-bold ${
                        r.format === 'PDF' ? 'bg-destructive/[0.12] text-destructive' : 'bg-success/[0.12] text-success'
                      }`}>{r.format}</span>
                    </td>
                    <td className="px-3.5 py-[13px] text-[13px] border-b border-muted">
                      <button
                        onClick={() => downloadReport(r)}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-card transition-colors"
                      >
                        📥 Télécharger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
