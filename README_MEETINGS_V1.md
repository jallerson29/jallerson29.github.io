# Apollus — Reuniões e convites por e-mail V1 corrigido

Esta atualização acrescenta à Agenda:

- tipo **Reunião**;
- horário inicial e final;
- seleção individual dos quatro administradores;
- envio ou reenvio manual de convites;
- e-mail separado para cada pessoa, sem expor os demais destinatários;
- anexo `.ics` para adicionar a reunião ao calendário;
- registro do status de entrega no Supabase;
- reuniões internas podem permanecer ocultas do site público.

## Mapeamento aplicado

| Nome | E-mail | UUID |
|---|---|---|
| Bella | bellamsx@gmail.com | 73994e6c-94e5-4957-b818-74a79d34a4fa |
| Jallerson | jallerson29@gmail.com | e4028402-dced-4131-a468-0ee86baf7d49 |
| Liriel | lirielgmoraes@yahoo.com | 78e49710-16f6-4f38-9662-32edde5025ad |
| Ju Paganotto | paganottoju@gmail.com | 158fa2f4-99c9-453d-b2b5-a3d2932f04c5 |

## 1. Atualize os arquivos do site

Copie e substitua:

```text
admin/dashboard.html
admin/admin.js
admin/admin.css
```

Copie também a pasta:

```text
supabase/functions/send-meeting-invite/
```

O pacote não altera o seu `supabase-config.js`.

## 2. Execute a migração

No Supabase:

```text
SQL Editor → New query
```

Cole todo o conteúdo de:

```text
sql/meetings-v1.sql
```

Clique em **Run** uma vez. O arquivo também corrige automaticamente o mapeamento caso a versão anterior já tenha sido executada.

## 3. Configure o serviço de e-mail

Crie uma conta no Resend, adicione e valide o domínio `apollusart.com` e gere uma API Key.

No Supabase, abra a área de **Edge Functions → Secrets** e crie:

```text
RESEND_API_KEY=re_...
MEETING_FROM_EMAIL=Apollus <reunioes@apollusart.com>
MEETING_REPLY_EMAIL=jallerson29@gmail.com
```

Durante o primeiro teste, você também pode usar:

```text
MEETING_FROM_EMAIL=Apollus <onboarding@resend.dev>
```

A conta de teste do provedor pode restringir quais destinatários recebem mensagens até o domínio ser verificado.

## 4. Publique a Edge Function

### Pelo Supabase Dashboard

Crie uma função chamada:

```text
send-meeting-invite
```

Cole o conteúdo de:

```text
supabase/functions/send-meeting-invite/index.ts
```

Mantenha a verificação de JWT habilitada e publique.

### Pela CLI

Na raiz do repositório:

```bash
supabase login
supabase link --project-ref mlbryqllapbnilqxtkzy
supabase functions deploy send-meeting-invite
```

## 5. Envie os arquivos ao GitHub

```bash
git add .
git commit -m "Adiciona reuniões e convites por email"
git push
```

## 6. Como usar

1. Abra **Agenda**.
2. Clique em **Nova data**.
3. No campo Tipo, selecione ou digite `Reunião`.
4. Informe data, horários, local ou link.
5. Selecione os convidados.
6. Deixe marcada a opção de enviar convites.
7. Salve.

Ao editar uma reunião, a opção de reenvio fica desmarcada para evitar e-mails repetidos. Marque-a somente quando quiser comunicar uma alteração.

## Segurança

- A API Key do Resend fica nos Secrets do Supabase, nunca no GitHub.
- A Edge Function só aceita chamadas de usuário autenticado.
- A função ainda confirma que o usuário pertence à tabela `admin_users`.
- Os e-mails e convidados ficam em tabelas acessíveis apenas aos administradores.
