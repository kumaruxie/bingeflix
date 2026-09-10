// ==========================================================================
// BingeFlix - Main Application Logic (Direct Access & Multi-Server Streaming)
// ==========================================================================

import {
  INITIAL_HERO_MOVIES,
  INITIAL_BOLLYWOOD,
  INITIAL_BOLLYWOOD_TOP10,
  INITIAL_BOLLYWOOD_ACTION,
  INITIAL_BOLLYWOOD_DRAMA,
  INITIAL_BOLLYWOOD_COMEDY,
  INITIAL_BOLLYWOOD_HORROR,
  INITIAL_HOLLYWOOD,
  INITIAL_HOLLYWOOD_TOP10,
  INITIAL_HOLLYWOOD_SCIFI,
  INITIAL_HOLLYWOOD_ACTION,
  INITIAL_HOLLYWOOD_THRILLER,
  INITIAL_SERIES,
  INITIAL_SERIES_HINDI,
  INITIAL_SERIES_TOP10,
  INITIAL_SERIES_CRIME,
  INITIAL_SERIES_SCIFI,
  INITIAL_SOUTH,
  INITIAL_SOUTH_TOP10,
  INITIAL_SOUTH_ACTION,
  INITIAL_ANIME,
  INITIAL_ANIME_TONIGHT,
  INITIAL_ANIME_TOP10,
  INITIAL_ANIME_SHONEN,
  INITIAL_ANIME_PSYCHO,
  INITIAL_ANIME_ISEKAI,
  INITIAL_ANIME_SPORTS,
  INITIAL_ANIME_ROMANCE,
  INITIAL_ANIME_MOVIES,
  INITIAL_ANIME_SCIFI,
  INITIAL_ANIME_UPCOMING,
  INITIAL_KIDS,
  INITIAL_CARTOONS
} from './catalogData.js';

import { destroyNativePlayer, initNativePlayer } from './nativePlayer.js';
import {
  isSupabaseConfigured,
  signUpWithEmail,
  signInWithEmail,
  signOutSupabase,
  getActiveUser,
  onAuthStateChange,
  syncWatchlistToCloud,
  fetchWatchlistFromCloud,
  recordContinueWatchingToCloud,
  fetchContinueWatchingFromCloud,
  clearContinueWatchingInCloud,
  updateUserProfile,
  sendPasswordResetEmail,
  updateUserPassword,
  checkUsernameAvailability,
  checkEmailAvailability,
  clearAllAuthSessions
} from './supabase.js';

const TMDB_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TMDB_API_KEY) || 'df1c541385e699bbed7ffd32934162da';
const TMDB_BASE_URL = 'https://api.tmdb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p';
const TMDB_IMG_URL = IMG_BASE_URL;

// Anime Avatars Map (30+ Real Iconic Anime Character Avatars)
export const ANIME_AVATARS = {
  goku: { name: 'Son Goku', path: './avatars/goku.jpg' },
  vegeta: { name: 'Vegeta', path: './avatars/vegeta.jpg' },
  naruto: { name: 'Naruto', path: './avatars/naruto.jpg' },
  sasuke: { name: 'Sasuke', path: './avatars/sasuke.jpg' },
  kakashi: { name: 'Kakashi', path: './avatars/kakashi.jpg' },
  itachi: { name: 'Itachi', path: './avatars/itachi.jpg' },
  luffy: { name: 'Luffy', path: './avatars/luffy.jpg' },
  zoro: { name: 'Zoro', path: './avatars/zoro.jpg' },
  sanji: { name: 'Sanji', path: './avatars/sanji.jpg' },
  gojo: { name: 'Gojo', path: './avatars/gojo.jpg' },
  sukuna: { name: 'Sukuna', path: './avatars/sukuna.jpg' },
  megumi: { name: 'Megumi', path: './avatars/megumi.jpg' },
  tanjiro: { name: 'Tanjiro', path: './avatars/tanjiro.jpg' },
  nezuko: { name: 'Nezuko', path: './avatars/nezuko.jpg' },
  zenitsu: { name: 'Zenitsu', path: './avatars/zenitsu.jpg' },
  inosuke: { name: 'Inosuke', path: './avatars/inosuke.jpg' },
  levi: { name: 'Levi', path: './avatars/levi.jpg' },
  eren: { name: 'Eren', path: './avatars/eren.jpg' },
  mikasa: { name: 'Mikasa', path: './avatars/mikasa.jpg' },
  saitama: { name: 'Saitama', path: './avatars/saitama.jpg' },
  light: { name: 'Light', path: './avatars/light.jpg' },
  l: { name: 'L', path: './avatars/l.jpg' },
  killua: { name: 'Killua', path: './avatars/killua.jpg' },
  gon: { name: 'Gon', path: './avatars/gon.jpg' },
  jinwoo: { name: 'Jin-Woo', path: './avatars/jinwoo.jpg' },
  frieren: { name: 'Frieren', path: './avatars/frieren.jpg' },
  anya: { name: 'Anya', path: './avatars/anya.jpg' },
  denji: { name: 'Denji', path: './avatars/denji.jpg' },
  ichigo: { name: 'Ichigo', path: './avatars/ichigo.jpg' },
  doraemon: { name: 'Doraemon', path: './avatars/doraemon.jpg' }
};

export function getAvatarUrl(key) {
  if (ANIME_AVATARS[key]) return ANIME_AVATARS[key].path;
  if (key && (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/'))) return key;
  return ANIME_AVATARS['goku'].path;
}

let torrentStatusTimer = null;

// App State (Pre-populated with rich verified catalog for instant 0ms render)
const state = {
  trending: [...INITIAL_HERO_MOVIES],
  popular: [...INITIAL_HOLLYWOOD],
  topRated: [],
  upcoming: [],
  action: [],
  // Bollywood Tab (Deep Multi-Row Universe: 80+ Authentic Titles)
  bollywood: [...INITIAL_BOLLYWOOD],
  bollywoodTop10: [...INITIAL_BOLLYWOOD_TOP10],
  bollywoodAction: [...INITIAL_BOLLYWOOD_ACTION],
  bollywoodDrama: [...INITIAL_BOLLYWOOD_DRAMA],
  bollywoodComedy: [...INITIAL_BOLLYWOOD_COMEDY],
  bollywoodHorror: [...INITIAL_BOLLYWOOD_HORROR],
  south: [...INITIAL_SOUTH],
  southTop10: [...INITIAL_SOUTH_TOP10],
  southAction: [...INITIAL_SOUTH_ACTION],
  // Hollywood Tab (Blockbusters, Sci-Fi, Thrillers & Action: 50+ Titles)
  hollywood: [...INITIAL_HOLLYWOOD],
  hollywoodTop10: [...INITIAL_HOLLYWOOD_TOP10],
  hollywoodSciFi: [...INITIAL_HOLLYWOOD_SCIFI],
  hollywoodAction: [...INITIAL_HOLLYWOOD_ACTION],
  hollywoodThriller: [...INITIAL_HOLLYWOOD_THRILLER],
  // Anime Tab (Grand 10-Row Universe with 130+ Verified Titles)
  anime: [...INITIAL_ANIME_SHONEN],
  animeTonight: [...INITIAL_ANIME_TONIGHT],
  animeTop10: [...INITIAL_ANIME_TOP10],
  animeShonen: [...INITIAL_ANIME_SHONEN],
  animePsycho: [...INITIAL_ANIME_PSYCHO],
  animeIsekai: [...INITIAL_ANIME_ISEKAI],
  animeSports: [...INITIAL_ANIME_SPORTS],
  animeRomance: [...INITIAL_ANIME_ROMANCE],
  animeMovies: [...INITIAL_ANIME_MOVIES],
  animeScifi: [...INITIAL_ANIME_SCIFI],
  animeUpcoming: [...INITIAL_ANIME_UPCOMING],
  // Web Series Tab (Prioritizing Indian Hindi Web Series: 70+ Shows)
  series: [...INITIAL_SERIES],
  seriesHindi: [...INITIAL_SERIES_HINDI],
  seriesTop10: [...INITIAL_SERIES_TOP10],
  seriesCrime: [...INITIAL_SERIES_CRIME],
  seriesScifi: [...INITIAL_SERIES_SCIFI],
  // Kids & Family Tab
  kidsCartoons: [...INITIAL_CARTOONS],
  kidsTop10: [...INITIAL_KIDS],
  kidsHero: [...INITIAL_KIDS],
  genres: {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
    53: "Thriller", 10752: "War", 37: "Western", 10759: "Action & Adventure",
    10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
    10766: "Soap", 10767: "Talk", 10768: "War & Politics"
  },
  heroIndex: 0,
  heroTimer: null,
  activeHeroMovies: [...INITIAL_ANIME_TONIGHT, ...INITIAL_ANIME],
  watchlist: JSON.parse(localStorage.getItem('bingeflix_watchlist') || '[]'),
  watchHistory: JSON.parse(localStorage.getItem('bingeflix_watch_history') || '[]'),
  continueWatching: JSON.parse(localStorage.getItem('bingeflix_continue_watching') || '[]'),
  // Optional persistent account (Guest by default)
  currentUser: JSON.parse(localStorage.getItem('bingeflix_current_user') || 'null'),
  currentMovie: null,
  currentSeason: 1,
  currentEpisode: 1,
  activeSourceType: 'vidlink',
  currentStreamUrl: '',
  activeLibraryTab: 'watchlist',
  activeCategoryTab: 'anime',
  aspectRatio: '16-9',
  brightness: 100,
  activePlayback: null
};

// ==========================================================================
// API Fetch Helper
// ==========================================================================
async function fetchTMDB(endpoint, params = {}) {
  const queryParams = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: 'en-US',
    ...params
  });

  // 1. Try Cloudflare-routed TMDB primary endpoint (bypasses ISP blocks in India)
  try {
    const res = await fetch(`${TMDB_BASE_URL}${endpoint}?${queryParams.toString()}`);
    if (res.ok) return await res.json();
  } catch (err) {
    // 2. Fallback to secondary endpoint
    try {
      const res2 = await fetch(`${TMDB_FALLBACK_URL}${endpoint}?${queryParams.toString()}`);
      if (res2.ok) return await res2.json();
    } catch (err2) {
      console.warn(`TMDB endpoint ${endpoint} unavailable, using cached catalog`);
    }
  }
  return null;
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
// Strict Category Purity Checkers
// ==========================================================================
function isStrictAnime(item) {
  if (!item) return false;
  const isJP = (Array.isArray(item.origin_country) && item.origin_country.includes('JP')) || item.original_language === 'ja';
  const isAnim = (item.genre_ids && item.genre_ids.includes(16)) || (item.genres && item.genres.some(g => g.id === 16 || g.name === 'Animation'));
  const isCurated = item.isAnime === true && (isJP || item.original_language === 'ja' || !item.origin_country);
  return Boolean((isJP && isAnim) || isCurated);
}

function isStrictBollywood(item) {
  return item && item.original_language === 'hi';
}

function isStrictHollywood(item) {
  return item && item.original_language === 'en';
}

function isStrictSouth(item) {
  return item && ['te', 'ta', 'ml', 'kn'].includes(item.original_language);
}

function isStrictSeries(item) {
  return item && item.isTv && !(item.origin_country && item.origin_country.includes('JP'));
}

function isStrictKids(item) {
  if (!item) return false;
  if (item.isCartoon) return true;
  const hasKidsGenre = item.genre_ids && (item.genre_ids.includes(16) || item.genre_ids.includes(10751) || item.genre_ids.includes(10762));
  return Boolean(hasKidsGenre);
}

// ==========================================================================
// Multi-Stage Recommendation Pipeline & Page Assembly (Deduplicated)
// ==========================================================================
function assembleCategoryPage(catKey) {
  function dedupeTrack(items, limit = 20) {
    if (!items || !items.length) return [];
    const trackSeen = new Set();
    const res = [];
    for (const item of items) {
      if (!item || !item.id || !item.poster_path) continue;
      if (!trackSeen.has(item.id)) {
        trackSeen.add(item.id);
        res.push(item);
        if (res.length >= limit) break;
      }
    }
    return res;
  }

  if (catKey === 'anime') {
    // 1. Airing Tonight & New Releases
    const validTonight = (state.animeTonight || []).filter(isStrictAnime);
    const tonight = dedupeTrack(validTonight.length ? validTonight : INITIAL_ANIME_TONIGHT, 20);
    renderMovieTrack('anime-tonight-row', tonight);

    // 2. Top 10 Ranked Masterpieces of All Time
    const validTop10 = (state.animeTop10 || []).filter(isStrictAnime);
    const top10 = dedupeTrack(validTop10.length ? validTop10 : INITIAL_ANIME_TOP10, 10);
    renderTop10Track('anime-top10-row', top10);

    // 3. Trending Battle Shonen & Action Anime
    const validShonen = (state.animeShonen || state.anime || []).filter(isStrictAnime);
    const shonen = dedupeTrack(validShonen.length ? validShonen : INITIAL_ANIME_SHONEN, 20);
    renderMovieTrack('anime-row', shonen);

    // 4. Psychological, Mystery & Dark Fantasy
    const validPsycho = (state.animePsycho || []).filter(isStrictAnime);
    const psycho = dedupeTrack(validPsycho.length ? validPsycho : INITIAL_ANIME_PSYCHO, 20);
    renderMovieTrack('anime-psycho-row', psycho);

    // 5. Epic Isekai, Magic & Fantasy Realms
    const validIsekai = (state.animeIsekai || []).filter(isStrictAnime);
    const isekai = dedupeTrack(validIsekai.length ? validIsekai : INITIAL_ANIME_ISEKAI, 20);
    renderMovieTrack('anime-isekai-row', isekai);

    // 6. High-Adrenaline Sports & Tournaments
    const validSports = (state.animeSports || []).filter(isStrictAnime);
    const sports = dedupeTrack(validSports.length ? validSports : INITIAL_ANIME_SPORTS, 20);
    renderMovieTrack('anime-sports-row', sports);

    // 7. Romance, Comedy & Slice of Life
    const validRomance = (state.animeRomance || []).filter(isStrictAnime);
    const romance = dedupeTrack(validRomance.length ? validRomance : INITIAL_ANIME_ROMANCE, 20);
    renderMovieTrack('anime-romance-row', romance);

    // 8. Masterpiece Anime Blockbuster Movies
    const validMovies = (state.animeMovies || []).length ? state.animeMovies : INITIAL_ANIME_MOVIES;
    const movies = dedupeTrack(validMovies, 20);
    renderMovieTrack('anime-movies-row', movies);

    // 9. Cyberpunk, Mecha & Sci-Fi Epics
    const validScifi = (state.animeScifi || []).filter(isStrictAnime);
    const scifi = dedupeTrack(validScifi.length ? validScifi : INITIAL_ANIME_SCIFI, 20);
    renderMovieTrack('anime-scifi-row', scifi);

    // 10. Highly Anticipated Upcoming Premieres
    const validUpcoming = (state.animeUpcoming || []).filter(isStrictAnime);
    const upcoming = dedupeTrack(validUpcoming.length ? validUpcoming : INITIAL_ANIME_UPCOMING, 20);
    renderMovieTrack('anime-upcoming-row', upcoming);

    setHeroCategory(tonight.length ? tonight : shonen);

  } else if (catKey === 'bollywood') {
    const trending = dedupeTrack(state.bollywood.length ? state.bollywood : INITIAL_BOLLYWOOD, 25);
    renderMovieTrack('bollywood-row', trending);

    const top10 = dedupeTrack(state.bollywoodTop10.length ? state.bollywoodTop10 : INITIAL_BOLLYWOOD_TOP10, 10);
    renderTop10Track('bollywood-top10-row', top10);

    const action = dedupeTrack(state.bollywoodAction.length ? state.bollywoodAction : INITIAL_BOLLYWOOD_ACTION, 25);
    renderMovieTrack('bollywood-action-row', action);

    const drama = dedupeTrack(state.bollywoodDrama.length ? state.bollywoodDrama : INITIAL_BOLLYWOOD_DRAMA, 25);
    renderMovieTrack('bollywood-drama-row', drama);

    const comedy = dedupeTrack(state.bollywoodComedy.length ? state.bollywoodComedy : INITIAL_BOLLYWOOD_COMEDY, 25);
    renderMovieTrack('bollywood-comedy-row', comedy);

    const horror = dedupeTrack(state.bollywoodHorror.length ? state.bollywoodHorror : INITIAL_BOLLYWOOD_HORROR, 25);
    renderMovieTrack('bollywood-horror-row', horror);

    setHeroCategory(trending);

  } else if (catKey === 'hollywood') {
    const trending = dedupeTrack(state.hollywood.length ? state.hollywood : INITIAL_HOLLYWOOD, 25);
    renderMovieTrack('hollywood-row', trending);

    const top10 = dedupeTrack(state.hollywoodTop10.length ? state.hollywoodTop10 : INITIAL_HOLLYWOOD_TOP10, 10);
    renderTop10Track('hollywood-top10-row', top10);

    const scifi = dedupeTrack(state.hollywoodSciFi.length ? state.hollywoodSciFi : INITIAL_HOLLYWOOD_SCIFI, 25);
    renderMovieTrack('hollywood-scifi-row', scifi);

    const action = dedupeTrack(state.hollywoodAction.length ? state.hollywoodAction : INITIAL_HOLLYWOOD_ACTION, 25);
    renderMovieTrack('hollywood-action-row', action);

    const thriller = dedupeTrack(state.hollywoodThriller.length ? state.hollywoodThriller : INITIAL_HOLLYWOOD_THRILLER, 25);
    renderMovieTrack('hollywood-thriller-row', thriller);

    setHeroCategory(trending);

  } else if (catKey === 'series') {
    // 1. Top Indian & Hindi OTT Blockbusters (Rendered First as user requested!)
    const hindi = dedupeTrack(state.seriesHindi.length ? state.seriesHindi : INITIAL_SERIES_HINDI, 25);
    renderMovieTrack('series-hindi-row', hindi);

    // 2. Top 10 Binge-Worthy Series
    const top10 = dedupeTrack(state.seriesTop10.length ? state.seriesTop10 : INITIAL_SERIES_TOP10, 10);
    renderTop10Track('series-top10-row', top10);

    // 3. Global Trending Hits
    const trending = dedupeTrack(state.series.length ? state.series : INITIAL_SERIES, 25);
    renderMovieTrack('series-row', trending);

    // 4. Crime & Mystery Series
    const crime = dedupeTrack(state.seriesCrime.length ? state.seriesCrime : INITIAL_SERIES_CRIME, 25);
    renderMovieTrack('series-crime-row', crime);

    // 5. Sci-Fi, Fantasy & Thriller Sagas
    const scifi = dedupeTrack(state.seriesScifi.length ? state.seriesScifi : INITIAL_SERIES_SCIFI, 25);
    renderMovieTrack('series-scifi-row', scifi);

    setHeroCategory(hindi.length ? hindi : trending);

  } else if (catKey === 'south') {
    const trending = dedupeTrack(state.south.length ? state.south : INITIAL_SOUTH, 25);
    renderMovieTrack('south-row', trending);

    const top10 = dedupeTrack(state.southTop10.length ? state.southTop10 : INITIAL_SOUTH_TOP10, 10);
    renderTop10Track('south-top10-row', top10);

    const action = dedupeTrack(state.southAction.length ? state.southAction : INITIAL_SOUTH_ACTION, 25);
    renderMovieTrack('south-action-row', action);

    setHeroCategory(trending);

  } else if (catKey === 'kids') {
    const toons = dedupeTrack(state.kidsCartoons.length ? state.kidsCartoons : INITIAL_CARTOONS, 25);
    renderMovieTrack('kids-cartoons-row', toons);

    const top10 = dedupeTrack(state.kidsTop10.length ? state.kidsTop10 : INITIAL_KIDS, 10);
    renderTop10Track('kids-top10-row', top10);

    const hero = dedupeTrack(state.kidsHero.length ? state.kidsHero : INITIAL_KIDS, 25);
    renderMovieTrack('kids-hero-row', hero);

    setHeroCategory(toons);

  } else if (['action', 'comedy', 'scifi', 'thriller', 'horror'].includes(catKey)) {
    const genreMap = {
      action: { id: 28, title: 'Action', emoji: '💥' },
      comedy: { id: 35, title: 'Comedy', emoji: '😂' },
      scifi: { id: 878, title: 'Sci-Fi & Fantasy', emoji: '🚀' },
      thriller: { id: 53, title: 'Thriller & Suspense', emoji: '🕵️' },
      horror: { id: 27, title: 'Horror & Paranormal', emoji: '👻' }
    };
    const gInfo = genreMap[catKey];
    if (gInfo) {
      const gTitleTrend = document.getElementById('genre-title-trending');
      if (gTitleTrend) gTitleTrend.textContent = `${gInfo.emoji} Trending ${gInfo.title}`;
      const gSubTrend = document.getElementById('genre-subtitle-trending');
      if (gSubTrend) gSubTrend.textContent = `Most popular ${gInfo.title.toLowerCase()} titles streaming right now`;
      const gTitleTop = document.getElementById('genre-title-top10');
      if (gTitleTop) gTitleTop.textContent = `🏆 Top 10 Highest Rated ${gInfo.title}`;
      const gSubTop = document.getElementById('genre-subtitle-top10');
      if (gSubTop) gSubTop.textContent = `Acclaimed masterpieces with unbroken viewer ratings`;
      const gTitlePop = document.getElementById('genre-title-popular');
      if (gTitlePop) gTitlePop.textContent = `🍿 Crowd Favorite ${gInfo.title}`;
      const gSubPop = document.getElementById('genre-subtitle-popular');
      if (gSubPop) gSubPop.textContent = `Exciting and replayable ${gInfo.title.toLowerCase()} hits`;

      loadGenreCatalog(gInfo.id, gInfo.title);
    }
  }
}

async function loadGenreCatalog(genreId, genreName) {
  const [trendingData, topRatedData, popularData] = await Promise.all([
    fetchTMDB('/discover/movie', { with_genres: genreId, sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/movie', { with_genres: genreId, sort_by: 'vote_average.desc', 'vote_count.gte': '1000' }),
    fetchTMDB('/discover/movie', { with_genres: genreId, sort_by: 'revenue.desc' })
  ]);

  const seenIds = new Set();
  function dedupe(list, limit = 20) {
    const res = [];
    (list || []).forEach(m => {
      if (m && m.id && m.poster_path && !seenIds.has(m.id)) {
        seenIds.add(m.id);
        res.push(m);
      }
    });
    return res.slice(0, limit);
  }

  const trending = dedupe(trendingData?.results || []);
  const top10 = dedupe(topRatedData?.results || [], 10);
  const popular = dedupe(popularData?.results || []);

  renderMovieTrack('genre-trending-row', trending);
  renderTop10Track('genre-top10-row', top10);
  renderMovieTrack('genre-popular-row', popular);

  if (trending.length) {
    setHeroCategory(trending);
  }
}

// ==========================================================================
// App Initialization & URL Hash Routing
// ==========================================================================
function renderInitialCatalog() {
  initHeroSpotlight();
  assembleCategoryPage(state.activeCategoryTab || 'anime');
}

function startApp() {
  // 1. Instantly render Hero Spotlight and verified movie rows (0ms delay)
  try {
    renderInitialCatalog();
  } catch (e) {
    console.error('renderInitialCatalog error:', e);
  }

  // 2. Setup navigation, listeners and auth safely
  try { setupNavbar(); } catch (e) { console.error('setupNavbar error:', e); }
  try { setupEventListeners(); } catch (e) { console.error('setupEventListeners error:', e); }
  try { setupAuthSystem(); } catch (e) { console.error('setupAuthSystem error:', e); }
  try { setupProfileSettingsSystem(); } catch (e) { console.error('setupProfileSettingsSystem error:', e); }
  try { setupAudioGuideModal(); } catch (e) { console.error('setupAudioGuideModal error:', e); }
  try { updateWatchlistBadge(); } catch (e) { console.error('updateWatchlistBadge error:', e); }
  try { updateUserUI(); } catch (e) { console.error('updateUserUI error:', e); }
  try { renderHistoryRow(); } catch (e) { console.error('renderHistoryRow error:', e); }
  try { renderContinueWatchingRow(); } catch (e) { console.error('renderContinueWatchingRow error:', e); }

  // 3. Immediately check initial hash route on load / refresh (F5 persistence)
  if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#home' && window.location.hash !== '#anime') {
    handleHashRouting();
  }

  // 4. Listen to Supabase Cloud Auth & Session Recovery in background
  try {
    getActiveUser().then(user => {
      if (user) {
        state.currentUser = user;
        updateUserUI();
        fetchWatchlistFromCloud(user.id).then(list => {
          if (list && list.length > 0) {
            state.watchlist = list;
            updateWatchlistBadge();
          }
        });
        fetchContinueWatchingFromCloud(user.id).then(list => {
          if (list && list.length > 0) {
            state.continueWatching = list;
            renderContinueWatchingRow();
          }
        });
      }
    }).catch(() => { });

    onAuthStateChange((user, event) => {
      state.currentUser = user;
      updateUserUI();
      if (event === 'PASSWORD_RECOVERY') {
        state.isPasswordRecovery = true;
        openAuthModal('reset');
        showToast('🔑 Password recovery verified. Enter your new password below.');
      }
      if (user) {
        fetchWatchlistFromCloud(user.id).then(list => {
          if (list && list.length > 0) {
            state.watchlist = list;
            updateWatchlistBadge();
          }
        });
        fetchContinueWatchingFromCloud(user.id).then(list => {
          if (list && list.length > 0) {
            state.continueWatching = list;
            renderContinueWatchingRow();
          }
        });
      }
    });
  } catch (err) {
    console.warn('[Supabase] Auth listener notice:', err);
  }
  if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#home' && window.location.hash !== '#anime') {
    handleHashRouting();
  }

  // 1. Fetch live TMDB updates asynchronously in the background
  loadGenres();
  loadAllSections().then(() => {
    const isWatchRoute = window.location.hash && window.location.hash.startsWith('#watch/');
    if (isWatchRoute) {
      // User is already watching, keep player view open undisturbed!
      return;
    }
    if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#home' && window.location.hash !== '#anime') {
      handleHashRouting();
    } else {
      assembleCategoryPage(state.activeCategoryTab || 'anime');
    }
  }).catch(e => console.warn('TMDB live catalog sync notice:', e));

  // Listen for browser Back/Forward navigation
  window.addEventListener('hashchange', handleHashRouting);

  // Playback Progress Listener (VidLink postMessage Engine)
  window.addEventListener('message', (event) => {
    try {
      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { }
      }
      if (!data) return;

      if (data.type === 'PLAYER_EVENT' && data.data && state.activePlayback) {
        const { currentTime, duration } = data.data;
        if (currentTime !== undefined && currentTime >= 0) {
          state.activePlayback.currentTime = Math.round(currentTime);
          if (duration && duration > 0) state.activePlayback.duration = Math.round(duration);
          savePlaybackProgress(state.activePlayback);
        }
      }
    } catch (err) { }
  });

  // Active Playback Interval Tracker (fallback for external embeds)
  setInterval(() => {
    const playerView = document.getElementById('player-view');
    if (!playerView || playerView.style.display === 'none') return;
    if (!state.activePlayback || !state.activePlayback.id) return;

    // Advance playback progress if player view is actively open
    state.activePlayback.currentTime = (state.activePlayback.currentTime || 0) + 3;
    if (!state.activePlayback.duration) {
      state.activePlayback.duration = state.activePlayback.isTv ? 1440 : 6000;
    }
    savePlaybackProgress(state.activePlayback);
  }, 3000);

  // Flush progress before tab closes / reloads
  window.addEventListener('beforeunload', () => {
    if (state.activePlayback) {
      savePlaybackProgress(state.activePlayback, true);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// Handle URL Hash Routing for F5 Refresh Persistence and Deep-Linking
function handleHashRouting() {
  const hash = window.location.hash || '';
  if (!hash || hash === '#' || hash === '#home' || hash === '#all' || hash === '#anime') {
    switchView('anime', false);
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
  const validCategories = ['anime', 'bollywood', 'hollywood', 'series', 'south', 'kids', 'action', 'comedy', 'scifi', 'thriller', 'horror', 'watchlist'];
  if (validCategories.includes(category)) {
    switchView(category, false);
  } else {
    switchView('anime', false);
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
    switchView('anime');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('back-to-browse').addEventListener('click', () => {
    stopVideoPlayback();
    switchView(state.activeCategoryTab || 'anime');
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

  const validTabs = ['anime', 'bollywood', 'hollywood', 'series', 'south', 'kids', 'action', 'comedy', 'scifi', 'thriller', 'horror'];
  const catKey = validTabs.includes(viewName) ? viewName : (viewName === 'watchlist' || viewName === 'player' ? viewName : 'anime');

  // Update active navbar & drawer buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === catKey);
  });
  document.querySelectorAll('.drawer-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === catKey);
  });

  if (updateHash) {
    if (viewName === 'anime' || viewName === 'home') {
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
    // Browse / Catalog Tabs
    stopVideoPlayback();
    playerView.style.display = 'none';
    watchlistView.style.display = 'none';
    browseView.style.display = 'block';
    renderHistoryRow();

    state.activeCategoryTab = catKey;

    // Toggle dedicated Tab Catalogs
    document.querySelectorAll('.tab-catalog').forEach(el => el.style.display = 'none');

    const isGenreTab = ['action', 'comedy', 'scifi', 'thriller', 'horror'].includes(catKey);
    const targetCatalog = document.getElementById(isGenreTab ? 'tab-catalog-genre' : `tab-catalog-${catKey}`);
    if (targetCatalog) {
      targetCatalog.style.display = 'block';
    }

    // Sync Genre Pills active state
    document.querySelectorAll('.genre-pill').forEach(pill => {
      const cat = pill.dataset.category || pill.dataset.filter;
      pill.classList.toggle('active', cat === catKey);
    });

    // Run multi-stage pipeline & assemble page with deduplication
    assembleCategoryPage(catKey);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ==========================================================================
// Data Fetching & Organization
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
    // Bollywood
    bollywoodData,
    bollywoodTop10Data,
    bollywoodActionData,
    bollywoodDramaData,
    bollywoodComedyData,
    // Hollywood
    hollywoodData,
    hollywoodTop10Data,
    hollywoodSciFiData,
    // South Cinema
    southData,
    // Web Series (strictly without anime)
    seriesData,
    seriesTop10Data,
    seriesCrimeData,
    // Anime (STRICT Japanese Anime: Genre 16 & Origin JP)
    animeData,
    animeTonightData,
    animeTop10Data,
    // Kids
    kidsData
  ] = await Promise.all([
    // Bollywood
    fetchTMDB('/discover/movie', { with_original_language: 'hi', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/movie', { with_original_language: 'hi', sort_by: 'vote_average.desc', 'vote_count.gte': '150' }),
    fetchTMDB('/discover/movie', { with_original_language: 'hi', with_genres: '28,80', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/movie', { with_original_language: 'hi', with_genres: '18', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/movie', { with_original_language: 'hi', with_genres: '35', sort_by: 'popularity.desc' }),
    // Hollywood
    fetchTMDB('/discover/movie', { with_original_language: 'en', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/movie', { with_original_language: 'en', sort_by: 'vote_average.desc', 'vote_count.gte': '2500' }),
    fetchTMDB('/discover/movie', { with_genres: '878,14', sort_by: 'popularity.desc' }),
    // South
    fetchTMDB('/discover/movie', { with_original_language: 'te|ta|ml|kn', sort_by: 'popularity.desc' }),
    // Web Series
    fetchTMDB('/discover/tv', { without_genres: '16', without_origin_country: 'JP', with_genres: '18,10765,80', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/tv', { without_genres: '16', without_origin_country: 'JP', sort_by: 'vote_average.desc', 'vote_count.gte': '500' }),
    fetchTMDB('/discover/tv', { without_genres: '16', without_origin_country: 'JP', with_genres: '80,9648', sort_by: 'popularity.desc' }),
    // Anime - 100% Japanese Anime only (Never general TV broadcast)
    fetchTMDB('/discover/tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/tv', { with_genres: '16', with_original_language: 'ja', 'first_air_date.gte': '2023-01-01', 'vote_count.gte': '150', 'vote_average.gte': '7.2', sort_by: 'popularity.desc' }),
    fetchTMDB('/discover/tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'vote_average.desc', 'vote_count.gte': '200' }),
    // Kids
    fetchTMDB('/discover/movie', { with_genres: '16,10751', sort_by: 'popularity.desc' })
  ]);

  // Tab 1: Anime Universe (Strict Filtering)
  if (animeTonightData && animeTonightData.results && animeTonightData.results.length > 0) {
    const filteredTonight = animeTonightData.results
      .filter(it => isStrictAnime(it) && it.poster_path && it.backdrop_path && (it.vote_count || 0) >= 100 && (it.vote_average || 0) >= 7.0 && !it.adult)
      .map(item => ({ ...item, isTv: true, isAnime: true }));
    const merged = [...INITIAL_ANIME_TONIGHT.filter(isStrictAnime)];
    filteredTonight.forEach(it => {
      if (!merged.some(m => m.id === it.id)) merged.push(it);
    });
    state.animeTonight = merged;
  } else {
    state.animeTonight = [...INITIAL_ANIME_TONIGHT];
  }
  if (animeTop10Data && animeTop10Data.results) {
    const filteredTop10 = animeTop10Data.results
      .filter(isStrictAnime)
      .map(item => ({ ...item, isTv: true, isAnime: true }));
    const merged = [...INITIAL_ANIME_TOP10.filter(isStrictAnime)];
    filteredTop10.forEach(it => {
      if (!merged.some(m => m.id === it.id)) merged.push(it);
    });
    state.animeTop10 = merged;
  }
  if (animeData && animeData.results) {
    const filtered = animeData.results
      .filter(isStrictAnime)
      .map(item => ({ ...item, isTv: true, isAnime: true }));
    state.anime = filtered;
    state.animeUpcoming = filtered.slice(6);
  }

  // Tab 2: Bollywood & Hindi (Strict Hindi & Merged with Master Catalog)
  if (bollywoodData && bollywoodData.results) {
    const fresh = bollywoodData.results.filter(isStrictBollywood);
    const merged = [...INITIAL_BOLLYWOOD];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.bollywood = merged;
  }
  if (bollywoodTop10Data && bollywoodTop10Data.results) {
    const fresh = bollywoodTop10Data.results.filter(isStrictBollywood);
    const merged = [...INITIAL_BOLLYWOOD_TOP10];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.bollywoodTop10 = merged;
  }
  if (bollywoodActionData && bollywoodActionData.results) {
    const fresh = bollywoodActionData.results.filter(isStrictBollywood);
    const merged = [...INITIAL_BOLLYWOOD_ACTION];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.bollywoodAction = merged;
  }
  if (bollywoodDramaData && bollywoodDramaData.results) {
    const fresh = bollywoodDramaData.results.filter(isStrictBollywood);
    const merged = [...INITIAL_BOLLYWOOD_DRAMA];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.bollywoodDrama = merged;
  }
  if (bollywoodComedyData && bollywoodComedyData.results) {
    const fresh = bollywoodComedyData.results.filter(isStrictBollywood);
    const merged = [...INITIAL_BOLLYWOOD_COMEDY];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.bollywoodComedy = merged;
  }

  // Tab 3: Hollywood (Strict English & Merged with Master Catalog)
  if (hollywoodData && hollywoodData.results) {
    let hwList = hollywoodData.results.filter(isStrictHollywood);
    const merged = [...INITIAL_HOLLYWOOD];
    hwList.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.hollywood = merged;
  }
  if (hollywoodTop10Data && hollywoodTop10Data.results) {
    const fresh = hollywoodTop10Data.results.filter(isStrictHollywood);
    const merged = [...INITIAL_HOLLYWOOD_TOP10];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.hollywoodTop10 = merged;
  }
  if (hollywoodSciFiData && hollywoodSciFiData.results) {
    const fresh = hollywoodSciFiData.results.filter(isStrictHollywood);
    const merged = [...INITIAL_HOLLYWOOD_SCIFI];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.hollywoodSciFi = merged;
  }

  // Tab 4: Web Series (Excluding Anime, Preserving Hindi Originals)
  if (seriesData && seriesData.results) {
    const fresh = seriesData.results.filter(isStrictSeries).map(item => ({ ...item, isTv: true }));
    const merged = [...INITIAL_SERIES];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.series = merged;
  }
  if (seriesTop10Data && seriesTop10Data.results) {
    const fresh = seriesTop10Data.results.filter(isStrictSeries).map(item => ({ ...item, isTv: true }));
    const merged = [...INITIAL_SERIES_TOP10];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.seriesTop10 = merged;
  }
  if (seriesCrimeData && seriesCrimeData.results) {
    const fresh = seriesCrimeData.results.filter(isStrictSeries).map(item => ({ ...item, isTv: true }));
    const merged = [...INITIAL_SERIES_CRIME];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.seriesCrime = merged;
  }

  // Tab 5: South Cinema
  if (southData && southData.results) {
    const fresh = southData.results.filter(isStrictSouth);
    const merged = [...INITIAL_SOUTH];
    fresh.forEach(it => { if (!merged.some(m => m.id === it.id)) merged.push(it); });
    state.south = merged;
    state.southTop10 = [...INITIAL_SOUTH_TOP10];
    state.southAction = [...INITIAL_SOUTH_ACTION];
  }

  // Tab 6: Kids & Family
  if (kidsData && kidsData.results) {
    const filteredKids = kidsData.results.filter(isStrictKids);
    const merged = [...INITIAL_CARTOONS];
    filteredKids.forEach(k => {
      if (!merged.some(m => m.id === k.id)) merged.push(k);
    });
    state.kidsCartoons = merged;
    state.kidsTop10 = [...INITIAL_KIDS];
    state.kidsHero = merged.slice(2);
  }

  // Assemble active page with fresh deduplicated items
  assembleCategoryPage(state.activeCategoryTab || 'anime');
}

// ==========================================================================
// Hero Spotlight (Scrollable)
// ==========================================================================
function setHeroCategory(movies) {
  if (movies && movies.length) {
    state.activeHeroMovies = movies;
    state.heroIndex = 0;
    initHeroSpotlight();
  }
}

function initHeroSpotlight() {
  const heroList = (state.activeHeroMovies && state.activeHeroMovies.length) ? state.activeHeroMovies : state.trending;
  if (!heroList.length) return;

  const indicators = document.getElementById('hero-indicators');
  indicators.innerHTML = '';
  const maxSlides = Math.min(5, heroList.length);

  for (let i = 0; i < maxSlides; i++) {
    const dot = document.createElement('div');
    dot.className = `indicator-dot ${i === 0 ? 'active' : ''}`;
    dot.title = `Spotlight Slide ${i + 1}`;
    dot.addEventListener('click', () => {
      setHeroSlide(i);
      resetHeroTimer();
    });
    indicators.appendChild(dot);
  }

  setHeroSlide(0);
  startHeroTimer();

  const spotlightSection = document.getElementById('hero-spotlight');
  if (spotlightSection) {
    spotlightSection.onmouseenter = () => clearInterval(state.heroTimer);
    spotlightSection.onmouseleave = () => resetHeroTimer();
  }

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
  const heroList = (state.activeHeroMovies && state.activeHeroMovies.length) ? state.activeHeroMovies : state.trending;
  state.heroIndex = index;
  const movie = heroList[index];
  if (!movie) return;

  const heroBackdrop = document.getElementById('hero-backdrop');
  const backdropUrl = movie.backdrop_path
    ? `${IMG_BASE_URL}/original${movie.backdrop_path}`
    : `${IMG_BASE_URL}/original${movie.poster_path}`;

  // Smooth Crossfade with Preload
  if (heroBackdrop) {
    heroBackdrop.style.opacity = '0.35';
    const tempImg = new Image();
    tempImg.onload = () => {
      heroBackdrop.style.backgroundImage = `url('${backdropUrl}')`;
      heroBackdrop.style.opacity = '1';
    };
    tempImg.src = backdropUrl;
  }

  document.getElementById('hero-title').textContent = movie.title || movie.name;
  document.getElementById('hero-overview').textContent = movie.overview || 'No overview available.';
  document.getElementById('hero-rating').textContent = `★ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}`;
  document.getElementById('hero-year').textContent = (movie.release_date || movie.first_air_date || '').split('-')[0] || '2026';

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
  if (!btn) return;
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
      Watchlist
    `;
  }
}

function startHeroTimer() {
  clearInterval(state.heroTimer);
  state.heroTimer = setInterval(() => {
    const heroList = (state.activeHeroMovies && state.activeHeroMovies.length) ? state.activeHeroMovies : state.trending;
    const maxSlides = Math.min(5, heroList.length);
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

  (movies || []).forEach(movie => {
    if (!movie.poster_path) return;
    const card = createMovieCard(movie);
    track.appendChild(card);
  });
}

function renderTop10Track(containerId, movies) {
  const track = document.getElementById(containerId);
  if (!track) return;
  track.innerHTML = '';

  const top10 = (movies || []).slice(0, 10);
  top10.forEach((movie, index) => {
    if (!movie.poster_path) return;
    const rank = index + 1;
    const wrapper = document.createElement('div');
    wrapper.className = 'top10-card-wrapper';

    const rankNumber = document.createElement('div');
    rankNumber.className = 'top10-rank-number';
    rankNumber.textContent = rank;

    const card = createMovieCard(movie);
    wrapper.appendChild(rankNumber);
    wrapper.appendChild(card);
    track.appendChild(wrapper);
  });
}

function createMovieCard(movie, isHistory = false) {
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
  const isAnimeItem = Boolean(movie.isAnime || isStrictAnime(movie));
  let animeBadgesHtml = '';
  if (isAnimeItem) {
    animeBadgesHtml = `
      <div class="anime-corner-badges">
        <span class="anime-badge-sub" title="Japanese Audio with English Subtitles">SUB</span>
        <span class="anime-badge-dub" title="English / Hindi Dubbed Available">DUB</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card-poster-wrapper">
      ${isHistory ? `<button class="card-btn-delete-history" title="Delete from History" data-movie-id="${movie.id}">✕</button>` : ''}
      <img class="card-poster" src="${posterUrl}" alt="${title}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&q=80';" />
      <span class="card-rating-tag">★ ${rating}</span>
      ${animeBadgesHtml}
      <div class="card-overlay">
        <div class="card-actions">
          <button class="card-btn card-btn-play" title="Play">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          </button>
          <button class="card-btn card-btn-watchlist ${inWatchlist ? 'active' : ''}" title="${inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}">
            ${inWatchlist ? '✓' : '+'}
          </button>
        </div>
        <div class="card-title">${title}</div>
        <div class="card-year">${year}</div>
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
// Genre & Category Filter Pills (Anime First, Bollywood, Hollywood, Series, South, Kids, Genres)
// ==========================================================================
document.querySelectorAll('.genre-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const cat = pill.dataset.category || pill.dataset.filter;
    if (cat) {
      switchView(cat);
    }
  });
});

// ==========================================================================
// Intelligent Typo-Tolerant Search Engine with Rich Media Badges
// ==========================================================================
const COMMON_SEARCH_TYPOS = {
  // Anime typos & shortcuts
  'naroto': 'Naruto',
  'narutto': 'Naruto',
  'boroto': 'Boruto',
  'one peace': 'One Piece',
  'onepeice': 'One Piece',
  'onepece': 'One Piece',
  'one peice': 'One Piece',
  'lufy': 'One Piece',
  'jujutso': 'Jujutsu Kaisen',
  'jujutsu': 'Jujutsu Kaisen',
  'jjk': 'Jujutsu Kaisen',
  'sukuna': 'Jujutsu Kaisen',
  'gojo': 'Jujutsu Kaisen',
  'demonslayer': 'Demon Slayer',
  'demon slayer': 'Demon Slayer: Kimetsu no Yaiba',
  'kimetsu': 'Demon Slayer: Kimetsu no Yaiba',
  'tanjiro': 'Demon Slayer: Kimetsu no Yaiba',
  'sololeveling': 'Solo Leveling',
  'solo leveling': 'Solo Leveling',
  'jinwoo': 'Solo Leveling',
  'bleech': 'Bleach',
  'deathnote': 'Death Note',
  'death note': 'Death Note',
  'attack on titan': 'Attack on Titan',
  'aot': 'Attack on Titan',
  'shingeki': 'Attack on Titan',
  'chainsaw': 'Chainsaw Man',
  'chainsawman': 'Chainsaw Man',
  'dragonball': 'Dragon Ball',
  'dragon ball': 'Dragon Ball Z',
  'dbz': 'Dragon Ball Z',
  'dbs': 'Dragon Ball Super',
  'tokyoghoul': 'Tokyo Ghoul',
  'tokyogoul': 'Tokyo Ghoul',
  'hunter x hunter': 'Hunter x Hunter',
  'hxh': 'Hunter x Hunter',
  'my hero': 'My Hero Academia',
  'mha': 'My Hero Academia',
  'boku no hero': 'My Hero Academia',
  'vinland': 'Vinland Saga',
  'haiku': 'Haikyu!!',
  'haikyu': 'Haikyu!!',
  'dr stone': 'Dr. STONE',
  'drstone': 'Dr. STONE',
  'spy family': 'SPY x FAMILY',
  'spyxfamily': 'SPY x FAMILY',
  'pokemon': 'Pokémon',
  'pokimon': 'Pokémon',
  'doremon': 'Doraemon',
  'doraemon': 'Doraemon',
  'shinchan': 'Shin-chan',
  'shin chan': 'Shin-chan',

  // Hollywood Movies & TV Typos
  'avengrs': 'The Avengers',
  'avenger': 'The Avengers',
  'avengers end game': 'Avengers: Endgame',
  'endgame': 'Avengers: Endgame',
  'infinity war': 'Avengers: Infinity War',
  'spiderman': 'Spider-Man',
  'spider man': 'Spider-Man',
  'batman': 'The Batman',
  'dark knight': 'The Dark Knight',
  'ironman': 'Iron Man',
  'iron man': 'Iron Man',
  'interstelar': 'Interstellar',
  'oppenhiemer': 'Oppenheimer',
  'oppenhimr': 'Oppenheimer',
  'openheimer': 'Oppenheimer',
  'inceptoin': 'Inception',
  'inseptoin': 'Inception',
  'avatar': 'Avatar',
  'stranger things': 'Stranger Things',
  'strangerthings': 'Stranger Things',
  'deadpool': 'Deadpool',
  'dedpool': 'Deadpool',
  'wolverine': 'Deadpool & Wolverine',
  'gladiator': 'Gladiator',
  'dune': 'Dune: Part Two',
  'fast and furious': 'Fast & Furious',
  'fast & furious': 'Fast & Furious',
  'godzilla': 'Godzilla x Kong: The New Empire',

  // Indian / Bollywood Cinema Typos
  'pushpa': 'Pushpa',
  'pushpa 2': 'Pushpa 2: The Rule',
  'kgf': 'K.G.F: Chapter 1',
  'kgf 2': 'K.G.F: Chapter 2',
  'bahubali': 'Baahubali: The Beginning',
  'baahubali': 'Baahubali: The Beginning',
  'kalki': 'Kalki 2898-AD',
  'stree 2': 'Stree 2',
  'stree': 'Stree',
  'jawan': 'Jawan',
  'pathaan': 'Pathaan',
  'animal': 'Animal',
  'sholay': 'Sholay',
  'dangal': 'Dangal',
  '3 idiots': '3 Idiots',

  // Krishnavataram / Indian Mythological Variations
  'krishnavtaram': 'Krishnavataram',
  'krishnavatar': 'Krishnavataram',
  'krishnaavatar': 'Krishnavataram',
  'krishna avataram': 'Krishnavataram',
  'sri krishnavtaram': 'Sri Krishnavataram',
  'paramavatar': 'Paramavatar Shri Krishna',
  'paramavtar': 'Paramavatar Shri Krishna'
};

function resolveSearchQuery(rawQuery) {
  const cleaned = rawQuery.trim();
  const lower = cleaned.toLowerCase();

  // 1. Exact match in typo dictionary
  if (COMMON_SEARCH_TYPOS[lower]) {
    return { query: COMMON_SEARCH_TYPOS[lower], corrected: true, original: rawQuery };
  }

  // 2. Substring check for multi-word queries
  let correctedStr = cleaned;
  let didCorrect = false;
  for (const [typo, fix] of Object.entries(COMMON_SEARCH_TYPOS)) {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    if (regex.test(correctedStr)) {
      correctedStr = correctedStr.replace(regex, fix);
      didCorrect = true;
    }
  }

  if (didCorrect) {
    return { query: correctedStr, corrected: true, original: rawQuery };
  }

  return { query: cleaned, corrected: false, original: rawQuery };
}

// ==========================================================================
// IMDb Search Converter & Series Episode Arranger
// Converts phonetic queries / typos into official IMDb titles and arranges them
// ==========================================================================
async function searchIMDbConverter(rawQuery) {
  const clean = rawQuery.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (!clean || clean.length < 2) return [];

  try {
    const prefix = clean[0];
    const url = `https://v3.sg.media-imdb.com/suggestion/${prefix}/${encodeURIComponent(clean)}.json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.d)) return [];

    const titleItems = data.d.filter(item => item && item.id && item.id.startsWith('tt'));
    if (titleItems.length === 0) return [];

    // Convert top IMDb items into rich TMDB / catalog records
    const convertedPromises = titleItems.slice(0, 6).map(async (item) => {
      const imdbId = item.id;
      const isTv = item.qid === 'tvSeries' || item.q === 'TV series' || item.q === 'tv series';
      const poster = item.i ? item.i.imageUrl : null;
      const year = item.y ? String(item.y) : '';

      // 1. Try finding TMDB record by IMDb ID
      try {
        const findData = await fetchTMDB(`/find/${imdbId}`, { external_source: 'imdb_id' });
        if (findData) {
          const mRes = (findData.movie_results || []).map(m => ({ ...m, isTv: false, imdb_id: imdbId }));
          const tRes = (findData.tv_results || []).map(t => ({ ...t, isTv: true, imdb_id: imdbId }));
          if (mRes.length > 0 || tRes.length > 0) {
            return [...mRes, ...tRes];
          }
        }
      } catch (e) {}

      // 2. Fallback: Search TMDB by IMDb Title
      try {
        const titleClean = (item.l || '').replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
        const searchEndpoint = isTv ? '/search/tv' : '/search/movie';
        const sData = await fetchTMDB(searchEndpoint, { query: titleClean });
        if (sData && sData.results && sData.results.length > 0) {
          const match = sData.results[0];
          return [{
            ...match,
            isTv,
            imdb_id: imdbId,
            poster_path: match.poster_path || poster
          }];
        }
      } catch (e) {}

      // 3. Guaranteed rich fallback with IMDb metadata
      return [{
        id: imdbId,
        imdb_id: imdbId,
        title: item.l,
        name: item.l,
        poster_path: poster,
        release_date: year,
        first_air_date: year,
        isTv,
        vote_average: 8.0,
        overview: item.s ? `Starring: ${item.s}` : 'Streaming in full HD with multi-audio.'
      }];
    });

    const nested = await Promise.all(convertedPromises);
    return nested.flat().filter(Boolean);
  } catch (err) {
    console.warn('IMDb suggestions converter error:', err);
    return [];
  }
}

async function resolveShowImdbId(title) {
  if (!title) return null;
  try {
    const formatted = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!formatted) return null;
    const url = `https://v3.sg.media-imdb.com/suggestion/${formatted[0]}/${encodeURIComponent(formatted)}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.d)) return null;

    const tvMatch = data.d.find(i => i && i.id && i.id.startsWith('tt') && (i.qid === 'tvSeries' || i.q === 'TV series' || i.q === 'tv series'));
    if (tvMatch) return tvMatch.id;
    const anyTitle = data.d.find(i => i && i.id && i.id.startsWith('tt'));
    return anyTitle ? anyTitle.id : null;
  } catch (e) {
    return null;
  }
}

async function fetchIMDbSeriesEpisodes(imdbId) {
  if (!imdbId || !String(imdbId).startsWith('tt')) return null;
  try {
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${imdbId}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.meta || !Array.isArray(data.meta.videos) || data.meta.videos.length === 0) {
      return null;
    }
    return data.meta.videos;
  } catch (err) {
    console.warn('Cinemeta IMDb episodes fetch error:', err);
    return null;
  }
}

function arrangeImdbEpisodes(rawVideos) {
  if (!Array.isArray(rawVideos) || rawVideos.length === 0) return null;
  const seasonsMap = {};

  const s1Videos = rawVideos.filter(v => (v.season === 1 || !v.season));
  const startsWithZero = s1Videos.length > 0 && s1Videos[0].number === 0;

  rawVideos.forEach((v) => {
    const sNum = (typeof v.season === 'number' && v.season > 0) ? v.season : 1;
    if (!seasonsMap[sNum]) seasonsMap[sNum] = [];

    const countInSeason = seasonsMap[sNum].length;
    let epNum;
    if (startsWithZero && sNum === 1) {
      epNum = (typeof v.number === 'number') ? (v.number + 1) : (countInSeason + 1);
    } else if (typeof v.number === 'number' && v.number > 0) {
      epNum = v.number;
    } else {
      epNum = countInSeason + 1;
    }

    const isGeneric = !v.name || /^Episode #\d+\.\d+$/i.test(v.name);
    const epTitle = isGeneric ? `Episode ${epNum}` : v.name;

    seasonsMap[sNum].push({
      id: v.id || `imdb_${sNum}_${epNum}`,
      episode_number: epNum,
      relative_number: epNum,
      season_number: sNum,
      name: epTitle,
      air_date: v.firstAired ? v.firstAired.split('T')[0] : '',
      overview: v.overview || '',
      vote_average: parseFloat(v.rating) || 8.0,
      still_path: v.thumbnail || null,
      imdb_id: v.imdb_id || v.id
    });
  });

  return seasonsMap;
}

const searchInput = document.getElementById('search-input');
const searchDropdown = document.getElementById('search-dropdown');
const searchClear = document.getElementById('search-clear');
let searchDebounceTimer;

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const firstResult = searchDropdown.querySelector('.search-result-item');
    if (firstResult) {
      firstResult.click();
    }
  }
});

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  searchClear.style.display = query ? 'block' : 'none';

  clearTimeout(searchDebounceTimer);
  if (!query) {
    searchDropdown.style.display = 'none';
    return;
  }

  searchDebounceTimer = setTimeout(async () => {
    const resolved = resolveSearchQuery(query);
    const searchQuery = resolved.query;
    const trimmedQuery = query.trim();

    let combined = [];

    // Direct lookup by IMDb ID (e.g. tt1375666)
    if (/^tt\d+$/i.test(trimmedQuery)) {
      try {
        const findData = await fetchTMDB(`/find/${trimmedQuery}`, { external_source: 'imdb_id' });
        if (findData) {
          const foundMovies = (findData.movie_results || []).map(m => ({ ...m, isTv: false, imdb_id: trimmedQuery }));
          const foundTv = (findData.tv_results || []).map(t => ({ ...t, isTv: true, imdb_id: trimmedQuery }));
          combined = [...foundMovies, ...foundTv];
        }
      } catch (e) {
        console.warn('IMDb ID direct lookup error:', e);
      }
    }

    if (combined.length === 0) {
      // Parallel fetch: TMDB direct search + IMDb suggestions converter
      const [movieData, tvData, imdbConverted] = await Promise.all([
        fetchTMDB('/search/movie', { query: searchQuery }),
        fetchTMDB('/search/tv', { query: searchQuery }),
        searchIMDbConverter(trimmedQuery)
      ]);

      const tmdbResults = [
        ...((movieData && movieData.results) || []),
        ...((tvData && tvData.results) || []).map(t => ({ ...t, isTv: true }))
      ];

      // Merge IMDb converted items first (has high phonetic accuracy) + TMDB results
      combined = [...(imdbConverted || []), ...tmdbResults];
    }

    // Also scan local catalog tracks for instant rich local hits
    const qLower = searchQuery.toLowerCase();
    const localMatches = [];
    const localPool = [
      ...(state.anime || []),
      ...(state.animeTonight || []),
      ...(state.bollywood || []),
      ...(state.hollywood || []),
      ...(state.series || []),
      ...(state.trending || [])
    ];
    for (const item of localPool) {
      if (!item || !item.id) continue;
      const title = (item.title || item.name || '').toLowerCase();
      if (title.includes(qLower) || qLower.includes(title)) {
        if (!localMatches.some(m => m.id === item.id) && !combined.some(c => c.id === item.id)) {
          localMatches.push(item);
        }
      }
    }

    // Deduplicate and arrange
    const seen = new Set();
    const arrangedResults = [];
    const allCandidates = [...localMatches, ...combined];

    for (const item of allCandidates) {
      if (!item) continue;
      const idKey = item.imdb_id ? `imdb_${item.imdb_id}` : `tmdb_${item.id}`;
      const titleKey = ((item.title || item.name || '').toLowerCase() + '_' + (item.isTv ? 'tv' : 'mov')).replace(/[^a-z0-9]/g, '');
      if (!seen.has(idKey) && !seen.has(titleKey)) {
        seen.add(idKey);
        seen.add(titleKey);
        arrangedResults.push(item);
      }
    }

    // Prioritize results closely matching the user query
    arrangedResults.sort((a, b) => {
      const aTitle = (a.title || a.name || '').toLowerCase();
      const bTitle = (b.title || b.name || '').toLowerCase();
      const aExact = aTitle.includes(qLower);
      const bExact = bTitle.includes(qLower);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return (b.popularity || 0) - (a.popularity || 0);
    });

    if (arrangedResults.length > 0) {
      renderSearchDropdown(arrangedResults.slice(0, 8), resolved.corrected ? resolved.query : null);
    } else {
      searchDropdown.innerHTML = '<div style="padding: 1.2rem; text-align: center; color: var(--text-muted);">No movies or series found</div>';
      searchDropdown.style.display = 'block';
    }
  }, 220);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  searchDropdown.style.display = 'none';
});

function renderSearchDropdown(results, typoCorrection = null) {
  searchDropdown.innerHTML = '';

  if (typoCorrection) {
    const notice = document.createElement('div');
    notice.className = 'search-did-you-mean';
    notice.innerHTML = `<span>💡 Showing results for <strong>"${typoCorrection}"</strong></span>`;
    searchDropdown.appendChild(notice);
  }

  results.forEach(item => {
    const div = document.createElement('div');
    div.className = 'search-result-item';

    const posterSrc = item.poster_path
      ? (item.poster_path.startsWith('http') ? item.poster_path : `${IMG_BASE_URL}/w200${item.poster_path}`)
      : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=100&q=80';
    const year = (item.release_date || item.first_air_date || '').split('-')[0] || '';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
    const title = item.title || item.name || 'Untitled';
    const typeLabel = item.isTv ? 'Series' : 'Movie';
    const isAnime = item.genre_ids?.includes(16) || (item.name && /[^\x00-\x7F]/.test(item.name)) || (item.origin_country && item.origin_country.includes('JP'));

    div.innerHTML = `
      <img class="search-thumb" src="${posterSrc}" alt="${title}" loading="lazy" />
      <div class="search-info">
        <h4>${title}</h4>
        <div class="search-meta">
          <span class="search-tag-pill search-tag-rating">★ ${rating}</span>
          ${year ? `<span>•</span><span>${year}</span>` : ''}
          <span>•</span>
          <span class="search-tag-pill search-tag-type">${isAnime ? 'Anime' : typeLabel}</span>
          <span class="search-tag-pill search-tag-quality">4K UHD</span>
        </div>
      </div>
    `;

    div.addEventListener('click', () => {
      searchDropdown.style.display = 'none';
      searchInput.value = '';
      searchClear.style.display = 'none';
      openPlayerView(item.id, item.isTv, 1, 1, true, 0, item);
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
async function openPlayerView(id, isTv = false, targetSeason = 1, targetEpisode = 1, updateHash = true, resumeSeconds = 0, initialItem = null) {
  let details = null;
  let resolvedId = id;
  const isImdbId = typeof id === 'string' && id.startsWith('tt');

  if (isImdbId) {
    try {
      const findData = await fetchTMDB(`/find/${id}`, { external_source: 'imdb_id' });
      if (findData) {
        const found = isTv
          ? (findData.tv_results && findData.tv_results[0])
          : (findData.movie_results && findData.movie_results[0]);
        if (found) {
          resolvedId = found.id;
          isTv = Boolean(isTv || (findData.tv_results && findData.tv_results.length > 0));
        }
      }
    } catch (e) {
      console.warn('TMDB find by IMDb ID error:', e);
    }
  }

  const endpoint = isTv ? `/tv/${resolvedId}` : `/movie/${resolvedId}`;
  if (!String(resolvedId).startsWith('tt')) {
    details = await fetchTMDB(endpoint, {
      append_to_response: 'videos,credits,similar,external_ids,translations',
    });

    if (!details && !isTv) {
      details = await fetchTMDB(`/tv/${resolvedId}`, {
        append_to_response: 'videos,credits,similar,external_ids,translations',
      });
      if (details) details.isTv = true;
    }
  }

  // Fallback for titles found exclusively via IMDb / Cinemeta
  if (!details && isImdbId) {
    try {
      const cineRes = await fetch(`https://v3-cinemeta.strem.io/meta/${isTv ? 'series' : 'movie'}/${id}.json`);
      if (cineRes.ok) {
        const cineData = await cineRes.json();
        if (cineData && cineData.meta) {
          const m = cineData.meta;
          details = {
            id: id,
            imdb_id: id,
            title: m.name,
            name: m.name,
            tagline: '',
            overview: m.description || '',
            poster_path: m.poster || null,
            backdrop_path: m.background || null,
            release_date: m.year || '',
            first_air_date: m.year || '',
            vote_average: parseFloat(m.imdbRating) || 8.0,
            vote_count: 500,
            runtime: parseInt(m.runtime, 10) || 120,
            genres: (m.genres || []).map(g => ({ name: g })),
            status: isTv ? 'TV Series' : 'Released',
            isTv: isTv,
            seasons: m.videos ? [{ season_number: 1, name: 'Season 1', episode_count: m.videos.length }] : []
          };
        }
      }
    } catch (e) {
      console.warn('Cinemeta fallback error:', e);
    }
  }

  if (!details && initialItem) {
    details = { ...initialItem };
  }

  if (details && initialItem && initialItem.imdb_id && !details.imdb_id) {
    details.imdb_id = initialItem.imdb_id;
  }

  // Ensure IMDb ID is resolved for cross-server mirror indexing & episode fetching
  if (details && !details.imdb_id && (!details.external_ids || !details.external_ids.imdb_id)) {
    try {
      const ext = await fetchTMDB(`/${isTv ? 'tv' : 'movie'}/${details.id}/external_ids`);
      if (ext && ext.imdb_id) {
        if (!details.external_ids) details.external_ids = {};
        details.external_ids.imdb_id = ext.imdb_id;
        details.imdb_id = ext.imdb_id;
      }
    } catch (e) {
      console.warn('External IDs fallback fetch:', e);
    }
  }

  // If still missing IMDb ID for TV show, resolve via IMDb suggestions converter
  if (details && isTv && !details.imdb_id && (!details.external_ids || !details.external_ids.imdb_id)) {
    const resolvedImdb = await resolveShowImdbId(details.name || details.title);
    if (resolvedImdb) {
      details.imdb_id = resolvedImdb;
      if (!details.external_ids) details.external_ids = {};
      details.external_ids.imdb_id = resolvedImdb;
    }
  }

  if (!details) {
    const allCached = [
      ...state.trending,
      ...state.bollywood,
      ...state.hollywood,
      ...state.anime,
      ...state.cartoons,
      ...state.series,
      ...state.south,
      ...state.popular,
      ...state.watchlist,
      ...state.watchHistory
    ];
    details = allCached.find(m => m && m.id === id);
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
  const imdbId = (details.external_ids && details.external_ids.imdb_id) || details.imdb_id || (initialItem && initialItem.imdb_id);
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

  // Fetch and arrange IMDb series episodes if available
  let imdbEpisodesMap = null;
  if (isTv && imdbId) {
    const rawImdbVideos = await fetchIMDbSeriesEpisodes(imdbId);
    if (rawImdbVideos && rawImdbVideos.length > 0) {
      imdbEpisodesMap = arrangeImdbEpisodes(rawImdbVideos);
    }
  }

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

  const playerNextEpBtn = document.getElementById('player-next-ep-btn');
  const playerPrevEpBtn = document.getElementById('player-prev-ep-btn');
  const quickNextEpBtn = document.getElementById('btn-next-ep-quick');
  const playerTheaterBtn = document.getElementById('player-theater-btn');

  function updateNextEpButtonState() {
    if (!isTv) {
      if (playerNextEpBtn) playerNextEpBtn.style.display = 'none';
      if (playerPrevEpBtn) playerPrevEpBtn.style.display = 'none';
      if (quickNextEpBtn) quickNextEpBtn.style.display = 'none';
      return;
    }
    const currentIdx = currentSeasonEpisodes.findIndex(e => e.episode_number === state.currentEpisode || e.relative_number === state.currentEpisode);
    const hasNextInSeason = currentIdx !== -1 && currentIdx < currentSeasonEpisodes.length - 1;
    const hasNextSeason = seasonSelect && seasonSelect.selectedIndex < seasonSelect.options.length - 1;

    // Next Episode Button State
    if (hasNextInSeason || hasNextSeason) {
      const nextEpObj = hasNextInSeason ? currentSeasonEpisodes[currentIdx + 1] : null;
      const nextEpNum = nextEpObj ? (nextEpObj.relative_number || nextEpObj.episode_number) : 1;
      if (playerNextEpBtn) {
        playerNextEpBtn.style.display = 'inline-flex';
        playerNextEpBtn.innerHTML = `<span>Next Ep (E${nextEpNum}) ›</span>`;
      }
      if (quickNextEpBtn) {
        quickNextEpBtn.style.display = 'inline-flex';
        quickNextEpBtn.textContent = `Next Ep (E${nextEpNum}) ›`;
      }
    } else {
      if (playerNextEpBtn) playerNextEpBtn.style.display = 'none';
      if (quickNextEpBtn) quickNextEpBtn.style.display = 'none';
    }

    // Previous Episode Button State
    const hasPrevInSeason = currentIdx > 0;
    const hasPrevSeason = seasonSelect && seasonSelect.selectedIndex > 0;
    if (hasPrevInSeason || hasPrevSeason) {
      const prevEpObj = hasPrevInSeason ? currentSeasonEpisodes[currentIdx - 1] : null;
      const prevEpNum = prevEpObj ? (prevEpObj.relative_number || prevEpObj.episode_number) : 1;
      if (playerPrevEpBtn) {
        playerPrevEpBtn.style.display = 'inline-flex';
        playerPrevEpBtn.innerHTML = `<span>‹ Prev Ep (E${prevEpNum})</span>`;
      }
    } else {
      if (playerPrevEpBtn) playerPrevEpBtn.style.display = 'none';
    }
  }

  function syncBatchTabForCurrentEpisode() {
    if (currentSeasonEpisodes.length > 20 && rangeTabsContainer) {
      const batchSize = 25;
      const curIdx = currentSeasonEpisodes.findIndex(e => e.episode_number === state.currentEpisode || e.relative_number === state.currentEpisode);
      const epNum = curIdx !== -1 ? (curIdx + 1) : state.currentEpisode;
      const totalBatches = Math.ceil(currentSeasonEpisodes.length / batchSize);
      const batchIdx = Math.min(Math.floor((epNum - 1) / batchSize), totalBatches - 1);
      activeRangeIndex = batchIdx + 1;
      const tabs = rangeTabsContainer.querySelectorAll('.range-tab-btn');
      tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === batchIdx);
      });
    }
  }

  function advanceToNextEpisode() {
    if (!isTv) return;
    const currentIdx = currentSeasonEpisodes.findIndex(e => e.episode_number === state.currentEpisode || e.relative_number === state.currentEpisode);
    const nextEpObj = currentIdx !== -1 && currentSeasonEpisodes[currentIdx + 1] ? currentSeasonEpisodes[currentIdx + 1] : null;

    if (nextEpObj) {
      state.currentEpisode = nextEpObj.relative_number || nextEpObj.episode_number;
      episodeBadge.textContent = `S${state.currentSeason} : E${state.currentEpisode}`;
      window.location.hash = `watch/tv/${details.id}?s=${state.currentSeason}&e=${state.currentEpisode}`;
      const playSeason = nextEpObj.season_number || state.currentSeason;
      mountVideoPlayer(details, state.activeSourceType, playSeason, nextEpObj.episode_number);
      syncBatchTabForCurrentEpisode();
      renderCurrentEpisodesOrientation();
      updateNextEpButtonState();
      showToast(`Playing Next: S${state.currentSeason} : E${state.currentEpisode} - ${nextEpObj.name}`);
    } else {
      if (seasonSelect && seasonSelect.selectedIndex < seasonSelect.options.length - 1) {
        seasonSelect.selectedIndex += 1;
        seasonSelect.dispatchEvent(new Event('change'));
        showToast('Auto-advanced to next season! 🎉');
      } else {
        showToast('You have reached the final episode! 🌟');
      }
    }
  }

  function advanceToPrevEpisode() {
    if (!isTv) return;
    const currentIdx = currentSeasonEpisodes.findIndex(e => e.episode_number === state.currentEpisode || e.relative_number === state.currentEpisode);
    const prevEpObj = currentIdx > 0 ? currentSeasonEpisodes[currentIdx - 1] : null;

    if (prevEpObj) {
      state.currentEpisode = prevEpObj.relative_number || prevEpObj.episode_number;
      episodeBadge.textContent = `S${state.currentSeason} : E${state.currentEpisode}`;
      window.location.hash = `watch/tv/${details.id}?s=${state.currentSeason}&e=${state.currentEpisode}`;
      const playSeason = prevEpObj.season_number || state.currentSeason;
      mountVideoPlayer(details, state.activeSourceType, playSeason, prevEpObj.episode_number);
      syncBatchTabForCurrentEpisode();
      renderCurrentEpisodesOrientation();
      updateNextEpButtonState();
      showToast(`Playing Previous: S${state.currentSeason} : E${state.currentEpisode} - ${prevEpObj.name}`);
    } else if (seasonSelect && seasonSelect.selectedIndex > 0) {
      seasonSelect.selectedIndex -= 1;
      seasonSelect.dispatchEvent(new Event('change'));
      showToast('Switched to previous season! 📺');
    }
  }

  if (playerNextEpBtn) playerNextEpBtn.onclick = advanceToNextEpisode;
  if (playerPrevEpBtn) playerPrevEpBtn.onclick = advanceToPrevEpisode;
  if (quickNextEpBtn) quickNextEpBtn.onclick = advanceToNextEpisode;

  // Cinema Focus Mode (Background Blur) Toggle
  if (playerTheaterBtn) {
    playerTheaterBtn.onclick = () => {
      const isFocused = document.body.classList.toggle('cinema-focus-mode');
      const iconEl = document.getElementById('theater-icon');
      const textEl = document.getElementById('theater-text');
      if (isFocused) {
        if (iconEl) iconEl.textContent = '🌟';
        if (textEl) textEl.textContent = 'Focus ON';
        showToast('💡 Cinema Focus On: Background blurred for theater view!');
      } else {
        if (iconEl) iconEl.textContent = '💡';
        if (textEl) textEl.textContent = 'Cinema Focus';
        showToast('💡 Normal mode restored');
      }
    };
  }

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

  function setupEpisodeBatchTabs(episodesList) {
    if (!rangeTabsContainer) return;
    rangeTabsContainer.innerHTML = '';
    if (episodesList.length > 20) {
      rangeTabsContainer.style.display = 'flex';

      const batchSize = 25;
      const totalBatches = Math.ceil(episodesList.length / batchSize);
      const targetBatchIndex = (state.currentEpisode && state.currentEpisode > 1)
        ? Math.min(Math.floor((state.currentEpisode - 1) / batchSize), totalBatches - 1)
        : 0;
      activeRangeIndex = targetBatchIndex + 1;

      for (let b = 0; b < totalBatches; b++) {
        const startEp = b * batchSize + 1;
        const endEp = Math.min((b + 1) * batchSize, episodesList.length);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `range-tab-btn ${b === targetBatchIndex ? 'active' : ''}`;
        btn.textContent = `Eps ${startEp} - ${endEp}`;
        btn.onclick = () => {
          activeRangeIndex = b + 1;
          rangeTabsContainer.querySelectorAll('.range-tab-btn').forEach(tb => tb.classList.remove('active'));
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
      const isCurrent = ep.episode_number === state.currentEpisode || ep.relative_number === state.currentEpisode;
      const epDisplayNum = ep.relative_number || ep.episode_number;
      const thumb = ep.still_path
        ? (ep.still_path.startsWith('http') ? ep.still_path : `${IMG_BASE_URL}/w300${ep.still_path}`)
        : (details.backdrop_path ? `${IMG_BASE_URL}/w300${details.backdrop_path}` : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=300&q=80');

      if (currentViewMode === 'list') {
        // Detailed Netflix-Style List Orientation
        const card = document.createElement('div');
        card.className = `episode-card-list ${isCurrent ? 'active' : ''}`;
        card.innerHTML = `
          <div class="ep-left-thumb">
            <img src="${thumb}" alt="${ep.name}" loading="lazy" />
            <span class="ep-num-pill">EP ${epDisplayNum}</span>
            <div class="ep-play-overlay">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
            </div>
          </div>
          <div class="ep-right-content">
            <div class="ep-title-row">
              <span class="ep-number">${epDisplayNum}.</span>
              <h4 class="ep-name">${ep.name}</h4>
              ${isCurrent ? '<span class="ep-playing-tag">▶ PLAYING</span>' : ''}
              <span class="ep-runtime-tag">${ep.runtime ? `${ep.runtime}m` : 'HD'}</span>
            </div>
            <div class="ep-meta-row">
              ${ep.air_date ? `<span>Aired: ${ep.air_date}</span>` : ''}
              <span>•</span>
              <span>★ ${ep.vote_average ? ep.vote_average.toFixed(1) : 'NR'}</span>
              ${ep.relative_number && ep.relative_number !== ep.episode_number ? `<span>• (Total Ep #${ep.episode_number})</span>` : ''}
            </div>
            <p class="ep-overview-text">${ep.overview || 'Stream this episode in full HD with multi-audio and subtitles.'}</p>
          </div>
        `;

        card.addEventListener('click', () => {
          document.querySelectorAll('.episode-card-list, .episode-card-grid').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.currentEpisode = epDisplayNum;
          episodeBadge.textContent = `S${state.currentSeason} : E${state.currentEpisode}`;
          window.location.hash = `watch/tv/${details.id}?s=${state.currentSeason}&e=${state.currentEpisode}`;
          const playSeason = ep.season_number || state.currentSeason;
          mountVideoPlayer(details, state.activeSourceType, playSeason, ep.episode_number);
          renderCurrentEpisodesOrientation();
          updateNextEpButtonState();
          showToast(`Playing S${state.currentSeason} : E${state.currentEpisode} - ${ep.name}`);
        });

        episodesTrack.appendChild(card);
      } else {
        // Card Grid Orientation
        const card = document.createElement('div');
        card.className = `episode-card-grid ${isCurrent ? 'active' : ''}`;
        card.innerHTML = `
          <div class="ep-thumb-wrapper">
            <img src="${thumb}" alt="${ep.name}" loading="lazy" />
            <span class="ep-num-pill">EP ${epDisplayNum}</span>
            <span class="ep-runtime-pill">${ep.runtime ? `${ep.runtime}m` : 'HD'}</span>
          </div>
          <div class="ep-grid-info">
            <div class="ep-grid-title">${epDisplayNum}. ${ep.name}</div>
            <div class="ep-grid-sub">${ep.air_date ? ep.air_date.split('-')[0] : ''} • ★ ${ep.vote_average ? ep.vote_average.toFixed(1) : 'NR'}</div>
          </div>
        `;

        card.addEventListener('click', () => {
          document.querySelectorAll('.episode-card-list, .episode-card-grid').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.currentEpisode = epDisplayNum;
          episodeBadge.textContent = `S${state.currentSeason} : E${state.currentEpisode}`;
          window.location.hash = `watch/tv/${details.id}?s=${state.currentSeason}&e=${state.currentEpisode}`;
          const playSeason = ep.season_number || state.currentSeason;
          mountVideoPlayer(details, state.activeSourceType, playSeason, ep.episode_number);
          renderCurrentEpisodesOrientation();
          updateNextEpButtonState();
          showToast(`Playing S${state.currentSeason} : E${state.currentEpisode} - ${ep.name}`);
        });

        episodesTrack.appendChild(card);
      }
    });
  }

  // ==========================================================================
  // Universal Show & Episode Breakdown (Accurate Multi-Season & IMDb Episode Mapping)
  // Ensures 1:1 compatibility with VidLink, VidSrc, and AutoEmbed servers
  // ==========================================================================
  if (isTv) {
    seriesControls.style.display = 'block';
    seasonSelect.innerHTML = '<option value="">Loading seasons...</option>';

    const validSeasons = (details.seasons || []).filter(s => s.season_number > 0);
    let seasonsList = validSeasons.length > 0 ? [...validSeasons] : [];

    // Integrate IMDb arranged episode counts into season breakdown
    if (imdbEpisodesMap) {
      const imdbSeasonKeys = Object.keys(imdbEpisodesMap).map(k => parseInt(k, 10)).sort((a, b) => a - b);
      if (seasonsList.length === 0) {
        seasonsList = imdbSeasonKeys.map(sn => ({
          season_number: sn,
          name: `Season ${sn}`,
          episode_count: imdbEpisodesMap[sn].length
        }));
      } else {
        seasonsList = seasonsList.map(s => {
          const imdbEps = imdbEpisodesMap[s.season_number];
          if (imdbEps && imdbEps.length > (s.episode_count || 0)) {
            return {
              ...s,
              episode_count: imdbEps.length
            };
          }
          return s;
        });

        imdbSeasonKeys.forEach(sn => {
          if (!seasonsList.some(s => s.season_number === sn)) {
            seasonsList.push({
              season_number: sn,
              name: `Season ${sn}`,
              episode_count: imdbEpisodesMap[sn].length
            });
          }
        });
      }
    }

    if (seasonsList.length === 0) {
      seasonsList = [{ season_number: 1, name: 'Season 1', episode_count: 10 }];
    }

    seasonSelect.innerHTML = '';
    seasonsList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.season_number;
      opt.textContent = `${s.name || `Season ${s.season_number}`} (${s.episode_count || '?'} Eps)`;
      seasonSelect.appendChild(opt);
    });

    // Smart Season Auto-Detection:
    // If targetEpisode belongs to a later season (e.g. Naruto Shippuden Ep 163 is in Season 8, not Season 1)
    let resolvedSeason = targetSeason || seasonsList[0].season_number;
    if (targetEpisode && targetEpisode > 1) {
      const targetSObj = seasonsList.find(s => s.season_number === targetSeason);
      if (!targetSObj || (targetSObj.episode_count && targetEpisode > targetSObj.episode_count && targetEpisode > 30)) {
        let cumulative = 0;
        for (const s of seasonsList) {
          const count = s.episode_count || 0;
          if (targetEpisode <= cumulative + count) {
            resolvedSeason = s.season_number;
            break;
          }
          cumulative += count;
        }
      }
    }

    state.currentSeason = resolvedSeason;
    state.currentEpisode = targetEpisode || 1;
    seasonSelect.value = state.currentSeason;
    episodeBadge.textContent = `S${state.currentSeason} : E${state.currentEpisode}`;

    async function loadRegularSeasonEpisodes(seasonNum) {
      episodesTrack.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">Loading season episodes...</div>';
      const showId = details.id || id;
      let sData = await fetchTMDB(`/tv/${showId}/season/${seasonNum}`);

      if (!sData && details.seasons && details.seasons.length > 0) {
        for (const s of details.seasons) {
          if (s.season_number !== seasonNum && s.episode_count > 0) {
            const altData = await fetchTMDB(`/tv/${showId}/season/${s.season_number}`);
            if (altData && altData.episodes && altData.episodes.length > 0) {
              sData = altData;
              state.currentSeason = s.season_number;
              seasonSelect.value = s.season_number;
              break;
            }
          }
        }
      }

      const tmdbEps = (sData && sData.episodes) || [];
      const imdbSeasonEps = imdbEpisodesMap && imdbEpisodesMap[seasonNum];
      let finalEpisodes = [];

      // Use IMDb arranged episodes if IMDb has more comprehensive episode data (e.g. 500 vs 10)
      if (imdbSeasonEps && imdbSeasonEps.length > tmdbEps.length) {
        finalEpisodes = imdbSeasonEps.map(imdbEp => {
          const tmdbMatch = tmdbEps.find(te => te.episode_number === imdbEp.episode_number);
          if (tmdbMatch) {
            return {
              ...imdbEp,
              name: tmdbMatch.name && !/^Episode \d+$/i.test(tmdbMatch.name) ? tmdbMatch.name : imdbEp.name,
              overview: tmdbMatch.overview || imdbEp.overview,
              still_path: tmdbMatch.still_path || imdbEp.still_path,
              air_date: tmdbMatch.air_date || imdbEp.air_date,
              vote_average: tmdbMatch.vote_average || imdbEp.vote_average
            };
          }
          return imdbEp;
        });
      } else if (tmdbEps.length > 0) {
        finalEpisodes = tmdbEps;
      } else if (imdbSeasonEps && imdbSeasonEps.length > 0) {
        finalEpisodes = imdbSeasonEps;
      }

      if (finalEpisodes.length > 0) {
        currentSeasonEpisodes = finalEpisodes;

        if (seasonMetaBadge) {
          const yearStr = (sData && sData.air_date) ? sData.air_date.split('-')[0] : (finalEpisodes[0].air_date ? finalEpisodes[0].air_date.split('-')[0] : '');
          seasonMetaBadge.textContent = `Season ${state.currentSeason} • ${currentSeasonEpisodes.length} Episodes ${yearStr ? `• ${yearStr}` : ''}`;
        }

        if (seasonDesc) {
          const descText = (sData && sData.overview) || details.overview || '';
          if (descText) {
            seasonDesc.innerHTML = `<strong>Season ${state.currentSeason} Storyline:</strong> ${descText}`;
            seasonDesc.style.display = 'block';
          } else {
            seasonDesc.style.display = 'none';
          }
        }

        setupEpisodeBatchTabs(currentSeasonEpisodes);
        renderCurrentEpisodesOrientation();
        updateNextEpButtonState();
      } else {
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
        updateNextEpButtonState();
      }
    }

    seasonSelect.onchange = () => {
      state.currentSeason = parseInt(seasonSelect.value, 10);
      state.currentEpisode = 1;
      episodeBadge.textContent = `S${state.currentSeason} : E1`;
      window.location.hash = `watch/tv/${details.id}?s=${state.currentSeason}&e=1`;
      loadRegularSeasonEpisodes(state.currentSeason);
      mountVideoPlayer(details, state.activeSourceType, state.currentSeason, 1);
    };

    loadRegularSeasonEpisodes(state.currentSeason);
  } else {
    seriesControls.style.display = 'none';
    if (playerNextEpBtn) playerNextEpBtn.style.display = 'none';
  }

  // Auto-Select Best Player for Content Type (Anime gets AutoEmbed by default, others get VidLink)
  const isAnime = Boolean(
    details.isAnime ||
    (details.original_language === 'ja' && details.genres && details.genres.some(g => g.id === 16 || g.name === 'Animation')) ||
    (details.genre_ids && details.genre_ids.includes(16) && details.original_language === 'ja') ||
    (Array.isArray(details.origin_country) && details.origin_country.includes('JP') && details.genre_ids && details.genre_ids.includes(16))
  );

  // Set default active server: AutoEmbed for anime (guaranteed episodes), VidLink for others
  state.activeSourceType = isAnime ? 'autoembed' : 'vidlink';

  // Stream Server Switcher (Modern Dropdown for PC and Mobile)
  const serverSelect = document.getElementById('player-server-select');
  if (serverSelect) {
    if (isAnime) {
      serverSelect.innerHTML = `
        <option value="autoembed">🍥 Server 1: AutoEmbed (Sub/Dub HD & Anime)</option>
        <option value="vidlink">⚡ Server 2: VidLink 4K (Ultra HD & Sound)</option>
        <option value="axon">🎙️ Server 3: AXON Stream (English Dub & Sub HD)</option>
        <option value="vidsrc">👑 Server 4: VidSrc PM (Multi-Mirror HD)</option>
        <option value="vidsrc_cc">📺 Server 5: VidSrc CC (Cloud 4K)</option>
        <option value="vidsrc_xyz">🌐 Server 6: VidSrc XYZ (Global Mirror)</option>
        <option value="vidsrc_net">☁️ Server 7: VidSrc Net (Direct Stream)</option>
        <option value="trailer">🎞️ Server 8: Official HD Trailer</option>
      `;
    } else {
      serverSelect.innerHTML = `
        <option value="vidlink">⚡ Server 1: VidLink 4K (Ultra HD & Sound)</option>
        <option value="autoembed">🍥 Server 2: AutoEmbed (Sub/Dub HD)</option>
        <option value="axon">🎙️ Server 3: AXON Stream (English Dub & Sub HD)</option>
        <option value="vidsrc">👑 Server 4: VidSrc PM (Multi-Mirror HD)</option>
        <option value="vidsrc_cc">📺 Server 5: VidSrc CC (Cloud 4K)</option>
        <option value="vidsrc_xyz">🌐 Server 6: VidSrc XYZ (Global Mirror)</option>
        <option value="vidsrc_net">☁️ Server 7: VidSrc Net (Direct Stream)</option>
        <option value="trailer">🎞️ Server 8: Official HD Trailer</option>
      `;
    }
    serverSelect.value = state.activeSourceType;
    serverSelect.onchange = (e) => {
      const chosen = e.target.value;
      state.activeSourceType = chosen;
      const playSec = state.activePlayback ? (state.activePlayback.currentTime || 0) : 0;
      mountVideoPlayer(details, chosen, state.currentSeason || 1, state.currentEpisode || 1, playSec);
      const label = serverSelect.options[serverSelect.selectedIndex] ? serverSelect.options[serverSelect.selectedIndex].text : chosen;
      showToast(`Connected to ${label}`);
    };
  }

  // 1-Click "🔄 Switch Server" Button
  const nextServerBtn = document.getElementById('btn-next-server');
  if (nextServerBtn) {
    nextServerBtn.onclick = () => {
      const serverOrder = isAnime
        ? ['autoembed', 'vidlink', 'axon', 'vidsrc', 'vidsrc_cc', 'vidsrc_xyz', 'vidsrc_net']
        : ['vidlink', 'autoembed', 'axon', 'vidsrc', 'vidsrc_cc', 'vidsrc_xyz', 'vidsrc_net'];
      const currentIndex = serverOrder.indexOf(state.activeSourceType);
      const nextIndex = (currentIndex + 1) % serverOrder.length;
      const nextServer = serverOrder[nextIndex];
      state.activeSourceType = nextServer;
      if (serverSelect) serverSelect.value = nextServer;
      const playSec = state.activePlayback ? (state.activePlayback.currentTime || 0) : 0;
      mountVideoPlayer(details, nextServer, state.currentSeason || 1, state.currentEpisode || 1, playSec);
      const label = serverSelect.options[serverSelect.selectedIndex] ? serverSelect.options[serverSelect.selectedIndex].text : nextServer;
      showToast(`Switched to ${label}`);
    };
  }

  // Look for saved progress if resumeSeconds wasn't explicitly passed
  const savedItem = (state.continueWatching || []).find(m => m.id === details.id);
  const startSeconds = resumeSeconds > 0
    ? resumeSeconds
    : (savedItem && (savedItem.currentTime || savedItem.progressSeconds))
      ? (savedItem.currentTime || savedItem.progressSeconds)
      : 0;

  // Mount Video Player (mounts video & in-player overlay controls)
  mountVideoPlayer(details, state.activeSourceType, state.currentSeason || 1, state.currentEpisode || 1, startSeconds);

  // Record into Watch History & Continue Watching
  recordMovieToHistory(details);
  recordContinueWatching(details, state.currentSeason || 1, state.currentEpisode || 1, startSeconds);

  // Scroll Down Hint Button
  const scrollDownBtn = document.getElementById('btn-scroll-down-hint');
  if (scrollDownBtn) {
    scrollDownBtn.onclick = () => {
      const target = document.getElementById('player-series-controls') || document.getElementById('player-movie-title');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    };
  }

  // More Like This (Strict Anime Filtering & Relevant Recommendations)
  const similarGrid = document.getElementById('player-similar-grid');
  if (similarGrid) {
    similarGrid.innerHTML = '';
    const tmdbSimilar = details.similar ? details.similar.results : [];
    let finalSimilar = [];

    if (isAnime) {
      // 100% STRICT ANIME ONLY! Zero live-action movies or western series
      let animeSimilar = tmdbSimilar.filter(isStrictAnime);
      if (animeSimilar.length < 12) {
        // Supplement from our rich anime catalog (Shonen, Tonight, Top10, Psycho, Isekai)
        const animePool = [
          ...(state.animeShonen || []),
          ...(state.animeTonight || []),
          ...(state.animeTop10 || []),
          ...(state.animePsycho || []),
          ...(state.animeIsekai || [])
        ];
        for (const it of animePool) {
          if (it && it.id !== details.id && it.poster_path && !animeSimilar.some(s => s.id === it.id)) {
            animeSimilar.push({ ...it, isTv: true, isAnime: true });
            if (animeSimilar.length >= 12) break;
          }
        }
      }
      finalSimilar = animeSimilar.slice(0, 12);
    } else if (details.original_language === 'hi' || ['te', 'ta', 'ml', 'kn'].includes(details.original_language)) {
      // Indian content - similar Indian cinema + subtle Hollywood blockbuster mix
      let indianSimilar = tmdbSimilar.filter(item => isStrictBollywood(item) || isStrictSouth(item));
      if (indianSimilar.length < 10) {
        const pool = [...(state.bollywood || []), ...(state.bollywoodTop10 || []), ...(state.south || [])];
        for (const it of pool) {
          if (it && it.id !== details.id && it.poster_path && !indianSimilar.some(s => s.id === it.id)) {
            indianSimilar.push(it);
            if (indianSimilar.length >= 10) break;
          }
        }
      }
      const hwPicks = (state.hollywood || []).slice(0, 2);
      finalSimilar = [...indianSimilar.slice(0, 10), ...hwPicks].slice(0, 12);
    } else {
      // Hollywood / International - subtle Bollywood mix
      let hwSimilar = tmdbSimilar.filter(item => !isStrictAnime(item));
      if (hwSimilar.length < 10) {
        const pool = [...(state.hollywood || []), ...(state.hollywoodTop10 || [])];
        for (const it of pool) {
          if (it && it.id !== details.id && it.poster_path && !hwSimilar.some(s => s.id === it.id)) {
            hwSimilar.push(it);
            if (hwSimilar.length >= 10) break;
          }
        }
      }
      const bollyPicks = (state.bollywood || []).slice(0, 2);
      finalSimilar = [...hwSimilar.slice(0, 10), ...bollyPicks].slice(0, 12);
    }

    finalSimilar.forEach(sim => {
      if (!sim.poster_path) return;
      if (isAnime) { sim.isTv = true; sim.isAnime = true; }
      else if (isTv) sim.isTv = true;
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
    const sSelect = document.getElementById('player-server-select');
    if (sSelect) sSelect.value = activeType;
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
      state.activeSourceType = 'vidlink';
      syncSourceButtons('vidlink');
      mountVideoPlayer(details, 'vidlink', state.currentSeason || 1, state.currentEpisode || 1);
      showToast('Playing Original Japanese Audio on Server 1 (VidLink)');
    });
    container.appendChild(jaPill);

    const enPill = createPill('🇺🇸 English (Dub / Sub)', currentLang === 'en', () => {
      state.activeAudioLang = 'en';
      state.activeSourceType = 'vidlink';
      syncSourceButtons('vidlink');
      mountVideoPlayer(details, 'vidlink', state.currentSeason || 1, state.currentEpisode || 1);
      showToast('Playing English Sub/Dub on Server 1 (VidLink 4K)');
    });
    container.appendChild(enPill);

    const hiPill = createPill('🇮🇳 Hindi (Dubbed)', currentLang === 'hi', () => {
      state.activeAudioLang = 'hi';
      state.activeSourceType = 'vidsrc';
      syncSourceButtons('vidsrc');
      mountVideoPlayer(details, 'vidsrc', state.currentSeason || 1, state.currentEpisode || 1);
      showToast('Connecting to Multi-Audio Stream on Server 2 (VidSrc PM)');
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
      state.activeSourceType = 'vidsrc';
      syncSourceButtons('vidsrc');
      mountVideoPlayer(details, 'vidsrc', state.currentSeason || 1, state.currentEpisode || 1);
      showToast('Streaming Multi-Audio on Server 2 (VidSrc PM)');
    });
    container.appendChild(hiPill);

    if (hintContainer) {
      hintContainer.innerHTML = '<span style="font-size: 0.82rem; color: #94a3b8;">Multi-language audio & subtitles</span>';
    }
  }
}

// Helper: Fetch Top Rated Shows/Movies in matching Genre (Strict Anime Guarantee)
async function renderGenreTopShows(details, isTv) {
  const grid = document.getElementById('player-genre-top-grid');
  const titleEl = document.getElementById('player-genre-top-title');
  const section = document.getElementById('player-genre-top-section');
  if (!grid) return;

  const isAnime = Boolean(
    details.isAnime ||
    (details.original_language === 'ja' && details.genres && details.genres.some(g => g.id === 16 || g.name === 'Animation')) ||
    (details.genre_ids && details.genre_ids.includes(16) && details.original_language === 'ja') ||
    (Array.isArray(details.origin_country) && details.origin_country.includes('JP') && details.genre_ids && details.genre_ids.includes(16))
  );

  if (isAnime) {
    // 100% STRICT ANIME ONLY: JJK, Solo Leveling, Demon Slayer, Naruto, Attack on Titan, etc.
    if (titleEl) {
      titleEl.textContent = '⭐ Top Rated Anime Masterpieces';
    }
    const animeTopPool = [
      ...(state.animeTop10 || []),
      ...(state.animeTonight || []),
      ...(state.animeShonen || []),
      ...(state.animePsycho || [])
    ].filter(it => it && it.id !== details.id && it.poster_path);

    const deduped = [];
    const seen = new Set();
    for (const a of animeTopPool) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        deduped.push({ ...a, isTv: true, isAnime: true });
        if (deduped.length >= 12) break;
      }
    }

    grid.innerHTML = '';
    if (deduped.length > 0) {
      if (section) section.style.display = 'block';
      deduped.forEach(item => {
        const card = createMovieCard(item);
        grid.appendChild(card);
      });
      return;
    }
  }

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

// ==========================================================================
// AXON Server: Native Stream Resolver (Anime & Movies Direct HLS)
// ==========================================================================
function resolveAxonNativeStream(item, isTv, season = 1, episode = 1, startSeconds = 0) {
  const isAnime = Boolean(
    item.isAnime ||
    (item.original_language === 'ja' && item.genres && item.genres.some(g => g.id === 16 || g.name === 'Animation')) ||
    (item.genre_ids && item.genre_ids.includes(16) && item.original_language === 'ja') ||
    (Array.isArray(item.origin_country) && item.origin_country.includes('JP') && item.genre_ids && item.genre_ids.includes(16))
  );

  const title = item.title || item.name || 'AXON Stream';
  const poster = item.backdrop_path ? `${TMDB_IMG_URL}/w1280${item.backdrop_path}` : (item.poster_path ? `${TMDB_IMG_URL}/w500${item.poster_path}` : '');
  
  // For Anime, AutoEmbed maps sequential episodes (e.g. Naruto Shippūden Ep 163) under Season 1:
  const streamSeason = isAnime ? 1 : (parseInt(season, 10) || 1);
  const streamEpisode = parseInt(episode, 10) || 1;

  // Real content stream URL - guaranteed zero sample video fallback
  const streamUrl = isTv
    ? `https://player.autoembed.co/embed/tv/${item.id}/${streamSeason}-${streamEpisode}/`
    : `https://player.autoembed.co/embed/movie/${item.id}/`;

  return {
    url: streamUrl,
    streamUrl: streamUrl,
    tmdbId: item.id,
    title: `${title}${isTv ? ` (S${season} : E${streamEpisode})` : ''}`,
    poster: poster,
    mediaType: isTv ? 'tv' : 'movie',
    isTv: Boolean(isTv),
    isAnime: Boolean(isAnime),
    season: streamSeason,
    episode: streamEpisode,
    startSeconds: startSeconds || 0
  };
}

// ==========================================================================
// Stream Player Engine (6 Multi-CDN High-Speed Servers + Zero Ads)
// ==========================================================================
async function mountVideoPlayer(item, type, season = 1, episode = 1, startSeconds = 0) {
  const cinemaScreen = document.getElementById('cinema-screen');
  const badge = document.getElementById('player-view-badge');
  const isTv = Boolean(item.isTv || item.first_air_date || (item.seasons && item.seasons.length > 0));
  const isAnime = Boolean(
    item.isAnime ||
    (item.original_language === 'ja' && item.genres && item.genres.some(g => g.id === 16 || g.name === 'Animation')) ||
    (item.genre_ids && item.genre_ids.includes(16) && item.original_language === 'ja') ||
    (Array.isArray(item.origin_country) && item.origin_country.includes('JP') && item.genre_ids && item.genre_ids.includes(16))
  );

  const imdbId = item.imdb_id || (item.external_ids && item.external_ids.imdb_id) || '';

  let streamUrl = '';
  let badgeLabel = '';

  // Clean up native player before mounting
  destroyNativePlayer();

  let playSeason = parseInt(season, 10) || 1;
  let playEpisode = parseInt(episode, 10) || 1;

  // Auto-correct season for anime / long series if episode number is out of bounds for the given season
  // (e.g. Naruto Shippuden Ep 163 is in Season 8, not Season 1)
  if (isTv && item.seasons && item.seasons.length > 0 && playEpisode > 30) {
    const sObj = item.seasons.find(s => s.season_number === playSeason);
    if (!sObj || (sObj.episode_count && playEpisode > sObj.episode_count)) {
      let cumulative = 0;
      for (const s of item.seasons) {
        if (s.season_number === 0) continue;
        const count = s.episode_count || 0;
        if (playEpisode <= cumulative + count) {
          playSeason = s.season_number;
          break;
        }
        cumulative += count;
      }
    }
  }

  if (type === 'axon') {
    // ---------------------------------------------------------------
    // 🎙️ Server 3: AXON Stream (English Dub & Sub HD)
    // ---------------------------------------------------------------
    badgeLabel = `🎙️ Server 3 (AXON Stream) • ${isTv ? `S${playSeason} : E${playEpisode}` : 'English Dub & Sub HD'}`;
    if (badge) badge.textContent = badgeLabel;

    if (cinemaScreen) cinemaScreen.innerHTML = '';
    try {
      const streamConfig = resolveAxonNativeStream(item, isTv, playSeason, playEpisode, startSeconds);
      const art = initNativePlayer(cinemaScreen, streamConfig);
      if (art) {
        state.axonPlayerInstance = art;
      }
      showToast('AXON Player: Stream Active (0 Ads)');
    } catch (err) {
      console.error('[AXON Player]: Initialization error:', err);
      showToast(`AXON Player error: ${err.message || 'Failed to initialize'}`);
    }

    const serverSelect = document.getElementById('player-server-select');
    if (serverSelect && serverSelect.value !== 'axon') {
      serverSelect.value = 'axon';
    }

    state.currentStreamUrl = streamConfig.streamUrl || streamConfig.url;
    state.activePlayback = {
      id: item.id,
      title: item.title || item.name,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      isTv: isTv,
      season: playSeason,
      episode: playEpisode,
      currentTime: startSeconds || 0,
      duration: 0,
      lastSavedAt: Date.now()
    };
    return;
  }

  if (type === 'vidlink') {
    // ---------------------------------------------------------------
    // ⚡ Server: VidLink 4K (Ultra HD & Full Audio)
    // ---------------------------------------------------------------
    const sNum = isAnime ? 2 : 1;
    badgeLabel = `⚡ Server ${sNum} (VidLink 4K) • ${isTv ? `S${playSeason} : E${playEpisode}` : 'Ultra HD & Sound'}`;
    const paramsList = ['primaryColor=e50914'];
    if (startSeconds && startSeconds > 5) {
      paramsList.push(`startAt=${Math.floor(startSeconds)}`);
    }
    const params = paramsList.join('&');
    streamUrl = isTv
      ? `https://vidlink.pro/tv/${item.id}/${playSeason}/${playEpisode}?${params}`
      : `https://vidlink.pro/movie/${item.id}?${params}`;

  } else if (type === 'autoembed') {
    // ---------------------------------------------------------------
    // 🍥 Server: AutoEmbed (Sub/Dub HD & RabbitStream)
    // ---------------------------------------------------------------
    const sNum = isAnime ? 1 : 2;
    badgeLabel = `🍥 Server ${sNum} (AutoEmbed Sub/Dub) • ${isTv ? `S${playSeason} : E${playEpisode}` : 'Sub/Dub HD'}`;
    const autoEmbedSeason = isAnime ? 1 : playSeason;
    streamUrl = isTv
      ? `https://player.autoembed.co/embed/tv/${item.id}/${autoEmbedSeason}-${playEpisode}/`
      : `https://player.autoembed.co/embed/movie/${item.id}/`;

  } else if (type === 'vidsrc') {
    // ---------------------------------------------------------------
    // 👑 Server 4: VidSrc PM (Multi-Mirror HD & Sound)
    // ---------------------------------------------------------------
    badgeLabel = `👑 Server 4 (VidSrc PM) • ${isTv ? `S${playSeason} : E${playEpisode}` : 'Multi-Mirror HD'}`;
    streamUrl = isTv
      ? `https://vidsrc.pm/embed/tv/${item.id}/${playSeason}/${playEpisode}`
      : `https://vidsrc.pm/embed/movie/${item.id}`;

  } else if (type === 'vidsrc_cc') {
    // ---------------------------------------------------------------
    // 📺 Server 5: VidSrc CC (Cloud 4K - Zero Sandbox Block)
    // ---------------------------------------------------------------
    badgeLabel = `📺 Server 5 (VidSrc CC) • ${isTv ? `S${playSeason} : E${playEpisode}` : 'Cloud 4K'}`;
    streamUrl = isTv
      ? `https://vidsrc.cc/v2/embed/tv/${item.id}/${playSeason}/${playEpisode}`
      : `https://vidsrc.cc/v2/embed/movie/${item.id}`;

  } else if (type === 'vidsrc_xyz') {
    // ---------------------------------------------------------------
    // 🌐 Server 6: VidSrc XYZ (Global Mirror)
    // ---------------------------------------------------------------
    badgeLabel = `🌐 Server 6 (VidSrc XYZ) • ${isTv ? `S${playSeason} : E${playEpisode}` : 'Global Mirror'}`;
    streamUrl = isTv
      ? `https://vidsrc.xyz/embed/tv?tmdb=${item.id}&season=${playSeason}&episode=${playEpisode}`
      : `https://vidsrc.xyz/embed/movie?tmdb=${item.id}`;

  } else if (type === 'vidsrc_net') {
    // ---------------------------------------------------------------
    // ☁️ Server 7: VidSrc Net (Direct Stream)
    // ---------------------------------------------------------------
    badgeLabel = `☁️ Server 7 (VidSrc Net) • ${isTv ? `S${playSeason} : E${playEpisode}` : 'Direct Stream'}`;
    streamUrl = isTv
      ? `https://vidsrc.net/embed/tv/${item.id}/${playSeason}/${playEpisode}`
      : `https://vidsrc.net/embed/movie/${item.id}`;

  } else if (type === 'trailer') {
    // ---------------------------------------------------------------
    // 🎞️ Server 8: Official HD Trailer
    // ---------------------------------------------------------------
    badgeLabel = '🎞️ Server 8: Official HD Trailer';
    const videos = item.videos ? item.videos.results : [];
    const trailer = videos.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos[0];
    if (trailer && trailer.key) {
      streamUrl = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0&modestbranding=1${startSeconds > 5 ? `&start=${Math.floor(startSeconds)}` : ''}`;
    }
  }

  if (badge) badge.textContent = badgeLabel;
  state.currentStreamUrl = streamUrl;

  // Initialize Active Playback Memory for real-time progress syncing
  state.activePlayback = {
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    isTv: isTv,
    season: parseInt(season, 10) || 1,
    episode: parseInt(episode, 10) || 1,
    currentTime: startSeconds || 0,
    duration: 0,
    lastSavedAt: Date.now()
  };

  if (startSeconds > 5) {
    const m = Math.floor(startSeconds / 60);
    const s = Math.floor(startSeconds % 60);
    showToast(`▶ Resumed playback from ${m > 0 ? `${m}m ` : ''}${s}s`);
  }

  // Sync Server Select Dropdown if present
  const serverSelect = document.getElementById('player-server-select');
  if (serverSelect && serverSelect.value !== type) {
    serverSelect.value = type;
  }

  // Pop-out Player Button listener
  const popoutBtn = document.getElementById('player-external-btn');
  if (popoutBtn) {
    popoutBtn.onclick = () => {
      if (state.currentStreamUrl) {
        window.open(state.currentStreamUrl, '_blank', 'noopener');
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
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
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
        <p style="margin-top: 0.5rem;">Select a streaming server from the dropdown above.</p>
      </div>
    `;
  }
}

// ==========================================================================
// In-Player Controls Engine: Aspect Ratio, Brightness & Mobile Gestures
// ==========================================================================

export function applyPlayerAspectRatio(ratio) {
  state.aspectRatio = ratio;
  const screen = document.getElementById('cinema-screen');
  if (!screen) return;
  screen.classList.remove('ar-16-9', 'ar-21-9', 'ar-4-3', 'ar-fill');
  screen.classList.add(`ar-${ratio}`);
}

export function applyPlayerBrightness(val) {
  state.brightness = parseInt(val, 10) || 100;
}

export function setupInPlayerControls() {
  // External 3rd party stream players (VidLink, Smashy, AutoEmbed, VidSrc, MultiEmbed) 
  // manage 100% of their pointer, audio, ratio and fullscreen controls natively.
}

function stopVideoPlayback() {
  document.body.classList.remove('cinema-focus-mode');
  const iconEl = document.getElementById('theater-icon');
  const textEl = document.getElementById('theater-text');
  if (iconEl) iconEl.textContent = '💡';
  if (textEl) textEl.textContent = 'Cinema Focus';

  if (state.activePlayback) {
    savePlaybackProgress(state.activePlayback, true);
    state.activePlayback = null;
  }
  destroyNativePlayer();
  if (torrentStatusTimer) {
    clearInterval(torrentStatusTimer);
    torrentStatusTimer = null;
  }
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

  // Save to localStorage
  localStorage.setItem('bingeflix_watch_history', JSON.stringify(state.watchHistory));
  renderHistoryRow();
  updateWatchlistBadge();
}

function renderHistoryRow() {
  // Watch history is kept private in the dedicated Library > Watch History tab
  const section = document.getElementById('section-history');
  if (section) section.style.display = 'none';
}

// ==========================================================================
// Continue Watching Engine (Homepage Row with Instant Resume)
// ==========================================================================
function savePlaybackProgress(active, forceSync = false) {
  if (!active || !active.id) return;
  const now = Date.now();
  if (!forceSync && active.lastSavedAt && (now - active.lastSavedAt < 3000)) return;
  active.lastSavedAt = now;

  const cur = Math.max(0, Math.round(active.currentTime || 0));
  const isTv = Boolean(active.isTv);
  const dur = Math.max(cur, Math.round(active.duration || (isTv ? 1440 : 6000)));
  const progressPct = Math.min(99, Math.max(5, Math.round((cur / dur) * 100)));

  const entry = {
    id: active.id,
    title: active.title,
    poster_path: active.poster_path,
    backdrop_path: active.backdrop_path,
    isTv: isTv,
    season: parseInt(active.season, 10) || 1,
    episode: parseInt(active.episode, 10) || 1,
    currentTime: cur,
    duration: dur,
    progress: progressPct,
    progressSeconds: cur,
    durationSeconds: dur,
    watchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  state.continueWatching = (state.continueWatching || []).filter(m => m.id !== active.id);
  state.continueWatching.unshift(entry);
  if (state.continueWatching.length > 20) state.continueWatching = state.continueWatching.slice(0, 20);

  localStorage.setItem('bingeflix_continue_watching', JSON.stringify(state.continueWatching));
  renderContinueWatchingRow();

  if (state.currentUser && state.currentUser.id) {
    recordContinueWatchingToCloud(state.currentUser.id, entry);
  }
}

function recordContinueWatching(item, season = 1, episode = 1, currentTime = 0, duration = 0) {
  if (!item || !item.id) return;
  const isTv = Boolean(item.isTv || item.first_air_date || (item.seasons && item.seasons.length > 0));

  const existing = (state.continueWatching || []).find(m => m.id === item.id);
  const cur = currentTime > 0 ? Math.round(currentTime) : (existing?.currentTime || existing?.progressSeconds || 0);
  const dur = duration > 0 ? Math.round(duration) : (existing?.duration || existing?.durationSeconds || (isTv ? 1440 : 6000));
  const progressPct = Math.min(99, Math.max(5, Math.round((cur / dur) * 100)));

  const entry = {
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    isTv: isTv,
    season: parseInt(season, 10) || 1,
    episode: parseInt(episode, 10) || 1,
    currentTime: cur,
    duration: dur,
    progress: progressPct,
    progressSeconds: cur,
    durationSeconds: dur,
    watchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  state.continueWatching = (state.continueWatching || []).filter(m => m.id !== item.id);
  state.continueWatching.unshift(entry);
  if (state.continueWatching.length > 20) state.continueWatching = state.continueWatching.slice(0, 20);

  localStorage.setItem('bingeflix_continue_watching', JSON.stringify(state.continueWatching));
  renderContinueWatchingRow();

  if (state.currentUser && state.currentUser.id) {
    recordContinueWatchingToCloud(state.currentUser.id, entry);
  }
}

function renderContinueWatchingRow() {
  const section = document.getElementById('section-continue-watching');
  const track = document.getElementById('continue-watching-row');
  if (!section || !track) return;

  if (!state.continueWatching || state.continueWatching.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  track.innerHTML = '';

  state.continueWatching.forEach(item => {
    const card = document.createElement('div');
    card.className = 'continue-card';

    const thumbUrl = item.backdrop_path
      ? `${IMG_BASE_URL}/w500${item.backdrop_path}`
      : (item.poster_path ? `${IMG_BASE_URL}/w500${item.poster_path}` : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&q=80');

    // Dynamic watch progress bar
    let pct = 15;
    if (item.progress !== undefined && item.progress > 0) {
      pct = item.progress;
    } else if (item.currentTime && item.duration) {
      pct = Math.round((item.currentTime / item.duration) * 100);
    } else if (item.progressSeconds && item.durationSeconds) {
      pct = Math.round((item.progressSeconds / item.durationSeconds) * 100);
    }
    pct = Math.max(5, Math.min(100, pct));

    // Clean, compact EP badge
    const epBadgeText = item.isTv ? (item.episode ? `EP ${item.episode}` : 'Series') : 'Movie';

    // Human readable duration string
    let timeLabel = item.watchedAt || 'Recently';
    if (item.currentTime && item.currentTime > 60) {
      const curM = Math.floor(item.currentTime / 60);
      if (item.duration && item.duration > 60) {
        const totM = Math.floor(item.duration / 60);
        timeLabel = `${curM}m of ${totM}m`;
      } else {
        timeLabel = `${curM}m watched`;
      }
    }

    card.innerHTML = `
      <div class="continue-thumb-box">
        <span class="continue-ep-badge">${epBadgeText}</span>
        <button class="continue-remove-btn" title="Remove from Continue Watching" data-item-id="${item.id}">✕</button>
        <img src="${thumbUrl}" alt="${item.title}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&q=80';" />
        <div class="continue-play-overlay">
          <div class="continue-play-btn-circle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          </div>
        </div>
      </div>
      <div class="continue-progress-line">
        <div class="continue-progress-fill" style="width: ${pct}%;"></div>
      </div>
      <div class="continue-info">
        <div class="continue-title">${item.title}</div>
        <div class="continue-meta">
          <span>${item.isTv ? `S${item.season || 1} : E${item.episode || 1}` : 'Movie'}</span>
          <span>${timeLabel}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.continue-remove-btn')) {
        e.stopPropagation();
        deleteFromContinueWatching(item.id);
        return;
      }
      const resumeSec = item.currentTime || item.progressSeconds || 0;
      openPlayerView(item.id, item.isTv, item.season || 1, item.episode || 1, true, resumeSec);
    });

    track.appendChild(card);
  });
}

function deleteFromContinueWatching(id) {
  state.continueWatching = (state.continueWatching || []).filter(m => m.id !== id);
  localStorage.setItem('bingeflix_continue_watching', JSON.stringify(state.continueWatching));
  renderContinueWatchingRow();
  if (state.currentUser && state.currentUser.id) {
    clearContinueWatchingInCloud(state.currentUser.id);
    state.continueWatching.forEach(it => recordContinueWatchingToCloud(state.currentUser.id, it));
  }
  showToast('Removed from Continue Watching');
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

  localStorage.setItem('bingeflix_watchlist', JSON.stringify(state.watchlist));
  if (state.currentUser && state.currentUser.id) {
    syncWatchlistToCloud(state.currentUser.id, state.watchlist);
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
// Event Listeners & Interactive Controls
// ==========================================================================
function setupEventListeners() {
  const headerWatchlistBtn = document.getElementById('nav-header-watchlist');
  if (headerWatchlistBtn) {
    headerWatchlistBtn.addEventListener('click', () => {
      switchView('watchlist');
    });
  }

  // Category & Genre Pills Click Handlers
  document.querySelectorAll('.genre-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const filter = e.currentTarget.dataset.filter;
      if (filter) {
        if (filter === 'all') switchView('home');
        else if (filter === 'bollywood') switchView('bollywood');
        else if (filter === 'hollywood') switchView('hollywood');
        else if (filter === 'anime') switchView('anime');
        else if (filter === 'series') switchView('series');
        else if (filter === 'south') {
          switchView('bollywood');
          const el = document.getElementById('section-south');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Clear History Confirmation Modal
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
    confirmClearBtn.addEventListener('click', () => {
      if (confirmClearModal) confirmClearModal.style.display = 'none';
      state.watchHistory = [];
      localStorage.setItem('bingeflix_watch_history', '[]');
      renderLibraryView();
      updateWatchlistBadge();
      showToast('🗑️ Watch history cleared');
    });
  }

  // Keyboard Shortcuts Handler (Space: Play/Pause, C: Cinema Focus, Esc: Exit Focus)
  window.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }

    // 'C' toggles Cinema Focus Mode
    if (e.key === 'c' || e.key === 'C') {
      const playerView = document.getElementById('player-view');
      if (playerView && playerView.style.display !== 'none') {
        const theaterBtn = document.getElementById('player-theater-btn');
        if (theaterBtn) theaterBtn.click();
      }
    }

    // 'Escape' exits Cinema Focus Mode
    if (e.key === 'Escape') {
      if (document.body.classList.contains('cinema-focus-mode')) {
        const theaterBtn = document.getElementById('player-theater-btn');
        if (theaterBtn) theaterBtn.click();
      }
    }

    if (e.key === ' ' || e.code === 'Space') {
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

function updateUserUI() {
  const count = state.watchlist.length;
  const headerCount = document.getElementById('header-watchlist-count');
  if (headerCount) headerCount.textContent = count;

  const badge = document.getElementById('watchlist-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }

  const navAuthLabel = document.getElementById('nav-auth-label');
  const navAuthIcon = document.getElementById('nav-auth-icon');
  const navAuthBtn = document.getElementById('nav-auth-btn');
  const drawerAuthBtn = document.getElementById('drawer-auth-btn');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownEmail = document.getElementById('dropdown-user-email');

  if (state.currentUser) {
    document.body.classList.add('user-logged-in');
    const name = state.currentUser.name || state.currentUser.username || 'User';
    const avatarUrl = getAvatarUrl(state.currentUser.avatar || 'goku');
    if (navAuthLabel) navAuthLabel.textContent = name;
    if (navAuthIcon) {
      navAuthIcon.innerHTML = `<img src="${avatarUrl}" class="nav-avatar-img" alt="${name}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--accent-red);" />`;
    }
    if (navAuthBtn) {
      navAuthBtn.style.borderColor = 'var(--accent-red)';
      navAuthBtn.title = name;
    }
    if (drawerAuthBtn) drawerAuthBtn.textContent = `👤 ${name}`;
    if (dropdownName) dropdownName.textContent = name;
    if (dropdownEmail) dropdownEmail.textContent = state.currentUser.email || 'Registered User';
    const dropdownAvatar = document.getElementById('dropdown-user-avatar');
    if (dropdownAvatar) {
      dropdownAvatar.innerHTML = `<img src="${avatarUrl}" alt="${name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
    }
  } else {
    document.body.classList.remove('user-logged-in');
    if (navAuthLabel) navAuthLabel.textContent = 'Sign In';
    if (navAuthIcon) {
      navAuthIcon.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      `;
    }
    if (navAuthBtn) {
      navAuthBtn.style.borderColor = 'rgba(229, 9, 20, 0.4)';
      navAuthBtn.title = 'Sign In';
    }
    if (drawerAuthBtn) drawerAuthBtn.textContent = 'Sign In';
    if (dropdownName) dropdownName.textContent = 'Guest User';
    if (dropdownEmail) dropdownEmail.textContent = 'Optional Account';
    const dropdownAvatar = document.getElementById('dropdown-user-avatar');
    if (dropdownAvatar) {
      dropdownAvatar.innerHTML = `<span style="font-size: 1.3rem;">👤</span>`;
    }
  }
}

// ==========================================================================
// Clean Optional Authentication System (Email + Password, No Google Auth)
// ==========================================================================
function setAuthTab(tab) {
  const loginForm = document.getElementById('auth-form-login');
  const signupForm = document.getElementById('auth-form-signup');
  const resetForm = document.getElementById('auth-form-reset');
  const titleEl = document.getElementById('auth-modal-title');
  const subtitleEl = document.getElementById('auth-modal-subtitle');
  const alertBox = document.getElementById('auth-alert-box');
  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.textContent = '';
    alertBox.className = 'auth-alert-box';
  }

  if (loginForm) loginForm.style.display = tab === 'login' ? 'flex' : 'none';
  if (signupForm) signupForm.style.display = tab === 'signup' ? 'flex' : 'none';
  if (resetForm) resetForm.style.display = tab === 'reset' ? 'flex' : 'none';

  const emailGroup = document.getElementById('reset-email-group');
  const passGroup = document.getElementById('reset-password-group');
  const submitResetBtn = document.getElementById('btn-submit-reset');

  if (tab === 'reset') {
    if (state.isPasswordRecovery) {
      if (emailGroup) emailGroup.style.display = 'none';
      if (passGroup) passGroup.style.display = 'block';
      if (submitResetBtn) submitResetBtn.textContent = 'Save New Password';
      if (titleEl) titleEl.textContent = 'Set New Password';
    } else {
      if (emailGroup) emailGroup.style.display = 'block';
      if (passGroup) passGroup.style.display = 'none';
      if (submitResetBtn) submitResetBtn.textContent = 'Send Password Reset Link';
      if (titleEl) titleEl.textContent = 'Reset Password';
    }
  } else {
    if (titleEl) {
      titleEl.textContent = tab === 'signup' ? 'Create Free Account' : 'Sign In to AXON';
    }
  }
  if (subtitleEl) {
    subtitleEl.style.display = 'none';
    subtitleEl.textContent = '';
  }
}

function showAuthAlert(msg, isSuccess = false) {
  const alertBox = document.getElementById('auth-alert-box');
  if (!alertBox) return;
  alertBox.className = `auth-alert-box ${isSuccess ? 'alert-success' : 'alert-error'}`;
  alertBox.textContent = msg;
  alertBox.style.display = 'block';
}

function openAuthModal(tab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  setAuthTab(tab);
  modal.style.display = 'flex';
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.style.display = 'none';
}

function setupAuthSystem() {
  const navAuthBtn = document.getElementById('nav-auth-btn');
  const drawerAuthBtn = document.getElementById('drawer-auth-btn');
  const dropdownMenu = document.getElementById('user-dropdown-menu');
  const closeBtn = document.getElementById('close-auth-modal-btn');
  const modal = document.getElementById('auth-modal');

  const toggleOrOpen = (e) => {
    e.stopPropagation();
    if (state.currentUser && dropdownMenu) {
      const isHidden = dropdownMenu.style.display === 'none' || !dropdownMenu.style.display;
      dropdownMenu.style.display = isHidden ? 'block' : 'none';
    } else {
      openAuthModal('login');
    }
  };

  if (navAuthBtn) navAuthBtn.onclick = toggleOrOpen;
  if (drawerAuthBtn) {
    drawerAuthBtn.onclick = (e) => {
      const drawerBackdrop = document.getElementById('mobile-drawer-backdrop');
      const drawer = document.getElementById('mobile-drawer');
      if (drawer) drawer.classList.remove('open');
      if (drawerBackdrop) drawerBackdrop.style.display = 'none';
      toggleOrOpen(e);
    };
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (dropdownMenu && !e.target.closest('.user-auth-menu-wrapper')) {
      dropdownMenu.style.display = 'none';
    }
  });

  const ddWatchlist = document.getElementById('dropdown-btn-watchlist');
  const ddProfileSettings = document.getElementById('dropdown-btn-profile-settings');
  const ddLogout = document.getElementById('dropdown-btn-logout');

  if (ddWatchlist) {
    ddWatchlist.onclick = () => {
      if (dropdownMenu) dropdownMenu.style.display = 'none';
      switchView('watchlist');
    };
  }
  if (ddProfileSettings) {
    ddProfileSettings.onclick = () => {
      if (dropdownMenu) dropdownMenu.style.display = 'none';
      if (!state.currentUser) {
        showToast('Please sign in first to access Profile Settings.');
        openAuthModal('login');
        return;
      }
      if (typeof window.openProfileSettingsModal === 'function') {
        window.openProfileSettingsModal();
      }
    };
  }
  if (ddLogout) {
    ddLogout.onclick = async () => {
      if (dropdownMenu) dropdownMenu.style.display = 'none';
      await signOutSupabase();
      clearAllAuthSessions();
      state.currentUser = null;
      updateUserUI();
      showToast('Signed out & storage reset. Ready for fresh test!');
    };
  }

  // Auth tabs
  document.getElementById('auth-tab-btn-login')?.addEventListener('click', () => setAuthTab('login'));
  document.getElementById('auth-tab-btn-signup')?.addEventListener('click', () => setAuthTab('signup'));
  document.getElementById('auth-tab-btn-reset')?.addEventListener('click', () => setAuthTab('reset'));

  // Switch links
  document.getElementById('link-to-signup')?.addEventListener('click', () => setAuthTab('signup'));
  document.getElementById('link-to-login')?.addEventListener('click', () => setAuthTab('login'));
  document.getElementById('link-to-forgot-password')?.addEventListener('click', () => setAuthTab('reset'));
  document.getElementById('link-reset-to-login')?.addEventListener('click', () => setAuthTab('login'));

  let selectedAvatarKey = 'goku';
  const avatarGrid = document.getElementById('auth-avatar-grid');
  if (avatarGrid) {
    avatarGrid.innerHTML = '';
    Object.entries(ANIME_AVATARS).forEach(([key, char]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `avatar-pick-btn ${key === selectedAvatarKey ? 'active' : ''}`;
      btn.innerHTML = `
        <img src="${char.path}" class="avatar-img-choice" alt="${char.name}" onerror="this.onerror=null; this.src='./avatars/goku.jpg';" />
        <span class="avatar-name-label">${char.name}</span>
      `;
      btn.onclick = () => {
        selectedAvatarKey = key;
        document.querySelectorAll('#auth-avatar-grid .avatar-pick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const label = document.getElementById('selected-avatar-name');
        if (label) label.textContent = char.name;
      };
      avatarGrid.appendChild(btn);
    });
  }

  // Close modal
  if (closeBtn) closeBtn.onclick = closeAuthModal;
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeAuthModal();
    };
  }

  // 1. Sign In Form (Supabase Cloud Auth)
  const formLogin = document.getElementById('auth-form-login');
  if (formLogin) {
    formLogin.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const submitBtn = formLogin.querySelector('button[type="submit"]');

      if (submitBtn) submitBtn.disabled = true;

      try {
        const { user } = await signInWithEmail(email, password);
        if (user) {
          state.currentUser = user;
          updateUserUI();
          closeAuthModal();
          showToast(`Welcome back, ${user.name || user.username}!`);
          formLogin.reset();

          // Sync cloud watchlist and continue-watching
          fetchWatchlistFromCloud(user.id).then(list => {
            if (list && list.length > 0) {
              state.watchlist = list;
              updateWatchlistBadge();
            }
          });
          fetchContinueWatchingFromCloud(user.id).then(list => {
            if (list && list.length > 0) {
              state.continueWatching = list;
              renderContinueWatchingRow();
            }
          });
        }
      } catch (err) {
        showAuthAlert(err.message || 'Invalid email or password. Please verify your credentials.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  // Real-time Username Availability Check with Supabase
  const signupNameInput = document.getElementById('signup-name');
  const userIcon = document.getElementById('username-status-icon');
  let usernameDebounceTimer = null;
  let isUsernameValid = false;

  if (signupNameInput) {
    signupNameInput.addEventListener('input', () => {
      const val = signupNameInput.value.trim();
      clearTimeout(usernameDebounceTimer);
      signupNameInput.classList.remove('is-valid', 'is-invalid', 'is-checking');

      if (!val || val.length < 3) {
        if (userIcon) userIcon.innerHTML = '';
        isUsernameValid = false;
        return;
      }

      if (userIcon) userIcon.innerHTML = '<span style="color: #facc15; font-size: 0.82rem;">⏳</span>';
      signupNameInput.classList.add('is-checking');

      usernameDebounceTimer = setTimeout(async () => {
        signupNameInput.classList.remove('is-checking');
        const res = await checkUsernameAvailability(val);
        if (res.available) {
          isUsernameValid = true;
          signupNameInput.classList.remove('is-invalid');
          signupNameInput.classList.add('is-valid');
          if (userIcon) userIcon.innerHTML = '<span style="color: #22c55e; font-size: 1.15rem; font-weight: bold; line-height: 1;">✓</span>';
        } else {
          isUsernameValid = false;
          signupNameInput.classList.remove('is-valid');
          signupNameInput.classList.add('is-invalid');
          if (userIcon) userIcon.innerHTML = '<span style="color: #ef4444; font-size: 1.15rem; font-weight: bold; line-height: 1;">✕</span>';
        }
      }, 300);
    });
  }

  // Real-time Email Availability Check (1 account per Gmail/email)
  const signupEmailInput = document.getElementById('signup-email');
  const emailIcon = document.getElementById('email-status-icon');
  let emailDebounceTimer = null;
  let isEmailValid = false;

  if (signupEmailInput) {
    signupEmailInput.addEventListener('input', () => {
      const val = signupEmailInput.value.trim().toLowerCase();
      clearTimeout(emailDebounceTimer);
      signupEmailInput.classList.remove('is-valid', 'is-invalid', 'is-checking');

      if (!val) {
        if (emailIcon) emailIcon.innerHTML = '';
        isEmailValid = false;
        return;
      }

      if (!val.includes('@') || !val.includes('.')) {
        if (emailIcon) emailIcon.innerHTML = '';
        signupEmailInput.classList.add('is-invalid');
        isEmailValid = false;
        return;
      }

      if (emailIcon) emailIcon.innerHTML = '<span style="color: #facc15; font-size: 0.82rem;">⏳</span>';
      signupEmailInput.classList.add('is-checking');

      emailDebounceTimer = setTimeout(async () => {
        signupEmailInput.classList.remove('is-checking');
        const res = await checkEmailAvailability(val);
        if (res.available) {
          isEmailValid = true;
          signupEmailInput.classList.remove('is-invalid');
          signupEmailInput.classList.add('is-valid');
          if (emailIcon) emailIcon.innerHTML = '<span style="color: #22c55e; font-size: 1.15rem; font-weight: bold; line-height: 1;">✓</span>';
        } else {
          isEmailValid = false;
          signupEmailInput.classList.remove('is-valid');
          signupEmailInput.classList.add('is-invalid');
          if (emailIcon) emailIcon.innerHTML = '<span style="color: #ef4444; font-size: 1.15rem; font-weight: bold; line-height: 1;">✕</span>';
        }
      }, 350);
    });
  }

  // 2. Create Account Form (Supabase Cloud Auth)
  const formSignup = document.getElementById('auth-form-signup');
  if (formSignup) {
    formSignup.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const submitBtn = formSignup.querySelector('button[type="submit"]');

      if (!name || !email || !password) {
        showAuthAlert('Please fill in all fields.');
        return;
      }
      if (password.length < 6) {
        showAuthAlert('Password must be at least 6 characters.');
        return;
      }

      if (signupNameInput && signupNameInput.classList.contains('is-invalid')) {
        showAuthAlert('Please choose an available username first.');
        return;
      }
      if (signupEmailInput && signupEmailInput.classList.contains('is-invalid')) {
        showAuthAlert('An account with this email address already exists. Please sign in or use "Forgot Password".');
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      try {
        const { user } = await signUpWithEmail(email, password, name, selectedAvatarKey);
        if (user) {
          state.currentUser = user;
          updateUserUI();
          closeAuthModal();
          showToast('🎉 Account created successfully!');
          formSignup.reset();
          if (userIcon) userIcon.innerHTML = '';
          if (emailIcon) emailIcon.innerHTML = '';
        }
      } catch (err) {
        showAuthAlert(err.message || 'Could not create account. Please try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  // 3. Reset Password Form
  const formReset = document.getElementById('auth-form-reset');
  if (formReset) {
    formReset.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = formReset.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        if (state.isPasswordRecovery) {
          // Recovery flow: User clicked email link and is setting new password
          const newPassword = document.getElementById('reset-new-password').value;
          if (newPassword.length < 6) {
            showAuthAlert('New password must be at least 6 characters.');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          await updateUserPassword(newPassword);
          state.isPasswordRecovery = false;
          showAuthAlert('Password updated successfully! Welcome back.', true);
          showToast('🎉 Password updated! You are now logged in.');
          setTimeout(() => {
            closeAuthModal();
            formReset.reset();
          }, 1500);

        } else {
          // Request flow: User forgot password and wants reset email sent
          const email = document.getElementById('reset-email').value.trim();
          if (!email) {
            showAuthAlert('Please enter your registered email address.');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          await sendPasswordResetEmail(email);
          showAuthAlert('Password reset email sent! Check your inbox for the link.', true);
          showToast('📧 Reset link sent! Check your inbox to reset your password.');
          setTimeout(() => {
            setAuthTab('login');
            formReset.reset();
          }, 4000);
        }
      } catch (err) {
        showAuthAlert(err.message || 'Could not process request. Please check the email and try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
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

// ==========================================================================
// Profile Settings System (Change Username & Anime Icon with Real-time Check)
// ==========================================================================
function setupProfileSettingsSystem() {
  const modal = document.getElementById('profile-settings-modal');
  const closeBtn = document.getElementById('close-profile-settings-btn');
  const form = document.getElementById('form-profile-settings');
  const usernameInput = document.getElementById('settings-username');
  const emailInput = document.getElementById('settings-email');
  const iconSpan = document.getElementById('settings-username-status-icon');
  const alertBox = document.getElementById('settings-alert-box');
  const currentAvatarImg = document.getElementById('settings-current-avatar-img');
  const selectedAvatarLabel = document.getElementById('settings-selected-avatar-name');
  const avatarGrid = document.getElementById('settings-avatar-grid');

  let selectedAvatar = 'goku';
  let debounceTimer = null;

  function showAlert(msg, isSuccess = false) {
    if (!alertBox) return;
    alertBox.style.display = 'block';
    alertBox.textContent = msg;
    alertBox.className = `auth-alert-box ${isSuccess ? 'alert-success' : 'alert-error'}`;
  }

  function hideAlert() {
    if (!alertBox) return;
    alertBox.style.display = 'none';
    alertBox.textContent = '';
  }

  window.openProfileSettingsModal = function () {
    if (!modal) return;
    hideAlert();
    modal.style.display = 'flex';

    if (state.currentUser) {
      selectedAvatar = state.currentUser.avatar || 'goku';
      if (usernameInput) {
        usernameInput.value = state.currentUser.username || state.currentUser.name || '';
        usernameInput.classList.remove('is-valid', 'is-invalid', 'is-checking');
      }
      if (emailInput) {
        emailInput.value = state.currentUser.email || '';
      }
      if (iconSpan) iconSpan.innerHTML = '<span style="color: #22c55e; font-size: 1.15rem; font-weight: bold;">✓</span>';
      if (currentAvatarImg) {
        currentAvatarImg.src = getAvatarUrl(selectedAvatar);
      }
      if (selectedAvatarLabel) {
        selectedAvatarLabel.textContent = ANIME_AVATARS[selectedAvatar]?.name || selectedAvatar;
      }
    }

    // Populate anime avatar picker grid
    if (avatarGrid) {
      avatarGrid.innerHTML = '';
      Object.entries(ANIME_AVATARS).forEach(([key, char]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `avatar-pick-btn ${key === selectedAvatar ? 'active' : ''}`;
        btn.innerHTML = `
          <img src="${char.path}" class="avatar-img-choice" alt="${char.name}" onerror="this.onerror=null; this.src='./avatars/goku.jpg';" />
          <span class="avatar-name-label">${char.name}</span>
        `;
        btn.onclick = () => {
          selectedAvatar = key;
          document.querySelectorAll('#settings-avatar-grid .avatar-pick-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (selectedAvatarLabel) selectedAvatarLabel.textContent = char.name;
          if (currentAvatarImg) currentAvatarImg.src = char.path;
        };
        avatarGrid.appendChild(btn);
      });
    }
  };

  function closeModal() {
    if (modal) modal.style.display = 'none';
    hideAlert();
  }

  if (closeBtn) closeBtn.onclick = closeModal;
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  // Real-time username check against Supabase
  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      const val = usernameInput.value.trim();
      clearTimeout(debounceTimer);
      usernameInput.classList.remove('is-valid', 'is-invalid', 'is-checking');
      hideAlert();

      if (!val || val.length < 3) {
        if (iconSpan) iconSpan.innerHTML = '';
        return;
      }

      // If user kept their own current username
      if (state.currentUser && (state.currentUser.username || '').toLowerCase() === val.toLowerCase()) {
        usernameInput.classList.add('is-valid');
        if (iconSpan) iconSpan.innerHTML = '<span style="color: #22c55e; font-size: 1.15rem; font-weight: bold;">✓</span>';
        return;
      }

      if (iconSpan) iconSpan.innerHTML = '<span style="color: #facc15; font-size: 0.82rem;">⏳</span>';
      usernameInput.classList.add('is-checking');

      debounceTimer = setTimeout(async () => {
        usernameInput.classList.remove('is-checking');
        const res = await checkUsernameAvailability(val);
        if (res.available) {
          usernameInput.classList.remove('is-invalid');
          usernameInput.classList.add('is-valid');
          if (iconSpan) iconSpan.innerHTML = '<span style="color: #22c55e; font-size: 1.15rem; font-weight: bold;">✓</span>';
        } else {
          usernameInput.classList.remove('is-valid');
          usernameInput.classList.add('is-invalid');
          if (iconSpan) iconSpan.innerHTML = '<span style="color: #ef4444; font-size: 1.15rem; font-weight: bold;">✕</span>';
        }
      }, 300);
    });
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!state.currentUser) return;
      const newUsername = usernameInput ? usernameInput.value.trim() : '';
      if (!newUsername || newUsername.length < 3) {
        showAlert('Username must be at least 3 characters.');
        return;
      }
      if (usernameInput && usernameInput.classList.contains('is-invalid')) {
        showAlert('This username is already taken. Please choose an available username.');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const updated = await updateUserProfile(state.currentUser.id, {
          username: newUsername,
          avatar: selectedAvatar
        });
        state.currentUser = updated;
        updateUserUI();
        showAlert('Profile updated successfully!', true);
        showToast('🎉 Profile updated! New username and avatar applied.');
        setTimeout(() => {
          closeModal();
        }, 1200);
      } catch (err) {
        showAlert(err.message || 'Could not update profile. Please try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }
}

// Global Testing Helper for the user to clear all local databases & sessions anytime:
window.clearAxonDB = function () {
  clearAllAuthSessions();
  state.currentUser = null;
  updateUserUI();
  showToast('🧹 Local database and auth sessions cleared!');
  console.log('[AXON] Storage cleared completely for fresh testing.');
};




