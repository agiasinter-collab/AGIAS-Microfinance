import { readFileSync } from 'fs';

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

const email = 'agiasinter@gmail.com';
const password = env.ADMIN_USER_PASSWORD;

if (!password) {
  console.error('❌ ADMIN_USER_PASSWORD n\'est pas configurée dans .env');
  process.exit(1);
}

console.log('📧 Tentative de création d\'utilisateur...');
console.log(`Email: ${email}`);
console.log('---');

// 1. Test de connexion pour vérifier si l'utilisateur existe
const loginUrl = `${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`;
const loginBody = JSON.stringify({ email, password });

try {
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: loginBody,
  });

  const loginData = await loginRes.json();

  if (loginRes.status === 200) {
    console.log('✅ L\'utilisateur existe et la connexion est possible!');
    console.log('User ID:', loginData.user?.id);
    process.exit(0);
  } else if (loginRes.status === 400 && loginData.error_description?.includes('Invalid login credentials')) {
    console.log('⚠️ L\'utilisateur existe mais le mot de passe est incorrect');
    process.exit(1);
  } else if (loginRes.status === 400 && loginData.error_description?.includes('Email not confirmed')) {
    console.log('⚠️ L\'utilisateur existe mais l\'email n\'est pas confirmé');
    process.exit(1);
  } else if (loginRes.status === 400) {
    console.log('ℹ️ L\'utilisateur n\'existe pas. Tentative de création...');
  } else {
    console.log('❌ Erreur lors de la tentative de connexion:', loginRes.status, loginData);
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Erreur réseau:', err.message);
  process.exit(1);
}

// 2. Le reste du script serait ici, mais nous avons besoin de la service_role_key
console.log('\n📝 Instructions pour créer l\'utilisateur manuellement:');
console.log('1. Allez sur https://app.supabase.com');
console.log('2. Connectez-vous à votre projet AGIAS_FINANCE (ID: ' + env.VITE_SUPABASE_PROJECT_ID + ')');
console.log('3. Allez dans SQL Editor');
console.log('4. Créez une nouvelle requête');
console.log('5. Copiez-collez le contenu de tmp_create_admin.sql');
console.log('6. Exécutez la requête');
console.log('\n✨ Après cela, l\'utilisateur ' + email + ' sera créé avec le mot de passe défini dans ADMIN_USER_PASSWORD.');
