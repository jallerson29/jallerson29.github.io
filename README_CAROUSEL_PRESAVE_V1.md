# Apollus — Carrossel de projetos + Pré-save V1

Esta atualização parte da versão com **Histórico**, **Lixeira** e **Configurações do site**.

## O que foi adicionado

### Carrossel de destaques

Na página `projetos.html`, os projetos marcados no painel como:

- **Publicado no site**
- **Destacar primeiro**

entram automaticamente no carrossel. São mostrados até 6 destaques, com:

- setas no computador;
- arrastar com mouse;
- deslizar no celular;
- indicadores de página;
- rotação automática a cada 6,5 segundos;
- pausa ao passar o mouse ou focar os controles;
- botão para abrir o projeto;
- botão externo, quando o projeto possui link cadastrado.

A grade normal e os filtros continuam logo abaixo.

### Pré-save de artistas

Nova área do painel para cadastrar campanhas com:

- artista;
- título do single, EP ou álbum;
- data e horário de lançamento;
- capa;
- descrição;
- link oficial de pré-save;
- link do lançamento após a estreia;
- Instagram do artista;
- publicação, destaque e ordem.

Novas páginas públicas:

- `presaves.html`: lista de campanhas;
- `presave.html?slug=...`: página individual com contagem regressiva e compartilhamento.

Quando a data de lançamento passa e existe um **Link do lançamento**, o botão muda de **Fazer pré-save** para **Ouvir agora**.

As campanhas também participam do Histórico e da Lixeira.

## Importante sobre Spotify

Esta versão cria a página da Apollus e direciona o público ao **link oficial de pré-save** fornecido pela distribuidora ou por um serviço como Feature.fm, Linkfire, Music Gateway, ONErpm etc.

Um pré-save direto usando a conta Spotify do visitante exige:

- aplicativo no Spotify Developer;
- OAuth;
- backend seguro;
- armazenamento e renovação de tokens;
- aprovação e manutenção das permissões da API.

Esse fluxo direto não está incluído nesta V1. O modelo por link externo já funciona com o site estático no GitHub Pages e evita expor chaves privadas.

## Instalação

1. No Supabase, abra **SQL Editor → New query**.
2. Execute todo o conteúdo de:

```text
sql/presave-v1.sql
```

3. Substitua ou adicione os arquivos:

```text
admin/dashboard.html
admin/admin.js
admin/admin.css
index.html
projetos.html
projeto.html
presaves.html
presave.html
script.js
style.css
```

4. Não substitua seu `supabase-config.js`.
5. Envie ao GitHub:

```bash
git add .
git commit -m "Adiciona carrossel de projetos e pré-save de artistas"
git push
```

6. Depois do deploy, atualize com `Ctrl + F5`.

## Uso do carrossel

No painel:

```text
Projetos → editar projeto
☑ Publicado no site
☑ Destacar primeiro
```

O carrossel usa no máximo 6 projetos e prioriza a data mais recente.

## Uso do pré-save

No painel:

```text
Pré-save → Novo pré-save
```

O campo **Link oficial de pré-save** é obrigatório. O campo **Link do lançamento após a estreia** é opcional, mas recomendado para o botão mudar automaticamente depois da data cadastrada.

Os textos da página e a visibilidade da nova aba podem ser alterados em:

```text
Configurações → Página de pré-save
```
