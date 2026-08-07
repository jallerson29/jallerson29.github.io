-- ============================================================
-- APOLLUS — FINANCEIRO SEGURO + PERFIS E ACESSOS V1
-- Execute uma única vez no SQL Editor do Supabase.
-- Pré-requisitos: setup.sql, dashboard-v2.sql, playlists-v1.sql,
-- meetings-v1.sql, history-v1.sql, trash-v1.sql, settings-v1.sql
-- e presave-v1.sql já executados.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. PERFIS E PERMISSÕES
-- ------------------------------------------------------------

alter table public.admin_users
  drop constraint if exists admin_users_singleton_key;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  role text not null default 'custom'
    check (role in ('owner','admin','editor','finance','custom')),
  active boolean not null default true,
  require_mfa boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_user_permissions (
  user_id uuid not null references public.admin_profiles(user_id) on delete cascade,
  permission_key text not null,
  allowed boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

create index if not exists admin_profiles_active_idx
  on public.admin_profiles (active, role);

create index if not exists admin_permissions_key_idx
  on public.admin_user_permissions (permission_key, allowed);

-- Jallerson é o proprietário imutável do painel.
insert into public.admin_profiles (
  user_id, display_name, email, role, active, require_mfa
) values
  ('e4028402-dced-4131-a468-0ee86baf7d49', 'Jallerson', 'jallerson29@gmail.com', 'owner', true, true),
  ('73994e6c-94e5-4957-b818-74a79d34a4fa', 'Bella', 'bellamsx@gmail.com', 'admin', true, false),
  ('78e49710-16f6-4f38-9662-32edde5025ad', 'Liriel', 'lirielgmoraes@yahoo.com', 'admin', true, false),
  ('158fa2f4-99c9-453d-b2b5-a3d2932f04c5', 'Ju Paganotto', 'paganottoju@gmail.com', 'editor', true, false)
on conflict (user_id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  role = case when public.admin_profiles.user_id = 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid then 'owner' else public.admin_profiles.role end,
  active = true,
  require_mfa = case when public.admin_profiles.user_id = 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid then true else public.admin_profiles.require_mfa end,
  updated_at = now();

insert into public.admin_users (user_id)
select user_id from public.admin_profiles where active = true
on conflict (user_id) do nothing;

-- Corrige e sincroniza o diretório usado pelas reuniões e pelo histórico.
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
select user_id, display_name, email, active
from public.admin_profiles
on conflict (user_id) do update set
  name = excluded.name,
  email = excluded.email,
  active = excluded.active,
  updated_at = now();

-- Catálogo lógico de permissões usado pela aplicação.
-- O proprietário recebe tudo; os demais preservam o acesso atual ao conteúdo,
-- mas não recebem Financeiro nem administração de usuários.
with permission_keys(permission_key) as (
  values
    ('projects.view'), ('projects.edit'), ('projects.delete'),
    ('agenda.view'), ('agenda.edit'), ('agenda.delete'),
    ('playlists.view'), ('playlists.edit'), ('playlists.delete'),
    ('presaves.view'), ('presaves.edit'), ('presaves.delete'),
    ('history.view'),
    ('trash.view'), ('trash.restore'), ('trash.delete'),
    ('settings.view'), ('settings.edit'),
    ('finance.view'), ('finance.edit'), ('finance.delete'),
    ('finance.export'), ('finance.invoice'),
    ('users.manage')
)
insert into public.admin_user_permissions (user_id, permission_key, allowed)
select 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid, permission_key, true
from permission_keys
on conflict (user_id, permission_key) do update set allowed = true, updated_at = now();

with content_permissions(permission_key) as (
  values
    ('projects.view'), ('projects.edit'), ('projects.delete'),
    ('agenda.view'), ('agenda.edit'), ('agenda.delete'),
    ('playlists.view'), ('playlists.edit'), ('playlists.delete'),
    ('presaves.view'), ('presaves.edit'), ('presaves.delete'),
    ('history.view'),
    ('trash.view'), ('trash.restore'), ('trash.delete'),
    ('settings.view'), ('settings.edit')
), non_owner_users(user_id) as (
  values
    ('73994e6c-94e5-4957-b818-74a79d34a4fa'::uuid),
    ('78e49710-16f6-4f38-9662-32edde5025ad'::uuid),
    ('158fa2f4-99c9-453d-b2b5-a3d2932f04c5'::uuid)
)
insert into public.admin_user_permissions (user_id, permission_key, allowed)
select users.user_id, permissions.permission_key, true
from non_owner_users users
cross join content_permissions permissions
on conflict (user_id, permission_key) do nothing;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() = 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid
    and exists (
      select 1
      from public.admin_profiles profile
      where profile.user_id = auth.uid()
        and profile.active = true
        and profile.role = 'owner'
    );
$$;

create or replace function public.owner_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner()
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.has_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = auth.uid()
      and profile.active = true
      and (
        profile.role = 'owner'
        or exists (
          select 1
          from public.admin_user_permissions permission
          where permission.user_id = profile.user_id
            and permission.permission_key = requested_permission
            and permission.allowed = true
        )
      )
  );
$$;

create or replace function public.finance_access(requested_permission text default 'finance.view')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission(requested_permission)
    and exists (
      select 1
      from public.admin_profiles profile
      where profile.user_id = auth.uid()
        and profile.active = true
        and (
          profile.require_mfa = false
          or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        )
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = auth.uid()
      and profile.active = true
  );
$$;

revoke all on function public.is_owner() from public;
revoke all on function public.owner_access() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.finance_access(text) from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.owner_access() to authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.finance_access(text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.sync_admin_profile_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.admin_users where user_id = old.user_id;
    update public.admin_contacts set active = false, updated_at = now() where user_id = old.user_id;
    return old;
  end if;

  if new.user_id = 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid then
    new.role := 'owner';
    new.active := true;
    new.require_mfa := true;
  end if;

  insert into public.admin_contacts (user_id, name, email, active)
  values (new.user_id, new.display_name, new.email, new.active)
  on conflict (user_id) do update set
    name = excluded.name,
    email = excluded.email,
    active = excluded.active,
    updated_at = now();

  if new.active then
    insert into public.admin_users (user_id) values (new.user_id)
    on conflict (user_id) do nothing;
  else
    delete from public.admin_users where user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

drop trigger if exists admin_profiles_sync_directory on public.admin_profiles;
create trigger admin_profiles_sync_directory
before insert or update or delete on public.admin_profiles
for each row execute function public.sync_admin_profile_directory();

alter table public.admin_profiles enable row level security;
alter table public.admin_user_permissions enable row level security;

drop policy if exists "Perfil próprio ou proprietário visualiza perfis" on public.admin_profiles;
drop policy if exists "Somente proprietário cria perfis" on public.admin_profiles;
drop policy if exists "Somente proprietário edita perfis" on public.admin_profiles;
drop policy if exists "Somente proprietário exclui perfis" on public.admin_profiles;
drop policy if exists "Permissões próprias ou proprietário visualiza" on public.admin_user_permissions;
drop policy if exists "Somente proprietário cria permissões" on public.admin_user_permissions;
drop policy if exists "Somente proprietário edita permissões" on public.admin_user_permissions;
drop policy if exists "Somente proprietário exclui permissões" on public.admin_user_permissions;

create policy "Perfil próprio ou proprietário visualiza perfis"
on public.admin_profiles for select
to authenticated
using (user_id = auth.uid() or public.is_owner());

create policy "Somente proprietário cria perfis"
on public.admin_profiles for insert
to authenticated
with check (public.owner_access());

create policy "Somente proprietário edita perfis"
on public.admin_profiles for update
to authenticated
using (public.owner_access())
with check (
  public.owner_access()
  and (
    user_id <> 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid
    or (role = 'owner' and active = true and require_mfa = true)
  )
);

create policy "Somente proprietário exclui perfis"
on public.admin_profiles for delete
to authenticated
using (
  public.owner_access()
  and user_id <> 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid
);

create policy "Permissões próprias ou proprietário visualiza"
on public.admin_user_permissions for select
to authenticated
using (user_id = auth.uid() or public.is_owner());

create policy "Somente proprietário cria permissões"
on public.admin_user_permissions for insert
to authenticated
with check (public.owner_access());

create policy "Somente proprietário edita permissões"
on public.admin_user_permissions for update
to authenticated
using (public.owner_access())
with check (public.owner_access());

create policy "Somente proprietário exclui permissões"
on public.admin_user_permissions for delete
to authenticated
using (
  public.owner_access()
  and user_id <> 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid
);

grant select on public.admin_profiles, public.admin_user_permissions to authenticated;
grant insert, update, delete on public.admin_profiles, public.admin_user_permissions to authenticated;
revoke all on public.admin_profiles, public.admin_user_permissions from anon;

-- ------------------------------------------------------------
-- 2. FINANCEIRO
-- ------------------------------------------------------------

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('receita','despesa')),
  description text not null,
  category text not null default 'outros',
  amount_total numeric(14,2) not null check (amount_total > 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  competence_date date not null default current_date,
  due_date date not null,
  status text not null default 'pendente'
    check (status in ('pendente','parcial','recebido','pago','atrasado','cancelado')),
  partner_name text,
  partner_document text,
  payment_method text,
  project_id uuid references public.projects(id) on delete set null,
  notes text,
  invoice_required boolean not null default false,
  invoice_status text not null default 'nao_necessaria'
    check (invoice_status in ('nao_necessaria','pendente','emitida','cancelada','substituida')),
  invoice_number text,
  invoice_issue_date date,
  invoice_competence date,
  invoice_customer text,
  invoice_customer_document text,
  invoice_service text,
  invoice_taxation_code text,
  invoice_nbs_item text,
  invoice_city text not null default 'Curitiba-PR',
  invoice_amount numeric(14,2),
  invoice_document_url text check (invoice_document_url is null or invoice_document_url ~* '^https?://'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_by_name text,
  deleted_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_paid_not_above_total check (amount_paid <= amount_total)
);

create table if not exists public.financial_installments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.financial_entries(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  status text not null default 'pendente'
    check (status in ('pendente','parcial','pago','recebido','atrasado','cancelado')),
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, installment_number),
  constraint installment_paid_not_above_amount check (amount_paid <= amount)
);

create table if not exists public.financial_payments (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.financial_installments(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists financial_entries_period_idx
  on public.financial_entries (competence_date desc, entry_type, status)
  where deleted_at is null;

create index if not exists financial_entries_due_idx
  on public.financial_entries (due_date, status)
  where deleted_at is null;

create index if not exists financial_entries_invoice_idx
  on public.financial_entries (invoice_required, invoice_status, invoice_issue_date)
  where deleted_at is null;

create index if not exists financial_entries_project_idx
  on public.financial_entries (project_id)
  where deleted_at is null;

create index if not exists financial_entries_deleted_idx
  on public.financial_entries (deleted_at desc)
  where deleted_at is not null;

create index if not exists financial_installments_entry_idx
  on public.financial_installments (entry_id, installment_number);

create index if not exists financial_installments_due_idx
  on public.financial_installments (due_date, status);

create index if not exists financial_payments_installment_idx
  on public.financial_payments (installment_id, payment_date desc);

drop trigger if exists financial_entries_set_updated_at on public.financial_entries;
create trigger financial_entries_set_updated_at
before update on public.financial_entries
for each row execute function public.set_updated_at();

drop trigger if exists financial_installments_set_updated_at on public.financial_installments;
create trigger financial_installments_set_updated_at
before update on public.financial_installments
for each row execute function public.set_updated_at();

create or replace function public.create_financial_installments(
  p_entry_id uuid,
  p_count integer,
  p_first_due_date date,
  p_interval_months integer default 1
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry_total numeric(14,2);
  base_amount numeric(14,2);
  last_amount numeric(14,2);
  position integer;
begin
  if not public.finance_access('finance.edit') then
    raise exception 'Acesso financeiro insuficiente.';
  end if;

  if p_count < 1 or p_count > 120 then
    raise exception 'Quantidade de parcelas inválida.';
  end if;

  if p_interval_months < 0 or p_interval_months > 24 then
    raise exception 'Intervalo de parcelas inválido.';
  end if;

  select amount_total into entry_total
  from public.financial_entries
  where id = p_entry_id and deleted_at is null;

  if entry_total is null then
    raise exception 'Lançamento financeiro não encontrado.';
  end if;

  if exists (
    select 1 from public.financial_installments where entry_id = p_entry_id
  ) then
    raise exception 'Este lançamento já possui parcelas.';
  end if;

  base_amount := trunc((entry_total / p_count)::numeric, 2);
  last_amount := entry_total - (base_amount * (p_count - 1));

  for position in 1..p_count loop
    insert into public.financial_installments (
      entry_id, installment_number, due_date, amount
    ) values (
      p_entry_id,
      position,
      p_first_due_date + make_interval(months => (position - 1) * p_interval_months),
      case when position = p_count then last_amount else base_amount end
    );
  end loop;
end;
$$;

create or replace function public.sync_financial_payment_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_installment uuid;
  target_entry uuid;
  installment_total numeric(14,2);
  installment_paid numeric(14,2);
  entry_total numeric(14,2);
  entry_paid numeric(14,2);
  entry_type_value text;
  entry_due_date date;
begin
  target_installment := case when tg_op = 'DELETE' then old.installment_id else new.installment_id end;

  select installment.entry_id, installment.amount
    into target_entry, installment_total
  from public.financial_installments installment
  where installment.id = target_installment;

  if target_entry is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select coalesce(sum(payment.amount), 0)
    into installment_paid
  from public.financial_payments payment
  where payment.installment_id = target_installment;

  if installment_paid > installment_total then
    raise exception 'O total pago não pode superar o valor da parcela.';
  end if;

  update public.financial_installments
  set amount_paid = installment_paid,
      paid_at = case when installment_paid >= installment_total then current_date else null end,
      status = case
        when installment_paid >= installment_total then
          case when (select entry_type from public.financial_entries where id = target_entry) = 'receita' then 'recebido' else 'pago' end
        when installment_paid > 0 then 'parcial'
        when due_date < current_date then 'atrasado'
        else 'pendente'
      end,
      updated_at = now()
  where id = target_installment;

  select entry.amount_total, entry.entry_type, entry.due_date
    into entry_total, entry_type_value, entry_due_date
  from public.financial_entries entry
  where entry.id = target_entry;

  select coalesce(sum(installment.amount_paid), 0)
    into entry_paid
  from public.financial_installments installment
  where installment.entry_id = target_entry;

  update public.financial_entries
  set amount_paid = entry_paid,
      status = case
        when status = 'cancelado' then 'cancelado'
        when entry_paid >= entry_total then case when entry_type_value = 'receita' then 'recebido' else 'pago' end
        when entry_paid > 0 then 'parcial'
        when entry_due_date < current_date then 'atrasado'
        else 'pendente'
      end,
      updated_at = now()
  where id = target_entry;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists financial_payments_sync_totals on public.financial_payments;
create trigger financial_payments_sync_totals
after insert or update or delete on public.financial_payments
for each row execute function public.sync_financial_payment_totals();

revoke all on function public.create_financial_installments(uuid, integer, date, integer) from public;
grant execute on function public.create_financial_installments(uuid, integer, date, integer) to authenticated;


create or replace function public.protect_financial_invoice_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.invoice_required = true and not public.finance_access('finance.invoice') then
      raise exception 'Você não possui permissão para controlar notas fiscais.';
    end if;
  elsif (
    old.invoice_required,
    old.invoice_status,
    old.invoice_number,
    old.invoice_issue_date,
    old.invoice_competence,
    old.invoice_customer,
    old.invoice_customer_document,
    old.invoice_service,
    old.invoice_taxation_code,
    old.invoice_nbs_item,
    old.invoice_city,
    old.invoice_amount,
    old.invoice_document_url
  ) is distinct from (
    new.invoice_required,
    new.invoice_status,
    new.invoice_number,
    new.invoice_issue_date,
    new.invoice_competence,
    new.invoice_customer,
    new.invoice_customer_document,
    new.invoice_service,
    new.invoice_taxation_code,
    new.invoice_nbs_item,
    new.invoice_city,
    new.invoice_amount,
    new.invoice_document_url
  ) and not public.finance_access('finance.invoice') then
    raise exception 'Você não possui permissão para alterar notas fiscais.';
  end if;
  return new;
end;
$$;

drop trigger if exists financial_entries_protect_invoice on public.financial_entries;
create trigger financial_entries_protect_invoice
before insert or update on public.financial_entries
for each row execute function public.protect_financial_invoice_fields();

alter table public.financial_entries enable row level security;
alter table public.financial_installments enable row level security;
alter table public.financial_payments enable row level security;

drop policy if exists "Financeiro visualiza lançamentos" on public.financial_entries;
drop policy if exists "Financeiro cria lançamentos" on public.financial_entries;
drop policy if exists "Financeiro edita lançamentos" on public.financial_entries;
drop policy if exists "Financeiro exclui lançamentos" on public.financial_entries;
drop policy if exists "Financeiro visualiza parcelas" on public.financial_installments;
drop policy if exists "Financeiro cria parcelas" on public.financial_installments;
drop policy if exists "Financeiro edita parcelas" on public.financial_installments;
drop policy if exists "Financeiro exclui parcelas" on public.financial_installments;
drop policy if exists "Financeiro visualiza pagamentos" on public.financial_payments;
drop policy if exists "Financeiro cria pagamentos" on public.financial_payments;
drop policy if exists "Financeiro edita pagamentos" on public.financial_payments;
drop policy if exists "Financeiro exclui pagamentos" on public.financial_payments;

create policy "Financeiro visualiza lançamentos"
on public.financial_entries for select
to authenticated
using (public.finance_access('finance.view'));

create policy "Financeiro cria lançamentos"
on public.financial_entries for insert
to authenticated
with check (public.finance_access('finance.edit'));

create policy "Financeiro edita lançamentos"
on public.financial_entries for update
to authenticated
using (public.finance_access('finance.edit'))
with check (public.finance_access('finance.edit'));

create policy "Financeiro exclui lançamentos"
on public.financial_entries for delete
to authenticated
using (public.finance_access('finance.delete'));

create policy "Financeiro visualiza parcelas"
on public.financial_installments for select
to authenticated
using (public.finance_access('finance.view'));

create policy "Financeiro cria parcelas"
on public.financial_installments for insert
to authenticated
with check (public.finance_access('finance.edit'));

create policy "Financeiro edita parcelas"
on public.financial_installments for update
to authenticated
using (public.finance_access('finance.edit'))
with check (public.finance_access('finance.edit'));

create policy "Financeiro exclui parcelas"
on public.financial_installments for delete
to authenticated
using (public.finance_access('finance.delete'));

create policy "Financeiro visualiza pagamentos"
on public.financial_payments for select
to authenticated
using (public.finance_access('finance.view'));

create policy "Financeiro cria pagamentos"
on public.financial_payments for insert
to authenticated
with check (public.finance_access('finance.edit'));

create policy "Financeiro edita pagamentos"
on public.financial_payments for update
to authenticated
using (public.finance_access('finance.edit'))
with check (public.finance_access('finance.edit'));

create policy "Financeiro exclui pagamentos"
on public.financial_payments for delete
to authenticated
using (public.finance_access('finance.delete'));

grant select, insert, update, delete on public.financial_entries to authenticated;
grant select, insert, update, delete on public.financial_installments to authenticated;
grant select, insert, update, delete on public.financial_payments to authenticated;
revoke all on public.financial_entries, public.financial_installments, public.financial_payments from anon;

-- ------------------------------------------------------------
-- 3. APLICA PERMISSÕES NOS MÓDULOS EXISTENTES
-- ------------------------------------------------------------

-- Projetos.
drop policy if exists "Projetos publicados são públicos" on public.projects;
drop policy if exists "Admin cria projetos" on public.projects;
drop policy if exists "Admin edita projetos" on public.projects;
drop policy if exists "Admin exclui projetos" on public.projects;

create policy "Projetos publicados são públicos"
on public.projects for select
to anon, authenticated
using ((deleted_at is null and published = true) or public.has_permission('projects.view'));

create policy "Admin cria projetos"
on public.projects for insert
to authenticated
with check (public.has_permission('projects.edit'));

create policy "Admin edita projetos"
on public.projects for update
to authenticated
using (public.has_permission('projects.edit'))
with check (public.has_permission('projects.edit'));

create policy "Admin exclui projetos"
on public.projects for delete
to authenticated
using (public.has_permission('projects.delete'));

-- Agenda.
drop policy if exists "Agenda publicada é pública" on public.agenda_events;
drop policy if exists "Admin cria agenda" on public.agenda_events;
drop policy if exists "Admin edita agenda" on public.agenda_events;
drop policy if exists "Admin exclui agenda" on public.agenda_events;

create policy "Agenda publicada é pública"
on public.agenda_events for select
to anon, authenticated
using ((deleted_at is null and published = true) or public.has_permission('agenda.view'));

create policy "Admin cria agenda"
on public.agenda_events for insert
to authenticated
with check (public.has_permission('agenda.edit'));

create policy "Admin edita agenda"
on public.agenda_events for update
to authenticated
using (public.has_permission('agenda.edit'))
with check (public.has_permission('agenda.edit'));

create policy "Admin exclui agenda"
on public.agenda_events for delete
to authenticated
using (public.has_permission('agenda.delete'));

-- Playlists.
drop policy if exists "Playlists publicadas são públicas" on public.streaming_playlists;
drop policy if exists "Admin cria playlists" on public.streaming_playlists;
drop policy if exists "Admin edita playlists" on public.streaming_playlists;
drop policy if exists "Admin exclui playlists" on public.streaming_playlists;

create policy "Playlists publicadas são públicas"
on public.streaming_playlists for select
to anon, authenticated
using ((deleted_at is null and published = true) or public.has_permission('playlists.view'));

create policy "Admin cria playlists"
on public.streaming_playlists for insert
to authenticated
with check (public.has_permission('playlists.edit'));

create policy "Admin edita playlists"
on public.streaming_playlists for update
to authenticated
using (public.has_permission('playlists.edit'))
with check (public.has_permission('playlists.edit'));

create policy "Admin exclui playlists"
on public.streaming_playlists for delete
to authenticated
using (public.has_permission('playlists.delete'));

-- Pré-save.
drop policy if exists "Pré-saves publicados são públicos" on public.presave_campaigns;
drop policy if exists "Admin cria pré-saves" on public.presave_campaigns;
drop policy if exists "Admin edita pré-saves" on public.presave_campaigns;
drop policy if exists "Admin exclui pré-saves" on public.presave_campaigns;

create policy "Pré-saves publicados são públicos"
on public.presave_campaigns for select
to anon, authenticated
using ((deleted_at is null and published = true) or public.has_permission('presaves.view'));

create policy "Admin cria pré-saves"
on public.presave_campaigns for insert
to authenticated
with check (public.has_permission('presaves.edit'));

create policy "Admin edita pré-saves"
on public.presave_campaigns for update
to authenticated
using (public.has_permission('presaves.edit'))
with check (public.has_permission('presaves.edit'));

create policy "Admin exclui pré-saves"
on public.presave_campaigns for delete
to authenticated
using (public.has_permission('presaves.delete'));

-- Histórico.
drop policy if exists "Admin vê atividade" on public.activity_log;
drop policy if exists "Administradores visualizam histórico" on public.activity_log;
create policy "Administradores visualizam histórico"
on public.activity_log for select
to authenticated
using (
  public.has_permission('history.view')
  and (
    entity_type not in ('finance','profile')
    or (entity_type = 'finance' and public.finance_access('finance.view'))
    or (entity_type = 'profile' and public.owner_access())
  )
);

-- Configurações públicas continuam visíveis; edição exige permissão.
drop policy if exists "Admin cria configurações" on public.site_settings;
drop policy if exists "Admin edita configurações" on public.site_settings;
create policy "Admin cria configurações"
on public.site_settings for insert
to authenticated
with check (public.has_permission('settings.edit'));
create policy "Admin edita configurações"
on public.site_settings for update
to authenticated
using (public.has_permission('settings.edit'))
with check (public.has_permission('settings.edit'));

-- Contatos e convites de reunião.
drop policy if exists "Admin visualiza contatos" on public.admin_contacts;
drop policy if exists "Admin visualiza convites" on public.meeting_invites;
drop policy if exists "Admin cria convites" on public.meeting_invites;
drop policy if exists "Admin edita convites" on public.meeting_invites;
drop policy if exists "Admin exclui convites" on public.meeting_invites;

create policy "Admin visualiza contatos"
on public.admin_contacts for select
to authenticated
using (public.has_permission('agenda.view') or public.is_owner());

create policy "Admin visualiza convites"
on public.meeting_invites for select
to authenticated
using (public.has_permission('agenda.view'));

create policy "Admin cria convites"
on public.meeting_invites for insert
to authenticated
with check (public.has_permission('agenda.edit'));

create policy "Admin edita convites"
on public.meeting_invites for update
to authenticated
using (public.has_permission('agenda.edit'))
with check (public.has_permission('agenda.edit'));

create policy "Admin exclui convites"
on public.meeting_invites for delete
to authenticated
using (public.has_permission('agenda.delete'));

-- Storage: a pasta do arquivo determina a permissão necessária.
drop policy if exists "Admin envia mídia" on storage.objects;
drop policy if exists "Admin edita mídia" on storage.objects;
drop policy if exists "Admin exclui mídia" on storage.objects;

create policy "Admin envia mídia"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'apollus-media'
  and (
    (name like 'projects/%' and public.has_permission('projects.edit'))
    or (name like 'agenda/%' and public.has_permission('agenda.edit'))
    or (name like 'playlists/%' and public.has_permission('playlists.edit'))
    or (name like 'presaves/%' and public.has_permission('presaves.edit'))
  )
);

create policy "Admin edita mídia"
on storage.objects for update
to authenticated
using (
  bucket_id = 'apollus-media'
  and (
    (name like 'projects/%' and public.has_permission('projects.edit'))
    or (name like 'agenda/%' and public.has_permission('agenda.edit'))
    or (name like 'playlists/%' and public.has_permission('playlists.edit'))
    or (name like 'presaves/%' and public.has_permission('presaves.edit'))
  )
)
with check (
  bucket_id = 'apollus-media'
  and (
    (name like 'projects/%' and public.has_permission('projects.edit'))
    or (name like 'agenda/%' and public.has_permission('agenda.edit'))
    or (name like 'playlists/%' and public.has_permission('playlists.edit'))
    or (name like 'presaves/%' and public.has_permission('presaves.edit'))
  )
);

create policy "Admin exclui mídia"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'apollus-media'
  and (
    (name like 'projects/%' and public.has_permission('projects.delete'))
    or (name like 'agenda/%' and public.has_permission('agenda.delete'))
    or (name like 'playlists/%' and public.has_permission('playlists.delete'))
    or (name like 'presaves/%' and public.has_permission('presaves.delete'))
  )
);

-- ------------------------------------------------------------
-- 4. HISTÓRICO DETALHADO DO FINANCEIRO E DOS PERFIS
-- ------------------------------------------------------------

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
  check (entity_type in ('project','agenda','playlist','presave','settings','finance','profile'));

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
    when tg_table_name = 'financial_entries' then 'finance'
    else null
  end;

  if item_type is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  item_id := coalesce(new.id, old.id);
  item_title := case
    when item_type = 'presave' then concat_ws(' — ', coalesce(new_json ->> 'artist_name', old_json ->> 'artist_name'), coalesce(new_json ->> 'title', old_json ->> 'title'))
    when item_type = 'finance' then coalesce(new_json ->> 'description', old_json ->> 'description', 'Lançamento financeiro')
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
    if coalesce((new_json ->> 'published')::boolean, false) then item_action := 'published'; else item_action := 'unpublished'; end if;
  else
    item_action := 'updated';
  end if;

  select profile.display_name, profile.email
    into admin_name, admin_email
  from public.admin_profiles profile
  where profile.user_id = auth.uid();

  if admin_email is null then
    select users.email into admin_email
    from auth.users users
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

drop trigger if exists financial_entries_activity_log on public.financial_entries;
create trigger financial_entries_activity_log
after insert or update or delete on public.financial_entries
for each row execute function public.log_apollus_activity();

-- Recria também os gatilhos existentes com a função ampliada.
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
