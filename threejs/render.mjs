#!/usr/bin/env node
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, assertVideoProbe, USAGE } from './config.mjs';
import { allowedBrowserRequest, createSceneServer } from './server.mjs';
import { atStage, classifyRenderError, renderFailure } from './errors.mjs';

const exec = promisify(execFile);
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

export async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

async function exists(file) {
  try { await access(file, constants.F_OK); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function findChromium(config) {
  if (config.chromiumExecutable) return config.chromiumExecutable;
  // Prefer the browser revision pinned by this Playwright package. A system
  // Chromium is a convenience fallback and is recorded in output metadata.
  if (await exists(chromium.executablePath())) return chromium.executablePath();
  for (const file of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (await exists(file)) return file;
  }
  return undefined; // Playwright's installed matching Chromium, if available.
}

export async function encodeFrames(config, framesDir) {
  const pixelFormat = config.width % 2 === 0 && config.height % 2 === 0 ? 'yuv420p' : 'yuv444p';
  const video = path.join(config.output, 'reconstruction.mp4');
  const ffmpegArgs = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
    '-framerate', config.fps.rational, '-start_number', '0', '-i', path.join(framesDir, 'frame_%06d.png'),
    '-frames:v', String(config.frames), '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
    '-pix_fmt', pixelFormat, '-threads', '1', '-fps_mode', 'cfr', '-r', config.fps.rational,
    '-video_track_timescale', String(config.fps.numerator), '-map_metadata', '-1',
    '-fflags', '+bitexact', '-flags:v', '+bitexact', '-movflags', '+faststart', video];
  await atStage('encode', () => exec('ffmpeg', ffmpegArgs, {
    timeout: Math.min(900000, Math.max(30000, config.frames * 2000)), maxBuffer: 2 * 1024 * 1024 }));
  const { stdout: probeOutput } = await atStage('probe', () => exec('ffprobe', ['-v', 'error', '-count_frames',
    '-show_streams', '-show_format', '-show_frames', '-show_entries',
    'stream:format:frame=best_effort_timestamp', '-of', 'json', video], {
    timeout: 120000, maxBuffer: Math.max(2 * 1024 * 1024, config.frames * 200) }));
  const videoStream = await atStage('probe', () => assertVideoProbe(JSON.parse(probeOutput), config));
  const { stdout: ffmpegVersion } = await atStage('environment', () => exec('ffmpeg', ['-version'], { timeout: 10000 }));
  return { pixelFormat, videoStream, ffmpegVersion: ffmpegVersion.split('\n')[0] };
}

export async function render(config) {
  const diagnostics = { browserErrors: [], infrastructureErrors: [], blockedRequests: [], consoleWarnings: [] };
  let server, browser, profile, stage = 'filesystem', outputVerified = false;
  try {
    await mkdir(config.output, { recursive: true });
    for (const name of ['frames', 'scene.json', 'reconstruction.mp4', 'renderer-metadata.json', 'renderer-error.json']) {
      if (await exists(path.join(config.output, name))) {
        throw new Error(`Output already contains ${name}; use a fresh output directory`);
      }
    }
    outputVerified = true;
    if (path.extname(config.scene) !== '.mjs') {
      throw renderFailure(new Error('Scene entry must have a .mjs extension'), 'scene-contract', 'scene');
    }
    const sceneStat = await stat(config.scene);
    if (!sceneStat.isFile() || sceneStat.size > 2 * 1024 * 1024) {
      throw renderFailure(new Error('Scene entry must be a regular file no larger than 2 MiB'), 'scene-contract', 'scene');
    }
    const sceneSource = await readFile(config.scene, 'utf8');
    const outputSource = path.join(config.output, 'scene.mjs');
    if (config.scene !== outputSource) await writeFile(outputSource, sceneSource, { flag: 'wx' });
    const framesDir = path.join(config.output, 'frames');
    await mkdir(framesDir);
    profile = await mkdtemp(path.join(os.tmpdir(), 'cinerecon-chromium-'));
    if (config.allowNoSandbox) {
      console.error('WARNING: Chromium sandbox disabled by explicit --allow-no-sandbox. Use only in a disposable, network-isolated container without credentials.');
    }
    stage = 'server-start';
    server = await createSceneServer(sceneSource, config);
    stage = 'browser-launch';
    const chromiumExecutable = await findChromium(config);
    browser = await chromium.launch({
      executablePath: chromiumExecutable, headless: true,
      timeout: config.frameTimeoutMs,
      chromiumSandbox: !config.allowNoSandbox,
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: profile,
        XDG_CACHE_HOME: path.join(profile, 'cache'), TMPDIR: profile },
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
        '--disable-background-networking', '--disable-component-update', '--disable-sync',
        '--disable-extensions', '--no-first-run', '--force-color-profile=srgb'],
    });
    stage = 'browser-context';
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height },
      deviceScaleFactor: 1, serviceWorkers: 'block', acceptDownloads: false,
      locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light', reducedMotion: 'reduce' });
    context.setDefaultTimeout(config.frameTimeoutMs);
    await context.route('**/*', async route => {
      if (allowedBrowserRequest(route.request().url(), route.request().method(), server.origin)) {
        await route.continue();
      } else {
        diagnostics.blockedRequests.push(route.request().url());
        await route.abort('blockedbyclient');
      }
    });
    await context.routeWebSocket('**/*', socket => {
      diagnostics.blockedRequests.push(socket.url()); socket.close();
    });
    await context.addInitScript(() => {
      globalThis.__cinePolicyViolations = [];
      addEventListener('securitypolicyviolation', event => {
        globalThis.__cinePolicyViolations.push(`${event.violatedDirective}: ${event.blockedURI}`);
      });
    });
    const page = await context.newPage();
    page.on('pageerror', error => diagnostics.browserErrors.push(error.message));
    page.on('crash', () => diagnostics.infrastructureErrors.push('Browser page crashed'));
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.browserErrors.push(message.text());
      if (message.type() === 'warning' && diagnostics.consoleWarnings.length < 100) {
        diagnostics.consoleWarnings.push(message.text());
      }
    });
    context.on('page', popup => {
      diagnostics.browserErrors.push('Scene attempted to open an additional page');
      popup.close().catch(() => {});
    });
    stage = 'runtime-load';
    // Stop waiting at DOM readiness, because module initialization belongs to
    // the scene stage and can itself hang or throw after a healthy launch.
    await page.goto(server.origin, { waitUntil: 'commit', timeout: config.frameTimeoutMs });
    stage = 'scene-initialize';
    await page.waitForFunction(() => globalThis.__cineReady || globalThis.__cineError,
      undefined, { polling: 50, timeout: config.frameTimeoutMs });
    const initError = await withTimeout(page.evaluate(() => globalThis.__cineError),
      config.frameTimeoutMs, 'Scene initialization error check');
    if (initError) {
      const details = typeof initError === 'string' ? { message: initError, stage: 'scene-initialize' } : initError;
      throw renderFailure(new Error(`Scene initialization failed: ${details.message}`), details.stage);
    }
    stage = 'browser-runtime';
    const renderMetadata = await withTimeout(page.evaluate(() => globalThis.__cineMetadata),
      config.frameTimeoutMs, 'Renderer metadata');
    const assertHealthy = async () => {
      if (diagnostics.infrastructureErrors.length) {
        throw renderFailure(new Error(diagnostics.infrastructureErrors.join('; ')), 'browser-runtime', 'infrastructure');
      }
      const violations = await withTimeout(page.evaluate(() => globalThis.__cinePolicyViolations),
        config.frameTimeoutMs, 'Browser health check');
      if (diagnostics.browserErrors.length || diagnostics.blockedRequests.length || violations?.length) {
        throw renderFailure(new Error(`Browser runtime error: ${[
          ...diagnostics.browserErrors, ...diagnostics.blockedRequests.map(url => `Blocked request: ${url}`),
          ...(violations ?? []),
        ].slice(0, 10).join('; ')}`),
        diagnostics.blockedRequests.length || violations?.length ? 'browser-policy' : 'browser-console', 'scene');
      }
    };
    await assertHealthy();
    const frameRecords = [];
    for (let frame = 0; frame < config.frames; frame++) {
      stage = 'scene-update';
      const info = await withTimeout(page.evaluate(frame => globalThis.__cineRenderFrame(frame), frame),
        config.frameTimeoutMs, `Frame ${frame}`);
      await assertHealthy();
      const filename = `frame_${String(frame).padStart(6, '0')}.png`;
      stage = 'screenshot';
      const png = await page.screenshot({ path: path.join(framesDir, filename), type: 'png',
        timeout: config.frameTimeoutMs, animations: 'disabled' });
      frameRecords.push({ ...info, file: `frames/${filename}`, sha256: sha256(png) });
      if (frame === 0) {
        stage = 'scene-export';
        const snapshot = await withTimeout(page.evaluate(() => globalThis.__cineExportScene()),
          config.frameTimeoutMs, 'Scene export');
        stage = 'filesystem';
        await writeFile(path.join(config.output, 'scene.json'), json(snapshot), { flag: 'wx' });
      }
    }
    stage = 'browser-runtime';
    await assertHealthy();
    const browserVersion = browser.version();
    stage = 'cleanup';
    await browser.close(); browser = undefined;
    await server.close(); server = undefined;
    stage = 'encode';
    const { pixelFormat, videoStream, ffmpegVersion } = await encodeFrames(config, framesDir);
    stage = 'metadata';
    const packageInfo = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
    const metadata = {
      format: 'cinerecon-threejs-render-v1', status: 'complete',
      renderer: { ...renderMetadata, browserVersion, nodeVersion: process.version,
        playwrightVersion: packageInfo.dependencies.playwright, threeVersion: packageInfo.dependencies.three,
        chromiumExecutable, browserSource: config.chromiumExecutable ? 'explicit' :
          chromiumExecutable === chromium.executablePath() ? 'playwright-pinned' : 'system-fallback',
        ffmpegVersion, softwareRendering: true },
      sourceSha256: sha256(sceneSource), seed: config.seed,
      width: config.width, height: config.height, fps: config.fps.rational, frames: config.frames,
      duration: config.duration, durationRational: `${config.frames * config.fps.denominator}/${config.fps.numerator}`,
      timeline: 'frame i is rendered once at i * fpsDenominator / fpsNumerator; first frame is t=0',
      snapshotFrame: 0, pixelFormat, video: 'reconstruction.mp4', scene: 'scene.mjs', snapshot: 'scene.json',
      videoProbe: videoStream, frameRecords, diagnostics,
      chromiumSandbox: !config.allowNoSandbox,
      security: 'Route restrictions are defense in depth, not a security sandbox. Untrusted scenes require an isolated container without credentials and with outbound networking disabled.',
      determinism: 'Fixed steps, seeded Math.random, frozen simulation clocks and SwiftShader. Pixel reproducibility is only expected for the same pinned software and platform; arbitrary authored code can violate the contract.',
      determinismConformance: 'unaudited_generated_source',
    };
    await writeFile(path.join(config.output, 'renderer-metadata.json'), json(metadata), { flag: 'wx' });
    return metadata;
  } catch (error) {
    if (outputVerified) {
      await writeFile(path.join(config.output, 'renderer-error.json'), json({ status: 'failed',
        ...classifyRenderError(error, stage), error: error.message, diagnostics }), { flag: 'wx' }).catch(() => {});
    }
    throw renderFailure(error, stage);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
    if (profile) await rm(profile, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes('--help')) { console.log(USAGE); }
  else {
    try {
      const config = parseArgs(process.argv.slice(2));
      const metadata = await render(config);
      console.log(json({ status: metadata.status, output: config.output, frames: metadata.frames,
        fps: metadata.fps, width: metadata.width, height: metadata.height }));
    } catch (error) {
      const { stage, kind } = classifyRenderError(error);
      console.error(`Render failed [${kind}/${stage}]: ${error.message}`); process.exitCode = 1;
    }
  }
}
