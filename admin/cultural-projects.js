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
  aiEngine: localStorage.getItem('apollus.culturalAiEngine') || 'local',
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
      <footer><span>${pending ? `${pending} decisão${pending === 1 ? '' : 'ões'} pendente${pending === 1 ? '' : 's'}` : 'Sem pendências registradas'}</span><div class="cultural-card-actions"><button type="button">Continuar →</button>${state.canDelete ? `<button class="cultural-delete-project" data-cultural-delete-project="${p.id}" type="button" title="Apagar projeto">Apagar</button>` : ''}</div></footer>
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
    document.querySelector('.cultural-workspace-layout')?.classList.remove('focus-chat', 'show-assistant');
    el('cultural-toggle-assistant')?.setAttribute('aria-expanded', 'false');
    if (el('cultural-toggle-assistant')) el('cultural-toggle-assistant').textContent = 'Assistente IA';
    if (el('cultural-focus-chat')) {
      el('cultural-focus-chat').textContent = 'Focar conversa';
      el('cultural-focus-chat').setAttribute('aria-pressed', 'false');
    }
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
    <div><p>${escapeHtml(m.content).replaceAll('\n','<br>')}</p><small>${m.role === 'assistant' ? 'Assistente Apollus' : 'Equipe Apollus'} · ${formatDate(m.created_at)}</small></div>
  </article>`).join('');
  box.scrollTop = box.scrollHeight;
}

function renderSections() {
  const box = el('cultural-section-list');
  if (!box) return;
  box.innerHTML = state.sections.map((s) => {
    const preview = (s.content || '').trim();
    return `<article class="cultural-section-card open status-${escapeHtml(s.status)}" data-cultural-section="${s.id}">
      <button class="cultural-section-summary" type="button" data-cultural-section-toggle="${s.id}">
        <span class="cultural-section-dot"></span><span><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(SECTION_STATUS_LABELS[s.status] || s.status)}</small></span><em>›</em>
      </button>
      <div class="cultural-section-editor">
        <textarea rows="12" data-cultural-section-content>${escapeHtml(preview)}</textarea>
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


async function askLocalAssistant({ messageId } = {}) {
  if (!state.currentProject || state.aiBusy) return;
  state.aiBusy = true;
  const status = el('cultural-ai-status');
  const send = el('cultural-chat-send');
  status.hidden = false;
  status.className = 'cultural-ai-status working';
  status.textContent = 'Organizando informação...';
  send.disabled = true;
  try {
    const message = state.messages.find((m) => m.id === messageId);
    const text = String(message?.content || '').trim();
    if (!text) throw new Error('Nenhuma mensagem encontrada.');
    const normalize = (value) => String(value || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const normalized = normalize(text);
    // Apenas categorização de texto: não inventa conteúdo nem simula uma IA generativa.
    const categories = [
      ['orcamento', /\b(orcamento|valor|custo|preco|cache|verba)\b|r\$/],
      ['equipe', /\b(equipe|staff|brigadista|seguranca|contratacao)\b/],
      ['infraestrutura', /\b(palco|som|audio|line array|subwoofer|monitor|in-ear|led|iluminacao|estrutura|gerador|tenda)\b/],
      ['publico_alvo', /\b(publico.alvo|audiencia|faixa etaria|espectadores)\b/],
      ['programacao', /\b(programacao|show|banda|artista|oficina|atividade|apresentacao musical)\b/],
      ['acessibilidade', /\b(acessibilidade|libras|audiodescricao|pcd|cadeirante|rampa)\b/],
      ['democratizacao', /\b(gratuito|gratuita|ingresso|entrada franca|democratizacao)\b/],
      ['comunicacao', /\b(divulgacao|instagram|rede social|imprensa|comunicacao|midia)\b/],
      ['cronograma', /\b(cronograma|datas?|periodo|duracao|semana|mes|prazo)\b/],
      ['contrapartidas', /\b(contrapartida)\b/],
      ['objetivo_geral', /\b(objetivo geral|objetivo principal)\b/],
      ['objetivos_especificos', /\b(objetivos especificos)\b/],
      ['justificativa', /\b(justificativa|relevancia)\b/],
      ['metodologia', /\b(metodologia|logistica|montagem|desmontagem|execucao)\b/],
      ['apresentacao', /\b(conceito|proposta|resumo do projeto)\b/],
    ];
    const matched = categories.find(([, pattern]) => pattern.test(normalized));
    const section = matched && state.sections.find((s) => s.section_key === matched[0]);
    const uncertain = /\b(a definir|ainda nao defin|nao definid|sem valor definido)\b/.test(normalized);
    let updatedTitle = null;
    let alreadySaved = false;
    if (section) {
      const previous = String(section.content || '').trim();
      // Idempotência: não cola novamente a mesma informação, nem a espalha por várias seções.
      alreadySaved = previous.split(/\n{2,}/).some((part) => normalize(part) === normalized);
      if (!alreadySaved) {
        const content = [previous, text].filter(Boolean).join('\n\n');
        const { error } = await supabase.from('cultural_project_sections').update({
          content, status: uncertain ? 'a_definir' : 'rascunho',
          source: 'manual', updated_by: state.session.user.id,
        }).eq('id', section.id);
        if (error) throw error;
        updatedTitle = section.title;
      }
    }

    // Escolher uma pergunta inédita, não repetir perguntas já enviadas pelo assistente.
    await loadWorkspace(state.currentProject.id);
    const prompts = {
      objetivo_geral: 'Qual é o objetivo principal do projeto?',
      publico_alvo: 'Qual público vocês pretendem alcançar?',
      programacao: 'Quais atividades ou apresentações estão previstas?',
      infraestrutura: 'Qual estrutura física e técnica já está definida?',
      cronograma: 'Quais datas ou etapas já estão definidas?',
      acessibilidade: 'Quais recursos de acessibilidade serão previstos?',
      democratizacao: 'Como será o acesso do público ao evento?',
      comunicacao: 'Como pretendem divulgar o projeto?',
      equipe: 'Quais funções ou responsáveis já estão definidos?',
      orcamento: 'Quais custos já estão levantados?',
      metodologia: 'Como será realizada a execução do projeto?',
    };
    const orderByType = {
      festival: ['publico_alvo','programacao','infraestrutura','cronograma','acessibilidade','democratizacao','comunicacao','equipe','orcamento'],
      evento_cultural: ['publico_alvo','programacao','infraestrutura','cronograma','acessibilidade','democratizacao','comunicacao','equipe','orcamento'],
      musica: ['objetivo_geral','publico_alvo','metodologia','cronograma','comunicacao','orcamento'],
      teatro: ['objetivo_geral','publico_alvo','programacao','infraestrutura','acessibilidade','cronograma','orcamento'],
      formacao: ['publico_alvo','metodologia','cronograma','acessibilidade','orcamento'],
      audiovisual: ['objetivo_geral','publico_alvo','metodologia','cronograma','comunicacao','orcamento'],
    };
    const order = orderByType[state.currentProject.project_type] ||
      ['objetivo_geral','publico_alvo','metodologia','cronograma','orcamento'];
    const asked = new Set(state.messages.filter((m) => m.role === 'assistant')
      .map((m) => normalize(m.content)));
    // Se já foi perguntado antes, não insistir; usuário pode preencher pelo editor quando quiser.
    const next = order.find((key) => {
      const part = state.sections.find((item) => item.section_key === key);
      const question = prompts[key];
      return part && question && !String(part.content || '').trim() &&
        ![...asked].some((reply) => reply.includes(normalize(question)));
    });
    let reply;
    if (state.mode === 'revisar') {
      const missing = state.sections.filter((part) => !String(part.content || '').trim());
      reply = missing.length
        ? 'Ainda há ' + missing.length + ' seções sem texto. Priorize: ' + missing.slice(0, 3).map((part) => part.title).join(', ') + '.'
        : 'Todas as seções têm texto. Faça uma revisão final de coerência, datas e orçamento.';
    } else if (state.mode === 'adaptar') {
      reply = 'Para adaptar a um edital, use Editais & oportunidades e confira os critérios oficiais. O modo local não interpreta editais automaticamente.';
    } else {
      const result = updatedTitle ? 'Adicionado em “' + updatedTitle + '”.' :
        alreadySaved ? 'Essa informação já consta na seção correspondente.' :
        'Mensagem salva no histórico. Não identifiquei uma seção com segurança; escreva diretamente no editor.';
      reply = result + (next ? '\n\nPróximo ponto, se quiser definir agora: ' + prompts[next] :
        '\n\nSem novas perguntas automáticas. Você pode continuar escrevendo nas seções.');
    }
    const { error: replyError } = await supabase.from('cultural_project_messages').insert({
      project_id: state.currentProject.id, role: 'assistant', mode: state.mode,
      content: reply, metadata: { engine: 'apollus-local-organizer-v2', no_external_api: true },
      created_by: state.session.user.id,
    });
    if (replyError) throw replyError;
    await loadWorkspace(state.currentProject.id);
    renderWorkspace();
    await loadProjects();
    status.hidden = true;
  } catch (error) {
    console.error(error);
    status.className = 'cultural-ai-status error';
    status.textContent = 'Não consegui organizar a mensagem: ' + (error?.message || 'Erro inesperado.');
  } finally {
    state.aiBusy = false;
    send.disabled = !state.canEdit;
  }
}

async function askOnlineAssistant({ messageId, initial = false } = {}) {
  if (!state.currentProject || state.aiBusy) return;
  state.aiBusy = true;
  const status = el('cultural-ai-status');
  const send = el('cultural-chat-send');
  status.hidden = false;
  status.className = 'cultural-ai-status working';
  status.textContent = initial ? '✦ Organizando com IA online...' : '✦ Consultando IA online...';
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
    } catch {}

    const creditIssue = /quota|credit|billing|insufficient|payment|saldo|cr[eé]dito/i.test(raw);
    const keyIssue = /OPENAI_API_KEY|api key|unauthorized|invalid.*key/i.test(raw);
    status.className = 'cultural-ai-status error';
    if (creditIssue) {
      status.innerHTML = '<strong>IA online sem saldo disponível.</strong><span>Adicione créditos na sua conta da OpenAI ou troque o motor para <b>Local grátis</b>. Sua mensagem continua salva.</span>';
    } else if (keyIssue) {
      status.innerHTML = '<strong>IA online ainda não está conectada.</strong><span>Configure uma <code>OPENAI_API_KEY</code> válida no Supabase. Enquanto isso, use <b>Local grátis</b>.</span>';
    } else {
      status.innerHTML = '<strong>Não consegui usar a IA online agora.</strong><span>' + escapeHtml(raw || 'Tente novamente em instantes.') + ' Você pode trocar para <b>Local grátis</b>.</span>';
    }
  } finally {
    state.aiBusy = false;
    send.disabled = !state.canEdit;
  }
}

async function askAssistant({ messageId, initial = false } = {}) {
  return state.aiEngine === 'openai'
    ? askOnlineAssistant({ messageId, initial })
    : askLocalAssistant({ messageId, initial });
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
    el('cultural-workspace-dialog')?.close();
  }
  await loadProjects();
  notify('Projeto apagado.');
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
  el('cultural-toggle-assistant')?.addEventListener('click', () => {
    const layout = document.querySelector('.cultural-workspace-layout');
    const button = el('cultural-toggle-assistant');
    const active = layout?.classList.toggle('show-assistant') || false;
    button?.setAttribute('aria-expanded', String(active));
    if (button) button.textContent = active ? 'Ocultar assistente' : 'Assistente IA';
  });
  el('cultural-delete-current')?.addEventListener('click', () => {
    if (state.currentProject) deleteCulturalProject(state.currentProject.id);
  });
  document.querySelectorAll('[data-cultural-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.culturalMode)));
  document.querySelectorAll('[data-cultural-side-tab]').forEach((b) => b.addEventListener('click', () => setSideTab(b.dataset.culturalSideTab)));
  el('cultural-ai-engine')?.addEventListener('change', (event) => {
    state.aiEngine = event.target.value === 'openai' ? 'openai' : 'local';
    localStorage.setItem('apollus.culturalAiEngine', state.aiEngine);
    notify(state.aiEngine === 'openai' ? 'IA online selecionada. O uso pode gerar cobrança na OpenAI.' : 'Motor local gratuito selecionado.', 'success');
  });
  el('cultural-focus-chat')?.addEventListener('click', () => {
    const layout = document.querySelector('.cultural-workspace-layout');
    const button = el('cultural-focus-chat');
    if (!layout || !button) return;
    const focused = layout.classList.toggle('focus-chat');
    button.textContent = focused ? 'Mostrar estrutura' : 'Focar conversa';
    button.setAttribute('aria-pressed', String(focused));
  });

  document.addEventListener('click', (event) => {
    const deleteProject = event.target.closest('[data-cultural-delete-project]');
    if (deleteProject) {
      event.preventDefault();
      event.stopPropagation();
      deleteCulturalProject(deleteProject.dataset.culturalDeleteProject);
      return;
    }
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
  if (el('cultural-ai-engine')) el('cultural-ai-engine').value = state.aiEngine;
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