# Apollus — Configurações do Site V1

Esta atualização adiciona a aba **Configurações** ao painel administrativo. Os textos e contatos passam a ser armazenados no Supabase e aplicados automaticamente ao site público.

## O que pode ser editado

- Nome da marca, título do navegador e descrição para buscadores.
- Número e mensagem padrão do WhatsApp.
- Link do Instagram.
- Ano e localização do rodapé.
- Destaque principal da página inicial.
- Textos da seção Sobre e da chamada final.
- Títulos e descrições da página de Projetos.
- Textos de playlists, próximos acontecimentos e calendário.
- Chamada comercial da agenda.
- Agenda aberta ou sob consulta.
- Exibição da equipe, playlists e agenda pública.
- Limite de projetos e playlists exibidos.

As alterações também entram no **Histórico**, com o administrador responsável e os campos modificados.

## Instalação

### 1. Supabase

Abra:

`SQL Editor → New query`

Cole todo o conteúdo de:

`sql/settings-v1.sql`

Clique em **Run** uma única vez.

Pré-requisitos: as atualizações `history-v1.sql` e `trash-v1.sql` já devem ter sido executadas.

### 2. GitHub

Substitua no repositório os arquivos deste pacote, preservando as pastas:

- `admin/dashboard.html`
- `admin/admin.js`
- `admin/admin.css`
- `index.html`
- `projetos.html`
- `projeto.html`
- `script.js`
- `sql/settings-v1.sql`

O pacote **não contém nem altera `supabase-config.js`**.

Depois envie ao GitHub:

```bash
git add .
git commit -m "Adiciona configurações editáveis ao site Apollus"
git push
```

Quando o deploy terminar, abra o painel e pressione `Ctrl + F5`.

## Uso

Entre em:

`Painel → Configurações`

Faça as alterações e clique em **Salvar configurações**. O site público consulta esses dados ao abrir cada página.

O botão **Restaurar padrões** apenas repõe os valores no formulário. Nada é publicado até clicar em **Salvar configurações**.

## Observações

- Use o WhatsApp com DDI e DDD, somente números. Exemplo: `5541996600432`.
- Nos limites de projetos e playlists, use `0` para exibir todos.
- Desativar a agenda pública oculta próximos acontecimentos, calendário e chamada comercial.
- Desativar “Agenda aberta” mantém a agenda visível, mas troca o destaque para “CONSULTE NOVAS DATAS”.
