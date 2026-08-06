-- ============================================================
-- APOLLUS CMS — BANCO, SEGURANÇA E ARMAZENAMENTO
-- Execute este arquivo no SQL Editor do Supabase uma única vez.
-- ============================================================

create extension if not exists pgcrypto;

-- Usuários autorizados a administrar o site.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  singleton boolean not null default true unique check (singleton = true),
  created_at timestamptz not null default now()
);

-- Projetos publicados no portfólio.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'outros'
    check (category in ('musica','eventos','teatro','cultura','educacao','gravadora','outros')),
  status text not null default 'realizado'
    check (status in ('realizado','em_producao','proximo','arquivado')),
  summary text,
  description text,
  credits text,
  project_date date,
  cover_path text,
  audio_path text,
  gallery_paths text[] not null default '{}'::text[],
  video_url text,
  external_url text,
  external_label text,
  published boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Datas, eventos, lançamentos e disponibilidade.
create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text,
  description text,
  start_date date not null,
  end_date date,
  start_time time,
  location text,
  image_path text,
  external_url text,
  status text not null default 'confirmado'
    check (status in ('confirmado','em_producao','disponivel','realizado','cancelado')),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_end_after_start check (end_date is null or end_date >= start_date)
);

create index if not exists projects_public_order_idx
  on public.projects (published, featured desc, sort_order, project_date desc);

create index if not exists agenda_public_order_idx
  on public.agenda_events (published, start_date, start_time);

-- Atualiza updated_at automaticamente.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists agenda_set_updated_at on public.agenda_events;
create trigger agenda_set_updated_at
before update on public.agenda_events
for each row execute function public.set_updated_at();

-- Verifica se a sessão atual pertence ao único administrador autorizado.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Segurança das tabelas.
alter table public.admin_users enable row level security;
alter table public.projects enable row level security;
alter table public.agenda_events enable row level security;

-- Remove políticas antigas com o mesmo nome, permitindo reexecutar o arquivo.
drop policy if exists "Projetos publicados são públicos" on public.projects;
drop policy if exists "Admin cria projetos" on public.projects;
drop policy if exists "Admin edita projetos" on public.projects;
drop policy if exists "Admin exclui projetos" on public.projects;

drop policy if exists "Agenda publicada é pública" on public.agenda_events;
drop policy if exists "Admin cria agenda" on public.agenda_events;
drop policy if exists "Admin edita agenda" on public.agenda_events;
drop policy if exists "Admin exclui agenda" on public.agenda_events;

create policy "Projetos publicados são públicos"
on public.projects for select
to anon, authenticated
using (published = true or public.is_admin());

create policy "Admin cria projetos"
on public.projects for insert
to authenticated
with check (public.is_admin());

create policy "Admin edita projetos"
on public.projects for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admin exclui projetos"
on public.projects for delete
to authenticated
using (public.is_admin());

create policy "Agenda publicada é pública"
on public.agenda_events for select
to anon, authenticated
using (published = true or public.is_admin());

create policy "Admin cria agenda"
on public.agenda_events for insert
to authenticated
with check (public.is_admin());

create policy "Admin edita agenda"
on public.agenda_events for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admin exclui agenda"
on public.agenda_events for delete
to authenticated
using (public.is_admin());

-- Permissões de API, limitadas pelas políticas RLS acima.
grant select on public.projects, public.agenda_events to anon, authenticated;
grant insert, update, delete on public.projects, public.agenda_events to authenticated;
revoke all on public.admin_users from anon, authenticated;

-- Bucket público de imagens e áudio.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'apollus-media',
  'apollus-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas do Storage.
drop policy if exists "Mídia pública da Apollus" on storage.objects;
drop policy if exists "Admin envia mídia" on storage.objects;
drop policy if exists "Admin edita mídia" on storage.objects;
drop policy if exists "Admin exclui mídia" on storage.objects;

create policy "Mídia pública da Apollus"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'apollus-media');

create policy "Admin envia mídia"
on storage.objects for insert
to authenticated
with check (bucket_id = 'apollus-media' and public.is_admin());

create policy "Admin edita mídia"
on storage.objects for update
to authenticated
using (bucket_id = 'apollus-media' and public.is_admin())
with check (bucket_id = 'apollus-media' and public.is_admin());

create policy "Admin exclui mídia"
on storage.objects for delete
to authenticated
using (bucket_id = 'apollus-media' and public.is_admin());

-- ============================================================
-- ÚLTIMO PASSO MANUAL
-- 1. Em Authentication > Users, crie o único usuário administrador.
-- 2. Copie o UUID desse usuário.
-- 3. Execute a linha abaixo, trocando o texto pelo UUID real:
--
-- insert into public.admin_users (user_id)
-- values ('COLE-AQUI-O-UUID-DO-USUARIO')
-- on conflict (user_id) do nothing;
-- ============================================================


-- ============================================================
-- DASHBOARD V2 — ETAPAS E ATIVIDADE RECENTE
-- ============================================================
-- APOLLUS DASHBOARD V2
-- Execute uma vez no SQL Editor do Supabase.

alter table public.projects
  add column if not exists stage text not null default 'ideia';

-- Recria a validação de etapas com segurança.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'projects_stage_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects drop constraint projects_stage_check;
  end if;
end $$;

alter table public.projects
  add constraint projects_stage_check
  check (stage in ('ideia','planejamento','pre_producao','producao','pos_producao','finalizado','publicado'));

-- Ajusta projetos já existentes para uma etapa coerente.
update public.projects
set stage = case
  when published = true then 'publicado'
  when status = 'realizado' then 'finalizado'
  when status = 'em_producao' then 'producao'
  else 'ideia'
end
where stage is null or stage = 'ideia';

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  action text not null check (action in ('inserted','updated','deleted','published')),
  entity_type text not null check (entity_type in ('project','agenda')),
  entity_id uuid,
  entity_title text,
  user_id uuid,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "Admin vê atividade" on public.activity_log;
create policy "Admin vê atividade"
on public.activity_log for select
to authenticated
using (public.is_admin());

grant select on public.activity_log to authenticated;

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
  item_type := case when tg_table_name = 'projects' then 'project' else 'agenda' end;
  item_id := coalesce(new.id, old.id);
  item_title := coalesce(new.title, old.title);

  if tg_op = 'INSERT' then
    item_action := 'inserted';
  elsif tg_op = 'DELETE' then
    item_action := 'deleted';
  elsif tg_table_name = 'projects' and old.published is distinct from new.published and new.published = true then
    item_action := 'published';
  else
    item_action := 'updated';
  end if;

  insert into public.activity_log (action, entity_type, entity_id, entity_title, user_id)
  values (item_action, item_type, item_id, item_title, auth.uid());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_activity_log on public.projects;
create trigger projects_activity_log
after insert or update or delete on public.projects
for each row execute function public.log_apollus_activity();

drop trigger if exists agenda_activity_log on public.agenda_events;
create trigger agenda_activity_log
after insert or update or delete on public.agenda_events
for each row execute function public.log_apollus_activity();
