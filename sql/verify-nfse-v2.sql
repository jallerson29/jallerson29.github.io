-- APOLLUS — NFS-e V2 — verificação pós-frontend
-- Somente leitura. Execute no SQL Editor depois de publicar o frontend.

select
  c.table_name,
  count(*) as columns_count
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('financial_parties','financial_invoices')
group by c.table_name
order by c.table_name;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('financial_parties','financial_invoices')
order by tablename, cmd, policyname;

select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('financial_parties','financial_invoices')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
