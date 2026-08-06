-- APOLLUS — CORREÇÃO DO MAPEAMENTO DOS QUATRO ADMINS
-- Pode ser executado se você já rodou a versão anterior de meetings-v1.sql.

begin;

-- Garante que a tabela aceite mais de um administrador.
alter table public.admin_users
  drop constraint if exists admin_users_singleton_key;

insert into public.admin_users (user_id)
values
  ('73994e6c-94e5-4957-b818-74a79d34a4fa'),
  ('e4028402-dced-4131-a468-0ee86baf7d49'),
  ('78e49710-16f6-4f38-9662-32edde5025ad'),
  ('158fa2f4-99c9-453d-b2b5-a3d2932f04c5')
on conflict (user_id) do nothing;

-- Remove os registros antigos para evitar conflito na coluna email UNIQUE.
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

-- Atualiza convites já existentes para os destinatários corretos.
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

commit;

notify pgrst, 'reload schema';

-- Verificação final
select user_id, name, email, active
from public.admin_contacts
order by name;
