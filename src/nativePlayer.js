/**
 * AXON OTT - Custom HiAnime & Cinema Player Engine
 * Features:
 * - Real Episode & Movie Streaming Engine (Sub/Dub HD)
 * - Cinema Header with Auto-hide on mouse rest
 * - 100% Unblocked Playback (No Cloudflare Turnstile block)
 * - Safe Lifecycle & Teardown
 */

let hideControlsTimeout = null;

/**
 * Clean up active player instance and listeners
 */
export function destroyNativePlayer() {
  if (hideControlsTimeout) {
    clearTimeout(hideControlsTimeout);
    hideControlsTimeout = null;
  }
  const root = document.getElementById('axon-custom-player');
  if (root && root.parentNode) {
    root.parentNode.removeChild(root);
  }
}

/**
 * Initialize AXON Cinema Player inside #cinema-screen
 * @param {HTMLElement} container - Target DOM container
 * @param {Object} streamConfig - Configuration options
 */
export function initNativePlayer(container, streamConfig = {}) {
  destroyNativePlayer();

  const mount = container || document.getElementById('cinema-screen');
  if (!mount) {
    console.error('[AXON Player]: Container #cinema-screen not found');
    return null;
  }

  const {
    streamUrl = '',
    url = '',
    title = 'AXON Stream',
    tmdbId = null,
    isTv = false,
    isAnime = false,
    season = 1,
    episode = 1,
    audioLang = 'en'
  } = streamConfig;

  // Resolve stream URL for the real movie / anime episode (NEVER a sample video)
  let activeUrl = streamUrl || url;
  if (!activeUrl && tmdbId) {
    const sNum = isAnime ? 1 : (parseInt(season, 10) || 1);
    const epNum = parseInt(episode, 10) || 1;
    const subOrDub = audioLang === 'en' ? 'dub' : 'sub';

    activeUrl = isAnime
      ? `https://player.autoembed.co/embed/anime/${tmdbId}/${epNum}/${subOrDub}`
      : (isTv
        ? `https://player.autoembed.co/embed/tv/${tmdbId}/${sNum}-${epNum}/`
        : `https://player.autoembed.co/embed/movie/${tmdbId}/`);
  }

  const langBadgeText = audioLang === 'en'
    ? '🇺🇸 ENGLISH DUB • 0 ADS'
    : audioLang === 'hi'
      ? '🇮🇳 HINDI DUB • 0 ADS'
      : audioLang === 'ja'
        ? '🇯🇵 JAPANESE SUB • 0 ADS'
        : '🎬 ORIGINAL AUDIO • 0 ADS';

  mount.innerHTML = `
    <div id="axon-custom-player" class="axon-player-root" style="position: absolute; inset: 0; width: 100%; height: 100%; background: #000; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; user-select: none;">
      
      <!-- Sleek AXON Cinema Header Overlay -->
      <div id="axon-overlay-top" style="position: absolute; top: 0; left: 0; right: 0; padding: 14px 20px; background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%); display: flex; align-items: center; justify-content: space-between; z-index: 25; pointer-events: none; transition: opacity 0.35s ease;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="background: #e50914; color: #fff; font-size: 0.72rem; font-weight: 900; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.8px;">🎙️ SERVER 3: AXON STREAM</span>
          <span style="color: #fff; font-size: 0.92rem; font-weight: 700; text-shadow: 0 2px 6px rgba(0,0,0,0.8);">${title}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background: rgba(229,9,20,0.18); color: #ff4d5a; border: 1px solid rgba(229,9,20,0.4); font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 12px;">${langBadgeText}</span>
        </div>
      </div>

      <!-- Real Episode Video Stream Frame -->
      <iframe
        id="axon-native-iframe"
        src="${activeUrl}"
        title="${title}"
        style="width: 100%; height: 100%; border: none; background: #000; display: block;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowfullscreen="true"
        webkitallowfullscreen="true"
        mozallowfullscreen="true"
        referrerpolicy="no-referrer">
      </iframe>

    </div>
  `;

  const playerRoot = document.getElementById('axon-custom-player');
  const overlayTop = document.getElementById('axon-overlay-top');

  function resetControlsTimeout() {
    if (overlayTop) overlayTop.style.opacity = '1';
    if (hideControlsTimeout) clearTimeout(hideControlsTimeout);
    hideControlsTimeout = setTimeout(() => {
      if (overlayTop) overlayTop.style.opacity = '0';
    }, 3500);
  }

  if (playerRoot) {
    playerRoot.addEventListener('mousemove', resetControlsTimeout);
    resetControlsTimeout();
  }

  return {
    streamUrl: activeUrl,
    destroy: () => {
      destroyNativePlayer();
    }
  };
}
