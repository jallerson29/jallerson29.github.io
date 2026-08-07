-- ============================================================
-- APOLLUS — HISTÓRICO DETALHADO V1
-- Execute uma única vez no SQL Editor do Supabase.
-- Pré-requisitos: dashboard-v2.sql, playlists-v1.sql e meetings-v1.sql.
-- ============================================================

begin;

-- Garante o mapeamento correto da equipe para o histórico.
-- A remoção prévia evita conflito caso uma versão antiga tenha associado
-- os e-mails aos UUIDs errados.
delete from public.admin_contacts
where user_id in (
  '73994e6c-94e5-4957-b818-74a79d34a4fa',
  'e4028402-dced-4131-a468-0ee86baf7d49',
  '78e49710-16f6-4f38-9662-32edde5025ad',
  '158fa2f4-99c9-453d-b2b5-a3d2932f04c5'
)
or lower(email) in (
  'bellamsx@gmail.com',
  'jallerson29@gmail.com',
  'lirielgmoraes@yahoo.com',
  'paganottoju@gmail.com'
);

insert into public.admin_contacts (user_id, name, email, active)
values
  ('73994e6c-94e5-4957-b818-74a79d34a4fa', 'Bella', 'bellamsx@gmail.com', true),
  ('e4028402-dced-4131-a468-0ee86baf7d49', 'Jallerson', 'jallerson29@gmail.com', true),
  ('78e49710-16f6-4f38-9662-32edde5025ad', 'Liriel', 'lirielgmoraes@yahoo.com', true),
  ('158fa2f4-99c9-453d-b2b5-a3d2932f04c5', 'Ju Paganotto', 'paganottoju@gmail.com', true);

-- Mantém os convites já criados ligados aos destinatários corretos.
update public.meeting_invites
set invitee_name = case invitee_user_id
      when '73994e6c-94e5-4957-b818-74a79d34a4fa'::uuid then 'Bella'
      when 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid then 'Jallerson'
      when '78e49710-16f6-4f38-9662-32edde5025ad'::uuid then 'Liriel'
      when '158fa2f4-99c9-453d-b2b5-a3d2932f04c5'::uuid then 'Ju Paganotto'
      else invitee_name
    end,
    invitee_email = case invitee_user_id
      when '73994e6c-94e5-4957-b818-74a79d34a4fa'::uuid then 'bellamsx@gmail.com'
      when 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid then 'jallerson29@gmail.com'
      when '78e49710-16f6-4f38-9662-32edde5025ad'::uuid then 'lirielgmoraes@yahoo.com'
      when '158fa2f4-99c9-453d-b2b5-a3d2932f04c5'::uuid then 'paganottoju@gmail.com'
      else invitee_email
    end,
    updated_at = now()
where invitee_user_id in (
  '73994e6c-94e5-4957-b818-74a79d34a4fa',
  'e4028402-dced-4131-a468-0ee86baf7d49',
  '78e49710-16f6-4f38-9662-32edde5025ad',
  '158fa2f4-99c9-453d-b2b5-a3d2932f04c5'
);

alter table public.activity_log
  add column if not exists actor_name text,
  add column if not exists actor_email text,
  add column if not exists changes jsonb not null default '{}'::jsonb;

-- Amplia as ações aceitas para ocultação e futuras restaurações.
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
  check (action in ('inserted','updated','deleted','published','unpublished','restored'));

-- Mantém projetos, agenda e playlists como tipos rastreados.
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

create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);
create index if not exists activity_log_user_created_idx
  on public.activity_log (user_id, created_at desc);
create index if not exists activity_log_entity_created_idx
  on public.activity_log (entity_type, created_at desc);

-- Compara os campos do registro antes e depois, ignorando datas técnicas.
create or replace function public.activity_jsonb_diff(old_row jsonb, new_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with all_keys as (
    select key from jsonb_object_keys(coalesce(old_row, '{}'::jsonb)) as old_keys(key)
    union
    select key from jsonb_object_keys(coalesce(new_row, '{}'::jsonb)) as new_keys(key)
  ), changed as (
    select
      key,
      jsonb_build_object('old', old_row -> key, 'new', new_row -> key) as values
    from all_keys
    where key not in ('id', 'created_at', 'updated_at')
      and (old_row -> key) is distinct from (new_row -> key)
  )
  select coalesce(jsonb_object_agg(key, values), '{}'::jsonb)
  from changed;
$$;

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
    item_action := 'deleted';
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
    action,
    entity_type,
    entity_id,
    entity_title,
    user_id,
    actor_name,
    actor_email,
    changes
  ) values (
    item_action,
    item_type,
    item_id,
    item_title,
    auth.uid(),
    coalesce(admin_name, admin_email, 'Equipe Apollus'),
    admin_email,
    public.activity_jsonb_diff(old_json, new_json)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Recria os gatilhos usando o histórico detalhado.
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

-- Preenche nome e e-mail nos registros antigos quando possível.
update public.activity_log as activity
set
  actor_name = coalesce(activity.actor_name, contact.name),
  actor_email = coalesce(activity.actor_email, contact.email)
from public.admin_contacts as contact
where activity.user_id = contact.user_id
  and (activity.actor_name is null or activity.actor_email is null);

alter table public.activity_log enable row level security;
drop policy if exists "Admin vê atividade" on public.activity_log;
create policy "Admin vê atividade"
on public.activity_log for select
to authenticated
using (public.is_admin());

grant select on public.activity_log to authenticated;
revoke all on public.activity_log from anon;

commit;
notify pgrst, 'reload schema';
