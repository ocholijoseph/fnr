-- Supabase table creation for seed data

CREATE TABLE IF NOT EXISTS public.socials (
  id text PRIMARY KEY,
  platform text,
  url text,
  enabled boolean
);

CREATE TABLE IF NOT EXISTS public.donations (
  id text PRIMARY KEY,
  name text,
  email text,
  amount text,
  reference text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.testimonies (
  id text PRIMARY KEY,
  content jsonb,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id text PRIMARY KEY,
  content jsonb,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.news (
  id text PRIMARY KEY,
  title text,
  content text,
  status text,
  pinned boolean,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.scroll (
  id text PRIMARY KEY,
  override_enabled boolean,
  override_message text,
  scroll_type text
);

CREATE TABLE IF NOT EXISTS public.news_headlines (
  id text PRIMARY KEY,
  title text,
  source text,
  summary text,
  url text,
  timestamp timestamptz,
  provider text,
  region text,
  fetched_at timestamptz
);
