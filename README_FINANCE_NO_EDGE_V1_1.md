# Apollus — Financeiro + Acessos sem Edge Function V1.1

Esta versão mantém o Financeiro seguro e simplifica o gerenciamento de usuários.

## O que mudou

A Edge Function `manage-admin-user` não é mais necessária.

O fluxo agora é:

1. Criar ou excluir a conta de login manualmente em **Supabase → Authentication → Users**.
2. Copiar o **UID** do usuário.
3. No painel Apollus, entrar em **Usuários e acessos → Vincular usuário**.
4. Colar o UID, confirmar nome/e-mail e escolher as permissões.

O painel continua permitindo ao proprietário:

- editar permissões individuais;
- ativar ou desativar o acesso ao painel;
- exigir MFA;
- liberar ou bloquear o Financeiro;
- remover um perfil do painel;
- usar perfis-base Administrador, Editor, Financeiro ou Personalizado.

Remover um perfil no painel **não exclui a conta de login do Supabase**. Essa exclusão continua manual em Authentication → Users.

## Proprietário protegido

```text
Jallerson
UUID: e4028402-dced-4131-a468-0ee86baf7d49
E-mail: jallerson29@gmail.com
```

Somente esse UUID pode alterar perfis e permissões. O proprietário não pode ser removido, desativado ou transferido para outra conta.

## Segurança

O Financeiro continua protegido no banco por RLS. Usuários sem `finance.view` não recebem os dados financeiros pela API.

Alterações de perfis e permissões usam funções PostgreSQL protegidas por:

- usuário autenticado;
- UUID do proprietário;
- sessão MFA `aal2`;
- validação do UID existente em `auth.users`;
- validação do e-mail real da conta;
- lista fechada de permissões aceitas.

Não existe `service_role` no navegador e nenhuma chave administrativa precisa ser publicada no GitHub.

## Instalação

### Caso você JÁ tenha executado `finance-access-v1.sql`

Execute somente:

```text
sql/finance-access-no-edge-v1.1.sql
```

Depois substitua:

```text
admin/dashboard.html
admin/finance.js
```

### Caso ainda NÃO tenha instalado o Financeiro

Execute uma única vez:

```text
sql/finance-access-v1.1-full.sql
```

Depois envie os dois arquivos administrativos acima.

## GitHub

```bash
git add .
git commit -m "Simplifica acessos sem Edge Function"
git push
```

Não substitua o seu `supabase-config.js`.

## Como adicionar alguém novo

1. Abra **Supabase → Authentication → Users**.
2. Crie o usuário com o e-mail desejado.
3. Copie o UID gerado.
4. Abra **Painel Apollus → Usuários e acessos**.
5. Clique em **Vincular usuário**.
6. Cole o UID e use exatamente o mesmo e-mail do Authentication.
7. Escolha as permissões e salve.

Se o usuário receber qualquer permissão `finance.*`, o painel ativa automaticamente a exigência de MFA para esse perfil.

## Como remover alguém

No painel, **Remover acesso** retira o perfil da área administrativa, mas mantém a conta Auth intacta.

Se também quiser apagar o login:

```text
Supabase → Authentication → Users → selecionar usuário → Delete user
```

Essa separação foi intencional para evitar que um clique no painel apague acidentalmente uma conta de autenticação.
