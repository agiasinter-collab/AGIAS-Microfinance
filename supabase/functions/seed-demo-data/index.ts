import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const demoUserPassword = Deno.env.get('DEMO_USER_PASSWORD')
    if (!demoUserPassword) {
      throw new Error('DEMO_USER_PASSWORD must be configured to seed demo users.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Create demo users
    const demoUsers = [
      { email: 'presidente@agias.org', password: demoUserPassword, name: 'Présidente Kouyaté', initials: 'PK', color: '#0d3d26', role: 'admin' },
      { email: 'superviseur@agias.org', password: demoUserPassword, name: 'Ibrahim Soumah', initials: 'IS', color: '#3182ce', role: 'superviseur' },
      { email: 'agent1@agias.org', password: demoUserPassword, name: 'Mamadou Diallo', initials: 'MD', color: '#38a169', role: 'agent' },
      { email: 'agent2@agias.org', password: demoUserPassword, name: 'Fatoumata Sow', initials: 'FS', color: '#c9a84c', role: 'agent' },
    ]

    const userIds: Record<string, string> = {}

    for (const u of demoUsers) {
      // Check if user exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existing = existingUsers?.users?.find(eu => eu.email === u.email)
      
      if (existing) {
        userIds[u.email] = existing.id
        // Update profile
        await supabaseAdmin.from('profiles').upsert({
          id: existing.id, name: u.name, initials: u.initials, color: u.color
        })
        // Update role
        await supabaseAdmin.from('user_roles').upsert(
          { user_id: existing.id, role: u.role },
          { onConflict: 'user_id,role' }
        )
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name }
        })
        if (error) throw new Error(`Failed to create ${u.email}: ${error.message}`)
        userIds[u.email] = data.user.id

        // Update profile with correct data
        await supabaseAdmin.from('profiles').update({
          name: u.name, initials: u.initials, color: u.color
        }).eq('id', data.user.id)

        // Assign role
        await supabaseAdmin.from('user_roles').insert({
          user_id: data.user.id, role: u.role
        })
      }
    }

    // Seed beneficiaires
    const { data: existingBenefs } = await supabaseAdmin.from('beneficiaires').select('id').limit(1)
    if (!existingBenefs || existingBenefs.length === 0) {
      const beneficiaires = [
        { nom: 'Mariama Diallo', dossier: 'AGS-001', tel: '+224 621 234 567', quartier: 'Ratoma', montant: 500000, pct: 75, statut: 'Actif', score: 5, activite: 'Commerce de détail', groupe: 'Groupe Espoir', agent_name: 'Mamadou Diallo', agent_id: userIds['agent1@agias.org'], dob: '15/04/1985', adresse: 'Ratoma Centre, Conakry', inscription: '10/01/2026', credit_num: 'AGS-CR-001', taux: '2%/semaine', paye: 375000, total: 520000, notes: 'Cliente sérieuse, toujours ponctuelle.' },
        { nom: 'Fatoumata Bah', dossier: 'AGS-002', tel: '+224 622 345 678', quartier: 'Matam', montant: 300000, pct: 45, statut: 'Retard', score: 3, activite: 'Vente de légumes', groupe: 'Groupe Solidarité', agent_name: 'Fatoumata Sow', agent_id: userIds['agent2@agias.org'], dob: '22/08/1990', adresse: 'Matam Marché, Conakry', inscription: '15/01/2026', credit_num: 'AGS-CR-002', taux: '2%/semaine', paye: 135000, total: 312000, notes: 'Difficultés financières ce mois.' },
        { nom: 'Aissatou Camara', dossier: 'AGS-003', tel: '+224 623 456 789', quartier: 'Kaloum', montant: 750000, pct: 90, statut: 'Actif', score: 5, activite: 'Couture & Broderie', groupe: 'Groupe Avenir', agent_name: 'Fatoumata Sow', agent_id: userIds['agent2@agias.org'], dob: '03/12/1982', adresse: 'Kaloum Centre, Conakry', inscription: '05/01/2026', credit_num: 'AGS-CR-003', taux: '1.5%/semaine', paye: 675000, total: 750000, notes: 'Excellente cliente.' },
        { nom: 'Kadiatou Kouyaté', dossier: 'AGS-004', tel: '+224 624 567 890', quartier: 'Dixinn', montant: 200000, pct: 20, statut: 'Défaut', score: 2, activite: 'Restauration', groupe: 'Groupe Lumière', agent_name: 'Mamadou Diallo', agent_id: userIds['agent1@agias.org'], dob: '17/06/1988', adresse: 'Dixinn Mosquée, Conakry', inscription: '20/12/2025', credit_num: 'AGS-CR-004', taux: '2%/semaine', paye: 40000, total: 208000, notes: 'Activité fermée. Mise en demeure envoyée.' },
        { nom: 'Aminata Sylla', dossier: 'AGS-005', tel: '+224 625 678 901', quartier: 'Ratoma', montant: 450000, pct: 60, statut: 'Actif', score: 4, activite: 'Teinture & Batik', groupe: 'Groupe Espoir', agent_name: 'Mamadou Diallo', agent_id: userIds['agent1@agias.org'], dob: '29/03/1987', adresse: 'Ratoma Gare, Conakry', inscription: '12/01/2026', credit_num: 'AGS-CR-005', taux: '2%/semaine', paye: 270000, total: 468000, notes: 'Bonne progression.' },
        { nom: 'Hawa Traoré', dossier: 'AGS-006', tel: '+224 626 789 012', quartier: 'Matam', montant: 600000, pct: 100, statut: 'Soldé', score: 5, activite: 'Épicerie', groupe: 'Groupe Solidarité', agent_name: 'Fatoumata Sow', agent_id: userIds['agent2@agias.org'], dob: '11/01/1980', adresse: 'Matam Centre, Conakry', inscription: '01/09/2025', credit_num: 'AGS-CR-006', taux: '2%/semaine', paye: 624000, total: 624000, notes: 'Crédit soldé avec succès.' },
        { nom: 'Mariam Konaté', dossier: 'AGS-007', tel: '+224 627 890 123', quartier: 'Kaloum', montant: 350000, pct: 35, statut: 'Retard', score: 3, activite: 'Coiffure', groupe: 'Groupe Avenir', agent_name: 'Mamadou Diallo', agent_id: userIds['agent1@agias.org'], dob: '05/09/1993', adresse: 'Kaloum Port, Conakry', inscription: '18/01/2026', credit_num: 'AGS-CR-007', taux: '2%/semaine', paye: 122500, total: 364000, notes: '3 jours de retard.' },
        { nom: 'Oumou Baldé', dossier: 'AGS-008', tel: '+224 628 901 234', quartier: 'Dixinn', montant: 800000, pct: 55, statut: 'Actif', score: 4, activite: 'Import-Export', groupe: 'Groupe Lumière', agent_name: 'Fatoumata Sow', agent_id: userIds['agent2@agias.org'], dob: '20/07/1979', adresse: 'Dixinn Centre, Conakry', inscription: '22/01/2026', credit_num: 'AGS-CR-008', taux: '1.5%/semaine', paye: 440000, total: 832000, notes: 'Grande commerçante. Très fiable.' },
      ]

      const { data: insertedBenefs, error: bErr } = await supabaseAdmin.from('beneficiaires').insert(beneficiaires).select()
      if (bErr) throw new Error(`Failed to insert beneficiaires: ${bErr.message}`)

      // Seed echeances for first 3 beneficiaires
      if (insertedBenefs && insertedBenefs.length >= 3) {
        const echeances = [
          // Mariama Diallo
          { beneficiaire_id: insertedBenefs[0].id, date: '10/02/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[0].id, date: '17/02/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[0].id, date: '24/02/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[0].id, date: '03/03/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[0].id, date: '10/03/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[0].id, date: '17/03/2026', prevu: 25000, paye: 25000, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[0].id, date: '24/03/2026', prevu: 25000, paye: 0, retard: 0, statut: 'En cours' },
          { beneficiaire_id: insertedBenefs[0].id, date: '31/03/2026', prevu: 25000, paye: 0, retard: 0, statut: 'À venir' },
          // Fatoumata Bah
          { beneficiaire_id: insertedBenefs[1].id, date: '05/02/2026', prevu: 18750, paye: 18750, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[1].id, date: '12/02/2026', prevu: 18750, paye: 18750, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[1].id, date: '19/02/2026', prevu: 18750, paye: 18750, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[1].id, date: '26/02/2026', prevu: 18750, paye: 0, retard: 5, statut: 'Retard' },
          { beneficiaire_id: insertedBenefs[1].id, date: '05/03/2026', prevu: 18750, paye: 0, retard: 12, statut: 'Retard' },
          { beneficiaire_id: insertedBenefs[1].id, date: '12/03/2026', prevu: 18750, paye: 0, retard: 7, statut: 'Retard' },
          { beneficiaire_id: insertedBenefs[1].id, date: '19/03/2026', prevu: 18750, paye: 0, retard: 0, statut: 'À venir' },
          { beneficiaire_id: insertedBenefs[1].id, date: '26/03/2026', prevu: 18750, paye: 0, retard: 0, statut: 'À venir' },
          // Aissatou Camara
          { beneficiaire_id: insertedBenefs[2].id, date: '25/01/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[2].id, date: '01/02/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[2].id, date: '08/02/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[2].id, date: '15/02/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[2].id, date: '22/02/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[2].id, date: '01/03/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[2].id, date: '08/03/2026', prevu: 37500, paye: 37500, retard: 0, statut: 'Payé' },
          { beneficiaire_id: insertedBenefs[2].id, date: '15/03/2026', prevu: 37500, paye: 0, retard: 0, statut: 'En cours' },
        ]

        await supabaseAdmin.from('echeances').insert(echeances)
      }

      // Seed transactions
      const transactions = [
        { beneficiaire_nom: 'Mariama Diallo', type: 'Remboursement', montant: 25000, methode: 'Orange Money', reference: 'OM-2026-001', agent_name: 'Mamadou Diallo', agent_id: userIds['agent1@agias.org'] },
        { beneficiaire_nom: 'Oumou Baldé', type: 'Décaissement', montant: 800000, methode: 'Virement', reference: 'VIR-2026-008', agent_name: 'Fatoumata Sow', agent_id: userIds['agent2@agias.org'] },
        { beneficiaire_nom: 'Aminata Sylla', type: 'Remboursement', montant: 22500, methode: 'Espèces', reference: 'ESP-2026-015', agent_name: 'Mamadou Diallo', agent_id: userIds['agent1@agias.org'] },
        { beneficiaire_nom: 'Fatoumata Bah', type: 'Pénalité', montant: 5000, methode: 'Automatique', reference: 'PEN-2026-003', agent_name: 'Système', notes: 'Pénalité retard 7 jours' },
      ]
      await supabaseAdmin.from('transactions').insert(transactions)

      // Seed notifications
      const notifications = [
        { icon: '⚠️', text: "Fatoumata Bah — Retard de 7 jours sur l'échéance du 17/03/2026", time: 'Il y a 2 heures' },
        { icon: '✅', text: 'Remboursement reçu — Mariama Diallo — 25 000 XOF via Orange Money', time: 'Il y a 4 heures' },
        { icon: '🚨', text: 'Kadiatou Kouyaté — Crédit en défaut depuis 45 jours', time: 'Hier' },
        { icon: '💳', text: 'Nouveau crédit approuvé — Oumou Baldé — 800 000 XOF', time: 'Hier' },
        { icon: '📊', text: 'Rapport mensuel de mars 2026 disponible', time: 'Il y a 2 jours' },
      ]
      await supabaseAdmin.from('notifications').insert(notifications)
    }

    return new Response(JSON.stringify({ success: true, message: 'Demo data seeded successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})