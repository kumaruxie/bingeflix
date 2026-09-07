// ==========================================================================
// AXON OTT - Stream Source Resolver Engine (Stremio + Debrid Powered)
// Queries Torrentio with Real-Debrid / Torbox cloud acceleration
// for instant 4K, true multi-audio playback with zero buffering.
// ==========================================================================

import { getDebridConfig } from './debridModal.js';

const STREAM_CACHE = new Map();

const BACKEND_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:5000'
  : '';

/**
 * Resolves direct multi-track stream for Native OTT Player
 * @param {Object} item - TMDB movie/show details
 * @param {boolean} isTv - Whether series or movie
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @param {boolean} preferHindi - Prefer Hindi audio track if available
 * @returns {Promise<Object|null>} streamConfig containing url, audioTracks, subtitles, resolutions
 */
export async function resolveDirectStream(item, isTv = false, season = 1, episode = 1, preferHindi = false, streamIndex = null) {
  if (!item || !item.id) return null;

  const { provider: debridProvider, key: debridKey, isConfigured } = getDebridConfig();
  const cacheKey = `${item.id}-${season}-${episode}-${preferHindi}-${streamIndex ?? 'auto'}-${isConfigured ? debridKey.slice(0, 5) : 'free'}`;

  if (STREAM_CACHE.has(cacheKey)) {
    return STREAM_CACHE.get(cacheKey);
  }

  const mediaType = isTv ? 'tv' : 'movie';
  const queryParams = new URLSearchParams({
    tmdbId: String(item.id),
    type: mediaType,
    season: String(season),
    episode: String(episode),
    preferHindi: String(preferHindi)
  });

  if (streamIndex !== null && streamIndex !== undefined) {
    queryParams.append('streamIndex', String(streamIndex));
  }

  if (isConfigured) {
    queryParams.append('debridProvider', debridProvider);
    queryParams.append('debridKey', debridKey);
  }

  // STEP 1: Query Dedicated AXON Torrentio + Debrid Engine (/api/torrent/resolve)
  const apiUrls = [
    `${BACKEND_BASE}/api/torrent/resolve?${queryParams.toString()}`,
    `/api/torrent/resolve?${queryParams.toString()}`
  ];

  for (const apiUrl of apiUrls) {
    try {
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.streamUrl) {
          const basePrefix = apiUrl.startsWith('http') ? BACKEND_BASE : '';
          const fullStreamUrl = data.streamUrl.startsWith('http')
            ? data.streamUrl
            : `${basePrefix}${data.streamUrl}`;

          const config = {
            url: fullStreamUrl,
            title: data.title || item.title || item.name || 'AXON Cinema Stream',
            provider: data.provider || (data.isDebrid ? 'debrid' : 'torrent_bridge'),
            tmdbId: item.id,
            imdbId: data.imdbId,
            mediaType,
            season,
            episode,
            isDebrid: Boolean(data.isDebrid),
            requiresDebrid: Boolean(data.requiresDebrid),
            hasHindi: Boolean(data.hasHindi),
            quality: data.quality || '1080p FHD',
            seeds: data.seeds,
            size: data.size,
            audioTracks: data.audioTracks || [
              { id: 'hi', lang: 'hi', label: 'Hindi Dubbed 🇮🇳', default: data.hasHindi },
              { id: 'en', lang: 'en', label: 'English / Original', default: !data.hasHindi }
            ],
            subtitles: data.subtitles || [],
            resolutions: data.qualities || ['4K Ultra HD', '1080p FHD', '720p HD'],
            streams: data.streams || [],
            totalSources: data.totalSources || 0,
            hindiSources: data.hindiSources || 0
          };

          STREAM_CACHE.set(cacheKey, config);
          return config;
        } else if (data.success && (data.requiresDebrid || !data.streamUrl)) {
          return {
            requiresDebrid: true,
            isDebrid: false,
            totalSources: data.totalSources || 0,
            hindiSources: data.hindiSources || 0,
            streams: data.streams || [],
            imdbId: data.imdbId,
            title: item.title || item.name
          };
        }
      }
    } catch (err) {
      console.warn('[StreamResolver] Debrid/Torrent query notice:', err.message);
    }
  }

  // STEP 2: Fallback to Universal Streams endpoint
  try {
    const fallbackRes = await fetch(`${BACKEND_BASE}/api/streams/${item.id}?type=${mediaType}&season=${season}&episode=${episode}`);
    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      if (data.success && data.streamUrl) {
        const fullStreamUrl = data.streamUrl.startsWith('http') ? data.streamUrl : `${BACKEND_BASE}${data.streamUrl}`;
        const config = {
          url: fullStreamUrl,
          title: item.title || item.name || data.title || 'AXON Cinema Stream',
          provider: data.provider || 'universal',
          tmdbId: item.id,
          mediaType,
          season,
          episode,
          audioTracks: data.audioTracks || [{ id: 'orig', lang: 'en', label: 'Original Audio', default: true }],
          subtitles: [],
          resolutions: ['1080p', '720p', '480p']
        };
        STREAM_CACHE.set(cacheKey, config);
        return config;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Fetch all available torrent / Debrid releases for a movie or TV episode
 */
export async function fetchTorrentSources(item, isTv = false, season = 1, episode = 1) {
  if (!item || !item.id) return [];
  const { provider: debridProvider, key: debridKey, isConfigured } = getDebridConfig();
  const mediaType = isTv ? 'series' : 'movie';
  const queryParams = new URLSearchParams({
    tmdbId: String(item.id),
    type: mediaType,
    season: String(season),
    episode: String(episode)
  });
  if (isConfigured) {
    queryParams.append('debridProvider', debridProvider);
    queryParams.append('debridKey', debridKey);
  }

  try {
    const res = await fetch(`${BACKEND_BASE}/api/torrent/sources?${queryParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return data.streams || [];
    }
  } catch (e) {
    console.warn('Failed to fetch torrent releases:', e);
  }
  return [];
}
