-- ============================================================
-- APOLLUS — NFS-e V2 — integridade adicional
-- Execute uma vez após a criação de financial_parties/financial_invoices.
-- ============================================================

begin;

-- O frontend Stable 1 trabalha com uma NFS-e por lançamento financeiro.
-- Mantém a relação inequívoca e evita registros invisíveis/duplicados.
create unique index if not exists financial_invoices_one_per_entry_idx
  on public.financial_invoices (financial_entry_id)
  where financial_entry_id is not null;

-- Garante no banco que "Papel da Apollus" corresponde ao participante
-- marcado como a entidade fiscal principal da Apollus.
create or replace function public.validate_financial_invoice_apollus_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  apollus_party_id uuid;
begin
  select id
    into apollus_party_id
  from public.financial_parties
  where is_apollus = true
  limit 1;

  if new.apollus_role = 'nenhum' then
    if apollus_party_id is not null and (
      new.provider_party_id = apollus_party_id
      or new.customer_party_id = apollus_party_id
      or new.intermediary_party_id = apollus_party_id
    ) then
      raise exception 'A Apollus aparece como participante, mas apollus_role está como nenhum.';
    end if;
    return new;
  end if;

  if apollus_party_id is null then
    raise exception 'Cadastre a entidade fiscal principal da Apollus antes de definir seu papel na NFS-e.';
  end if;

  if new.apollus_role = 'prestador' then
    if new.provider_party_id is distinct from apollus_party_id then
      raise exception 'Prestador/emitente deve ser o cadastro fiscal da Apollus.';
    end if;
    if new.customer_party_id = apollus_party_id or new.intermediary_party_id = apollus_party_id then
      raise exception 'A Apollus só pode ocupar um papel nesta NFS-e.';
    end if;
  elsif new.apollus_role = 'tomador' then
    if new.customer_party_id is distinct from apollus_party_id then
      raise exception 'Tomador deve ser o cadastro fiscal da Apollus.';
    end if;
    if new.provider_party_id = apollus_party_id or new.intermediary_party_id = apollus_party_id then
      raise exception 'A Apollus só pode ocupar um papel nesta NFS-e.';
    end if;
  elsif new.apollus_role = 'intermediario' then
    if new.intermediary_party_id is distinct from apollus_party_id then
      raise exception 'Intermediário deve ser o cadastro fiscal da Apollus.';
    end if;
    if new.provider_party_id = apollus_party_id or new.customer_party_id = apollus_party_id then
      raise exception 'A Apollus só pode ocupar um papel nesta NFS-e.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_financial_invoice_apollus_role() from public, anon, authenticated;

drop trigger if exists financial_invoices_validate_apollus_role
  on public.financial_invoices;

create trigger financial_invoices_validate_apollus_role
before insert or update on public.financial_invoices
for each row
execute function public.validate_financial_invoice_apollus_role();

commit;
notify pgrst, 'reload schema';
