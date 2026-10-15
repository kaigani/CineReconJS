"""Prepare a hash-reviewed scene and collect explicit outputs, never execute it."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys

ROOT = Path('examples/astra_iterative')
OUT = Path('runs/astra-iterative')
ARTIFACT = Path('runs/astra-artifact')
SAMPLE_FRAMES = [0, 17, 33, 50, 67, 83, 100, 117, 133, 150, 167, 183,
                 200, 216, 233, 250, 266, 283, 300, 316, 333, 350, 366, 383]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def candidate():
    request = json.loads((ROOT / 'render_request.json').read_text())
    revision = request['revision']
    if not re.fullmatch(r'[0-9]{3}', revision):
        raise ValueError('Invalid revision ID')
    folder = ROOT / 'revisions' / revision
    response_bytes = (folder / 'decision.json').read_bytes()
    decision = json.loads(response_bytes)
    if decision['action'] != 'render' or not isinstance(decision['scene_source'], str):
        raise ValueError('Candidate must request rendering a complete source')
    source = decision['scene_source'].encode('utf-8')
    review = json.loads((folder / 'safety_review.json').read_text())
    assert sha(source) == request['scene_sha256'] == review['scene_sha256']
    assert sha(response_bytes) == request['decision_sha256']
    assert review['approved_for_isolated_render'] is True
    assert len(source) <= 2 * 1024 * 1024
    return request, folder, source


def prepare():
    request, _, source = candidate()
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / 'scene.mjs'
    if target.exists():
        raise RuntimeError('Do not overwrite a candidate')
    target.write_bytes(source)
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('revision=' + request['revision'] + '\n')
    print(json.dumps({'revision': request['revision'], 'source_sha256': sha(source)}))


def collect():
    request, folder, source = candidate()
    ARTIFACT.mkdir(parents=True, exist_ok=False)
    for path in [ROOT / 'render_request.json', folder / 'decision.json',
                 folder / 'safety_review.json', folder / 'provenance.json']:
        if path.is_symlink():
            raise ValueError('Symlinks are not artifacts')
        shutil.copyfile(path, ARTIFACT / path.name)
    (ARTIFACT / 'scene.mjs').write_bytes(source)
    for name in ['scene.json', 'reconstruction.mp4', 'renderer-metadata.json', 'renderer-error.json']:
        path = OUT / name
        if path.is_file() and not path.is_symlink():
            shutil.copyfile(path, ARTIFACT / name)
    frames = []
    (ARTIFACT / 'frames').mkdir()
    for sample, frame in enumerate(SAMPLE_FRAMES):
        path = OUT / 'frames' / f'frame_{frame:06d}.png'
        if path.is_file() and not path.is_symlink():
            name = f'sample_{sample:06d}.png'
            shutil.copyfile(path, ARTIFACT / 'frames' / name)
            frames.append({'sample': sample, 'frame': frame, 'time_sec': frame * 1001 / 24000,
                           'file': f'frames/{name}', 'sha256': sha(path.read_bytes())})
    (ARTIFACT / 'feedback_manifest.json').write_text(json.dumps({
        'revision': request['revision'], 'samples': frames,
        'frame_source': 'original renderer PNG at exact matching input frame index',
        'github_run_id': os.environ.get('GITHUB_RUN_ID'),
        'github_run_attempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
        'github_sha': os.environ.get('GITHUB_SHA')
    }, indent=2) + '\n')
    hashes = {str(p.relative_to(ARTIFACT)): sha(p.read_bytes())
              for p in sorted(ARTIFACT.rglob('*')) if p.is_file()}
    (ARTIFACT / 'checksums.json').write_text(json.dumps(hashes, indent=2) + '\n')
    print(json.dumps({'revision': request['revision'], 'files': len(hashes), 'preview_frames': len(frames)}))


if __name__ == '__main__':
    {'prepare': prepare, 'collect': collect}[sys.argv[1]]()
