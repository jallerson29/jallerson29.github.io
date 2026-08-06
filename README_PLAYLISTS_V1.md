# Atualização: Playlists e Streamings

## O que entra

- nova aba **Playlists** no painel administrativo;
- criação, edição, publicação, destaque e exclusão;
- capa personalizada opcional;
- incorporação automática de playlists do Spotify e YouTube;
- suporte a Apple Music e link/embed manual para outros streamings;
- nova seção pública dentro de `projetos.html`;
- playlists registradas na atividade recente do dashboard.

## Instalação

1. Copie os arquivos deste pacote para a raiz do repositório, mantendo as pastas.
2. Não substitua o seu `supabase-config.js`; este pacote não contém esse arquivo.
3. No Supabase, abra **SQL Editor**, cole `sql/playlists-v1.sql` e clique em **Run** uma vez.
4. Faça commit e push no GitHub.
5. Abra o painel, entre em **Playlists** e cadastre o primeiro link.

## Como cadastrar

- Spotify: cole o link compartilhado da playlist.
- YouTube Music: cole uma URL que contenha `list=...`.
- Apple Music: cole o link público; o site tenta gerar o embed automaticamente.
- Deezer, SoundCloud e outros: use o link público; caso possua um URL próprio de incorporação, preencha o campo opcional.

Esta versão administra a divulgação e incorporação de playlists. Criar ou alterar a playlist dentro da conta do Spotify exigiria autenticação OAuth adicional e não faz parte desta atualização.
