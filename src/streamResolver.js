// ==========================================================================
// AXON OTT - Stream Source Resolver Engine
// Connects to Dedicated Backend Stream Engine (Mux, Cloudflare Stream, Direct HLS)
// with fallback to Local Torrent Bridge & Verified HLS Master Manifests
// ==========================================================================

// In-Memory Stream Cache
const STREAM_CACHE = new Map();

/**
 * Resolves direct multi-track HLS stream for Native OTT Player
 * @param {Object} item - TMDB movie/show details
 * @param {boolean} isTv - Whether series or movie
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @param {boolean} preferHindi - Prefer Hindi audio track if available
 * @returns {Promise<Object|null>} streamConfig containing url, audioTracks, subtitles, resolutions
 */
export async function resolveDirectStream(item, isTv = false, season = 1, episode = 1, preferHindi = false) {
  if (!item || !item.id) return null;

  const cacheKey = `${item.id}-${season}-${episode}-${preferHindi}`;
  if (STREAM_CACHE.has(cacheKey)) {
    return STREAM_CACHE.get(cacheKey);
  }

  const mediaType = isTv ? 'tv' : 'movie';

  // STEP 1: Query Dedicated AXON Backend Stream Engine (/api/streams/:tmdbId)
  try {
    const backendRes = await fetch(`/api/streams/${item.id}?type=${mediaType}&season=${season}&episode=${episode}`);
    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data.success && data.streamUrl) {
        let selectedAudioTracks = data.audioTracks || [];

        // If user prefers Hindi and Hindi is present, mark it as default
        if (preferHindi && selectedAudioTracks.length > 0) {
          selectedAudioTracks = selectedAudioTracks.map(t => ({
            ...t,
            default: Boolean(t.lang === 'hi' || (t.label && t.label.toLowerCase().includes('hindi')))
          }));
        }

        const config = {
          url: data.streamUrl,
          title: item.title || item.name || data.title || 'AXON Cinema Stream',
          provider: data.provider || 'direct_hls',
          audioTracks: selectedAudioTracks,
          subtitles: data.subtitles || [],
          resolutions: data.resolutions || ['Auto', '1080p', '720p', '480p', '360p'],
          isDemoFallback: Boolean(data.isDemoFallback)
        };

        STREAM_CACHE.set(cacheKey, config);
        return config;
      }
    }
  } catch (err) {
    console.warn('[StreamResolver] Backend stream query notice:', err.message);
  }

  // STEP 2: Secondary Fallback to Torrent Bridge if IMDB ID exists
  const imdbId = (item.external_ids && item.external_ids.imdb_id) || item.imdb_id;
  if (imdbId) {
    try {
      const res = await fetch(`/api/torrent/sources?imdbId=${imdbId}&type=${isTv ? 'series' : 'movie'}&season=${season}&episode=${episode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.streams && data.streams.length > 0) {
          const targetStream = (preferHindi && data.hindiStreams && data.hindiStreams.length > 0)
            ? data.hindiStreams[0]
            : (data.hindiStreams && data.hindiStreams[0]) || data.streams[0];

          if (targetStream) {
            const config = {
              url: `/api/torrent/stream?infoHash=${targetStream.infoHash}&fileIdx=${targetStream.fileIdx}`,
              title: item.title || item.name || 'AXON Cinema Stream',
              provider: 'torrent_bridge',
              audioTracks: [
                { id: 'hi', lang: 'hi', label: 'Hindi Dubbed', default: targetStream.hasHindi },
                { id: 'en', lang: 'en', label: 'English / Original', default: !targetStream.hasHindi }
              ],
              subtitles: [],
              resolutions: ['Original', '1080p', '720p']
            };
            STREAM_CACHE.set(cacheKey, config);
            return config;
          }
        }
      }
    } catch (torrentErr) {
      console.warn('[StreamResolver] Torrent fallback notice:', torrentErr.message);
    }
  }

  // If no Mux asset and no torrent stream, return null so player uses real streaming server
  return null;
}
