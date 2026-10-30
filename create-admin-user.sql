-- =====================================================
-- SCRIPT DE CRÉATION D'UTILISATEUR ADMIN AGIAS
-- =====================================================
-- Email: agiasinter@gmail.com
-- Avant exécution, remplacez le placeholder par un mot de passe fort et unique.
-- Rôle: Admin
-- 
-- Instructions:
-- 1. Allez sur https://app.supabase.com
-- 2. Sélectionnez le projet AGIAS_FINANCE
-- 3. Allez dans "SQL Editor"
-- 4. Créez une nouvelle requête
-- 5. Copiez-collez ce script
-- 6. Cliquez sur "Run"
-- =====================================================

DO $$
DECLARE
  v_user uuid;
  v_password text := 'REPLACE_WITH_A_UNIQUE_STRONG_PASSWORD';
BEGIN
  IF v_password = 'REPLACE_WITH_A_UNIQUE_STRONG_PASSWORD' THEN
    RAISE EXCEPTION 'Set a unique password in v_password before running this script.';
  END IF;

  -- Supprimer l'utilisateur s'il existe déjà (nettoyage optionnel)
  DELETE FROM auth.users WHERE email = 'agiasinter@gmail.com';

  -- Créer l'utilisateur dans auth.users
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'agiasinter@gmail.com',
    crypt(v_password, gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true,"name":"Admin AGIAS"}'::jsonb,
    now(),
    now(),
    false,
    false
  ) RETURNING id INTO v_user;

  -- Créer le profil utilisateur
  INSERT INTO public.profiles (id, name, initials, color, email, active, sub, photo_url)
  VALUES (v_user, 'Admin AGIAS', 'AA', '#0d3d26', 'agiasinter@gmail.com', true, '', null);

  -- Assigner le rôle admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user, 'admin');

  -- Créer l'identité email (optionnel mais recommandé pour la récupération de mot de passe)
  INSERT INTO auth.identities (id, provider, provider_id, user_id, identity_data, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'email',
    'agiasinter@gmail.com',
    v_user,
    jsonb_build_object('email', 'agiasinter@gmail.com'),
    now(),
    now()
  );

  RAISE NOTICE 'Utilisateur créé avec succès: % (ID: %)', 'agiasinter@gmail.com', v_user;
END$$;
