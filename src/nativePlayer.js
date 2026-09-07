// ==========================================================================
// AXON OTT - Native Multi-Track HTML5 Video Player (ArtPlayer + HLS Engine)
// Features:
// 1. Adaptive Bitrate (ABR Auto / 1080p / 720p / 480p / 360p)
// 2. Multi-Audio Track Switcher (Japanese / Hindi / English)
// 3. Subtitle Selector (.vtt WebVTT tracks & native CC)
// 4. Playback Progress Memory (5s heartbeat sync to /api/progress & auto-resume)
// ==========================================================================

let activeArtInstance = null;
let activeHlsInstance = null;
let progressHeartbeatTimer = null;

/**
 * Format seconds into HH:MM:SS or MM:SS string
 */
function formatTime(seconds) {
  const s = Math.floor(seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Send progress heartbeat to backend & local storage
 */
async function syncPlaybackProgress(tmdbId, mediaType, season, episode, currentTime, duration) {
  if (!tmdbId || !duration || duration < 5) return;

  const storageKey = `axon_progress_${tmdbId}_${mediaType}_${season}_${episode}`;
  const payload = {
    tmdbId,
    mediaType,
    season: parseInt(season, 10),
    episode: parseInt(episode, 10),
    progressSeconds: Math.floor(currentTime),
    durationSeconds: Math.floor(duration),
    updatedAt: Date.now()
  };

  // Immediate Local Persistence
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (e) {
    // ignore
  }

  // Backend Heartbeat Sync
  try {
    const deviceId = localStorage.getItem('bingeflix_device_id') || 'guest_device';
    await fetch('/api/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // Soft fallback if backend is momentarily unreachable
  }
}

/**
 * Retrieve saved progress timestamp
 */
async function getSavedProgress(tmdbId, mediaType, season, episode) {
  const storageKey = `axon_progress_${tmdbId}_${mediaType}_${season}_${episode}`;

  // Check local storage first (instant 0ms response)
  let localData = null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) localData = JSON.parse(raw);
  } catch (e) {
    // ignore
  }

  // Fetch from backend in parallel
  try {
    const deviceId = localStorage.getItem('bingeflix_device_id') || 'guest_device';
    const res = await fetch(`/api/progress/${tmdbId}?type=${mediaType}&season=${season}&episode=${episode}`, {
      headers: { 'x-device-id': deviceId }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.progress && data.progress.progressSeconds > 10) {
        return data.progress.progressSeconds;
      }
    }
  } catch (err) {
    // ignore
  }

  if (localData && localData.progressSeconds > 10 && (localData.progressSeconds / localData.durationSeconds) < 0.92) {
    return localData.progressSeconds;
  }

  return 0;
}

/**
 * Initializes the Native ArtPlayer inside the container element
 * @param {HTMLElement} container - DOM container element (#cinema-screen)
 * @param {Object} streamConfig - Configuration containing video url, title, audio tracks, subtitles, etc.
 * @returns {Object} art - ArtPlayer instance
 */
export function initNativePlayer(container, streamConfig = {}) {
  // Clean up any existing active player and timers
  destroyNativePlayer();

  const {
    url = '',
    title = 'AXON Stream',
    poster = '',
    tmdbId = null,
    mediaType = 'movie',
    season = 1,
    episode = 1,
    audioTracks = [],
    subtitles = [],
    qualities = [],
    resolutions = ['Auto', '1080p', '720p', '480p', '360p'],
    onAudioChange = null,
    onEnded = null,
    onError = null
  } = streamConfig;

  if (!window.Artplayer) {
    console.error('ArtPlayer library not loaded');
    return null;
  }

  // Mount container
  container.innerHTML = '<div id="artplayer-app" style="width: 100%; height: 100%;"></div>';
  const playerMount = document.getElementById('artplayer-app');

  // Prepare Custom Controls
  const qualityList = (qualities && qualities.length > 0)
    ? qualities.map((q, idx) => ({
        default: idx === 0,
        html: q.quality || `Stream ${idx + 1}`,
        url: q.url
      }))
    : [
        { default: true, html: 'Auto (ABR)', levelIndex: -1 },
        { html: '1080p (FHD)', levelIndex: 0 },
        { html: '720p (HD)', levelIndex: 1 },
        { html: '480p (SD)', levelIndex: 2 },
        { html: '360p (Data Saver)', levelIndex: 3 }
      ];

  const controls = [
    // 1. Quality Control
    {
      name: 'quality-selector',
      position: 'right',
      html: `📺 ${qualityList[0] ? qualityList[0].html : 'Auto'}`,
      tooltip: 'Playback Quality',
      selector: qualityList,
      onSelect: function (item) {
        if (item.url && activeArtInstance) {
          activeArtInstance.switchUrl(item.url);
          activeArtInstance.notice.show = `Quality set to: ${item.html}`;
        } else if (activeHlsInstance && item.levelIndex !== undefined) {
          activeHlsInstance.currentLevel = item.levelIndex;
          if (activeArtInstance) {
            activeArtInstance.notice.show = `Quality set to: ${item.html}`;
          }
        }
        return item.html;
      }
    },

    // 2. Multi-Audio Track Selector Menu
    {
      name: 'audio-track-selector',
      position: 'right',
      html: '🎧 Audio',
      tooltip: 'Audio Language (Hindi, Japanese, English)',
      selector: (audioTracks && audioTracks.length > 0) ? audioTracks.map((t, idx) => ({
        default: Boolean(t.default || idx === 0),
        html: `${t.label || t.name || (t.lang ? t.lang.toUpperCase() : `Track ${idx + 1}`)}`,
        lang: t.lang || 'en',
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
        if (activeArtInstance) {
          activeArtInstance.notice.show = `Audio: ${item.html}`;
        }
        return item.html;
      }
    },

    // 3. Subtitles Selector Menu
    {
      name: 'subtitle-selector',
      position: 'right',
      html: '💬 Subtitles',
      tooltip: 'Closed Captions & Subtitles (.vtt)',
      selector: [
        { default: true, html: 'Off', subUrl: null, lang: 'off' },
        ...(subtitles && subtitles.length > 0 ? subtitles.map((s, idx) => ({
          default: false,
          html: `${s.label || s.name || s.lang || `Subtitle ${idx + 1}`}`,
          subUrl: s.url,
          lang: s.lang
        })) : [
          { default: false, html: 'English CC', subUrl: '', lang: 'en' },
          { default: false, html: 'Hindi', subUrl: '', lang: 'hi' }
        ])
      ],
      onSelect: function (item) {
        if (!activeArtInstance) return item.html;

        if (item.subUrl) {
          activeArtInstance.subtitle.init({
            url: item.subUrl,
            type: 'vtt',
            style: {
              color: '#ffffff',
              fontSize: '22px',
              textShadow: '0 2px 4px rgba(0,0,0,0.9)'
            }
          });
          activeArtInstance.subtitle.show = true;
          activeArtInstance.notice.show = `Subtitles: ${item.html}`;
        } else if (item.lang === 'off') {
          activeArtInstance.subtitle.show = false;
          activeArtInstance.notice.show = 'Subtitles turned off';
        }
        return item.html;
      }
    }
  ];

  const art = new window.Artplayer({
    container: playerMount,
    url: url,
    title: title,
    poster: poster,
    theme: '#e50914', // AXON Iconic Red
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
    playbackRateOptions: [0.5, 0.75, 1, 1.25, 1.5, 2],
    controls: controls,

    // Custom HLS.js Integration for Adaptive Streaming
    customType: {
      m3u8: function (video, videoUrl, artInstance) {
        if (window.Hls && window.Hls.isSupported()) {
          if (activeHlsInstance) {
            activeHlsInstance.destroy();
          }

          const hls = new window.Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            autoStartLoad: true
          });

          hls.loadSource(videoUrl);
          hls.attachMedia(video);
          activeHlsInstance = hls;

          // Event: Manifest Parsed -> Configure Quality and Audio Tracks
          hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
            // 1. Dynamic Quality Levels
            if (hls.levels && hls.levels.length > 0) {
              const qualityLevels = [
                { default: true, html: 'Auto (ABR)', levelIndex: -1 },
                ...hls.levels.map((level, idx) => {
                  const height = level.height || 'HD';
                  const bitrate = level.bitrate ? ` (${Math.round(level.bitrate / 1000)} kbps)` : '';
                  return {
                    html: `${height}p${bitrate}`,
                    levelIndex: idx,
                    default: false
                  };
                })
              ];

              const qualityControl = artInstance.controls['quality-selector'];
              if (qualityControl && qualityControl.update) {
                qualityControl.update({ selector: qualityLevels });
              }
            }

            // 2. Dynamic Audio Tracks
            if (hls.audioTracks && hls.audioTracks.length > 0) {
              const audioTrackList = hls.audioTracks.map((t, idx) => ({
                html: t.name || (t.lang ? t.lang.toUpperCase() : `Track ${idx + 1}`),
                lang: t.lang || 'audio',
                trackIndex: idx,
                default: idx === hls.audioTrack
              }));

              const audioControl = artInstance.controls['audio-track-selector'];
              if (audioControl && audioControl.update) {
                audioControl.update({ selector: audioTrackList });
              }
            }

            // 3. Dynamic Subtitles from HLS manifest
            if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
              const subList = [
                { default: true, html: 'Off', subTrackIndex: -1 },
                ...hls.subtitleTracks.map((s, idx) => ({
                  html: s.name || (s.lang ? s.lang.toUpperCase() : `Sub ${idx + 1}`),
                  subTrackIndex: idx,
                  default: false
                }))
              ];

              const subControl = artInstance.controls['subtitle-selector'];
              if (subControl && subControl.update) {
                subControl.update({
                  selector: subList,
                  onSelect: function (item) {
                    if (item.subTrackIndex !== undefined) {
                      hls.subtitleTrack = item.subTrackIndex;
                      artInstance.notice.show = `Subtitles: ${item.html}`;
                    }
                    return item.html;
                  }
                });
              }
            }
          });

          // Level Switch Feedback
          hls.on(window.Hls.Events.LEVEL_SWITCHED, function (event, data) {
            const level = hls.levels[data.level];
            if (level && artInstance.controls['quality-selector']) {
              const label = hls.autoLevelEnabled ? `Auto (${level.height}p)` : `${level.height}p`;
              artInstance.controls['quality-selector'].innerHTML = `📺 ${label}`;
            }
          });

          artInstance.on('destroy', () => hls.destroy());
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Safari HLS
          video.src = videoUrl;
        } else {
          artInstance.notice.show = 'Unsupported video stream format';
        }
      }
    }
  });

  // --------------------------------------------------------------------------
  // Playback Progress & Auto-Resume Logic
  // --------------------------------------------------------------------------
  art.on('ready', async () => {
    // Check saved resume timestamp
    if (tmdbId) {
      const savedSeconds = await getSavedProgress(tmdbId, mediaType, season, episode);
      if (savedSeconds > 10) {
        art.currentTime = savedSeconds;
        art.notice.show = `▶ Resumed from ${formatTime(savedSeconds)}`;
      }
    }

    // Start 5-Second Interval Progress Heartbeat
    let lastSavedTime = 0;
    const videoElem = art.video;

    if (videoElem) {
      videoElem.addEventListener('timeupdate', () => {
        const current = videoElem.currentTime;
        const duration = videoElem.duration;

        // Throttled: Send sync every 5 seconds or if jumped > 5s
        if (Math.abs(current - lastSavedTime) >= 5 && duration > 0) {
          lastSavedTime = current;
          syncPlaybackProgress(tmdbId, mediaType, season, episode, current, duration);
        }
      });

      videoElem.addEventListener('ended', () => {
        if (duration && tmdbId) {
          syncPlaybackProgress(tmdbId, mediaType, season, episode, duration, duration);
        }
        if (typeof onEnded === 'function') {
          onEnded();
        }
      });
    }
  });

  art.on('error', (err) => {
    console.warn('[ArtPlayer Notice]: Playback interrupted or unplayable stream', err);
    if (typeof onError === 'function') {
      onError(err);
    }
  });

  activeArtInstance = art;
  return art;
}

/**
 * Switch Audio Track in active player (e.g. 'hi', 'ja', 'en')
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
      activeArtInstance.notice.show = `Audio switched to: ${activeHlsInstance.audioTracks[foundIdx].name || langCode.toUpperCase()}`;
      return true;
    }
  }

  activeArtInstance.notice.show = `Audio set to: ${langCode.toUpperCase()}`;
  return true;
}

/**
 * Clean up active player and heartbeat timers
 */
export function destroyNativePlayer() {
  if (progressHeartbeatTimer) {
    clearInterval(progressHeartbeatTimer);
    progressHeartbeatTimer = null;
  }

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
