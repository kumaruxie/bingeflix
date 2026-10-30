import { defineConfig } from 'vite';
import http from 'http';
import https from 'https';
import { URL } from 'url';

function hlsCorsProxyPlugin() {
  return {
    name: 'hls-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy-stream', (req, res) => {
        try {
          const reqUrl = new URL(req.url, 'http://localhost:3000');
          const target = reqUrl.searchParams.get('url');

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (!target) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          const parsedTarget = new URL(target);
          const client = parsedTarget.protocol === 'https:' ? https : http;

          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Referer': parsedTarget.origin + '/',
            'Origin': parsedTarget.origin
          };

          const proxyReq = client.request(parsedTarget, { headers, method: req.method }, (proxyRes) => {
            // Handle HTTP redirects
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
              const redirectUrl = new URL(proxyRes.headers.location, target).href;
              res.writeHead(302, {
                Location: `/api/proxy-stream?url=${encodeURIComponent(redirectUrl)}`,
                'Access-Control-Allow-Origin': '*'
              });
              res.end();
              return;
            }

            const contentType = proxyRes.headers['content-type'] || '';
            const isM3u8 = contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL') || target.includes('.m3u8');

            res.writeHead(proxyRes.statusCode || 200, {
              'Content-Type': contentType || (isM3u8 ? 'application/vnd.apple.mpegurl' : 'video/MP2T'),
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': '*'
            });

            if (isM3u8) {
              let body = '';
              proxyRes.setEncoding('utf8');
              proxyRes.on('data', chunk => { body += chunk; });
              proxyRes.on('end', () => {
                // Rewrite relative URLs inside the playlist to pass through this proxy
                const rewritten = body.split('\n').map(line => {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed.startsWith('#')) return line;
                  try {
                    const absoluteUrl = new URL(trimmed, target).href;
                    return `/api/proxy-stream?url=${encodeURIComponent(absoluteUrl)}`;
                  } catch {
                    return line;
                  }
                }).join('\n');
                res.end(rewritten);
              });
            } else {
              proxyRes.pipe(res);
            }
          });

          proxyReq.on('error', (err) => {
            res.statusCode = 502;
            res.end(`Proxy error: ${err.message}`);
          });

          proxyReq.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(e.message);
        }
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [hlsCorsProxyPlugin()],
  server: {
    port: 3000,
    host: true,
    open: false,
    proxy: {
      '/api/torrent': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
});
