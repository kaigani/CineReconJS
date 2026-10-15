import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const ROUTES = new Set(['/', '/runtime.mjs', '/scene.mjs',
  '/vendor/three.module.js', '/vendor/three.core.js']);

export function allowedBrowserRequest(url, method, origin) {
  try {
    const parsed = new URL(url);
    return method === 'GET' && parsed.origin === origin && !parsed.search && !parsed.hash &&
      !parsed.username && !parsed.password && ROUTES.has(parsed.pathname);
  } catch { return false; }
}

const IMPORT_MAP = JSON.stringify({ imports: { three: '/vendor/three.module.js' } });
const IMPORT_MAP_HASH = createHash('sha256').update(IMPORT_MAP).digest('base64');
const CSP = ["default-src 'none'", `script-src 'self' 'sha256-${IMPORT_MAP_HASH}'`, "style-src 'unsafe-inline'",
  "img-src data: blob:", "connect-src 'none'", "worker-src 'none'", "frame-src 'none'",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');

export async function createSceneServer(sceneSource, config) {
  // Never map a pathname to a filesystem path. Preload these five exact assets;
  // neither the scene's directory nor the repository is a static web root.
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <link rel="icon" href="data:,">
    <script type="importmap">${IMPORT_MAP}</script>
    <style>html,body{margin:0;overflow:hidden;background:#000}canvas{display:block}</style>
    </head><body><canvas id="render"></canvas><script type="module" src="/runtime.mjs"></script></body></html>`;
  const runtime = await readFile(new URL('./runtime/browser.mjs', import.meta.url), 'utf8');
  const publicConfig = { width: config.width, height: config.height, fps: config.fps.value,
    fpsNumerator: config.fps.numerator, fpsDenominator: config.fps.denominator,
    frames: config.frames, duration: config.duration, seed: config.seed };
  const assets = new Map([
    ['/', ['text/html; charset=utf-8', html]],
    ['/runtime.mjs', ['text/javascript; charset=utf-8', `const CONFIG = Object.freeze(${JSON.stringify(publicConfig)});\n${runtime}`]],
    ['/scene.mjs', ['text/javascript; charset=utf-8', sceneSource]],
    ['/vendor/three.module.js', ['text/javascript; charset=utf-8', await readFile(new URL('./node_modules/three/build/three.module.js', import.meta.url))]],
    ['/vendor/three.core.js', ['text/javascript; charset=utf-8', await readFile(new URL('./node_modules/three/build/three.core.js', import.meta.url))]],
  ]);
  let expectedHost;
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    // Match the raw path. Encoded slashes, traversal, query strings, additional
    // local files and DNS-rebinding Host headers do not become valid routes.
    if (req.headers.host !== expectedHost || req.method !== 'GET' || !assets.has(req.url)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return;
    }
    const [type, body] = assets.get(req.url);
    res.writeHead(200, { 'Content-Type': type }); res.end(body);
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  expectedHost = `127.0.0.1:${server.address().port}`;
  return { origin: `http://${expectedHost}`, server,
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
