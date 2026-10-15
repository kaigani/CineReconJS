const SCENE_STAGES = new Set(['scene-initialize', 'scene-module', 'scene-contract',
  'scene-update', 'scene-export', 'browser-policy', 'browser-console']);
const ENVIRONMENT_CODES = new Set(['EACCES', 'EADDRINUSE', 'EADDRNOTAVAIL', 'EIO',
  'EMFILE', 'ENFILE', 'ENOENT', 'ENOMEM', 'ENOSPC', 'EPERM', 'EROFS']);

// Unknown stages fail conservatively as infrastructure: do not spend model
// repair budget on a host condition that the generated source cannot fix.
export function classifyRenderError(error, stage = 'unknown') {
  if (error?.renderStage && ['scene', 'infrastructure'].includes(error.renderKind)) {
    return { stage: error.renderStage, kind: error.renderKind };
  }
  if (ENVIRONMENT_CODES.has(error?.code)) return { stage: 'environment', kind: 'infrastructure' };
  if (/target (?:page|browser|context).*closed|browser has been closed|browser.*disconnect|page crashed/i.test(error?.message ?? '')) {
    return { stage: 'browser-runtime', kind: 'infrastructure' };
  }
  if (/WebGL context lost|Error creating WebGL context/i.test(error?.message ?? '')) {
    return { stage: 'webgl-runtime', kind: 'infrastructure' };
  }
  return { stage, kind: SCENE_STAGES.has(stage) ? 'scene' : 'infrastructure' };
}

export function renderFailure(error, stage, kind) {
  const classification = kind ? { stage, kind } : classifyRenderError(error, stage);
  const failure = new Error(error?.message ?? String(error), { cause: error });
  failure.renderStage = classification.stage;
  failure.renderKind = classification.kind;
  return failure;
}

export async function atStage(stage, operation) {
  try { return await operation(); }
  catch (error) { throw renderFailure(error, stage); }
}
