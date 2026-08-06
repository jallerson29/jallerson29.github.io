-- ============================================================
-- APOLLUS — REUNIÕES E CONVITES POR E-MAIL V1
-- Execute uma única vez no SQL Editor do Supabase.
-- Pré-requisitos: setup.sql, dashboard-v2.sql e playlists-v1.sql.
-- ============================================================

begin;

-- O projeto originalmente aceitava somente um administrador.
-- Esta remoção mantém os quatro administradores autorizados.
alter table public.admin_users
  drop constraint if exists admin_users_singleton_key;

insert into public.admin_users (user_id)
values
  ('73994e6c-94e5-4957-b818-74a79d34a4fa'),
  ('e4028402-dced-4131-a468-0ee86baf7d49'),
  ('78e49710-16f6-4f38-9662-32edde5025ad'),
  ('158fa2f4-99c9-453d-b2b5-a3d2932f04c5')
on conflict (user_id) do nothing;

-- Diretório interno usado pelo formulário de convidados.
create table if not exists public.admin_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Remove somente estes quatro contatos antes de recriar o mapeamento.
-- Isso permite corrigir uma instalação anterior mesmo com o e-mail UNIQUE.
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

-- Campos específicos para reuniões.
alter table public.agenda_events
  add column if not exists is_meeting boolean not null default false,
  add column if not exists end_time time,
  add column if not exists timezone text not null default 'America/Sao_Paulo';

-- Evita uma reunião terminar antes de começar quando ocorre no mesmo dia.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'agenda_meeting_time_order_check'
      and conrelid = 'public.agenda_events'::regclass
  ) then
    alter table public.agenda_events drop constraint agenda_meeting_time_order_check;
  end if;
end $$;

alter table public.agenda_events
  add constraint agenda_meeting_time_order_check
  check (
    end_time is null
    or start_time is null
    or coalesce(end_date, start_date) > start_date
    or end_time > start_time
  );

-- Convites separados da agenda pública para não expor e-mails.
create table if not exists public.meeting_invites (
  id uuid primary key default gen_random_uuid(),
  agenda_event_id uuid not null references public.agenda_events(id) on delete cascade,
  invitee_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_name text not null,
  invitee_email text not null,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','sent','failed')),
  notified_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agenda_event_id, invitee_user_id)
);

create index if not exists meeting_invites_event_idx
  on public.meeting_invites (agenda_event_id);

create index if not exists meeting_invites_delivery_idx
  on public.meeting_invites (delivery_status, created_at desc);

-- Corrige também convites já criados com o mapeamento anterior.
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

-- updated_at automático.
drop trigger if exists admin_contacts_set_updated_at on public.admin_contacts;
create trigger admin_contacts_set_updated_at
before update on public.admin_contacts
for each row execute function public.set_updated_at();

drop trigger if exists meeting_invites_set_updated_at on public.meeting_invites;
create trigger meeting_invites_set_updated_at
before update on public.meeting_invites
for each row execute function public.set_updated_at();

-- Segurança: somente administradores autenticados veem contatos e convites.
alter table public.admin_contacts enable row level security;
alter table public.meeting_invites enable row level security;

drop policy if exists "Admin visualiza contatos" on public.admin_contacts;
drop policy if exists "Admin visualiza convites" on public.meeting_invites;
drop policy if exists "Admin cria convites" on public.meeting_invites;
drop policy if exists "Admin edita convites" on public.meeting_invites;
drop policy if exists "Admin exclui convites" on public.meeting_invites;

create policy "Admin visualiza contatos"
on public.admin_contacts for select
to authenticated
using (public.is_admin());

create policy "Admin visualiza convites"
on public.meeting_invites for select
to authenticated
using (public.is_admin());

create policy "Admin cria convites"
on public.meeting_invites for insert
to authenticated
with check (public.is_admin());

create policy "Admin edita convites"
on public.meeting_invites for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admin exclui convites"
on public.meeting_invites for delete
to authenticated
using (public.is_admin());

grant select on public.admin_contacts to authenticated;
grant select, insert, update, delete on public.meeting_invites to authenticated;
revoke all on public.admin_contacts, public.meeting_invites from anon;

commit;

notify pgrst, 'reload schema';
