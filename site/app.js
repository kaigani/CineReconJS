// CineReconJS results gallery. Static page: reads data/index.json and data/videoN.json.
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
const fmtUsd = (v) => (v == null ? null : `$${v.toFixed(2)}`);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fmtDur = (s) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
const GITHUB = "https://github.com/kaigani/CineReconJS";

const index = await (await fetch("data/index.json")).json();
const MODELS = Object.fromEntries(index.models.map((m) => [m.id, m]));
const CLIPS = index.clips;
const byId = Object.fromEntries(CLIPS.map((c) => [c.id, c]));
const detailCache = new Map();
const loadClip = (id) => {
  if (!detailCache.has(id)) detailCache.set(id, fetch(`data/${id}.json`).then((r) => r.json()));
  return detailCache.get(id);
};
const modelsFor = (clip) => index.models.filter((m) => clip.models[m.id]);

/* ---------- tooltip ---------- */
const tip = el("div", { className: "tip", hidden: true });
document.body.append(tip);
function attachTip(node, text) {
  const show = (e) => {
    tip.textContent = text;
    tip.hidden = false;
    const r = node.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2;
    tip.style.left = `${Math.min(x + 12, innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${Math.max(8, (e.clientY || r.top) - 34)}px`;
  };
  node.addEventListener("pointermove", show);
  node.addEventListener("focus", show);
  node.addEventListener("pointerleave", () => (tip.hidden = true));
  node.addEventListener("blur", () => (tip.hidden = true));
}

/* ---------- synchronized player ---------- */
function createPlayer(container, sources, { duration, fps = 24 }) {
  container.replaceChildren();
  const videos = sources.map((s) =>
    el("video", { src: s.src, muted: true, playsInline: true, preload: "auto", loop: false, poster: s.poster || "" }));
  const screens = el("div", { className: "screens" });
  screens.style.gridTemplateColumns = `repeat(${sources.length}, 1fr)`;
  sources.forEach((s, i) =>
    screens.append(el("div", { className: "screen" }, videos[i], el("span", { className: "label" }, s.label))));

  const play = el("button", { type: "button", textContent: "Play" });
  const scrub = el("input", { type: "range", min: 0, max: duration, step: 1 / fps, value: 0, ariaLabel: "Seek" });
  const time = el("span", { className: "t", textContent: `0:00 / ${fmtTime(duration)}` });
  const speed = el("select", { ariaLabel: "Speed" },
    ...[0.25, 0.5, 1, 2].map((v) => el("option", { value: v, textContent: `${v}×`, selected: v === 1 })));
  const controls = el("div", { className: "controls" }, play, scrub, time, speed);
  container.append(el("div", { className: "player" }, screens, controls));

  const master = videos[0];
  let raf = 0;
  const seek = (t) => videos.forEach((v) => (v.currentTime = t));
  const tick = () => {
    const t = master.currentTime;
    scrub.value = t;
    time.textContent = `${fmtTime(t)} / ${fmtTime(duration)}`;
    for (const v of videos.slice(1)) if (Math.abs(v.currentTime - t) > 0.15) v.currentTime = t;
    if (master.ended || t >= duration - 0.02) return stop();
    raf = requestAnimationFrame(tick);
  };
  const start = async () => {
    if (master.ended || master.currentTime >= duration - 0.05) seek(0);
    play.textContent = "Pause";
    await Promise.allSettled(videos.map((v) => v.play()));
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    videos.forEach((v) => v.pause());
    play.textContent = "Play";
  };
  play.onclick = () => (master.paused ? start() : stop());
  scrub.oninput = () => {
    seek(+scrub.value);
    time.textContent = `${fmtTime(+scrub.value)} / ${fmtTime(duration)}`;
  };
  speed.onchange = () => videos.forEach((v) => (v.playbackRate = +speed.value));
  videos.forEach((v) => v.addEventListener("click", () => play.click()));
  return { destroy() { stop(); videos.forEach((v) => { v.removeAttribute("src"); v.load(); }); container.replaceChildren(); }, seek };
}

function sourcesFor(detail, withModels = true) {
  const src = [{ label: "Reference", src: detail.reference.video, poster: detail.reference.poster }];
  if (withModels) {
    for (const m of modelsFor(detail)) {
      src.push({ label: MODELS[m.id].short, src: detail.models[m.id].video, poster: detail.models[m.id].poster });
    }
  }
  return src;
}

/* ---------- summary ---------- */
const opusClips = CLIPS.filter((c) => c.models["opus-5-5"]);
const S = index.summary["opus-5-5"];
$("#hero-stats").append(
  ...[
    [CLIPS.length, "reference videos"],
    [opusClips.length, "Opus 5.5 reconstructions"],
    [S.revisions.sum, "scene revisions"],
    [index.models.length, "models run"],
  ].map(([v, l]) => el("div", {}, el("dt", { textContent: l }), el("dd", { textContent: v }))),
);

async function buildSummaryTable() {
  const astraClip = await loadClip("video1");
  const astra = astraClip.models["gpt-6-astra"];
  const o = MODELS["opus-5-5"], a = MODELS["gpt-6-astra"];
  const na = (t) => el("span", { className: "na", textContent: t });
  const rows = [
    ["Videos covered", `${opusClips.length} of ${CLIPS.length}`, a && "1 of 50 (video1 only)"],
    ["Representation", o.level, a.level],
    ["Input", `${o.samples} sampled frames`, `${a.samples} sampled frames`],
    ["Stopping", `${S.stops.model_submit} of ${S.runs} by model submit`, astra ? "1 of 1 by model submit" : null],
    ["Revisions per video", el("span", {}, `mean ${S.revisions.mean}, median ${S.revisions.median}`, el("span", { className: "sm" }, `range ${S.revisions.min}–${S.revisions.max}, ${S.revisions.sum} total`)),
      el("span", {}, `${astra.revisions} on video1`, el("span", { className: "sm" }, `Opus on video1: ${astraClipOpus(astraClip)}`))],
    ["Renders per video", `mean ${(opusClips.reduce((s, c) => s + c.models["opus-5-5"].renders, 0) / opusClips.length).toFixed(1)}`, `${astra.renders} on video1`],
    ["Estimated API cost per video", el("span", {}, `mean ${fmtUsd(S.adj_cost_5m.mean)}, median ${fmtUsd(S.adj_cost_5m.median)}`, el("span", { className: "sm" }, `range ${fmtUsd(S.adj_cost_5m.min)}–${fmtUsd(S.adj_cost_5m.max)}; total ${fmtUsd(S.adj_cost_5m.sum)} (${fmtUsd(S.adj_cost_1h.sum)} with 1-hour cache)`)),
      na("unavailable: no token telemetry")],
    ["Interface", o.interface, a.interface],
    ["Safety ceiling", o.ceiling, a.ceiling],
  ];
  const t = $("#summary-table");
  t.append(
    el("thead", {}, el("tr", {}, el("th", { textContent: "" }), el("th", { textContent: "Claude Opus 5.5" }), el("th", { textContent: "GPT-6 Astra" }))),
    el("tbody", {}, rows.map(([k, x, y]) => el("tr", {}, el("th", { scope: "row", textContent: k }), el("td", {}, x ?? ""), el("td", {}, y ?? "")))),
  );
  const p = index.pricing;
  $("#cost-footnote").textContent =
    `Cost is a hypothetical API list-price estimate (USD per million tokens: $${p.input} input, $${p.output} output, $${p.cache_read} cache read, $${p.cache_write_5m} cache write) from subagent transcript usage. Nothing was billed: runs used a subscription. Cache re-writes after session-limit pauses are repriced as cache reads.`;
}
const astraClipOpus = (c) => c.models["opus-5-5"].revisions;

function buildCharts() {
  const hist = $("#chart-revisions");
  const counts = S.revision_histogram ?? {};
  const keys = Object.keys(counts).map(Number).filter((k) => k >= 1 && k <= 9);
  const max = Math.max(...keys.map((k) => counts[k]));
  hist.append(...keys.map((k) => {
    const b = el("div", { className: "bar", tabIndex: 0 });
    b.style.height = `${(counts[k] / max) * 100}%`;
    b.append(el("span", { className: "v", textContent: counts[k] || "" }));
    attachTip(b, `${counts[k]} video${counts[k] === 1 ? "" : "s"} with ${k} revision${k === 1 ? "" : "s"}`);
    return b;
  }));
  hist.after(el("div", { className: "axis" }, ...keys.map((k) => el("span", { textContent: k }))),
    el("p", { className: "foot", textContent: "Revisions = changed complete scene candidates after the initial generation." }));

  const cost = $("#chart-cost");
  const cmax = Math.max(...opusClips.map((c) => c.models["opus-5-5"].cost));
  cost.append(...opusClips.map((c) => {
    const m = c.models["opus-5-5"];
    const b = el("button", { className: "bar", type: "button", ariaLabel: `${c.id}, ${fmtUsd(m.cost)}` });
    b.style.height = `${(m.cost / cmax) * 100}%`;
    attachTip(b, `${c.id} · ${fmtUsd(m.cost)} · ${m.revisions} revision${m.revisions === 1 ? "" : "s"}`);
    b.onclick = () => openInspector(c.id);
    return b;
  }));
  cost.after(el("div", { className: "axis" }, ...opusClips.map((c) => el("span", { textContent: c.n % 10 === 0 || c.n === 1 ? c.n : "" }))),
    el("p", { className: "foot", textContent: "Axis: video number. Tallest bar " + fmtUsd(cmax) + "." }));
}

/* ---------- side-by-side ---------- */
let cmpPlayer = null, cmpClip = "video1", cmpToken = 0;
async function showCompare(n) {
  const id = `video${n}`;
  cmpClip = id;
  const token = ++cmpToken;
  $("#cmp-count").textContent = `${n} / ${CLIPS.length}`;
  $("#cmp-range").value = n;
  const d = await loadClip(id);
  if (token !== cmpToken) return;
  cmpPlayer?.destroy();
  cmpPlayer = createPlayer($("#cmp-player"), sourcesFor(d), { duration: d.reference.duration, fps: d.reference.fps });
  const m = d.models["opus-5-5"];
  $("#cmp-meta").textContent = `${id} · ${d.reference.width}×${d.reference.height} source · ${fmtTime(d.reference.duration)} · Opus 5.5: ${m.revisions} revisions, ${m.renders} renders, ~${fmtUsd(m.cost)}` + (d.models["gpt-6-astra"] ? " · Astra shown as a third panel" : "");
}
function wireCompare() {
  const range = $("#cmp-range");
  range.max = CLIPS.length;
  let t = 0;
  range.oninput = () => { $("#cmp-count").textContent = `${range.value} / ${CLIPS.length}`; clearTimeout(t); t = setTimeout(() => showCompare(+range.value), 120); };
  $("#cmp-prev").onclick = () => showCompare(Math.max(1, +range.value - 1));
  $("#cmp-next").onclick = () => showCompare(Math.min(CLIPS.length, +range.value + 1));
  $("#cmp-open").onclick = () => openInspector(cmpClip);
  range.addEventListener("keydown", (e) => e.stopPropagation());
  // Load the first clip lazily so a visitor who never scrolls here downloads nothing.
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); showCompare(+range.value); }
  }, { rootMargin: "300px" }).observe($("#compare"));
}

/* ---------- gallery ---------- */
let galleryModel = "opus-5-5";
function renderGallery() {
  const tabs = $("#gallery-models");
  tabs.replaceChildren(...index.models.map((m) => {
    const n = CLIPS.filter((c) => c.models[m.id]).length;
    const b = el("button", { type: "button", role: "tab", ariaSelected: String(m.id === galleryModel) },
      m.short, el("small", { textContent: `${n}/${CLIPS.length}` }));
    b.onclick = () => { galleryModel = m.id; renderGallery(); };
    return b;
  }));
  $("#gallery-note").textContent = MODELS[galleryModel].note;

  const sort = $("#gallery-sort").value;
  const q = $("#gallery-find").value.trim().replace(/^video/i, "");
  let list = CLIPS.filter((c) => !q || String(c.n).startsWith(q));
  const val = (c, k) => c.models[galleryModel]?.[k] ?? -1;
  const [key, dir] = sort.split("-");
  if (key !== "n") list = [...list].sort((a, b) => (dir === "desc" ? val(b, key) - val(a, key) : val(a, key) - val(b, key)) || a.n - b.n);
  $("#gallery-count").textContent = `${list.length} video${list.length === 1 ? "" : "s"}`;

  $("#gallery-grid").replaceChildren(...list.map((c) => {
    const m = c.models[galleryModel];
    const meta = m
      ? el("div", { className: "meta" }, el("b", { textContent: c.id }),
        el("span", { textContent: `${m.revisions} rev` + (m.cost != null ? ` · ${fmtUsd(m.cost)}` : "") }))
      : el("div", { className: "meta" }, el("b", { textContent: c.id }), el("span", { textContent: "not run" }));
    const thumbs = el("div", { className: "thumbs" },
      el("img", { src: c.reference.poster, alt: `${c.id} reference frame`, loading: "lazy" }),
      m ? el("img", { src: m.poster, alt: `${c.id} ${MODELS[galleryModel].short} reconstruction frame`, loading: "lazy" })
        : el("div", { className: "ph", textContent: "not run" }),
      el("i", { textContent: "reference" }), el("i", { textContent: MODELS[galleryModel].short }));
    const card = el("button", { type: "button", className: "card-clip" + (m ? "" : " off"), disabled: !m }, thumbs, meta);
    if (m) card.onclick = () => openInspector(c.id);
    return card;
  }));
}

/* ---------- inspector ---------- */
const dlg = $("#inspector");
let inspPlayer = null, inspId = null, inspTab = "summary", inspToken = 0;
const TABS = [["summary", "Summary"], ["history", "Refinement history"], ["notes", "Model notes"], ["source", "Scene source"]];

async function openInspector(id, keepTab = false) {
  const token = ++inspToken;
  inspId = id;
  if (!keepTab) inspTab = "summary";
  if (!dlg.open) dlg.showModal();
  history.replaceState(null, "", `#${id}`);
  const d = await loadClip(id);
  if (token !== inspToken) return;
  $("#insp-title").textContent = `${id} · ${d.reference.width}×${d.reference.height} · ${fmtTime(d.reference.duration)}`;
  inspPlayer?.destroy();
  inspPlayer = createPlayer($("#insp-player"), sourcesFor(d), { duration: d.reference.duration, fps: d.reference.fps });
  $("#insp-tabs").replaceChildren(...TABS.map(([k, label]) => {
    const b = el("button", { type: "button", role: "tab", textContent: label, ariaSelected: String(k === inspTab) });
    b.onclick = () => { inspTab = k; openInspector(id, true); };
    return b;
  }));
  const panel = $("#insp-panel");
  panel.replaceChildren(await panelFor(inspTab, d));
}
const stepClip = (dir) => {
  const ids = CLIPS.map((c) => c.id);
  const next = ids[(ids.indexOf(inspId) + dir + ids.length) % ids.length];
  openInspector(next, true);
};
$("#insp-prev").onclick = () => stepClip(-1);
$("#insp-next").onclick = () => stepClip(1);
$("#insp-close").onclick = () => dlg.close();
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener("close", () => {
  inspToken++;
  inspPlayer?.destroy(); inspPlayer = null;
  history.replaceState(null, "", location.pathname + location.search);
});
document.addEventListener("keydown", (e) => {
  if (!dlg.open || e.target.matches("input, select, textarea")) return;
  if (e.key === "ArrowLeft") stepClip(-1);
  if (e.key === "ArrowRight") stepClip(1);
});

function facts(m) {
  const items = [
    ["Revisions", m.revisions], ["Renders", m.renders], ["Stop", m.stop === "model_submit" ? "model submit" : m.stop],
    ["Est. API cost", fmtUsd(m.cost) ?? "n/a"], ["Output tokens", m.output_tokens != null ? m.output_tokens.toLocaleString() : "n/a"],
    ["Elapsed", m.pauses ? `${fmtDur(m.elapsed_seconds)} (incl. pause)` : fmtDur(m.elapsed_seconds)],
  ];
  return el("dl", { className: "facts" }, items.map(([k, v]) => el("div", {}, el("dt", { textContent: k }), el("dd", { textContent: v }))));
}

async function panelFor(tab, d) {
  const root = el("div");
  for (const mm of modelsFor(d)) {
    const m = d.models[mm.id];
    const block = el("div", { className: "model-block" }, el("h4", { textContent: `${mm.name} · ${mm.level}` }));
    if (tab === "summary") {
      block.append(facts(m));
      if (m.submit_reason) block.append(el("blockquote", {}, el("cite", { textContent: "Submit reason (the model's own words, not an independent assessment)" }), m.submit_reason));
      if (m.infra_retries) block.append(el("p", { className: "foot", textContent: `Includes ${m.infra_retries} infrastructure retry render (not counted as a revision).` }));
      block.append(el("p", { className: "hash", textContent: `final scene sha256 ${m.scene_sha256 ?? "n/a"}` }));
    } else if (tab === "history") {
      block.append(history_(d, m));
    } else if (tab === "notes") {
      block.append(notes(m));
    } else {
      block.append(...(await sourceBlock(m, d.id, mm)));
    }
    root.append(block);
  }
  return root;
}

function history_(d, m) {
  if (!m.history) {
    return el("p", { className: "foot" }, "Per-revision frames were not extracted for this model. Every revision's source, decision and validation record is preserved at ",
      el("a", { href: `${GITHUB}/tree/main/examples/astra_iterative`, textContent: "examples/astra_iterative" }), ".");
  }
  const h = m.history;
  const thead = el("thead", {}, el("tr", {}, el("th"), ...h.times.map((t) => el("th", { textContent: `${t.toFixed(1)} s` }))));
  const rows = [el("tr", {}, el("th", { textContent: "Reference" }), ...h.reference.map((f) => el("td", {}, img(d, f))))];
  for (const r of m.rounds) {
    const frames = h.rounds[r.round];
    if (!frames) continue;
    const final = r.round === m.final_round;
    rows.push(el("tr", { className: final ? "final" : "" },
      el("th", { textContent: `Render ${+r.round}${final ? " (submitted)" : ""}` }),
      ...frames.map((f) => el("td", {}, img(d, f)))));
  }
  return el("div", { className: "film" }, el("table", {}, thead, el("tbody", {}, rows)),
    el("p", { className: "foot", textContent: "Frames from the reference and from each render, taken at the same four moments. A render can fix one moment while moving another; use the player above for motion." }));
}
const img = (d, f) => el("img", { src: `media/hist/${d.id}/${f}`, alt: "", loading: "lazy" });

function notes(m) {
  if (!m.rounds.length) return el("p", { className: "foot", textContent: "No per-round notes are published for this model here." });
  return el("div", {}, ...m.rounds.map((r) => {
    const label = r.action === "submit" ? "Submit decision" : `Round ${+r.round}`;
    const d = el("details", { className: "round", open: r.action === "submit" || r.round === m.final_round },
      el("summary", {}, label, el("small", { textContent: r.reason ?? "" })));
    d.append(el("pre", { textContent: r.report ?? (r.reason ?? "(no notes recorded)") }));
    return d;
  }));
}

async function sourceBlock(m, id, mm) {
  const bar = el("div", { className: "src-bar" },
    el("a", { href: m.scene, download: `${id}-${mm.id}.mjs`, textContent: "Download scene.mjs" }),
    el("span", { textContent: "· editable ES module; load it with the repository's Three.js runtime" }));
  const pre = el("pre", { className: "src", textContent: "Loading…" });
  try {
    const txt = await (await fetch(m.scene)).text();
    pre.textContent = txt;
    bar.append(el("span", { textContent: `· ${txt.split("\n").length} lines` }));
  } catch { pre.textContent = "Could not load the scene source."; }
  return [bar, pre];
}

function routeFromHash() {
  const h = location.hash.slice(1);
  if (/^video\d+$/.test(h) && byId[h]) openInspector(h);
}
addEventListener("hashchange", routeFromHash);

/* ---------- init ---------- */
$("#gallery-sort").onchange = renderGallery;
$("#gallery-find").oninput = renderGallery;
renderGallery();
buildCharts();
wireCompare();
buildSummaryTable();
routeFromHash();
