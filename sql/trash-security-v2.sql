-- ============================================================
-- APOLLUS — LIXEIRA E PERMISSÕES V2 / STABLE 1
-- Data: 07/08/2026
--
-- Objetivos:
-- 1) separar EDITAR de MOVER PARA LIXEIRA;
-- 2) aplicar trash.view / trash.restore / trash.delete no banco;
-- 3) impedir UPDATE direto de deleted_at;
-- 4) impedir DELETE definitivo de item ativo;
-- 5) incluir Financeiro na Lixeira com MFA/AAL2;
-- 6) preservar histórico e triggers atuais.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. RPC: mover para a lixeira
-- ------------------------------------------------------------
create or replace function public.apollus_soft_delete(
  target_entity text,
  target_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  entity_key text := lower(trim(coalesce(target_entity, '')));
  actor_name text;
  actor_email text;
  affected integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select p.display_name, p.email
    into actor_name, actor_email
  from public.admin_profiles p
  where p.user_id = auth.uid()
    and p.active = true;

  if not found then
    raise exception 'Perfil administrativo inválido ou inativo.';
  end if;

  case entity_key
    when 'project' then
      if not public.has_permission('projects.delete') then
        raise exception 'Permissão projects.delete necessária.';
      end if;

      update public.projects
      set
        deleted_at = now(),
        deleted_by = auth.uid(),
        deleted_by_name = actor_name,
        deleted_by_email = actor_email,
        deleted_previous_published = published,
        published = false
      where id = target_id
        and deleted_at is null;

    when 'agenda' then
      if not public.has_permission('agenda.delete') then
        raise exception 'Permissão agenda.delete necessária.';
      end if;

      update public.agenda_events
      set
        deleted_at = now(),
        deleted_by = auth.uid(),
        deleted_by_name = actor_name,
        deleted_by_email = actor_email,
        deleted_previous_published = published,
        published = false
      where id = target_id
        and deleted_at is null;

    when 'playlist' then
      if not public.has_permission('playlists.delete') then
        raise exception 'Permissão playlists.delete necessária.';
      end if;

      update public.streaming_playlists
      set
        deleted_at = now(),
        deleted_by = auth.uid(),
        deleted_by_name = actor_name,
        deleted_by_email = actor_email,
        deleted_previous_published = published,
        published = false
      where id = target_id
        and deleted_at is null;

    when 'presave' then
      if not public.has_permission('presaves.delete') then
        raise exception 'Permissão presaves.delete necessária.';
      end if;

      update public.presave_campaigns
      set
        deleted_at = now(),
        deleted_by = auth.uid(),
        deleted_by_name = actor_name,
        deleted_by_email = actor_email,
        deleted_previous_published = published,
        published = false
      where id = target_id
        and deleted_at is null;

    when 'finance' then
      if not public.finance_access('finance.delete') then
        raise exception 'Permissão finance.delete e MFA confirmado são necessários.';
      end if;

      update public.financial_entries
      set
        deleted_at = now(),
        deleted_by = auth.uid(),
        deleted_by_name = actor_name,
        deleted_by_email = actor_email,
        updated_by = auth.uid()
      where id = target_id
        and deleted_at is null;

    else
      raise exception 'Tipo de item inválido.';
  end case;

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Item não encontrado ou já está na lixeira.';
  end if;

  return true;
end;
$function$;


-- ------------------------------------------------------------
-- 2. RPC: restaurar
-- ------------------------------------------------------------
create or replace function public.apollus_restore(
  target_entity text,
  target_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  entity_key text := lower(trim(coalesce(target_entity, '')));
  affected integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  if not public.has_permission('trash.view')
     or not public.has_permission('trash.restore') then
    raise exception 'Permissões trash.view e trash.restore são necessárias.';
  end if;

  case entity_key
    when 'project' then
      if not public.has_permission('projects.view') then
        raise exception 'Permissão projects.view necessária.';
      end if;

      update public.projects
      set
        published = coalesce(deleted_previous_published, false),
        deleted_at = null,
        deleted_by = null,
        deleted_by_name = null,
        deleted_by_email = null,
        deleted_previous_published = null
      where id = target_id
        and deleted_at is not null;

    when 'agenda' then
      if not public.has_permission('agenda.view') then
        raise exception 'Permissão agenda.view necessária.';
      end if;

      update public.agenda_events
      set
        published = coalesce(deleted_previous_published, false),
        deleted_at = null,
        deleted_by = null,
        deleted_by_name = null,
        deleted_by_email = null,
        deleted_previous_published = null
      where id = target_id
        and deleted_at is not null;

    when 'playlist' then
      if not public.has_permission('playlists.view') then
        raise exception 'Permissão playlists.view necessária.';
      end if;

      update public.streaming_playlists
      set
        published = coalesce(deleted_previous_published, false),
        deleted_at = null,
        deleted_by = null,
        deleted_by_name = null,
        deleted_by_email = null,
        deleted_previous_published = null
      where id = target_id
        and deleted_at is not null;

    when 'presave' then
      if not public.has_permission('presaves.view') then
        raise exception 'Permissão presaves.view necessária.';
      end if;

      update public.presave_campaigns
      set
        published = coalesce(deleted_previous_published, false),
        deleted_at = null,
        deleted_by = null,
        deleted_by_name = null,
        deleted_by_email = null,
        deleted_previous_published = null
      where id = target_id
        and deleted_at is not null;

    when 'finance' then
      if not public.finance_access('finance.view') then
        raise exception 'Acesso financeiro com MFA confirmado é necessário.';
      end if;

      update public.financial_entries
      set
        deleted_at = null,
        deleted_by = null,
        deleted_by_name = null,
        deleted_by_email = null,
        updated_by = auth.uid()
      where id = target_id
        and deleted_at is not null;

    else
      raise exception 'Tipo de item inválido.';
  end case;

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Item não encontrado ou não está na lixeira.';
  end if;

  return true;
end;
$function$;


-- ------------------------------------------------------------
-- 3. RPC: exclusão definitiva
-- ------------------------------------------------------------
create or replace function public.apollus_purge(
  target_entity text,
  target_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  entity_key text := lower(trim(coalesce(target_entity, '')));
  affected integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  if not public.has_permission('trash.view')
     or not public.has_permission('trash.delete') then
    raise exception 'Permissões trash.view e trash.delete são necessárias.';
  end if;

  case entity_key
    when 'project' then
      if not public.has_permission('projects.delete') then
        raise exception 'Permissão projects.delete necessária.';
      end if;
      delete from public.projects
      where id = target_id and deleted_at is not null;

    when 'agenda' then
      if not public.has_permission('agenda.delete') then
        raise exception 'Permissão agenda.delete necessária.';
      end if;
      delete from public.agenda_events
      where id = target_id and deleted_at is not null;

    when 'playlist' then
      if not public.has_permission('playlists.delete') then
        raise exception 'Permissão playlists.delete necessária.';
      end if;
      delete from public.streaming_playlists
      where id = target_id and deleted_at is not null;

    when 'presave' then
      if not public.has_permission('presaves.delete') then
        raise exception 'Permissão presaves.delete necessária.';
      end if;
      delete from public.presave_campaigns
      where id = target_id and deleted_at is not null;

    when 'finance' then
      if not public.finance_access('finance.delete') then
        raise exception 'Permissão finance.delete e MFA confirmado são necessários.';
      end if;
      delete from public.financial_entries
      where id = target_id and deleted_at is not null;

    else
      raise exception 'Tipo de item inválido.';
  end case;

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Item não encontrado ou precisa estar na lixeira antes da exclusão definitiva.';
  end if;

  return true;
end;
$function$;


-- ------------------------------------------------------------
-- 4. Limpeza segura de lançamento novo quando a criação de
-- parcelas falhar. Não substitui finance.delete.
-- ------------------------------------------------------------
create or replace function public.apollus_cleanup_failed_financial_entry(
  target_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  affected integer := 0;
begin
  if not public.finance_access('finance.edit') then
    raise exception 'Acesso financeiro insuficiente.';
  end if;

  delete from public.financial_entries e
  where e.id = target_id
    and e.created_by = auth.uid()
    and e.deleted_at is null
    and coalesce(e.amount_paid, 0) = 0
    and e.created_at >= now() - interval '10 minutes'
    and e.invoice_number is null
    and not exists (
      select 1
      from public.financial_installments i
      where i.entry_id = e.id
    );

  get diagnostics affected = row_count;
  return affected = 1;
end;
$function$;


-- ------------------------------------------------------------
-- 5. Privilégios das RPCs
-- ------------------------------------------------------------
revoke all on function public.apollus_soft_delete(text, uuid)
from public, anon, authenticated;
revoke all on function public.apollus_restore(text, uuid)
from public, anon, authenticated;
revoke all on function public.apollus_purge(text, uuid)
from public, anon, authenticated;
revoke all on function public.apollus_cleanup_failed_financial_entry(uuid)
from public, anon, authenticated;

grant execute on function public.apollus_soft_delete(text, uuid) to authenticated;
grant execute on function public.apollus_restore(text, uuid) to authenticated;
grant execute on function public.apollus_purge(text, uuid) to authenticated;
grant execute on function public.apollus_cleanup_failed_financial_entry(uuid) to authenticated;


-- ------------------------------------------------------------
-- 6. PROJETOS
-- - leitura de excluídos requer projects.view + trash.view
-- - INSERT/UPDATE nunca podem criar/restaurar lixeira diretamente
-- - DELETE definitivo exige projects.delete + trash.delete
-- ------------------------------------------------------------
drop policy if exists "Projetos públicos ou admin" on public.projects;
drop policy if exists "Admin cria projetos" on public.projects;
drop policy if exists "Admin edita projetos" on public.projects;
drop policy if exists "Admin exclui projetos" on public.projects;

create policy "Projetos públicos ou admin"
on public.projects for select
to authenticated
using (
  (deleted_at is null and published = true)
  or (
    public.has_permission('projects.view')
    and (deleted_at is null or public.has_permission('trash.view'))
  )
);

create policy "Admin cria projetos"
on public.projects for insert
to authenticated
with check (
  public.has_permission('projects.edit')
  and deleted_at is null
);

create policy "Admin edita projetos"
on public.projects for update
to authenticated
using (
  public.has_permission('projects.edit')
  and deleted_at is null
)
with check (
  public.has_permission('projects.edit')
  and deleted_at is null
);

create policy "Admin exclui projetos"
on public.projects for delete
to authenticated
using (
  deleted_at is not null
  and public.has_permission('trash.view')
  and public.has_permission('trash.delete')
  and public.has_permission('projects.delete')
);


-- ------------------------------------------------------------
-- 7. AGENDA
-- ------------------------------------------------------------
drop policy if exists "Agenda pública ou admin" on public.agenda_events;
drop policy if exists "Admin cria agenda" on public.agenda_events;
drop policy if exists "Admin edita agenda" on public.agenda_events;
drop policy if exists "Admin exclui agenda" on public.agenda_events;

create policy "Agenda pública ou admin"
on public.agenda_events for select
to authenticated
using (
  (deleted_at is null and published = true)
  or (
    public.has_permission('agenda.view')
    and (deleted_at is null or public.has_permission('trash.view'))
  )
);

create policy "Admin cria agenda"
on public.agenda_events for insert
to authenticated
with check (
  public.has_permission('agenda.edit')
  and deleted_at is null
);

create policy "Admin edita agenda"
on public.agenda_events for update
to authenticated
using (
  public.has_permission('agenda.edit')
  and deleted_at is null
)
with check (
  public.has_permission('agenda.edit')
  and deleted_at is null
);

create policy "Admin exclui agenda"
on public.agenda_events for delete
to authenticated
using (
  deleted_at is not null
  and public.has_permission('trash.view')
  and public.has_permission('trash.delete')
  and public.has_permission('agenda.delete')
);


-- ------------------------------------------------------------
-- 8. PLAYLISTS
-- ------------------------------------------------------------
drop policy if exists "Playlists públicas ou admin" on public.streaming_playlists;
drop policy if exists "Admin cria playlists" on public.streaming_playlists;
drop policy if exists "Admin edita playlists" on public.streaming_playlists;
drop policy if exists "Admin exclui playlists" on public.streaming_playlists;

create policy "Playlists públicas ou admin"
on public.streaming_playlists for select
to authenticated
using (
  (deleted_at is null and published = true)
  or (
    public.has_permission('playlists.view')
    and (deleted_at is null or public.has_permission('trash.view'))
  )
);

create policy "Admin cria playlists"
on public.streaming_playlists for insert
to authenticated
with check (
  public.has_permission('playlists.edit')
  and deleted_at is null
);

create policy "Admin edita playlists"
on public.streaming_playlists for update
to authenticated
using (
  public.has_permission('playlists.edit')
  and deleted_at is null
)
with check (
  public.has_permission('playlists.edit')
  and deleted_at is null
);

create policy "Admin exclui playlists"
on public.streaming_playlists for delete
to authenticated
using (
  deleted_at is not null
  and public.has_permission('trash.view')
  and public.has_permission('trash.delete')
  and public.has_permission('playlists.delete')
);


-- ------------------------------------------------------------
-- 9. PRÉ-SAVES
-- ------------------------------------------------------------
drop policy if exists "Pré-saves públicos ou admin" on public.presave_campaigns;
drop policy if exists "Admin cria pré-saves" on public.presave_campaigns;
drop policy if exists "Admin edita pré-saves" on public.presave_campaigns;
drop policy if exists "Admin exclui pré-saves" on public.presave_campaigns;

create policy "Pré-saves públicos ou admin"
on public.presave_campaigns for select
to authenticated
using (
  (deleted_at is null and published = true)
  or (
    public.has_permission('presaves.view')
    and (deleted_at is null or public.has_permission('trash.view'))
  )
);

create policy "Admin cria pré-saves"
on public.presave_campaigns for insert
to authenticated
with check (
  public.has_permission('presaves.edit')
  and deleted_at is null
);

create policy "Admin edita pré-saves"
on public.presave_campaigns for update
to authenticated
using (
  public.has_permission('presaves.edit')
  and deleted_at is null
)
with check (
  public.has_permission('presaves.edit')
  and deleted_at is null
);

create policy "Admin exclui pré-saves"
on public.presave_campaigns for delete
to authenticated
using (
  deleted_at is not null
  and public.has_permission('trash.view')
  and public.has_permission('trash.delete')
  and public.has_permission('presaves.delete')
);


-- ------------------------------------------------------------
-- 10. FINANCEIRO
-- ------------------------------------------------------------
drop policy if exists "Financeiro visualiza lançamentos" on public.financial_entries;
drop policy if exists "Financeiro cria lançamentos" on public.financial_entries;
drop policy if exists "Financeiro edita lançamentos" on public.financial_entries;
drop policy if exists "Financeiro exclui lançamentos" on public.financial_entries;

create policy "Financeiro visualiza lançamentos"
on public.financial_entries for select
to authenticated
using (
  public.finance_access('finance.view')
  and (deleted_at is null or public.has_permission('trash.view'))
);

create policy "Financeiro cria lançamentos"
on public.financial_entries for insert
to authenticated
with check (
  public.finance_access('finance.edit')
  and deleted_at is null
);

create policy "Financeiro edita lançamentos"
on public.financial_entries for update
to authenticated
using (
  public.finance_access('finance.edit')
  and deleted_at is null
)
with check (
  public.finance_access('finance.edit')
  and deleted_at is null
);

create policy "Financeiro exclui lançamentos"
on public.financial_entries for delete
to authenticated
using (
  deleted_at is not null
  and public.has_permission('trash.view')
  and public.has_permission('trash.delete')
  and public.finance_access('finance.delete')
);

-- Parcelas/pagamentos não possuem exclusão direta na interface.
-- A exclusão definitiva ocorre pela cascata do lançamento principal.
drop policy if exists "Financeiro exclui parcelas"
on public.financial_installments;

drop policy if exists "Financeiro exclui pagamentos"
on public.financial_payments;

commit;

notify pgrst, 'reload schema';
