import { supabase, isSupabaseConfigured } from '../supabase-config.js';

const state = {
  session: null,
  canView: false,
  canEdit: false,
  projects: [],
  openMemory: [],
  currentProject: null,
  sections: [],
  messages: [],
  memory: [],
  versions: [],
  mode: 'construir',
  sideTab: 'structure',
  aiBusy: false,
};

const TYPE_LABELS = {
  festival: 'Festival', evento_cultural: 'Evento cultural', musica: 'Música', teatro: 'Teatro',
  formacao: 'Formação / oficina', audiovisual: 'Audiovisual', circulacao: 'Circulação', outro: 'Outro',
};
const STATUS_LABELS = {
  ideia: 'Ideia', estruturando: 'Estruturando', revisao: 'Em revisão', pronto: 'Pronto',
  inscrito: 'Inscrito', execucao: 'Em execução', concluido: 'Concluído', arquivado: 'Arquivado',
};
const SECTION_STATUS_LABELS = {
  vazio: 'Ainda vazio', rascunho: 'Rascunho', revisar: 'Revisar', pronto: 'Pronto', a_definir: 'A definir',
};
const MEMORY_LABELS = {
  decision: 'Decisão', constraint: 'Regra', pending: 'Pendente', question: 'Pergunta', risk: 'Atenção', fact: 'Fato',
};

function el(id) { return document.getElementById(id); }
function escapeHtml(value = '') {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}
function notify(message, type = 'success') {
  const box = el('admin-global-message');
  if (!box) return;
  box.textContent = message;
  box.className = `admin-alert ${type}`;
  box.hidden = false;
  window.setTimeout(() => { box.hidden = true; }, 6500);
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

async function loadAccess() {
  const { data: sessionData } = await supabase.auth.getSession();
  state.session = sessionData.session;
  if (!state.session) return false;
  const [view, edit] = await Promise.all([
    supabase.rpc('has_permission', { requested_permission: 'projects.view' }),
    supabase.rpc('has_permission', { requested_permission: 'projects.edit' }),
  ]);
  state.canView = !view.error && view.data === true;
  state.canEdit = !edit.error && edit.data === true;
  return state.canView;
}

async function loadProjects() {
  if (!state.canView) return;
  el('cultural-projects-loading').hidden = false;
  const [projectsResult, memoryResult] = await Promise.all([
    supabase.from('cultural_projects').select('*').order('updated_at', { ascending: false }),
    supabase.from('cultural_project_memory').select('id,project_id,item_type,status,priority,title').eq('status', 'open'),
  ]);
  el('cultural-projects-loading').hidden = true;
  if (projectsResult.error) {
    console.error(projectsResult.error);
    notify('Não foi possível carregar os projetos culturais.', 'error');
    return;
  }
  state.projects = projectsResult.data || [];
  state.openMemory = memoryResult.error ? [] : (memoryResult.data || []);
  renderProjectList();
  renderProjectStats();
}

function filteredProjects() {
  const q = (el('cultural-project-search')?.value || '').trim().toLowerCase();
  const status = el('cultural-project-status-filter')?.value || 'todos';
  return state.projects.filter((p) => {
    if (status !== 'todos' && p.status !== status) return false;
    if (!q) return true;
    return [p.title, p.summary, TYPE_LABELS[p.project_type], STATUS_LABELS[p.status]].filter(Boolean).join(' ').toLowerCase().includes(q);
  });
}

function renderProjectStats() {
  const active = state.projects.filter((p) => !['concluido','arquivado'].includes(p.status)).length;
  const pendingProjects = new Set(state.openMemory.filter((m) => ['pending','question','risk'].includes(m.item_type)).map((m) => m.project_id)).size;
  const ready = state.projects.filter((p) => ['pronto','inscrito','execucao'].includes(p.status)).length;
  el('cultural-stat-active').textContent = active;
  el('cultural-stat-decisions').textContent = pendingProjects;
  el('cultural-stat-ready').textContent = ready;
}

function renderProjectList() {
  const list = el('cultural-project-list');
  if (!list) return;
  const rows = filteredProjects();
  el('cultural-projects-empty').hidden = state.projects.length > 0;
  if (!rows.length) {
    list.innerHTML = state.projects.length ? '<div class="admin-list-state">Nenhum projeto encontrado com esses filtros.</div>' : '';
    return;
  }
  list.innerHTML = rows.map((p) => {
    const pending = state.openMemory.filter((m) => m.project_id === p.id && ['pending','question','risk'].includes(m.item_type)).length;
    return `<article class="cultural-project-card" data-cultural-open-project="${p.id}">
      <div class="cultural-project-card-top">
        <span class="cultural-project-type">${escapeHtml(TYPE_LABELS[p.project_type] || 'Projeto cultural')}</span>
        <span class="cultural-project-status status-${escapeHtml(p.status)}">${escapeHtml(STATUS_LABELS[p.status] || p.status)}</span>
      </div>
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.summary || p.initial_context || 'Projeto iniciado. Continue a conversa para estruturar conceito, execução, cronograma e orçamento.')}</p>
      <div class="cultural-card-progress"><div><span style="width:${Number(p.progress || 0)}%"></span></div><strong>${Number(p.progress || 0)}%</strong></div>
      <footer><span>${pending ? `${pending} decisão${pending === 1 ? '' : 'ões'} pendente${pending === 1 ? '' : 's'}` : 'Sem pendências registradas'}</span><button type="button">Continuar →</button></footer>
    </article>`;
  }).join('');
}

function switchHubTab(tab) {
  document.querySelectorAll('[data-cultural-hub-tab]').forEach((b) => b.classList.toggle('active', b.dataset.culturalHubTab === tab));
  document.querySelectorAll('[data-cultural-hub-view]').forEach((v) => {
    const active = v.dataset.culturalHubView === tab;
    v.classList.toggle('active', active);
    v.hidden = !active;
  });
}

function openNewProjectDialog() {
  if (!state.canEdit) return;
  el('cultural-project-form').reset();
  el('cultural-project-type').value = 'festival';
  setFormMessage(el('cultural-project-message'));
  el('cultural-project-dialog').showModal();
  window.setTimeout(() => el('cultural-project-title')?.focus(), 50);
}

async function createProject(event) {
  event.preventDefault();
  if (!state.canEdit) return;
  const title = el('cultural-project-title').value.trim();
  const context = el('cultural-project-context').value.trim();
  const type = el('cultural-project-type').value;
  const button = el('cultural-project-create');
  const messageBox = el('cultural-project-message');
  if (!title || !context) {
    setFormMessage(messageBox, 'Informe o nome provisório e conte a ideia inicial.', 'error');
    return;
  }
  setButtonLoading(button, true, 'Criando projeto...');
  try {
    const { data: project, error } = await supabase.from('cultural_projects').insert({
      title, project_type: type, initial_context: context, status: 'estruturando', created_by: state.session.user.id, updated_by: state.session.user.id,
    }).select('*').single();
    if (error) throw error;
    const { data: message, error: messageError } = await supabase.from('cultural_project_messages').insert({
      project_id: project.id, role: 'user', mode: 'construir', content: context, created_by: state.session.user.id,
    }).select('id').single();
    if (messageError) throw messageError;
    el('cultural-project-dialog').close();
    await loadProjects();
    await openProjectWorkspace(project.id);
    await askAssistant({ messageId: message.id, initial: true });
  } catch (error) {
    console.error(error);
    setFormMessage(messageBox, error.message || 'Não foi possível criar o projeto.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function loadWorkspace(projectId) {
  const [projectResult, sectionResult, messageResult, memoryResult, versionResult] = await Promise.all([
    supabase.from('cultural_projects').select('*').eq('id', projectId).single(),
    supabase.from('cultural_project_sections').select('*').eq('project_id', projectId).order('sort_order').order('created_at'),
    supabase.from('cultural_project_messages').select('*').eq('project_id', projectId).order('created_at').order('id'),
    supabase.from('cultural_project_memory').select('*').eq('project_id', projectId).order('status').order('sort_order').order('created_at'),
    supabase.from('cultural_project_versions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
  ]);
  const error = [projectResult, sectionResult, messageResult, memoryResult, versionResult].find((r) => r.error)?.error;
  if (error) throw error;
  state.currentProject = projectResult.data;
  state.sections = sectionResult.data || [];
  state.messages = messageResult.data || [];
  state.memory = memoryResult.data || [];
  state.versions = versionResult.data || [];
}

async function openProjectWorkspace(projectId) {
  try {
    await loadWorkspace(projectId);
    renderWorkspace();
    el('cultural-workspace-dialog').showModal();
  } catch (error) {
    console.error(error);
    notify('Não foi possível abrir o projeto cultural.', 'error');
  }
}

function renderWorkspace() {
  const p = state.currentProject;
  if (!p) return;
  el('cultural-workspace-title').textContent = p.title;
  el('cultural-workspace-type').textContent = `${TYPE_LABELS[p.project_type] || 'Projeto cultural'} · ${STATUS_LABELS[p.status] || p.status}`;
  el('cultural-workspace-progress').textContent = `${Number(p.progress || 0)}%`;
  renderChat();
  renderSections();
  renderMemory();
  renderVersions();
  renderNextDecision();
}

function renderChat() {
  const box = el('cultural-chat');
  if (!box) return;
  if (!state.messages.length) {
    box.innerHTML = '<div class="cultural-chat-empty">Conte uma ideia ou decisão para começar.</div>';
    return;
  }
  box.innerHTML = state.messages.map((m) => `<article class="cultural-message ${m.role}">
    <div class="cultural-message-avatar">${m.role === 'assistant' ? '✦' : 'Você'}</div>
    <div><p>${escapeHtml(m.content).replaceAll('\n','<br>')}</p><small>${m.role === 'assistant' ? 'Assistente Apollus' : 'Equipe Apollus'} · ${formatDate(m.created_at)}</small></div>
  </article>`).join('');
  box.scrollTop = box.scrollHeight;
}

function renderSections() {
  const box = el('cultural-section-list');
  if (!box) return;
  box.innerHTML = state.sections.map((s) => {
    const preview = (s.content || '').trim();
    return `<article class="cultural-section-card status-${escapeHtml(s.status)}" data-cultural-section="${s.id}">
      <button class="cultural-section-summary" type="button" data-cultural-section-toggle="${s.id}">
        <span class="cultural-section-dot"></span><span><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(SECTION_STATUS_LABELS[s.status] || s.status)}</small></span><em>›</em>
      </button>
      <div class="cultural-section-editor" hidden>
        <textarea rows="8" data-cultural-section-content>${escapeHtml(preview)}</textarea>
        <div><span>${preview ? `${preview.length} caracteres` : 'Sem texto ainda'}</span><button class="mini-action" data-cultural-save-section="${s.id}" type="button" ${state.canEdit ? '' : 'disabled'}>Salvar</button></div>
      </div>
    </article>`;
  }).join('');
}

function renderMemory() {
  const box = el('cultural-memory-list');
  if (!box) return;
  const items = state.memory.filter((m) => m.status !== 'superseded');
  if (!items.length) {
    box.innerHTML = '<div class="cultural-side-empty">As decisões e pendências importantes aparecerão aqui.</div>';
    return;
  }
  box.innerHTML = items.map((m) => `<article class="cultural-memory-item ${m.item_type} ${m.status}">
    <header><span>${escapeHtml(MEMORY_LABELS[m.item_type] || m.item_type)}</span>${m.priority === 'high' ? '<em>Prioridade</em>' : ''}</header>
    <strong>${escapeHtml(m.title)}</strong>${m.content ? `<p>${escapeHtml(m.content)}</p>` : ''}
    ${m.status === 'open' && state.canEdit ? `<button class="mini-action" data-cultural-resolve-memory="${m.id}" type="button">Marcar resolvido</button>` : '<small>Resolvido</small>'}
  </article>`).join('');
}

function renderVersions() {
  const box = el('cultural-version-list');
  if (!box) return;
  if (!state.versions.length) {
    box.innerHTML = '<div class="cultural-side-empty">Salve uma versão quando chegar a um marco importante.</div>';
    return;
  }
  box.innerHTML = state.versions.map((v) => `<article class="cultural-version-item"><strong>${escapeHtml(v.label)}</strong><span>${formatDate(v.created_at)}</span>${v.note ? `<p>${escapeHtml(v.note)}</p>` : ''}</article>`).join('');
}

function renderNextDecision() {
  const box = el('cultural-next-decision');
  if (!box) return;
  const next = state.memory.find((m) => m.status === 'open' && m.item_type === 'question') || state.memory.find((m) => m.status === 'open' && ['pending','risk'].includes(m.item_type));
  if (!next) {
    box.innerHTML = '<span>PRÓXIMA DECISÃO</span><strong>Continue contando o que já foi definido.</strong><p>O assistente vai sugerir a próxima pergunta útil.</p>';
    return;
  }
  box.innerHTML = `<span>PRÓXIMA DECISÃO</span><strong>${escapeHtml(next.title)}</strong>${next.content ? `<p>${escapeHtml(next.content)}</p>` : ''}`;
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('[data-cultural-mode]').forEach((b) => b.classList.toggle('active', b.dataset.culturalMode === mode));
  const placeholders = {
    construir: 'Conte uma decisão, dúvida ou mudança no projeto...',
    revisar: 'Peça uma revisão: coerência, lacunas, acessibilidade, cronograma...',
    orcamento: 'Conte o que já sabemos sobre custos, estrutura ou quantidades...',
    adaptar: 'Diga a qual edital ou oportunidade você quer adaptar este projeto...',
  };
  el('cultural-chat-input').placeholder = placeholders[mode] || placeholders.construir;
}

function setSideTab(tab) {
  state.sideTab = tab;
  document.querySelectorAll('[data-cultural-side-tab]').forEach((b) => b.classList.toggle('active', b.dataset.culturalSideTab === tab));
  document.querySelectorAll('[data-cultural-side-view]').forEach((v) => {
    const active = v.dataset.culturalSideView === tab;
    v.classList.toggle('active', active);
    v.hidden = !active;
  });
}

async function sendMessage(event) {
  event.preventDefault();
  if (!state.canEdit || state.aiBusy || !state.currentProject) return;
  const input = el('cultural-chat-input');
  const content = input.value.trim();
  if (!content) return;
  const { data: message, error } = await supabase.from('cultural_project_messages').insert({
    project_id: state.currentProject.id, role: 'user', mode: state.mode, content, created_by: state.session.user.id,
  }).select('id').single();
  if (error) {
    notify(error.message || 'Não foi possível salvar sua mensagem.', 'error');
    return;
  }
  input.value = '';
  await loadWorkspace(state.currentProject.id);
  renderWorkspace();
  await askAssistant({ messageId: message.id });
}

async function askAssistant({ messageId, initial = false } = {}) {
  if (!state.currentProject || state.aiBusy) return;
  state.aiBusy = true;
  const status = el('cultural-ai-status');
  const send = el('cultural-chat-send');
  status.hidden = false;
  status.className = 'cultural-ai-status working';
  status.textContent = initial ? '✦ Organizando a ideia inicial...' : '✦ Pensando no projeto...';
  send.disabled = true;
  try {
    const { data, error } = await supabase.functions.invoke('cultural-project-assistant', {
      body: { project_id: state.currentProject.id, mode: state.mode, user_message_id: messageId || null },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await loadWorkspace(state.currentProject.id);
    renderWorkspace();
    await loadProjects();
    status.hidden = true;
  } catch (error) {
    console.error(error);

    let raw = String(error?.message || '');
    try {
      const response = error?.context;
      if (response && typeof response.clone === 'function') {
        const payload = await response.clone().json().catch(() => null);
        if (payload?.error) raw = String(payload.error);
      }
    } catch (contextError) {
      console.warn('Não foi possível ler o detalhe da Edge Function.', contextError);
    }

    const keyMissing = /OPENAI_API_KEY|chave.*IA|não configurad/i.test(raw);
    status.className = 'cultural-ai-status error';
    status.innerHTML = keyMissing
      ? '<strong>Falta conectar a IA.</strong><span>O Assistente Apollus já está instalado, mas o secret <code>OPENAI_API_KEY</code> ainda não está configurado no Supabase. Sua mensagem foi salva normalmente.</span>'
      : `<strong>Não consegui responder agora.</strong><span>${escapeHtml(raw || 'Tente novamente em instantes.')} O conteúdo já ficou salvo.</span>`;
  } finally {
    state.aiBusy = false;
    send.disabled = !state.canEdit;
  }
}

async function saveSection(id, card) {
  if (!state.canEdit || !state.currentProject) return;
  const content = card.querySelector('[data-cultural-section-content]').value.trim();
  const status = content ? 'rascunho' : 'vazio';
  const { error } = await supabase.from('cultural_project_sections').update({ content: content || null, status, source: 'manual', updated_by: state.session.user.id }).eq('id', id);
  if (error) return notify(error.message || 'Não foi possível salvar a seção.', 'error');
  await loadWorkspace(state.currentProject.id);
  renderWorkspace();
  notify('Seção atualizada.');
}

async function resolveMemory(id) {
  if (!state.canEdit || !state.currentProject) return;
  const { error } = await supabase.from('cultural_project_memory').update({ status: 'resolved', updated_by: state.session.user.id }).eq('id', id);
  if (error) return notify(error.message || 'Não foi possível atualizar a decisão.', 'error');
  await loadWorkspace(state.currentProject.id);
  renderWorkspace();
  await loadProjects();
}

async function saveVersion() {
  if (!state.canEdit || !state.currentProject) return;
  const now = new Date();
  const label = `Versão ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(now)}`;
  const snapshot = { project: state.currentProject, sections: state.sections, memory: state.memory };
  const { error } = await supabase.from('cultural_project_versions').insert({ project_id: state.currentProject.id, label, snapshot, created_by: state.session.user.id });
  if (error) return notify(error.message || 'Não foi possível salvar a versão.', 'error');
  await loadWorkspace(state.currentProject.id);
  renderVersions();
  notify('Versão do projeto salva.');
}

function setupEvents() {
  document.querySelectorAll('[data-cultural-hub-tab]').forEach((b) => b.addEventListener('click', () => switchHubTab(b.dataset.culturalHubTab)));
  el('cultural-new-project')?.addEventListener('click', openNewProjectDialog);
  el('overview-new-cultural-project')?.addEventListener('click', () => {
    document.querySelector('[data-admin-tab="grants"]')?.click();
    switchHubTab('projects');
    window.requestAnimationFrame(openNewProjectDialog);
  });
  document.querySelectorAll('[data-cultural-start-project]').forEach((b) => b.addEventListener('click', openNewProjectDialog));
  el('cultural-project-form')?.addEventListener('submit', createProject);
  el('cultural-project-search')?.addEventListener('input', renderProjectList);
  el('cultural-project-status-filter')?.addEventListener('change', renderProjectList);
  el('cultural-chat-form')?.addEventListener('submit', sendMessage);
  el('cultural-workspace-close')?.addEventListener('click', () => el('cultural-workspace-dialog').close());
  el('cultural-save-version')?.addEventListener('click', saveVersion);
  document.querySelectorAll('[data-cultural-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.culturalMode)));
  document.querySelectorAll('[data-cultural-side-tab]').forEach((b) => b.addEventListener('click', () => setSideTab(b.dataset.culturalSideTab)));

  document.addEventListener('click', (event) => {
    const projectCard = event.target.closest('[data-cultural-open-project]');
    if (projectCard) openProjectWorkspace(projectCard.dataset.culturalOpenProject);
    const toggle = event.target.closest('[data-cultural-section-toggle]');
    if (toggle) {
      const card = toggle.closest('[data-cultural-section]');
      const editor = card.querySelector('.cultural-section-editor');
      editor.hidden = !editor.hidden;
      card.classList.toggle('open', !editor.hidden);
    }
    const save = event.target.closest('[data-cultural-save-section]');
    if (save) saveSection(save.dataset.culturalSaveSection, save.closest('[data-cultural-section]'));
    const resolve = event.target.closest('[data-cultural-resolve-memory]');
    if (resolve) resolveMemory(resolve.dataset.culturalResolveMemory);
  });

  window.addEventListener('apollus-access-refresh', async () => {
    await loadAccess();
    if (el('cultural-new-project')) el('cultural-new-project').hidden = !state.canEdit;
    if (el('overview-new-cultural-project')) el('overview-new-cultural-project').hidden = !state.canEdit;
    if (state.canView) await loadProjects();
  });
}

async function init() {
  if (document.body.dataset.adminPage !== 'dashboard' || !isSupabaseConfigured || !supabase || !el('cultural-projects-view')) return;
  const allowed = await loadAccess();
  setupEvents();
  el('cultural-new-project').hidden = !state.canEdit;
  el('overview-new-cultural-project').hidden = !state.canEdit;
  el('cultural-chat-input').disabled = !state.canEdit;
  el('cultural-chat-send').disabled = !state.canEdit;
  if (!allowed) {
    el('cultural-projects-loading').hidden = true;
    return;
  }
  await loadProjects();
}

init().catch((error) => {
  console.error('Falha ao iniciar Projetos culturais:', error);
  notify('O módulo de Projetos culturais não pôde ser iniciado.', 'error');
});