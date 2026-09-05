// ==========================================================================
// BingeFlix - Main Application Logic with Live Firebase & Watch History
// ==========================================================================

import { 
  initFirebase, 
  isFirebaseReady, 
  loginWithEmailOrUsername, 
  logoutFirebase, 
  syncWatchlistToCloud, 
  recordMovieWatchToCloud,
  fetchUserDataFromCloud,
  clearWatchHistoryInCloud,
  deleteMovieFromWatchHistoryInCloud,
  updateUserCustomUsername,
  onAuthStateListener,
  createPaidSubscriber,
  fetchAllSubscribers,
  updatePaidSubscriber,
  deletePaidSubscriber,
  verifySubscriberLogin
} from './firebase.js';

import { initNativePlayer, switchNativeAudioTrack, destroyNativePlayer } from './nativePlayer.js';
import { resolveDirectStream } from './streamResolver.js';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'df1c541385e699bbed7ffd32934162da';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p';

// Anime Avatars Map (Real Anime Icons & Stylized Avatars)
export const ANIME_AVATARS = {
  goku: '/avatars/goku.jpg',
  naruto: '/avatars/naruto.jpg',
  luffy: '/avatars/luffy.jpg',
  doraemon: '/avatars/doraemon.png',
  zoro: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ZoroOnePiece&backgroundColor=2e7d32',
  gojo: 'https://api.dicebear.com/7.x/adventurer/svg?seed=GojoSatoru&backgroundColor=0288d1',
  tanjiro: 'https://api.dicebear.com/7.x/adventurer/svg?seed=TanjiroDemonSlayer&backgroundColor=00695c',
  sukuna: 'https://api.dicebear.com/7.x/adventurer/svg?seed=RyomenSukuna&backgroundColor=880e4f',
  shinchan: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ShinchanCrayon&backgroundColor=f44336'
};

export function getAvatarUrl(key) {
  if (ANIME_AVATARS[key]) return ANIME_AVATARS[key];
  if (key && (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/'))) return key;
  return ANIME_AVATARS['goku'];
}

let torrentStatusTimer = null;

// App State
const state = {
  trending: [],
  popular: [],
  topRated: [],
  upcoming: [],
  action: [],
  bollywood: [],
  hollywood: [],
  south: [],
  series: [],
  anime: [],
  cartoons: [],
  genres: {},
  heroIndex: 0,
  heroTimer: null,
  watchlist: JSON.parse(localStorage.getItem('bingeflix_watchlist') || '[]'),
  watchHistory: JSON.parse(localStorage.getItem('bingeflix_watch_history') || '[]'),
  currentUser: JSON.parse(localStorage.getItem('bingeflix_user') || 'null'),
  currentMovie: null,
  currentSeason: 1,
  currentEpisode: 1,
  activeSourceType: 'movies',
  currentStreamUrl: '',
  activeLibraryTab: 'watchlist', // 'watchlist' | 'history'
  subscribers: [],
  adminAuthenticated: false,
};

// ==========================================================================
// API Fetch Helper
// ==========================================================================
async function fetchTMDB(endpoint, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', TMDB_API_KEY);
  url.searchParams.append('language', 'en-US');
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${endpoint}:`, err);
    return null;
  }
}

// ==========================================================================
// Authentic IMDb Rating Fetcher (OMDB API integration with Title fallback)
// ==========================================================================
async function fetchRealIMDbRating(imdbId, title = '', year = '', isTv = false) {
  const apikeys = ['b9a5e69d', 'fa82449', 'e4f4b238'];
  for (const k of apikeys) {
    try {
      let queryUrl = '';
      if (imdbId) {
        queryUrl = `https://www.omdbapi.com/?i=${imdbId}&apikey=${k}`;
      } else if (title) {
        const cleanTitle = title.replace(/[^\w\s]/gi, '').trim();
        queryUrl = `https://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}${year ? `&y=${year}` : ''}${isTv ? '&type=series' : ''}&apikey=${k}`;
      } else {
        return null;
      }

      const res = await fetch(queryUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
          return {
            rating: data.imdbRating,
            votes: data.imdbVotes || '',
            rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : '',
            imdbId: data.imdbID || imdbId
          };
        }
      }
    } catch (e) {
      // Ignore network timeout and try next key
    }
  }
  return null;
}

// ==========================================================================
// App Initialization & URL Hash Routing
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupNavbar();
  setupEventListeners();
  setupAudioGuideModal();
  updateWatchlistBadge();
  updateUserUI();
  renderHistoryRow();

  // Mandatory Login Gate Check (User must sign in to browse/stream)
  if (!state.currentUser) {
    const authModal = document.getElementById('auth-modal');
    const authClose = document.getElementById('auth-close');
    if (authModal) authModal.style.display = 'flex';
    if (authClose) authClose.style.display = 'none';
  }

  // Immediately check initial hash route on load / refresh (F5 persistence)
  if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#home') {
    handleHashRouting();
  }

  // 1. Immediately fetch TMDB movie catalog & genres without waiting for Firestore
  loadGenres();
  loadAllSections().then(() => {
    // If not already routed to a watch view, re-evaluate hash (e.g. for scrolling to categories)
    if (window.location.hash && !window.location.hash.startsWith('#watch/')) {
      handleHashRouting();
    }
  });

  // Listen for browser Back/Forward navigation
  window.addEventListener('hashchange', handleHashRouting);

  // 2. Non-blocking Background sync from Cloud Firestore if user is authenticated
  if (state.currentUser && state.currentUser.uid && isFirebaseReady()) {
    fetchUserDataFromCloud(state.currentUser.uid)
      .then(cloudData => {
        if (cloudData) {
          if (Array.isArray(cloudData.watchlist)) state.watchlist = cloudData.watchlist;
          if (Array.isArray(cloudData.watchHistory)) state.watchHistory = cloudData.watchHistory;
          localStorage.setItem('bingeflix_watchlist', JSON.stringify(state.watchlist));
          localStorage.setItem('bingeflix_watch_history', JSON.stringify(state.watchHistory));
          updateWatchlistBadge();
          renderHistoryRow();
        }
      })
      .catch(e => console.warn('Background cloud sync notice:', e));
  }
});

// Handle URL Hash Routing for F5 Refresh Persistence and Deep-Linking
function handleHashRouting() {
  const hash = window.location.hash || '';
  if (!hash || hash === '#' || hash === '#home') {
    switchView('home', false);
    return;
  }

  if (hash.startsWith('#watch/')) {
    // Format: #watch/{movie|tv}/{id}?s={season}&e={episode}
    const clean = hash.replace('#watch/', '');
    const [pathPart, queryPart] = clean.split('?');
    const [type, idStr] = (pathPart || '').split('/');
    const id = parseInt(idStr, 10);
    const isTv = type === 'tv';

    let season = 1;
    let episode = 1;
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      season = parseInt(params.get('s'), 10) || 1;
      episode = parseInt(params.get('e'), 10) || 1;
    }

    if (id) {
      openPlayerView(id, isTv, season, episode, false);
      return;
    }
  }

  const category = hash.replace('#', '');
  const validCategories = ['bollywood', 'hollywood', 'anime', 'cartoons', 'series', 'south', 'trending', 'top_rated', 'watchlist'];
  if (validCategories.includes(category)) {
    switchView(category, false);
  }
}


// ==========================================================================
// Navbar & Navigation
// ==========================================================================
function setupNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Nav Items Filter
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cat = e.currentTarget.dataset.category;
      switchView(cat);
    });
  });

  document.getElementById('logo-btn').addEventListener('click', (e) => {
    e.preventDefault();
    switchView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('back-to-browse').addEventListener('click', () => {
    stopVideoPlayback();
    switchView('home');
  });

  // Mobile Hamburger Drawer
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const drawerBackdrop = document.getElementById('mobile-drawer-backdrop');
  const drawer = document.getElementById('mobile-drawer');
  const drawerClose = document.getElementById('drawer-close');

  function openDrawer() {
    if (!drawerBackdrop || !drawer) return;
    drawerBackdrop.style.display = 'block';
    setTimeout(() => drawer.classList.add('open'), 10);
  }

  function closeDrawer() {
    if (!drawerBackdrop || !drawer) return;
    drawer.classList.remove('open');
    setTimeout(() => {
      drawerBackdrop.style.display = 'none';
    }, 300);
  }

  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) closeDrawer();
    });
  }

  // Drawer Link Items
  document.querySelectorAll('.drawer-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cat = e.currentTarget.dataset.category;
      closeDrawer();
      switchView(cat);
    });
  });
}

function switchView(viewName, updateHash = true) {
  const browseView = document.getElementById('browse-view');
  const playerView = document.getElementById('player-view');
  const watchlistView = document.getElementById('watchlist-view');

  // Update active navbar & drawer buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === viewName);
  });
  document.querySelectorAll('.drawer-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === viewName);
  });

  if (updateHash) {
    if (viewName === 'home') {
      if (window.location.hash) {
        history.pushState(null, '', window.location.pathname);
      }
    } else if (viewName !== 'player') {
      window.location.hash = `#${viewName}`;
    }
  }

  if (viewName === 'player') {
    browseView.style.display = 'none';
    watchlistView.style.display = 'none';
    playerView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (viewName === 'watchlist') {
    stopVideoPlayback();
    browseView.style.display = 'none';
    playerView.style.display = 'none';
    watchlistView.style.display = 'block';
    renderLibraryView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Browse / Home
    stopVideoPlayback();
    playerView.style.display = 'none';
    watchlistView.style.display = 'none';
    browseView.style.display = 'block';
    renderHistoryRow();

    if (viewName === 'bollywood') {
      const el = document.getElementById('section-bollywood');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (viewName === 'hollywood') {
      const el = document.getElementById('section-hollywood');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (viewName === 'anime') {
      const el = document.getElementById('section-anime');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (viewName === 'cartoons') {
      const el = document.getElementById('section-cartoons');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (viewName === 'series') {
      const el = document.getElementById('section-series');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (viewName === 'trending') {
      document.getElementById('section-trending').scrollIntoView({ behavior: 'smooth' });
    } else if (viewName === 'top_rated') {
      document.getElementById('section-top-rated').scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

// ==========================================================================
// Data Fetching
// ==========================================================================
async function loadGenres() {
  const data = await fetchTMDB('/genre/movie/list');
  if (data && data.genres) {
    data.genres.forEach(g => {
      state.genres[g.id] = g.name;
    });
  }
}

async function loadAllSections() {
  const [
    trendingData, 
    popularData, 
    topRatedData, 
    actionData, 
    bollywoodData, 
    hollywoodData,
    southData, 
    seriesData, 
    animeData,
    cartoonsData
  ] = await Promise.all([
    fetchTMDB('/trending/movie/day'),
    fetchTMDB('/movie/popular'),
    fetchTMDB('/movie/top_rated'),
    fetchTMDB('/discover/movie', { with_genres: '28', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/movie', { with_original_language: 'hi', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/movie', { with_original_language: 'en', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/movie', { with_original_language: 'te|ta|ml|kn', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/tv', { with_original_language: 'hi', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/tv', { with_genres: '16,10762', sort_by: 'popularity.desc' }),
  ]);

  if (bollywoodData && bollywoodData.results) {
    state.bollywood = bollywoodData.results;
    renderMovieTrack('bollywood-row', state.bollywood);
  }

  if (hollywoodData && hollywoodData.results) {
    let hwList = [...hollywoodData.results];
    try {
      // Ensure Spider-Man: No Way Home is at the front of Hollywood for instant access
      if (!hwList.some(m => m.id === 634649)) {
        const spidey = await fetchTMDB('/movie/634649');
        if (spidey) hwList.unshift(spidey);
      }
    } catch (e) {}
    state.hollywood = hwList;
    renderMovieTrack('hollywood-row', state.hollywood);
  }

  if (animeData && animeData.results) {
    state.anime = animeData.results.map(item => ({ ...item, isTv: true, isAnime: true }));
    renderMovieTrack('anime-row', state.anime);
  }

  if (cartoonsData && cartoonsData.results) {
    const validCartoons = cartoonsData.results.filter(c => c.id !== 65733 && c.id !== 57911);
    try {
      // Feature Stand by Me Doraemon (265712) as top playable cartoon
      const doraemonMovie = await fetchTMDB('/movie/265712');
      if (doraemonMovie) {
        validCartoons.unshift({ ...doraemonMovie, isTv: false, isCartoon: true });
      }
    } catch (e) {}
    state.cartoons = validCartoons.map(item => ({ ...item, isTv: item.isTv !== undefined ? item.isTv : true, isCartoon: true }));
    renderMovieTrack('cartoons-row', state.cartoons);
  }

  if (southData && southData.results) {
    state.south = southData.results;
    renderMovieTrack('south-row', state.south);
  }

  if (seriesData && seriesData.results) {
    state.series = seriesData.results.map(item => ({ ...item, isTv: true }));
    renderMovieTrack('series-row', state.series);
  }

  if (trendingData && trendingData.results) {
    state.trending = trendingData.results;
    renderMovieTrack('trending-row', state.trending);
    initHeroSpotlight();
  }

  if (popularData && popularData.results) {
    state.popular = popularData.results;
    renderMovieTrack('popular-row', state.popular);
  }

  if (topRatedData && topRatedData.results) {
    state.topRated = topRatedData.results;
    renderMovieTrack('top-rated-row', state.topRated);
  }

  if (actionData && actionData.results) {
    state.action = actionData.results;
    renderMovieTrack('action-row', state.action);
  }
}

// ==========================================================================
// Hero Spotlight (Scrollable)
// ==========================================================================
function initHeroSpotlight() {
  if (!state.trending.length) return;

  const indicators = document.getElementById('hero-indicators');
  indicators.innerHTML = '';
  const maxSlides = Math.min(5, state.trending.length);

  for (let i = 0; i < maxSlides; i++) {
    const dot = document.createElement('div');
    dot.className = `indicator-dot ${i === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => {
      setHeroSlide(i);
      resetHeroTimer();
    });
    indicators.appendChild(dot);
  }

  setHeroSlide(0);
  startHeroTimer();

  document.getElementById('hero-prev').onclick = () => {
    let nextIdx = state.heroIndex - 1;
    if (nextIdx < 0) nextIdx = maxSlides - 1;
    setHeroSlide(nextIdx);
    resetHeroTimer();
  };

  document.getElementById('hero-next').onclick = () => {
    let nextIdx = (state.heroIndex + 1) % maxSlides;
    setHeroSlide(nextIdx);
    resetHeroTimer();
  };
}

function setHeroSlide(index) {
  state.heroIndex = index;
  const movie = state.trending[index];
  if (!movie) return;

  const heroBackdrop = document.getElementById('hero-backdrop');
  const backdropUrl = movie.backdrop_path 
    ? `${IMG_BASE_URL}/original${movie.backdrop_path}`
    : `${IMG_BASE_URL}/original${movie.poster_path}`;

  heroBackdrop.style.backgroundImage = `url('${backdropUrl}')`;
  document.getElementById('hero-title').textContent = movie.title || movie.name;
  document.getElementById('hero-overview').textContent = movie.overview || 'No overview available.';
  document.getElementById('hero-rating').textContent = `★ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}`;
  document.getElementById('hero-year').textContent = (movie.release_date || '').split('-')[0] || '2026';

  const genreNames = (movie.genre_ids || [])
    .map(id => state.genres[id])
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
  document.getElementById('hero-genre').textContent = genreNames || 'Featured Cinema';

  // Watchlist Button
  const watchlistBtn = document.getElementById('hero-watchlist-btn');
  const inWatchlist = isMovieInWatchlist(movie.id);
  updateHeroWatchlistBtn(watchlistBtn, inWatchlist);

  watchlistBtn.onclick = () => {
    toggleWatchlist(movie);
    updateHeroWatchlistBtn(watchlistBtn, isMovieInWatchlist(movie.id));
  };

  document.getElementById('hero-play-btn').onclick = () => {
    openPlayerView(movie.id, Boolean(movie.isTv || movie.first_air_date));
  };

  // Indicators
  const dots = document.querySelectorAll('.indicator-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === index);
  });
}

function updateHeroWatchlistBtn(btn, inList) {
  if (inList) {
    btn.classList.add('in-watchlist');
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      In Watchlist
    `;
  } else {
    btn.classList.remove('in-watchlist');
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      + Watchlist
    `;
  }
}

function startHeroTimer() {
  state.heroTimer = setInterval(() => {
    const maxSlides = Math.min(5, state.trending.length);
    const nextIdx = (state.heroIndex + 1) % maxSlides;
    setHeroSlide(nextIdx);
  }, 7000);
}

function resetHeroTimer() {
  clearInterval(state.heroTimer);
  startHeroTimer();
}

// ==========================================================================
// Movie Cards & Horizontal Tracks
// ==========================================================================
function renderMovieTrack(containerId, movies) {
  const track = document.getElementById(containerId);
  if (!track) return;
  track.innerHTML = '';

  movies.forEach(movie => {
    if (!movie.poster_path) return;
    const card = createMovieCard(movie);
    track.appendChild(card);
  });
}function createMovieCard(movie, isHistory = false) {
  const card = document.createElement('div');
  card.className = 'movie-card';

  const posterUrl = movie.poster_path 
    ? `${IMG_BASE_URL}/w500${movie.poster_path}`
    : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80';
  const year = ((movie.release_date || movie.first_air_date || '')).split('-')[0] || '';
  const title = movie.title || movie.name || 'Untitled';
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'NR';
  const inWatchlist = isMovieInWatchlist(movie.id);
  const isTv = movie.isTv || !!movie.first_air_date;

  card.innerHTML = `
    <div class="card-poster-wrapper">
      ${isHistory ? `<button class="card-btn-delete-history" title="Delete from History" data-movie-id="${movie.id}">✕</button>` : ''}
      <img class="card-poster" src="${posterUrl}" alt="${title}" loading="lazy" />
      <span class="card-rating-tag">★ ${rating}</span>
      <div class="card-overlay">
        <div class="card-actions">
          <button class="card-btn card-btn-play" title="Play ${isTv ? 'Series' : 'Movie'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          </button>
          <button class="card-btn card-btn-watchlist ${inWatchlist ? 'active' : ''}" title="${inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}">
            ${inWatchlist ? '✓' : '+'}
          </button>
        </div>
        <div class="card-title">${title}</div>
        <div class="card-year">${isTv ? '📺 Series • ' : ''}${year}</div>
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-btn-delete-history')) {
      e.stopPropagation();
      deleteMovieFromHistory(movie.id);
      return;
    }

    if (e.target.closest('.card-btn-watchlist')) {
      e.stopPropagation();
      toggleWatchlist(movie);
      const btn = card.querySelector('.card-btn-watchlist');
      const nowInList = isMovieInWatchlist(movie.id);
      btn.textContent = nowInList ? '✓' : '+';
      btn.classList.toggle('active', nowInList);
      return;
    }

    openPlayerView(movie.id, isTv);
  });

  return card;
}

function deleteMovieFromHistory(movieId) {
  state.watchHistory = state.watchHistory.filter(m => m.id !== movieId);
  localStorage.setItem('bingeflix_watch_history', JSON.stringify(state.watchHistory));
  if (state.currentUser && state.currentUser.uid && isFirebaseReady()) {
    deleteMovieFromWatchHistoryInCloud(state.currentUser.uid, movieId);
  }
  updateWatchlistBadge();
  if (document.getElementById('watchlist-view').style.display === 'block') {
    renderLibraryView();
  }
  showToast('Removed title from Watch History');
}

// Track Scroll Arrows
document.querySelectorAll('.scroll-arrow').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const track = document.getElementById(targetId);
    if (!track) return;
    const scrollAmount = track.clientWidth * 0.75;
    if (btn.classList.contains('scroll-left')) {
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  });
});

// ==========================================================================
// Genre Filter Pills (All, Bollywood, Hindi Series & Genres)
// ==========================================================================
document.querySelectorAll('.genre-pill').forEach(pill => {
  pill.addEventListener('click', async (e) => {
    document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    const filter = pill.dataset.filter;
    const genreId = pill.dataset.genreId;

    if (filter === 'all') {
      loadAllSections();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (filter === 'bollywood') {
      const sec = document.getElementById('section-bollywood');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      showToast('🔥 Showing Trending Bollywood & Hindi Cinema');
    } else if (filter === 'south') {
      const sec = document.getElementById('section-south');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      showToast('⚔️ Showing South Indian Blockbusters');
    } else if (filter === 'series') {
      const sec = document.getElementById('section-series');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      showToast('📺 Showing Popular Hindi Web Series');
    } else if (filter === 'anime') {
      const sec = document.getElementById('section-anime');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      showToast('⚡ Showing Top Trending Anime & Series');
    } else if (genreId) {
      const data = await fetchTMDB('/discover/movie', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
      });
      if (data && data.results) {
        renderMovieTrack('popular-row', data.results);
        document.getElementById('section-popular').scrollIntoView({ behavior: 'smooth' });
        showToast(`Filtered movies by ${pill.textContent}`);
      }
    }
  });
});

// ==========================================================================
// Real-Time Search with Debounce
// ==========================================================================
const searchInput = document.getElementById('search-input');
const searchDropdown = document.getElementById('search-dropdown');
const searchClear = document.getElementById('search-clear');
let searchDebounceTimer;

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  searchClear.style.display = query ? 'block' : 'none';

  clearTimeout(searchDebounceTimer);
  if (!query) {
    searchDropdown.style.display = 'none';
    return;
  }

  searchDebounceTimer = setTimeout(async () => {
    let q = query;
    const qLower = q.toLowerCase();
    if (qLower.includes('doremon')) q = q.replace(/doremon/gi, 'doraemon');
    else if (qLower === 'spiderman') q = 'spider-man';
    else if (qLower === 'shinchan') q = 'shin chan';

    const [movieData, tvData] = await Promise.all([
      fetchTMDB('/search/movie', { query: q }),
      fetchTMDB('/search/tv', { query: q })
    ]);
    
    const combined = [
      ...((movieData && movieData.results) || []),
      ...((tvData && tvData.results) || []).map(t => ({ ...t, isTv: true }))
    ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    if (combined.length > 0) {
      renderSearchDropdown(combined.slice(0, 8));
    } else {
      searchDropdown.innerHTML = '<div style="padding: 1.2rem; text-align: center; color: var(--text-muted);">No movies or series found</div>';
      searchDropdown.style.display = 'block';
    }
  }, 260);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  searchDropdown.style.display = 'none';
});

function renderSearchDropdown(results) {
  searchDropdown.innerHTML = '';
  results.forEach(item => {
    const div = document.createElement('div');
    div.className = 'search-result-item';

    const posterSrc = item.poster_path
      ? `${IMG_BASE_URL}/w200${item.poster_path}`
      : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=100&q=80';
    const year = (item.release_date || item.first_air_date || '').split('-')[0] || '';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
    const title = item.title || item.name || 'Untitled';
    const typeLabel = item.isTv ? '📺 Series' : '🎬 Movie';

    div.innerHTML = `
      <img class="search-thumb" src="${posterSrc}" alt="${title}" />
      <div class="search-info">
        <h4>${title}</h4>
        <div class="search-meta">
          <span>${typeLabel}</span>
          <span>•</span>
          <span>★ ${rating}</span>
          <span>•</span>
          <span>${year}</span>
        </div>
      </div>
    `;

    div.addEventListener('click', () => {
      searchDropdown.style.display = 'none';
      searchInput.value = '';
      searchClear.style.display = 'none';
      openPlayerView(item.id, item.isTv);
    });

    searchDropdown.appendChild(div);
  });
  searchDropdown.style.display = 'block';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box-wrapper')) {
    searchDropdown.style.display = 'none';
  }
});

// ==========================================================================
// Dedicated Player & Watch View
// ==========================================================================
async function openPlayerView(id, isTv = false, targetSeason = 1, targetEpisode = 1, updateHash = true) {
  if (!state.currentUser) {
    const authModal = document.getElementById('auth-modal');
    const authClose = document.getElementById('auth-close');
    if (authModal) authModal.style.display = 'flex';
    if (authClose) authClose.style.display = 'none';
    showToast('🔒 Please sign in to stream movies & shows');
    return;
  }

  const endpoint = isTv ? `/tv/${id}` : `/movie/${id}`;
  let details = await fetchTMDB(endpoint, {
    append_to_response: 'videos,credits,similar,external_ids,translations',
  });

  if (!details && !isTv) {
    // Fallback try tv
    details = await fetchTMDB(`/tv/${id}`, {
      append_to_response: 'videos,credits,similar,external_ids,translations',
    });
    if (details) details.isTv = true;
  }

  if (!details) {
    showToast('Unable to load movie or series data');
    return;
  }

  if (isTv) details.isTv = true;
  state.currentMovie = details;
  state.activeSourceType = 'vidlink';

  if (updateHash) {
    const hashStr = `watch/${isTv ? 'tv' : 'movie'}/${id}${isTv ? `?s=${targetSeason || 1}&e=${targetEpisode || 1}` : ''}`;
    window.location.hash = hashStr;
  }

  const title = details.title || details.name || 'Untitled';
  const year = (details.release_date || details.first_air_date || '').split('-')[0] || '2026';

  // Fill Details
  document.getElementById('player-movie-title').textContent = title;
  document.getElementById('player-tagline').textContent = details.tagline ? `"${details.tagline}"` : '';
  document.getElementById('player-overview').textContent = details.overview || 'No overview storyline available.';
  document.getElementById('player-rating').textContent = `★ ${details.vote_average ? details.vote_average.toFixed(1) : 'NR'}`;
  document.getElementById('player-year').textContent = year;
  document.getElementById('player-lang').textContent = (details.original_language || 'EN').toUpperCase();
  document.getElementById('player-status').textContent = details.status || (isTv ? 'TV Series' : 'Released');

  const runtime = details.runtime || (details.episode_run_time && details.episode_run_time[0]) || 45;
  const runtimeH = Math.floor(runtime / 60);
  const runtimeM = runtime % 60;
  document.getElementById('player-runtime').textContent = runtimeH > 0 ? `${runtimeH}h ${runtimeM}m` : `${runtimeM}m`;

  // Genres
  const genresBox = document.getElementById('player-genres');
  genresBox.innerHTML = '';
  (details.genres || []).forEach(g => {
    const span = document.createElement('span');
    span.className = 'genre-tag';
    span.textContent = g.name;
    genresBox.appendChild(span);
  });

  // Watchlist Button
  const watchlistBtn = document.getElementById('player-watchlist-btn');
  updatePlayerWatchlistBtn(watchlistBtn, isMovieInWatchlist(details.id));
  watchlistBtn.onclick = () => {
    toggleWatchlist(details);
    updatePlayerWatchlistBtn(watchlistBtn, isMovieInWatchlist(details.id));
  };

  // Fetch Real IMDb Rating from OMDB (using IMDb ID or title+year fallback)
  const imdbId = (details.external_ids && details.external_ids.imdb_id) || details.imdb_id;
  const tmdbScore = details.vote_average ? details.vote_average.toFixed(1) : 'NR';
  const tmdbVoteCount = details.vote_count ? details.vote_count.toLocaleString() : '0';
  const ratingEl = document.getElementById('player-rating');
  
  ratingEl.innerHTML = `<span class="imdb-logo-badge">IMDb</span> <span class="imdb-bold-score">★ ${tmdbScore}</span> <span class="imdb-count">(${tmdbVoteCount} votes)</span>`;

  fetchRealIMDbRating(imdbId, title, year, isTv).then(omdb => {
    if (omdb && omdb.rating) {
      ratingEl.innerHTML = `<span class="imdb-logo-badge">IMDb</span> <span class="imdb-bold-score">★ ${omdb.rating}</span> <span class="imdb-count">(${omdb.votes || 'Rated'} votes)</span>`;
      if (omdb.rated && omdb.rated !== 'N/A') {
        const statusEl = document.getElementById('player-status');
        if (statusEl) statusEl.textContent = `${omdb.rated} • ${isTv ? 'Series' : 'Movie'}`;
      }
    }
  });

  // Web Series & Anime Season Breakdown & Episode Controls
  const seriesControls = document.getElementById('player-series-controls');
  const seasonSelect = document.getElementById('season-select');
  const episodesTrack = document.getElementById('episodes-track');
  const episodeBadge = document.getElementById('now-playing-episode-badge');
  const seasonMetaBadge = document.getElementById('season-meta-badge');
  const seasonDesc = document.getElementById('season-breakdown-desc');
  const rangeTabsContainer = document.getElementById('episode-range-tabs');
  const btnListView = document.getElementById('btn-ep-list-view');
  const btnGridView = document.getElementById('btn-ep-grid-view');

  let currentViewMode = 'list'; // 'list' | 'grid'
  let activeRangeIndex = 0;
  let currentSeasonEpisodes = [];

  if (btnListView && btnGridView) {
    btnListView.onclick = () => {
      currentViewMode = 'list';
      btnListView.classList.add('active');
      btnGridView.classList.remove('active');
      episodesTrack.className = 'episodes-cards-track mode-list';
      renderCurrentEpisodesOrientation();
    };

    btnGridView.onclick = () => {
      currentViewMode = 'grid';
      btnGridView.classList.add('active');
      btnListView.classList.remove('active');
      episodesTrack.className = 'episodes-cards-track mode-grid';
      renderCurrentEpisodesOrientation();
    };
  }

  function renderCurrentEpisodesOrientation() {
    episodesTrack.innerHTML = '';
    if (!currentSeasonEpisodes || currentSeasonEpisodes.length === 0) {
      episodesTrack.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No episodes found for this season.</div>';
      return;
    }

    // Determine slice if range tabs are active
    let displayList = currentSeasonEpisodes;
    if (currentSeasonEpisodes.length > 20 && activeRangeIndex > 0) {
      const batchSize = 25;
      const start = (activeRangeIndex - 1) * batchSize;
      const end = start + batchSize;
      displayList = currentSeasonEpisodes.slice(start, end);
    }

    displayList.forEach(ep => {
      const isCurrent = ep.episode_number === state.currentEpisode;
      const thumb = ep.still_path 
        ? `${IMG_BASE_URL}/w300${ep.still_path}`
        : (details.backdrop_path ? `${IMG_BASE_URL}/w300${details.backdrop_path}` : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=300&q=80');

      if (currentViewMode === 'list') {
        // Detailed Netflix-Style List Orientation
        const card = document.createElement('div');
        card.className = `episode-card-list ${isCurrent ? 'active' : ''}`;
        card.innerHTML = `
          <div class="ep-left-thumb">
            <img src="${thumb}" alt="${ep.name}" loading="lazy" />
            <span class="ep-num-pill">EP ${ep.episode_number}</span>
            <div class="ep-play-overlay">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
            </div>
          </div>
          <div class="ep-right-content">
            <div class="ep-title-row">
              <span class="ep-number">${ep.episode_number}.</span>
              <h4 class="ep-name">${ep.name}</h4>
              ${isCurrent ? '<span class="ep-playing-tag">▶ PLAYING</span>' : ''}
              <span class="ep-runtime-tag">${ep.runtime ? `${ep.runtime}m` : 'HD'}</span>
            </div>
            <div class="ep-meta-row">
              ${ep.air_date ? `<span>Aired: ${ep.air_date}</span>` : ''}
              <span>•</span>
              <span>★ ${ep.vote_average ? ep.vote_average.toFixed(1) : 'NR'}</span>
            </div>
            <p class="ep-overview-text">${ep.overview || 'Stream this episode in full HD with multi-audio and subtitles.'}</p>
          </div>
        `;

        card.addEventListener('click', () => {
          document.querySelectorAll('.episode-card-list, .episode-card-grid').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.currentEpisode = ep.episode_number;
          episodeBadge.textContent = `S${state.currentSeason} : E${ep.episode_number}`;
          window.location.hash = `watch/tv/${details.id}?s=${state.currentSeason}&e=${ep.episode_number}`;
          mountVideoPlayer(details, state.activeSourceType, state.currentSeason, ep.episode_number);
          showToast(`Playing S${state.currentSeason} : E${ep.episode_number} - ${ep.name}`);
        });

        episodesTrack.appendChild(card);
      } else {
        // Card Grid Orientation
        const card = document.createElement('div');
        card.className = `episode-card-grid ${isCurrent ? 'active' : ''}`;
        card.innerHTML = `
          <div class="ep-thumb-wrapper">
            <img src="${thumb}" alt="${ep.name}" loading="lazy" />
            <span class="ep-num-pill">EP ${ep.episode_number}</span>
            <span class="ep-runtime-pill">${ep.runtime ? `${ep.runtime}m` : 'HD'}</span>
          </div>
          <div class="ep-grid-info">
            <div class="ep-grid-title">${ep.episode_number}. ${ep.name}</div>
            <div class="ep-grid-sub">${ep.air_date ? ep.air_date.split('-')[0] : ''} • ★ ${ep.vote_average ? ep.vote_average.toFixed(1) : 'NR'}</div>
          </div>
        `;

        card.addEventListener('click', () => {
          document.querySelectorAll('.episode-card-list, .episode-card-grid').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.currentEpisode = ep.episode_number;
          episodeBadge.textContent = `S${state.currentSeason} : E${ep.episode_number}`;
          window.location.hash = `watch/tv/${details.id}?s=${state.currentSeason}&e=${ep.episode_number}`;
          mountVideoPlayer(details, state.activeSourceType, state.currentSeason, ep.episode_number);
          showToast(`Playing S${state.currentSeason} : E${ep.episode_number} - ${ep.name}`);
        });

        episodesTrack.appendChild(card);
      }
    });
  }

  if (isTv && details.seasons && details.seasons.length > 0) {
    seriesControls.style.display = 'block';
    seasonSelect.innerHTML = '';

    const validSeasons = details.seasons.filter(s => s.season_number > 0);
    const seasonsList = validSeasons.length > 0 ? validSeasons : details.seasons;

    seasonsList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.season_number;
      opt.textContent = `${s.name || `Season ${s.season_number}`} (${s.episode_count || '?'} Eps)`;
      seasonSelect.appendChild(opt);
    });

    state.currentSeason = targetSeason || seasonsList[0].season_number;
    state.currentEpisode = targetEpisode || 1;
    seasonSelect.value = state.currentSeason;
    episodeBadge.textContent = `S${state.currentSeason} : E${state.currentEpisode}`;

    async function loadSeasonEpisodes(seasonNum) {
      episodesTrack.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">Loading season episodes...</div>';
      let sData = await fetchTMDB(`/tv/${id}/season/${seasonNum}`);

      // Fallback if seasonNum failed (e.g. Shin-chan / Doraemon season numbering quirks)
      if (!sData && details.seasons && details.seasons.length > 0) {
        for (const s of details.seasons) {
          if (s.season_number !== seasonNum && s.episode_count > 0) {
            const altData = await fetchTMDB(`/tv/${id}/season/${s.season_number}`);
            if (altData && altData.episodes && altData.episodes.length > 0) {
              sData = altData;
              state.currentSeason = s.season_number;
              seasonSelect.value = s.season_number;
              break;
            }
          }
        }
      }

      if (sData && sData.episodes && sData.episodes.length > 0) {
        currentSeasonEpisodes = sData.episodes.length > 200 ? sData.episodes.slice(0, 200) : sData.episodes;

        // Season Breakdown Overview & Meta
        if (seasonMetaBadge) {
          const yearStr = sData.air_date ? sData.air_date.split('-')[0] : '';
          seasonMetaBadge.textContent = `Season ${state.currentSeason} • ${currentSeasonEpisodes.length} Episodes ${yearStr ? `• ${yearStr}` : ''}`;
        }

        if (seasonDesc) {
          if (sData.overview) {
            seasonDesc.innerHTML = `<strong>Season ${state.currentSeason} Storyline:</strong> ${sData.overview}`;
            seasonDesc.style.display = 'block';
          } else {
            seasonDesc.style.display = 'none';
          }
        }

        // Setup Range Tabs for Anime & Long Series (> 20 episodes)
        if (rangeTabsContainer) {
          rangeTabsContainer.innerHTML = '';
          if (currentSeasonEpisodes.length > 20) {
            rangeTabsContainer.style.display = 'flex';
            activeRangeIndex = 1; // Default to batch 1 (Eps 1-25) so huge shows like Shin-chan never freeze the DOM

            const batchSize = 25;
            const totalBatches = Math.min(Math.ceil(currentSeasonEpisodes.length / batchSize), 20);

            for (let b = 0; b < totalBatches; b++) {
              const startEp = b * batchSize + 1;
              const endEp = Math.min((b + 1) * batchSize, currentSeasonEpisodes.length);
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = `range-tab-btn ${b === 0 ? 'active' : ''}`;
              btn.textContent = `Eps ${startEp} - ${endEp}`;
              btn.onclick = () => {
                activeRangeIndex = b + 1;
                document.querySelectorAll('.range-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderCurrentEpisodesOrientation();
              };
              rangeTabsContainer.appendChild(btn);
            }
          } else {
            rangeTabsContainer.style.display = 'none';
            activeRangeIndex = 0;
          }
        }

        renderCurrentEpisodesOrientation();
      } else {
        // Direct stream button if season detail isn't indexed
        episodesTrack.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: var(--text-secondary);">
            <p style="margin-bottom: 0.8rem; font-size: 0.95rem;">Stream episodes directly on Server 1 or 2:</p>
            <button type="button" class="btn-cta btn-play" id="btn-stream-direct-ep">
              ▶ Stream Episode ${state.currentEpisode || 1}
            </button>
          </div>
        `;
        const dirBtn = document.getElementById('btn-stream-direct-ep');
        if (dirBtn) {
          dirBtn.onclick = () => mountVideoPlayer(details, state.activeSourceType, state.currentSeason || 1, state.currentEpisode || 1);
        }
      }
    }

    seasonSelect.onchange = () => {
      state.currentSeason = parseInt(seasonSelect.value, 10);
      state.currentEpisode = 1;
      episodeBadge.textContent = `S${state.currentSeason} : E1`;
      window.location.hash = `watch/tv/${details.id}?s=${state.currentSeason}&e=1`;
      loadSeasonEpisodes(state.currentSeason);
      mountVideoPlayer(details, state.activeSourceType, state.currentSeason, 1);
    };

    loadSeasonEpisodes(state.currentSeason);
  } else {
    seriesControls.style.display = 'none';
  }

  // Auto-Select Best Player for Content Type (Movies vs Anime vs Cartoons)
  const isAnime = Boolean(
    (details.original_language === 'ja' && details.genres && details.genres.some(g => g.id === 16 || g.name === 'Animation')) ||
    (details.genre_ids && details.genre_ids.includes(16) && details.original_language === 'ja')
  );
  const isCartoon = Boolean(
    (!isAnime && details.genres && details.genres.some(g => g.id === 16 || g.id === 10762 || g.name === 'Animation')) ||
    (!isAnime && details.genre_ids && (details.genre_ids.includes(16) || details.genre_ids.includes(10762)))
  );

  // Auto-Select Best Server for Content Type (Movies vs Anime vs Cartoons)
  if (isAnime) {
    state.activeSourceType = 'smashy'; // SmashyStream is best for Anime
  } else if (isCartoon) {
    state.activeSourceType = '2embed'; // 2Embed is best for Cartoons & Archives
  } else {
    state.activeSourceType = 'vidlink'; // VidLink is best for Movies & Series
  }

  // Stream Switcher (Server 1-4 + HTML5 Direct + Trailer)
  const serverButtons = [
    { btn: document.getElementById('btn-src-vidlink'), type: 'vidlink' },
    { btn: document.getElementById('btn-src-vidsrc'), type: 'vidsrc' },
    { btn: document.getElementById('btn-src-smashy'), type: 'smashy' },
    { btn: document.getElementById('btn-src-2embed'), type: '2embed' },
    { btn: document.getElementById('btn-src-html5'), type: 'html5' },
    { btn: document.getElementById('btn-src-trailer'), type: 'trailer' },
  ];

  serverButtons.forEach(({ btn, type }) => {
    if (!btn) return;
    btn.classList.toggle('active', type === state.activeSourceType);
    btn.onclick = () => {
      serverButtons.forEach(({ btn: b }) => b && b.classList.remove('active'));
      btn.classList.add('active');
      state.activeSourceType = type;
      mountVideoPlayer(details, type, state.currentSeason || 1, state.currentEpisode || 1);
      setupAudioLanguageSelector(details, isTv);
    };
  });

  // Setup Interactive Language & Audio Pills Switcher
  setupAudioLanguageSelector(details, isTv);

  // Mount Video Player
  mountVideoPlayer(details, state.activeSourceType, state.currentSeason || 1, state.currentEpisode || 1);

  // Record into Watch History
  recordMovieToHistory(details);

  // Scroll Down Hint Button
  const scrollDownBtn = document.getElementById('btn-scroll-down-hint');
  if (scrollDownBtn) {
    scrollDownBtn.onclick = () => {
      const target = document.getElementById('player-series-controls') || document.getElementById('player-movie-title');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    };
  }

  // More Like This (Similar Titles)
  const similarGrid = document.getElementById('player-similar-grid');
  if (similarGrid) {
    similarGrid.innerHTML = '';
    const similar = details.similar ? details.similar.results.slice(0, 12) : [];
    similar.forEach(sim => {
      if (!sim.poster_path) return;
      if (isTv) sim.isTv = true;
      const card = createMovieCard(sim);
      similarGrid.appendChild(card);
    });
  }

  // Top Rated in this Genre (Dynamic Genre Recommendations)
  renderGenreTopShows(details, isTv);

  // Switch to Player View
  switchView('player');
  showToast(`Now Streaming: ${title}`);
}

function setupAudioLanguageSelector(details, isTv) {
  const container = document.getElementById('audio-lang-pills');
  const hintContainer = document.getElementById('audio-server-hint');
  if (!container) return;
  container.innerHTML = '';

  function syncSourceButtons(activeType) {
    document.querySelectorAll('.source-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.server === activeType);
    });
  }

  function createPill(text, isActive, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `lang-pill ${isActive ? 'active' : ''}`;
    btn.textContent = text;
    btn.onclick = () => {
      container.querySelectorAll('.lang-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onClick();
    };
    return btn;
  }

  const origLang = (details.original_language || 'en').toLowerCase();
  const spokenLangs = details.spoken_languages || [];
  const spokenCodes = spokenLangs.map(l => (l.iso_639_1 || '').toLowerCase());
  const isIndianMovie = origLang === 'hi' || ['te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa'].includes(origLang) || spokenCodes.includes('hi');
  const isAnime = Boolean(
    (origLang === 'ja' && details.genres && details.genres.some(g => g.id === 16 || g.name === 'Animation')) ||
    (details.genre_ids && details.genre_ids.includes(16) && origLang === 'ja')
  );

  const origSpoken = spokenLangs.find(l => l.iso_639_1 && l.iso_639_1.toLowerCase() === origLang);
  const origLangLabel = origSpoken ? origSpoken.english_name : origLang.toUpperCase();

  if (isIndianMovie) {
    // 100% Original Hindi / Indian Audio
    const hiPill = createPill('🇮🇳 Hindi (Original Audio)', true, () => {
      state.activeAudioLang = 'hi';
      showToast('Playing 100% Original Hindi Audio');
    });
    container.appendChild(hiPill);

    if (hintContainer) {
      hintContainer.innerHTML = '<span style="font-size: 0.82rem; color: #22c55e;">✔ 100% Original Hindi Audio</span>';
    }

  } else if (isAnime) {
    // Anime: Japanese Original + English Dub + Hindi Dub
    const currentLang = state.activeAudioLang || 'ja';

    const jaPill = createPill('🇯🇵 Japanese (Original)', currentLang === 'ja', () => {
      state.activeAudioLang = 'ja';
      state.activeSourceType = 'smashy';
      syncSourceButtons('smashy');
      mountVideoPlayer(details, 'smashy', state.currentSeason || 1, state.currentEpisode || 1);
      showToast('Playing Original Japanese Audio on Server 3');
    });
    container.appendChild(jaPill);

    const enPill = createPill('🇺🇸 English (Dub / Sub)', currentLang === 'en', () => {
      state.activeAudioLang = 'en';
      state.activeSourceType = 'vidlink';
      syncSourceButtons('vidlink');
      mountVideoPlayer(details, 'vidlink', state.currentSeason || 1, state.currentEpisode || 1);
      showToast('Playing English Sub/Dub on Server 1');
    });
    container.appendChild(enPill);

    const hiPill = createPill('🇮🇳 Hindi (Dubbed)', currentLang === 'hi', () => {
      state.activeAudioLang = 'hi';
      state.activeSourceType = 'html5';
      syncSourceButtons('html5');
      mountVideoPlayer(details, 'html5', state.currentSeason || 1, state.currentEpisode || 1);
      showToast('Connecting to Hindi Dubbed Stream on Server 5');
    });
    container.appendChild(hiPill);

    if (hintContainer) {
      hintContainer.innerHTML = '<span style="font-size: 0.82rem; color: #94a3b8;">Anime Multi-Audio Sub & Dub available</span>';
    }

  } else {
    // Hollywood / International Content
    const currentLang = state.activeAudioLang || 'orig';

    const origPill = createPill(`🌐 Original (${origLangLabel})`, currentLang === 'orig', () => {
      state.activeAudioLang = 'orig';
      state.activeSourceType = 'vidlink';
      syncSourceButtons('vidlink');
      mountVideoPlayer(details, 'vidlink', state.currentSeason || 1, state.currentEpisode || 1);
      showToast(`Playing ${origLangLabel} Original Audio on Server 1`);
    });
    container.appendChild(origPill);

    const hiPill = createPill('🇮🇳 Hindi (Dubbed)', currentLang === 'hi', () => {
      state.activeAudioLang = 'hi';
      state.activeSourceType = 'html5';
      syncSourceButtons('html5');
      mountVideoPlayer(details, 'html5', state.currentSeason || 1, state.currentEpisode || 1);
      showToast('Streaming Hindi Dubbed Audio on Server 5');
    });
    container.appendChild(hiPill);

    if (hintContainer) {
      hintContainer.innerHTML = '<span style="font-size: 0.82rem; color: #94a3b8;">Multi-language audio & subtitles</span>';
    }
  }
}

// Helper: Fetch Top Rated Shows/Movies in matching Genre
async function renderGenreTopShows(details, isTv) {
  const grid = document.getElementById('player-genre-top-grid');
  const titleEl = document.getElementById('player-genre-top-title');
  const section = document.getElementById('player-genre-top-section');
  if (!grid) return;

  const genres = details.genres || [];
  const primaryGenre = genres[0] || { id: isTv ? 18 : 28, name: isTv ? 'Drama' : 'Action' };

  if (titleEl) {
    titleEl.textContent = `⭐ Top Rated Masterpieces in ${primaryGenre.name}`;
  }

  grid.innerHTML = '<div style="color: var(--text-muted); padding: 1.5rem;">Loading genre recommendations...</div>';

  try {
    const endpoint = isTv ? '/discover/tv' : '/discover/movie';
    const data = await fetchTMDB(endpoint, {
      with_genres: primaryGenre.id,
      sort_by: 'vote_average.desc',
      'vote_count.gte': isTv ? '150' : '300'
    });

    grid.innerHTML = '';
    if (data && data.results && data.results.length > 0) {
      const filtered = data.results.filter(item => item.id !== details.id && item.poster_path).slice(0, 12);
      if (filtered.length === 0) {
        if (section) section.style.display = 'none';
        return;
      }
      if (section) section.style.display = 'block';
      filtered.forEach(item => {
        if (isTv) item.isTv = true;
        const card = createMovieCard(item);
        grid.appendChild(card);
      });
    } else {
      if (section) section.style.display = 'none';
    }
  } catch (e) {
    console.warn('Genre top recommendations fetch error:', e);
    if (section) section.style.display = 'none';
  }
}

// Stream Players (4 Tested, 100% Working Fast Players)
async function mountVideoPlayer(item, type, season = 1, episode = 1) {
  const cinemaScreen = document.getElementById('cinema-screen');
  const badge = document.getElementById('player-view-badge');
  const vlcBtn = document.getElementById('player-vlc-btn');
  const isTv = Boolean(item.isTv || item.first_air_date || (item.seasons && item.seasons.length > 0));

  let streamUrl = '';
  let badgeLabel = '';

  // Clean up native player before mounting
  destroyNativePlayer();

  if (torrentStatusTimer) {
    clearInterval(torrentStatusTimer);
    torrentStatusTimer = null;
  }

  if (type === 'vidlink') {
    // ---------------------------------------------------------------
    // ⚡ Server 1: VidLink (Ultra HD, Subtitles & Unmuted Audio)
    // ---------------------------------------------------------------
    badgeLabel = `⚡ Server 1 (VidLink) • ${isTv ? `S${season} : E${episode}` : 'Ultra HD'}`;
    const params = 'primaryColor=e50914&autoplay=false';
    streamUrl = isTv 
      ? `https://vidlink.pro/tv/${item.id}/${season}/${episode}?${params}`
      : `https://vidlink.pro/movie/${item.id}?${params}`;

  } else if (type === 'vidsrc') {
    // ---------------------------------------------------------------
    // 👑 Server 2: VidSrc PM (4K Ultra & Failover)
    // ---------------------------------------------------------------
    badgeLabel = `👑 Server 2 (VidSrc PM) • ${isTv ? `S${season} : E${episode}` : '4K Ultra'}`;
    streamUrl = isTv 
      ? `https://vidsrc.pm/embed/tv/${item.id}/${season}/${episode}`
      : `https://vidsrc.pm/embed/movie/${item.id}`;

  } else if (type === 'smashy') {
    // ---------------------------------------------------------------
    // 🍥 Server 3: SmashyStream (Best for Anime & Multi-Sub)
    // ---------------------------------------------------------------
    badgeLabel = `🍥 Server 3 (SmashyStream) • ${isTv ? `S${season} : E${episode}` : 'Multi-Server'}`;
    streamUrl = isTv 
      ? `https://player.smashystream.com/tv/${item.id}?s=${season}&e=${episode}`
      : `https://player.smashystream.com/movie/${item.id}`;

  } else if (type === '2embed') {
    // ---------------------------------------------------------------
    // 📺 Server 4: 2Embed (Cartoons & Archive HD)
    // ---------------------------------------------------------------
    badgeLabel = `📺 Server 4 (2Embed) • ${isTv ? `S${season} : E${episode}` : 'Archive HD'}`;
    streamUrl = isTv 
      ? `https://www.2embed.cc/embedtv/${item.id}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${item.id}`;

  } else if (type === 'html5') {
    // ---------------------------------------------------------------
    // 🎬 Server 5: HTML5 (Direct Stream Multi-Track)
    // ---------------------------------------------------------------
    badgeLabel = `🎬 Server 5 (HTML5) • ${isTv ? `S${season} : E${episode}` : 'Direct Stream'}`;
    state.currentStreamUrl = '';
    if (badge) badge.textContent = badgeLabel;

    cinemaScreen.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b0f19; color: #fff; padding: 2rem; text-align: center;">
        <div class="spinner" style="width: 44px; height: 44px; border: 4px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1.25rem;"></div>
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">Connecting to Server 5 (HTML5)...</h3>
        <p style="color: #94a3b8; font-size: 0.88rem;">Fetching direct HTML5 stream buffer.</p>
      </div>
    `;

    try {
      const isHindi = state.activeAudioLang === 'hi';
      const resolved = await resolveDirectStream(item, isTv, season, episode, isHindi);
      if (resolved && resolved.url) {
        state.currentStreamUrl = `${window.location.origin}${resolved.url}`;
        const poster = item.backdrop_path ? `${IMG_BASE_URL}/original${item.backdrop_path}` : '';
        initNativePlayer(cinemaScreen, {
          url: resolved.url,
          title: item.title || item.name,
          poster: poster
        });
        showToast(resolved.hasHindi ? 'Server 5: Playing with Hindi Audio' : 'Server 5: HTML5 Stream Ready');
      } else {
        cinemaScreen.innerHTML = `
          <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b0f19; color: #fff; padding: 2rem; text-align: center;">
            <p style="color: #94a3b8; margin-bottom: 1rem;">Direct HTML5 stream unavailable for this title. Switching to Server 1...</p>
          </div>
        `;
        setTimeout(() => {
          state.activeSourceType = 'vidlink';
          document.querySelectorAll('.source-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.server === 'vidlink');
          });
          mountVideoPlayer(item, 'vidlink', season, episode);
        }, 1200);
      }
    } catch (e) {
      console.warn('Server 5 fallback to Server 1:', e);
      state.activeSourceType = 'vidlink';
      document.querySelectorAll('.source-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.server === 'vidlink');
      });
      mountVideoPlayer(item, 'vidlink', season, episode);
    }
    return;

  } else if (type === 'trailer') {
    // ---------------------------------------------------------------
    // 🎞️ Official HD Trailer
    // ---------------------------------------------------------------
    badgeLabel = '🎞️ Official HD Trailer';
    const videos = item.videos ? item.videos.results : [];
    const trailer = videos.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos[0];
    if (trailer && trailer.key) {
      streamUrl = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0&modestbranding=1`;
    }
  }

  if (badge) badge.textContent = badgeLabel;
  state.currentStreamUrl = streamUrl;

  // Pop-out Player Button listener
  const popoutBtn = document.getElementById('player-external-btn');
  if (popoutBtn) {
    popoutBtn.onclick = () => {
      if (state.currentStreamUrl) {
        window.open(state.currentStreamUrl, '_blank', 'noopener,noreferrer');
        showToast('↗ Stream opened in new tab with full sound');
      }
    };
  }

  if (streamUrl) {
    cinemaScreen.innerHTML = `
      <iframe 
        id="video-player-iframe"
        src="${streamUrl}" 
        title="${item.title || item.name}" 
        style="width: 100%; height: 100%; border: none;"
        allow="accelerometer; autoplay *; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" 
        allowfullscreen="true" 
        webkitallowfullscreen="true" 
        mozallowfullscreen="true"
        referrerpolicy="no-referrer">
      </iframe>
    `;
  } else {
    cinemaScreen.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 3rem;">
        <h3>Stream is loading...</h3>
        <p style="margin-top: 0.5rem;">Click Server 1, Server 2, Server 3, Server 4 or Server 5 to stream.</p>
      </div>
    `;
  }
}

function stopVideoPlayback() {
  destroyNativePlayer();
  if (torrentStatusTimer) {
    clearInterval(torrentStatusTimer);
    torrentStatusTimer = null;
  }
  fetch('/api/torrent/stop', { method: 'POST' }).catch(() => {});
  const vlcBtn = document.getElementById('player-vlc-btn');
  if (vlcBtn) vlcBtn.style.display = 'none';
  const cinemaScreen = document.getElementById('cinema-screen');
  if (cinemaScreen) {
    cinemaScreen.innerHTML = '';
  }
}

function updatePlayerWatchlistBtn(btn, inList) {
  if (inList) {
    btn.textContent = '✓ In Watchlist';
    btn.classList.add('in-watchlist');
  } else {
    btn.textContent = '+ Add to Watchlist';
    btn.classList.remove('in-watchlist');
  }
}

// ==========================================================================
// Watch History Tracking & Synchronization
// ==========================================================================
function recordMovieToHistory(movie) {
  const historyItem = {
    id: movie.id,
    title: movie.title || movie.name,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    vote_average: movie.vote_average,
    release_date: movie.release_date,
    watchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  // Remove duplicate entry so latest is always first
  state.watchHistory = state.watchHistory.filter(m => m.id !== movie.id);
  state.watchHistory.unshift(historyItem);
  if (state.watchHistory.length > 25) state.watchHistory = state.watchHistory.slice(0, 25);

  localStorage.setItem('bingeflix_watch_history', JSON.stringify(state.watchHistory));

  // Sync to Cloud Firestore if signed in
  if (state.currentUser && state.currentUser.uid) {
    recordMovieWatchToCloud(state.currentUser.uid, movie);
  }

  renderHistoryRow();
  updateWatchlistBadge();
}

function renderHistoryRow() {
  // Watch history is kept private in the dedicated Library > Watch History tab
  const section = document.getElementById('section-history');
  if (section) section.style.display = 'none';
}

// ==========================================================================
// Database & Watchlist Management
// ==========================================================================
function getUsersDB() {
  return JSON.parse(localStorage.getItem('bingeflix_users_db') || '[]');
}

function saveUsersDB(users) {
  localStorage.setItem('bingeflix_users_db', JSON.stringify(users));
}

function syncUserWatchlistToDB() {
  if (!state.currentUser) return;
  const users = getUsersDB();
  const idx = users.findIndex(u => u.id === state.currentUser.id || u.username === state.currentUser.username);
  if (idx >= 0) {
    users[idx].watchlist = state.watchlist;
    saveUsersDB(users);
  }
  state.currentUser.watchlist = state.watchlist;
  localStorage.setItem('bingeflix_user', JSON.stringify(state.currentUser));

  // Sync to Firestore
  if (state.currentUser.uid) {
    syncWatchlistToCloud(state.currentUser.uid, state.watchlist);
  }
}

function isMovieInWatchlist(id) {
  return state.watchlist.some(m => m.id === id);
}

function toggleWatchlist(movie) {
  const idx = state.watchlist.findIndex(m => m.id === movie.id);
  if (idx >= 0) {
    state.watchlist.splice(idx, 1);
    showToast(`Removed "${movie.title || movie.name}" from Watchlist`);
  } else {
    state.watchlist.push({
      id: movie.id,
      title: movie.title || movie.name,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average,
      release_date: movie.release_date,
    });
    showToast(`Added "${movie.title || movie.name}" to Watchlist!`);
  }

  // Persist to user's database entry
  if (state.currentUser) {
    syncUserWatchlistToDB();
  } else {
    localStorage.setItem('bingeflix_watchlist', JSON.stringify(state.watchlist));
  }

  updateWatchlistBadge();

  if (document.getElementById('watchlist-view').style.display === 'block') {
    renderLibraryView();
  }
}

function updateWatchlistBadge() {
  const badge = document.getElementById('watchlist-count');
  const drawerBadge = document.getElementById('drawer-watchlist-count');
  const libWatchlistCount = document.getElementById('lib-watchlist-count');
  const libHistoryCount = document.getElementById('lib-history-count');

  if (badge) badge.textContent = state.watchlist.length;
  if (drawerBadge) drawerBadge.textContent = state.watchlist.length;
  if (libWatchlistCount) libWatchlistCount.textContent = state.watchlist.length;
  if (libHistoryCount) libHistoryCount.textContent = state.watchHistory.length;
}

function renderLibraryView() {
  const grid = document.getElementById('watchlist-grid');
  const subtitle = document.getElementById('watchlist-subtitle');
  grid.innerHTML = '';

  const tabWatchlist = document.getElementById('tab-watchlist');
  const tabHistory = document.getElementById('tab-history');

  tabWatchlist.onclick = () => {
    state.activeLibraryTab = 'watchlist';
    tabWatchlist.classList.add('active');
    tabHistory.classList.remove('active');
    renderLibraryView();
  };

  tabHistory.onclick = () => {
    state.activeLibraryTab = 'history';
    tabHistory.classList.add('active');
    tabWatchlist.classList.remove('active');
    renderLibraryView();
  };

  if (state.activeLibraryTab === 'watchlist') {
    subtitle.textContent = state.currentUser 
      ? `@${state.currentUser.username}, you have ${state.watchlist.length} saved movies in your watchlist.` 
      : `You have ${state.watchlist.length} saved movies.`;

    if (state.watchlist.length === 0) {
      grid.innerHTML = `
        <div class="empty-watchlist" style="grid-column: 1 / -1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3>Your watchlist is empty</h3>
          <p style="margin-top: 0.5rem;">Click "+ Watchlist" on any movie to bookmark it here.</p>
        </div>
      `;
      return;
    }

    state.watchlist.forEach(movie => {
      const card = createMovieCard(movie);
      grid.appendChild(card);
    });
  } else {
    // History Tab
    subtitle.innerHTML = `
      <div class="history-toolbar">
        <span>${state.currentUser ? `@${state.currentUser.username}, you have watched ${state.watchHistory.length} titles on this account.` : `You have streamed ${state.watchHistory.length} titles.`}</span>
        ${state.watchHistory.length > 0 ? '<button type="button" class="btn-history-clear-all" id="btn-open-clear-modal">🗑️ Clear All History</button>' : ''}
      </div>
    `;

    const openClearBtn = document.getElementById('btn-open-clear-modal');
    if (openClearBtn) {
      openClearBtn.onclick = () => {
        const modal = document.getElementById('confirm-clear-modal');
        if (modal) modal.style.display = 'flex';
      };
    }

    if (state.watchHistory.length === 0) {
      grid.innerHTML = `
        <div class="empty-watchlist" style="grid-column: 1 / -1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <h3>No watch history yet</h3>
          <p style="margin-top: 0.5rem;">Start streaming any movie or series and it will appear here automatically.</p>
        </div>
      `;
      return;
    }

    state.watchHistory.forEach(movie => {
      const card = createMovieCard(movie, true); // true = show individual delete button
      grid.appendChild(card);
    });
  }
}

// ==========================================================================
// User Authentication & Firebase Integration
// ==========================================================================
function setupEventListeners() {
  const authBtn = document.getElementById('auth-btn');
  const authModal = document.getElementById('auth-modal');
  const authClose = document.getElementById('auth-close');
  const authForm = document.getElementById('auth-form');
  const googleBtn = document.getElementById('google-signin-btn');
  const authToggleBtn = document.getElementById('auth-toggle-btn');
  const groupUsername = document.getElementById('group-username');
  const authUsername = document.getElementById('auth-username');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authEmailLabel = document.getElementById('auth-email-label');
  const authError = document.getElementById('auth-error');

  let isSignUpMode = false;

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = 'block';
  }

  function clearAuthError() {
    authError.textContent = '';
    authError.style.display = 'none';
  }

  // Real-time Auth State listener for instant popup response
  onAuthStateListener(async (user) => {
    if (user && (!state.currentUser || state.currentUser.uid !== user.uid)) {
      const username = (user.displayName || user.email.split('@')[0]).replace(/\s+/g, '_').toLowerCase();
      state.currentUser = {
        uid: user.uid,
        email: user.email,
        username: username,
        photoURL: user.photoURL || '',
      };
      localStorage.setItem('bingeflix_user', JSON.stringify(state.currentUser));
      updateUserUI();
      if (authModal) authModal.style.display = 'none';

      // Load their cloud data
      try {
        const cloudData = await fetchUserDataFromCloud(user.uid);
        if (cloudData) {
          if (Array.isArray(cloudData.watchlist)) state.watchlist = cloudData.watchlist;
          if (Array.isArray(cloudData.watchHistory)) state.watchHistory = cloudData.watchHistory;
          localStorage.setItem('bingeflix_watchlist', JSON.stringify(state.watchlist));
          localStorage.setItem('bingeflix_watch_history', JSON.stringify(state.watchHistory));
          updateWatchlistBadge();
          renderHistoryRow();
        }
      } catch (e) {
        console.warn('Cloud sync error in auth listener:', e);
      }
      showToast(`🎉 Signed in as @${username}!`);
    }
  });

  function setAuthMode(signUp) {
    isSignUpMode = signUp;
    clearAuthError();
    if (isSignUpMode) {
      document.getElementById('auth-heading').textContent = 'Create BingeFlix Account';
      document.getElementById('auth-subtext').textContent = 'Create your username to save movies & history in Firebase';
      document.getElementById('auth-submit-btn').textContent = 'Create Account';
      document.getElementById('auth-toggle-prompt').textContent = 'Already have an account?';
      authToggleBtn.textContent = 'Sign In';
      groupUsername.style.display = 'block';
      authUsername.required = true;
      authEmailLabel.textContent = 'Email Address';
      authEmail.placeholder = 'you@example.com';
    } else {
      document.getElementById('auth-heading').textContent = 'Sign In to BingeFlix';
      document.getElementById('auth-subtext').textContent = 'Access your personal watchlist & preferences';
      document.getElementById('auth-submit-btn').textContent = 'Sign In';
      document.getElementById('auth-toggle-prompt').textContent = "Don't have an account?";
      authToggleBtn.textContent = 'Sign Up';
      groupUsername.style.display = 'none';
      authUsername.required = false;
      authEmailLabel.textContent = 'Email or Username';
      authEmail.placeholder = 'you@example.com or username';
    }
  }

  // User Menu & Auth Button (Toggle Netflix-Style Dropdown)
  const userDropdown = document.getElementById('user-menu-dropdown');
  const usernameModal = document.getElementById('username-modal');
  const usernameModalClose = document.getElementById('username-modal-close');
  const usernameModalForm = document.getElementById('username-modal-form');
  const customUsernameInput = document.getElementById('custom-username-input');
  const usernameModalError = document.getElementById('username-modal-error');
  const usernameModalHeading = document.getElementById('username-modal-heading');
  let selectedAvatar = 'goku';

  function initAvatarPicker() {
    const avatarBtns = document.querySelectorAll('.avatar-pick-btn');
    selectedAvatar = (state.currentUser && state.currentUser.avatar) || 'goku';
    avatarBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.avatar === selectedAvatar);
      btn.onclick = (e) => {
        e.preventDefault();
        avatarBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedAvatar = btn.dataset.avatar;
      };
    });
  }

  function openUsernameModal(isFirstTime = false) {
    if (!usernameModal) return;
    if (usernameModalError) {
      usernameModalError.textContent = '';
      usernameModalError.style.display = 'none';
    }
    if (usernameModalHeading) {
      usernameModalHeading.textContent = isFirstTime ? 'Customize Profile & Avatar' : 'Edit Profile & Avatar';
    }
    if (customUsernameInput) {
      customUsernameInput.value = (state.currentUser && state.currentUser.username) || '';
      setTimeout(() => customUsernameInput.focus(), 60);
    }
    initAvatarPicker();
    usernameModal.style.display = 'flex';
  }

  if (usernameModalClose) {
    usernameModalClose.addEventListener('click', () => {
      usernameModal.style.display = 'none';
    });
  }

  if (usernameModal) {
    usernameModal.addEventListener('click', (e) => {
      if (e.target === usernameModal) usernameModal.style.display = 'none';
    });
  }

  if (usernameModalForm) {
    usernameModalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = (customUsernameInput.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!raw || raw.length < 3) {
        if (usernameModalError) {
          usernameModalError.textContent = 'Username must be at least 3 letters, numbers or underscores.';
          usernameModalError.style.display = 'block';
        }
        return;
      }

      if (state.currentUser) {
        state.currentUser.username = raw;
        state.currentUser.avatar = selectedAvatar;
        state.currentUser.hasCustomUsername = true;
        localStorage.setItem('bingeflix_user', JSON.stringify(state.currentUser));

        try {
          await updateUserCustomUsername(state.currentUser.uid || state.currentUser.id, raw);
        } catch (err) {
          console.warn('Could not sync profile to cloud:', err);
        }

        updateUserUI();
        usernameModal.style.display = 'none';
        showToast(`✨ Profile updated! @${raw}`);
      }
    });
  }

  // Account button click: Toggle dropdown if signed in, or open sign in modal
  authBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentUser) {
      const isVisible = userDropdown.style.display === 'block';
      userDropdown.style.display = isVisible ? 'none' : 'block';
    } else {
      setAuthMode(false);
      authModal.style.display = 'flex';
    }
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (userDropdown && !e.target.closest('.user-menu-container')) {
      userDropdown.style.display = 'none';
    }
  });

  // Dropdown Item: Watchlist
  const menuWatchlist = document.getElementById('menu-watchlist');
  if (menuWatchlist) {
    menuWatchlist.addEventListener('click', () => {
      if (userDropdown) userDropdown.style.display = 'none';
      switchView('watchlist');
      state.activeLibraryTab = 'watchlist';
      renderLibraryView();
    });
  }

  // Dropdown Item: Watch History / Resume Watching
  const menuHistory = document.getElementById('menu-history');
  if (menuHistory) {
    menuHistory.addEventListener('click', () => {
      if (userDropdown) userDropdown.style.display = 'none';
      switchView('watchlist');
      state.activeLibraryTab = 'history';
      renderLibraryView();
    });
  }

  // Dropdown Item: Change Username
  const menuChangeUsername = document.getElementById('menu-change-username');
  if (menuChangeUsername) {
    menuChangeUsername.addEventListener('click', () => {
      if (userDropdown) userDropdown.style.display = 'none';
      openUsernameModal(false);
    });
  }

  // Dropdown Item: Sign Out with Confirmation Modal
  const menuSignout = document.getElementById('menu-signout');
  const confirmSignoutModal = document.getElementById('confirm-signout-modal');
  const cancelSignoutBtn = document.getElementById('cancel-signout-btn');
  const confirmSignoutBtn = document.getElementById('confirm-signout-btn');

  if (menuSignout) {
    menuSignout.addEventListener('click', () => {
      if (userDropdown) userDropdown.style.display = 'none';
      if (confirmSignoutModal) confirmSignoutModal.style.display = 'flex';
    });
  }

  if (cancelSignoutBtn) {
    cancelSignoutBtn.addEventListener('click', () => {
      if (confirmSignoutModal) confirmSignoutModal.style.display = 'none';
    });
  }

  if (confirmSignoutModal) {
    confirmSignoutModal.addEventListener('click', (e) => {
      if (e.target === confirmSignoutModal) confirmSignoutModal.style.display = 'none';
    });
  }

  if (confirmSignoutBtn) {
    confirmSignoutBtn.addEventListener('click', () => {
      if (confirmSignoutModal) confirmSignoutModal.style.display = 'none';
      logoutFirebase();
      state.currentUser = null;
      localStorage.removeItem('bingeflix_user');
      updateUserUI();
      updateWatchlistBadge();
      showToast('🚪 Signed out successfully');
      authModal.style.display = 'flex';
      if (authClose) authClose.style.display = 'none';
    });
  }

  if (authClose) {
    authClose.addEventListener('click', () => {
      if (!state.currentUser) {
        showToast('Please sign in to access BingeFlix');
        return;
      }
      authModal.style.display = 'none';
      clearAuthError();
    });
  }

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
      if (!state.currentUser) {
        showToast('Please sign in to access BingeFlix');
        return;
      }
      authModal.style.display = 'none';
      clearAuthError();
    }
  });

  if (authToggleBtn) {
    authToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setAuthMode(!isSignUpMode);
    });
  }

  // Handle Form Submit (Username & Password Login created by Admin)
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();

    const identifier = authEmail.value.trim().toLowerCase();
    const password = authPassword.value.trim();

    if (!identifier || !password) {
      showAuthError('Please enter both Username/Email and Password.');
      return;
    }

    try {
      showToast('Authenticating account...');
      const subRes = await verifySubscriberLogin(identifier, password);
      if (subRes && subRes.success) {
        if (subRes.isExpired) {
          authModal.style.display = 'none';
          authForm.reset();
          const expModal = document.getElementById('expired-subscription-modal');
          if (expModal) expModal.style.display = 'flex';
          return;
        }

        state.currentUser = subRes.user;
        state.watchlist = JSON.parse(localStorage.getItem(`bingeflix_wl_${subRes.user.uid}`) || '[]');
        state.watchHistory = JSON.parse(localStorage.getItem(`bingeflix_wh_${subRes.user.uid}`) || '[]');
        localStorage.setItem('bingeflix_user', JSON.stringify(subRes.user));
        
        updateUserUI();
        updateWatchlistBadge();
        renderHistoryRow();
        authModal.style.display = 'none';
        authForm.reset();
        showToast(`🎉 Welcome @${subRes.user.username}!`);
        return;
      } else {
        showAuthError('❌ Invalid Username or Password. Please check with your Admin.');
      }
    } catch (err) {
      console.error(err);
      showAuthError('❌ Authentication error. Please check your credentials.');
    }
  });

  // Animated Clear History Confirmation Modal
  const confirmClearModal = document.getElementById('confirm-clear-modal');
  const cancelClearBtn = document.getElementById('cancel-clear-btn');
  const confirmClearBtn = document.getElementById('confirm-clear-btn');

  if (cancelClearBtn) {
    cancelClearBtn.addEventListener('click', () => {
      if (confirmClearModal) confirmClearModal.style.display = 'none';
    });
  }

  if (confirmClearModal) {
    confirmClearModal.addEventListener('click', (e) => {
      if (e.target === confirmClearModal) confirmClearModal.style.display = 'none';
    });
  }

  if (confirmClearBtn) {
    confirmClearBtn.addEventListener('click', async () => {
      if (confirmClearModal) confirmClearModal.style.display = 'none';
      state.watchHistory = [];
      localStorage.setItem('bingeflix_watch_history', '[]');
      if (state.currentUser && state.currentUser.uid && isFirebaseReady()) {
        await clearWatchHistoryInCloud(state.currentUser.uid);
      }
      renderLibraryView();
      updateWatchlistBadge();
      showToast('🗑️ Watch history cleared successfully');
    });
  }

  // Initialize Admin Panel Listeners
  setupAdminPanel();

  // Spacebar Play/Pause handler
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }

      e.preventDefault();

      const playerView = document.getElementById('player-view');
      if (playerView && playerView.style.display !== 'none') {
        const video = document.querySelector('#cinema-screen video');
        if (video) {
          if (video.paused) {
            video.play();
            showToast('▶ Video Playing');
          } else {
            video.pause();
            showToast('⏸ Video Paused');
          }
        } else {
          showToast('Spacebar: Click inside player screen to control playback');
        }
      }
    }
  });
}

// ==========================================================================
// Admin Panel: User Creation, Subscriptions & Revenue System
// ==========================================================================
function setupAdminPanel() {
  const menuAdminBtn = document.getElementById('menu-admin-panel');
  const drawerAdminBtn = document.getElementById('drawer-admin-btn');
  const adminLoginModal = document.getElementById('admin-login-modal');
  const adminLoginClose = document.getElementById('admin-login-close');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminPinInput = document.getElementById('admin-pin-input');
  const adminLoginError = document.getElementById('admin-login-error');

  const adminDashModal = document.getElementById('admin-dashboard-modal');
  const adminDashClose = document.getElementById('admin-dashboard-close');
  const adminRefreshBtn = document.getElementById('admin-refresh-btn');
  const adminCreateForm = document.getElementById('admin-create-user-form');
  const btnGeneratePass = document.getElementById('btn-generate-pass');
  const adminPlanSelect = document.getElementById('admin-new-plan');
  const adminAmountInput = document.getElementById('admin-new-amount');
  const adminSearchSubs = document.getElementById('admin-search-subs');
  const adminSubsContainer = document.getElementById('admin-subs-container');

  const expiredModal = document.getElementById('expired-subscription-modal');
  const closeExpiredModalBtn = document.getElementById('close-expired-modal-btn');
  const contactAdminRenewBtn = document.getElementById('contact-admin-renew-btn');

  if (closeExpiredModalBtn && expiredModal) {
    closeExpiredModalBtn.onclick = () => expiredModal.style.display = 'none';
    expiredModal.onclick = (e) => {
      if (e.target === expiredModal) expiredModal.style.display = 'none';
    };
  }

  if (contactAdminRenewBtn) {
    contactAdminRenewBtn.onclick = () => {
      window.open('https://wa.me/?text=' + encodeURIComponent('Hi Admin, I want to renew my BingeFlix Premium subscription!'), '_blank');
    };
  }

  function openAdminEntry() {
    const userDropdown = document.getElementById('user-menu-dropdown');
    if (userDropdown) userDropdown.style.display = 'none';

    // Hide auth modal if active so modals do not overlap
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.style.display = 'none';

    if (state.adminAuthenticated) {
      openAdminDashboard();
    } else {
      if (adminLoginError) {
        adminLoginError.textContent = '';
        adminLoginError.style.display = 'none';
      }
      if (adminPinInput) adminPinInput.value = '';
      if (adminLoginModal) adminLoginModal.style.display = 'flex';
      setTimeout(() => adminPinInput && adminPinInput.focus(), 60);
    }
  }

  if (menuAdminBtn) menuAdminBtn.addEventListener('click', openAdminEntry);
  if (drawerAdminBtn) drawerAdminBtn.addEventListener('click', openAdminEntry);

  const authAdminLink = document.getElementById('auth-admin-link');
  if (authAdminLink) {
    authAdminLink.addEventListener('click', (e) => {
      e.preventDefault();
      openAdminEntry();
    });
  }

  // Deep link listener for /adm, #adm, ?adm
  function checkAdmUrl() {
    const hash = (window.location.hash || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    const search = (window.location.search || '').toLowerCase();
    if (
      hash.includes('adm') || 
      path.includes('/adm') || 
      path.endsWith('adm') || 
      search.includes('adm')
    ) {
      openAdminEntry();
    }
  }
  window.addEventListener('hashchange', checkAdmUrl);
  setTimeout(checkAdmUrl, 150);
  setTimeout(checkAdmUrl, 500);

  // Global Admin shortcut: Alt+A
  window.addEventListener('keydown', (e) => {
    if ((e.altKey && (e.key === 'a' || e.key === 'A')) || (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A'))) {
      e.preventDefault();
      openAdminEntry();
    }
  });

  if (adminLoginClose && adminLoginModal) {
    adminLoginClose.onclick = () => {
      adminLoginModal.style.display = 'none';
      if (!state.currentUser) {
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.style.display = 'flex';
      }
    };
    adminLoginModal.onclick = (e) => {
      if (e.target === adminLoginModal) {
        adminLoginModal.style.display = 'none';
        if (!state.currentUser) {
          const authModal = document.getElementById('auth-modal');
          if (authModal) authModal.style.display = 'flex';
        }
      }
    };
  }

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pin = (adminPinInput.value || '').trim();
      // Master PIN: 12345
      if (pin === '12345' || pin === 'admin786') {
        state.adminAuthenticated = true;
        adminLoginModal.style.display = 'none';
        openAdminDashboard();
        showToast('🛡️ Admin Panel Unlocked!');
      } else {
        if (adminLoginError) {
          adminLoginError.textContent = '❌ Incorrect Master PIN. Enter "12345".';
          adminLoginError.style.display = 'block';
        }
      }
    });
  }

  function openAdminDashboard() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.style.display = 'none';
    if (adminLoginModal) adminLoginModal.style.display = 'none';

    if (adminDashModal) {
      adminDashModal.style.display = 'flex';
      loadAndRenderAdminSubscribers();
    }
  }

  if (adminDashClose && adminDashModal) {
    adminDashClose.onclick = () => {
      adminDashModal.style.display = 'none';
      if (!state.currentUser) {
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.style.display = 'flex';
      }
    };
  }

  if (adminRefreshBtn) {
    adminRefreshBtn.onclick = () => {
      loadAndRenderAdminSubscribers();
      showToast('Subscribers refreshed');
    };
  }

  // Auto Generate Password
  if (btnGeneratePass) {
    btnGeneratePass.onclick = () => {
      const passInput = document.getElementById('admin-new-password');
      if (passInput) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        passInput.value = `Binge@${rand}`;
      }
    };
  }

  // Plan select update amount automatically
  if (adminPlanSelect && adminAmountInput) {
    adminPlanSelect.onchange = () => {
      const selected = adminPlanSelect.options[adminPlanSelect.selectedIndex];
      const price = selected.dataset.price || '199';
      adminAmountInput.value = price;
    };
  }

  // Create User Form Submit
  if (adminCreateForm) {
    adminCreateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const createAlert = document.getElementById('admin-create-alert');
      if (createAlert) {
        createAlert.textContent = '';
        createAlert.style.display = 'none';
      }

      const usernameInput = document.getElementById('admin-new-username');
      const emailInput = document.getElementById('admin-new-email');
      const passwordInput = document.getElementById('admin-new-password');
      const planOpt = (adminPlanSelect && adminPlanSelect.options) ? adminPlanSelect.options[adminPlanSelect.selectedIndex] : null;
      const amount = (adminAmountInput && adminAmountInput.value) || '199';
      const paymentEl = document.getElementById('admin-new-payment-method');
      const noteEl = document.getElementById('admin-new-note');
      const paymentMethod = paymentEl ? paymentEl.value : 'UPI';
      const note = noteEl ? noteEl.value : '';

      const username = (usernameInput && usernameInput.value ? usernameInput.value : '').trim();
      const password = (passwordInput && passwordInput.value ? passwordInput.value : '').trim();
      let email = (emailInput && emailInput.value ? emailInput.value : '').trim();
      if (!email) {
        email = `${username.toLowerCase()}@bingeflix.vip`;
      }

      if (!username || !password) {
        if (createAlert) {
          createAlert.textContent = '❌ Please enter both Username and Password.';
          createAlert.style.display = 'block';
        }
        showToast('Please fill Username and Password');
        return;
      }

      const durationDays = (planOpt && planOpt.dataset && planOpt.dataset.days) ? (parseInt(planOpt.dataset.days, 10) || 30) : 30;
      const planName = planOpt ? planOpt.value : '1 Month';

      try {
        const newSub = await createPaidSubscriber({
          username,
          email,
          password,
          plan: planName,
          durationDays,
          amount,
          paymentMethod,
          note: note || `Paid ₹${amount} via ${paymentMethod}`,
        });

        adminCreateForm.reset();
        if (adminAmountInput) adminAmountInput.value = '199';
        await loadAndRenderAdminSubscribers();

        // Prepare customer credentials
        const formattedExpiry = new Date(newSub.expiresAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });

        const credentialsMessage = `🎬 *BingeFlix VIP Premium Account Activated!*\n\n👤 *Username:* ${newSub.username}\n📧 *Email:* ${newSub.email}\n🔑 *Password:* ${newSub.password}\n📦 *Plan:* ${newSub.plan} (${durationDays} Days)\n⏳ *Expires On:* ${formattedExpiry}\n🌐 *Stream Link:* ${window.location.origin}\n\n🍿 Login with your username/email and enjoy 4K Movies, Hindi Dubs & Anime!`;

        if (navigator.clipboard) {
          navigator.clipboard.writeText(credentialsMessage).catch(() => {});
        }

        if (createAlert) {
          createAlert.textContent = `✅ Success! User "@${newSub.username}" created. Password: "${newSub.password}". Ready to login!`;
          createAlert.style.display = 'block';
          createAlert.style.borderColor = '#10b981';
          createAlert.style.color = '#10b981';
          createAlert.style.background = 'rgba(16, 185, 129, 0.1)';
        }

        showToast(`🎉 User @${newSub.username} created successfully!`);
      } catch (err) {
        console.error('Create subscriber error:', err);
        if (createAlert) {
          createAlert.textContent = `❌ Error: ${err.message || 'Could not create subscriber'}`;
          createAlert.style.display = 'block';
        }
        showToast('Error creating subscriber');
      }
    });
  }

  // Search subscribers filter
  if (adminSearchSubs) {
    adminSearchSubs.oninput = () => {
      renderAdminSubscribersList(state.subscribers, adminSearchSubs.value.trim().toLowerCase());
    };
  }

  async function loadAndRenderAdminSubscribers() {
    if (adminSubsContainer) {
      adminSubsContainer.innerHTML = '<div class="admin-loading-state">Loading subscribers...</div>';
    }
    const subs = await fetchAllSubscribers();
    state.subscribers = subs || [];
    renderAdminSubscribersList(state.subscribers, '');
    updateAdminStats(state.subscribers);
  }

  function updateAdminStats(subs) {
    const totalEl = document.getElementById('stat-total-subs');
    const activeEl = document.getElementById('stat-active-subs');
    const revEl = document.getElementById('stat-total-revenue');
    const expEl = document.getElementById('stat-expiring-subs');
    const countEl = document.getElementById('admin-list-count');

    const now = new Date();
    let totalRev = 0;
    let activeCount = 0;
    let expiringCount = 0;

    subs.forEach(s => {
      totalRev += parseFloat(s.amount || 0) || 0;
      const exp = new Date(s.expiresAt);
      const isExpired = now > exp || s.status === 'suspended';
      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (!isExpired) {
        activeCount++;
        if (daysLeft <= 7) expiringCount++;
      }
    });

    if (totalEl) totalEl.textContent = subs.length;
    if (countEl) countEl.textContent = subs.length;
    if (activeEl) activeEl.textContent = activeCount;
    if (revEl) revEl.textContent = `₹${totalRev.toLocaleString('en-IN')}`;
    if (expEl) expEl.textContent = expiringCount;
  }

  function renderAdminSubscribersList(subs, filter = '') {
    if (!adminSubsContainer) return;
    adminSubsContainer.innerHTML = '';

    const filtered = subs.filter(s => 
      (s.username || '').toLowerCase().includes(filter) ||
      (s.email || '').toLowerCase().includes(filter) ||
      (s.note || '').toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
      adminSubsContainer.innerHTML = `
        <div class="admin-empty-state">
          ${filter ? 'No subscribers match your search.' : 'No paid subscribers created yet. Use the form on the left to add your first customer!'}
        </div>
      `;
      return;
    }

    const now = new Date();

    filtered.forEach(sub => {
      const exp = new Date(sub.expiresAt);
      const isExpired = now > exp || sub.status === 'suspended';
      const daysLeft = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const expDateStr = exp.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      let badgeClass = 'status-active';
      let badgeText = `Active • ${daysLeft} days left`;

      if (sub.status === 'suspended') {
        badgeClass = 'status-expired';
        badgeText = 'Suspended';
      } else if (isExpired) {
        badgeClass = 'status-expired';
        badgeText = 'Expired';
      } else if (daysLeft <= 7) {
        badgeClass = 'status-warning';
        badgeText = `Expiring soon • ${daysLeft}d`;
      }

      const card = document.createElement('div');
      card.className = `admin-sub-card ${isExpired ? 'card-expired' : ''}`;
      card.innerHTML = `
        <div class="sub-card-header">
          <div class="sub-user-meta">
            <span class="sub-username">@${sub.username}</span>
            <span class="sub-email">${sub.email}</span>
          </div>
          <span class="sub-status-badge ${badgeClass}">${badgeText}</span>
        </div>

        <div class="sub-card-details">
          <div class="sub-detail-pill">
            <span class="detail-label">Plan:</span>
            <span class="detail-val">${sub.plan}</span>
          </div>
          <div class="sub-detail-pill">
            <span class="detail-label">Paid:</span>
            <span class="detail-val">₹${sub.amount || '199'} (${sub.paymentMethod || 'UPI'})</span>
          </div>
          <div class="sub-detail-pill">
            <span class="detail-label">Expires:</span>
            <span class="detail-val">${expDateStr}</span>
          </div>
          <div class="sub-password-box">
            <span class="detail-label">Password:</span>
            <span class="sub-pass-text">••••••••</span>
            <button type="button" class="btn-pass-toggle" title="Show / Hide Password">👁️</button>
          </div>
        </div>

        ${sub.note ? `<div class="sub-note-text">📝 ${sub.note}</div>` : ''}

        <div class="sub-actions-row">
          <button type="button" class="sub-btn btn-copy-wa" title="Copy ready formatted message for customer on WhatsApp">
            📋 Copy for WhatsApp
          </button>
          <button type="button" class="sub-btn btn-extend" title="Add 30 Days to subscription">
            ➕ +30 Days
          </button>
          <button type="button" class="sub-btn btn-toggle-suspend">
            ${sub.status === 'suspended' ? '▶ Activate' : '⏸️ Suspend'}
          </button>
          <button type="button" class="sub-btn btn-del" title="Delete User">
            🗑️
          </button>
        </div>
      `;

      // Password toggle
      let showPass = false;
      const passText = card.querySelector('.sub-pass-text');
      const passToggleBtn = card.querySelector('.btn-pass-toggle');
      if (passToggleBtn && passText) {
        passToggleBtn.onclick = () => {
          showPass = !showPass;
          passText.textContent = showPass ? sub.password : '••••••••';
          passToggleBtn.textContent = showPass ? '🔒' : '👁️';
        };
      }

      // Copy WhatsApp credentials
      const copyBtn = card.querySelector('.btn-copy-wa');
      if (copyBtn) {
        copyBtn.onclick = () => {
          const msg = `🎬 *BingeFlix VIP Premium Account Activated!*\n\n👤 *Username:* ${sub.username}\n📧 *Email:* ${sub.email}\n🔑 *Password:* ${sub.password}\n📦 *Plan:* ${sub.plan}\n⏳ *Expires On:* ${expDateStr}\n🌐 *Stream Link:* ${window.location.origin}\n\n🍿 Login with your username/email and enjoy 4K Movies, Hindi Dubs & Anime!`;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(msg);
            showToast(`📋 Credentials for @${sub.username} copied!`);
          }
        };
      }

      // Extend +30 Days
      const extendBtn = card.querySelector('.btn-extend');
      if (extendBtn) {
        extendBtn.onclick = async () => {
          const currentExp = new Date(sub.expiresAt > new Date().toISOString() ? sub.expiresAt : new Date().toISOString());
          const newExp = new Date(currentExp.getTime() + 30 * 86400000).toISOString();
          await updatePaidSubscriber(sub.id, { expiresAt: newExp, status: 'active' });
          showToast(`Extended +30 days for @${sub.username}`);
          loadAndRenderAdminSubscribers();
        };
      }

      // Toggle Suspend
      const toggleBtn = card.querySelector('.btn-toggle-suspend');
      if (toggleBtn) {
        toggleBtn.onclick = async () => {
          const newStatus = sub.status === 'suspended' ? 'active' : 'suspended';
          await updatePaidSubscriber(sub.id, { status: newStatus });
          showToast(`User @${sub.username} set to ${newStatus}`);
          loadAndRenderAdminSubscribers();
        };
      }

      // Delete User
      const delBtn = card.querySelector('.btn-del');
      if (delBtn) {
        delBtn.onclick = async () => {
          if (confirm(`Are you sure you want to delete subscriber @${sub.username}?`)) {
            await deletePaidSubscriber(sub.id);
            showToast(`Deleted subscriber @${sub.username}`);
            loadAndRenderAdminSubscribers();
          }
        };
      }

      adminSubsContainer.appendChild(card);
    });
  }
}

function updateUserUI() {
  const authBtn = document.getElementById('auth-btn');
  const userChevron = document.getElementById('user-chevron');
  const userDropdown = document.getElementById('user-menu-dropdown');
  const avatarEl = document.getElementById('user-dropdown-avatar') || document.getElementById('dropdown-user-avatar');
  const nameEl = document.getElementById('user-dropdown-name') || document.getElementById('dropdown-user-name');
  const handleEl = document.getElementById('user-dropdown-handle') || document.getElementById('dropdown-user-handle');
  const emailEl = document.getElementById('user-dropdown-email') || document.getElementById('dropdown-user-email');
  const planEl = document.getElementById('user-dropdown-plan');
  const watchlistCountEl = document.getElementById('dropdown-watchlist-count');
  const historyCountEl = document.getElementById('dropdown-history-count');

  if (state.currentUser) {
    const uName = state.currentUser.username || 'user';
    const avatarKey = state.currentUser.avatar || 'goku';
    const avatarImgUrl = getAvatarUrl(avatarKey);
    const displayName = state.currentUser.displayName || state.currentUser.name || uName;

    // Show circular anime avatar in the navbar
    if (authBtn) {
      authBtn.className = 'btn-user-avatar-only';
      authBtn.setAttribute('title', `@${uName} (Profile & Options)`);
      authBtn.innerHTML = `
        <div class="nav-avatar-circle">
          <img src="${avatarImgUrl}" alt="${uName}" class="nav-avatar-img" />
        </div>
      `;
    }

    if (userChevron) userChevron.style.display = 'none';

    if (avatarEl) {
      avatarEl.innerHTML = `<img src="${avatarImgUrl}" alt="${uName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
    }
    if (nameEl) nameEl.textContent = displayName;
    if (handleEl) handleEl.textContent = `@${uName}`;
    if (emailEl) emailEl.textContent = state.currentUser.email || '';

    if (planEl) {
      if (state.currentUser.isSubscriber) {
        planEl.style.display = 'inline-block';
        planEl.textContent = `👑 VIP • ${state.currentUser.plan || 'Premium'} (${state.currentUser.daysLeft || 30}d)`;
      } else {
        planEl.style.display = 'none';
      }
    }

    if (watchlistCountEl) watchlistCountEl.textContent = state.watchlist.length;
    if (historyCountEl) historyCountEl.textContent = state.watchHistory.length;
  } else {
    // Signed out state: standard Sign In button
    if (authBtn) {
      authBtn.className = 'btn-primary-ghost';
      authBtn.removeAttribute('title');
      authBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span id="user-display-name">Sign In</span>
      `;
    }
    if (userChevron) userChevron.style.display = 'none';
    if (userDropdown) userDropdown.style.display = 'none';
  }
}


// ==========================================================================
// Language, Dubbing & Audio Guide Modal
// ==========================================================================
function setupAudioGuideModal() {
  const openBtn = document.getElementById('btn-open-audio-guide');
  const closeBtn = document.getElementById('close-audio-guide-btn');
  const gotItBtn = document.getElementById('got-it-audio-guide-btn');
  const modal = document.getElementById('audio-guide-modal');

  if (openBtn && modal) {
    openBtn.onclick = () => {
      modal.style.display = 'flex';
    };
  }

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (gotItBtn) gotItBtn.onclick = closeModal;
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }
}

// ==========================================================================
// Toast Helper
// ==========================================================================
function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}


