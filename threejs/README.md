# Deterministic Three.js video renderer

This is the authored rendering backend for the CineRecon Three.js adaptation.
It never imports generated scene code into Node. It loads one scene module in
headless Chromium, advances an explicit frame timeline, saves full-resolution
PNG frames, and encodes and validates a constant-frame-rate MP4 with FFmpeg.

## Install and run

Requirements: Node 20+, FFmpeg/ffprobe with libx264, and a working Chromium
environment. Dependencies are pinned in `package.json` and `package-lock.json`.

```sh
cd threejs
npm ci --ignore-scripts
npx playwright install chromium
node render.mjs --scene scenes/demo.mjs --output /tmp/my-new-render \
  --width 640 --height 360 --fps 30000/1001 --frames 60 --seed 7
```

The browser revision installed by the pinned Playwright package is preferred.
If absent, `/usr/bin/chromium`, `/usr/bin/chromium-browser`, and
`/usr/bin/google-chrome` are considered in that order. For another installation,
pass `--chromium-executable /absolute/path`. Actual browser, Three.js,
Playwright, Node, FFmpeg, and WebGL versions are recorded in the output.
The browser uses SwiftShader rather than relying on a machine-specific GPU.
Install OS browser dependencies separately if needed; see the official
[Playwright browser setup](https://playwright.dev/docs/browsers).

Use a fresh output directory for every render or refinement attempt. An
existing `scene.mjs` is allowed when it is the exact input path. Existing frames
or output artifacts are rejected rather than silently mixed or overwritten.
The renderer does not call a model, judge, or external asset service.

## Scene API

Provide a single UTF-8 `.mjs` module no larger than 2 MiB:

```js
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#e67332' }),
  );
  mesh.name = 'Subject';
  scene.add(mesh, new THREE.HemisphereLight(0xffffff, 0x444444, 3));
  return { scene, camera, update(time, frame) {
    mesh.rotation.y = time * 0.5;
    camera.position.set(4 + Math.sin(time) * 0.2, 2, 6);
    camera.lookAt(0, 0, 0);
  } };
}
```

An optional `import * as THREE from 'three'` resolves through the fixed,
CSP-hash-authorized import map. Additional source modules, external imports,
external assets, filesystem reads, and network requests are unsupported.
Create geometry, materials, lighting, rigs, and procedural textures in code.
Keep subject parts and articulated pivots editable and give them useful names.

Both `createScene` and `update` must be synchronous. `update` is called exactly
once per frame with `time = frame * fpsDenominator / fpsNumerator`, for frames
`0` through `frames - 1`. `duration` is `frames / fps`; the final sample is one
frame interval before that endpoint. FPS is supplied as a number to the scene;
the host retains the exact input rational for timing and encoding.

Compute every animated object, joint, camera position/orientation, and shot
change from absolute `time`/`frame`. Do not accumulate delta time or depend on
execution speed. Use `AnimationMixer.setTime(time)` when appropriate.
`requestAnimationFrame` is rejected; there is no real-time animation loop.
Do not use timers, network completion, audio clocks, `crypto` randomness,
unseeded custom randomness, or CSS animation to drive motion. `Math.random`
is seeded before importing the authored scene; `Date.now()` and
`performance.now()` follow simulation time. Use the supplied `seed` for any
additional deterministic generator.

Renderer settings are fixed: device pixel ratio 1, antialiasing, opaque output,
sRGB output, ACES filmic tone mapping at exposure 1, and PCF soft shadows. Set
camera aspect and scene lighting explicitly. The runtime updates camera
projection and world matrices before each render.

## Outputs and validation

```text
run/
  scene.mjs                 # editable source, including animation
  scene.json                # Three.js scene + camera snapshot at frame 0
  reconstruction.mp4       # H.264, constant rational FPS, no audio
  renderer-metadata.json   # successful completion marker + provenance
  frames/frame_000000.png  # full-resolution frame sequence
```

`scene.json` contains separate `scene` and `camera` entries that can be loaded
using `THREE.ObjectLoader`. It preserves editable static geometry/materials at
frame 0. It does not serialize JavaScript animation functions; retain
`scene.mjs` to reproduce motion. The JSON also records timeline configuration.

Every PNG has a SHA-256 hash and exact sampled time in the metadata.
`ffprobe` decodes the MP4 to verify dimensions, frame count, average rational
frame rate, duration, and **every frame presentation timestamp**, starting at
zero. Even-sized videos use yuv420p; odd dimensions use yuv444p without resizing.
Some players do not support yuv444p. No frames are padded, interpolated, or
repeated to correct a timing mismatch.

Missing API exports, scene exceptions, console errors, rejected network
attempts, CSP violations, WebGL loss, invalid video properties, and timeouts
cause a nonzero exit. `--frame-timeout-ms` defaults to 30000 and bounds scene
initialization and individual frame operations. FFmpeg and ffprobe also have
finite timeouts. A failed render writes `renderer-error.json` when possible,
and can leave partial files for diagnosis. Only `renderer-metadata.json` with
`status: "complete"` marks a successful verified render.

Failure artifacts include `stage` and `kind`. `kind: "infrastructure"` covers
server startup, browser launch/context failure, lost browser/WebGL contexts,
host filesystem/environment problems, screenshots, encoding, and probing.
`kind: "scene"` covers module loading/initialization, the scene API contract,
update exceptions or hangs, scene export, and browser policy violations.
Unknown failures conservatively count as infrastructure. A reconstruction
harness must abort infrastructure failures rather than spend model repair
budget on them, including when they occur after a healthy browser launch.
Errors that prevent writing the output directory are reported on stderr.

Deterministic scheduling does not imply identical pixels across software
versions, operating systems, GPU drivers, or malicious/nonconforming scene
code. Pin the browser, runtime, and platform for repeatability. The smoke test
compares actual PNG hashes across two independent runs.
Metadata explicitly records `determinismConformance: "unaudited_generated_source"`.
The runtime does not prove that arbitrary authored updates use absolute time or
that every timer/randomness source is absent. Audit generated source separately;
the demo's absolute-time unit test only establishes the behavior of that fixture.

## Security boundary

Generated code is untrusted. Run it in a fresh disposable container or VM with
no user credentials, cloud tokens, SSH keys, host home directory, or sensitive
mounts. Disable outbound networking at the container/VM boundary while allowing
its own loopback HTTP connection, and impose CPU, memory, process, disk, and
wall-time limits. Install dependencies and the browser before disabling
network access. Mount only the runtime, scene, and dedicated writable output.
Browser exploit resistance and resource exhaustion require this outer boundary.

Chromium's own sandbox is **enabled by default**. Configure an environment that
supports it; see the official [Playwright Docker security
guidance](https://playwright.dev/docs/docker). Only for an already-isolated
disposable environment that cannot support the Chromium sandbox, an operator
may explicitly add `--allow-no-sandbox`. This prints a warning and records the
choice in metadata. Never use it to weaken an ordinary user browser session or
workstation. It does not fix an OS that forbids Chromium's required sockets.

Defense-in-depth restrictions in the runner:

- A fresh browser profile and context; service workers blocked; downloads refused.
- A minimal browser environment that does not inherit host credentials.
- Only five exact loopback routes: `/`, `/runtime.mjs`, `/scene.mjs`,
  `/vendor/three.module.js`, and `/vendor/three.core.js`.
- The server preloads explicit files. It is never a static server for the repo,
  scene directory, output directory, or host filesystem. Raw traversal paths,
  query strings, unexpected Host headers, and non-GET requests are rejected.
- Browser routing blocks external origins and extra same-origin routes;
  WebSockets are closed. CSP disallows connections, workers, frames, forms,
  and external scripts. Only procedural inline data/blob images are permitted.

These restrictions are not a hostile-code sandbox. Generated code and the
rendering runtime share a page, so scene code can tamper with browser objects,
consume resources, or attempt browser exploits. Container isolation is required
even when all route tests pass. Do not include evaluation annotations, answers,
other tasks' scenes, or the reference-video pixels in this browser's assets.

## Tests

```sh
npm test                  # unit, strict server routing, absolute camera, real FFmpeg tests
npm run smoke             # no model/API: two actual Chromium renders + identical PNG hashes
npm run test:browser      # smoke, bare import, runtime failure and network-negative tests
```

The default suite explicitly skips browser integration tests. `smoke` and
`test:browser` require a functioning Chromium and fail rather than skip when it
cannot launch. `CHROMIUM_EXECUTABLE=/absolute/path` selects a browser for those
scripts. `CINERECON_ALLOW_NO_SANDBOX=1` is the test-script equivalent of the
explicit isolation-only flag. `CINERECON_SMOKE_OUTPUT=/new/path` preserves smoke
artifacts at a chosen location; otherwise the script prints its temporary path.

### Validation in the initial implementation environment

On 2026-10-15, fourteen non-browser tests passed, including real H.264 encoding and
decoded timestamp validation at 30000/1001 for 64x48 and 65x49 frames. Twelve
browser tests were not executable in that environment. System Chromium 154
aborted before page load at `process_singleton_posix.cc` because its Unix-domain
`socket()` returned `EPERM`; approved elevated execution had the same result.
An independent Node Unix-domain socket probe also returned `EPERM`, while all
TCP-loopback server tests passed. No successful WebGL PNG/MP4 smoke result was
claimed for that environment. Run the browser suite in a suitable isolated
runtime before relying on it for benchmark generation.
