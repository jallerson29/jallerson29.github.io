# Atualização do Painel — Dashboard V2

Esta versão adiciona ao painel administrativo:

- Visão geral com métricas;
- Próximos compromissos;
- Atividade recente;
- Calendário mensal;
- Quadro de projetos por etapa;
- Arrastar e soltar projetos entre as etapas;
- Filtro por etapa na lista de projetos;
- Ações rápidas para novo projeto e novo evento.

## Atualização do banco existente

Como o seu Supabase já está funcionando, abra o **SQL Editor**, cole todo o conteúdo de:

`sql/dashboard-v2.sql`

e clique em **Run** uma única vez.

Depois envie os arquivos atualizados ao GitHub. O painel continuará usando o mesmo usuário, projetos, agenda e arquivos que você já cadastrou.

## Arquivos principais alterados

- `admin/dashboard.html`
- `admin/admin.css`
- `admin/admin.js`
- `sql/setup.sql`
- `sql/dashboard-v2.sql`
