-- =============================================================================
-- AXON / BingeFlix - Supabase Schema & Automatic Auth Sync Setup
-- Paste this ENTIRE script into your Supabase SQL Editor and click "RUN".
-- Dashboard -> SQL Editor -> New Query -> Paste -> RUN (Ctrl+Enter)
-- =============================================================================

-- 1. Create public.profiles table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  avatar_url TEXT DEFAULT 'goku',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create public.user_watchlist table
CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_id TEXT NOT NULL,
  title TEXT,
  poster_path TEXT,
  media_type TEXT DEFAULT 'movie',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_watchlist_user_media_unique UNIQUE (user_id, media_id)
);

-- 3. Create public.user_continue_watching table
CREATE TABLE IF NOT EXISTS public.user_continue_watching (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_id TEXT NOT NULL,
  title TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  media_type TEXT DEFAULT 'movie',
  season INTEGER DEFAULT 1,
  episode INTEGER DEFAULT 1,
  progress INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_continue_watching_user_media_unique UNIQUE (user_id, media_id)
);

-- 4. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_continue_watching ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for profiles (Allow read & allow authenticated users to insert/update their own profile)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. RLS Policies for user_watchlist
DROP POLICY IF EXISTS "Users can view their own watchlist" ON public.user_watchlist;
CREATE POLICY "Users can view their own watchlist" 
  ON public.user_watchlist FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into their own watchlist" ON public.user_watchlist;
CREATE POLICY "Users can insert into their own watchlist" 
  ON public.user_watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own watchlist" ON public.user_watchlist;
CREATE POLICY "Users can update their own watchlist" 
  ON public.user_watchlist FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from their own watchlist" ON public.user_watchlist;
CREATE POLICY "Users can delete from their own watchlist" 
  ON public.user_watchlist FOR DELETE USING (auth.uid() = user_id);

-- 7. RLS Policies for user_continue_watching
DROP POLICY IF EXISTS "Users can view their own continue watching" ON public.user_continue_watching;
CREATE POLICY "Users can view their own continue watching" 
  ON public.user_continue_watching FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into their own continue watching" ON public.user_continue_watching;
CREATE POLICY "Users can insert into their own continue watching" 
  ON public.user_continue_watching FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own continue watching" ON public.user_continue_watching;
CREATE POLICY "Users can update their own continue watching" 
  ON public.user_continue_watching FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from their own continue watching" ON public.user_continue_watching;
CREATE POLICY "Users can delete from their own continue watching" 
  ON public.user_continue_watching FOR DELETE USING (auth.uid() = user_id);

-- 8. AUTOMATIC EMAIL CONFIRMATION TRIGGER
-- Automatically sets email_confirmed_at = NOW() upon creation so users NEVER need to click confirmation emails!
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  NEW.email_confirmed_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- 9. Instantly confirm all existing accounts that are currently unconfirmed
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 10. AUTOMATIC USER PROFILE CREATION TRIGGER
-- When ANY user registers via Supabase Auth, PostgreSQL automatically
-- writes their row into public.profiles with SECURITY DEFINER privileges.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar', 'goku')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. Backfill any existing accounts already in auth.users into public.profiles
INSERT INTO public.profiles (id, email, username, avatar_url)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'username', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'avatar', 'goku')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
