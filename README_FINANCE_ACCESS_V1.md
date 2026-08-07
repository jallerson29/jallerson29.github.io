# Apollus — Financeiro Seguro + Perfis e Acessos V1

Esta atualização adiciona ao painel Apollus:

- visão geral financeira sem expor valores a usuários não autorizados;
- receitas e despesas;
- contas a receber e contas a pagar;
- parcelas e pagamentos parciais;
- controle de Nota Fiscal / MEI;
- integração financeira com projetos;
- relatório mensal e impressão em PDF pelo navegador;
- exportação CSV;
- histórico e lixeira para lançamentos;
- perfis e permissões individuais;
- autenticação em duas etapas para o Financeiro;
- gerenciamento completo de usuários exclusivo do proprietário;
- layout responsivo para computador, tablet e celular.

## Proprietário protegido

O proprietário único está fixado pelo UUID:

```text
Jallerson
UUID: e4028402-dced-4131-a468-0ee86baf7d49
E-mail: jallerson29@gmail.com
```

Esse perfil não pode ser excluído, desativado, rebaixado ou ter o MFA removido pelas políticas do banco. Alterações de perfis e permissões exigem uma sessão `aal2`, confirmada pelo aplicativo autenticador.

## Segurança aplicada

A segurança não depende apenas de esconder botões no HTML:

1. O navegador consulta dados financeiros somente quando existe `finance.view` e a sessão atende ao MFA exigido.
2. O PostgreSQL usa RLS nas tabelas financeiras e nos demais módulos.
3. As alterações de perfis e permissões exigem proprietário + MFA no banco.
4. A Edge Function valida o usuário chamador, o UUID do proprietário e o nível `aal2` antes de usar funções administrativas.
5. A chave `service_role` fica somente na Edge Function. Nunca coloque essa chave no GitHub, em `supabase-config.js` ou no navegador.

## Arquivos da atualização

```text
admin/dashboard.html
admin/login.html
admin/admin.js
admin/admin.css
admin/finance.js
sql/finance-access-v1.sql
supabase/functions/manage-admin-user/index.ts
```

Os demais arquivos públicos foram mantidos no pacote para facilitar o envio completo ao repositório.

## Pré-requisitos

Execute esta atualização somente depois das versões anteriores do painel:

```text
setup.sql
dashboard-v2.sql
playlists-v1.sql
meetings-v1.sql
history-v1.sql
trash-v1.sql
settings-v1.sql
presave-v1.sql
```

Antes de começar, faça um backup do repositório e, de preferência, do banco de dados.

# Instalação

## 1. Executar a migração no Supabase

Abra:

```text
Supabase → SQL Editor → New query
```

Cole todo o conteúdo de:

```text
sql/finance-access-v1.sql
```

Clique em **Run** uma única vez.

A migração cria os perfis, permissões, tabelas financeiras, parcelas, pagamentos, políticas RLS, gatilhos, integração com histórico e proteção do proprietário.

## 2. Publicar a Edge Function

A função é necessária para convidar, editar, desativar e excluir contas de autenticação com segurança.

Com a Supabase CLI:

```bash
supabase login
supabase link --project-ref mlbryqllapbnilqxtkzy
supabase functions deploy manage-admin-user
```

Não use `--no-verify-jwt`.

Defina o endereço para o qual o convidado será direcionado após aceitar o convite:

```bash
supabase secrets set ADMIN_REDIRECT_URL=https://apollusart.com/admin/login.html
```

A função utiliza os secrets internos do ambiente Supabase:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Não copie a `SUPABASE_SERVICE_ROLE_KEY` para nenhum arquivo público.

## 3. Atualizar os arquivos do site

Copie o conteúdo do pacote para a raiz do repositório, preservando as pastas. Os arquivos administrativos que devem ser substituídos são:

```text
admin/dashboard.html
admin/login.html
admin/admin.js
admin/admin.css
```

Adicione também:

```text
admin/finance.js
```

Não substitua nem publique uma versão diferente do seu `supabase-config.js`. O pacote não contém esse arquivo.

## 4. Enviar ao GitHub

```bash
git add .
git commit -m "Adiciona financeiro seguro e controle de acessos"
git push
```

Aguarde o deploy do GitHub Pages e atualize com `Ctrl + F5`.

# Primeiro acesso obrigatório

Depois da migração, o Financeiro e a administração de perfis do proprietário exigem autenticação em duas etapas.

Entre como Jallerson e abra:

```text
Segurança → Configurar aplicativo autenticador
```

Escaneie o QR Code em um aplicativo como Google Authenticator, Microsoft Authenticator, Authy ou 1Password e confirme o código de seis dígitos.

Sem essa confirmação:

- nenhum valor financeiro é consultado;
- o Financeiro permanece bloqueado;
- alterações de usuários e permissões são recusadas pelo banco e pela Edge Function.

# Perfis e permissões

Somente Jallerson verá **Usuários e acessos**. Nessa área é possível:

- convidar um usuário por e-mail;
- editar nome e e-mail;
- ativar ou desativar acesso;
- escolher um modelo de função;
- personalizar cada permissão;
- exigir MFA;
- remover completamente uma conta administrativa.

Permissões disponíveis:

```text
projects.view / projects.edit / projects.delete
agenda.view / agenda.edit / agenda.delete
playlists.view / playlists.edit / playlists.delete
presaves.view / presaves.edit / presaves.delete
history.view
trash.view / trash.restore / trash.delete
settings.view / settings.edit
finance.view / finance.edit / finance.delete
finance.export / finance.invoice
users.manage
```

Quando qualquer permissão `finance.*` é concedida, o perfil passa a exigir MFA.

# Financeiro

## Receitas e despesas

Cada lançamento aceita:

- tipo, descrição e categoria;
- valor total;
- competência e vencimento;
- cliente ou fornecedor;
- CPF ou CNPJ;
- forma de pagamento;
- projeto relacionado;
- observações;
- controle de nota fiscal.

## Parcelas e pagamentos parciais

Ao criar um lançamento, informe a quantidade de parcelas e o intervalo mensal. Depois, abra o lançamento para registrar recebimentos ou pagamentos parciais.

O sistema recalcula automaticamente:

- valor pago ou recebido;
- saldo restante;
- status da parcela;
- status geral do lançamento.

## Nota Fiscal / MEI

Esta versão controla a emissão, mas não emite a NFS-e automaticamente. Ela registra:

- necessidade de emissão;
- status;
- número da NFS-e;
- data e competência;
- tomador e documento;
- serviço prestado;
- Código de Tributação Nacional;
- item da NBS;
- município emissor;
- valor;
- link externo do PDF ou XML.

Os arquivos da nota não são enviados ao Storage, evitando consumo adicional de espaço.

## Relatório e CSV

O relatório mensal apresenta faturamento, recebimentos, despesas, pagamentos, lucros, notas fiscais e resultado por projeto.

- **Exportar CSV:** gera arquivo compatível com Excel/Google Sheets.
- **Gerar relatório:** abre o modo de impressão do navegador, que permite salvar como PDF.

# Histórico e lixeira

Lançamentos financeiros movidos para a lixeira preservam parcelas, pagamentos e dados fiscais. A restauração devolve o lançamento ao Financeiro.

A exclusão definitiva exige `finance.delete` e `trash.delete`, conforme a operação usada no painel.

# Checklist de teste

Após instalar:

1. Entre como Jallerson e configure o MFA.
2. Crie uma receita de teste com duas parcelas.
3. Registre um pagamento parcial.
4. Vincule a receita a um projeto.
5. Marque a nota como pendente e depois emitida.
6. Exporte o CSV.
7. Gere o relatório mensal.
8. Mova o lançamento para a lixeira e restaure.
9. Edite um perfil e retire `finance.view`.
10. Entre com esse usuário e confirme que a aba e os valores financeiros não aparecem.
11. Tente acessar a tabela diretamente com esse usuário e confirme que o RLS retorna acesso negado ou nenhum dado.
12. Teste no celular e em uma janela estreita do navegador.

# Observação de validação

Os arquivos JavaScript foram verificados estaticamente e o HTML foi conferido quanto a IDs duplicados. A migração SQL e a Edge Function precisam ser executadas no seu projeto Supabase para o teste integrado, pois este pacote não possui acesso direto ao seu banco em produção.
