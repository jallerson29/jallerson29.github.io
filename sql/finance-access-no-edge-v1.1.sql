-- ============================================================
-- APOLLUS — ACESSOS SEM EDGE FUNCTION V1.1
-- Execute depois de finance-access-v1.sql, caso a V1 já esteja instalada.
-- Esta migração permite ao proprietário administrar os perfis do painel
-- diretamente pelo PostgreSQL/RLS, sem service_role no navegador.
-- Contas de login continuam sendo criadas/removidas manualmente em:
-- Supabase → Authentication → Users.
-- ============================================================

begin;

-- O catálogo abaixo é usado para validar permissões recebidas pelo painel.
create or replace function public.is_valid_admin_permission(permission_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select permission_name = any(array[
    'projects.view','projects.edit','projects.delete',
    'agenda.view','agenda.edit','agenda.delete',
    'playlists.view','playlists.edit','playlists.delete',
    'presaves.view','presaves.edit','presaves.delete',
    'history.view',
    'trash.view','trash.restore','trash.delete',
    'settings.view','settings.edit',
    'finance.view','finance.edit','finance.delete','finance.export','finance.invoice'
  ]::text[]);
$$;

-- Salva ou vincula um perfil administrativo a um usuário que JÁ existe
-- em Authentication → Users. A operação é atômica e exclusiva do owner.
create or replace function public.owner_save_admin_profile(
  target_user_id uuid,
  target_display_name text,
  target_email text,
  target_role text default 'custom',
  target_active boolean default true,
  target_require_mfa boolean default false,
  target_permissions text[] default array[]::text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id constant uuid := 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid;
  normalized_role text;
  normalized_email text;
  must_require_mfa boolean;
  normalized_active boolean;
begin
  if not public.owner_access() then
    raise exception 'Somente o proprietário com MFA confirmado pode alterar perfis.';
  end if;

  if target_user_id is null then
    raise exception 'Informe o UID do usuário do Supabase Authentication.';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'Esse UID não existe em Authentication → Users.';
  end if;

  if nullif(trim(target_display_name), '') is null then
    raise exception 'Informe o nome do perfil.';
  end if;

  normalized_email := lower(trim(coalesce(target_email, '')));
  if normalized_email = '' then
    raise exception 'Informe o e-mail do perfil.';
  end if;

  -- Evita cadastrar por engano um e-mail diferente do login real.
  if not exists (
    select 1 from auth.users u
    where u.id = target_user_id
      and lower(coalesce(u.email, '')) = normalized_email
  ) then
    raise exception 'O e-mail informado não corresponde ao login desse UID no Supabase.';
  end if;

  normalized_role := lower(coalesce(target_role, 'custom'));
  if normalized_role not in ('admin','editor','finance','custom','owner') then
    raise exception 'Perfil-base inválido.';
  end if;

  normalized_active := target_active;

  if target_user_id = owner_id then
    normalized_role := 'owner';
    normalized_active := true;
    target_require_mfa := true;
  elsif normalized_role = 'owner' then
    raise exception 'O perfil proprietário não pode ser transferido.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(target_permissions, array[]::text[])) p(permission_key)
    where not public.is_valid_admin_permission(p.permission_key)
  ) then
    raise exception 'Uma ou mais permissões são inválidas.';
  end if;

  must_require_mfa := target_require_mfa or exists (
    select 1
    from unnest(coalesce(target_permissions, array[]::text[])) p(permission_key)
    where p.permission_key like 'finance.%'
  );

  insert into public.admin_profiles (
    user_id, display_name, email, role, active, require_mfa,
    created_by, updated_by
  ) values (
    target_user_id, trim(target_display_name), normalized_email,
    normalized_role, normalized_active, must_require_mfa,
    auth.uid(), auth.uid()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    role = case when public.admin_profiles.user_id = owner_id then 'owner' else excluded.role end,
    active = case when public.admin_profiles.user_id = owner_id then true else excluded.active end,
    require_mfa = case when public.admin_profiles.user_id = owner_id then true else excluded.require_mfa end,
    updated_by = auth.uid(),
    updated_at = now();

  if target_user_id <> owner_id then
    delete from public.admin_user_permissions
    where user_id = target_user_id;

    insert into public.admin_user_permissions (
      user_id, permission_key, allowed, updated_by
    )
    select
      target_user_id,
      distinct_permission.permission_key,
      true,
      auth.uid()
    from (
      select distinct p.permission_key
      from unnest(coalesce(target_permissions, array[]::text[])) p(permission_key)
      where public.is_valid_admin_permission(p.permission_key)
    ) distinct_permission;
  end if;
end;
$$;

-- Remove apenas o acesso ao painel. A conta Auth permanece intacta e pode
-- ser excluída manualmente no Supabase quando o proprietário desejar.
create or replace function public.owner_remove_admin_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id constant uuid := 'e4028402-dced-4131-a468-0ee86baf7d49'::uuid;
begin
  if not public.owner_access() then
    raise exception 'Somente o proprietário com MFA confirmado pode remover perfis.';
  end if;

  if target_user_id is null then
    raise exception 'Perfil inválido.';
  end if;

  if target_user_id = owner_id then
    raise exception 'O proprietário não pode ser removido.';
  end if;

  delete from public.admin_profiles
  where user_id = target_user_id;
end;
$$;


-- Registra alterações de perfis no Histórico sem expor dados financeiros.
create or replace function public.log_admin_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_json jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_json jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  target_id uuid;
  target_name text;
  item_action text;
  actor_name text;
  actor_email text;
begin
  if tg_op = 'INSERT' then
    target_id := new.user_id;
    target_name := coalesce(new.display_name, 'Perfil administrativo');
    item_action := 'inserted';
  elsif tg_op = 'DELETE' then
    target_id := old.user_id;
    target_name := coalesce(old.display_name, 'Perfil administrativo');
    item_action := 'deleted';
  else
    target_id := new.user_id;
    target_name := coalesce(new.display_name, old.display_name, 'Perfil administrativo');
    item_action := 'updated';
  end if;

  select p.display_name, p.email
    into actor_name, actor_email
  from public.admin_profiles p
  where p.user_id = auth.uid();

  insert into public.activity_log (
    action, entity_type, entity_id, entity_title, user_id,
    actor_name, actor_email, changes
  ) values (
    item_action, 'profile', target_id, target_name, auth.uid(),
    coalesce(actor_name, actor_email, 'Proprietário Apollus'),
    actor_email,
    public.activity_jsonb_diff(old_json, new_json)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists admin_profiles_activity_log on public.admin_profiles;
create trigger admin_profiles_activity_log
after insert or update or delete on public.admin_profiles
for each row execute function public.log_admin_profile_activity();

revoke all on function public.is_valid_admin_permission(text) from public;
revoke all on function public.owner_save_admin_profile(uuid,text,text,text,boolean,boolean,text[]) from public;
revoke all on function public.owner_remove_admin_profile(uuid) from public;

grant execute on function public.is_valid_admin_permission(text) to authenticated;
grant execute on function public.owner_save_admin_profile(uuid,text,text,text,boolean,boolean,text[]) to authenticated;
grant execute on function public.owner_remove_admin_profile(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
