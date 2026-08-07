-- ============================================================
-- APOLLUS — CONFIGURAÇÕES DO SITE V1
-- Execute uma única vez no SQL Editor do Supabase.
-- Pré-requisitos: history-v1.sql e trash-v1.sql já executados.
-- ============================================================

begin;

create table if not exists public.site_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row_check
    check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

insert into public.site_settings (id, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'site_name', 'Apollus',
    'site_title', 'Apollus | Arte, Som & Experiência',
    'meta_description', 'Apollus — produtora criativa de música, eventos, teatro, cultura e educação.',
    'whatsapp_number', '5541996600432',
    'whatsapp_message', 'Olá Apollus! Tenho uma ideia de projeto e gostaria de conversar.',
    'instagram_url', 'https://www.instagram.com/apollusart/',
    'copyright_year', 2026,
    'footer_location', 'Curitiba-PR',
    'hero_eyebrow', 'Produtora criativa independente',
    'hero_title_line1', 'Transformamos',
    'hero_title_highlight', 'ideias',
    'hero_title_connector', 'em',
    'hero_title_line3', 'experiências.',
    'hero_text', 'Música, eventos, teatro, cultura e educação reunidos em um só lugar para dar forma, direção e vida a projetos criativos.',
    'hero_primary_label', 'Quero falar sobre meu projeto',
    'hero_secondary_label', 'Conhecer a Apollus',
    'about_title', 'Uma ponte entre a ideia e a realização.',
    'about_text_1', 'O nome Apollus nasce de uma releitura de Apolo, figura mitológica ligada à música, à arte, à luz e à inspiração criativa.',
    'about_text_2', 'Somos uma produtora independente que conecta criação, técnica e estratégia para transformar ideias em projetos reais — mesmo quando elas ainda estão no começo.',
    'cta_kicker', 'Vamos criar?',
    'cta_title', 'Sua ideia não precisa chegar pronta.',
    'cta_text', 'A Apollus ajuda a dar forma, direção e estrutura para ela acontecer.',
    'cta_button_label', 'Falar sobre meu projeto',
    'projects_hero_eyebrow', 'Portfólio e agenda',
    'projects_hero_line1', 'Projetos que',
    'projects_hero_highlight', 'saíram do papel.',
    'projects_hero_text', 'Produções musicais, eventos, projetos culturais, trabalhos artísticos e experiências desenvolvidas pela Apollus.',
    'portfolio_title', 'Projetos realizados',
    'portfolio_text', 'Trabalhos que já passaram por nossas mãos, ideias que ganharam forma e experiências que aconteceram de verdade.',
    'playlist_title', 'Ouça, descubra e fortaleça artistas.',
    'playlist_text', 'Playlists pensadas para ampliar descobertas, aproximar públicos e gerar novos ciclos de escuta. Siga, salve e compartilhe.',
    'upcoming_title', 'Próximos acontecimentos',
    'upcoming_text', 'Eventos, lançamentos e experiências que já estão sendo preparados.',
    'calendar_heading', 'Veja o que está acontecendo.',
    'calendar_text', 'Navegue pelos meses e abra cada data para consultar detalhes, horários, locais e disponibilidade.',
    'agenda_kicker', 'Agenda Apollus',
    'agenda_title', 'Tem uma ideia esperando para acontecer?',
    'agenda_text', 'Consulte disponibilidade para produções musicais, eventos, projetos culturais, teatro, cursos e experiências criativas.',
    'agenda_button_label', 'Consultar agenda',
    'agenda_open', true,
    'show_team', true,
    'show_playlists', true,
    'show_agenda', true,
    'projects_limit', 0,
    'playlists_limit', 0
  )
)
on conflict (id) do nothing;

-- updated_at automático.
drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

-- A leitura é pública; somente administradores alteram.
alter table public.site_settings enable row level security;

drop policy if exists "Configurações públicas são visíveis" on public.site_settings;
drop policy if exists "Admin cria configurações" on public.site_settings;
drop policy if exists "Admin edita configurações" on public.site_settings;

create policy "Configurações públicas são visíveis"
on public.site_settings for select
to anon, authenticated
using (true);

create policy "Admin cria configurações"
on public.site_settings for insert
to authenticated
with check (public.is_admin());

create policy "Admin edita configurações"
on public.site_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
revoke delete on table public.site_settings from anon, authenticated;

-- Inclui Configurações no histórico detalhado.
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
  check (entity_type in ('project','agenda','playlist','settings'));

create or replace function public.log_site_settings_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_settings jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else coalesce(old.settings, '{}'::jsonb) end;
  new_settings jsonb := coalesce(new.settings, '{}'::jsonb);
  settings_changes jsonb;
  admin_name text;
  admin_email text;
begin
  settings_changes := public.activity_jsonb_diff(old_settings, new_settings);

  if tg_op = 'UPDATE' and settings_changes = '{}'::jsonb then
    return new;
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
    action, entity_type, entity_id, entity_title, user_id,
    actor_name, actor_email, changes
  ) values (
    case when tg_op = 'INSERT' then 'inserted' else 'updated' end,
    'settings',
    new.id,
    'Configurações do site',
    auth.uid(),
    coalesce(admin_name, admin_email, 'Equipe Apollus'),
    admin_email,
    settings_changes
  );

  return new;
end;
$$;

drop trigger if exists site_settings_activity_log on public.site_settings;
create trigger site_settings_activity_log
after insert or update on public.site_settings
for each row execute function public.log_site_settings_activity();

commit;
notify pgrst, 'reload schema';
