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
