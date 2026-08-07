-- ============================================================
-- APOLLUS — LIXEIRA E RESTAURAÇÃO V1
-- Execute uma única vez no SQL Editor do Supabase.
-- Pré-requisitos: history-v1.sql já executado.
-- ============================================================

begin;

alter table public.projects
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_by_name text,
  add column if not exists deleted_by_email text,
  add column if not exists deleted_previous_published boolean;

alter table public.agenda_events
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_by_name text,
  add column if not exists deleted_by_email text,
  add column if not exists deleted_previous_published boolean;

alter table public.streaming_playlists
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_by_name text,
  add column if not exists deleted_by_email text,
  add column if not exists deleted_previous_published boolean;

create index if not exists projects_deleted_at_idx on public.projects (deleted_at desc) where deleted_at is not null;
create index if not exists agenda_events_deleted_at_idx on public.agenda_events (deleted_at desc) where deleted_at is not null;
create index if not exists streaming_playlists_deleted_at_idx on public.streaming_playlists (deleted_at desc) where deleted_at is not null;

-- Amplia as ações do histórico.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'activity_log_action_check'
      and conrelid = 'public.activity_log'::regclass
  ) then
    alter table public.activity_log drop constraint activity_log_action_check;
  end if;
end $$;

alter table public.activity_log
  add constraint activity_log_action_check
  check (action in ('inserted','updated','deleted','published','unpublished','restored','permanently_deleted'));

-- O gatilho passa a diferenciar lixeira, restauração e exclusão definitiva.
create or replace function public.log_apollus_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_json jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_json jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  item_id uuid;
  item_title text;
  item_action text;
  item_type text;
  admin_name text;
  admin_email text;
begin
  item_type := case
    when tg_table_name = 'projects' then 'project'
    when tg_table_name = 'agenda_events' then 'agenda'
    when tg_table_name = 'streaming_playlists' then 'playlist'
    else null
  end;

  if item_type is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  item_id := coalesce(new.id, old.id);
  item_title := coalesce(new_json ->> 'title', old_json ->> 'title', 'Sem título');

  if tg_op = 'INSERT' then
    item_action := 'inserted';
  elsif tg_op = 'DELETE' then
    item_action := 'permanently_deleted';
  elsif old.deleted_at is null and new.deleted_at is not null then
    item_action := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    item_action := 'restored';
  elsif (old_json -> 'published') is distinct from (new_json -> 'published') then
    if coalesce((new_json ->> 'published')::boolean, false) then
      item_action := 'published';
    else
      item_action := 'unpublished';
    end if;
  else
    item_action := 'updated';
  end if;

  select contact.name, contact.email
    into admin_name, admin_email
  from public.admin_contacts as contact
  where contact.user_id = auth.uid();

  if admin_email is null then
    select users.email into admin_email
    from auth.users as users
    where users.id = auth.uid();
  end if;

  insert into public.activity_log (
    action, entity_type, entity_id, entity_title, user_id,
    actor_name, actor_email, changes
  ) values (
    item_action, item_type, item_id, item_title, auth.uid(),
    coalesce(admin_name, admin_email, 'Equipe Apollus'),
    admin_email,
    public.activity_jsonb_diff(old_json, new_json)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Leitura pública: somente itens publicados que não estejam na lixeira.
-- Administradores continuam enxergando todos os registros.
drop policy if exists "Projetos publicados são públicos" on public.projects;
create policy "Projetos publicados são públicos"
on public.projects for select
to anon, authenticated
using ((deleted_at is null and published = true) or public.is_admin());

drop policy if exists "Agenda publicada é pública" on public.agenda_events;
create policy "Agenda publicada é pública"
on public.agenda_events for select
to anon, authenticated
using ((deleted_at is null and published = true) or public.is_admin());

drop policy if exists "Playlists publicadas são públicas" on public.streaming_playlists;
create policy "Playlists publicadas são públicas"
on public.streaming_playlists for select
to anon, authenticated
using ((deleted_at is null and published = true) or public.is_admin());

commit;
notify pgrst, 'reload schema';
