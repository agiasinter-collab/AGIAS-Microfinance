# 📋 Guide de Création d'Utilisateur Admin AGIAS

## Problème Identifié
L'utilisateur `agiasinter@gmail.com` n'existe pas dans Supabase. C'est pour cela que vous recevez l'erreur "Email ou mot de passe incorrect" lors de la connexion.

## ✅ Solution

### Option 1: Via le Dashboard Supabase (Recommandé)

1. **Allez sur le dashboard Supabase**
   - URL: https://app.supabase.com
   - Connectez-vous avec vos identifiants

2. **Sélectionnez votre projet**
   - Projet ID: `uimftmzvyirfjfacdain`
   - Nom: `AGIAS_FINANCE`

3. **Accédez au SQL Editor**
   - Dans le menu latéral, cliquez sur "SQL Editor"
   - Cliquez sur "New query" (Nouvelle requête)

4. **Copiez-collez le script**
   - Ouvrez le fichier: `create-admin-user.sql`
   - Copiez tout le contenu
   - Collez-le dans l'éditeur SQL de Supabase

5. **Exécutez la requête**
   - Cliquez sur le bouton "Run" (ou Ctrl+Enter)
   - Vous devriez voir: "Utilisateur créé avec succès"

### Option 2: Via le CLI Supabase (Si vous avez une connexion locale)

```bash
# 1. Assurez-vous que le CLI Supabase est installé
supabase --version

# 2. Connectez-vous à Supabase
supabase login

# 3. Liez votre projet
supabase link --project-ref uimftmzvyirfjfacdain

# 4. Exécutez le script SQL
psql -d postgres://[user]:[password]@db.uimftmzvyirfjfacdain.supabase.co:6543/postgres < create-admin-user.sql
```

---

## 🔐 Détails de l'Utilisateur Créé

- **Email**: agiasinter@gmail.com
- **Mot de passe**: défini localement avant la création
- **Rôle**: Admin
- **Prénom**: Admin AGIAS
- **Initiales**: AA
- **Couleur**: #0d3d26 (Vert foncé)

---

## 📝 Après la Création

Une fois l'utilisateur créé:

1. **Revenez à l'application**
   - URL: http://localhost:8080/

2. **Connectez-vous**
   - Email: agiasinter@gmail.com
   - Mot de passe: celui défini lors de la création

3. **Vérifiez que tout fonctionne**
   - Vous devriez être redirigé vers le dashboard
   - Consultez la console du navigateur si vous avez des erreurs

---

## 🆘 Dépannage

### Erreur "User already exists"
- Cela signifie que l'utilisateur existe déjà
- Le script supprimer automatiquement l'ancien avant de créer le nouveau

### Erreur de Permission
- Assurez-vous que vous êtes connecté au projet en tant qu'administrateur
- Vérifiez que votre compte Supabase a les permissions nécessaires

### Erreur de Syntaxe SQL
- Copiez bien tout le script (y compris le `DO $$` au début et `$$;` à la fin)
- Assurez-vous qu'il n'y a pas de caractères supplémentaires

---

## 📂 Fichiers Associés

- `create-admin-user.sql` - Script SQL à exécuter
- `create-user-script.mjs` - Script Node.js pour vérifier l'utilisateur
- `create-admin-user.mjs` - Script Node.js pour créer l'utilisateur (nécessite SUPABASE_SERVICE_ROLE_KEY)
- `tmp_create_admin.sql` - Script original (même contenu)

---

## 💡 Note

La clé `SUPABASE_SERVICE_ROLE_KEY` n'est pas stockée dans `.env` pour des raisons de sécurité.
Si vous devez l'ajouter temporairement, ajoutez-la dans `.env` (et assurez-vous que `.env` est dans `.gitignore`).

**ATTENTION**: Ne partagez jamais la `service_role_key` en public!
