-- Isolated PGlite-only Auth shim. Never execute in Supabase: Supabase owns auth.*.
create role service_role nologin;
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

-- Isolated Storage shim for bucket/path RLS tests (not the real Storage service).
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated,anon;
grant select,insert on storage.objects to authenticated;
