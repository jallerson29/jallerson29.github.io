# Apollus — site, portfólio, agenda e painel administrativo

Este pacote está pronto para ser publicado no GitHub Pages e mantém a identidade visual atual. Ele adiciona:

- portfólio alimentado pelo painel administrativo;
- página individual para cada projeto;
- capa, galeria, áudio, vídeo, links e ficha técnica;
- agenda virtual mensal;
- painel para criar, editar, publicar, ocultar e excluir projetos e datas;
- login com um único administrador;
- armazenamento de imagens e áudios no Supabase.

## Estrutura

```text
index.html
projetos.html
projeto.html
style.css
script.js
supabase-config.js
CNAME

admin/
  login.html
  dashboard.html
  admin.css
  admin.js

sql/
  setup.sql

docs/
  apollus-logo-transparent.png
  ...mantenha aqui as demais fotos que já existem no site
```

## 1. Criar o projeto no Supabase

1. Crie um projeto em https://supabase.com.
2. Abra **SQL Editor**.
3. Cole e execute todo o arquivo `sql/setup.sql`.

O SQL cria as tabelas, as regras de segurança e o bucket público `apollus-media`.

## 2. Criar o único usuário administrador

1. No Supabase, abra **Authentication > Users**.
2. Crie o usuário com o e-mail e a senha que serão usados no painel.
3. Copie o UUID do usuário.
4. Volte ao SQL Editor e execute:

```sql
insert into public.admin_users (user_id)
values ('COLE-AQUI-O-UUID-DO-USUARIO')
on conflict (user_id) do nothing;
```

Somente o UUID cadastrado nessa tabela poderá alterar o site.

## 3. Conectar o site

Abra `supabase-config.js` e substitua:

```js
export const SUPABASE_URL = 'COLE_AQUI_A_PROJECT_URL';
export const SUPABASE_ANON_KEY = 'COLE_AQUI_A_PUBLISHABLE_KEY';
```

Os dois valores ficam em **Project Settings > API** no Supabase.

Use somente a chave pública/publishable/anon. Nunca coloque a `service_role` no site.

## 4. Publicar no GitHub Pages

1. Envie **o conteúdo desta pasta** para a raiz do repositório do site.
2. Em **Settings > Pages**, publique a branch principal a partir da pasta raiz.
3. Aguarde a atualização do domínio. O arquivo `CNAME` já aponta para `apollusart.com`.

Envie todos os arquivos para o repositório do site. Ao substituir a pasta `docs`, preserve as imagens antigas usadas na equipe:

- `JALL3R.jpg`
- `Liriel.png`
- `Juliana.jpg`
- `Bella.jpg`
- `Jallerson.jpg`
- `Alessandro Mattos.jpg`

O arquivo `CNAME` já aponta para `apollusart.com`.

## 5. Usar o painel

Acesse:

```text
https://apollusart.com/admin/login.html
```

No painel:

- **Projetos:** título, categoria, resumo, descrição, capa, áudio, galeria, vídeo, links, créditos e publicação.
- **Agenda:** eventos, lançamentos, disponibilidades, datas, horários, locais e status.

Os conteúdos publicados aparecem automaticamente em `projetos.html`.

## Limites de upload definidos

- Imagens: até 10 MB por arquivo no painel.
- Áudio: até 50 MB.
- Vídeos: use link do YouTube ou Vimeo, evitando arquivos muito pesados.


## O que já está pronto

- A página pública não possui cards falsos ou fixos: tudo vem do banco.
- Cada projeto ganha uma página própria com capa, descrição, galeria, áudio, vídeo, link externo e ficha técnica.
- A agenda possui lista de próximos acontecimentos e calendário mensal.
- O painel permite criar, editar, publicar, ocultar e excluir projetos e datas.
- O banco impede que mais de um usuário seja cadastrado como administrador.
- Senhas não ficam salvas no GitHub; o login usa o Supabase Auth.
