import { supabase, isSupabaseConfigured } from '../supabase-config.js';

const grantsState = {
  session: null,
  canView: false,
  canEdit: false,
  opportunities: [],
  applications: [],
  sections: [],
  requirements: [],
  projects: [],
  profiles: [],
  editingOpportunityId: null,
  editingApplicationId: null,
  editingRequirementId: null,
  workspaceTab: 'summary',
  drafts: new Map(),
};

const DEFAULT_SECTIONS = [
  ['apresentacao', 'Apresentação do projeto'],
  ['justificativa', 'Justificativa'],
  ['objetivo_geral', 'Objetivo geral'],
  ['objetivos_especificos', 'Objetivos específicos'],
  ['publico_alvo', 'Público-alvo'],
  ['metodologia', 'Metodologia / execução'],
  ['acessibilidade', 'Acessibilidade'],
  ['democratizacao', 'Democratização de acesso'],
  ['contrapartidas', 'Contrapartidas'],
  ['comunicacao', 'Plano de comunicação'],
  ['cronograma', 'Cronograma / etapas'],
  ['indicadores', 'Indicadores e resultados'],
];

const STATUS_LABELS = {
  rascunho: 'Rascunho', aberto: 'Aberto', encerrado: 'Encerrado', cancelado: 'Cancelado', arquivado: 'Arquivado',
  em_redacao: 'Em redação', revisao: 'Em revisão', pronto_envio: 'Pronto para envio', enviado: 'Enviado',
  habilitado: 'Habilitado', inabilitado: 'Inabilitado', em_analise: 'Em análise', aprovado: 'Aprovado',
  suplente: 'Suplente', nao_selecionado: 'Não selecionado', recurso: 'Recurso',
};

const TERMINAL_APPLICATION_STATUSES = new Set(['aprovado', 'suplente', 'nao_selecionado', 'inabilitado', 'cancelado']);

function el(id) { return document.getElementById(id); }
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}
function formatDate(value) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR').format(date);
}
function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
function datetimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function statusLabel(status) { return STATUS_LABELS[status] || status || '—'; }
function typeLabel(type) {
  return {
    edital: 'Edital', premio: 'Prêmio', chamamento: 'Chamamento', lei_incentivo: 'Lei de incentivo',
    patrocinio: 'Patrocínio', outros: 'Outros',
  }[type] || type || 'Oportunidade';
}
function requirementTypeLabel(type) {
  return {
    documento: 'Documento', declaracao: 'Declaração', certidao: 'Certidão', portfolio: 'Portfólio', curriculo: 'Currículo',
    orcamento: 'Orçamento', contrapartida: 'Contrapartida', requisito: 'Requisito', outros: 'Outros',
  }[type] || type;
}
function notify(message, type = 'success') {
  const box = el('admin-global-message');
  if (!box) return;
  box.textContent = message;
  box.className = `admin-alert ${type}`;
  box.hidden = false;
  window.setTimeout(() => { box.hidden = true; }, 6000);
}
function setFormMessage(target, message = '', type = '') {
  if (!target) return;
  target.textContent = message;
  target.className = `form-message${type ? ` ${type}` : ''}`;
}
function setButtonLoading(button, loading, text = 'Salvando...') {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}
function projectById(id) { return grantsState.projects.find((item) => item.id === id); }
function profileById(id) { return grantsState.profiles.find((item) => item.user_id === id); }
function opportunityById(id) { return grantsState.opportunities.find((item) => item.id === id); }
function applicationById(id) { return grantsState.applications.find((item) => item.id === id); }
function deadlineMeta(value) {
  if (!value) return { label: 'Sem prazo informado', urgent: false, overdue: false, days: null };
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return { label: 'Prazo inválido', urgent: false, overdue: false, days: null };
  const now = new Date();
  const days = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
  if (days < 0) return { label: `Encerrado há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`, urgent: false, overdue: true, days };
  if (days === 0) return { label: 'Encerra hoje', urgent: true, overdue: false, days };
  if (days === 1) return { label: 'Encerra amanhã', urgent: true, overdue: false, days };
  return { label: `${days} dias restantes`, urgent: days <= 7, overdue: false, days };
}

async function loadAccess() {
  const { data: sessionData } = await supabase.auth.getSession();
  grantsState.session = sessionData.session;
  if (!grantsState.session) return false;
  const [viewResult, editResult] = await Promise.all([
    supabase.rpc('has_permission', { requested_permission: 'projects.view' }),
    supabase.rpc('has_permission', { requested_permission: 'projects.edit' }),
  ]);
  grantsState.canView = !viewResult.error && Boolean(viewResult.data);
  grantsState.canEdit = !editResult.error && Boolean(editResult.data);
  return grantsState.canView;
}

async function loadGrantData({ quiet = false } = {}) {
  if (!grantsState.canView) return;
  captureGrantDrafts();
  if (!quiet) {
    el('grants-loading').hidden = false;
    el('grants-list').innerHTML = '';
  }

  const [oppResult, appResult, sectionResult, reqResult, projectResult, profileResult] = await Promise.all([
    supabase.from('grant_opportunities').select('*').order('deadline_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
    supabase.from('grant_applications').select('*').order('created_at', { ascending: false }),
    supabase.from('grant_application_sections').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('grant_application_requirements').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('projects').select('id,title,status,category').is('deleted_at', null).order('title'),
    supabase.from('admin_contacts').select('user_id,name,email,active').eq('active', true).order('name'),
  ]);

  const namedResults = [
    ['editais', oppResult],
    ['inscrições', appResult],
    ['seções', sectionResult],
    ['requisitos', reqResult],
    ['projetos', projectResult],
  ];
  const errors = namedResults.filter(([, result]) => result.error);
  el('grants-loading').hidden = true;
  if (errors.length) {
    console.error('Erro ao carregar Editais:', errors.map(([source, result]) => ({ source, error: result.error })));
    const firstSource = errors[0][0];
    notify(`Não foi possível carregar Editais (${firstSource}). Abra o Console para ver o erro do Supabase.`, 'error');
    return;
  }

  if (profileResult.error) {
    console.warn('Diretório de responsáveis indisponível; Editais continuará sem a lista de responsáveis.', profileResult.error);
  }

  grantsState.opportunities = oppResult.data || [];
  grantsState.applications = appResult.data || [];
  grantsState.sections = sectionResult.data || [];
  grantsState.requirements = reqResult.data || [];
  grantsState.projects = projectResult.data || [];
  grantsState.profiles = profileResult.error ? [] : (profileResult.data || []);
  populateGrantSelects();
  renderGrantPanel();
}

function populateGrantSelects() {
  const projectOptions = grantsState.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title)}</option>`).join('');
  ['grant-application-project'].forEach((id) => {
    const select = el(id);
    if (select) select.innerHTML = `<option value="">Projeto ainda não vinculado</option>${projectOptions}`;
  });
  const profileOptions = grantsState.profiles.map((profile) => `<option value="${escapeHtml(profile.user_id)}">${escapeHtml(profile.name || profile.email || 'Administrador')}</option>`).join('');
  ['grant-application-responsible'].forEach((id) => {
    const select = el(id);
    if (select) select.innerHTML = `<option value="">Sem responsável definido</option>${profileOptions}`;
  });
}

function renderGrantPanel() {
  renderGrantStats();
  renderGrantList();
}

function renderGrantStats() {
  const activeOpps = grantsState.opportunities.filter((opp) => opp.status === 'aberto').length;
  const activeApps = grantsState.applications.filter((app) => !TERMINAL_APPLICATION_STATUSES.has(app.status)).length;
  const nextSeven = grantsState.opportunities.filter((opp) => {
    if (opp.status !== 'aberto' || !opp.deadline_at) return false;
    const meta = deadlineMeta(opp.deadline_at);
    return meta.days !== null && meta.days >= 0 && meta.days <= 7;
  }).length;
  const activeAppIds = new Set(grantsState.applications.filter((app) => !TERMINAL_APPLICATION_STATUSES.has(app.status)).map((app) => app.id));
  const pendingRequirements = grantsState.requirements.filter((req) => activeAppIds.has(req.application_id) && req.required && !req.completed).length;
  el('grants-stat-open').textContent = String(activeOpps);
  el('grants-stat-applications').textContent = String(activeApps);
  el('grants-stat-deadlines').textContent = String(nextSeven);
  el('grants-stat-pending').textContent = String(pendingRequirements);
}

function renderGrantList() {
  const list = el('grants-list');
  const empty = el('grants-empty');
  const search = (el('grants-search')?.value || '').trim().toLowerCase();
  const status = el('grants-status-filter')?.value || 'todos';
  const rows = grantsState.opportunities.filter((opp) => {
    const haystack = `${opp.title || ''} ${opp.organization || ''} ${opp.area || ''} ${opp.territory || ''}`.toLowerCase();
    return (!search || haystack.includes(search)) && (status === 'todos' || opp.status === status);
  });

  empty.hidden = rows.length > 0;
  list.innerHTML = rows.map((opp) => {
    const apps = grantsState.applications.filter((app) => app.opportunity_id === opp.id);
    const deadline = deadlineMeta(opp.deadline_at);
    const amount = opp.min_amount != null && opp.max_amount != null
      ? `${formatMoney(opp.min_amount)} a ${formatMoney(opp.max_amount)}`
      : opp.max_amount != null ? `Até ${formatMoney(opp.max_amount)}` : opp.min_amount != null ? `A partir de ${formatMoney(opp.min_amount)}` : 'Valor não informado';
    const appChips = apps.slice(0, 3).map((app) => {
      const project = projectById(app.project_id);
      return `<button class="grant-application-chip" data-grant-open-application="${escapeHtml(app.id)}" type="button"><strong>${escapeHtml(project?.title || app.application_name || 'Inscrição')}</strong><span>${escapeHtml(statusLabel(app.status))}</span></button>`;
    }).join('');
    const remaining = apps.length - 3;
    return `<article class="grant-opportunity-card">
      <div class="grant-opportunity-main">
        <div class="grant-opportunity-meta">
          <span class="grant-type-badge">${escapeHtml(typeLabel(opp.opportunity_type))}</span>
          <span class="grant-status-badge ${escapeHtml(opp.status)}">${escapeHtml(statusLabel(opp.status))}</span>
          ${deadline.urgent && !deadline.overdue ? '<span class="grant-alert-badge">Prazo próximo</span>' : ''}
        </div>
        <h3>${escapeHtml(opp.title)}</h3>
        <p>${escapeHtml(opp.organization || 'Organização não informada')}${opp.area ? ` · ${escapeHtml(opp.area)}` : ''}</p>
        <div class="grant-opportunity-facts">
          <span><small>Prazo</small><strong>${escapeHtml(opp.deadline_at ? formatDateTime(opp.deadline_at) : 'Não informado')}</strong><em class="${deadline.urgent ? 'urgent' : deadline.overdue ? 'overdue' : ''}">${escapeHtml(deadline.label)}</em></span>
          <span><small>Faixa de recurso</small><strong>${escapeHtml(amount)}</strong></span>
          <span><small>Inscrições</small><strong>${apps.length}</strong></span>
        </div>
      </div>
      <div class="grant-opportunity-side">
        <div class="grant-card-actions">
          ${opp.source_url ? `<a class="mini-action" href="${escapeHtml(opp.source_url)}" target="_blank" rel="noopener">Abrir fonte ↗</a>` : ''}
          <button class="mini-action" data-grant-edit-opportunity="${escapeHtml(opp.id)}" type="button">Detalhes</button>
          ${grantsState.canEdit ? `<button class="admin-btn primary grant-card-primary" data-grant-new-application="${escapeHtml(opp.id)}" type="button">+ Inscrição</button>` : ''}
        </div>
        <div class="grant-application-chips">${appChips}${remaining > 0 ? `<span class="grant-more-apps">+${remaining} inscrição${remaining === 1 ? '' : 'ões'}</span>` : ''}</div>
      </div>
    </article>`;
  }).join('');
}

function resetOpportunityForm() {
  el('grant-opportunity-form').reset();
  el('grant-opportunity-id').value = '';
  el('grant-opportunity-type').value = 'edital';
  el('grant-opportunity-status').value = 'aberto';
  el('grant-opportunity-title-heading').textContent = 'Novo edital / oportunidade';
  setFormMessage(el('grant-opportunity-message'));
  grantsState.editingOpportunityId = null;
}

function openOpportunityDialog(id = null) {
  resetOpportunityForm();
  if (id) {
    const opp = opportunityById(id);
    if (!opp) return;
    grantsState.editingOpportunityId = id;
    el('grant-opportunity-id').value = id;
    el('grant-opportunity-title-heading').textContent = 'Editar edital / oportunidade';
    el('grant-opportunity-title').value = opp.title || '';
    el('grant-opportunity-organization').value = opp.organization || '';
    el('grant-opportunity-type').value = opp.opportunity_type || 'edital';
    el('grant-opportunity-status').value = opp.status || 'aberto';
    el('grant-opportunity-area').value = opp.area || '';
    el('grant-opportunity-territory').value = opp.territory || '';
    el('grant-opportunity-opening').value = opp.opening_date || '';
    el('grant-opportunity-deadline').value = datetimeLocalValue(opp.deadline_at);
    el('grant-opportunity-min').value = opp.min_amount ?? '';
    el('grant-opportunity-max').value = opp.max_amount ?? '';
    el('grant-opportunity-source-url').value = opp.source_url || '';
    el('grant-opportunity-drive-url').value = opp.drive_url || '';
    el('grant-opportunity-summary').value = opp.summary || '';
    el('grant-opportunity-eligibility').value = opp.eligibility_notes || '';
    el('grant-opportunity-notes').value = opp.notes || '';
  }
  el('grant-opportunity-form').querySelectorAll('input, select, textarea').forEach((control) => { control.disabled = !grantsState.canEdit; });
  el('grant-opportunity-save').hidden = !grantsState.canEdit;
  el('grant-opportunity-dialog').showModal();
}

async function saveOpportunity(event) {
  event.preventDefault();
  if (!grantsState.canEdit) return;
  const button = el('grant-opportunity-save');
  const message = el('grant-opportunity-message');
  setFormMessage(message);
  setButtonLoading(button, true);
  try {
    const deadlineRaw = el('grant-opportunity-deadline').value;
    const payload = {
      title: el('grant-opportunity-title').value.trim(),
      organization: el('grant-opportunity-organization').value.trim() || null,
      opportunity_type: el('grant-opportunity-type').value,
      status: el('grant-opportunity-status').value,
      area: el('grant-opportunity-area').value.trim() || null,
      territory: el('grant-opportunity-territory').value.trim() || null,
      opening_date: el('grant-opportunity-opening').value || null,
      deadline_at: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
      min_amount: el('grant-opportunity-min').value === '' ? null : Number(el('grant-opportunity-min').value),
      max_amount: el('grant-opportunity-max').value === '' ? null : Number(el('grant-opportunity-max').value),
      source_url: el('grant-opportunity-source-url').value.trim() || null,
      drive_url: el('grant-opportunity-drive-url').value.trim() || null,
      summary: el('grant-opportunity-summary').value.trim() || null,
      eligibility_notes: el('grant-opportunity-eligibility').value.trim() || null,
      notes: el('grant-opportunity-notes').value.trim() || null,
      updated_by: grantsState.session.user.id,
    };
    if (!payload.title) throw new Error('Informe o nome do edital ou oportunidade.');
    if (payload.min_amount != null && payload.max_amount != null && payload.min_amount > payload.max_amount) throw new Error('O valor mínimo não pode ser maior que o valor máximo.');
    let result;
    if (grantsState.editingOpportunityId) {
      result = await supabase.from('grant_opportunities').update(payload).eq('id', grantsState.editingOpportunityId).select('id').single();
    } else {
      payload.created_by = grantsState.session.user.id;
      result = await supabase.from('grant_opportunities').insert(payload).select('id').single();
    }
    if (result.error) throw result.error;
    el('grant-opportunity-dialog').close();
    await loadGrantData({ quiet: true });
    notify(grantsState.editingOpportunityId ? 'Edital atualizado.' : 'Edital cadastrado.');
  } catch (error) {
    console.error(error);
    setFormMessage(message, error.message || 'Não foi possível salvar o edital.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function resetApplicationForm() {
  el('grant-application-form').reset();
  el('grant-application-id').value = '';
  el('grant-application-status').value = 'rascunho';
  setFormMessage(el('grant-application-message'));
}

function openNewApplication(opportunityId) {
  if (!grantsState.canEdit) return;
  resetApplicationForm();
  const opp = opportunityById(opportunityId);
  el('grant-application-opportunity-id').value = opportunityId;
  el('grant-application-opportunity-name').textContent = opp?.title || 'Edital';
  el('grant-application-dialog').showModal();
}

async function createDefaultSections(applicationId) {
  const existing = grantsState.sections.filter((section) => section.application_id === applicationId);
  if (existing.length) return;
  const rows = DEFAULT_SECTIONS.map(([key, title], index) => ({
    application_id: applicationId,
    section_key: key,
    title,
    content: null,
    character_limit: null,
    required: false,
    sort_order: index + 1,
    status: 'rascunho',
    created_by: grantsState.session.user.id,
    updated_by: grantsState.session.user.id,
  }));
  const { error } = await supabase.from('grant_application_sections').insert(rows);
  if (error) throw error;
}

async function saveNewApplication(event) {
  event.preventDefault();
  if (!grantsState.canEdit) return;
  const button = el('grant-application-save');
  const message = el('grant-application-message');
  setButtonLoading(button, true);
  setFormMessage(message);
  try {
    const opportunityId = el('grant-application-opportunity-id').value;
    const projectId = el('grant-application-project').value || null;
    const duplicate = projectId && grantsState.applications.some((app) => app.opportunity_id === opportunityId && app.project_id === projectId);
    if (duplicate) throw new Error('Esse projeto já possui uma inscrição cadastrada neste edital.');
    const payload = {
      opportunity_id: opportunityId,
      project_id: projectId,
      application_name: el('grant-application-name').value.trim() || null,
      status: el('grant-application-status').value,
      requested_amount: el('grant-application-requested').value === '' ? null : Number(el('grant-application-requested').value),
      internal_responsible: el('grant-application-responsible').value || null,
      drive_url: el('grant-application-drive').value.trim() || null,
      notes: el('grant-application-notes').value.trim() || null,
      created_by: grantsState.session.user.id,
      updated_by: grantsState.session.user.id,
    };
    const { data, error } = await supabase.from('grant_applications').insert(payload).select('id').single();
    if (error) throw error;
    await createDefaultSections(data.id);
    el('grant-application-dialog').close();
    await loadGrantData({ quiet: true });
    notify('Inscrição criada. O editor do projeto já está preparado.');
    openApplicationWorkspace(data.id, 'summary');
  } catch (error) {
    console.error(error);
    setFormMessage(message, error.message || 'Não foi possível criar a inscrição.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function openApplicationWorkspace(applicationId, tab = 'summary') {
  captureGrantDrafts();
  const app = applicationById(applicationId);
  if (!app) return;
  grantsState.editingApplicationId = applicationId;
  grantsState.workspaceTab = tab;
  const opp = opportunityById(app.opportunity_id);
  const project = projectById(app.project_id);
  el('grant-workspace-kicker').textContent = opp?.title || 'Edital';
  el('grant-workspace-title').textContent = project?.title || app.application_name || 'Inscrição';
  el('grant-workspace-status').textContent = statusLabel(app.status);
  el('grant-workspace-status').className = `grant-workspace-status ${app.status}`;
  renderApplicationSummary();
  renderSectionEditor();
  renderRequirementList();
  setWorkspaceTab(tab);
  el('grant-workspace-dialog').showModal();
}

function setWorkspaceTab(tab) {
  grantsState.workspaceTab = tab;
  document.querySelectorAll('[data-grant-workspace-tab]').forEach((button) => button.classList.toggle('active', button.dataset.grantWorkspaceTab === tab));
  document.querySelectorAll('[data-grant-workspace-pane]').forEach((pane) => pane.hidden = pane.dataset.grantWorkspacePane !== tab);
}

function renderApplicationSummary() {
  const app = applicationById(grantsState.editingApplicationId);
  if (!app) return;
  populateGrantSelects();
  el('grant-workspace-project').value = app.project_id || '';
  el('grant-workspace-name').value = app.application_name || '';
  el('grant-workspace-app-status').value = app.status || 'rascunho';
  el('grant-workspace-responsible').innerHTML = `<option value="">Sem responsável definido</option>${grantsState.profiles.map((profile) => `<option value="${escapeHtml(profile.user_id)}">${escapeHtml(profile.name || profile.email || 'Administrador')}</option>`).join('')}`;
  el('grant-workspace-responsible').value = app.internal_responsible || '';
  el('grant-workspace-requested').value = app.requested_amount ?? '';
  el('grant-workspace-approved').value = app.approved_amount ?? '';
  el('grant-workspace-protocol').value = app.protocol_number || '';
  el('grant-workspace-submitted').value = datetimeLocalValue(app.submitted_at);
  el('grant-workspace-result-date').value = app.result_date || '';
  el('grant-workspace-drive').value = app.drive_url || '';
  el('grant-workspace-notes').value = app.notes || '';
  el('grant-workspace-project').innerHTML = `<option value="">Projeto ainda não vinculado</option>${grantsState.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title)}</option>`).join('')}`;
  el('grant-workspace-project').value = app.project_id || '';
  el('grant-workspace-summary-form').querySelectorAll('input, select, textarea').forEach((control) => { control.disabled = !grantsState.canEdit; });
  el('grant-workspace-save-summary').hidden = !grantsState.canEdit;
  setFormMessage(el('grant-workspace-summary-message'));
}

async function saveApplicationSummary(event) {
  event.preventDefault();
  if (!grantsState.canEdit) return;
  const app = applicationById(grantsState.editingApplicationId);
  if (!app) return;
  const button = el('grant-workspace-save-summary');
  const message = el('grant-workspace-summary-message');
  setButtonLoading(button, true);
  setFormMessage(message);
  try {
    const submittedRaw = el('grant-workspace-submitted').value;
    const payload = {
      project_id: el('grant-workspace-project').value || null,
      application_name: el('grant-workspace-name').value.trim() || null,
      status: el('grant-workspace-app-status').value,
      internal_responsible: el('grant-workspace-responsible').value || null,
      requested_amount: el('grant-workspace-requested').value === '' ? null : Number(el('grant-workspace-requested').value),
      approved_amount: el('grant-workspace-approved').value === '' ? null : Number(el('grant-workspace-approved').value),
      protocol_number: el('grant-workspace-protocol').value.trim() || null,
      submitted_at: submittedRaw ? new Date(submittedRaw).toISOString() : null,
      result_date: el('grant-workspace-result-date').value || null,
      drive_url: el('grant-workspace-drive').value.trim() || null,
      notes: el('grant-workspace-notes').value.trim() || null,
      updated_by: grantsState.session.user.id,
    };
    const { error } = await supabase.from('grant_applications').update(payload).eq('id', app.id);
    if (error) throw error;
    await loadGrantData({ quiet: true });
    const updated = applicationById(app.id);
    const project = projectById(updated?.project_id);
    el('grant-workspace-title').textContent = project?.title || updated?.application_name || 'Inscrição';
    el('grant-workspace-status').textContent = statusLabel(updated?.status);
    el('grant-workspace-status').className = `grant-workspace-status ${updated?.status || ''}`;
    setFormMessage(message, 'Inscrição atualizada.', 'success');
  } catch (error) {
    console.error(error);
    setFormMessage(message, error.message || 'Não foi possível atualizar a inscrição.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function sectionRowsForCurrentApp() {
  return grantsState.sections
    .filter((section) => section.application_id === grantsState.editingApplicationId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function captureGrantDrafts() {
  document.querySelectorAll('[data-grant-section-card]').forEach(card => {
    const id = card.dataset.grantSectionCard;
    const section = grantsState.sections.find(s => String(s.id) === id);
    if (!section) return;
    const get = name => card.querySelector(`[data-section-field="${name}"]`);
    const draft = { title: get('title').value, content: get('content').value, character_limit: get('limit').value === '' ? null : Number(get('limit').value), status: get('status').value, required: get('required').checked };
    const changed = Object.entries(draft).some(([key,value]) => value !== (section[key] ?? (key === 'character_limit' ? null : '')));
    if (changed) grantsState.drafts.set(id, draft); else grantsState.drafts.delete(id);
  });
}
function renderSectionEditor() {
  captureGrantDrafts();
  const container = el('grant-section-list');
  const sections = sectionRowsForCurrentApp().map(s => ({...s,...grantsState.drafts.get(String(s.id))}));
  el('grant-section-empty').hidden = sections.length > 0;
  container.innerHTML = sections.map((section, index) => {
    const count = (section.content || '').length;
    const limit = section.character_limit;
    const over = limit != null && count > limit;
    return `<details class="grant-section-card" data-grant-section-card="${escapeHtml(section.id)}" ${index === 0 ? 'open' : ''}>
      <summary>
        <div><span class="grant-section-number">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(section.title)}</strong>${section.required ? '<em>Obrigatória</em>' : ''}</div>
        <div><span class="grant-section-status ${escapeHtml(section.status)}">${escapeHtml(section.status === 'em_revisao' ? 'Em revisão' : section.status === 'aprovado' ? 'Aprovado' : 'Rascunho')}</span><small class="${over ? 'over' : ''}">${count}${limit ? ` / ${limit}` : ''} caracteres</small></div>
      </summary>
      <div class="grant-section-editor">
        <div class="grant-section-settings">
          <label><span>Título</span><input data-section-field="title" value="${escapeHtml(section.title)}" ${grantsState.canEdit ? '' : 'disabled'}></label>
          <label><span>Limite de caracteres</span><input data-section-field="limit" type="number" min="1" value="${limit ?? ''}" placeholder="Sem limite" ${grantsState.canEdit ? '' : 'disabled'}></label>
          <label><span>Status</span><select data-section-field="status" ${grantsState.canEdit ? '' : 'disabled'}><option value="rascunho" ${section.status === 'rascunho' ? 'selected' : ''}>Rascunho</option><option value="em_revisao" ${section.status === 'em_revisao' ? 'selected' : ''}>Em revisão</option><option value="aprovado" ${section.status === 'aprovado' ? 'selected' : ''}>Aprovado</option></select></label>
          <label class="grant-required-toggle"><input data-section-field="required" type="checkbox" ${section.required ? 'checked' : ''} ${grantsState.canEdit ? '' : 'disabled'}><span>Obrigatória neste edital</span></label>
        </div>
        <label class="grant-writing-field"><span>Texto do projeto</span><textarea data-section-field="content" rows="10" ${grantsState.canEdit ? '' : 'disabled'}>${escapeHtml(section.content || '')}</textarea><small data-section-counter class="${over ? 'over' : ''}">${count}${limit ? ` de ${limit}` : ''} caracteres</small></label>
        ${grantsState.canEdit ? `<div class="grant-section-actions"><button class="admin-btn secondary" data-save-section="${escapeHtml(section.id)}" type="button">Salvar seção</button></div>` : ''}
        <p class="form-message" data-section-message></p>
      </div>
    </details>`;
  }).join('');
  updateSectionCounters();
}

function updateSectionCounters() {
  document.querySelectorAll('[data-grant-section-card]').forEach((card) => {
    const text = card.querySelector('[data-section-field="content"]')?.value || '';
    const limitRaw = card.querySelector('[data-section-field="limit"]')?.value || '';
    const limit = limitRaw ? Number(limitRaw) : null;
    const counter = card.querySelector('[data-section-counter]');
    if (counter) {
      counter.textContent = `${text.length}${limit ? ` de ${limit}` : ''} caracteres`;
      counter.classList.toggle('over', limit != null && text.length > limit);
    }
  });
}

async function saveSection(sectionId, card) {
  if (!grantsState.canEdit) return;
  const button = card.querySelector('[data-save-section]');
  const message = card.querySelector('[data-section-message]');
  setButtonLoading(button, true);
  setFormMessage(message);
  try {
    const title = card.querySelector('[data-section-field="title"]').value.trim();
    const limitRaw = card.querySelector('[data-section-field="limit"]').value;
    const limit = limitRaw === '' ? null : Number(limitRaw);
    const content = card.querySelector('[data-section-field="content"]').value;
    if (!title) throw new Error('A seção precisa ter um título.');
    if (limit != null && content.length > limit) throw new Error(`O texto possui ${content.length} caracteres e ultrapassa o limite de ${limit}.`);
    const payload = {
      title,
      character_limit: limit,
      content: content || null,
      required: card.querySelector('[data-section-field="required"]').checked,
      status: card.querySelector('[data-section-field="status"]').value,
      updated_by: grantsState.session.user.id,
    };
    const { error } = await supabase.from('grant_application_sections').update(payload).eq('id', sectionId);
    if (error) throw error;
    Object.assign(grantsState.sections.find(s => s.id === sectionId), payload);
    captureGrantDrafts();
    await loadGrantData({ quiet: true });
    renderSectionEditor();
    const refreshed = document.querySelector(`[data-grant-section-card="${CSS.escape(sectionId)}"]`);
    if (refreshed) refreshed.open = true;
    notify('Seção salva.');
  } catch (error) {
    console.error(error);
    setFormMessage(message, error.message || 'Não foi possível salvar a seção.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function openNewSectionDialog() {
  if (!grantsState.canEdit) return;
  el('grant-section-form').reset();
  setFormMessage(el('grant-section-message'));
  el('grant-section-dialog').showModal();
}

async function saveNewSection(event) {
  event.preventDefault();
  if (!grantsState.canEdit || !grantsState.editingApplicationId) return;
  const button = el('grant-section-save');
  const message = el('grant-section-message');
  setButtonLoading(button, true);
  setFormMessage(message);
  try {
    const rows = sectionRowsForCurrentApp();
    const title = el('grant-section-title').value.trim();
    if (!title) throw new Error('Informe o título da seção.');
    const payload = {
      application_id: grantsState.editingApplicationId,
      section_key: null,
      title,
      content: null,
      character_limit: el('grant-section-limit').value === '' ? null : Number(el('grant-section-limit').value),
      required: el('grant-section-required').checked,
      sort_order: rows.length ? Math.max(...rows.map((row) => row.sort_order || 0)) + 1 : 1,
      status: 'rascunho',
      created_by: grantsState.session.user.id,
      updated_by: grantsState.session.user.id,
    };
    const { error } = await supabase.from('grant_application_sections').insert(payload);
    if (error) throw error;
    el('grant-section-dialog').close();
    await loadGrantData({ quiet: true });
    renderSectionEditor();
    notify('Nova seção adicionada ao projeto.');
  } catch (error) {
    console.error(error);
    setFormMessage(message, error.message || 'Não foi possível adicionar a seção.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function requirementsForCurrentApp() {
  return grantsState.requirements
    .filter((req) => req.application_id === grantsState.editingApplicationId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function renderRequirementList() {
  const container = el('grant-requirement-list');
  const rows = requirementsForCurrentApp();
  el('grant-requirement-empty').hidden = rows.length > 0;
  container.innerHTML = rows.map((req) => {
    const expiresSoon = req.expires_at && (() => {
      const days = Math.ceil((new Date(`${req.expires_at}T23:59:59`).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 30;
    })();
    const expired = req.expires_at && new Date(`${req.expires_at}T23:59:59`).getTime() < Date.now();
    return `<article class="grant-requirement-card ${req.completed ? 'completed' : ''}">
      <label class="grant-requirement-check"><input data-requirement-toggle="${escapeHtml(req.id)}" type="checkbox" ${req.completed ? 'checked' : ''} ${grantsState.canEdit ? '' : 'disabled'}><span></span></label>
      <div class="grant-requirement-content">
        <div class="grant-requirement-heading"><div><span>${escapeHtml(requirementTypeLabel(req.requirement_type))}</span>${req.required ? '<em>Obrigatório</em>' : '<em class="optional">Opcional</em>'}</div>${req.expires_at ? `<small class="${expired ? 'expired' : expiresSoon ? 'soon' : ''}">${expired ? 'Vencido em' : 'Validade'} ${escapeHtml(formatDate(req.expires_at))}</small>` : ''}</div>
        <strong>${escapeHtml(req.title)}</strong>
        ${req.description ? `<p>${escapeHtml(req.description)}</p>` : ''}
        <div class="grant-requirement-links">${req.drive_url ? `<a href="${escapeHtml(req.drive_url)}" target="_blank" rel="noopener">Abrir no Drive ↗</a>` : '<span>Sem documento vinculado</span>'}${grantsState.canEdit ? `<button data-edit-requirement="${escapeHtml(req.id)}" type="button">Editar</button>` : ''}</div>
      </div>
    </article>`;
  }).join('');
  const pending = rows.filter((req) => req.required && !req.completed).length;
  const done = rows.filter((req) => req.completed).length;
  el('grant-requirement-summary').textContent = rows.length ? `${done} concluído${done === 1 ? '' : 's'} · ${pending} obrigatório${pending === 1 ? '' : 's'} pendente${pending === 1 ? '' : 's'}` : 'Nenhum item cadastrado';
}

function openRequirementDialog(id = null) {
  if (!grantsState.canEdit) return;
  grantsState.editingRequirementId = id;
  el('grant-requirement-form').reset();
  el('grant-requirement-type').value = 'documento';
  el('grant-requirement-required').checked = true;
  el('grant-requirement-completed').checked = false;
  el('grant-requirement-title-heading').textContent = id ? 'Editar requisito' : 'Novo requisito';
  setFormMessage(el('grant-requirement-message'));
  if (id) {
    const req = grantsState.requirements.find((item) => item.id === id);
    if (!req) return;
    el('grant-requirement-type').value = req.requirement_type || 'documento';
    el('grant-requirement-title').value = req.title || '';
    el('grant-requirement-description').value = req.description || '';
    el('grant-requirement-required').checked = Boolean(req.required);
    el('grant-requirement-completed').checked = Boolean(req.completed);
    el('grant-requirement-expires').value = req.expires_at || '';
    el('grant-requirement-drive').value = req.drive_url || '';
    el('grant-requirement-notes').value = req.notes || '';
  }
  el('grant-requirement-dialog').showModal();
}

async function saveRequirement(event) {
  event.preventDefault();
  if (!grantsState.canEdit || !grantsState.editingApplicationId) return;
  const button = el('grant-requirement-save');
  const message = el('grant-requirement-message');
  setButtonLoading(button, true);
  setFormMessage(message);
  try {
    const title = el('grant-requirement-title').value.trim();
    if (!title) throw new Error('Informe o requisito ou documento.');
    const rows = requirementsForCurrentApp();
    const payload = {
      application_id: grantsState.editingApplicationId,
      requirement_type: el('grant-requirement-type').value,
      title,
      description: el('grant-requirement-description').value.trim() || null,
      required: el('grant-requirement-required').checked,
      completed: el('grant-requirement-completed').checked,
      expires_at: el('grant-requirement-expires').value || null,
      drive_url: el('grant-requirement-drive').value.trim() || null,
      notes: el('grant-requirement-notes').value.trim() || null,
      updated_by: grantsState.session.user.id,
    };
    let result;
    if (grantsState.editingRequirementId) {
      result = await supabase.from('grant_application_requirements').update(payload).eq('id', grantsState.editingRequirementId);
    } else {
      payload.sort_order = rows.length ? Math.max(...rows.map((row) => row.sort_order || 0)) + 1 : 1;
      payload.created_by = grantsState.session.user.id;
      result = await supabase.from('grant_application_requirements').insert(payload);
    }
    if (result.error) throw result.error;
    el('grant-requirement-dialog').close();
    await loadGrantData({ quiet: true });
    renderRequirementList();
    notify(grantsState.editingRequirementId ? 'Requisito atualizado.' : 'Requisito adicionado.');
  } catch (error) {
    console.error(error);
    setFormMessage(message, error.message || 'Não foi possível salvar o requisito.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function toggleRequirement(id, completed) {
  if (!grantsState.canEdit) return;
  const { error } = await supabase.from('grant_application_requirements').update({ completed, updated_by: grantsState.session.user.id }).eq('id', id);
  if (error) {
    notify(error.message || 'Não foi possível atualizar o checklist.', 'error');
    return;
  }
  await loadGrantData({ quiet: true });
  renderRequirementList();
}

// Importação explícita: uma cópia editável, sem alterar a FK de projetos públicos.
async function openCulturalImport() {
  if (!grantsState.canEdit) return;
  const dialog = el('grant-cultural-import-dialog');
  el('grant-cultural-import-preview').replaceChildren();
  el('grant-cultural-import-apply').disabled = true;
  const { data, error } = await supabase.from('cultural_projects').select('id,title').order('title');
  if (error) return notify('Não foi possível consultar os projetos culturais.', 'error');
  el('grant-cultural-import-source').innerHTML = '<option value="">Selecione um projeto cultural</option>' + (data || []).map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('');
  dialog.showModal();
}
async function previewCulturalImport() {
  const projectId = el('grant-cultural-import-source').value;
  const preview = el('grant-cultural-import-preview');
  preview.replaceChildren();
  el('grant-cultural-import-apply').disabled = true;
  if (!projectId) return;
  const { data, error } = await supabase.from('cultural_project_sections').select('id,section_key,title,content').eq('project_id', projectId).order('sort_order');
  if (projectId !== el('grant-cultural-import-source').value) return;
  if (error) return notify('Não foi possível consultar as seções do projeto.', 'error');
  const targets = sectionRowsForCurrentApp();
  const rows = (data || []).filter(source => source.content?.trim() && targets.some(t => t.section_key === source.section_key));
  preview.innerHTML = rows.length ? rows.map(source => {
    const target = targets.find(t => t.section_key === source.section_key);
    return `<label class="grant-cultural-import-row"><span><input type="checkbox" data-import-section="${escapeHtml(target.id)}"> ${escapeHtml(source.title)}${target.character_limit ? ` (limite: ${target.character_limit})` : ''}</span><textarea readonly aria-label="Texto de ${escapeHtml(source.title)}">${escapeHtml(source.content)}</textarea></label>`;
  }).join('') : '<p>Nenhuma seção com texto e chave correspondente nesta inscrição.</p>';
  el('grant-cultural-import-apply').disabled = !rows.length;
}
function applyCulturalImport() {
  if (!grantsState.canEdit) return;
  const checked = [...document.querySelectorAll('[data-import-section]:checked')];
  if (!checked.length) return notify('Selecione ao menos uma seção.', 'error');
  const fields = checked.map(input => ({
    input, field: document.querySelector(`[data-grant-section-card="${CSS.escape(input.dataset.importSection)}"] [data-section-field="content"]`),
    content: input.closest('label').querySelector('textarea').value,
  })).filter(item => item.field);
  if (fields.some(item => item.field.value.trim()) && !window.confirm('Substituir o texto no editor das seções selecionadas? As alterações só serão gravadas ao salvar cada seção.')) return;
  fields.forEach(({ field, content }) => {
    field.value = content;
    field.closest('details').open = true;
  });
  captureGrantDrafts();
  updateSectionCounters();
  el('grant-cultural-import-dialog').close();
  notify('Textos colocados no editor. Revise os limites e salve cada seção desejada.');
}

function setupGrantEvents() {
  document.addEventListener('input', event => { if (event.target.closest('[data-grant-section-card]')) captureGrantDrafts(); });
  document.addEventListener('change', event => { if (event.target.closest('[data-grant-section-card]')) captureGrantDrafts(); });
  window.addEventListener('beforeunload', event => { captureGrantDrafts(); if (grantsState.drafts.size) { event.preventDefault(); event.returnValue = ''; } });
  el('grant-cultural-import-open')?.addEventListener('click', openCulturalImport);
  el('grant-cultural-import-source')?.addEventListener('change', previewCulturalImport);
  el('grant-cultural-import-apply')?.addEventListener('click', applyCulturalImport);
  el('grants-new-opportunity')?.addEventListener('click', () => openOpportunityDialog());
  el('overview-new-grant')?.addEventListener('click', () => {
    document.querySelector('[data-admin-tab="grants"]')?.click();
    window.requestAnimationFrame(() => openOpportunityDialog());
  });
  el('grants-search')?.addEventListener('input', renderGrantList);
  el('grants-status-filter')?.addEventListener('change', renderGrantList);
  el('grant-opportunity-form')?.addEventListener('submit', saveOpportunity);
  el('grant-application-form')?.addEventListener('submit', saveNewApplication);
  el('grant-workspace-summary-form')?.addEventListener('submit', saveApplicationSummary);
  el('grant-section-form')?.addEventListener('submit', saveNewSection);
  el('grant-requirement-form')?.addEventListener('submit', saveRequirement);
  el('grant-add-section')?.addEventListener('click', openNewSectionDialog);
  el('grant-add-requirement')?.addEventListener('click', () => openRequirementDialog());

  document.querySelectorAll('[data-grant-workspace-tab]').forEach((button) => button.addEventListener('click', () => setWorkspaceTab(button.dataset.grantWorkspaceTab)));

  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-section-field="content"], [data-section-field="limit"]')) updateSectionCounters();
  });

  document.addEventListener('click', (event) => {
    const editOpportunity = event.target.closest('[data-grant-edit-opportunity]');
    if (editOpportunity) openOpportunityDialog(editOpportunity.dataset.grantEditOpportunity);
    const newApplication = event.target.closest('[data-grant-new-application]');
    if (newApplication) openNewApplication(newApplication.dataset.grantNewApplication);
    const openApplication = event.target.closest('[data-grant-open-application]');
    if (openApplication) openApplicationWorkspace(openApplication.dataset.grantOpenApplication);
    const saveSectionButton = event.target.closest('[data-save-section]');
    if (saveSectionButton) {
      const card = saveSectionButton.closest('[data-grant-section-card]');
      saveSection(saveSectionButton.dataset.saveSection, card);
    }
    const editRequirement = event.target.closest('[data-edit-requirement]');
    if (editRequirement) openRequirementDialog(editRequirement.dataset.editRequirement);
  });

  document.addEventListener('change', (event) => {
    const toggle = event.target.closest('[data-requirement-toggle]');
    if (toggle) toggleRequirement(toggle.dataset.requirementToggle, toggle.checked);
  });

  window.addEventListener('apollus-access-refresh', async () => {
    const wasView = grantsState.canView;
    await loadAccess();
    el('grants-new-opportunity').hidden = !grantsState.canEdit;
    if (el('overview-new-grant')) el('overview-new-grant').hidden = !grantsState.canEdit;
    if (grantsState.canView && !wasView) await loadGrantData();
  });
}

async function initializeGrants() {
  if (document.body.dataset.adminPage !== 'dashboard' || !isSupabaseConfigured || !supabase || !el('grants-panel')) return;
  const allowed = await loadAccess();
  setupGrantEvents();
  el('grants-new-opportunity').hidden = !grantsState.canEdit;
  if (el('overview-new-grant')) el('overview-new-grant').hidden = !grantsState.canEdit;
  if (!allowed) {
    el('grants-loading').hidden = true;
    return;
  }
  await loadGrantData();
}

initializeGrants().catch((error) => {
  console.error('Falha ao iniciar Editais:', error);
  notify('O módulo de Editais não pôde ser iniciado.', 'error');
});

