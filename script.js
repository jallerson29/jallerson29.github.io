// O site público funciona mesmo antes da configuração do Supabase.
// O módulo do CMS só é carregado nas páginas que realmente precisam dele.
let supabase = null;
let isSupabaseConfigured = false;
let mediaUrl = () => '';
let supabaseModuleLoaded = false;

async function ensureSupabase() {
  if (supabaseModuleLoaded) return;
  supabaseModuleLoaded = true;

  try {
    const config = await import('./supabase-config.js');
    supabase = config.supabase;
    isSupabaseConfigured = config.isSupabaseConfigured;
    mediaUrl = config.mediaUrl;
  } catch (error) {
    console.error('Não foi possível carregar o módulo do Supabase:', error);
    supabase = null;
    isSupabaseConfigured = false;
  }
}

const page = document.body?.dataset.page || '';
const header = document.getElementById('header');
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const navLinks = document.querySelectorAll('.main-nav a');

function updateHeader() {
  header?.classList.toggle('scrolled', window.scrollY > 24);
}

function closeMenu() {
  menuToggle?.classList.remove('active');
  mainNav?.classList.remove('open');
  document.body.classList.remove('menu-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
}

menuToggle?.addEventListener('click', () => {
  const willOpen = !mainNav?.classList.contains('open');
  menuToggle.classList.toggle('active', willOpen);
  mainNav?.classList.toggle('open', willOpen);
  document.body.classList.toggle('menu-open', willOpen);
  menuToggle.setAttribute('aria-expanded', String(willOpen));
});

navLinks.forEach((link) => link.addEventListener('click', closeMenu));
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('resize', () => {
  if (window.innerWidth > 760) closeMenu();
});
updateHeader();


// Evita ícones de imagem quebrada caso alguma foto da equipe ainda não tenha sido enviada.
document.querySelectorAll('.team-card img').forEach((image) => {
  image.addEventListener('error', () => {
    image.onerror = null;
    image.src = 'docs/apollus-logo-transparent.png';
    image.classList.add('team-logo-fallback');
  }, { once: true });
});

document.documentElement.classList.add('reveal-animations');

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 })
  : null;

function observeReveals(root = document) {
  root.querySelectorAll('.reveal:not([data-reveal-ready])').forEach((element, index) => {
    element.dataset.revealReady = 'true';
    element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add('visible');
  });
}
observeReveals();

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeExternalUrl(value = '') {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function formatDate(dateString, options = {}) {
  if (!dateString) return '';
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(date);
}

function formatShortDate(dateString) {
  if (!dateString) return '';
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(date).replace('.', '');
}

function formatDateRange(startDate, endDate) {
  if (!startDate) return '';
  if (!endDate || endDate === startDate) return formatDate(startDate);
  return `${formatDate(startDate)} — ${formatDate(endDate)}`;
}

function categoryLabel(category = '') {
  const labels = {
    musica: 'Música',
    eventos: 'Eventos',
    teatro: 'Teatro',
    cultura: 'Cultura',
    educacao: 'Educação',
    gravadora: 'Selo & Gravadora',
    outros: 'Outros',
  };
  return labels[category] || category || 'Projeto';
}

function statusLabel(status = '') {
  const labels = {
    realizado: 'Realizado',
    em_producao: 'Em produção',
    proximo: 'Em breve',
    arquivado: 'Arquivado',
    confirmado: 'Confirmado',
    disponivel: 'Disponível',
    cancelado: 'Cancelado',
  };
  return labels[status] || status || '';
}

function categoryColorClass(category = '') {
  const classes = {
    musica: 'project-purple',
    eventos: 'project-yellow',
    teatro: 'project-cyan',
    cultura: 'project-pink',
    educacao: 'project-cream',
    gravadora: 'project-purple',
    outros: 'project-cream',
  };
  return classes[category] || 'project-cream';
}

function renderProjectCard(project) {
  const cover = mediaUrl(project.cover_path);
  const date = project.project_date ? new Date(`${project.project_date}T12:00:00`) : null;
  const year = date && !Number.isNaN(date.getTime()) ? date.getFullYear() : '';
  const slug = encodeURIComponent(project.slug || project.id);
  const title = escapeHtml(project.title);
  const summary = escapeHtml(project.summary || 'Conheça esse projeto desenvolvido pela Apollus.');
  const imageMarkup = cover
    ? `<img src="${escapeHtml(cover)}" alt="${title}" loading="lazy">`
    : `<div class="project-placeholder"><img src="docs/apollus-logo-transparent.png" alt=""></div>`;

  return `
    <article class="project-card reveal" data-category="${escapeHtml(project.category)}">
      <a class="project-card-link" href="projeto.html?slug=${slug}" aria-label="Conhecer o projeto ${title}">
        <div class="project-image ${categoryColorClass(project.category)}">
          ${imageMarkup}
          <span class="project-status status-${escapeHtml(project.status)}">${escapeHtml(statusLabel(project.status))}</span>
        </div>
        <div class="project-content">
          <div class="project-meta">
            <span>${escapeHtml(categoryLabel(project.category))}</span>
            <time>${escapeHtml(year)}</time>
          </div>
          <h3>${title}</h3>
          <p>${summary}</p>
          <span class="project-link">Conhecer projeto →</span>
        </div>
      </a>
    </article>
  `;
}

async function loadProjectsPage() {
  await ensureSupabase();
  const grid = document.getElementById('projects-grid');
  const loading = document.getElementById('projects-loading');
  const errorState = document.getElementById('projects-error');
  const emptyState = document.getElementById('projects-empty');

  if (!grid) return;
  if (!isSupabaseConfigured || !supabase) {
    loading.hidden = true;
    errorState.hidden = false;
    return;
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .neq('status', 'arquivado')
    .order('featured', { ascending: false })
    .order('project_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  loading.hidden = true;
  if (error) {
    console.error('Erro ao carregar projetos:', error);
    errorState.hidden = false;
    return;
  }

  if (!data?.length) {
    emptyState.hidden = false;
    return;
  }

  grid.innerHTML = data.map(renderProjectCard).join('');
  observeReveals(grid);
  setupProjectFilters();
}

function setupProjectFilters() {
  const filters = document.querySelectorAll('.project-filter');
  const cards = document.querySelectorAll('.project-card');

  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      const selected = filter.dataset.filter;
      filters.forEach((button) => button.classList.remove('active'));
      filter.classList.add('active');

      let visibleCount = 0;
      cards.forEach((card) => {
        const show = selected === 'todos' || card.dataset.category === selected;
        card.hidden = !show;
        if (show) visibleCount += 1;
      });

      const emptyState = document.getElementById('projects-empty');
      if (emptyState) {
        emptyState.hidden = visibleCount !== 0;
        if (visibleCount === 0) {
          emptyState.querySelector('h3').textContent = 'Nenhum projeto nessa categoria ainda.';
          emptyState.querySelector('p').textContent = 'Escolha outra categoria ou volte em breve.';
        }
      }
    });
  });
}

let agendaEvents = [];
let calendarDate = new Date();
calendarDate.setDate(1);

async function loadAgenda() {
  await ensureSupabase();
  const upcomingLoading = document.getElementById('upcoming-loading');
  const upcomingEmpty = document.getElementById('upcoming-empty');

  if (!isSupabaseConfigured || !supabase) {
    if (upcomingLoading) upcomingLoading.hidden = true;
    if (upcomingEmpty) {
      upcomingEmpty.hidden = false;
      upcomingEmpty.innerHTML = '<p>Configure o Supabase para publicar a agenda.</p>';
    }
    renderCalendar();
    return;
  }

  const { data, error } = await supabase
    .from('agenda_events')
    .select('*')
    .eq('published', true)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false });

  if (upcomingLoading) upcomingLoading.hidden = true;
  if (error) {
    console.error('Erro ao carregar agenda:', error);
    if (upcomingEmpty) {
      upcomingEmpty.hidden = false;
      upcomingEmpty.innerHTML = '<p>Não foi possível carregar a agenda.</p>';
    }
    renderCalendar();
    return;
  }

  agendaEvents = data || [];
  renderUpcomingEvents();
  renderCalendar();
}

function renderUpcomingEvents() {
  const grid = document.getElementById('upcoming-grid');
  const empty = document.getElementById('upcoming-empty');
  if (!grid) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = agendaEvents
    .filter((event) => event.status !== 'cancelado')
    .filter((event) => new Date(`${event.end_date || event.start_date}T23:59:59`) >= today)
    .slice(0, 6);

  if (!upcoming.length) {
    if (empty) empty.hidden = false;
    grid.innerHTML = '';
    return;
  }

  if (empty) empty.hidden = true;
  grid.innerHTML = upcoming.map((event) => {
    const externalUrl = safeExternalUrl(event.external_url);
    const action = externalUrl
      ? `<a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir detalhes externos">→</a>`
      : `<button type="button" class="upcoming-open" data-event-id="${escapeHtml(event.id)}" aria-label="Abrir detalhes">→</button>`;

    return `
      <article class="upcoming-card reveal">
        <span class="upcoming-date"><strong>${escapeHtml(new Date(`${event.start_date}T12:00:00`).getDate())}</strong>${escapeHtml(new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${event.start_date}T12:00:00`)).replace('.', '').toUpperCase())}</span>
        <div>
          <span class="project-type">${escapeHtml(event.event_type || statusLabel(event.status))}</span>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml([event.location, event.start_time?.slice(0, 5)].filter(Boolean).join(' • ') || formatShortDate(event.start_date))}</p>
        </div>
        ${action}
      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-event-id]').forEach((button) => {
    button.addEventListener('click', () => openAgendaDialog(button.dataset.eventId));
  });
  observeReveals(grid);
}

function eventsForDay(date) {
  const iso = toISODate(date);
  return agendaEvents.filter((event) => {
    const start = event.start_date;
    const end = event.end_date || event.start_date;
    return iso >= start && iso <= end;
  });
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('calendar-title');
  if (!grid || !title) return;

  title.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(calendarDate)
    .replace(/^./, (letter) => letter.toUpperCase());

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  const todayIso = toISODate(new Date());
  const cells = [];

  for (let i = 0; i < mondayOffset; i += 1) {
    cells.push('<div class="calendar-day outside" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(year, month, day);
    const iso = toISODate(date);
    const dayEvents = eventsForDay(date);
    const chips = dayEvents.slice(0, 3).map((event) => `
      <button class="calendar-event status-${escapeHtml(event.status)}" type="button" data-event-id="${escapeHtml(event.id)}" title="${escapeHtml(event.title)}">
        ${escapeHtml(event.title)}
      </button>
    `).join('');
    const more = dayEvents.length > 3 ? `<span class="calendar-more">+${dayEvents.length - 3}</span>` : '';

    cells.push(`
      <div class="calendar-day${iso === todayIso ? ' today' : ''}${dayEvents.length ? ' has-events' : ''}">
        <span class="calendar-day-number">${day}</span>
        <div class="calendar-events">${chips}${more}</div>
      </div>
    `);
  }

  while (cells.length % 7 !== 0) {
    cells.push('<div class="calendar-day outside" aria-hidden="true"></div>');
  }

  grid.innerHTML = cells.join('');
  grid.querySelectorAll('[data-event-id]').forEach((button) => {
    button.addEventListener('click', () => openAgendaDialog(button.dataset.eventId));
  });
}

function openAgendaDialog(id) {
  const event = agendaEvents.find((item) => item.id === id);
  const dialog = document.getElementById('agenda-dialog');
  const content = document.getElementById('agenda-dialog-content');
  if (!event || !dialog || !content) return;

  const image = mediaUrl(event.image_path);
  const externalUrl = safeExternalUrl(event.external_url);
  content.innerHTML = `
    ${image ? `<img class="dialog-cover" src="${escapeHtml(image)}" alt="${escapeHtml(event.title)}">` : ''}
    <p class="section-kicker">${escapeHtml(event.event_type || 'Agenda')}</p>
    <h2>${escapeHtml(event.title)}</h2>
    <div class="dialog-meta">
      <span>${escapeHtml(formatDateRange(event.start_date, event.end_date))}</span>
      ${event.start_time ? `<span>${escapeHtml(event.start_time.slice(0, 5))}</span>` : ''}
      ${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}
      <span class="event-status status-${escapeHtml(event.status)}">${escapeHtml(statusLabel(event.status))}</span>
    </div>
    ${event.description ? `<p class="dialog-description">${escapeHtml(event.description).replaceAll('\n', '<br>')}</p>` : ''}
    ${externalUrl ? `<a class="btn btn-dark" href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">Mais informações</a>` : ''}
  `;
  dialog.showModal();
}

document.getElementById('calendar-prev')?.addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById('calendar-next')?.addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderCalendar();
});

document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog')?.close());
});

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

function youtubeEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (parsed.pathname.startsWith('/embed/')) return parsed.href;
      if (parsed.pathname.startsWith('/shorts/')) return `https://www.youtube.com/embed/${parsed.pathname.split('/')[2]}`;
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return '';
  }
  return '';
}

async function loadProjectDetail() {
  await ensureSupabase();
  const loading = document.getElementById('project-detail-loading');
  const errorState = document.getElementById('project-detail-error');
  const detail = document.getElementById('project-detail');
  if (!detail) return;

  if (!isSupabaseConfigured || !supabase) {
    loading.hidden = true;
    errorState.hidden = false;
    return;
  }

  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    loading.hidden = true;
    errorState.hidden = false;
    return;
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  loading.hidden = true;
  if (error || !project) {
    console.error('Erro ao carregar projeto:', error);
    errorState.hidden = false;
    return;
  }

  document.title = `${project.title} | Apollus`;
  document.getElementById('detail-category').textContent = categoryLabel(project.category);
  document.getElementById('detail-title').textContent = project.title;
  document.getElementById('detail-summary').textContent = project.summary || '';
  document.getElementById('detail-date').textContent = project.project_date ? formatDate(project.project_date) : '';
  document.getElementById('detail-status').textContent = statusLabel(project.status);

  const cover = mediaUrl(project.cover_path);
  const coverWrap = document.getElementById('detail-cover-wrap');
  if (cover) {
    const image = document.getElementById('detail-cover');
    image.src = cover;
    image.alt = project.title;
    coverWrap.hidden = false;
  }

  if (project.description) {
    document.getElementById('detail-description').innerHTML = escapeHtml(project.description).replaceAll('\n', '<br>');
    document.getElementById('detail-description-section').hidden = false;
  }

  const audio = mediaUrl(project.audio_path);
  if (audio) {
    document.getElementById('detail-audio').src = audio;
    document.getElementById('detail-audio-section').hidden = false;
  }

  const videoUrl = safeExternalUrl(project.video_url);
  if (videoUrl) {
    const embed = youtubeEmbedUrl(videoUrl);
    const videoContainer = document.getElementById('detail-video');
    videoContainer.innerHTML = embed
      ? `<iframe src="${escapeHtml(embed)}" title="Vídeo de ${escapeHtml(project.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
      : `<a href="${escapeHtml(videoUrl)}" class="btn btn-light" target="_blank" rel="noopener noreferrer">Abrir vídeo</a>`;
    document.getElementById('detail-video-section').hidden = false;
  }

  const galleryPaths = Array.isArray(project.gallery_paths) ? project.gallery_paths : [];
  if (galleryPaths.length) {
    const gallery = document.getElementById('detail-gallery');
    gallery.innerHTML = galleryPaths.map((path, index) => {
      const url = mediaUrl(path);
      return `<button class="gallery-item" type="button" data-gallery-url="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(project.title)} — imagem ${index + 1}" loading="lazy"></button>`;
    }).join('');
    gallery.querySelectorAll('[data-gallery-url]').forEach((button) => {
      button.addEventListener('click', () => {
        const dialog = document.getElementById('gallery-dialog');
        const image = document.getElementById('gallery-dialog-image');
        image.src = button.dataset.galleryUrl;
        image.alt = project.title;
        dialog.showModal();
      });
    });
    document.getElementById('detail-gallery-section').hidden = false;
  }

  if (project.credits) {
    document.getElementById('detail-credits').innerHTML = escapeHtml(project.credits).replaceAll('\n', '<br>');
    document.getElementById('detail-credits-section').hidden = false;
  }

  const externalUrl = safeExternalUrl(project.external_url);
  const actions = document.getElementById('detail-actions');
  if (externalUrl) {
    const externalLink = document.getElementById('detail-external-link');
    externalLink.href = externalUrl;
    externalLink.textContent = project.external_label || 'Acessar projeto';
  } else {
    document.getElementById('detail-external-link').remove();
  }
  actions.hidden = false;

  detail.hidden = false;
  observeReveals(detail);
}

if (page === 'projects') {
  loadProjectsPage();
  loadAgenda();
}

if (page === 'project-detail') {
  loadProjectDetail();
}
