-- ============================================================
-- APOLLUS — CARROSSEL DE DESTAQUES E PRÉ-SAVE V1
-- Execute uma única vez no SQL Editor do Supabase.
-- Pré-requisitos: settings-v1.sql, history-v1.sql e trash-v1.sql.
-- ============================================================

begin;

create table if not exists public.presave_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  artist_name text not null,
  title text not null,
  release_type text not null default 'single'
    check (release_type in ('single','ep','album','outro')),
  release_date date not null,
  release_time time,
  timezone text not null default 'America/Sao_Paulo',
  description text,
  cover_path text,
  presave_url text not null check (presave_url ~* '^https?://'),
  release_url text check (release_url is null or release_url ~* '^https?://'),
  instagram_url text check (instagram_url is null or instagram_url ~* '^https?://'),
  published boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_by_name text,
  deleted_by_email text,
  deleted_previous_published boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presave_campaigns_public_order_idx
  on public.presave_campaigns (published, featured desc, release_date, sort_order, created_at desc)
  where deleted_at is null;

create index if not exists presave_campaigns_deleted_at_idx
  on public.presave_campaigns (deleted_at desc)
  where deleted_at is not null;

create index if not exists presave_campaigns_release_idx
  on public.presave_campaigns (release_date, release_time);

-- Atualização automática de updated_at.
drop trigger if exists presave_campaigns_set_updated_at on public.presave_campaigns;
create trigger presave_campaigns_set_updated_at
before update on public.presave_campaigns
for each row execute function public.set_updated_at();

-- Segurança.
alter table public.presave_campaigns enable row level security;

drop policy if exists "Pré-saves publicados são públicos" on public.presave_campaigns;
drop policy if exists "Admin cria pré-saves" on public.presave_campaigns;
drop policy if exists "Admin edita pré-saves" on public.presave_campaigns;
drop policy if exists "Admin exclui pré-saves" on public.presave_campaigns;

create policy "Pré-saves publicados são públicos"
on public.presave_campaigns for select
to anon, authenticated
using ((deleted_at is null and published = true) or public.is_admin());

create policy "Admin cria pré-saves"
on public.presave_campaigns for insert
to authenticated
with check (public.is_admin());

create policy "Admin edita pré-saves"
on public.presave_campaigns for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admin exclui pré-saves"
on public.presave_campaigns for delete
to authenticated
using (public.is_admin());

grant select on public.presave_campaigns to anon, authenticated;
grant insert, update, delete on public.presave_campaigns to authenticated;

-- Novas configurações públicas. Os valores existentes do usuário prevalecem.
update public.site_settings
set settings = jsonb_build_object(
  'featured_projects_kicker', 'Destaques Apollus',
  'featured_projects_title', 'Projetos lançados recentemente',
  'show_presaves', true,
  'presaves_limit', 0,
  'presave_eyebrow', 'Lançamentos em preparação',
  'presave_title', 'Pré-save de artistas.',
  'presave_text', 'Garanta os próximos lançamentos da Apollus na sua biblioteca e seja uma das primeiras pessoas a ouvir.',
  'presave_empty_title', 'Novos lançamentos serão anunciados em breve.'
) || coalesce(settings, '{}'::jsonb),
updated_at = now()
where id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Amplia o histórico para campanhas de pré-save.
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
  check (entity_type in ('project','agenda','playlist','presave','settings'));

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

-- Histórico detalhado para projetos, agenda, playlists e pré-saves.
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
    when tg_table_name = 'presave_campaigns' then 'presave'
    else null
  end;

  if item_type is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  item_id := coalesce(new.id, old.id);
  item_title := case
    when item_type = 'presave' then concat_ws(' — ', coalesce(new_json ->> 'artist_name', old_json ->> 'artist_name'), coalesce(new_json ->> 'title', old_json ->> 'title'))
    else coalesce(new_json ->> 'title', old_json ->> 'title', 'Sem título')
  end;

  if tg_op = 'INSERT' then
    item_action := 'inserted';
  elsif tg_op = 'DELETE' then
    item_action := 'permanently_deleted';
  elsif (old_json ->> 'deleted_at') is null and (new_json ->> 'deleted_at') is not null then
    item_action := 'deleted';
  elsif (old_json ->> 'deleted_at') is not null and (new_json ->> 'deleted_at') is null then
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

-- Recria os gatilhos com a versão atual do histórico.
drop trigger if exists projects_activity_log on public.projects;
create trigger projects_activity_log
after insert or update or delete on public.projects
for each row execute function public.log_apollus_activity();

drop trigger if exists agenda_activity_log on public.agenda_events;
create trigger agenda_activity_log
after insert or update or delete on public.agenda_events
for each row execute function public.log_apollus_activity();

drop trigger if exists streaming_playlists_activity_log on public.streaming_playlists;
create trigger streaming_playlists_activity_log
after insert or update or delete on public.streaming_playlists
for each row execute function public.log_apollus_activity();

drop trigger if exists presave_campaigns_activity_log on public.presave_campaigns;
create trigger presave_campaigns_activity_log
after insert or update or delete on public.presave_campaigns
for each row execute function public.log_apollus_activity();

commit;
notify pgrst, 'reload schema';
