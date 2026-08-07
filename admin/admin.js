import {
  supabase,
  isSupabaseConfigured,
  mediaUrl,
  MEDIA_BUCKET,
} from '../supabase-config.js';

const adminPage = document.body.dataset.adminPage;
const state = {
  projects: [],
  agenda: [],
  playlists: [],
  presaves: [],
  trashItems: [],
  siteSettings: null,
  siteSettingsRow: null,
  adminContacts: [],
  meetingInvites: [],
  editingProject: null,
  editingPlaylist: null,
  editingPresave: null,
  editingAgenda: null,
  galleryPaths: [],
  galleryToDelete: [],
  confirmHandler: null,
  activities: [],
  currentSession: null,
  calendarDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  draggedProjectId: null,
 };

const SITE_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_SITE_SETTINGS = Object.freeze({
  site_name: 'Apollus',
  site_title: 'Apollus | Arte, Som & Experiência',
  meta_description: 'Apollus — produtora criativa de música, eventos, teatro, cultura e educação.',
  whatsapp_number: '5541996600432',
  whatsapp_message: 'Olá Apollus! Tenho uma ideia de projeto e gostaria de conversar.',
  instagram_url: 'https://www.instagram.com/apollusart/',
  copyright_year: 2026,
  footer_location: 'Curitiba-PR',
  hero_eyebrow: 'Produtora criativa independente',
  hero_title_line1: 'Transformamos',
  hero_title_highlight: 'ideias',
  hero_title_connector: 'em',
  hero_title_line3: 'experiências.',
  hero_text: 'Música, eventos, teatro, cultura e educação reunidos em um só lugar para dar forma, direção e vida a projetos criativos.',
  hero_primary_label: 'Quero falar sobre meu projeto',
  hero_secondary_label: 'Conhecer a Apollus',
  about_title: 'Uma ponte entre a ideia e a realização.',
  about_text_1: 'O nome Apollus nasce de uma releitura de Apolo, figura mitológica ligada à música, à arte, à luz e à inspiração criativa.',
  about_text_2: 'Somos uma produtora independente que conecta criação, técnica e estratégia para transformar ideias em projetos reais — mesmo quando elas ainda estão no começo.',
  cta_kicker: 'Vamos criar?',
  cta_title: 'Sua ideia não precisa chegar pronta.',
  cta_text: 'A Apollus ajuda a dar forma, direção e estrutura para ela acontecer.',
  cta_button_label: 'Falar sobre meu projeto',
  projects_hero_eyebrow: 'Portfólio e agenda',
  projects_hero_line1: 'Projetos que',
  projects_hero_highlight: 'saíram do papel.',
  projects_hero_text: 'Produções musicais, eventos, projetos culturais, trabalhos artísticos e experiências desenvolvidas pela Apollus.',
  portfolio_title: 'Projetos realizados',
  portfolio_text: 'Trabalhos que já passaram por nossas mãos, ideias que ganharam forma e experiências que aconteceram de verdade.',
  playlist_title: 'Ouça, descubra e fortaleça artistas.',
  playlist_text: 'Playlists pensadas para ampliar descobertas, aproximar públicos e gerar novos ciclos de escuta. Siga, salve e compartilhe.',
  upcoming_title: 'Próximos acontecimentos',
  upcoming_text: 'Eventos, lançamentos e experiências que já estão sendo preparados.',
  calendar_heading: 'Veja o que está acontecendo.',
  calendar_text: 'Navegue pelos meses e abra cada data para consultar detalhes, horários, locais e disponibilidade.',
  agenda_kicker: 'Agenda Apollus',
  agenda_title: 'Tem uma ideia esperando para acontecer?',
  agenda_text: 'Consulte disponibilidade para produções musicais, eventos, projetos culturais, teatro, cursos e experiências criativas.',
  agenda_button_label: 'Consultar agenda',
  agenda_open: true,
  show_team: true,
  show_playlists: true,
  show_agenda: true,
  projects_limit: 0,
  playlists_limit: 0,
  featured_projects_kicker: 'Destaques Apollus',
  featured_projects_title: 'Projetos lançados recentemente',
  show_presaves: true,
  presaves_limit: 0,
  presave_eyebrow: 'Lançamentos em preparação',
  presave_title: 'Pré-save de artistas.',
  presave_text: 'Garanta os próximos lançamentos da Apollus na sua biblioteca e seja uma das primeiras pessoas a ouvir.',
  presave_empty_title: 'Novos lançamentos serão anunciados em breve.',
});

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugify(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function formatDate(dateString) {
  if (!dateString) return 'Sem data';
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function categoryLabel(category = '') {
  const map = {
    musica: 'Música', eventos: 'Eventos', teatro: 'Teatro', cultura: 'Cultura',
    educacao: 'Educação', gravadora: 'Selo & Gravadora', outros: 'Outros',
  };
  return map[category] || category;
}

function platformLabel(platform = '') {
  const map = {
    spotify: 'Spotify', youtube: 'YouTube Music', apple_music: 'Apple Music',
    deezer: 'Deezer', soundcloud: 'SoundCloud', outros: 'Outro streaming',
  };
  return map[platform] || platform || 'Streaming';
}

function statusLabel(status = '') {
  const map = {
    realizado: 'Realizado', em_producao: 'Em produção', proximo: 'Em breve',
    arquivado: 'Arquivado', confirmado: 'Confirmado', disponivel: 'Disponível',
    cancelado: 'Cancelado',
  };
  return map[status] || status;
}


function stageLabel(stage = '') {
  const map = {
    ideia: 'Ideia', planejamento: 'Planejamento', pre_producao: 'Pré-produção',
    producao: 'Produção', pos_producao: 'Pós-produção', finalizado: 'Finalizado',
    publicado: 'Publicado',
  };
  return map[stage] || stage || 'Ideia';
}

function inferProjectStage(project = {}) {
  if (project.stage) return project.stage;
  if (project.published) return 'publicado';
  if (project.status === 'realizado') return 'finalizado';
  if (project.status === 'em_producao') return 'producao';
  return 'ideia';
}

function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Hoje, ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)}`
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function monthShort(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '').toUpperCase();
}

function setMessage(element, message = '', type = '') {
  if (!element) return;
  element.textContent = message;
  element.className = `form-message${type ? ` ${type}` : ''}`;
}

function setGlobalMessage(message, type = '') {
  const box = document.getElementById('admin-global-message');
  if (!box) return;
  box.textContent = message;
  box.className = `admin-alert${type ? ` ${type}` : ''}`;
  box.hidden = !message;
  if (message) setTimeout(() => { box.hidden = true; }, 5000);
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

async function verifyAdmin() {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error('Erro ao verificar administrador:', error);
    return false;
  }
  return data === true;
}

async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function initLogin() {
  const warning = document.getElementById('config-warning');
  const form = document.getElementById('login-form');
  const submit = document.getElementById('login-submit');
  const message = document.getElementById('login-message');

  if (!isSupabaseConfigured || !supabase) {
    warning.hidden = false;
    form.querySelectorAll('input, button').forEach((element) => { element.disabled = true; });
    return;
  }

  const session = await getSession();
  if (session && await verifyAdmin()) {
    window.location.replace('dashboard.html');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message);
    setButtonLoading(submit, true, 'Entrando...');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setButtonLoading(submit, false);
      setMessage(message, 'E-mail ou senha inválidos.', 'error');
      return;
    }

    if (!await verifyAdmin()) {
      await supabase.auth.signOut();
      setButtonLoading(submit, false);
      setMessage(message, 'Esse usuário não possui acesso administrativo.', 'error');
      return;
    }

    window.location.replace('dashboard.html');
  });
}


const ADMIN_SIDEBAR_TIPS = [
  { panel: 'overview', text: 'Use a Visão geral para identificar rapidamente projetos parados, próximos compromissos e pendências.' },
  { panel: 'projects', text: 'Arraste projetos entre as etapas para atualizar o fluxo sem precisar abrir cada projeto.' },
  { panel: 'projects', text: 'Marque “Destacar primeiro” nos projetos que devem ganhar mais visibilidade no site público.' },
  { panel: 'agenda', text: 'Em reuniões, confira horário, convidados e link antes de salvar para evitar convites incompletos.' },
  { panel: 'playlists', text: 'Mantenha links de playlists atualizados para que a curadoria pública sempre leve ao destino correto.' },
  { panel: 'presaves', text: 'Cadastre a data de lançamento no Pré-save para a página trocar automaticamente para “Ouvir agora”.' },
  { panel: 'finance', text: 'Registre pagamentos parciais assim que acontecerem: o saldo pendente é recalculado automaticamente.' },
  { panel: 'history', text: 'Use o Histórico para descobrir quem alterou um conteúdo e comparar as mudanças realizadas.' },
  { panel: 'trash', text: 'A Lixeira permite restaurar itens antes da exclusão definitiva. Use a exclusão final com cuidado.' },
  { panel: 'security', text: 'Mantenha a autenticação em duas etapas ativa, principalmente para perfis com acesso ao Financeiro.' },
  { panel: 'settings', text: 'Textos e contatos do site podem ser ajustados em Configurações sem editar o HTML manualmente.' },
  { panel: 'access', text: 'Conceda apenas as permissões necessárias para cada integrante. O Financeiro pode ficar totalmente restrito.' },
];

let adminTipIndex = 0;
let adminTipTimer = null;

function renderSidebarTip(index, restartTimer = true) {
  const text = document.getElementById('admin-tip-text');
  const counter = document.getElementById('admin-tip-counter');
  const progress = document.getElementById('admin-tip-progress');
  if (!text || !counter || !ADMIN_SIDEBAR_TIPS.length) return;

  adminTipIndex = (index + ADMIN_SIDEBAR_TIPS.length) % ADMIN_SIDEBAR_TIPS.length;
  const tip = ADMIN_SIDEBAR_TIPS[adminTipIndex];

  if (text.textContent !== tip.text) text.textContent = tip.text;
  counter.textContent = `${adminTipIndex + 1} / ${ADMIN_SIDEBAR_TIPS.length}`;
  if (progress) progress.style.width = `${((adminTipIndex + 1) / ADMIN_SIDEBAR_TIPS.length) * 100}%`;

  if (restartTimer) startSidebarTipRotation();
}

function startSidebarTipRotation() {
  window.clearInterval(adminTipTimer);
  if (document.hidden) return;
  adminTipTimer = window.setInterval(() => renderSidebarTip(adminTipIndex + 1, false), 9000);
}

function showTipForPanel(panel) {
  const index = ADMIN_SIDEBAR_TIPS.findIndex((tip) => tip.panel === panel);
  if (index >= 0) renderSidebarTip(index);
}

function setupSidebarTips() {
  const card = document.getElementById('admin-tip-card');
  const previous = document.getElementById('admin-tip-prev');
  const next = document.getElementById('admin-tip-next');
  if (!card) return;

  previous?.addEventListener('click', () => renderSidebarTip(adminTipIndex - 1));
  next?.addEventListener('click', () => renderSidebarTip(adminTipIndex + 1));

  card.addEventListener('mouseenter', () => window.clearInterval(adminTipTimer));
  card.addEventListener('mouseleave', startSidebarTipRotation);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.clearInterval(adminTipTimer);
    else startSidebarTipRotation();
  });

  renderSidebarTip(0);
}


async function initDashboard() {
  if (!isSupabaseConfigured || !supabase) {
    window.location.replace('login.html');
    return;
  }

  const session = await getSession();
  if (!session || !await verifyAdmin()) {
    await supabase.auth.signOut();
    window.location.replace('login.html');
    return;
  }

  state.currentSession = session;
  document.getElementById('admin-user').textContent = session.user.email || 'Administrador';
  document.getElementById('admin-loading').hidden = true;
  document.getElementById('admin-app').hidden = false;

  setupDashboardEvents();
  await Promise.all([loadProjects(), loadAgenda(), loadPlaylists(), loadPresaves(), loadActivities(), loadAdminContacts(), loadTrash(), loadSiteSettings()]);
  renderMeetingInviteeOptions();
  populateHistoryActorFilter();
  populateTrashActorFilter();
  renderHistory();
  renderTrash();
  renderSiteSettingsForm();
  renderOverview();
}

function setupDashboardEvents() {
  setupSidebarTips();
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => switchPanel(button.dataset.adminTab));
  });

  document.getElementById('logout-button').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('login.html');
  });

  const sidebar = document.querySelector('.admin-sidebar');
  document.getElementById('sidebar-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
  document.querySelectorAll('.admin-nav-item').forEach((button) => button.addEventListener('click', () => sidebar.classList.remove('open')));

  document.getElementById('new-project-button').addEventListener('click', () => openProjectForm());
  document.getElementById('overview-new-project').addEventListener('click', () => openProjectForm());
  document.getElementById('overview-new-agenda').addEventListener('click', () => openAgendaForm());
  document.getElementById('new-agenda-button').addEventListener('click', () => openAgendaForm());
  document.getElementById('new-playlist-button').addEventListener('click', () => openPlaylistForm());
  document.getElementById('overview-new-playlist').addEventListener('click', () => openPlaylistForm());
  document.getElementById('new-presave-button').addEventListener('click', () => openPresaveForm());
  document.getElementById('overview-new-presave').addEventListener('click', () => openPresaveForm());
  document.getElementById('project-form').addEventListener('submit', saveProject);
  document.getElementById('playlist-form').addEventListener('submit', savePlaylist);
  document.getElementById('presave-form').addEventListener('submit', savePresave);
  document.getElementById('agenda-form').addEventListener('submit', saveAgenda);
  document.getElementById('site-settings-form')?.addEventListener('submit', saveSiteSettings);
  document.getElementById('site-settings-reset')?.addEventListener('click', resetSiteSettingsForm);
  document.getElementById('agenda-type').addEventListener('input', updateMeetingFields);
  document.getElementById('meeting-select-all').addEventListener('click', toggleAllMeetingInvitees);
  document.getElementById('project-title').addEventListener('input', autoFillSlug);
  document.getElementById('presave-artist').addEventListener('input', autoFillPresaveSlug);
  document.getElementById('presave-title').addEventListener('input', autoFillPresaveSlug);
  document.getElementById('presave-slug').addEventListener('input', (event) => { event.target.dataset.touched = 'true'; });

  document.getElementById('project-search').addEventListener('input', renderProjectsAdmin);
  document.getElementById('project-status-filter').addEventListener('change', renderProjectsAdmin);
  document.getElementById('project-stage-filter').addEventListener('change', renderProjectsAdmin);
  document.getElementById('agenda-search').addEventListener('input', renderAgendaAdmin);
  document.getElementById('agenda-status-filter').addEventListener('change', renderAgendaAdmin);
  document.getElementById('playlist-search').addEventListener('input', renderPlaylistsAdmin);
  document.getElementById('playlist-platform-filter').addEventListener('change', renderPlaylistsAdmin);
  document.getElementById('presave-search').addEventListener('input', renderPresavesAdmin);
  document.getElementById('presave-status-filter').addEventListener('change', renderPresavesAdmin);
  ['history-search', 'history-entity-filter', 'history-action-filter', 'history-actor-filter', 'history-period-filter'].forEach((id) => {
    document.getElementById(id)?.addEventListener(id === 'history-search' ? 'input' : 'change', renderHistory);
  });
  ['trash-search', 'trash-entity-filter', 'trash-actor-filter'].forEach((id) => {
    document.getElementById(id)?.addEventListener(id === 'trash-search' ? 'input' : 'change', renderTrash);
  });

  window.addEventListener('apollus-trash-refresh', async () => {
    await loadTrash();
    renderTrash();
  });

  document.querySelectorAll('[data-admin-close]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  document.querySelectorAll('[data-go-panel]').forEach((button) => {
    button.addEventListener('click', () => switchPanel(button.dataset.goPanel));
  });
  document.getElementById('calendar-prev').addEventListener('click', () => {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById('calendar-next').addEventListener('click', () => {
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });

  document.getElementById('confirm-action').addEventListener('click', async () => {
    if (typeof state.confirmHandler === 'function') await state.confirmHandler();
    document.getElementById('confirm-dialog').close();
  });
}

function switchPanel(panel) {
  const titles = { overview: 'Visão geral', projects: 'Projetos', playlists: 'Playlists', presaves: 'Pré-save', agenda: 'Agenda', finance: 'Financeiro', history: 'Histórico', trash: 'Lixeira', access: 'Usuários e acessos', security: 'Segurança', settings: 'Configurações' };
  document.querySelectorAll('[data-admin-tab]').forEach((button) => button.classList.toggle('active', button.dataset.adminTab === panel));
  document.querySelectorAll('[data-panel]').forEach((section) => section.classList.toggle('active', section.dataset.panel === panel));
  document.getElementById('admin-page-title').textContent = titles[panel] || 'Painel';
  document.querySelector('.admin-sidebar')?.classList.remove('open');
  showTipForPanel(panel);
  if (panel === 'overview') renderOverview();
  if (panel === 'history') renderHistory();
  if (panel === 'trash') renderTrash();
}

async function loadProjects() {
  const loading = document.getElementById('projects-admin-loading');
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .is('deleted_at', null)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  loading.hidden = true;
  if (error) {
    console.error(error);
    setGlobalMessage('Não foi possível carregar os projetos.', 'error');
    return;
  }
  state.projects = data || [];
  renderProjectsAdmin();
  renderOverview();
}

function renderProjectsAdmin() {
  const list = document.getElementById('projects-admin-list');
  const empty = document.getElementById('projects-admin-empty');
  const search = document.getElementById('project-search').value.trim().toLowerCase();
  const status = document.getElementById('project-status-filter').value;
  const stage = document.getElementById('project-stage-filter').value;

  const filtered = state.projects.filter((project) => {
    const matchesSearch = !search || `${project.title} ${project.category}`.toLowerCase().includes(search);
    const matchesStatus = status === 'todos' || project.status === status;
    const matchesStage = stage === 'todos' || inferProjectStage(project) === stage;
    return matchesSearch && matchesStatus && matchesStage;
  });

  document.getElementById('project-count').textContent = state.projects.length;
  document.getElementById('project-published-count').textContent = state.projects.filter((project) => project.published).length;
  empty.hidden = filtered.length !== 0;

  list.innerHTML = filtered.map((project) => {
    const cover = mediaUrl(project.cover_path);
    return `
      <article class="admin-list-item" data-project-id="${escapeHtml(project.id)}">
        <div class="admin-list-thumb">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="">` : '<div class="admin-list-placeholder">APOLLUS</div>'}
        </div>
        <div class="admin-list-main">
          <h3>${escapeHtml(project.title)}</h3>
          <div class="admin-list-meta">
            <span class="admin-pill">${escapeHtml(categoryLabel(project.category))}</span>
            <span class="admin-pill">${escapeHtml(statusLabel(project.status))}</span>
            <span class="admin-pill stage">${escapeHtml(stageLabel(inferProjectStage(project)))}</span>
            <span class="admin-pill ${project.published ? 'published' : 'draft'}">${project.published ? 'Publicado' : 'Rascunho'}</span>
            <span>${escapeHtml(formatDate(project.project_date))}</span>
          </div>
        </div>
        <div class="admin-list-actions">
          <button class="icon-button" type="button" data-project-toggle="${escapeHtml(project.id)}" title="${project.published ? 'Ocultar' : 'Publicar'}">${project.published ? eyeOffIcon() : eyeIcon()}</button>
          <button class="icon-button" type="button" data-project-edit="${escapeHtml(project.id)}" title="Editar">${editIcon()}</button>
          <button class="icon-button delete" type="button" data-project-delete="${escapeHtml(project.id)}" title="Mover para a lixeira">${trashIcon()}</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-project-edit]').forEach((button) => button.addEventListener('click', () => openProjectForm(button.dataset.projectEdit)));
  list.querySelectorAll('[data-project-delete]').forEach((button) => button.addEventListener('click', () => confirmDeleteProject(button.dataset.projectDelete)));
  list.querySelectorAll('[data-project-toggle]').forEach((button) => button.addEventListener('click', () => toggleProjectPublished(button.dataset.projectToggle)));
}

async function loadPlaylists() {
  const loading = document.getElementById('playlists-admin-loading');
  const { data, error } = await supabase
    .from('streaming_playlists')
    .select('*')
    .is('deleted_at', null)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (loading) loading.hidden = true;
  if (error) {
    console.error(error);
    setGlobalMessage('Não foi possível carregar as playlists. Execute playlists-v1.sql.', 'error');
    return;
  }
  state.playlists = data || [];
  renderPlaylistsAdmin();
  renderOverview();
}

function renderPlaylistsAdmin() {
  const list = document.getElementById('playlists-admin-list');
  const empty = document.getElementById('playlists-admin-empty');
  if (!list || !empty) return;

  const search = document.getElementById('playlist-search').value.trim().toLowerCase();
  const platform = document.getElementById('playlist-platform-filter').value;
  const filtered = state.playlists.filter((playlist) => {
    const haystack = `${playlist.title} ${playlist.artist_name || ''} ${playlist.platform}`.toLowerCase();
    return (!search || haystack.includes(search)) && (platform === 'todos' || playlist.platform === platform);
  });

  document.getElementById('playlist-count').textContent = state.playlists.length;
  document.getElementById('playlist-published-count').textContent = state.playlists.filter((item) => item.published).length;
  empty.hidden = filtered.length !== 0;

  list.innerHTML = filtered.map((playlist) => {
    const cover = mediaUrl(playlist.cover_path);
    return `
      <article class="admin-list-item playlist-admin-item" data-playlist-id="${escapeHtml(playlist.id)}">
        <div class="admin-list-thumb playlist-thumb ${escapeHtml(playlist.platform)}">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="">` : `<div class="admin-list-placeholder">${escapeHtml(platformLabel(playlist.platform))}</div>`}
        </div>
        <div class="admin-list-main">
          <h3>${escapeHtml(playlist.title)}</h3>
          <div class="admin-list-meta">
            <span class="admin-pill platform-pill ${escapeHtml(playlist.platform)}">${escapeHtml(platformLabel(playlist.platform))}</span>
            ${playlist.artist_name ? `<span>${escapeHtml(playlist.artist_name)}</span>` : ''}
            <span class="admin-pill ${playlist.published ? 'published' : 'draft'}">${playlist.published ? 'Publicada' : 'Rascunho'}</span>
            ${playlist.featured ? '<span class="admin-pill stage">Destaque</span>' : ''}
          </div>
        </div>
        <div class="admin-list-actions">
          <a class="icon-button" href="${escapeHtml(playlist.playlist_url)}" target="_blank" rel="noopener noreferrer" title="Abrir no streaming">↗</a>
          <button class="icon-button" type="button" data-playlist-toggle="${escapeHtml(playlist.id)}" title="${playlist.published ? 'Ocultar' : 'Publicar'}">${playlist.published ? eyeOffIcon() : eyeIcon()}</button>
          <button class="icon-button" type="button" data-playlist-edit="${escapeHtml(playlist.id)}" title="Editar">${editIcon()}</button>
          <button class="icon-button delete" type="button" data-playlist-delete="${escapeHtml(playlist.id)}" title="Mover para a lixeira">${trashIcon()}</button>
        </div>
      </article>`;
  }).join('');

  list.querySelectorAll('[data-playlist-edit]').forEach((button) => button.addEventListener('click', () => openPlaylistForm(button.dataset.playlistEdit)));
  list.querySelectorAll('[data-playlist-delete]').forEach((button) => button.addEventListener('click', () => confirmDeletePlaylist(button.dataset.playlistDelete)));
  list.querySelectorAll('[data-playlist-toggle]').forEach((button) => button.addEventListener('click', () => togglePlaylistPublished(button.dataset.playlistToggle)));
}

function resetPlaylistForm() {
  document.getElementById('playlist-form').reset();
  document.getElementById('playlist-id').value = '';
  document.getElementById('playlist-sort-order').value = '0';
  document.getElementById('playlist-published').checked = true;
  document.getElementById('playlist-cover-current').textContent = 'Nenhuma capa enviada.';
  state.editingPlaylist = null;
  setMessage(document.getElementById('playlist-form-message'));
}

function openPlaylistForm(id = '') {
  resetPlaylistForm();
  const playlist = state.playlists.find((item) => item.id === id);
  if (playlist) {
    state.editingPlaylist = playlist;
    document.getElementById('playlist-dialog-title').textContent = 'Editar playlist';
    document.getElementById('playlist-id').value = playlist.id;
    document.getElementById('playlist-title').value = playlist.title || '';
    document.getElementById('playlist-artist').value = playlist.artist_name || '';
    document.getElementById('playlist-platform').value = playlist.platform || 'spotify';
    document.getElementById('playlist-sort-order').value = playlist.sort_order || 0;
    document.getElementById('playlist-url').value = playlist.playlist_url || '';
    document.getElementById('playlist-embed-url').value = playlist.embed_url || '';
    document.getElementById('playlist-description').value = playlist.description || '';
    document.getElementById('playlist-published').checked = Boolean(playlist.published);
    document.getElementById('playlist-featured').checked = Boolean(playlist.featured);
    document.getElementById('playlist-cover-current').textContent = playlist.cover_path ? 'Capa atual preservada.' : 'Nenhuma capa enviada.';
  } else {
    document.getElementById('playlist-dialog-title').textContent = 'Nova playlist';
  }
  document.getElementById('playlist-dialog').showModal();
}

async function savePlaylist(event) {
  event.preventDefault();
  const button = document.getElementById('playlist-save');
  const message = document.getElementById('playlist-form-message');
  setMessage(message);
  setButtonLoading(button, true, 'Salvando...');

  let uploadedNow = [];
  try {
    const old = state.editingPlaylist;
    let coverPath = old?.cover_path || null;
    const filesToDelete = [];
    const coverFile = document.getElementById('playlist-cover-file').files[0];

    if (document.getElementById('playlist-remove-cover').checked && coverPath) {
      filesToDelete.push(coverPath);
      coverPath = null;
    }
    if (coverFile) {
      const newPath = await uploadFile(coverFile, 'playlists/covers', 'image');
      uploadedNow.push(newPath);
      if (coverPath) filesToDelete.push(coverPath);
      coverPath = newPath;
    }

    const playlistUrl = document.getElementById('playlist-url').value.trim();
    const embedUrl = document.getElementById('playlist-embed-url').value.trim();
    if (!/^https?:\/\//i.test(playlistUrl)) throw new Error('Cole um link válido da playlist.');
    if (embedUrl && !/^https?:\/\//i.test(embedUrl)) throw new Error('O link de incorporação precisa começar com http:// ou https://.');

    const payload = {
      title: document.getElementById('playlist-title').value.trim(),
      artist_name: document.getElementById('playlist-artist').value.trim() || null,
      platform: document.getElementById('playlist-platform').value,
      playlist_url: playlistUrl,
      embed_url: embedUrl || null,
      description: document.getElementById('playlist-description').value.trim() || null,
      cover_path: coverPath,
      sort_order: Number(document.getElementById('playlist-sort-order').value || 0),
      published: document.getElementById('playlist-published').checked,
      featured: document.getElementById('playlist-featured').checked,
      updated_at: new Date().toISOString(),
    };
    if (!payload.title) throw new Error('Preencha o título da playlist.');

    const query = old
      ? supabase.from('streaming_playlists').update(payload).eq('id', old.id).select().single()
      : supabase.from('streaming_playlists').insert(payload).select().single();
    const { data, error } = await query;
    if (error) throw error;


    await removeFiles(filesToDelete);
    if (old) state.playlists = state.playlists.map((item) => item.id === data.id ? data : item);
    else state.playlists.unshift(data);
    state.playlists.sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort_order - b.sort_order);

    renderPlaylistsAdmin();
    await loadActivities();
    renderOverview();
    document.getElementById('playlist-dialog').close();
    setGlobalMessage('Playlist salva com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    await removeFiles(uploadedNow);
    setMessage(message, error.message || 'Não foi possível salvar a playlist.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function togglePlaylistPublished(id) {
  const playlist = state.playlists.find((item) => item.id === id);
  if (!playlist) return;
  const { data, error } = await supabase.from('streaming_playlists').update({ published: !playlist.published, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return setGlobalMessage('Não foi possível atualizar a playlist.', 'error');
  state.playlists = state.playlists.map((item) => item.id === id ? data : item);
  renderPlaylistsAdmin();
  await loadActivities();
  renderOverview();
}

function confirmDeletePlaylist(id) {
  const playlist = state.playlists.find((item) => item.id === id);
  if (!playlist) return;
  confirmAction('Mover playlist para a lixeira?', `“${playlist.title}” ficará oculta e poderá ser restaurada depois.`, async () => {
    const { data: moved, error } = await supabase.rpc('apollus_soft_delete', {
      target_entity: 'playlist',
      target_id: id,
    });
    if (error || moved !== true) return setGlobalMessage(error?.message || 'Não foi possível mover a playlist para a lixeira.', 'error');
    await loadPlaylists();
    await loadTrash();
    await loadActivities();
    renderOverview();
    setGlobalMessage('Playlist movida para a lixeira.', 'success');
  });
}

function presaveReleaseTypeLabel(value = '') {
  return { single: 'Single', ep: 'EP', album: 'Álbum', outro: 'Outro' }[value] || 'Lançamento';
}

function presaveReleaseDateTime(item = {}) {
  if (!item.release_date) return null;
  const time = String(item.release_time || '00:00').slice(0, 5);
  const suffix = item.timezone === 'America/Sao_Paulo' ? '-03:00' : '';
  const date = new Date(`${item.release_date}T${time}:00${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function presaveAlreadyReleased(item = {}) {
  const date = presaveReleaseDateTime(item);
  return date ? Date.now() >= date.getTime() : false;
}

async function loadPresaves() {
  const loading = document.getElementById('presaves-admin-loading');
  const { data, error } = await supabase.from('presave_campaigns').select('*')
    .is('deleted_at', null)
    .order('featured', { ascending: false })
    .order('release_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (loading) loading.hidden = true;
  if (error) {
    console.warn('Pré-saves indisponíveis. Execute presave-v1.sql.', error);
    state.presaves = [];
    renderPresavesAdmin();
    return;
  }
  state.presaves = data || [];
  renderPresavesAdmin();
  renderOverview();
}

function renderPresavesAdmin() {
  const list = document.getElementById('presaves-admin-list');
  const empty = document.getElementById('presaves-admin-empty');
  if (!list || !empty) return;
  const search = (document.getElementById('presave-search')?.value || '').trim().toLowerCase();
  const status = document.getElementById('presave-status-filter')?.value || 'todos';
  const filtered = state.presaves.filter((item) => {
    const launched = presaveAlreadyReleased(item);
    const matchesStatus = status === 'todos'
      || (status === 'publicado' && item.published)
      || (status === 'rascunho' && !item.published)
      || (status === 'proximo' && !launched)
      || (status === 'lancado' && launched);
    const haystack = `${item.artist_name || ''} ${item.title || ''} ${item.release_type || ''}`.toLowerCase();
    return (!search || haystack.includes(search)) && matchesStatus;
  });
  const upcoming = state.presaves.filter((item) => !presaveAlreadyReleased(item)).length;
  document.getElementById('presave-count').textContent = state.presaves.length;
  document.getElementById('presave-published-count').textContent = state.presaves.filter((item) => item.published).length;
  document.getElementById('presave-upcoming-count').textContent = upcoming;
  empty.hidden = filtered.length !== 0;
  list.innerHTML = filtered.map((item) => {
    const cover = mediaUrl(item.cover_path);
    const launched = presaveAlreadyReleased(item);
    return `<article class="admin-list-item presave-admin-item" data-presave-id="${escapeHtml(item.id)}">
      <div class="admin-list-thumb presave-admin-thumb">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : '<div class="admin-list-placeholder">PRÉ</div>'}</div>
      <div class="admin-list-main">
        <h3>${escapeHtml(item.artist_name)} — ${escapeHtml(item.title)}</h3>
        <div class="admin-list-meta">
          <span class="admin-pill presave-pill">${escapeHtml(presaveReleaseTypeLabel(item.release_type))}</span>
          <span class="admin-pill ${launched ? 'published' : 'stage'}">${launched ? 'Lançado' : 'Pré-save ativo'}</span>
          <span class="admin-pill ${item.published ? 'published' : 'draft'}">${item.published ? 'Publicado' : 'Rascunho'}</span>
          ${item.featured ? '<span class="admin-pill stage">Destaque</span>' : ''}
          <span>${escapeHtml(formatDate(item.release_date))}${item.release_time ? ` • ${escapeHtml(item.release_time.slice(0, 5))}` : ''}</span>
        </div>
      </div>
      <div class="admin-list-actions">
        <a class="icon-button" href="../presave.html?slug=${encodeURIComponent(item.slug)}" target="_blank" rel="noopener" title="Abrir página pública">↗</a>
        <button class="icon-button" type="button" data-presave-toggle="${escapeHtml(item.id)}" title="${item.published ? 'Ocultar' : 'Publicar'}">${item.published ? eyeOffIcon() : eyeIcon()}</button>
        <button class="icon-button" type="button" data-presave-edit="${escapeHtml(item.id)}" title="Editar">${editIcon()}</button>
        <button class="icon-button delete" type="button" data-presave-delete="${escapeHtml(item.id)}" title="Mover para a lixeira">${trashIcon()}</button>
      </div>
    </article>`;
  }).join('');
  list.querySelectorAll('[data-presave-edit]').forEach((button) => button.addEventListener('click', () => openPresaveForm(button.dataset.presaveEdit)));
  list.querySelectorAll('[data-presave-delete]').forEach((button) => button.addEventListener('click', () => confirmDeletePresave(button.dataset.presaveDelete)));
  list.querySelectorAll('[data-presave-toggle]').forEach((button) => button.addEventListener('click', () => togglePresavePublished(button.dataset.presaveToggle)));
}

function resetPresaveForm() {
  const form = document.getElementById('presave-form');
  form.reset();
  document.getElementById('presave-id').value = '';
  document.getElementById('presave-release-type').value = 'single';
  document.getElementById('presave-release-time').value = '00:00';
  document.getElementById('presave-timezone').value = 'America/Sao_Paulo';
  document.getElementById('presave-sort-order').value = '0';
  document.getElementById('presave-published').checked = true;
  document.getElementById('presave-cover-current').textContent = 'Nenhuma capa enviada.';
  document.getElementById('presave-slug').dataset.touched = '';
  state.editingPresave = null;
  setMessage(document.getElementById('presave-form-message'));
}

function autoFillPresaveSlug() {
  const slugInput = document.getElementById('presave-slug');
  if (!slugInput || slugInput.dataset.touched === 'true') return;
  const artist = document.getElementById('presave-artist').value;
  const title = document.getElementById('presave-title').value;
  slugInput.value = slugify(`${artist} ${title}`);
}

function openPresaveForm(id = '') {
  resetPresaveForm();
  const item = state.presaves.find((campaign) => campaign.id === id);
  if (item) {
    state.editingPresave = item;
    document.getElementById('presave-dialog-title').textContent = 'Editar pré-save';
    document.getElementById('presave-id').value = item.id;
    document.getElementById('presave-artist').value = item.artist_name || '';
    document.getElementById('presave-title').value = item.title || '';
    document.getElementById('presave-slug').value = item.slug || '';
    document.getElementById('presave-slug').dataset.touched = 'true';
    document.getElementById('presave-release-type').value = item.release_type || 'single';
    document.getElementById('presave-release-date').value = item.release_date || '';
    document.getElementById('presave-release-time').value = item.release_time?.slice(0, 5) || '00:00';
    document.getElementById('presave-timezone').value = item.timezone || 'America/Sao_Paulo';
    document.getElementById('presave-sort-order').value = item.sort_order || 0;
    document.getElementById('presave-description').value = item.description || '';
    document.getElementById('presave-url').value = item.presave_url || '';
    document.getElementById('presave-release-url').value = item.release_url || '';
    document.getElementById('presave-instagram-url').value = item.instagram_url || '';
    document.getElementById('presave-published').checked = Boolean(item.published);
    document.getElementById('presave-featured').checked = Boolean(item.featured);
    document.getElementById('presave-cover-current').textContent = item.cover_path ? 'Capa atual preservada.' : 'Nenhuma capa enviada.';
  } else {
    document.getElementById('presave-dialog-title').textContent = 'Novo pré-save';
  }
  document.getElementById('presave-dialog').showModal();
}

async function savePresave(event) {
  event.preventDefault();
  const button = document.getElementById('presave-save');
  const message = document.getElementById('presave-form-message');
  setMessage(message);
  setButtonLoading(button, true, 'Salvando...');
  const uploadedNow = [];
  try {
    const old = state.editingPresave;
    let coverPath = old?.cover_path || null;
    const filesToDelete = [];
    const coverFile = document.getElementById('presave-cover-file').files[0];
    if (document.getElementById('presave-remove-cover').checked && coverPath) {
      filesToDelete.push(coverPath); coverPath = null;
    }
    if (coverFile) {
      const newPath = await uploadFile(coverFile, 'presaves/covers', 'image');
      uploadedNow.push(newPath);
      if (coverPath) filesToDelete.push(coverPath);
      coverPath = newPath;
    }
    const presaveUrl = document.getElementById('presave-url').value.trim();
    const releaseUrl = document.getElementById('presave-release-url').value.trim();
    const instagramUrl = document.getElementById('presave-instagram-url').value.trim();
    [presaveUrl, releaseUrl, instagramUrl].filter(Boolean).forEach((url) => {
      if (!/^https?:\/\//i.test(url)) throw new Error('Todos os links precisam começar com http:// ou https://.');
    });
    const payload = {
      artist_name: document.getElementById('presave-artist').value.trim(),
      title: document.getElementById('presave-title').value.trim(),
      slug: slugify(document.getElementById('presave-slug').value),
      release_type: document.getElementById('presave-release-type').value,
      release_date: document.getElementById('presave-release-date').value,
      release_time: document.getElementById('presave-release-time').value || null,
      timezone: document.getElementById('presave-timezone').value || 'America/Sao_Paulo',
      description: document.getElementById('presave-description').value.trim() || null,
      cover_path: coverPath,
      presave_url: presaveUrl,
      release_url: releaseUrl || null,
      instagram_url: instagramUrl || null,
      sort_order: Number(document.getElementById('presave-sort-order').value || 0),
      published: document.getElementById('presave-published').checked,
      featured: document.getElementById('presave-featured').checked,
      updated_at: new Date().toISOString(),
    };
    if (!payload.artist_name || !payload.title || !payload.slug || !payload.release_date || !payload.presave_url) throw new Error('Preencha artista, título, slug, data e link oficial de pré-save.');
    const query = old
      ? supabase.from('presave_campaigns').update(payload).eq('id', old.id).select().single()
      : supabase.from('presave_campaigns').insert(payload).select().single();
    const { data, error } = await query;
    if (error) {
      if (error.code === '23505') throw new Error('Esse slug já está sendo usado em outra campanha.');
      throw error;
    }
    await removeFiles(filesToDelete);
    if (old) state.presaves = state.presaves.map((item) => item.id === data.id ? data : item);
    else state.presaves.unshift(data);
    state.presaves.sort((a, b) => Number(b.featured) - Number(a.featured) || String(a.release_date).localeCompare(String(b.release_date)) || a.sort_order - b.sort_order);
    renderPresavesAdmin();
    await loadActivities();
    renderOverview();
    document.getElementById('presave-dialog').close();
    setGlobalMessage('Campanha de pré-save salva com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    await removeFiles(uploadedNow);
    setMessage(message, error.message || 'Não foi possível salvar o pré-save.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function togglePresavePublished(id) {
  const item = state.presaves.find((campaign) => campaign.id === id);
  if (!item) return;
  const { data, error } = await supabase.from('presave_campaigns').update({ published: !item.published, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return setGlobalMessage('Não foi possível atualizar a publicação do pré-save.', 'error');
  state.presaves = state.presaves.map((campaign) => campaign.id === id ? data : campaign);
  renderPresavesAdmin(); await loadActivities(); renderOverview();
}

function confirmDeletePresave(id) {
  const item = state.presaves.find((campaign) => campaign.id === id);
  if (!item) return;
  confirmAction('Mover pré-save para a lixeira?', `“${item.artist_name} — ${item.title}” ficará oculto e poderá ser restaurado depois.`, async () => {
    const { data: moved, error } = await supabase.rpc('apollus_soft_delete', {
      target_entity: 'presave',
      target_id: id,
    });
    if (error || moved !== true) return setGlobalMessage(error?.message || 'Não foi possível mover o pré-save para a lixeira.', 'error');
    await loadPresaves();
    await loadTrash();
    await loadActivities();
    renderOverview();
    setGlobalMessage('Pré-save movido para a lixeira.', 'success');
  });
}

async function loadAdminContacts() {
  const { data, error } = await supabase
    .from('admin_contacts')
    .select('user_id, name, email, active')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    console.warn('Contatos administrativos indisponíveis. Execute meetings-v1.sql.', error);
    state.adminContacts = [];
    return;
  }
  state.adminContacts = data || [];
  const currentContact = state.adminContacts.find((contact) => contact.user_id === state.currentSession?.user?.id);
  if (currentContact) {
    document.getElementById('admin-user').innerHTML = `<strong>${escapeHtml(currentContact.name)}</strong><small>${escapeHtml(currentContact.email)}</small>`;
  }
  populateHistoryActorFilter();
  renderHistory();
}

async function loadAgenda() {
  const loading = document.getElementById('agenda-admin-loading');
  const [agendaResult, invitesResult] = await Promise.all([
    supabase
      .from('agenda_events')
      .select('*')
      .is('deleted_at', null)
      .order('start_date', { ascending: false })
      .order('start_time', { ascending: true, nullsFirst: false }),
    supabase
      .from('meeting_invites')
      .select('*')
      .order('created_at', { ascending: true }),
  ]);

  loading.hidden = true;
  if (agendaResult.error) {
    console.error(agendaResult.error);
    setGlobalMessage('Não foi possível carregar a agenda.', 'error');
    return;
  }
  if (invitesResult.error) {
    console.warn('Convites de reunião indisponíveis. Execute meetings-v1.sql.', invitesResult.error);
  }

  state.agenda = agendaResult.data || [];
  state.meetingInvites = invitesResult.data || [];
  renderAgendaAdmin();
  renderOverview();
}

function renderAgendaAdmin() {
  const list = document.getElementById('agenda-admin-list');
  const empty = document.getElementById('agenda-admin-empty');
  const search = document.getElementById('agenda-search').value.trim().toLowerCase();
  const status = document.getElementById('agenda-status-filter').value;

  const filtered = state.agenda.filter((item) => {
    const matchesSearch = !search || `${item.title} ${item.event_type || ''} ${item.location || ''} ${item.start_date || ''}`.toLowerCase().includes(search);
    const matchesStatus = status === 'todos' || item.status === status;
    return matchesSearch && matchesStatus;
  });

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('agenda-count').textContent = state.agenda.length;
  document.getElementById('agenda-upcoming-count').textContent = state.agenda.filter((item) => (item.end_date || item.start_date) >= today && item.status !== 'cancelado').length;
  empty.hidden = filtered.length !== 0;

  list.innerHTML = filtered.map((item) => {
    const image = mediaUrl(item.image_path);
    const inviteCount = state.meetingInvites.filter((invite) => invite.agenda_event_id === item.id).length;
    return `
      <article class="admin-list-item" data-agenda-id="${escapeHtml(item.id)}">
        <div class="admin-list-thumb">
          ${image ? `<img src="${escapeHtml(image)}" alt="">` : '<div class="admin-list-placeholder">DATA</div>'}
        </div>
        <div class="admin-list-main">
          <h3>${escapeHtml(item.title)}</h3>
          <div class="admin-list-meta">
            <span class="admin-pill${item.is_meeting ? ' meeting-pill' : ''}">${escapeHtml(item.event_type || (item.is_meeting ? 'Reunião' : 'Agenda'))}</span>
            ${item.is_meeting ? `<span class="admin-pill invite-pill">${inviteCount} convidado${inviteCount === 1 ? '' : 's'}</span>` : ''}
            <span class="admin-pill">${escapeHtml(statusLabel(item.status))}</span>
            <span class="admin-pill ${item.published ? 'published' : 'draft'}">${item.published ? 'Publicado' : 'Oculto'}</span>
            <span>${escapeHtml(formatDate(item.start_date))}${item.start_time ? ` • ${escapeHtml(item.start_time.slice(0, 5))}` : ''}</span>
          </div>
        </div>
        <div class="admin-list-actions">
          <button class="icon-button" type="button" data-agenda-toggle="${escapeHtml(item.id)}" title="${item.published ? 'Ocultar' : 'Publicar'}">${item.published ? eyeOffIcon() : eyeIcon()}</button>
          <button class="icon-button" type="button" data-agenda-edit="${escapeHtml(item.id)}" title="Editar">${editIcon()}</button>
          <button class="icon-button delete" type="button" data-agenda-delete="${escapeHtml(item.id)}" title="Mover para a lixeira">${trashIcon()}</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-agenda-edit]').forEach((button) => button.addEventListener('click', () => openAgendaForm(button.dataset.agendaEdit)));
  list.querySelectorAll('[data-agenda-delete]').forEach((button) => button.addEventListener('click', () => confirmDeleteAgenda(button.dataset.agendaDelete)));
  list.querySelectorAll('[data-agenda-toggle]').forEach((button) => button.addEventListener('click', () => toggleAgendaPublished(button.dataset.agendaToggle)));
}


function currentActorDetails() {
  const user = state.currentSession?.user;
  const contact = state.adminContacts.find((person) => person.user_id === user?.id);
  return {
    id: user?.id || null,
    name: contact?.name || user?.email || 'Equipe Apollus',
    email: contact?.email || user?.email || null,
  };
}

function trashEntityInfo(entityType = '') {
  return {
    project: { label: 'Projeto', table: 'projects', icon: '▢', className: 'project' },
    agenda: { label: 'Agenda', table: 'agenda_events', icon: '▣', className: 'agenda' },
    playlist: { label: 'Playlist', table: 'streaming_playlists', icon: '▶', className: 'playlist' },
    presave: { label: 'Pré-save', table: 'presave_campaigns', icon: '↓', className: 'presave' },
    finance: { label: 'Financeiro', table: 'financial_entries', icon: 'R$', className: 'finance' },
  }[entityType] || null;
}

function trashItemMedia(item = {}) {
  if (item.entity_type === 'project') return mediaUrl(item.cover_path);
  if (item.entity_type === 'agenda') return mediaUrl(item.image_path);
  if (item.entity_type === 'playlist') return mediaUrl(item.cover_path);
  if (item.entity_type === 'presave') return mediaUrl(item.cover_path);
  return '';
}

async function loadTrash() {
  const loading = document.getElementById('trash-admin-loading');
  const results = await Promise.all([
    supabase.from('projects').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('agenda_events').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('streaming_playlists').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('presave_campaigns').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    supabase.from('financial_entries')
      .select('id, description, entry_type, amount_total, deleted_at, deleted_by, deleted_by_name, deleted_by_email')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
  ]);

  if (loading) loading.hidden = true;
  const error = results.find((result) => result.error)?.error;
  if (error) {
    console.warn('Lixeira indisponível. Execute trash-security-v2.sql.', error);
    state.trashItems = [];
    renderTrash();
    return;
  }

  state.trashItems = [
    ...(results[0].data || []).map((item) => ({ ...item, entity_type: 'project' })),
    ...(results[1].data || []).map((item) => ({ ...item, entity_type: 'agenda' })),
    ...(results[2].data || []).map((item) => ({ ...item, entity_type: 'playlist' })),
    ...(results[3].data || []).map((item) => ({ ...item, entity_type: 'presave' })),
    ...(results[4].data || []).map((item) => ({ ...item, title: item.description, entity_type: 'finance' })),
  ].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));

  populateTrashActorFilter();
  renderTrash();
}

function populateTrashActorFilter() {
  const select = document.getElementById('trash-actor-filter');
  if (!select) return;
  const selected = select.value || 'todos';
  const actors = new Map();
  state.adminContacts.forEach((contact) => actors.set(contact.user_id, { id: contact.user_id, name: contact.name }));
  state.trashItems.forEach((item) => {
    const id = item.deleted_by || item.deleted_by_email || item.deleted_by_name;
    if (id && !actors.has(id)) actors.set(id, { id, name: item.deleted_by_name || item.deleted_by_email || 'Equipe Apollus' });
  });
  select.innerHTML = '<option value="todos">Toda a equipe</option>' + [...actors.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((actor) => `<option value="${escapeHtml(actor.id)}">${escapeHtml(actor.name)}</option>`)
    .join('');
  select.value = [...select.options].some((option) => option.value === selected) ? selected : 'todos';
}

function renderTrash() {
  const list = document.getElementById('trash-admin-list');
  const empty = document.getElementById('trash-admin-empty');
  if (!list || !empty) return;

  const search = (document.getElementById('trash-search')?.value || '').trim().toLowerCase();
  const entity = document.getElementById('trash-entity-filter')?.value || 'todos';
  const actor = document.getElementById('trash-actor-filter')?.value || 'todos';

  const filtered = state.trashItems.filter((item) => {
    const actorId = item.deleted_by || item.deleted_by_email || item.deleted_by_name;
    const haystack = `${item.title || ''} ${item.deleted_by_name || ''} ${item.deleted_by_email || ''} ${item.entity_type || ''}`.toLowerCase();
    return (!search || haystack.includes(search))
      && (entity === 'todos' || item.entity_type === entity)
      && (actor === 'todos' || actorId === actor);
  });

  const todayCount = state.trashItems.filter((item) => new Date(item.deleted_at).toDateString() === new Date().toDateString()).length;
  document.getElementById('trash-count').textContent = state.trashItems.length;
  document.getElementById('trash-today-count').textContent = todayCount;
  empty.hidden = filtered.length !== 0;

  list.innerHTML = filtered.map((item) => {
    const entityInfo = trashEntityInfo(item.entity_type);
    const media = trashItemMedia(item);
    const actorName = item.deleted_by_name || item.deleted_by_email || 'Equipe Apollus';
    return `<article class="trash-item" data-trash-id="${escapeHtml(item.id)}" data-trash-entity="${escapeHtml(item.entity_type)}">
      <div class="trash-thumb ${escapeHtml(entityInfo.className)}">
        ${media ? `<img src="${escapeHtml(media)}" alt="">` : `<span>${entityInfo.icon}</span>`}
      </div>
      <div class="trash-item-main">
        <div class="trash-title-row"><h3>${escapeHtml(item.title || 'Sem título')}</h3><time>${escapeHtml(formatDateTime(item.deleted_at))}</time></div>
        <div class="trash-meta">
          <span class="history-entity-badge ${entityInfo.className}">${entityInfo.icon} ${escapeHtml(entityInfo.label)}</span>
          <span>Excluído por <strong>${escapeHtml(actorName)}</strong></span>
          ${item.deleted_by_email ? `<span>${escapeHtml(item.deleted_by_email)}</span>` : ''}
        </div>
        <p>As mídias vinculadas continuam preservadas e serão recuperadas junto com o item.</p>
      </div>
      <div class="trash-actions">
        <button class="admin-btn restore" type="button" data-trash-restore="${escapeHtml(item.id)}" data-trash-entity="${escapeHtml(item.entity_type)}">↺ Restaurar</button>
        <button class="admin-btn danger permanent" type="button" data-trash-delete="${escapeHtml(item.id)}" data-trash-entity="${escapeHtml(item.entity_type)}">Excluir definitivamente</button>
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-trash-restore]').forEach((button) => button.addEventListener('click', () => restoreTrashItem(button.dataset.trashEntity, button.dataset.trashRestore)));
  list.querySelectorAll('[data-trash-delete]').forEach((button) => button.addEventListener('click', () => confirmPermanentDelete(button.dataset.trashEntity, button.dataset.trashDelete)));
}

function findTrashItem(entityType, id) {
  return state.trashItems.find((item) => item.entity_type === entityType && item.id === id);
}

async function refreshEntityAfterTrashOperation(entityType) {
  if (entityType === 'project') await loadProjects();
  else if (entityType === 'agenda') await loadAgenda();
  else if (entityType === 'playlist') await loadPlaylists();
  else if (entityType === 'presave') await loadPresaves();
  else if (entityType === 'finance') window.dispatchEvent(new CustomEvent('apollus-finance-refresh'));
}

async function restoreTrashItem(entityType, id) {
  const item = findTrashItem(entityType, id);
  const entityInfo = trashEntityInfo(entityType);
  if (!item || !entityInfo) return;

  const { data: restored, error } = await supabase.rpc('apollus_restore', {
    target_entity: entityType,
    target_id: id,
  });
  if (error || restored !== true) {
    return setGlobalMessage(error?.message || 'Não foi possível restaurar o item.', 'error');
  }

  await refreshEntityAfterTrashOperation(entityType);
  await loadTrash();
  await loadActivities();
  renderOverview();
  setGlobalMessage(`${entityInfo.label} restaurado${entityType === 'playlist' ? 'a' : ''} com sucesso.`, 'success');
}

function trashMediaPaths(item = {}) {
  if (item.entity_type === 'project') return [item.cover_path, item.audio_path, ...(item.gallery_paths || [])].filter(Boolean);
  if (item.entity_type === 'agenda') return [item.image_path].filter(Boolean);
  if (item.entity_type === 'playlist') return [item.cover_path].filter(Boolean);
  if (item.entity_type === 'presave') return [item.cover_path].filter(Boolean);
  return [];
}

function confirmPermanentDelete(entityType, id) {
  const item = findTrashItem(entityType, id);
  const entityInfo = trashEntityInfo(entityType);
  if (!item || !entityInfo) return;
  confirmAction(
    'Excluir definitivamente?',
    `“${item.title || 'Sem título'}”${entityType === 'finance' ? '' : ' e suas mídias vinculadas'} será apagado sem possibilidade de restauração.`,
    async () => {
      const paths = trashMediaPaths(item);
      const { data: purged, error } = await supabase.rpc('apollus_purge', {
        target_entity: entityType,
        target_id: id,
      });
      if (error || purged !== true) {
        return setGlobalMessage(error?.message || 'Não foi possível excluir o item definitivamente.', 'error');
      }

      await removeFiles(paths);
      await refreshEntityAfterTrashOperation(entityType);
      await loadTrash();
      await loadActivities();
      renderOverview();
      setGlobalMessage('Item excluído definitivamente.', 'success');
    },
  );
}



function normalizedSiteSettings(value = {}) {
  return { ...DEFAULT_SITE_SETTINGS, ...(value && typeof value === 'object' ? value : {}) };
}

async function loadSiteSettings() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('id, settings, updated_at, updated_by')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    console.warn('Configurações do site indisponíveis. Execute settings-v1.sql.', error);
    state.siteSettingsRow = null;
    state.siteSettings = normalizedSiteSettings();
    return;
  }

  state.siteSettingsRow = data || null;
  state.siteSettings = normalizedSiteSettings(data?.settings);
}

function formControlForSetting(form, key) {
  return form?.elements?.namedItem(key) || null;
}

function fillSiteSettingsForm(settings = state.siteSettings || DEFAULT_SITE_SETTINGS) {
  const form = document.getElementById('site-settings-form');
  if (!form) return;
  const merged = normalizedSiteSettings(settings);

  Object.entries(merged).forEach(([key, value]) => {
    const control = formControlForSetting(form, key);
    if (!control) return;
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = value ?? '';
  });
}

function renderSiteSettingsForm() {
  const form = document.getElementById('site-settings-form');
  if (!form) return;
  fillSiteSettingsForm();

  const meta = document.getElementById('settings-updated-meta');
  if (!meta) return;
  const row = state.siteSettingsRow;
  if (!row?.updated_at) {
    meta.textContent = 'Valores padrão carregados';
    return;
  }
  const contact = state.adminContacts.find((person) => person.user_id === row.updated_by);
  const actor = contact?.name || contact?.email || 'Equipe Apollus';
  meta.textContent = `Última atualização: ${formatDateTime(row.updated_at)} • ${actor}`;
}

function collectSiteSettingsForm() {
  const form = document.getElementById('site-settings-form');
  if (!form) return normalizedSiteSettings();
  const result = {};

  Object.keys(DEFAULT_SITE_SETTINGS).forEach((key) => {
    const control = formControlForSetting(form, key);
    if (!control) return;
    if (control.type === 'checkbox') result[key] = control.checked;
    else if (control.type === 'number') result[key] = Number(control.value || 0);
    else result[key] = control.value.trim();
  });

  result.whatsapp_number = String(result.whatsapp_number || '').replace(/\D/g, '');
  result.projects_limit = Math.max(0, Math.min(100, Number(result.projects_limit || 0)));
  result.playlists_limit = Math.max(0, Math.min(100, Number(result.playlists_limit || 0)));
  result.presaves_limit = Math.max(0, Math.min(100, Number(result.presaves_limit || 0)));
  result.copyright_year = Math.max(2024, Math.min(2100, Number(result.copyright_year || 2026)));

  if (result.whatsapp_number.length < 10 || result.whatsapp_number.length > 15) {
    throw new Error('Informe o WhatsApp com DDI e DDD, usando apenas números.');
  }
  try {
    const instagram = new URL(result.instagram_url);
    if (!['http:', 'https:'].includes(instagram.protocol)) throw new Error();
  } catch {
    throw new Error('Informe um link válido do Instagram.');
  }

  const requiredKeys = [
    'site_name', 'site_title', 'meta_description', 'whatsapp_message', 'footer_location',
    'hero_eyebrow', 'hero_title_line1', 'hero_title_highlight', 'hero_title_connector',
    'hero_title_line3', 'hero_text', 'hero_primary_label', 'hero_secondary_label',
    'about_title', 'about_text_1', 'about_text_2', 'cta_kicker', 'cta_title', 'cta_text',
    'cta_button_label', 'projects_hero_eyebrow', 'projects_hero_line1',
    'projects_hero_highlight', 'projects_hero_text', 'portfolio_title', 'portfolio_text',
    'playlist_title', 'playlist_text', 'upcoming_title', 'upcoming_text', 'calendar_heading',
    'calendar_text', 'agenda_kicker', 'agenda_title', 'agenda_text', 'agenda_button_label',
    'featured_projects_kicker', 'featured_projects_title', 'presave_eyebrow', 'presave_title',
    'presave_text', 'presave_empty_title',
  ];
  const empty = requiredKeys.find((key) => !String(result[key] || '').trim());
  if (empty) throw new Error('Preencha todos os campos obrigatórios antes de salvar.');

  return normalizedSiteSettings(result);
}

async function saveSiteSettings(event) {
  event.preventDefault();
  const button = document.getElementById('site-settings-save');
  const message = document.getElementById('site-settings-message');
  setMessage(message);
  setButtonLoading(button, true, 'Publicando...');

  try {
    const settings = collectSiteSettingsForm();
    const payload = {
      id: SITE_SETTINGS_ID,
      settings,
      updated_by: state.currentSession?.user?.id || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('site_settings')
      .upsert(payload, { onConflict: 'id' })
      .select('id, settings, updated_at, updated_by')
      .single();
    if (error) throw error;

    state.siteSettingsRow = data;
    state.siteSettings = normalizedSiteSettings(data.settings);
    renderSiteSettingsForm();
    await loadActivities();
    renderOverview();
    setMessage(message, 'Configurações publicadas com sucesso.', 'success');
    setGlobalMessage('O site público foi atualizado.', 'success');
  } catch (error) {
    console.error(error);
    const hint = error?.code === '42P01' ? ' Execute settings-v1.sql no Supabase.' : '';
    setMessage(message, `${error.message || 'Não foi possível salvar as configurações.'}${hint}`, 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function resetSiteSettingsForm() {
  if (!window.confirm('Restaurar os textos e opções padrão no formulário? Nada será publicado até você clicar em Salvar configurações.')) return;
  fillSiteSettingsForm(DEFAULT_SITE_SETTINGS);
  setMessage(document.getElementById('site-settings-message'), 'Valores padrão carregados. Clique em Salvar configurações para publicar.', 'success');
}

async function loadActivities() {
  const loading = document.getElementById('history-admin-loading');
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250);

  if (loading) loading.hidden = true;
  if (error) {
    console.warn('Histórico indisponível. Execute history-v1.sql.', error);
    state.activities = [];
    renderHistory();
    return;
  }
  state.activities = data || [];
  populateHistoryActorFilter();
  renderHistory();
}

function activityEntity(entityType = '') {
  return {
    project: { icon: '▢', type: 'Projeto', className: 'project' },
    agenda: { icon: '▣', type: 'Agenda', className: 'agenda' },
    playlist: { icon: '▶', type: 'Playlist', className: 'playlist' },
    presave: { icon: '↓', type: 'Pré-save', className: 'presave' },
    settings: { icon: '⚙', type: 'Configurações', className: 'settings' },
  }[entityType] || { icon: '•', type: 'Item', className: 'item' };
}

function activityAction(action = '') {
  return {
    inserted: { label: 'Criou', passive: 'criado', className: 'inserted' },
    updated: { label: 'Editou', passive: 'atualizado', className: 'updated' },
    deleted: { label: 'Excluiu', passive: 'excluído', className: 'deleted' },
    published: { label: 'Publicou', passive: 'publicado', className: 'published' },
    unpublished: { label: 'Ocultou', passive: 'ocultado', className: 'unpublished' },
    restored: { label: 'Restaurou', passive: 'restaurado', className: 'restored' },
    permanently_deleted: { label: 'Excluiu definitivamente', passive: 'excluído definitivamente', className: 'permanently-deleted' },
  }[action] || { label: 'Alterou', passive: 'atualizado', className: 'updated' };
}

function activityActor(item = {}) {
  const contact = state.adminContacts.find((person) => person.user_id === item.user_id);
  return {
    name: item.actor_name || contact?.name || item.actor_email || 'Equipe Apollus',
    email: item.actor_email || contact?.email || '',
  };
}

function activityChanges(item = {}) {
  if (!item.changes || typeof item.changes !== 'object' || Array.isArray(item.changes)) return {};
  return item.changes;
}

function historyFieldLabel(field = '') {
  const labels = {
    title: 'Título', slug: 'Slug', category: 'Categoria', status: 'Status', stage: 'Etapa',
    published: 'Publicação', featured: 'Destaque', project_date: 'Data do projeto',
    summary: 'Resumo', description: 'Descrição', credits: 'Créditos', video_url: 'Vídeo',
    external_url: 'Link externo', external_label: 'Texto do botão', cover_path: 'Capa',
    audio_path: 'Áudio', gallery_paths: 'Galeria', artist_name: 'Artista / curadoria',
    platform: 'Plataforma', playlist_url: 'Link da playlist', embed_url: 'Link incorporado',
    sort_order: 'Ordem', event_type: 'Tipo', start_date: 'Data inicial', end_date: 'Data final',
    start_time: 'Horário inicial', end_time: 'Horário final', timezone: 'Fuso horário',
    is_meeting: 'Reunião', location: 'Local', image_path: 'Imagem', delivery_status: 'Envio',
    deleted_at: 'Movido para a lixeira', deleted_by: 'Responsável pela exclusão',
    deleted_by_name: 'Nome de quem excluiu', deleted_by_email: 'E-mail de quem excluiu',
    deleted_previous_published: 'Publicação anterior',
    site_name: 'Nome da marca', site_title: 'Título do site', meta_description: 'Descrição para buscadores',
    whatsapp_number: 'WhatsApp', whatsapp_message: 'Mensagem do WhatsApp', instagram_url: 'Instagram',
    copyright_year: 'Ano do rodapé', footer_location: 'Localização do rodapé', hero_eyebrow: 'Texto superior do destaque',
    hero_title_line1: 'Título principal — linha 1', hero_title_highlight: 'Palavra em destaque', hero_title_connector: 'Conector do título',
    hero_title_line3: 'Título principal — linha final', hero_text: 'Apresentação principal', hero_primary_label: 'Botão principal',
    hero_secondary_label: 'Botão secundário', about_title: 'Título Sobre', about_text_1: 'Sobre — parágrafo 1',
    about_text_2: 'Sobre — parágrafo 2', cta_kicker: 'Chamada final', cta_title: 'Título final', cta_text: 'Texto final',
    cta_button_label: 'Botão final', projects_hero_eyebrow: 'Projetos — texto superior', projects_hero_line1: 'Projetos — título',
    projects_hero_highlight: 'Projetos — destaque', projects_hero_text: 'Projetos — introdução', portfolio_title: 'Título do portfólio',
    portfolio_text: 'Descrição do portfólio', playlist_title: 'Título das playlists', playlist_text: 'Descrição das playlists',
    upcoming_title: 'Título de próximos acontecimentos', upcoming_text: 'Descrição de próximos acontecimentos',
    calendar_heading: 'Título do calendário', calendar_text: 'Descrição do calendário', agenda_kicker: 'Chamada da agenda',
    agenda_title: 'Título da agenda', agenda_text: 'Descrição da agenda', agenda_button_label: 'Botão da agenda',
    agenda_open: 'Agenda aberta', show_team: 'Exibir equipe', show_playlists: 'Exibir playlists', show_agenda: 'Exibir agenda',
    projects_limit: 'Limite de projetos', playlists_limit: 'Limite de playlists',
    featured_projects_kicker: 'Chamada do carrossel', featured_projects_title: 'Título do carrossel',
    show_presaves: 'Exibir pré-saves', presaves_limit: 'Limite de pré-saves', presave_eyebrow: 'Pré-save — texto superior',
    presave_title: 'Pré-save — título', presave_text: 'Pré-save — descrição', presave_empty_title: 'Pré-save — mensagem vazia',
    release_type: 'Tipo de lançamento', release_date: 'Data de lançamento', release_time: 'Horário de lançamento',
    presave_url: 'Link de pré-save', release_url: 'Link após lançamento', instagram_url: 'Instagram do artista',
  };
  return labels[field] || field.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function historyValue(value) {
  if (value === null || value === undefined || value === '') return 'Vazio';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Nenhum';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function populateHistoryActorFilter() {
  const select = document.getElementById('history-actor-filter');
  if (!select) return;
  const selected = select.value || 'todos';
  const actors = new Map();
  state.adminContacts.forEach((contact) => actors.set(contact.user_id, { id: contact.user_id, name: contact.name, email: contact.email }));
  state.activities.forEach((item) => {
    const actor = activityActor(item);
    const id = item.user_id || actor.email || actor.name;
    if (id && !actors.has(id)) actors.set(id, { id, name: actor.name, email: actor.email });
  });
  select.innerHTML = '<option value="todos">Toda a equipe</option>' + [...actors.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((actor) => `<option value="${escapeHtml(actor.id)}">${escapeHtml(actor.name)}</option>`)
    .join('');
  select.value = [...select.options].some((option) => option.value === selected) ? selected : 'todos';
}

function activityMatchesPeriod(item, period) {
  if (period === 'todos') return true;
  const created = new Date(item.created_at);
  if (Number.isNaN(created.getTime())) return false;
  const now = new Date();
  if (period === 'hoje') return created.toDateString() === now.toDateString();
  const days = Number(period);
  return created >= new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function renderHistory() {
  const list = document.getElementById('history-admin-list');
  const empty = document.getElementById('history-admin-empty');
  if (!list || !empty) return;

  const search = (document.getElementById('history-search')?.value || '').trim().toLowerCase();
  const entity = document.getElementById('history-entity-filter')?.value || 'todos';
  const action = document.getElementById('history-action-filter')?.value || 'todos';
  const actorFilter = document.getElementById('history-actor-filter')?.value || 'todos';
  const period = document.getElementById('history-period-filter')?.value || 'todos';

  const filtered = state.activities.filter((item) => {
    const actor = activityActor(item);
    const fields = Object.keys(activityChanges(item)).map(historyFieldLabel).join(' ');
    const haystack = `${actor.name} ${actor.email} ${item.entity_title || ''} ${item.entity_type || ''} ${item.action || ''} ${fields}`.toLowerCase();
    const actorId = item.user_id || actor.email || actor.name;
    return (!search || haystack.includes(search))
      && (entity === 'todos' || item.entity_type === entity)
      && (action === 'todos' || item.action === action)
      && (actorFilter === 'todos' || actorId === actorFilter)
      && activityMatchesPeriod(item, period);
  });

  const todayCount = state.activities.filter((item) => new Date(item.created_at).toDateString() === new Date().toDateString()).length;
  document.getElementById('history-count').textContent = state.activities.length;
  document.getElementById('history-today-count').textContent = todayCount;
  empty.hidden = filtered.length !== 0;

  list.innerHTML = filtered.map((item) => {
    const actor = activityActor(item);
    const entityInfo = activityEntity(item.entity_type);
    const actionInfo = activityAction(item.action);
    const changes = Object.keys(activityChanges(item));
    const shown = changes.slice(0, 3);
    const remainder = Math.max(0, changes.length - shown.length);
    const initials = actor.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AP';
    return `<article class="history-item" data-history-open="${escapeHtml(item.id)}">
      <div class="history-actor-avatar">${escapeHtml(initials)}</div>
      <div class="history-item-main">
        <div class="history-item-title-row">
          <h3><strong>${escapeHtml(actor.name)}</strong> ${escapeHtml(actionInfo.label.toLowerCase())} ${entityInfo.type.toLowerCase()} “${escapeHtml(item.entity_title || 'Sem título')}”.</h3>
          <time>${escapeHtml(formatDateTime(item.created_at))}</time>
        </div>
        <div class="history-item-meta">
          <span class="history-entity-badge ${entityInfo.className}">${entityInfo.icon} ${escapeHtml(entityInfo.type)}</span>
          <span class="history-action-badge ${actionInfo.className}">${escapeHtml(actionInfo.label)}</span>
          ${actor.email ? `<span>${escapeHtml(actor.email)}</span>` : ''}
        </div>
        <div class="history-change-chips">
          ${shown.map((field) => `<span>${escapeHtml(historyFieldLabel(field))}</span>`).join('')}
          ${remainder ? `<span>+${remainder} alteração${remainder === 1 ? '' : 'ões'}</span>` : ''}
          ${!changes.length ? '<span>Registro resumido</span>' : ''}
        </div>
      </div>
      <button class="history-open-button" type="button" aria-label="Ver detalhes">→</button>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-history-open]').forEach((item) => {
    item.addEventListener('click', () => openHistoryDetail(item.dataset.historyOpen));
  });
}

function openHistoryDetail(id) {
  const item = state.activities.find((activity) => String(activity.id) === String(id));
  if (!item) return;
  const actor = activityActor(item);
  const entityInfo = activityEntity(item.entity_type);
  const actionInfo = activityAction(item.action);
  const changes = Object.entries(activityChanges(item));
  document.getElementById('history-detail-title').textContent = `${actionInfo.label}: ${item.entity_title || 'Sem título'}`;

  const changesHtml = changes.length ? `<div class="history-detail-changes">
    <h3>O que mudou</h3>
    ${changes.map(([field, values]) => {
      const oldValue = values && typeof values === 'object' ? values.old : null;
      const newValue = values && typeof values === 'object' ? values.new : values;
      return `<div class="history-change-row">
        <strong>${escapeHtml(historyFieldLabel(field))}</strong>
        <div><span>Antes</span><p>${escapeHtml(historyValue(oldValue))}</p></div>
        <div><span>Depois</span><p>${escapeHtml(historyValue(newValue))}</p></div>
      </div>`;
    }).join('')}
  </div>` : '<div class="empty-mini">Este é um registro antigo ou resumido, sem comparação campo a campo.</div>';

  document.getElementById('history-detail-content').innerHTML = `
    <div class="history-detail-summary">
      <div><span>Administrador</span><strong>${escapeHtml(actor.name)}</strong><small>${escapeHtml(actor.email)}</small></div>
      <div><span>Conteúdo</span><strong>${escapeHtml(entityInfo.type)}</strong><small>${escapeHtml(item.entity_title || 'Sem título')}</small></div>
      <div><span>Ação</span><strong>${escapeHtml(actionInfo.label)}</strong><small>${escapeHtml(formatDateTime(item.created_at))}</small></div>
    </div>
    ${changesHtml}`;
  document.getElementById('history-detail-dialog').showModal();
}

function renderOverview() {
  const panel = document.getElementById('overview-panel');
  if (!panel) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const total = state.projects.length;
  const published = state.projects.filter((project) => project.published).length;
  const drafts = total - published;
  const thisMonth = state.projects.filter((project) => {
    const created = new Date(project.created_at);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length;
  const upcoming = state.agenda.filter((item) => (item.end_date || item.start_date) >= today && item.status !== 'cancelado' && item.status !== 'realizado').length;
  const available = state.agenda.filter((item) => (item.end_date || item.start_date) >= today && item.status === 'disponivel').length;
  const playlistsPublished = state.playlists.filter((item) => item.published).length;
  const presavesPublished = state.presaves.filter((item) => item.published).length;

  document.getElementById('overview-project-total').textContent = total;
  document.getElementById('overview-published-total').textContent = published;
  document.getElementById('overview-draft-total').textContent = drafts;
  document.getElementById('overview-upcoming-total').textContent = upcoming;
  document.getElementById('overview-available-total').textContent = available;
  document.getElementById('overview-playlist-total').textContent = playlistsPublished;
  const presaveMetric = document.getElementById('overview-presave-total');
  if (presaveMetric) presaveMetric.textContent = presavesPublished;
  document.getElementById('overview-project-month').textContent = thisMonth ? `+${thisMonth} este mês` : 'Nenhum este mês';
  document.getElementById('overview-published-rate').textContent = total ? `${Math.round((published / total) * 100)}% do total` : '0% do total';
  document.getElementById('overview-draft-rate').textContent = total ? `${Math.round((drafts / total) * 100)}% do total` : '0% do total';

  renderCommitments();
  renderActivity();
  renderCalendar();
  renderKanban();
}

function renderCommitments() {
  const container = document.getElementById('overview-commitments');
  if (!container) return;
  const today = new Date().toISOString().slice(0, 10);
  const items = [...state.agenda]
    .filter((item) => (item.end_date || item.start_date) >= today && !['cancelado', 'realizado'].includes(item.status))
    .sort((a, b) => `${a.start_date}${a.start_time || ''}`.localeCompare(`${b.start_date}${b.start_time || ''}`))
    .slice(0, 5);

  if (!items.length) {
    container.innerHTML = '<div class="empty-mini">Nenhum compromisso futuro cadastrado.</div>';
    return;
  }

  container.innerHTML = items.map((item) => {
    const day = new Date(`${item.start_date}T12:00:00`).getDate();
    const details = [item.start_time?.slice(0, 5), item.location].filter(Boolean).join(' • ');
    return `<div class="commitment-item">
      <div class="commitment-date"><small>${escapeHtml(monthShort(item.start_date))}</small><strong>${day}</strong></div>
      <div class="commitment-info"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(details || item.event_type || 'Agenda Apollus')}</p></div>
      <span class="commitment-status">${escapeHtml(statusLabel(item.status))}</span>
    </div>`;
  }).join('');
}

function renderActivity() {
  const container = document.getElementById('overview-activity');
  if (!container) return;
  let items = state.activities;

  if (!items.length) {
    items = [
      ...state.projects.map((item) => ({ action: 'updated', entity_type: 'project', entity_title: item.title, created_at: item.updated_at || item.created_at })),
      ...state.agenda.map((item) => ({ action: 'updated', entity_type: 'agenda', entity_title: item.title, created_at: item.updated_at || item.created_at })),
      ...state.playlists.map((item) => ({ action: 'updated', entity_type: 'playlist', entity_title: item.title, created_at: item.updated_at || item.created_at })),
      ...state.presaves.map((item) => ({ action: 'updated', entity_type: 'presave', entity_title: `${item.artist_name} — ${item.title}`, created_at: item.updated_at || item.created_at })),
    ].filter((item) => item.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  }

  if (!items.length) {
    container.innerHTML = '<div class="empty-mini">A atividade aparecerá quando a equipe editar projetos, agenda, playlists ou pré-saves.</div>';
    return;
  }

  container.innerHTML = items.slice(0, 6).map((item) => {
    const entity = activityEntity(item.entity_type);
    const action = activityAction(item.action);
    const actor = activityActor(item);
    return `<button type="button" class="activity-item activity-item-button" data-overview-history="${escapeHtml(item.id || '')}">
      <span class="activity-dot">${entity.icon}</span>
      <div><h3>${entity.type} “${escapeHtml(item.entity_title || 'Sem título')}” foi ${escapeHtml(action.passive)}.</h3><p>por ${escapeHtml(actor.name)}</p></div>
      <time>${escapeHtml(formatDateTime(item.created_at))}</time>
    </button>`;
  }).join('');
  container.querySelectorAll('[data-overview-history]').forEach((button) => button.addEventListener('click', () => {
    if (!button.dataset.overviewHistory) return switchPanel('history');
    openHistoryDetail(button.dataset.overviewHistory);
  }));
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  document.getElementById('calendar-title').textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(state.calendarDate).replace(/^./, (c) => c.toUpperCase());

  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());
  const todayKey = new Date().toISOString().slice(0, 10);
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const events = state.agenda.filter((item) => key >= item.start_date && key <= (item.end_date || item.start_date));
    const dots = events.slice(0, 4).map((item) => `<i class="${escapeHtml(item.status)}"></i>`).join('');
    const title = events.map((item) => item.title).join(', ');
    cells.push(`<button type="button" class="calendar-day ${date.getMonth() !== month ? 'outside' : ''} ${key === todayKey ? 'today' : ''} ${events.length ? 'has-event' : ''}" data-calendar-date="${key}" title="${escapeHtml(title)}">
      <span>${date.getDate()}</span>${events.length ? `<span class="calendar-dots">${dots}</span>` : ''}
    </button>`);
  }
  grid.innerHTML = cells.join('');
  grid.querySelectorAll('.has-event').forEach((button) => button.addEventListener('click', () => {
    switchPanel('agenda');
    const search = document.getElementById('agenda-search');
    search.value = button.dataset.calendarDate;
    renderAgendaAdmin();
  }));
}

function renderKanban() {
  const container = document.getElementById('project-kanban');
  if (!container) return;
  const stages = ['ideia', 'planejamento', 'pre_producao', 'producao', 'pos_producao', 'finalizado', 'publicado'];
  container.innerHTML = stages.map((stage) => {
    const projects = state.projects.filter((project) => inferProjectStage(project) === stage);
    return `<section class="kanban-column" data-stage="${stage}">
      <header class="kanban-header"><h3>${escapeHtml(stageLabel(stage))}</h3><span class="kanban-count">${projects.length}</span></header>
      <div class="kanban-items">${projects.map((project) => `<article class="kanban-card" draggable="true" data-kanban-project="${escapeHtml(project.id)}"><h4>${escapeHtml(project.title)}</h4><p>${escapeHtml(categoryLabel(project.category))}</p></article>`).join('')}</div>
      <button type="button" class="kanban-add" data-add-stage="${stage}">+ Adicionar projeto</button>
    </section>`;
  }).join('');

  container.querySelectorAll('[data-add-stage]').forEach((button) => button.addEventListener('click', () => openProjectForm('', button.dataset.addStage)));
  container.querySelectorAll('[data-kanban-project]').forEach((card) => {
    card.addEventListener('click', () => openProjectForm(card.dataset.kanbanProject));
    card.addEventListener('dragstart', () => {
      state.draggedProjectId = card.dataset.kanbanProject;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      state.draggedProjectId = null;
      card.classList.remove('dragging');
      container.querySelectorAll('.drag-over').forEach((column) => column.classList.remove('drag-over'));
    });
  });
  container.querySelectorAll('.kanban-column').forEach((column) => {
    column.addEventListener('dragover', (event) => { event.preventDefault(); column.classList.add('drag-over'); });
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
    column.addEventListener('drop', async (event) => {
      event.preventDefault();
      column.classList.remove('drag-over');
      if (!state.draggedProjectId) return;
      await updateProjectStage(state.draggedProjectId, column.dataset.stage);
    });
  });
}

async function updateProjectStage(id, stage) {
  const project = state.projects.find((item) => item.id === id);
  if (!project || inferProjectStage(project) === stage) return;
  const payload = { stage, updated_at: new Date().toISOString() };
  if (stage === 'publicado') payload.published = true;
  const { data, error } = await supabase.from('projects').update(payload).eq('id', id).select().single();
  if (error) {
    console.error(error);
    setGlobalMessage('Não foi possível mudar a etapa. Execute a migração dashboard-v2.sql.', 'error');
    return;
  }
  state.projects = state.projects.map((item) => item.id === id ? data : item);
  renderProjectsAdmin();
  await loadActivities();
  renderOverview();
  setGlobalMessage(`Projeto movido para ${stageLabel(stage)}.`, 'success');
}

function autoFillSlug() {
  if (!state.editingProject || !document.getElementById('project-slug').dataset.touched) {
    document.getElementById('project-slug').value = slugify(document.getElementById('project-title').value);
  }
}

document.getElementById('project-slug')?.addEventListener('input', (event) => { event.target.dataset.touched = 'true'; });

function resetProjectForm() {
  const form = document.getElementById('project-form');
  form.reset();
  document.getElementById('project-id').value = '';
  document.getElementById('project-sort-order').value = '0';
  document.getElementById('project-stage').value = 'ideia';
  document.getElementById('project-slug').dataset.touched = '';
  document.getElementById('project-cover-current').textContent = 'Nenhuma capa enviada.';
  document.getElementById('project-audio-current').textContent = 'Nenhum áudio enviado.';
  document.getElementById('current-gallery').innerHTML = '';
  state.editingProject = null;
  state.galleryPaths = [];
  state.galleryToDelete = [];
  setMessage(document.getElementById('project-form-message'));
}

function openProjectForm(id = '', initialStage = 'ideia') {
  resetProjectForm();
  const project = state.projects.find((item) => item.id === id);
  if (project) {
    state.editingProject = project;
    state.galleryPaths = [...(project.gallery_paths || [])];
    document.getElementById('project-dialog-title').textContent = 'Editar projeto';
    document.getElementById('project-id').value = project.id;
    document.getElementById('project-title').value = project.title || '';
    document.getElementById('project-slug').value = project.slug || '';
    document.getElementById('project-slug').dataset.touched = 'true';
    document.getElementById('project-category').value = project.category || 'musica';
    document.getElementById('project-status').value = project.status || 'realizado';
    document.getElementById('project-stage').value = inferProjectStage(project);
    document.getElementById('project-date').value = project.project_date || '';
    document.getElementById('project-sort-order').value = project.sort_order ?? 0;
    document.getElementById('project-summary').value = project.summary || '';
    document.getElementById('project-description').value = project.description || '';
    document.getElementById('project-credits').value = project.credits || '';
    document.getElementById('project-video-url').value = project.video_url || '';
    document.getElementById('project-external-url').value = project.external_url || '';
    document.getElementById('project-external-label').value = project.external_label || '';
    document.getElementById('project-published').checked = Boolean(project.published);
    document.getElementById('project-featured').checked = Boolean(project.featured);
    document.getElementById('project-cover-current').textContent = project.cover_path ? 'Capa atual preservada.' : 'Nenhuma capa enviada.';
    document.getElementById('project-audio-current').textContent = project.audio_path ? 'Áudio atual preservado.' : 'Nenhum áudio enviado.';
    renderCurrentGallery();
  } else {
    document.getElementById('project-dialog-title').textContent = 'Novo projeto';
    document.getElementById('project-stage').value = initialStage;
  }
  document.getElementById('project-dialog').showModal();
}

function renderCurrentGallery() {
  const container = document.getElementById('current-gallery');
  container.innerHTML = state.galleryPaths.map((path) => `
    <div class="current-gallery-item">
      <img src="${escapeHtml(mediaUrl(path))}" alt="Imagem da galeria">
      <button type="button" data-remove-gallery="${escapeHtml(path)}" aria-label="Remover imagem">×</button>
    </div>
  `).join('');
  container.querySelectorAll('[data-remove-gallery]').forEach((button) => {
    button.addEventListener('click', () => {
      const path = button.dataset.removeGallery;
      state.galleryPaths = state.galleryPaths.filter((item) => item !== path);
      state.galleryToDelete.push(path);
      renderCurrentGallery();
    });
  });
}

function validateFile(file, type) {
  if (!file) return;
  const maxSize = type === 'audio' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) throw new Error(type === 'audio' ? 'O áudio deve ter até 50 MB.' : 'Cada imagem deve ter até 10 MB.');
  if (type === 'image' && !file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem válido.');
  if (type === 'audio' && !file.type.startsWith('audio/')) throw new Error('Selecione um arquivo de áudio válido.');
}

async function uploadFile(file, folder, type) {
  validateFile(file, type);
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'file';
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

async function removeFiles(paths = []) {
  const clean = [...new Set(paths.filter(Boolean))];
  if (!clean.length) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(clean);
  if (error) console.warn('Não foi possível remover alguns arquivos:', error);
}

async function saveProject(event) {
  event.preventDefault();
  const button = document.getElementById('project-save');
  const message = document.getElementById('project-form-message');
  setMessage(message);
  setButtonLoading(button, true, 'Salvando...');

  let uploadedNow = [];
  try {
    const old = state.editingProject;
    let coverPath = old?.cover_path || null;
    let audioPath = old?.audio_path || null;
    let galleryPaths = [...state.galleryPaths];
    const filesToDelete = [...state.galleryToDelete];

    const coverFile = document.getElementById('project-cover-file').files[0];
    const audioFile = document.getElementById('project-audio-file').files[0];
    const galleryFiles = [...document.getElementById('project-gallery-files').files];

    if (document.getElementById('project-remove-cover').checked && coverPath) {
      filesToDelete.push(coverPath);
      coverPath = null;
    }
    if (document.getElementById('project-remove-audio').checked && audioPath) {
      filesToDelete.push(audioPath);
      audioPath = null;
    }

    if (coverFile) {
      const newPath = await uploadFile(coverFile, 'projects/covers', 'image');
      uploadedNow.push(newPath);
      if (coverPath) filesToDelete.push(coverPath);
      coverPath = newPath;
    }
    if (audioFile) {
      const newPath = await uploadFile(audioFile, 'projects/audio', 'audio');
      uploadedNow.push(newPath);
      if (audioPath) filesToDelete.push(audioPath);
      audioPath = newPath;
    }
    for (const file of galleryFiles) {
      const path = await uploadFile(file, 'projects/gallery', 'image');
      uploadedNow.push(path);
      galleryPaths.push(path);
    }

    const payload = {
      title: document.getElementById('project-title').value.trim(),
      slug: slugify(document.getElementById('project-slug').value),
      category: document.getElementById('project-category').value,
      status: document.getElementById('project-status').value,
      stage: document.getElementById('project-stage').value,
      project_date: document.getElementById('project-date').value || null,
      sort_order: Number(document.getElementById('project-sort-order').value || 0),
      summary: document.getElementById('project-summary').value.trim() || null,
      description: document.getElementById('project-description').value.trim() || null,
      credits: document.getElementById('project-credits').value.trim() || null,
      video_url: document.getElementById('project-video-url').value.trim() || null,
      external_url: document.getElementById('project-external-url').value.trim() || null,
      external_label: document.getElementById('project-external-label').value.trim() || null,
      cover_path: coverPath,
      audio_path: audioPath,
      gallery_paths: galleryPaths,
      published: document.getElementById('project-published').checked,
      featured: document.getElementById('project-featured').checked,
      updated_at: new Date().toISOString(),
    };

    if (!payload.title || !payload.slug) throw new Error('Preencha o título e o slug.');

    const query = old
      ? supabase.from('projects').update(payload).eq('id', old.id).select().single()
      : supabase.from('projects').insert(payload).select().single();
    const { data, error } = await query;
    if (error) throw error;

    await removeFiles(filesToDelete);
    if (old) state.projects = state.projects.map((item) => item.id === data.id ? data : item);
    else state.projects.unshift(data);

    renderProjectsAdmin();
    await loadActivities();
    renderOverview();
    document.getElementById('project-dialog').close();
    setGlobalMessage('Projeto salvo com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    await removeFiles(uploadedNow);
    setMessage(message, error.message || 'Não foi possível salvar o projeto.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function toggleProjectPublished(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  const { data, error } = await supabase.from('projects').update({ published: !project.published, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return setGlobalMessage('Não foi possível atualizar a publicação.', 'error');
  state.projects = state.projects.map((item) => item.id === id ? data : item);
  renderProjectsAdmin();
  await loadActivities();
  renderOverview();
}

function confirmAction(title, text, handler) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  state.confirmHandler = handler;
  document.getElementById('confirm-dialog').showModal();
}

function confirmDeleteProject(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  confirmAction('Mover projeto para a lixeira?', `“${project.title}” ficará oculto e seus arquivos serão preservados para restauração.`, async () => {
    const { data: moved, error } = await supabase.rpc('apollus_soft_delete', {
      target_entity: 'project',
      target_id: id,
    });
    if (error || moved !== true) return setGlobalMessage(error?.message || 'Não foi possível mover o projeto para a lixeira.', 'error');
    await loadProjects();
    await loadTrash();
    await loadActivities();
    renderOverview();
    setGlobalMessage('Projeto movido para a lixeira.', 'success');
  });
}

function isMeetingType(value = '') {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'reuniao';
}

function meetingInviteIdsForEvent(eventId) {
  return state.meetingInvites
    .filter((invite) => invite.agenda_event_id === eventId)
    .map((invite) => invite.invitee_user_id);
}

function renderMeetingInviteeOptions(selectedIds = []) {
  const container = document.getElementById('meeting-invitee-list');
  if (!container) return;
  const selected = new Set(selectedIds);

  if (!state.adminContacts.length) {
    container.innerHTML = '<p class="meeting-empty">Nenhum contato carregado. Execute o arquivo <strong>meetings-v1.sql</strong>.</p>';
    return;
  }

  container.innerHTML = state.adminContacts.map((contact) => `
    <label class="meeting-invitee-option">
      <input type="checkbox" name="meeting-invitee" value="${escapeHtml(contact.user_id)}" ${selected.has(contact.user_id) ? 'checked' : ''}>
      <span class="meeting-avatar">${escapeHtml((contact.name || contact.email).slice(0, 1).toUpperCase())}</span>
      <span class="meeting-person"><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(contact.email)}</small></span>
    </label>
  `).join('');
}

function selectedMeetingInviteeIds() {
  return [...document.querySelectorAll('input[name="meeting-invitee"]:checked')].map((input) => input.value);
}

function toggleAllMeetingInvitees() {
  const inputs = [...document.querySelectorAll('input[name="meeting-invitee"]')];
  const shouldCheck = inputs.some((input) => !input.checked);
  inputs.forEach((input) => { input.checked = shouldCheck; });
  document.getElementById('meeting-select-all').textContent = shouldCheck ? 'Limpar seleção' : 'Selecionar todos';
}

function updateMeetingFields() {
  const panel = document.getElementById('meeting-invite-panel');
  const isMeeting = isMeetingType(document.getElementById('agenda-type').value);
  panel.hidden = !isMeeting;
  document.getElementById('agenda-start-time').required = isMeeting;
  document.getElementById('agenda-end-time').required = isMeeting;
  document.getElementById('agenda-save').textContent = isMeeting ? 'Salvar reunião' : 'Salvar data';

  if (isMeeting && !state.editingAgenda) {
    document.getElementById('agenda-published').checked = false;
  }
}

async function syncMeetingInvites(eventId, selectedIds) {
  const contacts = state.adminContacts.filter((contact) => selectedIds.includes(contact.user_id));
  const { error: deleteError } = await supabase.from('meeting_invites').delete().eq('agenda_event_id', eventId);
  if (deleteError) throw deleteError;

  let inserted = [];
  if (contacts.length) {
    const rows = contacts.map((contact) => ({
      agenda_event_id: eventId,
      invitee_user_id: contact.user_id,
      invitee_name: contact.name,
      invitee_email: contact.email,
      delivery_status: 'pending',
    }));
    const { data, error } = await supabase.from('meeting_invites').insert(rows).select();
    if (error) throw error;
    inserted = data || [];
  }

  state.meetingInvites = [
    ...state.meetingInvites.filter((invite) => invite.agenda_event_id !== eventId),
    ...inserted,
  ];
  return inserted;
}

async function sendMeetingInvites(eventId, action = 'created') {
  const { data, error } = await supabase.functions.invoke('send-meeting-invite', {
    body: { event_id: eventId, action },
  });
  if (error) throw error;
  return data || { sent: 0, failed: 0 };
}

function resetAgendaForm() {
  document.getElementById('agenda-form').reset();
  document.getElementById('agenda-id').value = '';
  document.getElementById('agenda-published').checked = true;
  document.getElementById('agenda-send-invites').checked = true;
  document.getElementById('meeting-invite-panel').hidden = true;
  document.getElementById('meeting-select-all').textContent = 'Selecionar todos';
  document.getElementById('agenda-image-current').textContent = 'Nenhuma imagem enviada.';
  state.editingAgenda = null;
  renderMeetingInviteeOptions();
  updateMeetingFields();
  setMessage(document.getElementById('agenda-form-message'));
}

function openAgendaForm(id = '') {
  resetAgendaForm();
  const item = state.agenda.find((agendaItem) => agendaItem.id === id);
  if (item) {
    state.editingAgenda = item;
    document.getElementById('agenda-dialog-title').textContent = 'Editar data';
    document.getElementById('agenda-id').value = item.id;
    document.getElementById('agenda-title').value = item.title || '';
    document.getElementById('agenda-type').value = item.event_type || '';
    document.getElementById('agenda-start-date').value = item.start_date || '';
    document.getElementById('agenda-end-date').value = item.end_date || '';
    document.getElementById('agenda-start-time').value = item.start_time?.slice(0, 5) || '';
    document.getElementById('agenda-end-time').value = item.end_time?.slice(0, 5) || '';
    document.getElementById('agenda-timezone').value = item.timezone || 'America/Sao_Paulo';
    document.getElementById('agenda-status').value = item.status || 'confirmado';
    document.getElementById('agenda-location').value = item.location || '';
    document.getElementById('agenda-description').value = item.description || '';
    document.getElementById('agenda-external-url').value = item.external_url || '';
    document.getElementById('agenda-published').checked = Boolean(item.published);
    document.getElementById('agenda-image-current').textContent = item.image_path ? 'Imagem atual preservada.' : 'Nenhuma imagem enviada.';
    document.getElementById('agenda-send-invites').checked = false;
    renderMeetingInviteeOptions(meetingInviteIdsForEvent(item.id));
  } else {
    document.getElementById('agenda-dialog-title').textContent = 'Nova data';
  }
  updateMeetingFields();
  document.getElementById('agenda-form-dialog').showModal();
}

async function saveAgenda(event) {
  event.preventDefault();
  const button = document.getElementById('agenda-save');
  const message = document.getElementById('agenda-form-message');
  setMessage(message);
  setButtonLoading(button, true, 'Salvando...');

  let uploadedNow = [];
  try {
    const old = state.editingAgenda;
    let imagePath = old?.image_path || null;
    const filesToDelete = [];
    const imageFile = document.getElementById('agenda-image-file').files[0];

    if (document.getElementById('agenda-remove-image').checked && imagePath) {
      filesToDelete.push(imagePath);
      imagePath = null;
    }
    if (imageFile) {
      const newPath = await uploadFile(imageFile, 'agenda', 'image');
      uploadedNow.push(newPath);
      if (imagePath) filesToDelete.push(imagePath);
      imagePath = newPath;
    }

    const startDate = document.getElementById('agenda-start-date').value;
    const endDate = document.getElementById('agenda-end-date').value || null;
    const startTime = document.getElementById('agenda-start-time').value || null;
    const endTime = document.getElementById('agenda-end-time').value || null;
    const meeting = isMeetingType(document.getElementById('agenda-type').value);
    if (endDate && endDate < startDate) throw new Error('A data final não pode ser anterior à inicial.');
    if (meeting && (!startTime || !endTime)) throw new Error('Informe os horários inicial e final da reunião.');
    if (meeting && (!endDate || endDate === startDate) && endTime <= startTime) throw new Error('O horário final deve ser posterior ao inicial.');

    const payload = {
      title: document.getElementById('agenda-title').value.trim(),
      event_type: document.getElementById('agenda-type').value.trim() || null,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      timezone: document.getElementById('agenda-timezone').value || 'America/Sao_Paulo',
      is_meeting: meeting,
      status: document.getElementById('agenda-status').value,
      location: document.getElementById('agenda-location').value.trim() || null,
      description: document.getElementById('agenda-description').value.trim() || null,
      external_url: document.getElementById('agenda-external-url').value.trim() || null,
      image_path: imagePath,
      published: document.getElementById('agenda-published').checked,
      updated_at: new Date().toISOString(),
    };

    const query = old
      ? supabase.from('agenda_events').update(payload).eq('id', old.id).select().single()
      : supabase.from('agenda_events').insert(payload).select().single();
    const { data, error } = await query;
    if (error) throw error;

    let emailResult = null;
    let emailError = null;
    if (meeting) {
      const selectedIds = selectedMeetingInviteeIds();
      if (!selectedIds.length) throw new Error('Selecione pelo menos uma pessoa para a reunião.');
      await syncMeetingInvites(data.id, selectedIds);
      if (document.getElementById('agenda-send-invites').checked) {
        try {
          emailResult = await sendMeetingInvites(data.id, old ? 'updated' : 'created');
        } catch (notificationError) {
          console.error('Erro ao enviar convites:', notificationError);
          emailError = notificationError;
        }
      }
    } else {
      await syncMeetingInvites(data.id, []);
    }

    await removeFiles(filesToDelete);
    if (old) state.agenda = state.agenda.map((item) => item.id === data.id ? data : item);
    else state.agenda.unshift(data);
    state.agenda.sort((a, b) => b.start_date.localeCompare(a.start_date));

    renderAgendaAdmin();
    await loadActivities();
    renderOverview();
    document.getElementById('agenda-form-dialog').close();
    if (emailError) {
      setGlobalMessage('Reunião salva, mas o envio dos e-mails falhou. Confira a Edge Function e o Resend.', 'error');
    } else if (emailResult) {
      const failedText = emailResult.failed ? ` • ${emailResult.failed} falha(s)` : '';
      setGlobalMessage(`Reunião salva e ${emailResult.sent || 0} convite(s) enviado(s)${failedText}.`, emailResult.failed ? 'error' : 'success');
    } else {
      setGlobalMessage(meeting ? 'Reunião salva sem reenviar os convites.' : 'Agenda atualizada com sucesso.', 'success');
    }
  } catch (error) {
    console.error(error);
    await removeFiles(uploadedNow);
    setMessage(message, error.message || 'Não foi possível salvar a data.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function toggleAgendaPublished(id) {
  const item = state.agenda.find((agendaItem) => agendaItem.id === id);
  if (!item) return;
  const { data, error } = await supabase.from('agenda_events').update({ published: !item.published, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return setGlobalMessage('Não foi possível atualizar a publicação.', 'error');
  state.agenda = state.agenda.map((agendaItem) => agendaItem.id === id ? data : agendaItem);
  renderAgendaAdmin();
  await loadActivities();
  renderOverview();
}

function confirmDeleteAgenda(id) {
  const item = state.agenda.find((agendaItem) => agendaItem.id === id);
  if (!item) return;
  confirmAction('Mover data para a lixeira?', `“${item.title}” ficará oculta e poderá ser restaurada depois.`, async () => {
    const { data: moved, error } = await supabase.rpc('apollus_soft_delete', {
      target_entity: 'agenda',
      target_id: id,
    });
    if (error || moved !== true) return setGlobalMessage(error?.message || 'Não foi possível mover a data para a lixeira.', 'error');
    await loadAgenda();
    await loadTrash();
    await loadActivities();
    renderOverview();
    setGlobalMessage('Data movida para a lixeira.', 'success');
  });
}

function editIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"></path><path d="m14 7 3 3"></path></svg>';
}
function trashIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"></path></svg>';
}
function eyeIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';
}
function eyeOffIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 3 18 18M10.6 6.2A11.4 11.4 0 0 1 12 6c6.5 0 10 6 10 6a16.4 16.4 0 0 1-3 3.7M6.3 6.3C3.5 8.1 2 12 2 12s3.5 6 10 6a10.7 10.7 0 0 0 3.7-.7M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';
}

if (adminPage === 'login') initLogin();
if (adminPage === 'dashboard') initDashboard();
