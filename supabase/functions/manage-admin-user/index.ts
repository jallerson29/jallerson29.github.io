import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OWNER_ID = 'e4028402-dced-4131-a468-0ee86baf7d49';
const ALLOWED_PERMISSIONS = new Set([
  'projects.view', 'projects.edit', 'projects.delete',
  'agenda.view', 'agenda.edit', 'agenda.delete',
  'playlists.view', 'playlists.edit', 'playlists.delete',
  'presaves.view', 'presaves.edit', 'presaves.delete',
  'history.view',
  'trash.view', 'trash.restore', 'trash.delete',
  'settings.view', 'settings.edit',
  'finance.view', 'finance.edit', 'finance.delete', 'finance.export', 'finance.invoice',
  'users.manage',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cleanText(value: unknown, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Secrets do Supabase indisponíveis.' }, 500);
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sessão não informada.' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json({ error: 'Sessão inválida.' }, 401);

    const [{ data: ownerAllowed, error: ownerError }, { data: assurance, error: assuranceError }] = await Promise.all([
      callerClient.rpc('is_owner'),
      callerClient.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (ownerError || ownerAllowed !== true || callerData.user.id !== OWNER_ID) {
      return json({ error: 'Somente Jallerson pode administrar perfis e permissões.' }, 403);
    }
    if (assuranceError || assurance?.currentLevel !== 'aal2') {
      return json({ error: 'Confirme a autenticação em duas etapas antes de administrar perfis.' }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = cleanText(payload.action, 40);
    const requestedPermissions: string[] = Array.isArray(payload.permissions)
      ? [...new Set(payload.permissions.map((key: unknown) => cleanText(key, 80)).filter((key: string) => ALLOWED_PERMISSIONS.has(key)))]
      : [];

    const callerProfileResult = await adminClient
      .from('admin_profiles')
      .select('display_name, email')
      .eq('user_id', OWNER_ID)
      .maybeSingle();
    const callerName = callerProfileResult.data?.display_name || 'Jallerson';
    const callerEmail = callerProfileResult.data?.email || callerData.user.email || 'jallerson29@gmail.com';

    let userId = cleanText(payload.user_id, 80);
    const displayName = cleanText(payload.display_name, 120);
    const email = cleanText(payload.email, 220).toLowerCase();
    const requestedRole = cleanText(payload.role, 30);
    const role = ['admin', 'editor', 'finance', 'custom'].includes(requestedRole) ? requestedRole : 'custom';
    const active = payload.active !== false;
    const financialPermission = requestedPermissions.some((key) => key.startsWith('finance.'));
    const requireMfa = financialPermission ? true : Boolean(payload.require_mfa);

    if (action === 'invite') {
      if (!displayName || !email || !email.includes('@')) {
        return json({ error: 'Informe nome e e-mail válidos.' }, 400);
      }

      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      const existing = listData.users.find((user) => user.email?.toLowerCase() === email);

      if (existing) {
        userId = existing.id;
      } else {
        const redirectTo = Deno.env.get('ADMIN_REDIRECT_URL') || 'https://apollusart.com/admin/login.html';
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { display_name: displayName, invited_by: OWNER_ID },
        });
        if (inviteError) throw inviteError;
        if (!inviteData.user?.id) return json({ error: 'O convite foi enviado, mas o usuário não foi retornado.' }, 500);
        userId = inviteData.user.id;
      }
    }

    if (!userId) return json({ error: 'Usuário não informado.' }, 400);
    if (userId === OWNER_ID && ['deactivate', 'delete'].includes(action)) {
      return json({ error: 'O perfil proprietário não pode ser removido ou desativado.' }, 400);
    }

    if (action === 'delete') {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false);
      if (deleteError) throw deleteError;
      await adminClient.from('activity_log').insert({
        action: 'permanently_deleted',
        entity_type: 'profile',
        entity_id: userId,
        entity_title: displayName || email || 'Perfil administrativo',
        user_id: OWNER_ID,
        actor_name: callerName,
        actor_email: callerEmail,
        changes: { profile: { old: 'ativo', new: 'excluído da autenticação' } },
      });
      return json({ success: true, action, user_id: userId });
    }

    if (action === 'deactivate') {
      const { error } = await adminClient
        .from('admin_profiles')
        .update({ active: false, updated_by: OWNER_ID })
        .eq('user_id', userId);
      if (error) throw error;
      await adminClient.from('activity_log').insert({
        action: 'updated', entity_type: 'profile', entity_id: userId,
        entity_title: displayName || email || 'Perfil administrativo',
        user_id: OWNER_ID, actor_name: callerName, actor_email: callerEmail,
        changes: { active: { old: true, new: false } },
      });
      return json({ success: true, action, user_id: userId });
    }

    if (action === 'activate') {
      const { error } = await adminClient
        .from('admin_profiles')
        .update({ active: true, updated_by: OWNER_ID })
        .eq('user_id', userId);
      if (error) throw error;
      return json({ success: true, action, user_id: userId });
    }

    if (!['invite', 'update'].includes(action)) {
      return json({ error: 'Ação inválida.' }, 400);
    }

    if (!displayName || !email || !email.includes('@')) {
      return json({ error: 'Informe nome e e-mail válidos.' }, 400);
    }

    if (userId === OWNER_ID) {
      requestedPermissions.splice(0, requestedPermissions.length, ...ALLOWED_PERMISSIONS);
    } else {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        user_metadata: { display_name: displayName },
      });
      if (authUpdateError) throw authUpdateError;
    }

    const profilePayload = {
      user_id: userId,
      display_name: displayName,
      email,
      role: userId === OWNER_ID ? 'owner' : role,
      active: userId === OWNER_ID ? true : active,
      require_mfa: userId === OWNER_ID ? true : requireMfa,
      created_by: OWNER_ID,
      updated_by: OWNER_ID,
    };

    const { error: profileError } = await adminClient
      .from('admin_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    const { error: clearError } = await adminClient
      .from('admin_user_permissions')
      .delete()
      .eq('user_id', userId);
    if (clearError) throw clearError;

    const finalPermissions = userId === OWNER_ID ? [...ALLOWED_PERMISSIONS] : requestedPermissions;
    if (finalPermissions.length) {
      const rows = finalPermissions.map((permissionKey) => ({
        user_id: userId,
        permission_key: permissionKey,
        allowed: true,
        updated_by: OWNER_ID,
      }));
      const { error: permissionError } = await adminClient
        .from('admin_user_permissions')
        .insert(rows);
      if (permissionError) throw permissionError;
    }

    await adminClient.from('activity_log').insert({
      action: action === 'invite' ? 'inserted' : 'updated',
      entity_type: 'profile',
      entity_id: userId,
      entity_title: displayName,
      user_id: OWNER_ID,
      actor_name: callerName,
      actor_email: callerEmail,
      changes: {
        role: { new: profilePayload.role },
        active: { new: profilePayload.active },
        require_mfa: { new: profilePayload.require_mfa },
        permissions: { new: finalPermissions },
      },
    });

    return json({
      success: true,
      action,
      user_id: userId,
      profile: profilePayload,
      permissions: finalPermissions,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Falha ao administrar o perfil.' }, 500);
  }
});
