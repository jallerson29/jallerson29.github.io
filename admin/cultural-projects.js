import { supabase, isSupabaseConfigured } from '../supabase-config.js';

const state = {
  session: null,
  canView: false,
  canEdit: false,
  canDelete: false,
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
  drafts: new Map(),
  selectedSection: null,
  saving: new Set(),
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
  const [view, edit, del] = await Promise.all([
    supabase.rpc('has_permission', { requested_permission: 'projects.view' }),
    supabase.rpc('has_permission', { requested_permission: 'projects.edit' }),
    supabase.rpc('has_permission', { requested_permission: 'projects.delete' }),
  ]);
  state.canView = !view.error && view.data === true;
  state.canEdit = !edit.error && edit.data === true;
  state.canDelete = !del.error && del.data === true;
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
  const ready = state.projects.filter((p) => p.status === 'pronto').length;
  el('cultural-stat-active').textContent = active;
  el('cultural-stat-decisions').textContent = pendingProjects;
  el('cultural-stat-ready').textContent = ready;
}

function renderProjectList() {
  const list = el('cultural-project-list');
  if (!list) return;
  const rows = filteredProjects();
  const sort = el('cultural-project-sort')?.value || 'updated';
  rows.sort((a,b) => sort === 'title' ? a.title.localeCompare(b.title, 'pt-BR') :
    sort === 'status' ? (STATUS_LABELS[a.status] || '').localeCompare(STATUS_LABELS[b.status] || '', 'pt-BR') :
    String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  el('cultural-projects-empty').hidden = state.projects.length > 0;
  if (!rows.length) {
    list.innerHTML = state.projects.length ? '<p class="admin-list-state">Nenhum projeto encontrado com esses filtros.</p>' : '';
    return;
  }
  list.innerHTML = `<table class="cultural-table"><caption class="sr-only">Projetos culturais</caption><thead><tr><th scope="col">Projeto</th><th scope="col">Tipo</th><th scope="col">Status</th><th scope="col">Pendências</th><th scope="col">Atualização</th><th scope="col">Ações</th></tr></thead><tbody>${rows.map(p => {
    const pending = state.openMemory.filter(m => m.project_id === p.id && ['pending','question','risk'].includes(m.item_type)).length;
    return `<tr><td><button class="cultural-project-link" data-cultural-open-project="${escapeHtml(p.id)}" type="button">${escapeHtml(p.title)}</button></td><td>${escapeHtml(TYPE_LABELS[p.project_type] || 'Outro')}</td><td><span class="cultural-project-status status-${escapeHtml(p.status)}">${escapeHtml(STATUS_LABELS[p.status] || p.status)}</span></td><td>${pending || '—'}</td><td>${formatDate(p.updated_at)}</td><td>${state.canDelete ? `<button class="mini-action" data-cultural-delete-project="${escapeHtml(p.id)}" type="button" aria-label="Apagar ${escapeHtml(p.title)}">Apagar</button>` : '—'}</td></tr>`;
  }).join('')}</tbody></table>`;
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
  if (!title) {
    setFormMessage(messageBox, 'Informe o nome do projeto.', 'error');
    return;
  }
  setButtonLoading(button, true, 'Criando projeto...');
  try {
    const { data: project, error } = await supabase.from('cultural_projects').insert({
      title, project_type: type, initial_context: context || '', status: 'estruturando', created_by: state.session.user.id, updated_by: state.session.user.id,
    }).select('*').single();
    if (error) throw error;
    el('cultural-project-dialog').close();
    await loadProjects();
    await openProjectWorkspace(project.id);

  } catch (error) {
    console.error(error);
    setFormMessage(messageBox, error.message || 'Não foi possível criar o projeto.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function loadWorkspace(projectId) {
  captureDrafts();
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
    captureDrafts();
    await loadWorkspace(projectId);
    state.selectedSection = state.sections[0]?.id;
    setSideTab("structure");
    setMode("construir");
    renderWorkspace();
    document.querySelector('.cultural-workspace-layout')?.classList.remove('show-assistant');
    el('cultural-toggle-assistant')?.setAttribute('aria-expanded', 'false');
    if (el('cultural-toggle-assistant')) el('cultural-toggle-assistant').textContent = 'Assistente local';
    el('cultural-workspace-dialog').showModal();
  } catch (error) {
    console.error(error);
    notify('Não foi possível abrir o projeto cultural.', 'error');
  }
}

function draftKey(id) { return `${state.currentProject?.id}:${id}`; }
function captureDrafts() {
  document.querySelectorAll('[data-cultural-section]').forEach(card => {
    const section = state.sections.find(s => String(s.id) === card.dataset.culturalSection);
    if (!section) return;
    const content = card.querySelector('[data-cultural-section-content]').value;
    const status = card.querySelector('[data-cultural-section-status]').value;
    const key = draftKey(section.id);
    if (content !== (section.content || '') || status !== section.status) state.drafts.set(key, { content, status });
    else state.drafts.delete(key);
  });
  updateDirtyState();
}
function updateDirtyState() {
  const count = [...state.drafts.keys()].filter(k => k.startsWith(`${state.currentProject?.id}:`)).length;
  if (el('cultural-save-state')) el('cultural-save-state').textContent = count ? `${count} seção(ões) com alterações não salvas` : 'Todas as alterações salvas';
}
function renderWorkspace() {
  const p = state.currentProject;
  if (!p) return;
  el('cultural-workspace-title').textContent = p.title;
  el('cultural-workspace-type').textContent = `${TYPE_LABELS[p.project_type] || 'Projeto cultural'} · ${STATUS_LABELS[p.status] || p.status}`;
  el('cultural-workspace-progress').textContent = `${Number(p.progress || 0)}%`;
  if (el('cultural-delete-current')) el('cultural-delete-current').hidden = !state.canDelete;
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
    <div><p>${escapeHtml(m.content).replaceAll('\n','<br>')}</p><small>${m.role === 'assistant' ? 'Assistente Apollus' : 'Equipe Apollus'} · ${formatDate(m.created_at)}</small>${m.metadata?.proposal && state.canEdit ? `<div class="cultural-proposal"><label>Seção de destino<select data-cultural-proposal-destination="${escapeHtml(m.id)}">${state.sections.map(s => `<option value="${escapeHtml(s.id)}" ${m.metadata.proposal.section_ids?.[0] === s.id ? 'selected' : ''}>${escapeHtml(s.title)}</option>`).join('')}</select></label><button type="button" class="mini-action" data-cultural-review-proposal="${escapeHtml(m.id)}">Revisar proposta</button></div>` : ''}</div>
  </article>`).join('');
  box.scrollTop = box.scrollHeight;
}

function renderSections() {
  const box = el('cultural-section-list');
  if (!box) return;
  if (!state.sections.length) { box.innerHTML = '<p class="admin-list-state">Este projeto não possui seções disponíveis. Verifique a configuração antes de editar.</p>'; return; }
  box.innerHTML = `<nav class="cultural-section-index" aria-label="Seções do projeto">${state.sections.map(s => `<button type="button" data-cultural-select-section="${escapeHtml(s.id)}" aria-pressed="${s.id === state.selectedSection}">${escapeHtml(s.title)}<small>${escapeHtml(SECTION_STATUS_LABELS[s.status] || s.status)}</small></button>`).join('')}</nav><div class="cultural-editors">${state.sections.map(s => {
    const draft = state.drafts.get(draftKey(s.id));
    const content = draft?.content ?? s.content ?? '';
    const status = draft?.status ?? s.status;
    return `<article class="cultural-section-card" data-cultural-section="${escapeHtml(s.id)}" ${s.id === state.selectedSection ? '' : 'hidden'}>
      <header><h3>${escapeHtml(s.title)}</h3><label>Status <select data-cultural-section-status ${state.canEdit ? '' : 'disabled'}>${Object.entries(SECTION_STATUS_LABELS).map(([k,v]) => `<option value="${k}" ${status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></header>
      <div class="cultural-section-editor"><textarea aria-label="${escapeHtml(s.title)}" rows="12" data-cultural-section-content ${state.canEdit ? '' : 'readonly'}>${escapeHtml(content)}</textarea>
      <div class="cultural-editor-actions"><span data-cultural-count>${content.length} caracteres</span><button class="mini-action" data-cultural-draft-section="${escapeHtml(s.id)}" type="button" ${state.canEdit ? '' : 'disabled'}>Sugerir texto</button><button class="admin-btn primary" data-cultural-save-section="${escapeHtml(s.id)}" type="button" ${state.canEdit ? '' : 'disabled'}>Salvar seção</button></div><div class="cultural-draft-preview" hidden></div></div></article>`;
  }).join('')}</div>`;
  updateDirtyState();
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
  state.aiBusy = true;
  el('cultural-chat-send').disabled = true;
  try {
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
  } catch (error) { notify(error.message || 'Não foi possível processar a mensagem.', 'error'); }
  finally { state.aiBusy = false; el('cultural-chat-send').disabled = !state.canEdit; }
}


const CATEGORY_RULES = [
  ['orcamento', /orcamento|valor|custo|preco|cache|verba|\breais\b/],
  ['equipe', /equipe|staff|brigadista|seguranca|contratacao/],
  ['infraestrutura', /palco|som|audio|line array|led|iluminacao|estrutura|gerador|tenda/],
  ['publico_alvo', /publico|audiencia|espectadores/],
  ['programacao', /programacao|show|banda|artista|oficina|atividade/],
  ['acessibilidade', /acessibilidade|libras|audiodescricao|pcd|rampa/],
  ['democratizacao', /gratuito|gratuita|ingresso|entrada franca/],
  ['comunicacao', /divulgacao|instagram|rede social|imprensa|comunicacao/],
  ['cronograma', /cronograma|data|periodo|duracao|prazo/],
  ['contrapartidas', /contrapartida/], ['objetivo_geral', /objetivo geral|objetivo principal/],
  ['objetivos_especificos', /objetivos especificos/], ['justificativa', /justificativa|relevancia/],
  ['metodologia', /metodologia|logistica|montagem|desmontagem|execucao/],
  ['apresentacao', /conceito|proposta|resumo/],
];
function normalize(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g,' ').trim(); }
function hasParagraph(content, text) { return String(content || '').split(/\n\s*\n/).some(p => normalize(p) === normalize(text)); }
async function askAssistant({ messageId } = {}) {
  const message = state.messages.find(m => m.id === messageId);
  if (!message) return;
  const text = message.content.trim();
  let reply;
  let metadata = { engine: 'apollus-local-organizer-v3', no_external_api: true, user_message_id: messageId };
  if (state.mode === 'revisar') {
    const missing = state.sections.filter(s => !String(state.drafts.get(draftKey(s.id))?.content ?? s.content ?? '').trim());
    reply = missing.length ? `Seções sem texto: ${missing.map(s => s.title).join(', ')}.` : 'Nenhuma seção vazia. A revisão de coerência deve ser feita pela equipe.';
  } else if (state.mode === 'adaptar') {
    reply = 'Abra Editais & oportunidades, selecione uma inscrição e use “Trazer texto de projeto cultural”. Revise os limites e critérios oficiais antes do envio.';
  } else {
    const keys = CATEGORY_RULES.filter(([,rule]) => rule.test(normalize(text))).map(([key]) => key);
    const candidates = state.sections.filter(s => keys.includes(s.section_key));
    const duplicate = state.sections.some(s => hasParagraph(state.drafts.get(draftKey(s.id))?.content ?? s.content, text));
    if (duplicate) reply = 'Essa informação já está no projeto. Nenhuma alteração proposta.';
    else {
      metadata.proposal = { text, section_ids: candidates.map(s => s.id) };
      reply = candidates.length ? `Escolha a seção de destino para revisar esta informação: ${candidates.map(s => s.title).join(', ')}.` : 'Selecione uma seção para revisar a informação. Nenhum texto foi alterado.';
    }
  }
  // Repeated reviews/instructions add no value to the history.
  if (metadata.proposal && state.messages.some(m => m.metadata?.proposal && normalize(m.metadata.proposal.text) === normalize(text))) { notify('Essa proposta já está no histórico. Use Revisar proposta.'); return; }
  if (!metadata.proposal && state.messages.some(m => m.role === 'assistant' && m.mode === state.mode && normalize(m.content) === normalize(reply))) {
    notify('Nenhuma pendência nova desde a última verificação.'); return;
  }
  if (state.messages.some(m => m.metadata?.user_message_id === messageId)) return;
  const { error } = await supabase.from('cultural_project_messages').insert({ project_id: state.currentProject.id, role: 'assistant', mode: state.mode, content: reply, metadata, created_by: state.session.user.id });
  if (error) throw error;
  await loadWorkspace(state.currentProject.id);
  renderWorkspace();
}

function reviewProposal(messageId) {
  captureDrafts();
  const message = state.messages.find(m => String(m.id) === messageId);
  const proposal = message?.metadata?.proposal;
  const select = document.querySelector(`[data-cultural-proposal-destination="${CSS.escape(messageId)}"]`);
  const section = state.sections.find(s => String(s.id) === select?.value);
  if (!proposal || !section || !state.canEdit) return;
  state.selectedSection = section.id;
  setSideTab('structure'); renderSections();
  const card = document.querySelector(`[data-cultural-section="${CSS.escape(String(section.id))}"]`);
  const previous = card.querySelector('[data-cultural-section-content]').value;
  if (hasParagraph(previous, proposal.text)) return notify('Essa informação já consta nesta seção.');
  showDraft(card, [previous, proposal.text].filter(Boolean).join('\n\n'));
  card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function deleteCulturalProject(id) {
  if (!state.canDelete) {
    notify('Você não tem permissão para apagar projetos.', 'error');
    return;
  }
  const project = state.projects.find((item) => item.id === id) || (state.currentProject?.id === id ? state.currentProject : null);
  if (!project) return;

  const confirmed = window.confirm('Apagar definitivamente o projeto “' + project.title + '”? Esta ação também remove conversa, seções, decisões e versões.');
  if (!confirmed) return;

  const { data, error } = await supabase.rpc('apollus_delete_cultural_project', { target_id: id });
  if (error || data !== true) {
    notify(error?.message || 'Não foi possível apagar o projeto.', 'error');
    return;
  }

  if (state.currentProject?.id === id) {
    state.currentProject = null;
    el('cultural-section-list').replaceChildren();
    el('cultural-workspace-dialog')?.close();
  }
  for (const key of state.drafts.keys()) if (key.startsWith(`${id}:`)) state.drafts.delete(key);
  await loadProjects();
  notify('Projeto apagado.');
}

function suggestDraft(id, card) {
  if (!state.canEdit) return;
  const section = state.sections.find(s => String(s.id) === String(id));
  if (!section) return;
  const current = card.querySelector('[data-cultural-section-content]').value.trim();
  const outlines = {
    apresentacao: 'Proposta cultural: A definir.\nLocal e período: A definir.\nAtividades previstas: A definir.',
    justificativa: 'Necessidade cultural atendida: A definir.\nRelevância para o território e público: A definir.',
    objetivo_geral: 'Resultado principal pretendido: A definir.',
    objetivos_especificos: 'Objetivos e resultados verificáveis: A definir.',
    publico_alvo: 'Público atendido: A definir.\nEstimativa e critérios: A definir.',
    metodologia: 'Preparação: A definir.\nExecução: A definir.\nAvaliação: A definir.',
    programacao: 'Atividade | Data/horário | Participantes\nA definir | A definir | A definir',
    infraestrutura: 'Item | Necessidade técnica | Quantidade\nA definir | A definir | A definir',
    equipe: 'Função | Responsável | Quantidade\nA definir | A definir | A definir',
    cronograma: 'Etapa | Início | Término\nA definir | A definir | A definir',
    orcamento: 'Item | Quantidade | Valor unitário | Total | Fonte\nA definir | A definir | A definir | A definir | A definir',
    acessibilidade: 'Barreira identificada: A definir.\nMedida e responsável: A definir.',
    democratizacao: 'Forma de acesso: A definir.\nMedidas de ampliação do acesso: A definir.',
    contrapartidas: 'Ação | Público | Prazo\nA definir | A definir | A definir',
    comunicacao: 'Público | Canal | Ação | Período\nA definir | A definir | A definir',
  };
  if (current) return notify('Esta seção já tem texto. Use o editor para revisar ou o assistente para propor acréscimos.');
  showDraft(card, outlines[section.section_key] || 'Informações desta seção: A definir.');
}
function showDraft(card, suggestion) {
  const preview = card.querySelector('.cultural-draft-preview');
  preview.hidden = false;
  preview.innerHTML = '<strong>Proposta — revise antes de colocar no editor</strong><textarea aria-label="Texto proposto" rows="9"></textarea><div><button type="button" class="mini-action" data-apply-draft>Colocar no editor, sem salvar</button><button type="button" class="mini-action" data-discard-draft>Descartar</button></div>';
  preview.querySelector('textarea').value = suggestion;
  preview.querySelector('[data-apply-draft]').addEventListener('click', () => {
    card.querySelector('[data-cultural-section-content]').value = preview.querySelector('textarea').value;
    if (card.querySelector('[data-cultural-section-status]').value === 'vazio') card.querySelector('[data-cultural-section-status]').value = 'rascunho';
    preview.hidden = true; captureDrafts();
  });
  preview.querySelector('[data-discard-draft]').addEventListener('click', () => { preview.hidden = true; });
}

async function saveSection(id, card) {
  if (!state.canEdit || !state.currentProject || state.saving.has(id)) return;
  captureDrafts();
  const section = state.sections.find(s => String(s.id) === String(id));
  const content = card.querySelector('[data-cultural-section-content]').value;
  let status = card.querySelector('[data-cultural-section-status]').value;
  if (!content.trim()) status = 'vazio';
  else if (status === 'vazio') status = 'rascunho';
  const button = card.querySelector('[data-cultural-save-section]');
  state.saving.add(id); setButtonLoading(button, true);
  try {
    const { data, error } = await supabase.from('cultural_project_sections').update({ content: content || null, status, source: 'manual', updated_by: state.session.user.id }).eq('id', id).eq('project_id', state.currentProject.id).select('id').single();
    if (error || !data) throw error || new Error('A seção não foi atualizada.');
    section.content = content; section.status = status;
    captureDrafts(); updateDirtyState();
    const indexButton = document.querySelector(`[data-cultural-select-section="${CSS.escape(String(id))}"] small`);
    if (indexButton) indexButton.textContent = SECTION_STATUS_LABELS[status];
    notify('Seção salva.');
    await loadProjects();
  } catch (error) { notify(error.message || 'Não foi possível salvar a seção.', 'error'); }
  finally { state.saving.delete(id); setButtonLoading(button, false); }
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
  captureDrafts();
  if ([...state.drafts.keys()].some(k => k.startsWith(`${state.currentProject.id}:`))) return notify('Salve as seções alteradas antes de criar uma versão.', 'error');
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
  el('cultural-project-sort')?.addEventListener('change', renderProjectList);
  el('cultural-project-search')?.addEventListener('input', renderProjectList);
  el('cultural-project-status-filter')?.addEventListener('change', renderProjectList);
  el('cultural-chat-form')?.addEventListener('submit', sendMessage);
  el('cultural-workspace-close')?.addEventListener('click', () => { captureDrafts(); if (!state.aiBusy && !state.saving.size) el('cultural-workspace-dialog').close(); });
  el('cultural-save-version')?.addEventListener('click', saveVersion);
  el('cultural-toggle-assistant')?.addEventListener('click', () => {
    const layout = document.querySelector('.cultural-workspace-layout');
    const button = el('cultural-toggle-assistant');
    const active = layout?.classList.toggle('show-assistant') || false;
    button?.setAttribute('aria-expanded', String(active));
    if (button) button.textContent = active ? 'Ocultar assistente' : 'Assistente local';
  });
  el('cultural-delete-current')?.addEventListener('click', () => {
    if (state.currentProject) deleteCulturalProject(state.currentProject.id);
  });
  document.querySelectorAll('[data-cultural-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.culturalMode)));
  document.querySelectorAll('[data-cultural-side-tab]').forEach((b) => b.addEventListener('click', () => setSideTab(b.dataset.culturalSideTab)));
  document.addEventListener('input', event => {
    if (event.target.closest('[data-cultural-section]')) {
      captureDrafts();
      const card = event.target.closest('[data-cultural-section]');
      card.querySelector('[data-cultural-count]').textContent = `${card.querySelector('[data-cultural-section-content]').value.length} caracteres`;
    }
  });
  document.addEventListener('change', event => { if (event.target.matches('[data-cultural-section-status]')) captureDrafts(); });
  window.addEventListener('beforeunload', event => {
    captureDrafts();
    if (state.drafts.size) { event.preventDefault(); event.returnValue = ''; }
  });
  el('cultural-workspace-dialog')?.addEventListener('cancel', event => {
    captureDrafts();
    if (state.aiBusy || state.saving.size) event.preventDefault();
  });
  document.addEventListener('click', (event) => {
    const selectSection = event.target.closest('[data-cultural-select-section]');
    if (selectSection) { captureDrafts(); state.selectedSection = selectSection.dataset.culturalSelectSection; renderSections(); }
    const proposal = event.target.closest('[data-cultural-review-proposal]');
    if (proposal) reviewProposal(proposal.dataset.culturalReviewProposal);

    const deleteProject = event.target.closest('[data-cultural-delete-project]');
    if (deleteProject) {
      event.preventDefault();
      event.stopPropagation();
      deleteCulturalProject(deleteProject.dataset.culturalDeleteProject);
      return;
    }
    const projectCard = event.target.closest('[data-cultural-open-project]');
    if (projectCard) openProjectWorkspace(projectCard.dataset.culturalOpenProject);
    const draft = event.target.closest('[data-cultural-draft-section]');
    if (draft) suggestDraft(draft.dataset.culturalDraftSection, draft.closest('[data-cultural-section]'));
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
