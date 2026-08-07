# Apollus — Lixeira e Restauração V1

Esta atualização é a segunda etapa após o Histórico detalhado.

## O que muda

- Projetos, agenda e playlists deixam de ser apagados imediatamente.
- O botão de exclusão passa a mover o conteúdo para a Lixeira.
- Capas, áudios, galerias e imagens permanecem preservados.
- A nova aba **Lixeira** permite restaurar ou excluir definitivamente.
- Ao restaurar, o item recupera o estado público que possuía antes da exclusão.
- A exclusão definitiva remove o registro e as mídias vinculadas.
- O Histórico registra: movido para lixeira, restaurado e excluído definitivamente.
- O rodapé público passa a mostrar: `© 2026 Apollus - Curitiba-PR`.

## Ordem de instalação

1. No Supabase, execute primeiro `sql/trash-v1.sql`.
2. Depois substitua no GitHub:
   - `admin/dashboard.html`
   - `admin/admin.js`
   - `admin/admin.css`
   - `index.html`
   - `projeto.html`
   - `projetos.html`
3. Faça commit e push.
4. Aguarde o GitHub Pages e pressione `Ctrl + F5`.

## Observação importante

O pacote não contém nem altera `supabase-config.js`.
Não remova arquivos do Storage manualmente enquanto o conteúdo estiver na Lixeira, pois eles são necessários para a restauração.
