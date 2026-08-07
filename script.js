// O site público funciona mesmo antes da configuração do Supabase.
// O módulo do CMS só é carregado nas páginas que realmente precisam dele.
let supabase = null;
let isSupabaseConfigured = false;
let mediaUrl = () => '';
let supabaseLoadPromise = null;

/**
 * Carrega o Supabase uma única vez e compartilha a mesma Promise
 * entre Projetos, Playlists e Agenda.
 *
 * Antes, a flag era marcada antes do import terminar. Com isso,
 * as outras seções continuavam com `supabase === null`.
 */
async function ensureSupabase() {
  if (!supabaseLoadPromise) {
    supabaseLoadPromise = import('./supabase-config.js')
      .then((config) => {
        supabase = config.supabase;
        isSupabaseConfigured = config.isSupabaseConfigured;
        mediaUrl = config.mediaUrl;
        return config;
      })
      .catch((error) => {
        console.error('Não foi possível carregar o módulo do Supabase:', error);
        supabase = null;
        isSupabaseConfigured = false;
        supabaseLoadPromise = null;
        return null;
      });
  }

  return supabaseLoadPromise;
}

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

let siteSettings = { ...DEFAULT_SITE_SETTINGS };
let siteSettingsLoadPromise = null;

function setSiteText(id, value) {
  const element = document.getElementById(id);
  if (element && value !== undefined && value !== null) element.textContent = String(value);
}

function applySiteSettings(settings = DEFAULT_SITE_SETTINGS) {
  siteSettings = { ...DEFAULT_SITE_SETTINGS, ...(settings || {}) };

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', siteSettings.meta_description);

  if (page === 'home') document.title = siteSettings.site_title;
  if (page === 'projects') document.title = `Projetos | ${siteSettings.site_name}`;
  if (page === 'presaves') document.title = `Pré-save de artistas | ${siteSettings.site_name}`;
  if (page === 'presave-detail') document.title = `Pré-save | ${siteSettings.site_name}`;

  const whatsappNumber = String(siteSettings.whatsapp_number || '').replace(/\D/g, '');
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(siteSettings.whatsapp_message || '')}`
    : '#';
  document.querySelectorAll('[data-whatsapp-link]').forEach((link) => { link.href = whatsappHref; });

  const instagramUrl = safeExternalUrl(siteSettings.instagram_url);
  document.querySelectorAll('[data-instagram-link]').forEach((link) => {
    if (instagramUrl) link.href = instagramUrl;
  });

  setSiteText('site-footer-copy', `© ${siteSettings.copyright_year} ${siteSettings.site_name} - ${siteSettings.footer_location}`);

  setSiteText('site-hero-eyebrow', siteSettings.hero_eyebrow);
  const heroTitle = document.getElementById('site-hero-title');
  if (heroTitle) {
    heroTitle.innerHTML = `${escapeHtml(siteSettings.hero_title_line1)}<br><span>${escapeHtml(siteSettings.hero_title_highlight)}</span> ${escapeHtml(siteSettings.hero_title_connector)}<br>${escapeHtml(siteSettings.hero_title_line3)}`;
  }
  setSiteText('site-hero-text', siteSettings.hero_text);
  setSiteText('site-hero-primary', siteSettings.hero_primary_label);
  setSiteText('site-hero-secondary', siteSettings.hero_secondary_label);
  setSiteText('site-about-title', siteSettings.about_title);
  setSiteText('site-about-text-1', siteSettings.about_text_1);
  setSiteText('site-about-text-2', siteSettings.about_text_2);
  setSiteText('site-cta-kicker', siteSettings.cta_kicker);
  setSiteText('site-cta-title', siteSettings.cta_title);
  setSiteText('site-cta-text', siteSettings.cta_text);
  setSiteText('site-cta-button', siteSettings.cta_button_label);

  setSiteText('site-projects-hero-eyebrow', siteSettings.projects_hero_eyebrow);
  const projectsTitle = document.getElementById('site-projects-hero-title');
  if (projectsTitle) projectsTitle.innerHTML = `${escapeHtml(siteSettings.projects_hero_line1)}<br><span>${escapeHtml(siteSettings.projects_hero_highlight)}</span>`;
  setSiteText('site-projects-hero-text', siteSettings.projects_hero_text);
  setSiteText('site-portfolio-title', siteSettings.portfolio_title);
  setSiteText('site-portfolio-text', siteSettings.portfolio_text);
  setSiteText('site-playlist-title', siteSettings.playlist_title);
  setSiteText('site-playlist-text', siteSettings.playlist_text);
  setSiteText('site-upcoming-title', siteSettings.upcoming_title);
  setSiteText('site-upcoming-text', siteSettings.upcoming_text);
  setSiteText('site-calendar-heading', siteSettings.calendar_heading);
  setSiteText('site-calendar-text', siteSettings.calendar_text);
  setSiteText('site-agenda-kicker', siteSettings.agenda_kicker);
  setSiteText('site-agenda-title', siteSettings.agenda_title);
  setSiteText('site-agenda-text', siteSettings.agenda_text);
  setSiteText('site-agenda-button', siteSettings.agenda_button_label);
  setSiteText('site-agenda-note-status', siteSettings.agenda_open ? 'ABERTA' : 'CONSULTE');
  setSiteText('site-agenda-note-caption', siteSettings.agenda_open ? 'para novas ideias' : 'novas datas');
  setSiteText('site-featured-projects-kicker', siteSettings.featured_projects_kicker);
  setSiteText('featured-projects-title', siteSettings.featured_projects_title);
  setSiteText('site-presave-eyebrow', siteSettings.presave_eyebrow);
  const presaveTitle = document.getElementById('site-presave-title');
  if (presaveTitle) {
    const title = String(siteSettings.presave_title || 'Pré-save de artistas.');
    const parts = title.split(/\s+/);
    const last = parts.pop() || '';
    presaveTitle.innerHTML = `${escapeHtml(parts.join(' ') || 'Pré-save de')}<br><span>${escapeHtml(last)}</span>`;
  }
  setSiteText('site-presave-text', siteSettings.presave_text);
  setSiteText('site-presave-empty-title', siteSettings.presave_empty_title);

  const team = document.querySelector('[data-site-section="team"]');
  if (team) team.hidden = !siteSettings.show_team;
  document.querySelectorAll('[data-site-section="playlists"]').forEach((section) => { section.hidden = !siteSettings.show_playlists; });
  document.querySelectorAll('[data-site-section="agenda"]').forEach((section) => { section.hidden = !siteSettings.show_agenda; });
  document.querySelectorAll('[data-site-section="presaves"]').forEach((section) => { section.hidden = !siteSettings.show_presaves; });
}

async function loadSiteSettings() {
  if (!siteSettingsLoadPromise) {
    siteSettingsLoadPromise = (async () => {
      await ensureSupabase();
      if (!isSupabaseConfigured || !supabase) {
        applySiteSettings(DEFAULT_SITE_SETTINGS);
        return siteSettings;
      }

      const { data, error } = await supabase
        .from('site_settings')
        .select('settings')
        .eq('id', SITE_SETTINGS_ID)
        .maybeSingle();

      if (error) {
        console.warn('Não foi possível carregar as configurações do site. Usando os valores padrão.', error);
        applySiteSettings(DEFAULT_SITE_SETTINGS);
      } else {
        applySiteSettings(data?.settings || DEFAULT_SITE_SETTINGS);
      }
      return siteSettings;
    })().catch((error) => {
      console.warn('Falha ao aplicar configurações públicas:', error);
      applySiteSettings(DEFAULT_SITE_SETTINGS);
      return siteSettings;
    });
  }
  return siteSettingsLoadPromise;
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


function featuredProjectCard(project) {
  const cover = mediaUrl(project.cover_path);
  const slug = encodeURIComponent(project.slug || project.id);
  const title = escapeHtml(project.title);
  const summary = escapeHtml(project.summary || 'Conheça esse projeto desenvolvido pela Apollus.');
  const externalUrl = safeExternalUrl(project.external_url);
  const imageMarkup = cover
    ? `<img src="${escapeHtml(cover)}" alt="${title}" loading="lazy">`
    : `<div class="featured-project-placeholder"><img src="docs/apollus-logo-transparent.png" alt=""></div>`;
  return `<article class="featured-project-card" data-featured-project="${escapeHtml(project.id)}">
    <a class="featured-project-image ${categoryColorClass(project.category)}" href="projeto.html?slug=${slug}">
      ${imageMarkup}
      <span class="featured-project-category">${escapeHtml(categoryLabel(project.category))}</span>
    </a>
    <div class="featured-project-copy">
      <h3>${title}</h3>
      <p>${summary}</p>
      <div class="featured-project-actions">
        <a class="featured-project-primary" href="projeto.html?slug=${slug}">Ver projeto →</a>
        ${externalUrl ? `<a class="featured-project-secondary" href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">▶ ${escapeHtml(project.external_label || 'Ouvir agora')}</a>` : ''}
      </div>
    </div>
  </article>`;
}

function setupFeaturedProjectsCarousel() {
  const section = document.getElementById('featured-projects-section');
  const track = document.getElementById('featured-projects-track');
  const prev = document.getElementById('featured-projects-prev');
  const next = document.getElementById('featured-projects-next');
  const dots = document.getElementById('featured-projects-dots');
  if (!section || !track || !prev || !next || !dots) return;

  let autoplayId = null;
  const cards = () => [...track.querySelectorAll('.featured-project-card')];
  const visibleCards = () => window.innerWidth <= 720 ? 1 : window.innerWidth <= 1100 ? 2 : 3;
  const maxPage = () => Math.max(0, Math.ceil(cards().length / visibleCards()) - 1);
  const currentPage = () => {
    const card = cards()[0];
    if (!card) return 0;
    const pageWidth = (card.getBoundingClientRect().width + Number.parseFloat(getComputedStyle(track).gap || 0)) * visibleCards();
    return Math.max(0, Math.min(maxPage(), Math.round(track.scrollLeft / Math.max(pageWidth, 1))));
  };
  const updateDots = () => {
    const total = maxPage() + 1;
    const active = currentPage();
    dots.innerHTML = Array.from({ length: total }, (_, index) => `<button type="button" class="${index === active ? 'active' : ''}" data-featured-page="${index}" aria-label="Ir para o grupo ${index + 1}"></button>`).join('');
    dots.querySelectorAll('[data-featured-page]').forEach((button) => button.addEventListener('click', () => goToPage(Number(button.dataset.featuredPage))));
    prev.disabled = active <= 0;
    next.disabled = active >= maxPage();
  };
  const pageStep = () => {
    const card = cards()[0];
    if (!card) return track.clientWidth;
    return (card.getBoundingClientRect().width + Number.parseFloat(getComputedStyle(track).gap || 0)) * visibleCards();
  };
  const goToPage = (page) => {
    track.scrollTo({ left: Math.max(0, Math.min(maxPage(), page)) * pageStep(), behavior: 'smooth' });
  };
  const restartAutoplay = () => {
    window.clearInterval(autoplayId);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || cards().length <= visibleCards()) return;
    autoplayId = window.setInterval(() => {
      const nextPage = currentPage() >= maxPage() ? 0 : currentPage() + 1;
      goToPage(nextPage);
    }, 6500);
  };

  prev.addEventListener('click', () => goToPage(currentPage() - 1));
  next.addEventListener('click', () => goToPage(currentPage() + 1));
  track.addEventListener('scroll', () => window.requestAnimationFrame(updateDots), { passive: true });
  section.addEventListener('pointerenter', () => window.clearInterval(autoplayId));
  section.addEventListener('pointerleave', restartAutoplay);
  section.addEventListener('focusin', () => window.clearInterval(autoplayId));
  section.addEventListener('focusout', restartAutoplay);
  window.addEventListener('resize', () => { updateDots(); restartAutoplay(); }, { passive: true });
  document.addEventListener('visibilitychange', () => document.hidden ? window.clearInterval(autoplayId) : restartAutoplay());

  updateDots();
  restartAutoplay();
}

function renderFeaturedProjects(projects = []) {
  const section = document.getElementById('featured-projects-section');
  const track = document.getElementById('featured-projects-track');
  if (!section || !track) return;
  const featured = projects.filter((project) => project.featured).slice(0, 6);
  section.hidden = featured.length === 0;
  if (!featured.length) return;
  track.innerHTML = featured.map(featuredProjectCard).join('');
  setupFeaturedProjectsCarousel();
}

async function loadProjectsPage() {
  await loadSiteSettings();
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

  let projectsQuery = supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .neq('status', 'arquivado')
    .order('featured', { ascending: false })
    .order('project_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (Number(siteSettings.projects_limit) > 0) projectsQuery = projectsQuery.limit(Number(siteSettings.projects_limit));
  const { data, error } = await projectsQuery;

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

  renderFeaturedProjects(data);
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

function streamingPlatformLabel(platform = '') {
  const labels = {
    spotify: 'Spotify', youtube: 'YouTube Music', apple_music: 'Apple Music',
    deezer: 'Deezer', soundcloud: 'SoundCloud', outros: 'Streaming',
  };
  return labels[platform] || 'Streaming';
}

function spotifyEmbedUrl(value = '') {
  try {
    const url = new URL(value);
    if (!['open.spotify.com', 'spotify.com', 'www.spotify.com'].includes(url.hostname)) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    const supported = ['playlist', 'album', 'artist', 'track', 'show', 'episode'];
    const typeIndex = parts.findIndex((part) => supported.includes(part));
    if (typeIndex < 0 || !parts[typeIndex + 1]) return '';
    return `https://open.spotify.com/embed/${parts[typeIndex]}/${encodeURIComponent(parts[typeIndex + 1])}?utm_source=generator&theme=0`;
  } catch { return ''; }
}

function youtubePlaylistEmbedUrl(value = '') {
  try {
    const url = new URL(value);
    if (!['youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtu.be'].includes(url.hostname)) return '';
    const playlistId = url.searchParams.get('list');
    if (!playlistId) return '';
    return `https://www.youtube.com/embed?listType=playlist&list=${encodeURIComponent(playlistId)}`;
  } catch { return ''; }
}

function appleMusicEmbedUrl(value = '') {
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith('music.apple.com')) return '';
    url.hostname = 'embed.music.apple.com';
    return url.href;
  } catch { return ''; }
}

function resolvePlaylistEmbed(playlist) {
  const manual = safeExternalUrl(playlist.embed_url);
  if (manual) return manual;
  if (playlist.platform === 'spotify') return spotifyEmbedUrl(playlist.playlist_url);
  if (playlist.platform === 'youtube') return youtubePlaylistEmbedUrl(playlist.playlist_url);
  if (playlist.platform === 'apple_music') return appleMusicEmbedUrl(playlist.playlist_url);
  return '';
}

function renderStreamingPlaylist(playlist) {
  const url = safeExternalUrl(playlist.playlist_url);
  const embed = resolvePlaylistEmbed(playlist);
  const cover = mediaUrl(playlist.cover_path);
  const title = escapeHtml(playlist.title);
  const platform = escapeHtml(streamingPlatformLabel(playlist.platform));
  let media = '';

  if (embed) {
    const height = playlist.platform === 'spotify' ? 352 : 320;
    media = `<iframe src="${escapeHtml(embed)}" title="${title} no ${platform}" height="${height}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  } else if (cover) {
    media = `<img class="streaming-cover" src="${escapeHtml(cover)}" alt="Capa da playlist ${title}" loading="lazy">`;
  } else {
    media = `<div class="streaming-placeholder"><span>▶</span><strong>${platform}</strong></div>`;
  }

  return `<article class="streaming-card reveal ${playlist.featured ? 'featured' : ''}">
    <div class="streaming-card-top">
      <span class="streaming-platform ${escapeHtml(playlist.platform)}">${platform}</span>
      ${playlist.featured ? '<span class="streaming-featured">Destaque</span>' : ''}
    </div>
    <div class="streaming-media">${media}</div>
    <div class="streaming-copy">
      ${playlist.artist_name ? `<p class="streaming-curator">Por ${escapeHtml(playlist.artist_name)}</p>` : ''}
      <h3>${title}</h3>
      ${playlist.description ? `<p>${escapeHtml(playlist.description)}</p>` : ''}
      ${url ? `<a class="streaming-action" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir no ${platform} ↗</a>` : ''}
    </div>
  </article>`;
}

async function loadStreamingPlaylists() {
  await loadSiteSettings();
  if (!siteSettings.show_playlists) return;
  await ensureSupabase();
  const grid = document.getElementById('streaming-playlists-grid');
  const loading = document.getElementById('playlists-loading');
  const errorState = document.getElementById('playlists-error');
  const emptyState = document.getElementById('playlists-empty');
  if (!grid) return;

  if (!isSupabaseConfigured || !supabase) {
    loading.hidden = true;
    errorState.hidden = false;
    return;
  }

  let playlistsQuery = supabase
    .from('streaming_playlists')
    .select('*')
    .eq('published', true)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (Number(siteSettings.playlists_limit) > 0) playlistsQuery = playlistsQuery.limit(Number(siteSettings.playlists_limit));
  const { data, error } = await playlistsQuery;

  loading.hidden = true;
  if (error) {
    console.error('Erro ao carregar playlists:', error);
    errorState.hidden = false;
    return;
  }
  if (!data?.length) {
    emptyState.hidden = false;
    return;
  }
  grid.innerHTML = data.map(renderStreamingPlaylist).join('');
  observeReveals(grid);
}

let agendaEvents = [];
let calendarDate = new Date();
calendarDate.setDate(1);

async function loadAgenda() {
  await loadSiteSettings();
  if (!siteSettings.show_agenda) return;
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
  await loadSiteSettings();
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

  document.title = `${project.title} | ${siteSettings.site_name}`;
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


function presaveReleaseDate(campaign = {}) {
  if (!campaign.release_date) return null;
  const time = String(campaign.release_time || '00:00').slice(0, 5);
  const zoneSuffix = campaign.timezone === 'America/Sao_Paulo' ? '-03:00' : '';
  const date = new Date(`${campaign.release_date}T${time}:00${zoneSuffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function presaveIsReleased(campaign = {}) {
  const release = presaveReleaseDate(campaign);
  return release ? Date.now() >= release.getTime() : false;
}

function presavePrimaryAction(campaign = {}) {
  const released = presaveIsReleased(campaign);
  const releaseUrl = safeExternalUrl(campaign.release_url);
  const presaveUrl = safeExternalUrl(campaign.presave_url);
  if (released && releaseUrl) return { url: releaseUrl, label: 'Ouvir agora' };
  return { url: presaveUrl || releaseUrl, label: released ? 'Ouvir lançamento' : 'Fazer pré-save' };
}

function presaveCard(campaign) {
  const cover = mediaUrl(campaign.cover_path);
  const slug = encodeURIComponent(campaign.slug || campaign.id);
  const action = presavePrimaryAction(campaign);
  const release = presaveReleaseDate(campaign);
  const dateLabel = release ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(release) : '';
  const released = presaveIsReleased(campaign);
  return `<article class="presave-card reveal ${campaign.featured ? 'featured' : ''}">
    <a class="presave-card-cover" href="presave.html?slug=${slug}">
      ${cover ? `<img src="${escapeHtml(cover)}" alt="Capa de ${escapeHtml(campaign.title)}" loading="lazy">` : `<div class="presave-card-placeholder"><img src="docs/apollus-logo-transparent.png" alt=""></div>`}
      <span>${escapeHtml(released ? 'LANÇADO' : 'PRÉ-SAVE')}</span>
    </a>
    <div class="presave-card-copy">
      <p class="presave-card-artist">${escapeHtml(campaign.artist_name)}</p>
      <h2><a href="presave.html?slug=${slug}">${escapeHtml(campaign.title)}</a></h2>
      <p class="presave-card-date">${escapeHtml(released ? `Disponível desde ${dateLabel}` : `Lançamento em ${dateLabel}`)}</p>
      <p>${escapeHtml(campaign.description || 'Participe deste lançamento e acompanhe o trabalho do artista.')}</p>
      <div class="presave-card-actions">
        <a class="btn btn-dark" href="presave.html?slug=${slug}">Ver lançamento</a>
        ${action.url ? `<a class="btn btn-outline" href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(action.label)}</a>` : ''}
      </div>
    </div>
  </article>`;
}

async function loadPresavesPage() {
  await loadSiteSettings();
  await ensureSupabase();
  const grid = document.getElementById('presaves-grid');
  const loading = document.getElementById('presaves-loading');
  const errorState = document.getElementById('presaves-error');
  const emptyState = document.getElementById('presaves-empty');
  if (!grid) return;
  if (!siteSettings.show_presaves) {
    loading.hidden = true;
    emptyState.hidden = false;
    return;
  }
  if (!isSupabaseConfigured || !supabase) {
    loading.hidden = true;
    errorState.hidden = false;
    return;
  }
  let query = supabase.from('presave_campaigns').select('*')
    .eq('published', true).is('deleted_at', null)
    .order('featured', { ascending: false })
    .order('release_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (Number(siteSettings.presaves_limit) > 0) query = query.limit(Number(siteSettings.presaves_limit));
  const { data, error } = await query;
  loading.hidden = true;
  if (error) {
    console.error('Erro ao carregar pré-saves:', error);
    errorState.hidden = false;
    return;
  }
  if (!data?.length) {
    emptyState.hidden = false;
    return;
  }
  const ordered = [...data].sort((a, b) => {
    const aReleased = presaveIsReleased(a);
    const bReleased = presaveIsReleased(b);
    if (aReleased !== bReleased) return aReleased ? 1 : -1;
    return String(a.release_date).localeCompare(String(b.release_date));
  });
  grid.innerHTML = ordered.map(presaveCard).join('');
  observeReveals(grid);
}

let presaveCountdownInterval = null;
function updatePresaveCountdown(campaign) {
  const countdown = document.getElementById('presave-countdown');
  const release = presaveReleaseDate(campaign);
  if (!countdown || !release) return;
  const difference = Math.max(0, release.getTime() - Date.now());
  const days = Math.floor(difference / 86400000);
  const hours = Math.floor((difference % 86400000) / 3600000);
  const minutes = Math.floor((difference % 3600000) / 60000);
  const seconds = Math.floor((difference % 60000) / 1000);
  countdown.querySelector('[data-countdown-days]').textContent = String(days).padStart(2, '0');
  countdown.querySelector('[data-countdown-hours]').textContent = String(hours).padStart(2, '0');
  countdown.querySelector('[data-countdown-minutes]').textContent = String(minutes).padStart(2, '0');
  countdown.querySelector('[data-countdown-seconds]').textContent = String(seconds).padStart(2, '0');
  countdown.classList.toggle('released', difference === 0);
  if (difference === 0) {
    countdown.innerHTML = '<strong>JÁ DISPONÍVEL</strong>';
    const action = presavePrimaryAction(campaign);
    const button = document.getElementById('presave-primary-action');
    if (button) { button.href = action.url || '#'; button.textContent = action.label; }
    window.clearInterval(presaveCountdownInterval);
  }
}

async function loadPresaveDetail() {
  await loadSiteSettings();
  await ensureSupabase();
  const loading = document.getElementById('presave-detail-loading');
  const errorState = document.getElementById('presave-detail-error');
  const detail = document.getElementById('presave-detail');
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug || !isSupabaseConfigured || !supabase) {
    loading.hidden = true;
    errorState.hidden = false;
    return;
  }
  const { data: campaign, error } = await supabase.from('presave_campaigns').select('*')
    .eq('slug', slug).eq('published', true).is('deleted_at', null).maybeSingle();
  loading.hidden = true;
  if (error || !campaign) {
    if (error) console.error(error);
    errorState.hidden = false;
    return;
  }
  const cover = mediaUrl(campaign.cover_path);
  document.title = `${campaign.artist_name} — ${campaign.title} | ${siteSettings.site_name}`;
  document.getElementById('presave-detail-cover').innerHTML = cover
    ? `<img src="${escapeHtml(cover)}" alt="Capa de ${escapeHtml(campaign.title)}">`
    : `<div class="presave-detail-placeholder"><img src="docs/apollus-logo-transparent.png" alt=""></div>`;
  setSiteText('presave-detail-artist', campaign.artist_name);
  setSiteText('presave-detail-title', campaign.title);
  setSiteText('presave-detail-description', campaign.description || 'Participe deste lançamento e acompanhe o trabalho do artista.');
  const release = presaveReleaseDate(campaign);
  setSiteText('presave-release-date', release ? `Lançamento: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: campaign.release_time ? 'short' : undefined }).format(release)}` : 'Data de lançamento em breve');
  const action = presavePrimaryAction(campaign);
  const primary = document.getElementById('presave-primary-action');
  primary.href = action.url || '#';
  primary.textContent = action.label;
  primary.hidden = !action.url;
  const shareButton = document.getElementById('presave-share-button');
  shareButton.addEventListener('click', async () => {
    const shareData = { title: `${campaign.artist_name} — ${campaign.title}`, text: `Faça o pré-save de ${campaign.title}, lançamento de ${campaign.artist_name}.`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); shareButton.textContent = 'Link copiado!'; setTimeout(() => { shareButton.textContent = 'Compartilhar'; }, 1800); }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') console.warn(shareError);
    }
  });
  detail.hidden = false;
  updatePresaveCountdown(campaign);
  presaveCountdownInterval = window.setInterval(() => updatePresaveCountdown(campaign), 1000);
  observeReveals(detail);
}

loadSiteSettings();

if (page === 'projects') {
  loadProjectsPage();
  loadStreamingPlaylists();
  loadAgenda();
}

if (page === 'project-detail') {
  loadProjectDetail();
}

if (page === 'presaves') {
  loadPresavesPage();
}

if (page === 'presave-detail') {
  loadPresaveDetail();
}
