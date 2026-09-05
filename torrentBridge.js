// ==========================================================================
// BingeFlix - Torrentio & WebTorrent Streaming Bridge
// Discovers verified Dual-Audio / Hindi Dubbed torrents and streams
// sequential video chunks over HTTP 206 directly into BingeFlix Player.
// ==========================================================================

import WebTorrent from 'webtorrent';
import url from 'url';

let client = null;
let activeTorrent = null;
let activeInfoHash = null;

function getClient() {
  if (!client) {
    client = new WebTorrent({
      maxConns: 55,
      dht: true,
      tracker: true
    });
    client.on('error', (err) => {
      console.warn('[WebTorrent Error]:', err.message);
    });
  }
  return client;
}

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.therarbg.to:6969/announce',
  'udp://zer0day.ch:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.publictracker.xyz:6969/announce',
  'udp://tracker.qu.ax:6969/announce'
];

/**
 * Express / Connect middleware plugin for Vite
 */
export function torrentBridgePlugin() {
  return {
    name: 'torrent-streaming-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const query = parsedUrl.query;

        // --------------------------------------------------------------------
        // ENDPOINT 1: /api/torrent/sources
        // Queries Torrentio for streams, filters Hindi & Dual-Audio
        // --------------------------------------------------------------------
        if (pathname === '/api/torrent/sources') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          const { imdbId, type = 'movie', season, episode } = query;
          if (!imdbId) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing imdbId parameter' }));
          }

          try {
            const streamPath = type === 'series' && season && episode
              ? `series/${imdbId}:${season}:${episode}.json`
              : `movie/${imdbId}.json`;

            const torrentioUrl = `https://torrentio.strem.fun/stream/${streamPath}`;
            const resp = await fetch(torrentioUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            if (!resp.ok) {
              return res.end(JSON.stringify({ streams: [], total: 0, hindiCount: 0 }));
            }

            const data = await resp.json();
            const rawStreams = data.streams || [];

            // Process & categorize streams
            const processed = rawStreams.map((s) => {
              const titleText = `${s.name || ''}\n${s.title || ''}`;
              
              // Detect genuine Hindi Dubbed / Indian Multi-Audio indicators
              const hasHindi = Boolean(
                titleText.includes('🇮🇳') ||
                /\b(hindi|hin)\b/i.test(titleText) ||
                /\[.*?\b(hin|hindi)\b.*?\]/i.test(titleText) ||
                /\b(tam|tel)\s*\+\s*hin/i.test(titleText)
              );

              // Extract Seeders
              const seedMatch = titleText.match(/👤\s*(\d+)/);
              const seeds = seedMatch ? parseInt(seedMatch[1], 10) : 0;

              // Extract File Size
              const sizeMatch = titleText.match(/💾\s*([\d.]+\s*(?:GB|MB))/i);
              const size = sizeMatch ? sizeMatch[1] : 'Unknown';

              // Extract Provider
              const provMatch = titleText.match(/⚙️\s*([^\n]+)/);
              const provider = provMatch ? provMatch[1].trim() : 'Torrent';

              // Quality
              let quality = '1080p';
              if (/4k|2160p/i.test(titleText)) quality = '4K Ultra';
              else if (/720p/i.test(titleText)) quality = '720p';

              return {
                name: s.name,
                title: s.title,
                infoHash: s.infoHash,
                fileIdx: s.fileIdx !== undefined ? s.fileIdx : 0,
                filename: (s.behaviorHints && s.behaviorHints.filename) || '',
                hasHindi,
                seeds,
                size,
                provider,
                quality,
                sources: s.sources || []
              };
            });

            // Sort: Hindi first, then by seeds descending
            processed.sort((a, b) => {
              if (a.hasHindi && !b.hasHindi) return -1;
              if (!a.hasHindi && b.hasHindi) return 1;
              return b.seeds - a.seeds;
            });

            const hindiStreams = processed.filter(s => s.hasHindi);

            return res.end(JSON.stringify({
              streams: processed,
              hindiStreams: hindiStreams,
              total: processed.length,
              hindiCount: hindiStreams.length
            }));

          } catch (err) {
            console.error('[Torrentio Fetch Error]:', err);
            return res.end(JSON.stringify({ error: err.message, streams: [] }));
          }
        }

        // --------------------------------------------------------------------
        // ENDPOINT 2: /api/torrent/status
        // Returns live torrent buffering and download speed
        // --------------------------------------------------------------------
        if (pathname === '/api/torrent/status') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          if (!activeTorrent) {
            return res.end(JSON.stringify({ active: false }));
          }

          const progress = (activeTorrent.progress * 100).toFixed(1);
          const downloadSpeed = (activeTorrent.downloadSpeed / (1024 * 1024)).toFixed(2); // MB/s
          const peers = activeTorrent.numPeers;

          return res.end(JSON.stringify({
            active: true,
            infoHash: activeInfoHash,
            name: activeTorrent.name,
            progress: parseFloat(progress),
            downloadSpeed: `${downloadSpeed} MB/s`,
            numPeers: peers,
            ready: activeTorrent.progress > 0.02 || activeTorrent.downloaded > 20 * 1024 * 1024 // ready if 20MB buffered
          }));
        }

let pendingTorrentLoads = new Map();

function loadTorrent(torrentClient, infoHash) {
  const existing = torrentClient.get(infoHash);
  if (existing) {
    if (existing.ready || (existing.files && existing.files.length > 0)) {
      return Promise.resolve(existing);
    }
    return new Promise((resolve, reject) => {
      const onReady = () => {
        if (typeof existing.removeListener === 'function') existing.removeListener('error', onError);
        resolve(existing);
      };
      const onError = (err) => {
        if (typeof existing.removeListener === 'function') existing.removeListener('ready', onReady);
        reject(err);
      };
      if (typeof existing.on === 'function') {
        existing.on('ready', onReady);
        existing.on('error', onError);
      } else {
        resolve(existing);
      }
    });
  }

  if (pendingTorrentLoads.has(infoHash)) {
    return pendingTorrentLoads.get(infoHash);
  }

  const promise = new Promise((resolve, reject) => {
    const trackersParam = DEFAULT_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');
    const magnetUri = `magnet:?xt=urn:btih:${infoHash}${trackersParam}`;

    let isSettled = false;
    let t;

    try {
      t = torrentClient.add(magnetUri, {
        destroyStoreOnDestroy: true
      }, (torrent) => {
        if (isSettled) return;
        isSettled = true;
        pendingTorrentLoads.delete(infoHash);
        resolve(torrent);
      });
    } catch (err) {
      pendingTorrentLoads.delete(infoHash);
      return reject(err);
    }

    t.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        pendingTorrentLoads.delete(infoHash);
        reject(err);
      }
    });

    // 15-second timeout if swarm has 0 active seeders
    setTimeout(() => {
      if (!isSettled && pendingTorrentLoads.has(infoHash)) {
        isSettled = true;
        pendingTorrentLoads.delete(infoHash);
        try { t.destroy(); } catch (e) {}
        reject(new Error('P2P swarm timeout: No active peers found'));
      }
    }, 15000);
  });

  pendingTorrentLoads.set(infoHash, promise);
  return promise;
}

        // --------------------------------------------------------------------
        // ENDPOINT 3: /api/torrent/stop
        // Stops and cleans up active torrent
        // --------------------------------------------------------------------
        if (pathname === '/api/torrent/stop') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          pendingTorrentLoads.clear();
          if (activeTorrent) {
            try {
              activeTorrent.destroy();
            } catch (e) {}
            activeTorrent = null;
            activeInfoHash = null;
          }

          return res.end(JSON.stringify({ stopped: true }));
        }

        // --------------------------------------------------------------------
        // ENDPOINT 4: /api/torrent/stream
        // Sequential HTTP 206 Partial Content video stream
        // --------------------------------------------------------------------
        if (pathname === '/api/torrent/stream') {
          const { infoHash, fileIdx } = query;
          if (!infoHash) {
            if (!res.headersSent) {
              res.statusCode = 400;
              res.end('Missing infoHash parameter');
            }
            return;
          }

          const torrentClient = getClient();

          loadTorrent(torrentClient, infoHash)
            .then((torrent) => {
              if (res.headersSent || res.writableEnded) return;

              activeTorrent = torrent;
              activeInfoHash = infoHash;

              // Find target video file
              let targetFile = null;
              if (fileIdx !== undefined && torrent.files[parseInt(fileIdx, 10)]) {
                targetFile = torrent.files[parseInt(fileIdx, 10)];
              } else {
                targetFile = torrent.files.reduce((a, b) => (a.length > b.length ? a : b), torrent.files[0]);
              }

              if (!targetFile) {
                if (!res.headersSent) {
                  res.statusCode = 404;
                  res.end('No playable file found in torrent');
                }
                return;
              }

              try {
                targetFile.select();
                torrent.files.forEach(f => {
                  if (f !== targetFile) f.deselect();
                });
              } catch (e) {}

              // Content type
              const nameLower = targetFile.name.toLowerCase();
              let contentType = 'video/mp4';
              if (nameLower.endsWith('.mkv')) contentType = 'video/x-matroska';
              else if (nameLower.endsWith('.webm')) contentType = 'video/webm';

              const total = targetFile.length;
              const range = req.headers.range;

              if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
                const chunksize = (end - start) + 1;

                if (!res.headersSent) {
                  res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${total}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*'
                  });
                }

                const stream = targetFile.createReadStream({ start, end });
                stream.pipe(res);

                const clean = () => {
                  try { stream.destroy(); } catch (e) {}
                };
                req.on('close', clean);
                res.on('close', clean);
                stream.on('error', (err) => {
                  clean();
                });
              } else {
                if (!res.headersSent) {
                  res.writeHead(200, {
                    'Content-Length': total,
                    'Content-Type': contentType,
                    'Accept-Ranges': 'bytes',
                    'Access-Control-Allow-Origin': '*'
                  });
                }

                const stream = targetFile.createReadStream();
                stream.pipe(res);

                const clean = () => {
                  try { stream.destroy(); } catch (e) {}
                };
                req.on('close', clean);
                res.on('close', clean);
                stream.on('error', (err) => {
                  clean();
                });
              }
            })
            .catch((err) => {
              console.warn('[P2P Stream Warning]:', err.message);
              if (!res.headersSent && !res.writableEnded) {
                res.statusCode = 503;
                res.end('P2P stream temporarily unavailable: ' + err.message);
              }
            });

          return;
        }

        next();
      });
    }
  };
}
