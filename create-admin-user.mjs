import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      let key = line.slice(0, i);
      let value = line.slice(i + 1);
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      return [key, value];
    }),
);

// Vérifier si on a la service_role_key
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY n\'est pas configurée dans .env');
  console.log('');
  console.log('Pour configurer la clé:');
  console.log('1. Allez sur https://app.supabase.com/project/' + env.VITE_SUPABASE_PROJECT_ID + '/settings/api');
  console.log('2. Copiez la "service_role" (la clé secrète)');
  console.log('3. Ajoutez-la dans le fichier .env:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY="votre_clé_ici"');
  console.log('');
  console.log('⚠️ NE PARTAGEZ JAMAIS cette clé en public!');
  process.exit(1);
}

if (!env.ADMIN_USER_PASSWORD) {
  console.error('❌ ADMIN_USER_PASSWORD n\'est pas configurée dans .env');
  process.exit(1);
}

const supabaseAdmin = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

try {
  console.log('🔧 Création de l\'utilisateur agiasinter@gmail.com...');
  
  // Vérifier d'abord si l'utilisateur existe
  const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
  
  const userExists = existingUser?.users?.some(u => u.email === 'agiasinter@gmail.com');
  
  if (userExists) {
    console.log('⚠️ L\'utilisateur existe déjà');
    process.exit(0);
  }

  // Créer l'utilisateur
  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: 'agiasinter@gmail.com',
    password: env.ADMIN_USER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Admin AGIAS',
      email_verified: true,
    },
  });

  if (createError) {
    console.error('❌ Erreur de création:', createError.message);
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log('✅ Utilisateur créé avec l\'ID:', userId);

  // Créer le profil
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: userId,
      name: 'Admin AGIAS',
      initials: 'AA',
      color: '#0d3d26',
      email: 'agiasinter@gmail.com',
      active: true,
      sub: '',
    });

  if (profileError) {
    console.error('⚠️ Erreur lors de la création du profil:', profileError.message);
  } else {
    console.log('✅ Profil créé');
  }

  // Assigner le rôle admin
  const { error: roleError } = await supabaseAdmin
    .from('user_roles')
    .insert({
      user_id: userId,
      role: 'admin',
    });

  if (roleError) {
    console.error('⚠️ Erreur lors de l\'assignation du rôle:', roleError.message);
  } else {
    console.log('✅ Rôle admin assigné');
  }

  console.log('');
  console.log('🎉 Utilisateur créé avec succès!');
  console.log('   Email: agiasinter@gmail.com');
  console.log('   Rôle: admin');

} catch (err) {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
}
