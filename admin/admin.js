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
  editingProject: null,
  editingAgenda: null,
  galleryPaths: [],
  galleryToDelete: [],
  confirmHandler: null,
};

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

function statusLabel(status = '') {
  const map = {
    realizado: 'Realizado', em_producao: 'Em produção', proximo: 'Em breve',
    arquivado: 'Arquivado', confirmado: 'Confirmado', disponivel: 'Disponível',
    cancelado: 'Cancelado',
  };
  return map[status] || status;
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

  document.getElementById('admin-user').textContent = session.user.email || 'Administrador';
  document.getElementById('admin-loading').hidden = true;
  document.getElementById('admin-app').hidden = false;

  setupDashboardEvents();
  await Promise.all([loadProjects(), loadAgenda()]);
}

function setupDashboardEvents() {
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
  document.getElementById('new-agenda-button').addEventListener('click', () => openAgendaForm());
  document.getElementById('project-form').addEventListener('submit', saveProject);
  document.getElementById('agenda-form').addEventListener('submit', saveAgenda);
  document.getElementById('project-title').addEventListener('input', autoFillSlug);

  document.getElementById('project-search').addEventListener('input', renderProjectsAdmin);
  document.getElementById('project-status-filter').addEventListener('change', renderProjectsAdmin);
  document.getElementById('agenda-search').addEventListener('input', renderAgendaAdmin);
  document.getElementById('agenda-status-filter').addEventListener('change', renderAgendaAdmin);

  document.querySelectorAll('[data-admin-close]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  document.getElementById('confirm-action').addEventListener('click', async () => {
    if (typeof state.confirmHandler === 'function') await state.confirmHandler();
    document.getElementById('confirm-dialog').close();
  });
}

function switchPanel(panel) {
  document.querySelectorAll('[data-admin-tab]').forEach((button) => button.classList.toggle('active', button.dataset.adminTab === panel));
  document.querySelectorAll('[data-panel]').forEach((section) => section.classList.toggle('active', section.dataset.panel === panel));
  document.getElementById('admin-page-title').textContent = panel === 'projects' ? 'Projetos' : 'Agenda';
}

async function loadProjects() {
  const loading = document.getElementById('projects-admin-loading');
  const { data, error } = await supabase
    .from('projects')
    .select('*')
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
}

function renderProjectsAdmin() {
  const list = document.getElementById('projects-admin-list');
  const empty = document.getElementById('projects-admin-empty');
  const search = document.getElementById('project-search').value.trim().toLowerCase();
  const status = document.getElementById('project-status-filter').value;

  const filtered = state.projects.filter((project) => {
    const matchesSearch = !search || `${project.title} ${project.category}`.toLowerCase().includes(search);
    const matchesStatus = status === 'todos' || project.status === status;
    return matchesSearch && matchesStatus;
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
            <span class="admin-pill ${project.published ? 'published' : 'draft'}">${project.published ? 'Publicado' : 'Rascunho'}</span>
            <span>${escapeHtml(formatDate(project.project_date))}</span>
          </div>
        </div>
        <div class="admin-list-actions">
          <button class="icon-button" type="button" data-project-toggle="${escapeHtml(project.id)}" title="${project.published ? 'Ocultar' : 'Publicar'}">${project.published ? eyeOffIcon() : eyeIcon()}</button>
          <button class="icon-button" type="button" data-project-edit="${escapeHtml(project.id)}" title="Editar">${editIcon()}</button>
          <button class="icon-button delete" type="button" data-project-delete="${escapeHtml(project.id)}" title="Excluir">${trashIcon()}</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-project-edit]').forEach((button) => button.addEventListener('click', () => openProjectForm(button.dataset.projectEdit)));
  list.querySelectorAll('[data-project-delete]').forEach((button) => button.addEventListener('click', () => confirmDeleteProject(button.dataset.projectDelete)));
  list.querySelectorAll('[data-project-toggle]').forEach((button) => button.addEventListener('click', () => toggleProjectPublished(button.dataset.projectToggle)));
}

async function loadAgenda() {
  const loading = document.getElementById('agenda-admin-loading');
  const { data, error } = await supabase
    .from('agenda_events')
    .select('*')
    .order('start_date', { ascending: false })
    .order('start_time', { ascending: true, nullsFirst: false });

  loading.hidden = true;
  if (error) {
    console.error(error);
    setGlobalMessage('Não foi possível carregar a agenda.', 'error');
    return;
  }
  state.agenda = data || [];
  renderAgendaAdmin();
}

function renderAgendaAdmin() {
  const list = document.getElementById('agenda-admin-list');
  const empty = document.getElementById('agenda-admin-empty');
  const search = document.getElementById('agenda-search').value.trim().toLowerCase();
  const status = document.getElementById('agenda-status-filter').value;

  const filtered = state.agenda.filter((item) => {
    const matchesSearch = !search || `${item.title} ${item.event_type || ''} ${item.location || ''}`.toLowerCase().includes(search);
    const matchesStatus = status === 'todos' || item.status === status;
    return matchesSearch && matchesStatus;
  });

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('agenda-count').textContent = state.agenda.length;
  document.getElementById('agenda-upcoming-count').textContent = state.agenda.filter((item) => (item.end_date || item.start_date) >= today && item.status !== 'cancelado').length;
  empty.hidden = filtered.length !== 0;

  list.innerHTML = filtered.map((item) => {
    const image = mediaUrl(item.image_path);
    return `
      <article class="admin-list-item" data-agenda-id="${escapeHtml(item.id)}">
        <div class="admin-list-thumb">
          ${image ? `<img src="${escapeHtml(image)}" alt="">` : '<div class="admin-list-placeholder">DATA</div>'}
        </div>
        <div class="admin-list-main">
          <h3>${escapeHtml(item.title)}</h3>
          <div class="admin-list-meta">
            <span class="admin-pill">${escapeHtml(item.event_type || 'Agenda')}</span>
            <span class="admin-pill">${escapeHtml(statusLabel(item.status))}</span>
            <span class="admin-pill ${item.published ? 'published' : 'draft'}">${item.published ? 'Publicado' : 'Oculto'}</span>
            <span>${escapeHtml(formatDate(item.start_date))}${item.start_time ? ` • ${escapeHtml(item.start_time.slice(0, 5))}` : ''}</span>
          </div>
        </div>
        <div class="admin-list-actions">
          <button class="icon-button" type="button" data-agenda-toggle="${escapeHtml(item.id)}" title="${item.published ? 'Ocultar' : 'Publicar'}">${item.published ? eyeOffIcon() : eyeIcon()}</button>
          <button class="icon-button" type="button" data-agenda-edit="${escapeHtml(item.id)}" title="Editar">${editIcon()}</button>
          <button class="icon-button delete" type="button" data-agenda-delete="${escapeHtml(item.id)}" title="Excluir">${trashIcon()}</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-agenda-edit]').forEach((button) => button.addEventListener('click', () => openAgendaForm(button.dataset.agendaEdit)));
  list.querySelectorAll('[data-agenda-delete]').forEach((button) => button.addEventListener('click', () => confirmDeleteAgenda(button.dataset.agendaDelete)));
  list.querySelectorAll('[data-agenda-toggle]').forEach((button) => button.addEventListener('click', () => toggleAgendaPublished(button.dataset.agendaToggle)));
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
  document.getElementById('project-slug').dataset.touched = '';
  document.getElementById('project-cover-current').textContent = 'Nenhuma capa enviada.';
  document.getElementById('project-audio-current').textContent = 'Nenhum áudio enviado.';
  document.getElementById('current-gallery').innerHTML = '';
  state.editingProject = null;
  state.galleryPaths = [];
  state.galleryToDelete = [];
  setMessage(document.getElementById('project-form-message'));
}

function openProjectForm(id = '') {
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
  confirmAction('Excluir projeto?', `“${project.title}” será removido do site e os arquivos associados serão apagados.`, async () => {
    const paths = [project.cover_path, project.audio_path, ...(project.gallery_paths || [])].filter(Boolean);
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return setGlobalMessage('Não foi possível excluir o projeto.', 'error');
    await removeFiles(paths);
    state.projects = state.projects.filter((item) => item.id !== id);
    renderProjectsAdmin();
    setGlobalMessage('Projeto excluído.', 'success');
  });
}

function resetAgendaForm() {
  document.getElementById('agenda-form').reset();
  document.getElementById('agenda-id').value = '';
  document.getElementById('agenda-published').checked = true;
  document.getElementById('agenda-image-current').textContent = 'Nenhuma imagem enviada.';
  state.editingAgenda = null;
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
    document.getElementById('agenda-status').value = item.status || 'confirmado';
    document.getElementById('agenda-location').value = item.location || '';
    document.getElementById('agenda-description').value = item.description || '';
    document.getElementById('agenda-external-url').value = item.external_url || '';
    document.getElementById('agenda-published').checked = Boolean(item.published);
    document.getElementById('agenda-image-current').textContent = item.image_path ? 'Imagem atual preservada.' : 'Nenhuma imagem enviada.';
  } else {
    document.getElementById('agenda-dialog-title').textContent = 'Nova data';
  }
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
    if (endDate && endDate < startDate) throw new Error('A data final não pode ser anterior à inicial.');

    const payload = {
      title: document.getElementById('agenda-title').value.trim(),
      event_type: document.getElementById('agenda-type').value.trim() || null,
      start_date: startDate,
      end_date: endDate,
      start_time: document.getElementById('agenda-start-time').value || null,
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

    await removeFiles(filesToDelete);
    if (old) state.agenda = state.agenda.map((item) => item.id === data.id ? data : item);
    else state.agenda.unshift(data);
    state.agenda.sort((a, b) => b.start_date.localeCompare(a.start_date));

    renderAgendaAdmin();
    document.getElementById('agenda-form-dialog').close();
    setGlobalMessage('Agenda atualizada com sucesso.', 'success');
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
}

function confirmDeleteAgenda(id) {
  const item = state.agenda.find((agendaItem) => agendaItem.id === id);
  if (!item) return;
  confirmAction('Excluir data?', `“${item.title}” será removido da agenda pública.`, async () => {
    const { error } = await supabase.from('agenda_events').delete().eq('id', id);
    if (error) return setGlobalMessage('Não foi possível excluir a data.', 'error');
    await removeFiles([item.image_path]);
    state.agenda = state.agenda.filter((agendaItem) => agendaItem.id !== id);
    renderAgendaAdmin();
    setGlobalMessage('Data excluída.', 'success');
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
