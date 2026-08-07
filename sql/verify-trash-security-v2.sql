-- ============================================================
-- APOLLUS — VERIFICAÇÃO LIXEIRA V2 (SOMENTE LEITURA)
-- ============================================================

-- 1) RPCs e quem pode executá-las
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'apollus_soft_delete',
    'apollus_restore',
    'apollus_purge',
    'apollus_cleanup_failed_financial_entry'
  )
order by p.proname;

-- 2) Policies finais
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'projects',
    'agenda_events',
    'streaming_playlists',
    'presave_campaigns',
    'financial_entries',
    'financial_installments',
    'financial_payments'
  )
order by tablename, cmd, policyname;

-- 3) Confirma que não sobrou DELETE direto para parcelas/pagamentos
select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('financial_installments','financial_payments')
  and cmd = 'DELETE';
