-- ============================================================
-- APOLLUS — PLAYLISTS E STREAMINGS V1
-- Execute uma única vez no SQL Editor do Supabase.
-- Pré-requisito: setup.sql e dashboard-v2.sql já executados.
-- ============================================================

create table if not exists public.streaming_playlists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_name text,
  description text,
  platform text not null default 'spotify'
    check (platform in ('spotify','youtube','apple_music','deezer','soundcloud','outros')),
  playlist_url text not null,
  embed_url text,
  cover_path text,
  published boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists streaming_playlists_public_order_idx
  on public.streaming_playlists (published, featured desc, sort_order, created_at desc);

drop trigger if exists streaming_playlists_set_updated_at on public.streaming_playlists;
create trigger streaming_playlists_set_updated_at
before update on public.streaming_playlists
for each row execute function public.set_updated_at();

alter table public.streaming_playlists enable row level security;

drop policy if exists "Playlists publicadas são públicas" on public.streaming_playlists;
drop policy if exists "Admin cria playlists" on public.streaming_playlists;
drop policy if exists "Admin edita playlists" on public.streaming_playlists;
drop policy if exists "Admin exclui playlists" on public.streaming_playlists;

create policy "Playlists publicadas são públicas"
on public.streaming_playlists for select
to anon, authenticated
using (published = true or public.is_admin());

create policy "Admin cria playlists"
on public.streaming_playlists for insert
to authenticated
with check (public.is_admin());

create policy "Admin edita playlists"
on public.streaming_playlists for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admin exclui playlists"
on public.streaming_playlists for delete
to authenticated
using (public.is_admin());

grant select on public.streaming_playlists to anon, authenticated;
grant insert, update, delete on public.streaming_playlists to authenticated;

-- Inclui playlists no histórico do Dashboard V2.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'activity_log_entity_type_check'
      and conrelid = 'public.activity_log'::regclass
  ) then
    alter table public.activity_log drop constraint activity_log_entity_type_check;
  end if;
end $$;

alter table public.activity_log
  add constraint activity_log_entity_type_check
  check (entity_type in ('project','agenda','playlist'));

create or replace function public.log_apollus_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_id uuid;
  item_title text;
  item_action text;
  item_type text;
begin
  item_type := case
    when tg_table_name = 'projects' then 'project'
    when tg_table_name = 'agenda_events' then 'agenda'
    when tg_table_name = 'streaming_playlists' then 'playlist'
    else 'project'
  end;

  item_id := coalesce(new.id, old.id);
  item_title := coalesce(new.title, old.title);

  if tg_op = 'INSERT' then
    item_action := 'inserted';
  elsif tg_op = 'DELETE' then
    item_action := 'deleted';
  elsif old.published is distinct from new.published and new.published = true then
    item_action := 'published';
  else
    item_action := 'updated';
  end if;

  insert into public.activity_log (action, entity_type, entity_id, entity_title, user_id)
  values (item_action, item_type, item_id, item_title, auth.uid());

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists streaming_playlists_activity_log on public.streaming_playlists;
create trigger streaming_playlists_activity_log
after insert or update or delete on public.streaming_playlists
for each row execute function public.log_apollus_activity();
