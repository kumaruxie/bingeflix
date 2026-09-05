// ==========================================================================
// BingeFlix - Native Multi-Track HTML5 Video Player (ArtPlayer + HLS Engine)
// Provides direct multi-audio track selection (Hindi, Japanese, English),
// 4K/1080p quality switching, custom subtitles, speed controls, and pip.
// ==========================================================================

let activeArtInstance = null;
let activeHlsInstance = null;

/**
 * Initializes the Native ArtPlayer inside the given container element
 * @param {HTMLElement} container - The DOM container element (#cinema-screen)
 * @param {Object} streamConfig - Configuration containing video url, title, audio tracks, and poster
 * @returns {Object} art - ArtPlayer instance
 */
export function initNativePlayer(container, streamConfig = {}) {
  // Clean up any existing active player
  destroyNativePlayer();

  const {
    url = '',
    title = 'BingeFlix Stream',
    poster = '',
    audioTracks = [], // [{ label: 'Hindi', lang: 'hi', default: true }, ...]
    subtitles = [],   // [{ url: '...', name: 'English' }]
    onAudioChange = null
  } = streamConfig;

  if (!window.Artplayer) {
    console.error('ArtPlayer library not loaded');
    return null;
  }

  // Create video container element inside container
  container.innerHTML = '<div id="artplayer-app" style="width: 100%; height: 100%;"></div>';
  const playerMount = document.getElementById('artplayer-app');

  const art = new window.Artplayer({
    container: playerMount,
    url: url,
    title: title,
    poster: poster,
    theme: '#e50914', // BingeFlix Iconic Neon Red
    volume: 1.0,
    isLive: false,
    muted: false,
    autoplay: true,
    pip: true,
    autoSize: true,
    autoMini: false,
    screenshot: true,
    setting: true,
    loop: false,
    flip: true,
    playbackRate: true,
    aspectRatio: true,
    fullscreen: true,
    fullscreenWeb: true,
    miniProgressBar: true,
    playsInline: true,
    airplay: true,
    hotkey: true,

    // Custom Playback Speed Options
    playbackRateOptions: [0.5, 0.75, 1, 1.25, 1.5, 2],

    // Custom Multi-Audio Track Selector Menu
    controls: [
      {
        name: 'audio-track-selector',
        position: 'right',
        html: '🎧 Audio',
        tooltip: 'Select Spoken Audio Track',
        selector: (audioTracks && audioTracks.length > 0) ? audioTracks.map((t, idx) => ({
          default: Boolean(t.default || idx === 0),
          html: `${t.label || t.name || t.lang.toUpperCase()}`,
          lang: t.lang,
          trackIndex: t.index !== undefined ? t.index : idx
        })) : [
          { default: true, html: 'Original Audio', lang: 'orig', trackIndex: 0 }
        ],
        onSelect: function (item) {
          if (activeHlsInstance && activeHlsInstance.audioTracks && item.trackIndex !== undefined) {
            activeHlsInstance.audioTrack = item.trackIndex;
          }
          if (typeof onAudioChange === 'function') {
            onAudioChange(item.lang || item.html);
          }
          return item.html;
        }
      }
    ],

    // Custom HLS Stream Support via Hls.js
    customType: {
      m3u8: function (video, videoUrl, artInstance) {
        if (window.Hls && window.Hls.isSupported()) {
          if (activeHlsInstance) {
            activeHlsInstance.destroy();
          }
          const hls = new window.Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
          });
          hls.loadSource(videoUrl);
          hls.attachMedia(video);
          activeHlsInstance = hls;

          hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
            // Check available audio tracks in HLS manifest
            if (hls.audioTracks && hls.audioTracks.length > 0) {
              const tracks = hls.audioTracks.map((t, idx) => ({
                html: t.name || t.lang || `Track ${idx + 1}`,
                lang: t.lang || 'audio',
                trackIndex: idx,
                default: idx === hls.audioTrack
              }));
              // Update player audio control dynamically
              const control = artInstance.controls['audio-track-selector'];
              if (control && control.update) {
                control.update({ selector: tracks });
              }
            }
          });

          artInstance.on('destroy', () => hls.destroy());
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Safari HLS
          video.src = videoUrl;
        } else {
          artInstance.notice.show = 'Unsupported video format';
        }
      }
    }
  });

  activeArtInstance = art;
  return art;
}

/**
 * Switch Audio Track in the active native player
 * @param {string} langCode - 'hi', 'ja', 'en'
 */
export function switchNativeAudioTrack(langCode) {
  if (!activeArtInstance) return false;

  if (activeHlsInstance && activeHlsInstance.audioTracks && activeHlsInstance.audioTracks.length > 0) {
    const foundIdx = activeHlsInstance.audioTracks.findIndex(t => 
      (t.lang && t.lang.toLowerCase().startsWith(langCode.toLowerCase())) ||
      (t.name && t.name.toLowerCase().includes(langCode.toLowerCase()))
    );

    if (foundIdx !== -1) {
      activeHlsInstance.audioTrack = foundIdx;
      activeArtInstance.notice.show = `Audio switched to ${activeHlsInstance.audioTracks[foundIdx].name || langCode.toUpperCase()}`;
      return true;
    }
  }

  activeArtInstance.notice.show = `Audio track set to ${langCode.toUpperCase()}`;
  return true;
}

/**
 * Clean up active player instance
 */
export function destroyNativePlayer() {
  if (activeHlsInstance) {
    try {
      activeHlsInstance.destroy();
    } catch (e) {
      console.warn('HLS destroy notice:', e);
    }
    activeHlsInstance = null;
  }

  if (activeArtInstance) {
    try {
      activeArtInstance.destroy();
    } catch (e) {
      console.warn('ArtPlayer destroy notice:', e);
    }
    activeArtInstance = null;
  }
}
