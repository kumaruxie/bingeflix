// ==========================================================================
// BingeFlix - Stream Source Resolver Engine
// Resolves direct multi-audio HLS / MP4 streams for Native Player
// ==========================================================================

// Pre-indexed verified Multi-Audio & Direct Streams
const DIRECT_STREAM_ARCHIVES = {};

/**
 * Resolves direct multi-track stream for Native HTML5 ArtPlayer
 * @param {Object} item - TMDB movie/show details
 * @param {boolean} isTv - Whether series or movie
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @param {boolean} preferHindi - Prefer Hindi audio track if available
 * @returns {Promise<Object|null>} streamConfig or null if cloud fallback needed
 */
export async function resolveDirectStream(item, isTv = false, season = 1, episode = 1, preferHindi = false) {
  if (!item || !item.id) return null;

  const key = `${item.id}-${season}-${episode}`;
  if (DIRECT_STREAM_ARCHIVES[key]) {
    return DIRECT_STREAM_ARCHIVES[key];
  }

  const imdbId = (item.external_ids && item.external_ids.imdb_id) || item.imdb_id;
  if (!imdbId) return null;

  try {
    const res = await fetch(`/api/torrent/sources?imdbId=${imdbId}&type=${isTv ? 'series' : 'movie'}&season=${season}&episode=${episode}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.streams || data.streams.length === 0) return null;

    let targetStream = null;
    if (preferHindi && data.hindiStreams && data.hindiStreams.length > 0) {
      targetStream = data.hindiStreams[0];
    } else {
      targetStream = (data.hindiStreams && data.hindiStreams[0]) || data.streams[0];
    }

    if (targetStream) {
      return {
        url: `/api/torrent/stream?infoHash=${targetStream.infoHash}&fileIdx=${targetStream.fileIdx}`,
        stream: targetStream,
        hasHindi: targetStream.hasHindi
      };
    }
  } catch (err) {
    console.warn('resolveDirectStream error:', err);
  }

  return null;
}

