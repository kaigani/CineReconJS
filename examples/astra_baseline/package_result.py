"""Transport this bounded experiment through job logs, without artifact storage.

Only explicit output files are included. The bundle is data, never executable by
this helper. Decode the numbered base64 records and verify its SHA-256 locally.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
import zipfile

root = Path('runs/astra-video1-l1')
fixture = Path('examples/astra_baseline/video1_l1_no_refine')
files = []
for name in ['first_response.json', 'provenance.json', 'input_manifest.json', 'prompt.txt']:
    files.append((fixture / name, name))
for name in ['scene.mjs', 'scene.json', 'reconstruction.mp4', 'renderer-metadata.json', 'renderer-error.json']:
    if (root / name).is_file():
        files.append((root / name, name))
for frame in [0, 50, 100, 167, 217, 283, 333, 383]:
    p = root / 'frames' / f'frame_{frame:06d}.png'
    if p.is_file():
        files.append((p, f'preview_frames/{p.name}'))
buffer = io.BytesIO()
with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path, name in files:
        if path.is_symlink():
            raise RuntimeError('Refusing symlink in result bundle')
        archive.writestr(name, path.read_bytes())
data = buffer.getvalue()
if len(data) > 8 * 1024 * 1024:
    raise RuntimeError('Result bundle exceeds the bounded log-transport size')
print('ASTRA_BUNDLE_META:' + json.dumps({'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
    'files': [name for _, name in files]}), flush=True)
encoded = base64.b64encode(data).decode('ascii')
for i, start in enumerate(range(0, len(encoded), 4096)):
    print(f'ASTRA_BUNDLE_DATA:{i:06d}:' + encoded[start:start+4096], flush=True)
print('ASTRA_BUNDLE_END', flush=True)
