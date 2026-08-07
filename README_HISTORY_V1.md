# Apollus — Histórico detalhado V1

Esta etapa implementa o primeiro item da ordem combinada: **histórico detalhado de alterações**.

## O que foi adicionado

- Nova aba **Histórico** no menu administrativo.
- Nome e e-mail do administrador responsável por cada alteração.
- Registro automático de projetos, agenda/reuniões e playlists.
- Ações identificadas: criar, editar, publicar, ocultar e excluir.
- Comparação campo a campo entre o valor anterior e o novo.
- Busca e filtros por conteúdo, ação, administrador e período.
- Janela com detalhes completos de cada atividade.
- Atividade recente da Visão Geral agora mostra quem fez a alteração.
- Correção de estabilidade no salvamento de playlists e nos convites de reunião.

## Instalação

1. Substitua no repositório:
   - `admin/dashboard.html`
   - `admin/admin.js`
   - `admin/admin.css`
2. No Supabase, abra **SQL Editor → New query**.
3. Cole todo o conteúdo de `sql/history-v1.sql` e clique em **Run** uma única vez.
4. Faça commit e push:

```bash
git add .
git commit -m "Adiciona histórico detalhado ao painel Apollus"
git push
```

5. Quando o GitHub Pages terminar o deploy, abra o painel e pressione `Ctrl + F5`.

## Observações

- Os registros antigos continuam aparecendo, mas podem não possuir comparação campo a campo.
- As novas alterações passam a registrar automaticamente os campos modificados.
- Esta atualização não adiciona arquivos ao Storage; utiliza apenas pequenos registros de texto/JSON no banco.
- O arquivo `supabase-config.js` não faz parte deste pacote e não será sobrescrito.
