/* Reentry Resource Agents — single-page UI. Plain JS, no build step. */
(function () {
  "use strict";

  // ---------- Config ----------
  const STORAGE_KEY = "reentry:lastRun";
  const MINUTES_PER_SEARCH = 3; // a manual search or call a case manager would otherwise make
  const params = new URLSearchParams(location.search);
  let mockMode = params.get("mock") === "1";

  const P = (d) => `<path d="${d}"/>`;
  const svg = (inner) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    intake: svg(P("M9 4h6v3H9z") + P("M7 5H5v16h14V5h-2") + P("M8 12h8M8 16h5")),
    orchestrator: svg('<circle cx="12" cy="12" r="9"/>' + P("M15.5 8.5l-2 5-5 2 2-5z")),
    housing: svg(P("M3 11l9-7 9 7") + P("M5 10v10h14V10") + P("M10 20v-6h4v6")),
    health: svg(P("M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z")),
    food_benefits: svg(P("M4 9h16l-2 11H6z") + P("M8 9l4-5 4 5")),
    jobs: svg('<rect x="3" y="7" width="18" height="13" rx="2"/>' + P("M9 7V5h6v2") + P("M3 13h18")),
    legal_id: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.2"/>' + P("M14 10h4M14 14h4")),
    eligibility: svg(P("M12 3v18M5 7h14") + P("M5 7l-3 6a3 3 0 0 0 6 0z") + P("M19 7l-3 6a3 3 0 0 0 6 0z")),
    ranker: svg(P("M8 6h12M8 12h9M8 18h6") + '<circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
    system: svg('<circle cx="12" cy="12" r="3"/>'),
    star: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  };

  const AGENTS = [
    { id: "intake", name: "Intake" },
    { id: "orchestrator", name: "Orchestrator" },
    { id: "housing", name: "Housing" },
    { id: "health", name: "Health" },
    { id: "food_benefits", name: "Food & benefits" },
    { id: "jobs", name: "Jobs" },
    { id: "legal_id", name: "Legal, ID & money" },
    { id: "eligibility", name: "Eligibility" },
    { id: "ranker", name: "Ranker" },
  ];
  const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
  const FINDERS = ["housing", "health", "food_benefits", "jobs", "legal_id"];
  const ORDER = AGENTS.map((a) => a.id);

  const CATEGORY_LABELS = {
    housing: "Housing", health: "Health", food_benefits: "Food & benefits", jobs: "Jobs",
    legal_id: "Legal, ID & money", family: "Family", clothing: "Clothing",
  };
  const CATEGORY_ICON = { family: "intake", clothing: "intake" };
  const URGENCY_LABELS = { today: "Today", this_week: "This week", this_month: "This month" };
  const SOURCE_LABELS = {
    snapshot: "Resource directory", findtreatment: "FindTreatment.gov", hud: "HUD API", fdic: "FDIC",
    careeronestop: "CareerOneStop", hrsa: "HRSA", "211": "211", web: "Web", tlm: "TLM network",
  };
  const DOC_LABELS = {
    state_id: "State ID", ssn_card: "Social Security card", birth_certificate: "Birth certificate",
    cdcr_id_card: "CDCR ID card", drivers_license: "Driver's license", passport: "Passport",
  };
  const HOUSING_LABELS = {
    unhoused: "Unhoused", shelter: "Shelter", transitional: "Transitional housing",
    family_or_friends: "With family or friends", own_place: "Own place", unknown: "Unknown",
  };
  const SUPERVISION_LABELS = { parole: "Parole", probation: "Probation", pretrial: "Pretrial", none: "None", unknown: "Unknown" };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    banner: $("mode-banner"), presets: $("presets"), presetSummary: $("preset-summary"),
    situation: $("situation"), runBtn: $("run-btn"), replayBtn: $("replay-btn"), hint: $("input-hint"),
    runState: $("run-state"), pills: $("agent-pills"), feed: $("feed"), feedDetails: $("feed-details"),
    feedCount: $("feed-count"), cPrograms: $("c-programs"), cSources: $("c-sources"),
    cMinutes: $("c-minutes"), cElapsed: $("c-elapsed"), results: $("results"), actList: $("act-list"),
    sections: $("sections"), excluded: $("excluded"), excludedSummary: $("excluded-summary"),
    excludedList: $("excluded-list"), profile: $("profile"),
  };

  // ---------- Helpers ----------
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => {
    if (!u) return null;
    try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (_) { return null; }
  };
  const humanize = (s) => String(s || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const agentName = (id) => (AGENT_BY_ID[id] ? AGENT_BY_ID[id].name : humanize(id || "System"));
  const agentIcon = (id) => ICONS[id] || ICONS.system;
  const agentColor = (id) => (AGENT_BY_ID[id] ? `var(--a-${id})` : "var(--muted)");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const storage = {
    get() { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } },
    set(v) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); return true; } catch (_) { return false; } },
  };

  // ---------- State ----------
  let presets = [];
  let selectedPreset = null;
  let running = false;
  let run = null; // per-run state

  function newRunState() {
    return {
      start: performance.now(), timer: null, programs: 0, sources: 0, toolCalls: 0, foundTotal: 0,
      sawStats: false, status: Object.fromEntries(ORDER.map((a) => [a, "waiting"])), events: [], feedN: 0, gotDone: false,
    };
  }

  // ---------- Presets ----------
  async function loadPresets() {
    let list = null;
    if (!mockMode) {
      try {
        const r = await fetch("/api/presets", { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        list = await r.json();
        if (!Array.isArray(list)) throw new Error("bad presets");
      } catch (_) {
        mockMode = true;
      }
    }
    if (mockMode) {
      const mock = await loadMockPlan();
      list = (mock && mock.mock_presets) || [];
      showBanner(params.get("mock") === "1"
        ? "Demo mode: replaying a recorded sample run with sample program data, not live results."
        : "The agents server is not reachable, so this page is in demo mode: runs replay a recorded sample with sample program data, not live results.");
    }
    presets = list;
    renderPresets();
  }

  let mockPlanCache = null;
  async function loadMockPlan() {
    if (mockPlanCache) return mockPlanCache;
    try { const r = await fetch("mock_plan.json"); mockPlanCache = await r.json(); } catch (_) { mockPlanCache = null; }
    return mockPlanCache;
  }

  function showBanner(text) { el.banner.textContent = text; el.banner.hidden = false; }

  function renderPresets() {
    el.presets.innerHTML = "";
    presets.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = p.label;
      b.title = p.summary || "";
      b.setAttribute("aria-pressed", "false");
      b.dataset.id = p.id;
      b.addEventListener("click", () => selectPreset(p.id === selectedPreset ? null : p.id));
      b.addEventListener("mouseenter", () => { if (!selectedPreset) el.presetSummary.textContent = p.summary || ""; });
      b.addEventListener("mouseleave", () => { if (!selectedPreset) el.presetSummary.textContent = ""; });
      b.addEventListener("focus", () => { if (!selectedPreset) el.presetSummary.textContent = p.summary || ""; });
      el.presets.appendChild(b);
    });
    if (!presets.length) el.presetSummary.textContent = "No presets available. Describe a situation instead.";
  }

  function selectPreset(id) {
    selectedPreset = id;
    [...el.presets.children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
    const p = presets.find((x) => x.id === id);
    el.presetSummary.textContent = p ? p.summary || "" : "";
    if (id) el.situation.value = "";
  }

  el.situation.addEventListener("input", () => { if (el.situation.value.trim() && selectedPreset) selectPreset(null); });

  // ---------- Agent pills & counters ----------
  function renderPills() {
    el.pills.innerHTML = AGENTS.map((a) => {
      const s = run ? run.status[a.id] : "waiting";
      const label = { waiting: "waiting", working: "working", done: "done", skipped: "not needed" }[s];
      return `<li class="pill" data-status="${s}" style="--c:${agentColor(a.id)}">${agentIcon(a.id)}<span>${esc(a.name)}</span><span class="pill-state">${label}</span></li>`;
    }).join("");
  }

  function setStatus(agent, s) {
    if (!run || !(agent in run.status)) return;
    if (run.status[agent] === "done" && s === "working") return;
    run.status[agent] = s;
  }

  function completeBefore(agent) {
    // Agents earlier in the pipeline are finished once a later stage starts.
    const stageOf = (a) => (a === "intake" ? 0 : a === "orchestrator" ? 1 : FINDERS.includes(a) ? 2 : a === "eligibility" ? 3 : 4);
    const st = stageOf(agent);
    ORDER.forEach((a) => { if (stageOf(a) < st && run.status[a] === "working") run.status[a] = "done"; });
  }

  function updateCounters() {
    if (!run) return;
    const programs = run.sawStats ? run.programs : run.foundTotal;
    const sources = run.sawStats ? run.sources : run.toolCalls;
    el.cPrograms.textContent = programs;
    el.cSources.textContent = sources;
    el.cMinutes.textContent = sources * MINUTES_PER_SEARCH;
  }

  function tickElapsed() { if (run) el.cElapsed.textContent = Math.floor((performance.now() - run.start) / 1000); }

  function setRunState(state, text) { el.runState.dataset.state = state; el.runState.textContent = text; }

  // ---------- Feed ----------
  function addFeed(ev) {
    if (run.feedN === 0) el.feed.innerHTML = "";
    run.feedN++;
    const agent = ev.agent || (ev.type === "done" ? "ranker" : "system");
    const li = document.createElement("li");
    li.className = "ev-" + ev.type;
    li.style.setProperty("--c", agentColor(agent));
    const secs = Math.floor((performance.now() - run.start) / 1000);
    let msg = ev.message || "";
    let kind = "";
    if (ev.type === "done") msg = msg || "Plan ready";
    if (ev.type === "tool_call") kind = sourceKind(ev.tool);
    if (ev.type === "error") kind = "issue";
    li.innerHTML =
      `${agentIcon(agent)}<span class="who">${esc(agentName(agent))}</span>` +
      `<span class="msg">${kind ? `<span class="kind">${esc(kind)}</span>` : ""}${esc(msg)}${ev.type === "found" && ev.count != null && !/\d/.test(msg) ? ` (${esc(ev.count)})` : ""}</span>` +
      `<span class="time">${secs}s</span>`;
    const nearBottom = el.feed.scrollHeight - el.feed.scrollTop - el.feed.clientHeight < 60;
    el.feed.appendChild(li);
    if (nearBottom) el.feed.scrollTop = el.feed.scrollHeight;
    el.feedCount.textContent = `(${run.feedN})`;
  }

  function sourceKind(tool) {
    if (!tool) return "search";
    const t = String(tool).toLowerCase();
    if (t.includes("web_fetch") || t === "fetch") return "read";
    if (t.includes("web")) return "web";
    return SOURCE_LABELS[t] || "API";
  }

  // ---------- Event handling ----------
  function handleEvent(ev) {
    if (!ev || typeof ev !== "object") return;
    const agent = ev.agent;
    switch (ev.type) {
      case "agent_start":
        if (agent) { completeBefore(agent); setStatus(agent, "working"); }
        addFeed(ev);
        break;
      case "tool_call":
        if (agent) setStatus(agent, "working");
        run.toolCalls++;
        addFeed(ev);
        break;
      case "found":
        if (agent) setStatus(agent, "done");
        if (FINDERS.includes(agent) && typeof ev.count === "number") run.foundTotal += ev.count;
        addFeed(ev);
        break;
      case "verdict":
        setStatus(agent || "eligibility", "done");
        addFeed(ev);
        break;
      case "stats": {
        const s = ev.stats && typeof ev.stats === "object" ? ev.stats : ev;
        if (typeof s.programs_checked === "number") { run.programs = s.programs_checked; run.sawStats = true; }
        if (typeof s.sources_searched === "number") { run.sources = s.sources_searched; run.sawStats = true; }
        break;
      }
      case "error":
        addFeed(ev);
        break;
      case "done":
        run.gotDone = true;
        ORDER.forEach((a) => { run.status[a] = run.status[a] === "waiting" ? "skipped" : "done"; });
        if (ev.plan) {
          const st = ev.plan.stats || {};
          if (typeof st.programs_checked === "number") { run.programs = st.programs_checked; run.sawStats = true; }
          if (typeof st.sources_searched === "number") { run.sources = st.sources_searched; run.sawStats = true; }
        }
        addFeed({ type: "done", agent: "ranker", message: "Plan ready" });
        if (ev.plan) renderPlan(ev.plan);
        break;
      default:
        if (ev.message) addFeed(ev);
    }
    renderPills();
    updateCounters();
  }

  // ---------- Runs ----------
  function beginRun(label) {
    running = true;
    run = newRunState();
    el.runBtn.disabled = true;
    el.replayBtn.disabled = true;
    el.situation.disabled = true;
    [...el.presets.children].forEach((b) => (b.disabled = true));
    el.results.hidden = true;
    el.feedDetails.open = true;
    el.feed.innerHTML = '<li class="feed-empty">Starting agents...</li>';
    el.feedCount.textContent = "";
    el.cElapsed.textContent = "0";
    setRunState("running", label || "Working");
    el.hint.textContent = "";
    renderPills();
    updateCounters();
    run.timer = setInterval(tickElapsed, 250);
  }

  function endRun(ok) {
    running = false;
    if (run && run.timer) clearInterval(run.timer);
    tickElapsed();
    el.runBtn.disabled = false;
    el.situation.disabled = false;
    [...el.presets.children].forEach((b) => (b.disabled = false));
    refreshReplay();
    if (ok && run && run.gotDone) {
      setRunState("done", "Plan ready");
      el.feedDetails.open = false;
      el.results.hidden = false;
      el.results.focus({ preventScroll: true });
      el.results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    } else {
      setRunState("error", "Stopped");
      ORDER.forEach((a) => { if (run && run.status[a] === "working") run.status[a] = "waiting"; });
      renderPills();
      el.hint.textContent = "The run did not finish. You can try again, or use Replay last run.";
    }
  }

  function requestBody() {
    const text = el.situation.value.trim();
    if (selectedPreset) return { preset_id: selectedPreset };
    if (text) return { text };
    return null;
  }

  async function startRun() {
    if (running) return;
    const body = requestBody();
    if (!body) {
      el.hint.textContent = "Pick an alumnus or describe a situation first.";
      el.situation.focus();
      return;
    }
    if (mockMode) {
      const events = await loadMockEvents();
      if (body.text) el.hint.textContent = "";
      beginRun("Demo replay");
      if (body.text) addFeed({ type: "error", agent: "intake", message: "Demo mode: free text is not sent anywhere; replaying the Marcus sample run." });
      const ok = await replay(events);
      endRun(ok);
      return;
    }
    beginRun("Working");
    const recorded = [];
    let ok = false;
    try {
      const resp = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
      });
      if (!resp.ok || !resp.body) throw new Error("Server responded " + resp.status);
      await readSSE(resp.body, (ev) => {
        recorded.push({ t: Math.round(performance.now() - run.start), ...ev });
        handleEvent(ev);
      });
      ok = run.gotDone;
      if (!ok) handleEvent({ type: "error", agent: "orchestrator", message: "The stream ended before a plan was ready." });
    } catch (e) {
      handleEvent({ type: "error", message: "Could not reach the agents: " + (e && e.message ? e.message : "network error") });
    }
    if (ok) storage.set({ savedAt: Date.now(), request: body, events: recorded });
    endRun(ok);
  }

  // Parse a text/event-stream body: messages separated by blank lines; join `data:` lines.
  async function readSSE(stream, onEvent) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const flush = (block) => {
      const data = block.split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""))
        .join("\n");
      if (!data) return;
      try { onEvent(JSON.parse(data)); } catch (_) { /* ignore keep-alives / malformed */ }
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let m;
      while ((m = buf.match(/\r?\n\r?\n/))) {
        flush(buf.slice(0, m.index));
        buf = buf.slice(m.index + m[0].length);
      }
    }
    buf += decoder.decode();
    if (buf.trim()) flush(buf);
  }

  // Replay events with their recorded timing (t = ms since start). Compress long gaps.
  async function replay(events) {
    if (!Array.isArray(events) || !events.length) return false;
    let last = 0;
    for (const ev of events) {
      const t = typeof ev.t === "number" ? ev.t : last + 400;
      await sleep(Math.min(Math.max(t - last, 0), 4000));
      last = t;
      handleEvent(ev);
    }
    return run.gotDone;
  }

  let mockEventsCache = null;
  async function loadMockEvents() {
    if (mockEventsCache) return mockEventsCache;
    try { const r = await fetch("mock_events.json"); mockEventsCache = await r.json(); } catch (_) { mockEventsCache = []; }
    return mockEventsCache;
  }

  async function replayLast() {
    if (running) return;
    const saved = storage.get();
    let events = saved && saved.events;
    let label = "Replaying last run";
    if (!events || !events.length) {
      if (!mockMode) return;
      events = await loadMockEvents();
      label = "Demo replay";
    }
    beginRun(label);
    const ok = await replay(events);
    endRun(ok);
  }

  function refreshReplay() {
    const saved = storage.get();
    const has = !!(saved && saved.events && saved.events.length);
    el.replayBtn.disabled = running || (!has && !mockMode);
    el.replayBtn.title = has
      ? "Replays the run saved " + new Date(saved.savedAt).toLocaleString()
      : mockMode ? "Replays the recorded sample run" : "No saved run yet. Complete one live run first.";
  }

  // ---------- Plan rendering ----------
  function bringHtml(items) {
    if (!items || !items.length) return "";
    return `<div class="bring"><span class="bring-label">Bring:</span><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  }

  function sourceChips(c) {
    const chips = [];
    if (c.tlm_network || c.source === "tlm") chips.push(`<span class="src-chip tlm">${ICONS.star}TLM network</span>`);
    if (c.source && c.source !== "tlm") {
      const label = SOURCE_LABELS[c.source] || humanize(c.source);
      const href = safeUrl(c.source_url);
      chips.push(href
        ? `<a class="src-chip" href="${esc(href)}" target="_blank" rel="noopener">Source: ${esc(label)}</a>`
        : `<span class="src-chip">Source: ${esc(label)}</span>`);
    }
    return chips.join("");
  }

  function verdictHtml(c) {
    if (c.verdict === "likely") return `<span class="verdict verdict-likely">Likely eligible</span>`;
    if (c.verdict === "worth_applying") {
      return `<span class="verdict verdict-worth_applying">Worth applying${c.confirm_question ? ` <span class="verdict-q">— ask: ${esc(c.confirm_question)}</span>` : ""}</span>`;
    }
    return `<span class="verdict verdict-not_eligible">Not eligible</span>`;
  }

  function recHtml(r, cat) {
    const c = r.candidate || {};
    const href = safeUrl(c.url);
    const name = href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name);
    const meta = [];
    if (c.phone) {
      const tel = String(c.phone).replace(/[^\d+]/g, "");
      meta.push(`<li>Phone: ${tel ? `<a href="tel:${esc(tel)}">${esc(c.phone)}</a>` : esc(c.phone)}</li>`);
    }
    const place = c.address ? c.address + (c.city && !String(c.address).includes(c.city) ? ", " + c.city : "") : c.city;
    if (place) meta.push(`<li>${esc(place)}</li>`);
    if (typeof c.distance_miles === "number") meta.push(`<li>${esc(c.distance_miles.toFixed(1))} mi away</li>`);
    if (c.hours) meta.push(`<li>${esc(c.hours)}</li>`);
    if (c.cost) meta.push(`<li>${esc(c.cost)}</li>`);
    return `<article class="card rec" style="--c:${agentColor(cat)}">
      <h4 class="rec-name">${name}</h4>
      ${verdictHtml(c)}
      <p class="rec-why">${esc(r.why_it_fits)}</p>
      ${bringHtml(r.what_to_bring)}
      ${meta.length ? `<ul class="rec-meta">${meta.join("")}</ul>` : ""}
      <div class="rec-foot">${sourceChips(c)}</div>
    </article>`;
  }

  function renderPlan(plan) {
    // Act on today
    const steps = (plan.act_today || []).slice(0, 3);
    el.actList.innerHTML = steps.length
      ? steps.map((s) => `<li><div><div class="act-step">${esc(s.step)}</div>${s.resource_name ? `<div class="act-resource">${esc(s.resource_name)}</div>` : ""}${bringHtml(s.what_to_bring)}</div></li>`).join("")
      : `<li><div class="act-step">No same-day steps. Start with the first section below.</div></li>`;

    // Need sections
    el.sections.innerHTML = (plan.sections || []).map((sec) => {
      const n = sec.need || {};
      const cat = n.category;
      const iconKey = CATEGORY_ICON[cat] || cat;
      const recs = sec.recommendations || [];
      return `<section class="need-section" style="--c:${agentColor(iconKey)}">
        <div class="need-head">
          <h3>${ICONS[iconKey] || ICONS.system}${esc(CATEGORY_LABELS[cat] || humanize(cat))}</h3>
          <span class="badge urg-${esc(n.urgency)}">${esc(URGENCY_LABELS[n.urgency] || humanize(n.urgency))}</span>
        </div>
        <p class="need-why">${esc(n.why)}</p>
        <div class="recs">${recs.length ? recs.map((r) => recHtml(r, iconKey)).join("") : `<p class="muted">No matching programs found yet.</p>`}</div>
      </section>`;
    }).join("");

    // Excluded
    const ex = plan.excluded || [];
    el.excludedSummary.textContent = `Excluded (${ex.length})`;
    el.excluded.hidden = !ex.length;
    el.excluded.open = false;
    el.excludedList.innerHTML = ex.map((c) =>
      `<li><span class="ex-name">${esc(c.name)}</span>${c.city ? ` <span class="muted">· ${esc(c.city)}</span>` : ""}<br><span class="ex-reason">${esc(c.reason)}</span></li>`
    ).join("");

    renderProfile(plan.profile || {});
  }

  function renderProfile(p) {
    const sup = p.supervision || {};
    const supParts = [SUPERVISION_LABELS[sup.type] || humanize(sup.type)];
    if (sup.gps) supParts.push("GPS monitor");
    if (sup.curfew) supParts.push("curfew " + sup.curfew);
    if (sup.county_restriction) supParts.push("must stay in " + sup.county_restriction + " County");
    const docs = (p.documents_held || []).map((d) => DOC_LABELS[d] || humanize(d));
    const missingId = !(p.documents_held || []).some((d) => d === "state_id" || d === "drivers_license");
    const rows = [
      ["Location", [p.city, p.county ? p.county + " County" : null].filter(Boolean).join(", ") + (p.zip ? " " + p.zip : "")],
      ["Days since release", p.days_since_release != null ? String(p.days_since_release) : "Unknown"],
      ["Supervision", supParts.filter(Boolean).join(" · ")],
      ["Housing", HOUSING_LABELS[p.housing_status] || humanize(p.housing_status)],
      ["Documents", (docs.length ? docs.join(", ") : "None") + (missingId ? " (no state ID)" : "")],
    ];
    if (p.monthly_income != null) rows.push(["Monthly income", "$" + p.monthly_income]);
    if (p.goals && p.goals.length) rows.push(["Goals", p.goals.join(", ")]);
    el.profile.innerHTML =
      `<div><dt>Name</dt><dd class="profile-name">${esc(p.display_name || "Alumnus")}</dd></div>` +
      rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  }

  // ---------- Init ----------
  el.runBtn.addEventListener("click", startRun);
  el.replayBtn.addEventListener("click", replayLast);
  el.situation.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startRun(); });
  renderPills();
  refreshReplay();
  loadPresets().then(refreshReplay);
})();
