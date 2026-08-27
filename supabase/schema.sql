-- Destination data for "Turism, dar simplu!".
--
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query),
-- then seed with:  node scripts/migrate-cities-to-supabase.mjs
--
-- Design notes
-- ------------
-- `cities` is the searchable index (5000 rows, one per Wikidata city).
--
-- `city_pois` keeps the whole POI list for a city as a single JSONB document
-- rather than 30,000 normalised rows. The app always consumes a city's POIs as
-- one unit — it never queries "all museums everywhere" — so one row per city is
-- one round-trip instead of a join, and it mirrors the JSON files this replaces.
--
-- Security: everyone may READ; nobody may write with the publishable key.
-- Writes happen only through the server with the service_role key, which
-- bypasses RLS. Without that split, anyone who read the client bundle could
-- inject fake attractions into every user's itinerary.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- cities ----
create table if not exists public.cities (
  id          text primary key,            -- Wikidata Q-id, e.g. "Q90"
  name        text        not null,
  -- Lowercased, accent-stripped name, written by the migration script using the
  -- SAME JavaScript normalize() the client uses on the query. Doing it here
  -- rather than with SQL unaccent() means the two can never disagree about how
  -- "București" folds — and it sidesteps unaccent() not being IMMUTABLE, which
  -- would otherwise block indexing the expression at all.
  name_norm   text        not null,
  country     text        not null,        -- ISO 3166-1 alpha-2
  lat         double precision not null,
  lon         double precision not null,
  population  integer,
  rank        integer     not null,        -- Wikipedia sitelink count = recognition
  continent   text,                        -- EU | AS | NA | SA | AF | OC | OT
  tier        text,                        -- mega | major | notable | hidden
  img         text                         -- Wikimedia Commons filename
);

-- Ranking is the tiebreaker in every query, so it leads the sort indexes.
create index if not exists cities_rank_idx on public.cities (rank desc);
create index if not exists cities_tier_rank_idx on public.cities (tier, rank desc);
create index if not exists cities_continent_tier_idx on public.cities (continent, tier, rank desc);

-- Map exploration: "which cities are inside the visible rectangle". A plain
-- composite btree is enough here — 5000 rows filtered by two ranges is trivial,
-- and it avoids pulling in PostGIS for what is only a bounding-box test. Add
-- PostGIS later if real distance sorting ("nearest to me") is ever needed.
create index if not exists cities_bbox_idx on public.cities (lat, lon);

-- Trigram index over the normalized name: serves both `like 'query%'` (prefix,
-- the common case while typing) and `like '%query%'` (substring), which a plain
-- btree could not do for the latter.
create index if not exists cities_name_norm_trgm_idx
  on public.cities using gin (name_norm gin_trgm_ops);

-- ------------------------------------------------------------- city_pois ----
create table if not exists public.city_pois (
  city_id      text primary key references public.cities(id) on delete cascade,
  source       text not null default 'osm',   -- 'osm' (pre-generated) | 'osm-live'
  pois         jsonb not null,
  generated_at date,
  updated_at   timestamptz not null default now()
);

create index if not exists city_pois_source_idx on public.city_pois (source);

-- ------------------------------------------------------------------ RLS ----
alter table public.cities    enable row level security;
alter table public.city_pois enable row level security;

-- Public, read-only. Data is open (OpenStreetMap ODbL / Wikidata CC0) and
-- carries nothing personal, so anonymous reads are intended.
drop policy if exists "cities are publicly readable" on public.cities;
create policy "cities are publicly readable"
  on public.cities for select using (true);

drop policy if exists "city pois are publicly readable" on public.city_pois;
create policy "city pois are publicly readable"
  on public.city_pois for select using (true);

-- No insert/update/delete policies exist on purpose. With RLS enabled and no
-- write policy, the publishable key cannot write at all; the service_role key
-- used by the server bypasses RLS entirely.
