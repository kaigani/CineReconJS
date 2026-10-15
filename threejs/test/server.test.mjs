import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createSceneServer, allowedBrowserRequest, ROUTES } from '../server.mjs';
import { parseArgs } from '../config.mjs';

const config = parseArgs(['--scene', '/tmp/scene.mjs', '--output', '/tmp/output',
  '--width', '64', '--height', '64', '--fps', '24', '--frames', '1']);

function request(origin, path, options = {}) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port, path, ...options }, res => {
      let body = ''; res.on('data', data => { body += data; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject); req.end();
  });
}

test('browser request allowlist rejects external URLs and extra same-origin paths', () => {
  const origin = 'http://127.0.0.1:34567';
  for (const path of ROUTES) assert.equal(allowedBrowserRequest(`${origin}${path}`, 'GET', origin), true);
  for (const url of ['https://example.com/', 'file:///etc/passwd', `${origin}/.env`,
    `${origin}/scene.mjs?leak=secret`, `${origin}/scene.mjs#fragment`, 'http://localhost:34567/',
    'http://127.0.0.1:34568/', 'data:text/javascript,alert(1)', 'invalid']) {
    assert.equal(allowedBrowserRequest(url, 'GET', origin), false, url);
  }
  assert.equal(allowedBrowserRequest(origin, 'POST', origin), false);
});

test('server exposes only the explicit source/runtime/Three.js assets', async () => {
  const source = 'export function createScene() {} // fixture';
  const server = await createSceneServer(source, config);
  try {
    for (const route of ROUTES) {
      const response = await request(server.origin, route);
      assert.equal(response.status, 200, route);
      assert.match(response.headers['content-security-policy'], /connect-src 'none'/);
      assert.match(response.headers['content-security-policy'], /worker-src 'none'/);
    }
    assert.equal((await request(server.origin, '/scene.mjs')).body, source);
    const entry = await request(server.origin, '/');
    const importMapText = entry.body.match(/<script type="importmap">(.*?)<\/script>/)[1];
    assert.deepEqual(JSON.parse(importMapText), { imports: { three: '/vendor/three.module.js' } });
    const importMapHash = createHash('sha256').update(importMapText).digest('base64');
    assert.ok(entry.headers['content-security-policy'].includes(`'sha256-${importMapHash}'`));
    assert.ok(!entry.headers['content-security-policy'].includes("script-src 'unsafe-inline'"));
    for (const path of ['/etc/passwd', '/.env', '/package.json', '/node_modules/three/package.json',
      '/vendor/../package.json', '/../README.md', '/%2e%2e/README.md', '/%2fetc%2fpasswd',
      '/scene.mjs?file=../../.env', '/scene.mjs/', '/vendor/three.module.js.map', '/favicon.ico']) {
      assert.equal((await request(server.origin, path)).status, 404, path);
    }
    assert.equal((await request(server.origin, '/', { method: 'POST' })).status, 404);
    assert.equal((await request(server.origin, '/', { headers: { Host: 'evil.example' } })).status, 404);
  } finally { await server.close(); }
});
