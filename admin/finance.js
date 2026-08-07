import { supabase, isSupabaseConfigured } from '../supabase-config.js';

const OWNER_ID = 'e4028402-dced-4131-a468-0ee86baf7d49';

const PERMISSION_GROUPS = [
  { key: 'projects', label: 'Projetos', permissions: [['projects.view', 'Visualizar'], ['projects.edit', 'Criar e editar'], ['projects.delete', 'Excluir']] },
  { key: 'agenda', label: 'Agenda e reuniões', permissions: [['agenda.view', 'Visualizar'], ['agenda.edit', 'Criar e editar'], ['agenda.delete', 'Excluir']] },
  { key: 'playlists', label: 'Playlists', permissions: [['playlists.view', 'Visualizar'], ['playlists.edit', 'Criar e editar'], ['playlists.delete', 'Excluir']] },
  { key: 'presaves', label: 'Pré-save', permissions: [['presaves.view', 'Visualizar'], ['presaves.edit', 'Criar e editar'], ['presaves.delete', 'Excluir']] },
  { key: 'finance', label: 'Financeiro', permissions: [['finance.view', 'Visualizar valores'], ['finance.edit', 'Criar e editar'], ['finance.invoice', 'Controlar notas'], ['finance.export', 'Exportar relatórios'], ['finance.delete', 'Excluir']] },
  { key: 'management', label: 'Gestão do painel', permissions: [['history.view', 'Ver histórico'], ['trash.view', 'Ver lixeira'], ['trash.restore', 'Restaurar itens'], ['trash.delete', 'Excluir definitivamente'], ['settings.view', 'Ver configurações'], ['settings.edit', 'Editar configurações']] },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map(([key]) => key));
const ROLE_TEMPLATES = {
  admin: ALL_PERMISSIONS.filter((key) => !key.startsWith('finance.')),
  editor: [
    'projects.view', 'projects.edit', 'agenda.view', 'agenda.edit',
    'playlists.view', 'playlists.edit', 'presaves.view', 'presaves.edit',
    'history.view', 'trash.view', 'trash.restore', 'settings.view',
  ],
  finance: [
    'projects.view', 'finance.view', 'finance.edit', 'finance.invoice',
    'finance.export', 'history.view', 'trash.view', 'trash.restore',
  ],
  custom: [],
};

const REVENUE_CATEGORIES = ['Produção musical', 'Gravação', 'Mixagem', 'Masterização', 'Eventos', 'Locação', 'Audiovisual', 'Serviços técnicos', 'Cursos e aulas', 'Outros'];
const EXPENSE_CATEGORIES = ['Equipe', 'Transporte', 'Equipamentos', 'Estúdio', 'Softwares', 'Marketing', 'Alimentação', 'Manutenção', 'Impostos / MEI', 'Fornecedores', 'Outros'];

const financeState = {
  session: null,
  profile: null,
  permissions: new Set(),
  profiles: [],
  profilePermissions: [],
  entries: [],
  projects: [],
  parties: [],
  invoices: [],
  editingPartyId: null,
  partyReturnSelectId: '',
  activeView: 'overview',
  editingEntryId: null,
  activePaymentInstallmentId: null,
  mfa: { currentLevel: 'aal1', nextLevel: 'aal1', factors: [], verifiedFactors: [] },
};

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR');

function el(id) { return document.getElementById(id); }
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function formatMoney(value) { return moneyFormatter.format(Number(value || 0)); }
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}
function todayIso() { return new Date().toISOString().slice(0, 10); }
function monthIso(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function hasPermission(permission) {
  if (!ALL_PERMISSIONS.includes(permission)) return false;
  return isOwner() || financeState.permissions.has(permission);
}
function isOwner() { return financeState.session?.user?.id === OWNER_ID && financeState.profile?.role === 'owner'; }
function setFormMessage(target, message = '', type = '') {
  if (!target) return;
  target.textContent = message;
  target.className = `form-message${type ? ` ${type}` : ''}`;
}
function setButtonLoading(button, loading, label = 'Salvando...') {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}
function notify(message, type = 'success') {
  const box = el('admin-global-message');
  if (!box) return;
  box.textContent = message;
  box.className = `admin-alert ${type}`;
  box.hidden = false;
  window.setTimeout(() => { box.hidden = true; }, 6000);
}

async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function loadCurrentAccess() {
  financeState.session = await getSession();
  if (!financeState.session) return false;

  const [profileResult, permissionResult] = await Promise.all([
    supabase.from('admin_profiles').select('*').eq('user_id', financeState.session.user.id).maybeSingle(),
    supabase.from('admin_user_permissions').select('permission_key, allowed').eq('user_id', financeState.session.user.id).eq('allowed', true),
  ]);

  if (profileResult.error) {
    console.warn('Perfis e permissões ainda não foram instalados.', profileResult.error);
    return false;
  }

  financeState.profile = profileResult.data;
  financeState.permissions = new Set((permissionResult.data || []).map((item) => item.permission_key));
  return Boolean(financeState.profile?.active);
}

function roleLabel(role = '') {
  return { owner: 'Proprietário', admin: 'Administrador', editor: 'Editor', finance: 'Financeiro', custom: 'Personalizado' }[role] || role;
}

function setSelectOptionAccess(selectId, value, visible) {
  const select = el(selectId);
  const option = select?.querySelector(`option[value="${value}"]`);
  if (!option) return;
  option.hidden = !visible;
  option.disabled = !visible;
  if (!visible && select.value === value) {
    select.value = 'todos';
    select.dispatchEvent(new Event('change'));
  }
}

function applyAccessVisibility() {
  if (!financeState.profile) return;

  const modulePermission = {
    projects: 'projects.view', agenda: 'agenda.view', playlists: 'playlists.view',
    presaves: 'presaves.view', history: 'history.view', trash: 'trash.view',
    settings: 'settings.view', finance: 'finance.view',
  };

  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    const tab = button.dataset.adminTab;
    const permission = modulePermission[tab];
    if (permission) button.hidden = !hasPermission(permission);
    if (tab === 'access') button.hidden = !isOwner();
  });

  document.querySelectorAll('[data-owner-only]').forEach((node) => { node.hidden = !isOwner(); });
  document.querySelectorAll('[data-requires-permission]').forEach((node) => {
    node.hidden = !hasPermission(node.dataset.requiresPermission);
  });

  const rules = [
    ['projects.edit', '#new-project-button, #overview-new-project, #project-save, [data-project-edit], [data-project-toggle], [data-add-stage]'],
    ['projects.delete', '[data-project-delete]'],
    ['agenda.edit', '#new-agenda-button, #overview-new-agenda, #agenda-save, [data-agenda-edit], [data-agenda-toggle]'],
    ['agenda.delete', '[data-agenda-delete]'],
    ['playlists.edit', '#new-playlist-button, #overview-new-playlist, #playlist-save, [data-playlist-edit], [data-playlist-toggle]'],
    ['playlists.delete', '[data-playlist-delete]'],
    ['presaves.edit', '#new-presave-button, #overview-new-presave, #presave-save, [data-presave-edit], [data-presave-toggle]'],
    ['presaves.delete', '[data-presave-delete]'],
    ['settings.edit', '#site-settings-save, #site-settings-reset'],
    ['trash.restore', '[data-trash-restore]'],
    ['trash.delete', '[data-trash-delete]'],
  ];
  rules.forEach(([permission, selector]) => {
    document.querySelectorAll(selector).forEach((node) => { node.hidden = !hasPermission(permission); });
  });

  const settingsForm = el('site-settings-form');
  if (settingsForm && !hasPermission('settings.edit')) {
    settingsForm.querySelectorAll('input, textarea, select').forEach((control) => { control.disabled = true; });
  }

  const financeVisible = hasPermission('finance.view') && financeIsUnlocked();
  setSelectOptionAccess('history-entity-filter', 'finance', financeVisible);
  setSelectOptionAccess('history-entity-filter', 'profile', isOwner() && financeState.mfa.currentLevel === 'aal2');
  setSelectOptionAccess('trash-entity-filter', 'finance', financeVisible);

  const trashViewPermission = {
    project: 'projects.view',
    agenda: 'agenda.view',
    playlist: 'playlists.view',
    presave: 'presaves.view',
    finance: 'finance.view',
  };
  const trashDeletePermission = {
    project: 'projects.delete',
    agenda: 'agenda.delete',
    playlist: 'playlists.delete',
    presave: 'presaves.delete',
    finance: 'finance.delete',
  };

  document.querySelectorAll('[data-trash-restore]').forEach((node) => {
    const entity = node.dataset.trashEntity;
    const moduleVisible = entity === 'finance'
      ? financeVisible
      : Boolean(trashViewPermission[entity] && hasPermission(trashViewPermission[entity]));
    node.hidden = !(hasPermission('trash.restore') && moduleVisible);
  });

  document.querySelectorAll('[data-trash-delete]').forEach((node) => {
    const entity = node.dataset.trashEntity;
    const moduleDelete = entity === 'finance'
      ? (financeVisible && hasPermission('finance.delete'))
      : Boolean(trashDeletePermission[entity] && hasPermission(trashDeletePermission[entity]));
    node.hidden = !(hasPermission('trash.delete') && moduleDelete);
  });

  const userBox = el('admin-user');
  if (userBox) {
    const userHtml = `<strong>${escapeHtml(financeState.profile.display_name || financeState.session.user.email || 'Administrador')}</strong><small>${escapeHtml(roleLabel(financeState.profile.role))}</small>`;
    // Não reescreve o conteúdo se nada mudou. Isso evita que o MutationObserver
    // dispare novamente por uma alteração criada pelo próprio controle de acesso.
    if (userBox.innerHTML !== userHtml) userBox.innerHTML = userHtml;
  }

  if (!financeState.observer && el('admin-app')) {
    let accessRefreshScheduled = false;
    financeState.observer = new MutationObserver((mutations) => {
      // Alterações dentro da identificação do usuário são produzidas pelo próprio
      // applyAccessVisibility e não precisam iniciar uma nova varredura do painel.
      const hasRelevantMutation = mutations.some((mutation) => {
        const target = mutation.target?.nodeType === 1 ? mutation.target : mutation.target?.parentElement;
        return !target?.closest?.('#admin-user, .admin-tip');
      });
      if (!hasRelevantMutation || accessRefreshScheduled) return;

      // Agrupa várias renderizações do admin.js em apenas uma checagem de acesso
      // por frame, evitando dezenas/centenas de varreduras consecutivas do DOM.
      accessRefreshScheduled = true;
      window.requestAnimationFrame(() => {
        accessRefreshScheduled = false;
        applyAccessVisibility();
      });
    });
    financeState.observer.observe(el('admin-app'), { childList: true, subtree: true });
  }
}

function ensureSecurityDialogs() {
  if (!el('mfa-code-dialog')) {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog class="admin-dialog" id="mfa-code-dialog">
        <form class="admin-dialog-card compact" id="mfa-code-form">
          <header class="dialog-header"><div><p class="admin-kicker">Verificação em duas etapas</p><h2 id="mfa-code-title">Confirmar identidade</h2></div><button type="button" class="dialog-close" id="mfa-code-cancel">×</button></header>
          <p id="mfa-code-copy">Digite o código de seis dígitos do aplicativo autenticador.</p>
          <label><span>Código</span><input id="mfa-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000"></label>
          <footer class="dialog-actions"><button type="button" class="admin-btn secondary" id="mfa-code-cancel-footer">Cancelar</button><button type="submit" class="admin-btn primary">Verificar</button></footer>
          <p class="form-message" id="mfa-code-message"></p>
        </form>
      </dialog>
      <dialog class="admin-dialog" id="mfa-enroll-dialog">
        <form class="admin-dialog-card compact" id="mfa-enroll-form">
          <header class="dialog-header"><div><p class="admin-kicker">Proteção financeira</p><h2>Configurar autenticador</h2></div><button type="button" class="dialog-close" id="mfa-enroll-cancel">×</button></header>
          <div class="mfa-enroll-layout"><img id="mfa-enroll-qr" alt="QR Code do autenticador"><div><p>Escaneie o QR Code no Google Authenticator, Microsoft Authenticator, Authy ou 1Password.</p><small>Chave manual</small><code id="mfa-enroll-secret"></code></div></div>
          <label><span>Código de confirmação</span><input id="mfa-enroll-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000"></label>
          <footer class="dialog-actions"><button type="button" class="admin-btn secondary" id="mfa-enroll-cancel-footer">Cancelar</button><button type="submit" class="admin-btn primary">Ativar proteção</button></footer>
          <p class="form-message" id="mfa-enroll-message"></p>
        </form>
      </dialog>`);
  }
}

function requestMfaCode(title = 'Confirmar identidade', copy = 'Digite o código de seis dígitos do aplicativo autenticador.') {
  ensureSecurityDialogs();
  return new Promise((resolve) => {
    const dialog = el('mfa-code-dialog');
    const form = el('mfa-code-form');
    const input = el('mfa-code-input');
    const message = el('mfa-code-message');
    el('mfa-code-title').textContent = title;
    el('mfa-code-copy').textContent = copy;
    input.value = '';
    setFormMessage(message);

    const finish = (value) => {
      form.removeEventListener('submit', onSubmit);
      el('mfa-code-cancel').removeEventListener('click', onCancel);
      el('mfa-code-cancel-footer').removeEventListener('click', onCancel);
      if (dialog.open) dialog.close();
      resolve(value);
    };
    const onSubmit = (event) => { event.preventDefault(); finish(input.value.trim()); };
    const onCancel = () => finish(null);
    form.addEventListener('submit', onSubmit);
    el('mfa-code-cancel').addEventListener('click', onCancel);
    el('mfa-code-cancel-footer').addEventListener('click', onCancel);
    dialog.showModal();
    input.focus();
  });
}

async function refreshMfaState() {
  const [factorResult, aalResult] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factorResult.error) console.warn(factorResult.error);
  if (aalResult.error) console.warn(aalResult.error);
  const totp = factorResult.data?.totp || [];
  financeState.mfa = {
    factors: totp,
    verifiedFactors: totp.filter((factor) => factor.status === 'verified'),
    currentLevel: aalResult.data?.currentLevel || 'aal1',
    nextLevel: aalResult.data?.nextLevel || 'aal1',
  };
  return financeState.mfa;
}

function financeIsUnlocked() {
  return !financeState.profile?.require_mfa || financeState.mfa.currentLevel === 'aal2';
}

async function verifyExistingMfa() {
  await refreshMfaState();
  const factor = financeState.mfa.verifiedFactors[0];
  if (!factor) {
    await beginMfaEnrollment();
    return financeIsUnlocked();
  }
  const code = await requestMfaCode('Liberar área protegida', 'Digite o código atual do seu aplicativo autenticador.');
  if (!code) return false;
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) {
    notify('Código inválido. Tente novamente.', 'error');
    return false;
  }
  await refreshMfaState();
  renderSecurity();
  await updateFinanceLock();
  return financeIsUnlocked();
}

async function beginMfaEnrollment() {
  ensureSecurityDialogs();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Apollus Financeiro' });
  if (error) {
    notify(error.message || 'Não foi possível iniciar a autenticação.', 'error');
    return false;
  }

  const dialog = el('mfa-enroll-dialog');
  const form = el('mfa-enroll-form');
  const qr = el('mfa-enroll-qr');
  const secret = el('mfa-enroll-secret');
  const codeInput = el('mfa-enroll-code');
  const message = el('mfa-enroll-message');
  qr.src = data.totp?.qr_code || '';
  secret.textContent = data.totp?.secret || '';
  codeInput.value = '';
  setFormMessage(message);

  return new Promise((resolve) => {
    const cancelEnrollment = async () => {
      try { await supabase.auth.mfa.unenroll({ factorId: data.id }); } catch (_) { /* ignore */ }
      cleanup(false);
    };
    const cleanup = (result) => {
      form.removeEventListener('submit', submitEnrollment);
      el('mfa-enroll-cancel').removeEventListener('click', cancelEnrollment);
      el('mfa-enroll-cancel-footer').removeEventListener('click', cancelEnrollment);
      if (dialog.open) dialog.close();
      resolve(result);
    };
    const submitEnrollment = async (event) => {
      event.preventDefault();
      const code = codeInput.value.trim();
      const submit = form.querySelector('button[type="submit"]');
      setButtonLoading(submit, true, 'Ativando...');
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: data.id, code });
      setButtonLoading(submit, false);
      if (verifyError) {
        setFormMessage(message, 'Código inválido. Confira o aplicativo e tente novamente.', 'error');
        return;
      }
      await refreshMfaState();
      renderSecurity();
      await updateFinanceLock();
      notify('Autenticação em duas etapas ativada.', 'success');
      cleanup(true);
    };
    form.addEventListener('submit', submitEnrollment);
    el('mfa-enroll-cancel').addEventListener('click', cancelEnrollment);
    el('mfa-enroll-cancel-footer').addEventListener('click', cancelEnrollment);
    dialog.showModal();
    codeInput.focus();
  });
}

async function removeMfaFactor() {
  await refreshMfaState();
  const factor = financeState.mfa.verifiedFactors[0];
  if (!factor) return;
  if (financeState.mfa.currentLevel !== 'aal2') {
    const verified = await verifyExistingMfa();
    if (!verified) return;
  }
  if (!window.confirm('Remover o aplicativo autenticador desta conta? O Financeiro ficará bloqueado até configurar outro fator.')) return;
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) return notify(error.message || 'Não foi possível remover o autenticador.', 'error');
  await supabase.auth.refreshSession();
  await refreshMfaState();
  renderSecurity();
  await updateFinanceLock();
  notify('Autenticador removido.', 'success');
}

function renderSecurity() {
  if (!el('security-mfa-status') || !financeState.profile) return;
  const verified = financeState.mfa.verifiedFactors.length;
  const currentLevel = financeState.mfa.currentLevel;
  el('security-aal-badge').textContent = currentLevel === 'aal2' ? 'AAL2 • identidade confirmada' : 'AAL1 • senha somente';
  el('security-aal-badge').classList.toggle('verified', currentLevel === 'aal2');
  el('security-mfa-status').innerHTML = verified
    ? `<div class="security-status success"><strong>Autenticador configurado</strong><span>${verified} fator${verified === 1 ? '' : 'es'} verificado${verified === 1 ? '' : 's'}.</span></div>`
    : `<div class="security-status warning"><strong>Autenticador não configurado</strong><span>${financeState.profile.require_mfa ? 'O Financeiro permanecerá bloqueado até a configuração.' : 'A ativação é recomendada.'}</span></div>`;
  el('security-enroll-mfa').hidden = verified > 0;
  el('security-verify-mfa').hidden = verified === 0 || currentLevel === 'aal2';
  el('security-remove-mfa').hidden = verified === 0;
  const session = financeState.session;
  el('security-session-info').innerHTML = `<strong>${escapeHtml(session?.user?.email || '')}</strong><span>Usuário: ${escapeHtml(session?.user?.id || '')}</span><span>Sessão atual: ${currentLevel.toUpperCase()}</span>`;
}

async function updateFinanceLock() {
  const lock = el('finance-mfa-lock');
  const content = el('finance-content');
  if (!lock || !content || !hasPermission('finance.view')) return;
  const unlocked = financeIsUnlocked();
  lock.hidden = unlocked;
  content.hidden = !unlocked;
  el('overview-finance-summary').hidden = !unlocked;
  if (unlocked && !financeState.entries.length) await loadFinanceData();
  if (unlocked) renderFinance();
}

function entryBalance(entry) { return Math.max(0, Number(entry.amount_total || 0) - Number(entry.amount_paid || 0)); }
function computedStatus(entry) {
  if (entry.status === 'cancelado') return 'cancelado';
  const balance = entryBalance(entry);
  if (balance <= 0.004) return entry.entry_type === 'receita' ? 'recebido' : 'pago';
  if (Number(entry.amount_paid || 0) > 0) return 'parcial';
  if (entry.due_date && entry.due_date < todayIso()) return 'atrasado';
  return 'pendente';
}
function statusLabel(status) {
  return { pendente: 'Pendente', parcial: 'Parcial', recebido: 'Recebido', pago: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado' }[status] || status;
}
function invoiceLabel(status) {
  return { pendente: 'Pendente', emitida: 'Emitida', cancelada: 'Cancelada', substituida: 'Substituída' }[status] || status || '—';
}
function invoiceDirectionLabel(direction) {
  return { emitida: 'Emitida pela Apollus', recebida: 'Recebida de terceiro', intermediada: 'Intermediada pela Apollus' }[direction] || direction || '—';
}
function apollusRoleLabel(role) {
  return { prestador: 'Prestador / emitente', tomador: 'Tomador', intermediario: 'Intermediário', nenhum: 'Nenhum / somente controle' }[role] || role || '—';
}
function getParty(id) { return financeState.parties.find((party) => party.id === id) || null; }
function getApollusParty() { return financeState.parties.find((party) => party.is_apollus) || null; }
function partyDisplayName(party) {
  if (!party) return '';
  const name = party.trade_name || party.legal_name || 'Sem nome';
  const document = party.tax_id ? ` • ${party.tax_id}` : '';
  return `${name}${document}`;
}
function partyName(id) { return partyDisplayName(getParty(id)); }
function invoiceForEntry(entry) { return entry?.invoice || null; }

function attachInvoicesToEntries(entries, invoices) {
  const byEntry = new Map();
  invoices.forEach((invoice) => {
    if (!invoice.financial_entry_id || byEntry.has(invoice.financial_entry_id)) return;
    byEntry.set(invoice.financial_entry_id, invoice);
  });
  return entries.map((entry) => ({ ...entry, invoice: byEntry.get(entry.id) || null }));
}

async function loadFinanceData() {
  if (!hasPermission('finance.view') || !financeIsUnlocked()) return;
  const [entryResult, projectResult, partyResult, invoiceResult] = await Promise.all([
    supabase.from('financial_entries').select(`
      *, project:projects(id,title),
      installments:financial_installments(
        id, installment_number, due_date, amount, amount_paid, status, paid_at,
        payments:financial_payments(id,amount,payment_date,payment_method,notes,created_at)
      )
    `).is('deleted_at', null).order('competence_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('projects').select('id,title').is('deleted_at', null).order('title'),
    supabase.from('financial_parties').select('*').eq('active', true).order('is_apollus', { ascending: false }).order('legal_name'),
    supabase.from('financial_invoices').select('*').order('created_at', { ascending: false }),
  ]);
  if (entryResult.error || partyResult.error || invoiceResult.error) {
    console.error(entryResult.error || partyResult.error || invoiceResult.error);
    notify('Não foi possível carregar o Financeiro/NFS-e. Confira a migração NFS-e V2 e a verificação em duas etapas.', 'error');
    return;
  }
  const entries = (entryResult.data || []).map((entry) => ({
    ...entry,
    installments: [...(entry.installments || [])].sort((a, b) => a.installment_number - b.installment_number),
  }));
  financeState.parties = partyResult.data || [];
  financeState.invoices = invoiceResult.data || [];
  financeState.entries = attachInvoicesToEntries(entries, financeState.invoices);
  financeState.projects = projectResult.data || [];
  populateProjectSelect();
  populatePartySelects();
  renderFinance();
}

function selectedMonthEntries() {
  const month = el('finance-month')?.value || monthIso();
  return financeState.entries.filter((entry) => String(entry.competence_date || '').startsWith(month));
}
function sums(entries) {
  const revenues = entries.filter((entry) => entry.entry_type === 'receita' && entry.status !== 'cancelado');
  const expenses = entries.filter((entry) => entry.entry_type === 'despesa' && entry.status !== 'cancelado');
  return {
    revenue: revenues.reduce((sum, entry) => sum + Number(entry.amount_total || 0), 0),
    expense: expenses.reduce((sum, entry) => sum + Number(entry.amount_total || 0), 0),
    received: revenues.reduce((sum, entry) => sum + Number(entry.amount_paid || 0), 0),
    paid: expenses.reduce((sum, entry) => sum + Number(entry.amount_paid || 0), 0),
    receivable: revenues.reduce((sum, entry) => sum + entryBalance(entry), 0),
    payable: expenses.reduce((sum, entry) => sum + entryBalance(entry), 0),
  };
}

function renderFinance() {
  if (!financeIsUnlocked()) return;
  renderFinanceOverview();
  renderFinanceList();
  renderFinanceReport();
  renderProjectFinanceSummary();
}

function renderFinanceOverview() {
  const entries = selectedMonthEntries();
  const total = sums(entries);
  const set = (id, value) => { if (el(id)) el(id).textContent = formatMoney(value); };
  set('finance-kpi-revenue', total.revenue);
  set('finance-kpi-expense', total.expense);
  set('finance-kpi-profit', total.revenue - total.expense);
  set('finance-kpi-receivable', total.receivable);
  set('finance-kpi-payable', total.payable);
  set('finance-kpi-realized', total.received - total.paid);
  set('overview-finance-received', total.received);
  set('overview-finance-paid', total.paid);
  set('overview-finance-profit', total.received - total.paid);
  set('overview-finance-receivable', total.receivable);
  const openReceivables = entries.filter((entry) => entry.entry_type === 'receita' && entryBalance(entry) > 0 && entry.status !== 'cancelado').length;
  const openPayables = entries.filter((entry) => entry.entry_type === 'despesa' && entryBalance(entry) > 0 && entry.status !== 'cancelado').length;
  el('finance-kpi-open-receivables').textContent = `${openReceivables} título${openReceivables === 1 ? '' : 's'} em aberto`;
  el('finance-kpi-open-payables').textContent = `${openPayables} título${openPayables === 1 ? '' : 's'} em aberto`;
  renderFinanceChart();
  renderFinanceAlerts();
  renderFinanceCategories(entries);
  renderFinanceRecent();
}

function lastSixMonths() {
  const result = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    result.push({ key: monthIso(date), label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '') });
  }
  return result;
}

function renderFinanceChart() {
  const chart = el('finance-chart');
  if (!chart) return;
  const months = lastSixMonths().map((month) => {
    const total = sums(financeState.entries.filter((entry) => String(entry.competence_date || '').startsWith(month.key)));
    return { ...month, revenue: total.revenue, expense: total.expense };
  });
  const max = Math.max(1, ...months.flatMap((month) => [month.revenue, month.expense]));
  chart.innerHTML = `<div class="finance-chart-legend"><span><i class="revenue"></i>Receitas</span><span><i class="expense"></i>Despesas</span></div><div class="finance-bars">${months.map((month) => `
    <div class="finance-bar-group" title="${escapeHtml(month.label)}: receitas ${escapeHtml(formatMoney(month.revenue))}, despesas ${escapeHtml(formatMoney(month.expense))}">
      <div class="finance-bar-values"><i class="revenue" style="height:${Math.max(3, (month.revenue / max) * 100)}%"></i><i class="expense" style="height:${Math.max(3, (month.expense / max) * 100)}%"></i></div><span>${escapeHtml(month.label)}</span>
    </div>`).join('')}</div>`;
}

function renderFinanceAlerts() {
  const box = el('finance-alerts');
  if (!box) return;
  const active = financeState.entries.filter((entry) => entry.status !== 'cancelado' && entryBalance(entry) > 0);
  const overdueReceivables = active.filter((entry) => entry.entry_type === 'receita' && entry.due_date < todayIso());
  const duePayables = active.filter((entry) => entry.entry_type === 'despesa' && entry.due_date <= todayIso());
  const pendingInvoices = financeState.entries.filter((entry) => invoiceForEntry(entry)?.status === 'pendente');
  const partial = active.filter((entry) => computedStatus(entry) === 'parcial');
  const alerts = [
    ['warning', `${overdueReceivables.length} conta(s) a receber vencida(s)`, formatMoney(overdueReceivables.reduce((sum, entry) => sum + entryBalance(entry), 0))],
    ['danger', `${duePayables.length} conta(s) a pagar vencendo/vencida(s)`, formatMoney(duePayables.reduce((sum, entry) => sum + entryBalance(entry), 0))],
    ['invoice', `${pendingInvoices.length} NFS-e pendente(s)`, formatMoney(pendingInvoices.reduce((sum, entry) => sum + Number(invoiceForEntry(entry)?.service_amount || entry.amount_total || 0), 0))],
    ['success', `${partial.length} pagamento(s) parcial(is)`, formatMoney(partial.reduce((sum, entry) => sum + entryBalance(entry), 0))],
  ].filter(([, title]) => !title.startsWith('0 '));
  box.innerHTML = alerts.length ? alerts.map(([type, title, value]) => `<button type="button" class="finance-alert-item ${type}" data-finance-view-link="${type === 'invoice' ? 'invoices' : 'transactions'}"><span>!</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(value)}</small></div><b>Ver →</b></button>`).join('') : '<div class="empty-mini">Nenhum alerta financeiro no momento.</div>';
}

function renderFinanceCategories(entries) {
  const box = el('finance-categories');
  if (!box) return;
  const expenses = entries.filter((entry) => entry.entry_type === 'despesa' && entry.status !== 'cancelado');
  const total = expenses.reduce((sum, entry) => sum + Number(entry.amount_total || 0), 0);
  const categories = new Map();
  expenses.forEach((entry) => categories.set(entry.category, (categories.get(entry.category) || 0) + Number(entry.amount_total || 0)));
  const sorted = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  box.innerHTML = sorted.length ? `<div class="category-total"><strong>${formatMoney(total)}</strong><small>Total de despesas</small></div><div>${sorted.map(([category, value], index) => `<p><i style="--category-index:${index}"></i><span>${escapeHtml(category)}</span><strong>${total ? Math.round((value / total) * 100) : 0}%</strong><small>${escapeHtml(formatMoney(value))}</small></p>`).join('')}</div>` : '<div class="empty-mini">Nenhuma despesa no mês selecionado.</div>';
}

function renderFinanceRecent() {
  const box = el('finance-recent-list');
  if (!box) return;
  const recent = financeState.entries.slice(0, 5);
  box.innerHTML = recent.length ? recent.map((entry) => financeRow(entry, true)).join('') : '<div class="empty-mini">Nenhum lançamento cadastrado.</div>';
  box.querySelectorAll('[data-finance-edit]').forEach((button) => button.addEventListener('click', () => openFinanceEntry(button.dataset.financeEdit)));
}

function financeRow(entry, compact = false) {
  const status = computedStatus(entry);
  const projectTitle = entry.project?.title || '—';
  const invoice = invoiceForEntry(entry);
  if (compact) return `<button class="finance-recent-row" type="button" data-finance-edit="${escapeHtml(entry.id)}"><span class="entry-type-dot ${entry.entry_type}"></span><div><strong>${escapeHtml(entry.description)}</strong><small>${escapeHtml(entry.category)} • ${escapeHtml(projectTitle)}</small></div><time>${escapeHtml(formatDate(entry.due_date))}</time><b>${escapeHtml(formatMoney(entry.amount_total))}</b><em class="finance-status ${status}">${escapeHtml(statusLabel(status))}</em></button>`;
  return `<tr>
    <td><button class="finance-entry-link" type="button" data-finance-edit="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.description)}</strong><small>${escapeHtml(entry.partner_name || '')}</small></button></td>
    <td><span class="entry-type-badge ${entry.entry_type}">${entry.entry_type === 'receita' ? 'Receita' : 'Despesa'}</span></td><td>${escapeHtml(entry.category)}</td><td>${escapeHtml(formatDate(entry.due_date))}</td>
    <td>${escapeHtml(formatMoney(entry.amount_total))}</td><td>${escapeHtml(formatMoney(entry.amount_paid))}</td><td><strong>${escapeHtml(formatMoney(entryBalance(entry)))}</strong></td>
    <td><span class="finance-status ${status}">${escapeHtml(statusLabel(status))}</span></td>
    <td>${invoice ? `<span class="invoice-status ${escapeHtml(invoice.status)}" title="${escapeHtml(invoiceDirectionLabel(invoice.invoice_direction))}">${escapeHtml(invoiceLabel(invoice.status))}</span>` : '<span class="invoice-status nao_necessaria">—</span>'}</td><td>${escapeHtml(projectTitle)}</td>
    <td><button class="icon-button" type="button" data-finance-edit="${escapeHtml(entry.id)}" title="Abrir">↗</button></td>
  </tr>`;
}

function currentListEntries() {
  const month = el('finance-month')?.value || monthIso();
  const search = (el('finance-search')?.value || '').trim().toLowerCase();
  const status = el('finance-status-filter')?.value || 'todos';
  const category = el('finance-category-filter')?.value || 'todos';
  return financeState.entries.filter((entry) => {
    const haystack = `${entry.description} ${entry.category} ${entry.partner_name || ''} ${entry.project?.title || ''}`.toLowerCase();
    const viewMatches = financeState.activeView === 'receivable' ? entry.entry_type === 'receita' && entryBalance(entry) > 0
      : financeState.activeView === 'payable' ? entry.entry_type === 'despesa' && entryBalance(entry) > 0
      : financeState.activeView === 'invoices' ? Boolean(invoiceForEntry(entry))
      : true;
    return String(entry.competence_date || '').startsWith(month)
      && viewMatches
      && (!search || haystack.includes(search))
      && (status === 'todos' || computedStatus(entry) === status)
      && (category === 'todos' || entry.category === category);
  });
}

function renderFinanceList() {
  if (!el('finance-entry-list')) return;
  const entries = currentListEntries();
  el('finance-entry-list').innerHTML = entries.map((entry) => financeRow(entry)).join('');
  el('finance-entry-empty').hidden = entries.length !== 0;
  el('finance-entry-list').querySelectorAll('[data-finance-edit]').forEach((button) => button.addEventListener('click', () => openFinanceEntry(button.dataset.financeEdit)));
  const total = sums(entries);
  el('finance-list-summary').innerHTML = `<span>${entries.length} lançamento${entries.length === 1 ? '' : 's'}</span><strong>Receitas: ${escapeHtml(formatMoney(total.revenue))}</strong><strong>Despesas: ${escapeHtml(formatMoney(total.expense))}</strong><strong>Saldo pendente: ${escapeHtml(formatMoney(total.receivable - total.payable))}</strong>`;
  populateCategoryFilter();
}

function renderFinanceReport() {
  const content = el('finance-report-content');
  if (!content) return;
  const month = el('finance-month')?.value || monthIso();
  const entries = selectedMonthEntries();
  const total = sums(entries);
  const monthDate = new Date(`${month}-01T12:00:00`);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(monthDate);
  el('finance-report-title').textContent = `Relatório de ${monthLabel}`;
  const invoiceIssued = entries.filter((entry) => invoiceForEntry(entry)?.status === 'emitida');
  const invoicePending = entries.filter((entry) => invoiceForEntry(entry)?.status === 'pendente');
  const invoiceReceived = entries.filter((entry) => invoiceForEntry(entry)?.invoice_direction === 'recebida');
  const byProject = new Map();
  entries.forEach((entry) => {
    const name = entry.project?.title || 'Sem projeto';
    const row = byProject.get(name) || { revenue: 0, expense: 0, received: 0, paid: 0 };
    if (entry.entry_type === 'receita') { row.revenue += Number(entry.amount_total); row.received += Number(entry.amount_paid); }
    else { row.expense += Number(entry.amount_total); row.paid += Number(entry.amount_paid); }
    byProject.set(name, row);
  });
  content.innerHTML = `<div class="report-kpis"><article><span>Faturamento previsto</span><strong>${escapeHtml(formatMoney(total.revenue))}</strong></article><article><span>Recebido</span><strong>${escapeHtml(formatMoney(total.received))}</strong></article><article><span>Despesas previstas</span><strong>${escapeHtml(formatMoney(total.expense))}</strong></article><article><span>Despesas pagas</span><strong>${escapeHtml(formatMoney(total.paid))}</strong></article><article><span>Lucro previsto</span><strong>${escapeHtml(formatMoney(total.revenue - total.expense))}</strong></article><article><span>Lucro realizado</span><strong>${escapeHtml(formatMoney(total.received - total.paid))}</strong></article></div>
    <div class="report-grid"><article class="finance-card"><h3>Notas fiscais / NFS-e</h3><p><span>Emitidas</span><strong>${invoiceIssued.length}</strong></p><p><span>Recebidas de terceiros</span><strong>${invoiceReceived.length}</strong></p><p><span>Pendentes</span><strong>${invoicePending.length}</strong></p><p><span>Valor pendente</span><strong>${escapeHtml(formatMoney(invoicePending.reduce((sum, entry) => sum + Number(invoiceForEntry(entry)?.service_amount || entry.amount_total), 0)))}</strong></p></article><article class="finance-card report-projects"><h3>Resultado por projeto</h3>${[...byProject.entries()].sort((a,b)=>(b[1].revenue-b[1].expense)-(a[1].revenue-a[1].expense)).map(([name,row])=>`<p><span>${escapeHtml(name)}</span><strong>${escapeHtml(formatMoney(row.revenue-row.expense))}</strong><small>Realizado: ${escapeHtml(formatMoney(row.received-row.paid))}</small></p>`).join('') || '<div class="empty-mini">Sem movimentações.</div>'}</article></div>`;
}

function setFinanceView(view) {
  if (view === 'invoices' && !hasPermission('finance.invoice')) view = 'transactions';
  financeState.activeView = view;
  document.querySelectorAll('[data-finance-view]').forEach((button) => button.classList.toggle('active', button.dataset.financeView === view));
  document.querySelectorAll('.finance-view').forEach((section) => section.classList.remove('active'));
  if (view === 'overview') el('finance-overview-view').classList.add('active');
  else if (view === 'reports') el('finance-reports-view').classList.add('active');
  else el('finance-list-view').classList.add('active');
  renderFinanceList();
  renderFinanceReport();
}

function populateCategoryFilter() {
  const select = el('finance-category-filter');
  if (!select) return;
  const selected = select.value || 'todos';
  const categories = [...new Set(financeState.entries.map((entry) => entry.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  select.innerHTML = '<option value="todos">Todas as categorias</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  select.value = categories.includes(selected) ? selected : 'todos';
}

function populateEntryCategories(selected = '') {
  const select = el('finance-entry-category');
  if (!select) return;
  const categories = el('finance-entry-type').value === 'receita' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
  select.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  select.value = categories.includes(selected) ? selected : categories[0];
}

function populateProjectSelect() {
  const select = el('finance-entry-project');
  if (!select) return;
  const selected = select.value;
  select.innerHTML = '<option value="">Nenhum projeto</option>' + financeState.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title)}</option>`).join('');
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function populatePartySelects(overrides = {}) {
  ['finance-invoice-provider', 'finance-invoice-customer', 'finance-invoice-intermediary'].forEach((selectId) => {
    const select = el(selectId);
    if (!select) return;
    const selected = overrides[selectId] ?? select.value;
    select.innerHTML = '<option value="">Não informado</option>' + financeState.parties.map((party) => `<option value="${escapeHtml(party.id)}">${escapeHtml(partyDisplayName(party))}${party.is_apollus ? ' • APOLLUS' : ''}</option>`).join('');
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  });
}

function invoiceRoleTargetSelect(role) {
  return { prestador: 'finance-invoice-provider', tomador: 'finance-invoice-customer', intermediario: 'finance-invoice-intermediary' }[role] || '';
}

function applyApollusRolePreset() {
  const role = el('finance-invoice-role')?.value || 'nenhum';
  const apollus = getApollusParty();
  const note = el('finance-invoice-role-note');
  if (apollus) {
    ['finance-invoice-provider', 'finance-invoice-customer', 'finance-invoice-intermediary'].forEach((selectId) => {
      if (el(selectId)?.value === apollus.id) el(selectId).value = '';
    });
  }
  if (role === 'nenhum') {
    if (note) note.textContent = 'A Apollus não será vinculada automaticamente a nenhum participante desta nota.';
    updateInvoiceSummary();
    return;
  }
  const targetId = invoiceRoleTargetSelect(role);
  if (apollus && targetId && el(targetId)) el(targetId).value = apollus.id;
  if (note) {
    note.textContent = apollus
      ? `Apollus definida como ${apollusRoleLabel(role)}. Os outros participantes continuam independentes.`
      : 'Cadastre a entidade fiscal da Apollus para preencher este papel automaticamente.';
  }
  updateInvoiceSummary();
}

function applyInvoiceDirectionPreset() {
  const direction = el('finance-invoice-direction')?.value || 'emitida';
  const suggestedRole = { emitida: 'prestador', recebida: 'tomador', intermediada: 'intermediario' }[direction] || 'nenhum';
  if (el('finance-invoice-role')) el('finance-invoice-role').value = suggestedRole;
  syncInvoiceDirectionChoices();
  applyApollusRolePreset();
}

function setInvoiceDriveLink(url = '') {
  const link = el('finance-invoice-open-drive');
  if (!link) return;
  const safe = /^https?:\/\//i.test(url) ? url : '';
  link.hidden = !safe;
  if (safe) link.href = safe;
  else link.removeAttribute('href');
  updateInvoiceSummary();
}


function syncInvoiceDirectionChoices() {
  const direction = el('finance-invoice-direction')?.value || 'emitida';
  document.querySelectorAll('input[name="finance-invoice-direction-choice"]').forEach((radio) => {
    radio.checked = radio.value === direction;
  });
}

const INVOICE_STEPS = Object.freeze([
  { key: 'identification', label: 'Identificação' },
  { key: 'parties', label: 'Pessoas' },
  { key: 'service', label: 'Serviço' },
  { key: 'values', label: 'Valores e documento' },
]);

function setInvoiceTab(tab = 'identification', { focus = false } = {}) {
  const keys = INVOICE_STEPS.map((step) => step.key);
  const index = Math.max(0, keys.indexOf(tab));
  const next = keys[index] || 'identification';

  document.querySelectorAll('[data-invoice-tab]').forEach((button) => {
    const active = button.dataset.invoiceTab === next;
    const buttonIndex = keys.indexOf(button.dataset.invoiceTab);
    button.classList.toggle('active', active);
    button.classList.toggle('completed', buttonIndex >= 0 && buttonIndex < index);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.setAttribute('aria-current', active ? 'step' : 'false');
  });

  let activePanel = null;
  document.querySelectorAll('[data-invoice-panel]').forEach((panel) => {
    const active = panel.dataset.invoicePanel === next;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
    if (active) activePanel = panel;
  });

  const prev = el('finance-invoice-prev');
  const nextButton = el('finance-invoice-next');
  const done = el('finance-invoice-done');
  const counter = el('finance-invoice-step-count');

  if (prev) prev.hidden = index === 0;
  if (nextButton) {
    const hasNext = index < INVOICE_STEPS.length - 1;
    nextButton.hidden = !hasNext;
    nextButton.textContent = hasNext ? `Próxima: ${INVOICE_STEPS[index + 1].label} →` : '';
  }
  if (done) done.hidden = index !== INVOICE_STEPS.length - 1;
  if (counter) counter.textContent = `Etapa ${index + 1} de ${INVOICE_STEPS.length}`;

  if (activePanel) {
    activePanel.scrollTop = 0;
    if (focus) {
      const heading = activePanel.querySelector('h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }
  }
}

function moveInvoiceStep(offset) {
  const active = document.querySelector('[data-invoice-tab].active')?.dataset.invoiceTab || 'identification';
  const index = INVOICE_STEPS.findIndex((step) => step.key === active);
  const target = INVOICE_STEPS[Math.min(INVOICE_STEPS.length - 1, Math.max(0, index + offset))];
  if (target) setInvoiceTab(target.key, { focus: true });
}

function updateInvoiceSummary() {
  const summary = el('finance-invoice-summary-card');
  if (!summary) return;
  const enabled = Boolean(el('finance-invoice-required')?.checked);
  summary.hidden = !enabled;
  if (!enabled) return;

  const direction = el('finance-invoice-direction')?.value || 'emitida';
  const status = el('finance-invoice-status')?.value || 'pendente';
  const role = el('finance-invoice-role')?.value || 'nenhum';
  const number = el('finance-invoice-number')?.value.trim() || '';
  const competence = el('finance-invoice-competence')?.value || '';
  const provider = getParty(el('finance-invoice-provider')?.value);
  const customer = getParty(el('finance-invoice-customer')?.value);
  const intermediary = getParty(el('finance-invoice-intermediary')?.value);

  const directionBadge = el('finance-invoice-summary-direction');
  if (directionBadge) {
    directionBadge.textContent = invoiceDirectionLabel(direction);
    directionBadge.className = `invoice-summary-badge ${direction}`;
  }

  const statusBadge = el('finance-invoice-summary-status');
  if (statusBadge) {
    statusBadge.textContent = invoiceLabel(status);
    statusBadge.className = `invoice-summary-status ${status}`;
  }

  const title = el('finance-invoice-summary-title');
  if (title) title.textContent = number ? `NFS-e ${number}` : 'NFS-e ainda sem número';

  const partyBits = [
    `Prestador: ${provider ? partyDisplayName(provider) : 'não informado'}`,
    `Tomador: ${customer ? partyDisplayName(customer) : 'não informado'}`,
  ];
  if (intermediary) partyBits.push(`Intermediário: ${partyDisplayName(intermediary)}`);
  const parties = el('finance-invoice-summary-parties');
  if (parties) parties.textContent = partyBits.join(' • ');

  const metaBits = [];
  if (competence) metaBits.push(`Competência ${formatDate(competence)}`);
  if (role !== 'nenhum') metaBits.push(`Apollus como ${apollusRoleLabel(role)}`);
  const meta = el('finance-invoice-summary-meta');
  if (meta) meta.textContent = metaBits.length ? metaBits.join(' • ') : 'Abra os dados fiscais para completar a nota.';
}

function openInvoiceDialog(tab = 'identification') {
  if (!el('finance-invoice-required')?.checked) return;
  const dialog = el('finance-invoice-dialog');
  if (!dialog) return;
  el('finance-invoice-fields').hidden = false;
  syncInvoiceDirectionChoices();
  setInvoiceTab(tab);
  updateInvoiceSummary();
  if (!dialog.open) dialog.showModal();
}

function closeInvoiceDialog() {
  closePartyEditor();
  updateInvoiceSummary();
  const dialog = el('finance-invoice-dialog');
  if (dialog?.open) dialog.close();
}

function closePartyEditor() {
  financeState.editingPartyId = null;
  financeState.partyReturnSelectId = '';
  if (el('finance-party-editor')) el('finance-party-editor').hidden = true;
  setFormMessage(el('finance-party-message'));
}

function openPartyEditor(partyId = '', returnSelectId = '') {
  if (!hasPermission('finance.invoice')) return;
  const party = getParty(partyId);
  financeState.editingPartyId = party?.id || null;
  financeState.partyReturnSelectId = returnSelectId || '';
  el('finance-party-id').value = party?.id || '';
  el('finance-party-editor-title').textContent = party ? `Editar ${party.trade_name || party.legal_name}` : 'Nova pessoa / empresa';
  el('finance-party-type').value = party?.party_type || 'empresa';
  el('finance-party-legal-name').value = party?.legal_name || '';
  el('finance-party-trade-name').value = party?.trade_name || '';
  el('finance-party-tax-id').value = party?.tax_id || '';
  el('finance-party-municipal-registration').value = party?.municipal_registration || '';
  el('finance-party-country').value = party?.country_code || 'BR';
  el('finance-party-city').value = party?.city || '';
  el('finance-party-state').value = party?.state || '';
  el('finance-party-simple-national').value = party?.simple_national === true ? 'true' : party?.simple_national === false ? 'false' : '';
  el('finance-party-tax-regime').value = party?.tax_regime || '';
  setFormMessage(el('finance-party-message'));
  el('finance-party-editor').hidden = false;
  el('finance-party-legal-name').focus();
}

async function refreshFiscalParties(selectedId = '', returnSelectId = '') {
  const { data, error } = await supabase.from('financial_parties').select('*').eq('active', true).order('is_apollus', { ascending: false }).order('legal_name');
  if (error) throw error;
  financeState.parties = data || [];
  populatePartySelects(returnSelectId && selectedId ? { [returnSelectId]: selectedId } : {});
}

async function saveFiscalParty() {
  if (!hasPermission('finance.invoice')) return;
  const button = el('finance-party-save');
  const message = el('finance-party-message');
  const legalName = el('finance-party-legal-name').value.trim();
  if (!legalName) return setFormMessage(message, 'Informe a razão social ou o nome.', 'error');
  setButtonLoading(button, true);
  try {
    const simpleRaw = el('finance-party-simple-national').value;
    const payload = {
      party_type: el('finance-party-type').value,
      legal_name: legalName,
      trade_name: el('finance-party-trade-name').value.trim() || null,
      tax_id: el('finance-party-tax-id').value.trim() || null,
      municipal_registration: el('finance-party-municipal-registration').value.trim() || null,
      country_code: (el('finance-party-country').value.trim() || 'BR').toUpperCase().slice(0, 2),
      city: el('finance-party-city').value.trim() || null,
      state: el('finance-party-state').value.trim() || null,
      simple_national: simpleRaw === '' ? null : simpleRaw === 'true',
      tax_regime: el('finance-party-tax-regime').value.trim() || null,
      updated_by: financeState.session.user.id,
    };
    let result;
    if (financeState.editingPartyId) {
      result = await supabase.from('financial_parties').update(payload).eq('id', financeState.editingPartyId).select().single();
    } else {
      payload.created_by = financeState.session.user.id;
      result = await supabase.from('financial_parties').insert(payload).select().single();
    }
    if (result.error) throw result.error;
    const returnSelectId = financeState.partyReturnSelectId;
    await refreshFiscalParties(result.data.id, returnSelectId);
    closePartyEditor();
    if (returnSelectId && el(returnSelectId)) el(returnSelectId).value = result.data.id;
    updateInvoiceSummary();
    notify('Cadastro fiscal salvo.', 'success');
  } catch (error) {
    console.error(error);
    setFormMessage(message, error.message || 'Não foi possível salvar o cadastro fiscal.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function buildInvoicePayload(entryId) {
  const driveUrl = el('finance-invoice-url').value.trim() || null;
  if (driveUrl && !/^https?:\/\//i.test(driveUrl)) throw new Error('O link da nota no Drive precisa começar com http:// ou https://.');
  const role = el('finance-invoice-role').value;
  const apollus = getApollusParty();
  const targetSelect = invoiceRoleTargetSelect(role);
  if (role !== 'nenhum' && apollus && targetSelect && el(targetSelect)?.value !== apollus.id) {
    throw new Error(`A Apollus está marcada como ${apollusRoleLabel(role)}, mas o participante correspondente não é o cadastro da Apollus.`);
  }
  return {
    financial_entry_id: entryId,
    apollus_role: role,
    invoice_direction: el('finance-invoice-direction').value,
    status: el('finance-invoice-status').value,
    competence_date: el('finance-invoice-competence').value || null,
    issue_date: el('finance-invoice-issue-date').value || null,
    invoice_number: el('finance-invoice-number').value.trim() || null,
    dps_series: el('finance-invoice-dps-series').value.trim() || null,
    dps_number: el('finance-invoice-dps-number').value.trim() || null,
    provider_party_id: el('finance-invoice-provider').value || null,
    customer_party_id: el('finance-invoice-customer').value || null,
    intermediary_party_id: el('finance-invoice-intermediary').value || null,
    service_description: el('finance-invoice-service').value.trim() || null,
    taxation_code: el('finance-invoice-tax-code').value.trim() || null,
    nbs_item: el('finance-invoice-nbs').value.trim() || null,
    incidence_city: el('finance-invoice-city').value.trim() || null,
    incidence_state: el('finance-invoice-state').value.trim() || null,
    service_amount: el('finance-invoice-amount').value === '' ? null : Number(el('finance-invoice-amount').value),
    deductions_amount: Number(el('finance-invoice-deductions').value || 0),
    iss_amount: Number(el('finance-invoice-iss').value || 0),
    net_amount: el('finance-invoice-net').value === '' ? null : Number(el('finance-invoice-net').value),
    drive_url: driveUrl,
    notes: el('finance-invoice-notes').value.trim() || null,
    updated_by: financeState.session.user.id,
  };
}

async function saveLinkedInvoice(entryId, existingInvoiceId = '') {
  const payload = buildInvoicePayload(entryId);
  let result;
  if (existingInvoiceId) result = await supabase.from('financial_invoices').update(payload).eq('id', existingInvoiceId).select().single();
  else {
    payload.created_by = financeState.session.user.id;
    result = await supabase.from('financial_invoices').insert(payload).select().single();
  }
  if (result.error) throw result.error;
  return result.data;
}

function mirrorInvoiceIntoLegacyEntryPayload(payload, invoiceEnabled, existingEntry) {
  if (!hasPermission('finance.invoice')) return;
  const customer = getParty(el('finance-invoice-customer')?.value);
  payload.invoice_required = invoiceEnabled;
  payload.invoice_status = invoiceEnabled ? el('finance-invoice-status').value : 'nao_necessaria';
  payload.invoice_number = invoiceEnabled ? el('finance-invoice-number').value.trim() || null : null;
  payload.invoice_issue_date = invoiceEnabled ? el('finance-invoice-issue-date').value || null : null;
  payload.invoice_competence = invoiceEnabled ? el('finance-invoice-competence').value || null : null;
  payload.invoice_customer = invoiceEnabled ? (customer?.trade_name || customer?.legal_name || null) : null;
  payload.invoice_customer_document = invoiceEnabled ? customer?.tax_id || null : null;
  payload.invoice_service = invoiceEnabled ? el('finance-invoice-service').value.trim() || null : null;
  payload.invoice_taxation_code = invoiceEnabled ? el('finance-invoice-tax-code').value.trim() || null : null;
  payload.invoice_nbs_item = invoiceEnabled ? el('finance-invoice-nbs').value.trim() || null : null;
  payload.invoice_city = invoiceEnabled ? [el('finance-invoice-city').value.trim(), el('finance-invoice-state').value.trim()].filter(Boolean).join('-') || 'Curitiba-PR' : existingEntry?.invoice_city || 'Curitiba-PR';
  payload.invoice_amount = invoiceEnabled && el('finance-invoice-amount').value !== '' ? Number(el('finance-invoice-amount').value) : null;
  payload.invoice_document_url = invoiceEnabled ? el('finance-invoice-url').value.trim() || null : null;
}

function resetFinanceEntryForm() {
  const form = el('finance-entry-form');
  form.reset();
  financeState.editingEntryId = null;
  closePartyEditor();
  el('finance-entry-id').value = '';
  el('finance-entry-type').value = 'receita';
  populateEntryCategories();
  el('finance-entry-competence').value = todayIso();
  el('finance-entry-due').value = todayIso();
  el('finance-entry-installments').value = '1';
  el('finance-entry-interval').value = '1';
  el('finance-invoice-direction').value = 'emitida';
  el('finance-invoice-role').value = 'prestador';
  el('finance-invoice-status').value = 'pendente';
  el('finance-invoice-competence').value = todayIso();
  el('finance-invoice-city').value = 'Curitiba';
  el('finance-invoice-state').value = 'PR';
  el('finance-invoice-deductions').value = '0';
  el('finance-invoice-iss').value = '0';
  populatePartySelects();
  syncInvoiceDirectionChoices();
  applyApollusRolePreset();
  setInvoiceDriveLink('');
  setInvoiceTab('identification');
  el('finance-invoice-fields').hidden = true;
  if (el('finance-invoice-summary-card')) el('finance-invoice-summary-card').hidden = true;
  if (el('finance-invoice-dialog')?.open) el('finance-invoice-dialog').close();
  el('finance-installments-section').hidden = true;
  el('finance-entry-delete').hidden = true;
  el('finance-entry-installments').disabled = false;
  el('finance-entry-interval').disabled = false;
  setFormMessage(el('finance-entry-message'));
}

function openFinanceEntry(id = '') {
  if (!hasPermission('finance.view') || !financeIsUnlocked()) return;
  resetFinanceEntryForm();
  const entry = financeState.entries.find((item) => item.id === id);
  if (entry) {
    financeState.editingEntryId = entry.id;
    el('finance-entry-dialog-title').textContent = 'Editar lançamento';
    el('finance-entry-id').value = entry.id;
    el('finance-entry-type').value = entry.entry_type;
    populateEntryCategories(entry.category);
    el('finance-entry-description').value = entry.description || '';
    el('finance-entry-amount').value = entry.amount_total || '';
    el('finance-entry-competence').value = entry.competence_date || '';
    el('finance-entry-due').value = entry.due_date || '';
    el('finance-entry-partner').value = entry.partner_name || '';
    el('finance-entry-document').value = entry.partner_document || '';
    el('finance-entry-project').value = entry.project_id || '';
    el('finance-entry-method').value = entry.payment_method || '';
    el('finance-entry-notes').value = entry.notes || '';
    el('finance-entry-installments').value = entry.installments?.length || 1;
    el('finance-entry-installments').disabled = true;
    el('finance-entry-interval').disabled = true;
    const invoice = invoiceForEntry(entry);
    el('finance-invoice-required').checked = Boolean(invoice);
    el('finance-invoice-fields').hidden = !invoice;
    if (invoice) {
      el('finance-invoice-direction').value = invoice.invoice_direction || 'emitida';
      el('finance-invoice-role').value = invoice.apollus_role || 'nenhum';
      el('finance-invoice-status').value = invoice.status || 'pendente';
      el('finance-invoice-number').value = invoice.invoice_number || '';
      el('finance-invoice-issue-date').value = invoice.issue_date || '';
      el('finance-invoice-competence').value = invoice.competence_date || '';
      el('finance-invoice-dps-series').value = invoice.dps_series || '';
      el('finance-invoice-dps-number').value = invoice.dps_number || '';
      populatePartySelects({
        'finance-invoice-provider': invoice.provider_party_id || '',
        'finance-invoice-customer': invoice.customer_party_id || '',
        'finance-invoice-intermediary': invoice.intermediary_party_id || '',
      });
      el('finance-invoice-service').value = invoice.service_description || '';
      el('finance-invoice-tax-code').value = invoice.taxation_code || '';
      el('finance-invoice-nbs').value = invoice.nbs_item || '';
      el('finance-invoice-city').value = invoice.incidence_city || 'Curitiba';
      el('finance-invoice-state').value = invoice.incidence_state || 'PR';
      el('finance-invoice-amount').value = invoice.service_amount ?? entry.amount_total ?? '';
      el('finance-invoice-deductions').value = invoice.deductions_amount ?? 0;
      el('finance-invoice-iss').value = invoice.iss_amount ?? 0;
      el('finance-invoice-net').value = invoice.net_amount ?? '';
      el('finance-invoice-url').value = invoice.drive_url || '';
      el('finance-invoice-notes').value = invoice.notes || '';
      setInvoiceDriveLink(invoice.drive_url || '');
      syncInvoiceDirectionChoices();
      applyApollusRolePreset();
      updateInvoiceSummary();
    } else {
      updateInvoiceSummary();
    }
    el('finance-entry-delete').hidden = !hasPermission('finance.delete');
    renderInstallments(entry);
  } else {
    el('finance-entry-dialog-title').textContent = 'Novo lançamento';
  }
  el('finance-entry-dialog').showModal();
}

function renderInstallments(entry) {
  const section = el('finance-installments-section');
  const list = el('finance-installments-list');
  if (!entry || !entry.installments?.length) { section.hidden = true; return; }
  section.hidden = false;
  list.innerHTML = entry.installments.map((installment) => {
    const balance = Math.max(0, Number(installment.amount) - Number(installment.amount_paid));
    const payments = installment.payments || [];
    return `<article class="installment-card"><header><div><strong>Parcela ${installment.installment_number}</strong><span>Vence em ${escapeHtml(formatDate(installment.due_date))}</span></div><em class="finance-status ${escapeHtml(installment.status)}">${escapeHtml(statusLabel(installment.status))}</em></header><div class="installment-values"><span>Total <strong>${escapeHtml(formatMoney(installment.amount))}</strong></span><span>Pago <strong>${escapeHtml(formatMoney(installment.amount_paid))}</strong></span><span>Saldo <strong>${escapeHtml(formatMoney(balance))}</strong></span></div>${payments.length ? `<div class="installment-payments">${payments.map((payment) => `<p><span>${escapeHtml(formatDate(payment.payment_date))} • ${escapeHtml(payment.payment_method || 'Pagamento')}</span><strong>${escapeHtml(formatMoney(payment.amount))}</strong></p>`).join('')}</div>` : ''}${balance > 0 && hasPermission('finance.edit') ? `<button type="button" class="mini-action" data-payment-installment="${escapeHtml(installment.id)}">+ Registrar pagamento parcial</button>` : ''}</article>`;
  }).join('');
  list.querySelectorAll('[data-payment-installment]').forEach((button) => button.addEventListener('click', () => openPaymentDialog(button.dataset.paymentInstallment)));
}

async function saveFinanceEntry(event) {
  event.preventDefault();
  if (!hasPermission('finance.edit')) return;
  const button = el('finance-entry-save');
  const message = el('finance-entry-message');
  setFormMessage(message);
  setButtonLoading(button, true);
  let createdEntryId = '';
  try {
    const existingEntry = financeState.entries.find((item) => item.id === financeState.editingEntryId);
    const existingInvoice = invoiceForEntry(existingEntry);
    const canManageInvoice = hasPermission('finance.invoice');
    const invoiceEnabled = canManageInvoice ? el('finance-invoice-required').checked : Boolean(existingInvoice);
    if (existingInvoice && canManageInvoice && !invoiceEnabled) {
      throw new Error('Uma NFS-e já registrada não pode ser apagada do histórico. Marque a nota como cancelada se ela não for mais válida.');
    }
    const payload = {
      entry_type: el('finance-entry-type').value,
      description: el('finance-entry-description').value.trim(),
      category: el('finance-entry-category').value,
      amount_total: Number(el('finance-entry-amount').value),
      competence_date: el('finance-entry-competence').value,
      due_date: el('finance-entry-due').value,
      partner_name: el('finance-entry-partner').value.trim() || null,
      partner_document: el('finance-entry-document').value.trim() || null,
      project_id: el('finance-entry-project').value || null,
      payment_method: el('finance-entry-method').value.trim() || null,
      notes: el('finance-entry-notes').value.trim() || null,
      updated_by: financeState.session.user.id,
    };
    if (!payload.description || !payload.amount_total || !payload.competence_date || !payload.due_date) throw new Error('Preencha os campos obrigatórios.');
    mirrorInvoiceIntoLegacyEntryPayload(payload, invoiceEnabled, existingEntry);

    let saved;
    if (financeState.editingEntryId) {
      const { data, error } = await supabase.from('financial_entries').update(payload).eq('id', financeState.editingEntryId).select().single();
      if (error) throw error;
      saved = data;
      if (invoiceEnabled && canManageInvoice) await saveLinkedInvoice(saved.id, existingInvoice?.id || '');
    } else {
      payload.created_by = financeState.session.user.id;
      const { data, error } = await supabase.from('financial_entries').insert(payload).select().single();
      if (error) throw error;
      saved = data;
      createdEntryId = saved.id;
      if (invoiceEnabled && canManageInvoice) await saveLinkedInvoice(saved.id);
      const count = Math.max(1, Number(el('finance-entry-installments').value || 1));
      const interval = Math.max(0, Number(el('finance-entry-interval').value || 1));
      const { error: installmentError } = await supabase.rpc('create_financial_installments', {
        p_entry_id: saved.id, p_count: count, p_first_due_date: payload.due_date, p_interval_months: interval,
      });
      if (installmentError) throw installmentError;
    }
    await loadFinanceData();
    el('finance-entry-dialog').close();
    notify(invoiceEnabled ? 'Lançamento e NFS-e salvos.' : 'Lançamento financeiro salvo.', 'success');
  } catch (error) {
    console.error(error);
    if (createdEntryId) {
      const { error: cleanupError } = await supabase.rpc('apollus_cleanup_failed_financial_entry', { target_id: createdEntryId });
      if (cleanupError) console.error('Falha ao limpar lançamento incompleto:', cleanupError);
    }
    setFormMessage(message, error.message || 'Não foi possível salvar o lançamento.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function openPaymentDialog(installmentId) {
  const entry = financeState.entries.find((item) => item.installments?.some((installment) => installment.id === installmentId));
  const installment = entry?.installments?.find((item) => item.id === installmentId);
  if (!entry || !installment) return;
  const balance = Math.max(0, Number(installment.amount) - Number(installment.amount_paid));
  financeState.activePaymentInstallmentId = installmentId;
  el('finance-payment-installment-id').value = installmentId;
  el('finance-payment-title').textContent = `${entry.entry_type === 'receita' ? 'Registrar recebimento' : 'Registrar pagamento'} — Parcela ${installment.installment_number}`;
  el('finance-payment-balance').innerHTML = `<span>Saldo disponível</span><strong>${escapeHtml(formatMoney(balance))}</strong>`;
  el('finance-payment-amount').value = balance.toFixed(2);
  el('finance-payment-amount').max = balance.toFixed(2);
  el('finance-payment-date').value = todayIso();
  el('finance-payment-method').value = entry.payment_method || '';
  el('finance-payment-notes').value = '';
  setFormMessage(el('finance-payment-message'));
  el('finance-payment-dialog').showModal();
}

async function savePayment(event) {
  event.preventDefault();
  if (!hasPermission('finance.edit')) return;
  const installmentId = el('finance-payment-installment-id').value;
  const amount = Number(el('finance-payment-amount').value);
  const max = Number(el('finance-payment-amount').max || 0);
  if (amount <= 0 || amount > max + 0.004) return setFormMessage(el('finance-payment-message'), 'O valor precisa ser maior que zero e não pode superar o saldo.', 'error');
  const submit = event.submitter;
  setButtonLoading(submit, true, 'Registrando...');
  const { error } = await supabase.from('financial_payments').insert({
    installment_id: installmentId, amount,
    payment_date: el('finance-payment-date').value,
    payment_method: el('finance-payment-method').value.trim() || null,
    notes: el('finance-payment-notes').value.trim() || null,
    created_by: financeState.session.user.id,
  });
  setButtonLoading(submit, false);
  if (error) return setFormMessage(el('finance-payment-message'), error.message || 'Não foi possível registrar.', 'error');
  const editingId = financeState.editingEntryId;
  el('finance-payment-dialog').close();
  await loadFinanceData();
  if (editingId) openFinanceEntry(editingId);
  notify('Pagamento parcial registrado.', 'success');
}

async function moveFinanceEntryToTrash() {
  const entry = financeState.entries.find((item) => item.id === financeState.editingEntryId);
  if (!entry || !hasPermission('finance.delete')) return;
  if (!window.confirm(`Mover “${entry.description}” para a lixeira?`)) return;

  const { data: moved, error } = await supabase.rpc('apollus_soft_delete', {
    target_entity: 'finance',
    target_id: entry.id,
  });
  if (error || moved !== true) return notify(error?.message || 'Não foi possível mover para a lixeira.', 'error');

  el('finance-entry-dialog').close();
  await loadFinanceData();
  window.dispatchEvent(new CustomEvent('apollus-trash-refresh'));
  notify('Lançamento movido para a lixeira.', 'success');
}

function exportCsv(entries, filename) {
  const headers = ['Descrição', 'Tipo', 'Categoria', 'Competência', 'Vencimento', 'Valor total', 'Pago/recebido', 'Saldo', 'Status', 'Cliente/fornecedor', 'CPF/CNPJ', 'Projeto', 'NFS-e status', 'Tipo NFS-e', 'Papel Apollus', 'Número NFS-e', 'Data emissão', 'Competência NFS-e', 'Prestador', 'Tomador', 'Intermediário', 'Serviço', 'Código tributação', 'NBS', 'Município incidência', 'UF incidência', 'Valor serviço', 'Deduções', 'ISS', 'Valor líquido', 'Link Drive'];
  const rows = entries.map((entry) => {
    const invoice = invoiceForEntry(entry);
    return [
      entry.description, entry.entry_type, entry.category, entry.competence_date, entry.due_date,
      Number(entry.amount_total).toFixed(2), Number(entry.amount_paid).toFixed(2), entryBalance(entry).toFixed(2),
      computedStatus(entry), entry.partner_name || '', entry.partner_document || '', entry.project?.title || '',
      invoice?.status || '', invoiceDirectionLabel(invoice?.invoice_direction), apollusRoleLabel(invoice?.apollus_role), invoice?.invoice_number || '', invoice?.issue_date || '', invoice?.competence_date || '',
      partyName(invoice?.provider_party_id), partyName(invoice?.customer_party_id), partyName(invoice?.intermediary_party_id), invoice?.service_description || '', invoice?.taxation_code || '', invoice?.nbs_item || '', invoice?.incidence_city || '', invoice?.incidence_state || '',
      invoice?.service_amount == null ? '' : Number(invoice.service_amount).toFixed(2), Number(invoice?.deductions_amount || 0).toFixed(2), Number(invoice?.iss_amount || 0).toFixed(2), invoice?.net_amount == null ? '' : Number(invoice.net_amount).toFixed(2), invoice?.drive_url || '',
    ];
  });
  const safeCsvCell = (value) => {
    const text = String(value ?? '');
    const hardened = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${hardened.replaceAll('"', '""')}"`;
  };
  const csv = '\ufeff' + [headers, ...rows].map((row) => row.map(safeCsvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

function renderProjectFinanceSummary() {
  const section = el('project-finance-summary');
  if (!section || !hasPermission('finance.view') || !financeIsUnlocked()) { if (section) section.hidden = true; return; }
  const projectId = el('project-id')?.value;
  if (!projectId) { section.hidden = true; return; }
  const entries = financeState.entries.filter((entry) => entry.project_id === projectId && entry.status !== 'cancelado');
  const total = sums(entries);
  section.hidden = false;
  el('project-finance-revenue').textContent = formatMoney(total.revenue);
  el('project-finance-received').textContent = formatMoney(total.received);
  el('project-finance-expense').textContent = formatMoney(total.expense);
  el('project-finance-result').textContent = formatMoney(total.received - total.paid);
}

async function loadProfiles() {
  if (!isOwner()) return;
  const [profilesResult, permissionsResult] = await Promise.all([
    supabase.from('admin_profiles').select('*').order('role').order('display_name'),
    supabase.from('admin_user_permissions').select('*'),
  ]);
  if (profilesResult.error) return notify('Não foi possível carregar os perfis.', 'error');
  financeState.profiles = profilesResult.data || [];
  financeState.profilePermissions = permissionsResult.data || [];
  renderProfiles();
}

function profilePermissionSet(userId) {
  return new Set(financeState.profilePermissions.filter((item) => item.user_id === userId && item.allowed).map((item) => item.permission_key));
}

function renderProfiles() {
  const list = el('access-profile-list');
  if (!list || !isOwner()) return;
  el('access-profile-empty').hidden = financeState.profiles.length !== 0;
  list.innerHTML = financeState.profiles.map((profile) => {
    const permissions = profilePermissionSet(profile.user_id);
    const moduleStatus = PERMISSION_GROUPS.slice(0, 5).map((group) => {
      const allowed = group.permissions.some(([key]) => permissions.has(key)) || profile.role === 'owner';
      return `<span class="access-module-chip ${allowed ? 'allowed' : 'blocked'}">${escapeHtml(group.label)} ${allowed ? '✓' : '🔒'}</span>`;
    }).join('');
    return `<article class="access-profile-card ${profile.active ? '' : 'inactive'}"><header><div class="access-avatar">${escapeHtml((profile.display_name || '?').slice(0, 1).toUpperCase())}</div><div><h3>${escapeHtml(profile.display_name)}</h3><p>${escapeHtml(profile.email)}</p></div><span class="access-role ${escapeHtml(profile.role)}">${escapeHtml(roleLabel(profile.role))}</span></header><div class="access-status-row"><span class="${profile.active ? 'active' : 'inactive'}">${profile.active ? '● Acesso ativo' : '○ Acesso desativado'}</span><span>${profile.require_mfa ? '🔒 MFA obrigatório' : 'MFA opcional'}</span></div><div class="access-module-list">${moduleStatus}</div><footer><button type="button" class="admin-btn secondary" data-profile-edit="${escapeHtml(profile.user_id)}">Editar acessos</button>${profile.user_id !== OWNER_ID ? `<button type="button" class="admin-btn ${profile.active ? 'danger' : 'restore'}" data-profile-toggle="${escapeHtml(profile.user_id)}">${profile.active ? 'Desativar' : 'Reativar'}</button><button type="button" class="admin-btn danger" data-profile-delete="${escapeHtml(profile.user_id)}" title="Remover acesso ao painel">Remover acesso</button>` : '<span class="owner-lock">Perfil protegido</span>'}</footer></article>`;
  }).join('');
  list.querySelectorAll('[data-profile-edit]').forEach((button) => button.addEventListener('click', () => openProfileForm(button.dataset.profileEdit)));
  list.querySelectorAll('[data-profile-toggle]').forEach((button) => button.addEventListener('click', () => toggleProfile(button.dataset.profileToggle)));
  list.querySelectorAll('[data-profile-delete]').forEach((button) => button.addEventListener('click', () => deleteProfile(button.dataset.profileDelete)));
}

function renderPermissionEditor(selected = new Set()) {
  const grid = el('access-permissions-grid');
  grid.innerHTML = PERMISSION_GROUPS.map((group) => `<article class="permission-group"><header><strong>${escapeHtml(group.label)}</strong><button type="button" data-permission-group="${escapeHtml(group.key)}">Marcar grupo</button></header>${group.permissions.map(([key, label]) => `<label><input type="checkbox" value="${escapeHtml(key)}" ${selected.has(key) ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`).join('')}</article>`).join('');
  grid.querySelectorAll('[data-permission-group]').forEach((button) => button.addEventListener('click', () => {
    const group = PERMISSION_GROUPS.find((item) => item.key === button.dataset.permissionGroup);
    const checkboxes = group.permissions.map(([key]) => grid.querySelector(`input[value="${CSS.escape(key)}"]`));
    const shouldCheck = checkboxes.some((checkbox) => !checkbox.checked);
    checkboxes.forEach((checkbox) => { checkbox.checked = shouldCheck; });
    enforceFinanceMfa();
  }));
  grid.querySelectorAll('input').forEach((input) => input.addEventListener('change', enforceFinanceMfa));
}

function applyRoleTemplate(role) {
  if (role === 'custom') return;
  const selected = new Set(ROLE_TEMPLATES[role] || []);
  renderPermissionEditor(selected);
  enforceFinanceMfa();
}
function enforceFinanceMfa() {
  const hasFinance = [...el('access-permissions-grid').querySelectorAll('input:checked')].some((input) => input.value.startsWith('finance.'));
  if (hasFinance) el('access-profile-require-mfa').checked = true;
}

function openProfileForm(userId = '') {
  const profile = financeState.profiles.find((item) => item.user_id === userId);
  el('access-profile-form').reset();
  el('access-profile-user-id').value = profile?.user_id || '';
  el('access-profile-auth-user-id').value = profile?.user_id || '';
  el('access-profile-auth-user-id').readOnly = Boolean(profile);
  el('access-profile-title').textContent = profile ? 'Editar perfil e acessos' : 'Vincular usuário existente';
  el('access-profile-name').value = profile?.display_name || '';
  el('access-profile-email').value = profile?.email || '';
  el('access-profile-role').value = profile?.role === 'owner' ? 'custom' : profile?.role || 'editor';
  el('access-profile-active').checked = profile ? profile.active : true;
  el('access-profile-require-mfa').checked = profile ? profile.require_mfa : false;
  const selected = profile ? profilePermissionSet(profile.user_id) : new Set(ROLE_TEMPLATES.editor);
  renderPermissionEditor(profile?.role === 'owner' ? new Set(ALL_PERMISSIONS) : selected);
  const locked = profile?.user_id === OWNER_ID;
  el('access-profile-auth-user-id').disabled = locked;
  el('access-profile-email').disabled = locked;
  el('access-profile-role').disabled = locked;
  el('access-profile-active').disabled = locked;
  el('access-profile-require-mfa').disabled = locked;
  el('access-permissions-grid').querySelectorAll('input,button').forEach((control) => { control.disabled = locked; });
  setFormMessage(el('access-profile-message'));
  el('access-profile-dialog').showModal();
}

async function ensureOwnerMfa() {
  if (!isOwner()) throw new Error('Somente o proprietário pode administrar perfis.');
  await refreshMfaState();
  if (financeState.mfa.currentLevel !== 'aal2') {
    const verified = await verifyExistingMfa();
    if (!verified) throw new Error('Confirme a autenticação em duas etapas para continuar.');
  }
}

async function saveAdminProfileDirect(profile, permissions) {
  await ensureOwnerMfa();
  const { error } = await supabase.rpc('owner_save_admin_profile', {
    target_user_id: profile.user_id,
    target_display_name: profile.display_name,
    target_email: profile.email,
    target_role: profile.role,
    target_active: profile.active,
    target_require_mfa: profile.require_mfa,
    target_permissions: permissions,
  });
  if (error) throw new Error(error.message || 'Não foi possível salvar o perfil.');
}

async function saveProfile(event) {
  event.preventDefault();
  if (!isOwner()) return;
  const editingUserId = el('access-profile-user-id').value;
  const authUserId = (editingUserId || el('access-profile-auth-user-id').value).trim();
  const permissions = [...el('access-permissions-grid').querySelectorAll('input:checked')].map((input) => input.value);
  const profile = {
    user_id: authUserId,
    display_name: el('access-profile-name').value.trim(),
    email: el('access-profile-email').value.trim(),
    role: el('access-profile-role').value,
    active: el('access-profile-active').checked,
    require_mfa: el('access-profile-require-mfa').checked,
  };
  const button = el('access-profile-save');
  setButtonLoading(button, true, editingUserId ? 'Salvando...' : 'Vinculando...');
  setFormMessage(el('access-profile-message'));
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authUserId)) {
      throw new Error('Cole o UID completo do usuário criado em Authentication → Users.');
    }
    await saveAdminProfileDirect(profile, permissions);
    el('access-profile-dialog').close();
    await loadProfiles();
    notify(editingUserId ? 'Perfil e permissões atualizados.' : 'Usuário vinculado ao painel com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    setFormMessage(el('access-profile-message'), error.message || 'Não foi possível salvar o perfil.', 'error');
  } finally { setButtonLoading(button, false); }
}

async function toggleProfile(userId) {
  const profile = financeState.profiles.find((item) => item.user_id === userId);
  if (!profile || userId === OWNER_ID) return;
  if (!window.confirm(`${profile.active ? 'Desativar' : 'Reativar'} o acesso de ${profile.display_name}?`)) return;
  try {
    await saveAdminProfileDirect({ ...profile, active: !profile.active }, [...profilePermissionSet(userId)]);
    await loadProfiles();
    notify(profile.active ? 'Acesso ao painel desativado.' : 'Acesso ao painel reativado.', 'success');
  } catch (error) { notify(error.message, 'error'); }
}

async function deleteProfile(userId) {
  const profile = financeState.profiles.find((item) => item.user_id === userId);
  if (!profile || userId === OWNER_ID) return;
  const confirmation = window.prompt(`Para remover ${profile.display_name} do painel Apollus, digite REMOVER. A conta de login continuará existindo no Supabase.`);
  if (confirmation !== 'REMOVER') return;
  try {
    await ensureOwnerMfa();
    const { error } = await supabase.rpc('owner_remove_admin_profile', { target_user_id: userId });
    if (error) throw new Error(error.message || 'Não foi possível remover o acesso.');
    await loadProfiles();
    notify('Acesso administrativo removido. A conta Auth não foi excluída.', 'success');
  } catch (error) { notify(error.message, 'error'); }
}

function setupDashboardModuleEvents() {
  el('finance-month').value = monthIso();
  el('finance-new-entry')?.addEventListener('click', () => openFinanceEntry());
  el('finance-entry-form')?.addEventListener('submit', saveFinanceEntry);
  el('finance-payment-form')?.addEventListener('submit', savePayment);
  el('finance-entry-delete')?.addEventListener('click', moveFinanceEntryToTrash);
  el('finance-entry-type')?.addEventListener('change', () => populateEntryCategories());
  el('finance-invoice-required')?.addEventListener('change', () => {
    const existingEntry = financeState.entries.find((item) => item.id === financeState.editingEntryId);
    if (!el('finance-invoice-required').checked && invoiceForEntry(existingEntry)) {
      el('finance-invoice-required').checked = true;
      el('finance-invoice-fields').hidden = false;
      updateInvoiceSummary();
      notify('NFS-e já registrada: para preservar o histórico, altere o status para Cancelada em vez de remover.', 'error');
      return;
    }

    const enabled = el('finance-invoice-required').checked;
    el('finance-invoice-fields').hidden = !enabled;
    if (!enabled) {
      if (el('finance-invoice-dialog')?.open) closeInvoiceDialog();
      updateInvoiceSummary();
      return;
    }

    if (!el('finance-invoice-amount').value) el('finance-invoice-amount').value = el('finance-entry-amount').value || '';
    if (!el('finance-invoice-net').value) el('finance-invoice-net').value = el('finance-entry-amount').value || '';
    if (!el('finance-invoice-competence').value) el('finance-invoice-competence').value = el('finance-entry-competence').value || todayIso();
    applyInvoiceDirectionPreset();
    updateInvoiceSummary();
    openInvoiceDialog('identification');
  });

  el('finance-invoice-open')?.addEventListener('click', () => openInvoiceDialog('identification'));
  el('finance-invoice-dialog-close')?.addEventListener('click', closeInvoiceDialog);
  el('finance-invoice-prev')?.addEventListener('click', () => moveInvoiceStep(-1));
  el('finance-invoice-next')?.addEventListener('click', () => moveInvoiceStep(1));
  el('finance-invoice-done')?.addEventListener('click', closeInvoiceDialog);
  document.querySelectorAll('[data-invoice-tab]').forEach((button) => button.addEventListener('click', () => setInvoiceTab(button.dataset.invoiceTab, { focus: true })));

  document.querySelectorAll('input[name="finance-invoice-direction-choice"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      el('finance-invoice-direction').value = radio.value;
      applyInvoiceDirectionPreset();
      updateInvoiceSummary();
    });
  });

  el('finance-invoice-direction')?.addEventListener('change', () => {
    syncInvoiceDirectionChoices();
    applyInvoiceDirectionPreset();
    updateInvoiceSummary();
  });
  el('finance-invoice-role')?.addEventListener('change', applyApollusRolePreset);
  el('finance-invoice-url')?.addEventListener('input', (event) => setInvoiceDriveLink(event.target.value.trim()));

  [
    'finance-invoice-status', 'finance-invoice-number', 'finance-invoice-issue-date',
    'finance-invoice-competence', 'finance-invoice-dps-series', 'finance-invoice-dps-number',
    'finance-invoice-provider', 'finance-invoice-customer', 'finance-invoice-intermediary',
    'finance-invoice-service', 'finance-invoice-tax-code', 'finance-invoice-nbs',
    'finance-invoice-city', 'finance-invoice-state', 'finance-invoice-amount',
    'finance-invoice-deductions', 'finance-invoice-iss', 'finance-invoice-net',
    'finance-invoice-notes',
  ].forEach((id) => {
    el(id)?.addEventListener('input', updateInvoiceSummary);
    el(id)?.addEventListener('change', updateInvoiceSummary);
  });

  el('finance-entry-amount')?.addEventListener('input', () => {
    if (!el('finance-invoice-required')?.checked) return;
    if (!el('finance-invoice-amount').value) el('finance-invoice-amount').value = el('finance-entry-amount').value || '';
    if (!el('finance-invoice-net').value) el('finance-invoice-net').value = el('finance-entry-amount').value || '';
    updateInvoiceSummary();
  });
  el('finance-entry-competence')?.addEventListener('change', () => {
    if (!el('finance-invoice-required')?.checked) return;
    if (!el('finance-invoice-competence').value) el('finance-invoice-competence').value = el('finance-entry-competence').value || todayIso();
    updateInvoiceSummary();
  });

  el('finance-party-new')?.addEventListener('click', () => {
    setInvoiceTab('parties');
    openPartyEditor();
  });
  document.querySelectorAll('[data-party-edit-from]').forEach((button) => button.addEventListener('click', () => {
    setInvoiceTab('parties');
    const selectId = button.dataset.partyEditFrom;
    const partyId = el(selectId)?.value || '';
    if (!partyId) return openPartyEditor('', selectId);
    openPartyEditor(partyId, selectId);
  }));
  el('finance-party-editor-close')?.addEventListener('click', closePartyEditor);
  el('finance-party-editor-cancel')?.addEventListener('click', closePartyEditor);
  el('finance-party-save')?.addEventListener('click', saveFiscalParty);
  el('finance-month')?.addEventListener('change', renderFinance);
  ['finance-search', 'finance-status-filter', 'finance-category-filter'].forEach((id) => el(id)?.addEventListener(id === 'finance-search' ? 'input' : 'change', renderFinanceList));
  document.querySelectorAll('[data-finance-view]').forEach((button) => button.addEventListener('click', () => setFinanceView(button.dataset.financeView)));
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-finance-view-link]');
    if (link) setFinanceView(link.dataset.financeViewLink);
    const projectAction = event.target.closest('[data-project-edit], [data-kanban-project]');
    if (projectAction) window.setTimeout(renderProjectFinanceSummary, 80);
  });
  el('finance-export-current')?.addEventListener('click', () => exportCsv(currentListEntries(), `apollus-financeiro-${el('finance-month').value}.csv`));
  el('finance-report-csv')?.addEventListener('click', () => exportCsv(selectedMonthEntries(), `apollus-relatorio-${el('finance-month').value}.csv`));
  el('finance-print-report')?.addEventListener('click', () => window.print());
  el('project-finance-open')?.addEventListener('click', () => {
    el('project-dialog')?.close();
    document.querySelector('[data-admin-tab="finance"]')?.click();
    setFinanceView('transactions');
    const projectId = el('project-id')?.value;
    const project = financeState.projects.find((item) => item.id === projectId);
    if (project && el('finance-search')) { el('finance-search').value = project.title; renderFinanceList(); }
  });

  el('access-new-profile')?.addEventListener('click', () => openProfileForm());
  el('access-profile-form')?.addEventListener('submit', saveProfile);
  el('access-profile-role')?.addEventListener('change', (event) => applyRoleTemplate(event.target.value));
  el('access-permissions-clear')?.addEventListener('click', () => renderPermissionEditor(new Set()));

  el('security-enroll-mfa')?.addEventListener('click', beginMfaEnrollment);
  el('security-verify-mfa')?.addEventListener('click', verifyExistingMfa);
  el('security-remove-mfa')?.addEventListener('click', removeMfaFactor);
  el('finance-unlock')?.addEventListener('click', verifyExistingMfa);
  el('security-signout-others')?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    notify(error ? error.message : 'Outras sessões encerradas.', error ? 'error' : 'success');
  });
  el('security-signout-all')?.addEventListener('click', async () => {
    if (!window.confirm('Sair de todos os dispositivos, inclusive deste?')) return;
    await supabase.auth.signOut({ scope: 'global' });
    window.location.replace('login.html');
  });
  window.addEventListener('apollus-access-refresh', () => {
    applyAccessVisibility();
  });
  window.addEventListener('apollus-finance-refresh', async () => {
    if (hasPermission('finance.view') && financeIsUnlocked()) await loadFinanceData();
  });
}

async function initializeDashboardModule() {
  const loaded = await loadCurrentAccess();
  if (!loaded) return;
  ensureSecurityDialogs();
  applyAccessVisibility();
  setupDashboardModuleEvents();
  await refreshMfaState();
  renderSecurity();

  if (isOwner()) await loadProfiles();
  if (hasPermission('finance.view')) {
    await updateFinanceLock();
    const verifiedFactor = financeState.mfa.verifiedFactors[0];
    if (financeState.profile.require_mfa && verifiedFactor && financeState.mfa.currentLevel !== 'aal2') {
      await verifyExistingMfa();
    }
  }
  if (localStorage.getItem('apollus-open-security') === '1') {
    localStorage.removeItem('apollus-open-security');
    document.querySelector('[data-admin-tab="security"]')?.click();
  }
}

async function secureLogin(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!isSupabaseConfigured || !supabase) return;
  const submit = el('login-submit');
  const message = el('login-message');
  setButtonLoading(submit, true, 'Entrando...');
  setFormMessage(message);
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: el('login-email').value.trim(), password: el('login-password').value,
    });
    if (error) throw new Error('E-mail ou senha inválidos.');
    const { data: adminAllowed } = await supabase.rpc('is_admin');
    if (adminAllowed !== true) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error('Esse usuário não possui acesso administrativo ativo.');
    }
    const session = await getSession();
    const { data: profile } = await supabase.from('admin_profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    if (profile?.require_mfa) {
      financeState.session = session;
      financeState.profile = profile;
      await refreshMfaState();
      const factor = financeState.mfa.verifiedFactors[0];
      if (factor && financeState.mfa.currentLevel !== 'aal2') {
        const code = await requestMfaCode('Confirmar acesso ao painel', 'Sua conta exige verificação em duas etapas.');
        if (!code) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('A verificação foi cancelada.');
        }
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
        if (verifyError) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('Código de autenticação inválido.');
        }
      } else if (!factor) {
        localStorage.setItem('apollus-open-security', '1');
      }
    }
    window.location.replace('dashboard.html');
  } catch (error) {
    setFormMessage(message, error.message || 'Não foi possível entrar.', 'error');
    setButtonLoading(submit, false);
  }
}

async function init() {
  if (!supabase) return;
  ensureSecurityDialogs();
  const page = document.body.dataset.adminPage;
  if (page === 'login') {
    el('login-form')?.addEventListener('submit', secureLogin, true);
    return;
  }
  if (page === 'dashboard') await initializeDashboardModule();
}

init().catch((error) => console.error('Falha no módulo Financeiro e Acessos:', error));
