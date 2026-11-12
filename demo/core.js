/* core.js: logic for the standalone TLM demo. SAMPLE DATA ONLY.
 * Copied from reentry.js and resources.js (which keep serving Nikhil's hub) with the DOM and host-page parts removed.
 * Rules kept: no AI output is saved to a record without human approval; every briefing line cites its sources;
 * resource reasons come from templates, never AI; only ZIP + need categories leave the page for /api/resources.
 * Exposes window.RXC. The signed-in user is window.cur ({id, kind:"cm"|"alumnus", cm?, alumnusId?, name}).
 */
(function () {
  "use strict";
  var R = window.RX_DATA, iso = R.iso;
  var S = { alumni: R.build(), ver: 0 };

  /* ---------- helpers ---------- */
  function me() { return window.cur || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fm(d) { if (!d) return "—"; return new Date(d + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  function fmShort(d) { if (!d) return "—"; return new Date(d + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function fmDay(d) { return new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); }
  function ft(t) { if (!t) return ""; var p = t.split(":"), hr = parseInt(p[0], 10); return (hr % 12 || 12) + ":" + p[1] + " " + (hr >= 12 ? "PM" : "AM"); }
  function initials(n) { return n.split(" ").map(function (w) { return w[0]; }).join("").toUpperCase().slice(0, 2); }
  function days(a, b) { return Math.round((Date.parse(b + "T12:00") - Date.parse(a + "T12:00")) / 864e5); }
  function today() { return iso(0); }
  function byId(id) { return S.alumni.find(function (a) { return a.id === id; }); }
  function cmById(id) { return R.CMS.find(function (c) { return c.id === id; }); }
  function mine() { var u = me(); return u && u.kind === "cm" ? S.alumni.filter(function (a) { return a.cm === u.cm; }) : []; }
  function myAlumnus() { var u = me(); return u && u.kind === "alumnus" ? byId(u.alumnusId) : null; }
  function actor() { var u = me(); return u && u.kind === "cm" ? u.cm : "alumnus"; }
  function stageOf(a) { return R.STAGES.find(function (s) { return s.id === a.stage; }) || R.STAGES[0]; }
  function lastTwoWay(a) { var b = null; a.notes.forEach(function (x) { if (x.twoWay && (!b || x.date > b.date || (x.date === b.date && (x.ts || 0) >= (b.ts || 0)))) b = x; }); return b; }
  function sinceContact(a) { var l = lastTwoWay(a); return l ? days(l.date, today()) : null; }
  function openTasks(a) { return a.tasks.filter(function (t) { return t.status !== "done"; }); }
  function overdue(a) { return a.tasks.filter(function (t) { return !t.std && t.status !== "done" && t.due && t.due < today(); }); }
  function nextEvents(a, n) { return a.events.filter(function (e) { return !e.done && e.date >= today(); }).sort(function (x, y) { return (x.date + (x.time || "")) < (y.date + (y.time || "")) ? -1 : 1; }).slice(0, n || 99); }
  function who(id) { var c = cmById(id); return c ? c.name : id === "alumnus" ? "the alumnus" : id; }
  function hd(d) { return R.D(days(today(), d)); }
  function ago(n) { return n == null ? "never" : n === 0 ? "today" : n === 1 ? "yesterday" : n + " days ago"; }
  var HOUSING = { housed: "Housed", family: "With family", transitional: "Transitional", shelter: "Shelter", unhoused: "Unhoused" };
  var EVT = { interview: "Interview", parole: "Parole or probation", court: "Court date", housing: "Housing deadline", appt: "Appointment", "case-manager": "Check-in call", mock: "Mock interview", coach: "Coaching", "job-fair": "Job fair", recruiter: "Recruiter" };
  var EVT_TYPES = ["interview", "parole", "court", "housing", "appt", "case-manager"];
  var EMP = ["Employed", "Job searching", "Interviewed", "Not working"];

  /* ---------- portal activity (self-reported) and progress, used as briefing sources ---------- */
  var _seq = 0;
  function tick() { _seq = Math.max(_seq + 1, Date.now()); return _seq; }
  function plog(a) { if (!a.portal) a.portal = { base: { skills: 0, apps: 0, resume: null }, log: [], lastLogin: null }; return a.portal.log; }
  function afterL(date, ts, L) { if (!L || !date) return false; if (date !== L.date) return date > L.date; return !!(ts && L.ts && ts > L.ts); }
  function logPortal(a, kind, text, metric, delta, extra) {
    var log = plog(a), e = Object.assign({ id: "P" + (log.length + 1), date: today(), ts: tick(), kind: kind, text: text, metric: metric || null, delta: delta || 0 }, extra || {});
    log.push(e); if (kind === "login") a.portal.lastLogin = e.date; return e;
  }
  function portalSince(a) { var L = lastTwoWay(a); return plog(a).filter(function (e) { return afterL(e.date, e.ts, L); }); }
  function lastPortal(a, kind) { var d = null; plog(a).forEach(function (e) { if ((!kind || e.kind === kind) && (!d || e.date > d)) d = e.date; }); return d; }
  function setStatus(t, status, by) {
    if (status === "done") { if (t.status !== "done") { t.doneDate = today(); t.doneTs = tick(); } t.status = "done"; t.doneBy = by; return; }
    if (t.status === "done" && t.doneDate) { t.wasDoneDate = t.doneDate; t.wasDoneTs = t.doneTs || 0; t.undoneDate = today(); t.undoneTs = tick(); }
    t.status = status; t.doneBy = null; t.doneDate = null; t.doneTs = null;
  }
  function portalText(a) {
    var since = portalSince(a), act = since.filter(function (e) { return e.kind !== "login"; }), lg = since.length - act.length, L = lastTwoWay(a);
    var std = a.tasks.filter(function (t) { return t.std; }), cus = a.tasks.filter(function (t) { return !t.std; });
    var apps = (a.portal.base.apps || 0) + plog(a).filter(function (e) { return e.metric === "apps"; }).reduce(function (s, e) { return s + (e.delta || 0); }, 0);
    return "Self-reported portal activity: what the alumnus did in the participant app (skills, applications, resume scans, tasks marked done, logins). Not verified by staff.\n" +
      (plog(a).length ? "" : "No portal use on record.\n") +
      "Last two-way contact: " + (L ? L.date : "none on record") + ". Since then: " + act.length + " portal actions and " + lg + " logins.\n" +
      "Now: First 30 Days " + std.filter(function (t) { return t.status === "done"; }).length + " of " + std.length + " done; assigned tasks " + cus.filter(function (t) { return t.status === "done"; }).length + " of " + cus.length + " done; job applications " + apps + ".\n" +
      "Last login: " + (lastPortal(a, "login") || "never") + ". Last portal activity: " + (lastPortal(a) || "never") + ".";
  }

  /* ---------- derived facts + record checks (no AI) ---------- */
  function facts(a) {
    var l = lastTwoWay(a), t = today(), nx = nextEvents(a, 3);
    return {
      today: t, day_number_since_release: a.dayN, release_date: a.releaseDate, stage: stageOf(a).label,
      last_two_way_contact_date: l ? l.date : "none on record", days_since_last_two_way_contact: l ? days(l.date, t) : "unknown",
      notes_on_file: a.notes.length, open_tasks: openTasks(a).length, overdue_custom_tasks: overdue(a).length,
      supervision_end_date: a.sup.endDate || "not on file", days_until_supervision_end: a.sup.endDate ? days(t, a.sup.endDate) : "unknown",
      next_events: nx.map(function (e) { return e.title + " on " + e.date; }).join("; ") || "none scheduled",
      portal_actions_since_last_contact: portalSince(a).filter(function (e) { return e.kind !== "login"; }).length,
      days_since_last_login: lastPortal(a, "login") ? days(lastPortal(a, "login"), t) : "never logged in"
    };
  }
  /* Today: why this person needs the case manager now. Fixed rules on the record (no AI), each with a weight;
     the list is sorted by the sum. kind "call" means a check-in call within 48 hours (the action is the briefing). */
  /* Best-effort rewrite of a staff-voiced line into "you" (a fallback when a saved plan has no for_alumnus text; the case manager reviews it before sharing). */
  function toYou(t) {
    return String(t || "").replace(/\bhe is\b/g, "you are").replace(/\bHe is\b/g, "You are").replace(/\bhe's\b/g, "you're").replace(/\bhimself\b/g, "yourself")
      .replace(/\b(his|her)\b/g, "your").replace(/\b(His|Her)\b/g, "Your").replace(/\bhim\b/g, "you").replace(/\b(he|she)\b/g, "you").replace(/\b(He|She)\b/g, "You");
  }
  function priorities(a) {
    var r = [], t = today(), s = sinceContact(a), first = a.name.split(" ")[0];
    var call = a.events.filter(function (e) { return e.type === "case-manager" && !e.done && e.date >= t && days(t, e.date) <= 1; }).sort(function (x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; })[0];
    if (call) r.push({ w: 50, kind: "call", text: "Check-in call " + (call.date === t ? "today" : "tomorrow") + (call.time ? ", " + ft(call.time) : "") });
    if (a.housing.status === "unhoused") r.push({ w: 60, kind: "housing", text: "Unhoused on day " + a.dayN + (a.housing.detail ? ": " + a.housing.detail.replace(/\.$/, "") : "") });
    else if (a.housing.status === "shelter") r.push({ w: 30, kind: "housing", text: "In a shelter on day " + a.dayN });
    var urgent = a.notes.filter(function (n) { return /^urgent\b/i.test(n.text) && days(n.date, t) <= 14; }).sort(function (x, y) { return x.date < y.date ? 1 : -1; })[0];
    if (urgent) r.push({ w: 55, kind: "urgent", text: "Urgent note " + fmShort(urgent.date) + ": " + urgent.text.replace(/^urgent:?\s*/i, "").split(/(?<=\.)\s/)[0] });
    overdue(a).forEach(function (x) { r.push({ w: 45, kind: "task", text: "Overdue: " + x.title }); });
    a.tasks.filter(function (x) { return !x.std && x.status !== "done" && x.due && x.due >= t && days(t, x.due) <= 3; }).forEach(function (x) { r.push({ w: 25, kind: "task", text: "Due " + fmShort(x.due) + ": " + x.title }); });
    if (s == null) r.push({ w: 35, kind: "contact", text: "No two-way contact on record" });
    else if (s >= 14) r.push({ w: 35, kind: "contact", text: "No contact with " + first + " in " + s + " days" });
    a.events.filter(function (e) { return e.type === "parole" && !e.done && e.date >= t && days(t, e.date) <= 3; }).forEach(function (e) { r.push({ w: 20, kind: "event", text: e.title + " " + fmShort(e.date) + (e.time ? ", " + ft(e.time) : "") }); });
    return r.sort(function (x, y) { return y.w - x.w; });
  }
  function recordChecks(a) {
    var c = [], t = today(), s = sinceContact(a);
    if (!a.phone) c.push({ sev: "warn", text: "No phone number on file." });
    if (a.sup.type !== "None" && !a.sup.endDate) c.push({ sev: "warn", text: "No " + a.sup.type.toLowerCase() + " end date on file." });
    if (s == null) c.push({ sev: "warn", text: "No two-way contact on record." });
    else if (s >= 14) c.push({ sev: "warn", text: s + " days since last two-way contact (" + fm(lastTwoWay(a).date) + ")." });
    overdue(a).forEach(function (x) { c.push({ sev: "warn", text: "Overdue task: " + x.title + " (due " + fm(x.due) + ")." }); });
    var lp = lastPortal(a), pa = portalSince(a).filter(function (e) { return e.kind !== "login"; }).length;
    if (!lp) c.push({ sev: "info", text: "No portal use on record." });
    else if (days(lp, t) >= 14) c.push({ sev: "warn", text: "No portal activity in 14+ days (last on " + fm(lp) + ")." });
    if (pa) c.push({ sev: "info", text: pa + " portal action" + (pa === 1 ? "" : "s") + " since your last call (self-reported in the app)." });
    a.events.filter(function (e) { return !e.done && e.date >= t && days(t, e.date) <= 3; }).forEach(function (e) { c.push({ sev: "info", text: "In the next 3 days: " + e.title + " (" + fm(e.date) + (e.time ? " " + ft(e.time) : "") + ")." }); });
    return c;
  }

  /* ---------- undo snapshots ---------- */
  function snap(a) { return { id: a.id, data: JSON.stringify(a) }; }
  function restore(sn) { var a = byId(sn.id), d = JSON.parse(sn.data); Object.keys(a).forEach(function (k) { delete a[k]; }); Object.assign(a, d); S.ver++; }

  /* ---------- record changes (all go through the UI's act() for undo) ---------- */
  function addTask(a, o) { var t = { id: "T" + (a.tasks.length + 1), std: false, title: o.title, phase: "", status: "open", due: o.due || null, detail: o.detail || "", assignedBy: actor(), doneBy: null, doneDate: null }; a.tasks.push(t); return t; }
  function addEventTo(a, e) { var ev = { id: "E" + (a.events.length + 1), title: e.title, date: e.date, time: e.time || "", type: e.type, loc: e.loc || "", notes: e.notes || "" }; a.events.push(ev); return ev; }
  function addNote(a, text, o) { o = o || {}; var n = { id: "N" + (a.notes.length + 1), date: today(), by: actor(), kind: o.kind || "call", twoWay: o.twoWay !== false, text: text, ts: tick() }; if (o.approvedChanges != null) n.approvedChanges = o.approvedChanges; a.notes.push(n); return n; }
  function handoff(a, to, note) {
    var from = a.cm;
    a.handoffs.push({ from: from, to: to, date: today(), note: note });
    a.notes.push({ id: "N" + (a.notes.length + 1), date: today(), by: from, kind: "handoff", twoWay: false, text: "Handoff from " + who(from) + " to " + who(to) + ": " + note, ts: tick() });
    a.cm = to;
  }
  function toggleTask(a, t) { setStatus(t, t.status === "done" ? "open" : "done", actor()); if (t.status === "done" && actor() === "alumnus") logPortal(a, "task_done", "Marked done: " + t.title, t.std ? "first30" : "custom", 1, { task: t.id });
    /* standard tasks 3 and 4 are the CalFresh and Medi-Cal tasks: keep the benefits tiles in step with the checklist */
    var si = t.std ? (a.tasks || []).filter(function (x) { return x.std; }).indexOf(t) : -1, prog = si === 2 ? "calfresh" : si === 3 ? "medi_cal" : null;
    if (prog) { var b = benefitOf(a, prog), B = BENEFITS[prog]; if (t.status === "done") { b.status = B.done; b.date = today(); b.by = actor(); } else if (b.status === B.done) { b.status = "applied"; b.date = today(); b.by = actor(); } }
  }

  /* ---------- briefing ---------- */
  var SOURCE_HOOKS = [];
  function sources(a) {
    var s = [], f = facts(a);
    function add(id, label, text) { s.push({ id: id, label: label, text: text }); }
    add("PROFILE", "Profile", "Name: " + a.name + ". Day " + a.dayN + " since release on " + a.releaseDate + " (" + hd(a.releaseDate) + "). Stage: " + stageOf(a).label + ". Location: " + a.loc + ". Released from: " + a.facility + ". Phone: " + (a.phone || "none on file") + ". Email: " + (a.email || "none on file") + ".");
    add("HOUSING", "Housing", "Status: " + HOUSING[a.housing.status] + ". " + a.housing.detail);
    add("SUPERVISION", "Supervision", "Type: " + a.sup.type + ". Officer: " + (a.sup.officer || "none") + ". Check-ins: " + (a.sup.cadence || "n/a") + ". Conditions: " + (a.sup.conditions || "none listed") + ". End date: " + (a.sup.endDate ? a.sup.endDate + " (" + hd(a.sup.endDate) + ")" : "not on file") + "." + (a.sup.nextCheckin ? " Next check-in: " + a.sup.nextCheckin + " (" + hd(a.sup.nextCheckin) + ")." : ""));
    add("EMPLOYMENT", "Employment", "Status: " + a.emp.status + ". " + (a.emp.detail || "No detail."));
    add("GOALS", "Goals", a.goals.join("; ") || "None recorded.");
    add("BARRIERS", "Barriers", a.barriers.join("; ") || "None recorded.");
    add("FACTS", "Computed facts", Object.keys(f).map(function (k) { return k + ": " + f[k]; }).join("\n"));
    add("PORTAL", "Portal activity (self-reported)", portalText(a));
    a.notes.forEach(function (n) { add(n.id, "Note " + n.id, "[" + n.date + " (" + hd(n.date) + "), " + n.kind + ", " + (n.twoWay ? "spoke with alumnus" : "alumnus not reached") + ", by " + who(n.by) + "] " + n.text); });
    a.tasks.forEach(function (t) { add(t.id, "Task " + t.id, t.title + " — " + t.status.replace("_", " ") + (t.due ? " — due " + t.due + " (" + hd(t.due) + ")" : "") + (t.detail ? " — " + t.detail : "") + (t.std ? " (standard First 30 Days task, " + t.phase + ")" : " (custom task)") + ((t.notes || []).length ? " — Quick notes: " + t.notes.map(function (n) { return "[" + n.date + ", " + who(n.by) + "] " + n.text; }).join(" | ") : "")); });
    plog(a).forEach(function (p) { add(p.id, "Portal " + p.id, "[" + p.date + " (" + hd(p.date) + "), " + p.kind.replace("_", " ") + ", self-reported in the participant app] " + p.text); });
    a.events.forEach(function (e) { add(e.id, "Event " + e.id, e.title + " — " + e.date + " (" + hd(e.date) + ")" + (e.time ? " " + e.time : "") + " — " + (EVT[e.type] || e.type) + (e.loc ? " — " + e.loc : "")); });
    SOURCE_HOOKS.forEach(function (fn) { try { fn(a, add); } catch (e) {} });
    return s;
  }
  var SECTIONS = [["snapshot", "Snapshot"], ["since_last_contact", "Since last contact"], ["open_needs", "Open needs"], ["coming_up", "Coming up"], ["suggested_topics", "Suggested topics"], ["check_before_call", "Check before the call"]];
  function briefPrompt(a, src) {
    return "You are preparing a one-page pre-call briefing for a reentry case manager. Use ONLY the SOURCES below.\n" +
      "Rules:\n- Never invent facts, dates, names, numbers or outcomes. If something is not in the sources, say it is unknown or leave it out. Do not assume a pending item succeeded (for example an interview is not an offer).\n" +
      "- Every item must cite the ids of the sources it relies on, such as N2, T3, HOUSING, FACTS.\n- Each item is one or two short sentences. Use exact dates and numbers from the sources.\n" +
      "- If two sources disagree, put it under check_before_call and cite both.\n" +
      "- PORTAL and P1, P2… are portal activity SELF-REPORTED by the alumnus in the participant app (skills, job applications, resume scans, tasks they marked done, logins). Cite them for progress since the last call, say it is self-reported in the app, and never present it as verified by staff. Real wins are worth acknowledging in suggested_topics.\n- suggested_topics are in priority order, most important first, and should be relationship-focused (how they are doing, wins worth acknowledging, what they asked about), not only admin.\n- No legal or medical advice.\n" +
      "- snapshot is ONE item: a single plain sentence a case manager could read aloud, under 25 words.\n" +
      "- At most 4 items per section. The whole page must be readable in two minutes. If there is little history, keep it short.\n\n" +
      'Return ONLY a JSON object with these keys, each an array of {"text": string, "cites": [source ids]}: snapshot, since_last_contact, open_needs, coming_up, suggested_topics, check_before_call. Use [] for a section with nothing to say.\n\nSOURCES:\n' +
      src.map(function (x) { return "[" + x.id + "] " + x.text; }).join("\n");
  }
  function nums(t) { return (String(t).match(/\d+/g) || []).map(function (n) { return String(parseInt(n, 10)); }); }
  function validateBrief(raw, src) {
    var map = {}; src.forEach(function (x) { map[x.id] = x; });
    var out = {}, bad = 0;
    SECTIONS.forEach(function (sec) {
      var arr = raw && Array.isArray(raw[sec[0]]) ? raw[sec[0]] : [];
      out[sec[0]] = arr.slice(0, 6).filter(function (i) { return i && typeof i.text === "string" && i.text.trim(); }).map(function (i) {
        var cites = (Array.isArray(i.cites) ? i.cites : []).map(String), ok = cites.filter(function (c) { return map[c]; }), missing = cites.length - ok.length;
        var pool = {}; ok.concat(["FACTS"]).forEach(function (c) { nums(map[c].text).forEach(function (n) { pool[n] = 1; }); });
        var unmatched = nums(i.text).filter(function (n) { return !pool[n]; });
        var flag = !ok.length ? "nosource" : (missing || unmatched.length) ? "check" : "";
        if (flag) bad++;
        return { text: i.text.trim(), cites: ok, flag: flag, why: !ok.length ? "No valid source cited." : missing ? "Cites a source that does not exist." : unmatched.length ? "Number(s) not found in the cited sources: " + unmatched.join(", ") : "" };
      });
    });
    out._bad = bad; return out;
  }
  function digest(a, src) {
    var f = facts(a), l = lastTwoWay(a), o = {};
    o.snapshot = [{ text: a.name + " is on day " + a.dayN + " since release (" + stageOf(a).label + "). " + HOUSING[a.housing.status] + ": " + a.housing.detail, cites: ["PROFILE", "HOUSING"] }];
    o.since_last_contact = [{ text: l ? "Last two-way contact was " + l.date + " (" + f.days_since_last_two_way_contact + " days ago)." : "No two-way contact on record.", cites: l ? [l.id, "FACTS"] : ["FACTS"] }];
    a.notes.filter(function (n) { return !l || n.date > l.date; }).forEach(function (n) { o.since_last_contact.push({ text: "Note " + n.id + " (" + n.date + "): " + n.text, cites: [n.id] }); });
    if (l) o.since_last_contact.push({ text: "Last conversation: " + l.text, cites: [l.id] });
    o.open_needs = openTasks(a).filter(function (t) { return t.status === "in_progress" || !t.std; }).slice(0, 5).map(function (t) { return { text: t.title + " (" + t.status.replace("_", " ") + (t.due ? ", due " + t.due : "") + ")", cites: [t.id] }; });
    o.open_needs.push({ text: "Supervision: " + a.sup.type + (a.sup.officer ? " with " + a.sup.officer : "") + ", end date " + (a.sup.endDate || "not on file") + ". Employment: " + a.emp.status + ". " + a.emp.detail, cites: ["SUPERVISION", "EMPLOYMENT"] });
    if (a.barriers.length) o.open_needs.push({ text: "Barriers: " + a.barriers.join("; "), cites: ["BARRIERS"] });
    o.coming_up = nextEvents(a, 4).map(function (e) { return { text: e.title + " on " + e.date + (e.time ? " at " + e.time : "") + ".", cites: [e.id] }; });
    o.suggested_topics = []; o.check_before_call = recordChecks(a).map(function (c) { return { text: c.text, cites: ["FACTS"] }; });
    return validateBrief(o, src);
  }

  /* ---------- call notes -> draft record changes ---------- */
  function diffPrompt(a, text) {
    var open = a.tasks.filter(function (t) { return t.status !== "done"; }).map(function (t) { return t.id + ": " + t.title + " (" + t.status + ")"; }).join("; ");
    return "You turn a case manager's call notes into a draft structured record update. Use ONLY what the notes say. Do not guess. Propose a change only if the notes clearly support it.\n" +
      "Today is " + today() + ". Resolve relative dates (such as “next Tuesday”) to YYYY-MM-DD from today.\n\nCurrent record for " + a.name + ":\n- housing status: " + a.housing.status + "; detail: " + a.housing.detail + "\n- employment status: " + a.emp.status + "; detail: " + a.emp.detail + "\n- phone: " + (a.phone || "none") + "\n- supervision next check-in: " + (a.sup.nextCheckin || "none") + "\n- tasks not done: " + open + "\n\n" +
      'Return ONLY JSON: {"summary": "one sentence", "changes": [ ... ]}. Each change has "kind", the fields for that kind, and "evidence": an EXACT short quote copied from the notes that supports it. Allowed kinds and fields:\n' +
      '- {"kind":"housing.status","value":"housed|family|transitional|shelter|unhoused"}\n- {"kind":"housing.detail","value":"short text"}\n- {"kind":"employment.status","value":"Employed|Job searching|Interviewed|Not working"}\n- {"kind":"employment.detail","value":"short text"}\n- {"kind":"phone","value":"phone number"}\n- {"kind":"supervision.nextCheckin","value":"YYYY-MM-DD"}\n- {"kind":"barrier.add","value":"short text"}\n- {"kind":"task.update","taskId":"T#","status":"done|in_progress|open"}\n- {"kind":"task.new","title":"short","detail":"short","due":"YYYY-MM-DD or null"}\n- {"kind":"event.new","title":"short","date":"YYYY-MM-DD","time":"HH:MM or null","type":"interview|parole|court|housing|appt|case-manager","loc":"text"}\nDo not use any other kind.\n\nNOTES:\n' + text;
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/[\s‘’“”"'.,;:!?-]+/g, " ").trim(); }
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  function validateDiff(raw, a, text) {
    var out = { summary: raw && typeof raw.summary === "string" ? raw.summary : "", changes: [] }, nt = norm(text);
    (raw && Array.isArray(raw.changes) ? raw.changes : []).forEach(function (c) {
      if (!c || typeof c !== "object") return; var k = c.kind, ok = true, before = "", after = "";
      var ev = typeof c.evidence === "string" ? c.evidence.trim() : "", evOk = !!ev && nt.indexOf(norm(ev)) >= 0;
      if (k === "housing.status") { ok = !!HOUSING[c.value]; before = HOUSING[a.housing.status]; after = HOUSING[c.value]; }
      else if (k === "housing.detail") { ok = typeof c.value === "string" && c.value; before = a.housing.detail; after = c.value; }
      else if (k === "employment.status") { ok = EMP.indexOf(c.value) >= 0; before = a.emp.status; after = c.value; }
      else if (k === "employment.detail") { ok = typeof c.value === "string" && c.value; before = a.emp.detail; after = c.value; }
      else if (k === "phone") { ok = typeof c.value === "string" && /\d{7,}/.test(c.value.replace(/\D/g, "")); before = a.phone || "none"; after = c.value; }
      else if (k === "supervision.nextCheckin") { ok = ISO.test(c.value || ""); before = a.sup.nextCheckin || "none"; after = c.value; }
      else if (k === "barrier.add") { ok = typeof c.value === "string" && c.value; before = ""; after = c.value; }
      else if (k === "task.update") { var t = a.tasks.find(function (x) { return x.id === c.taskId; }); ok = !!t && ["done", "in_progress", "open"].indexOf(c.status) >= 0; if (t) { before = t.title + ": " + t.status.replace("_", " "); after = t.title + ": " + String(c.status).replace("_", " "); } }
      else if (k === "task.new") { ok = typeof c.title === "string" && c.title && (c.due == null || c.due === "null" || ISO.test(c.due)); before = ""; after = c.title + (c.due && c.due !== "null" ? " (due " + fmShort(c.due) + ")" : ""); }
      else if (k === "event.new") { ok = typeof c.title === "string" && c.title && ISO.test(c.date || "") && EVT_TYPES.indexOf(c.type) >= 0; before = ""; after = c.title + " on " + fmShort(c.date) + (c.time && c.time !== "null" ? " at " + ft(c.time) : ""); }
      else ok = false;
      if (!ok) return;
      out.changes.push({ c: c, kind: k, before: before, after: after, evidence: ev, evOk: evOk, checked: evOk });
    });
    return out;
  }
  var KIND = { "housing.status": "Housing status", "housing.detail": "Housing detail", "employment.status": "Employment status", "employment.detail": "Employment detail", phone: "Phone", "supervision.nextCheckin": "Next supervision check-in", "barrier.add": "New barrier", "task.update": "Task", "task.new": "New task", "event.new": "New event" };
  function applyChange(a, x) {
    var c = x.c, k = x.kind;
    if (k === "housing.status") a.housing.status = c.value; else if (k === "housing.detail") a.housing.detail = c.value;
    else if (k === "employment.status") a.emp.status = c.value; else if (k === "employment.detail") a.emp.detail = c.value;
    else if (k === "phone") a.phone = c.value;
    else if (k === "supervision.nextCheckin") a.sup.nextCheckin = c.value;
    else if (k === "barrier.add") a.barriers.push(c.value);
    else if (k === "task.update") { var t = a.tasks.find(function (y) { return y.id === c.taskId; }); setStatus(t, c.status, actor()); }
    else if (k === "task.new") addTask(a, { title: c.title, due: c.due && c.due !== "null" ? c.due : null, detail: c.detail || "" });
    else if (k === "event.new") addEventTo(a, { title: c.title, date: c.date, time: c.time && c.time !== "null" ? c.time : "", type: c.type, loc: c.loc || "" });
  }

  /* ---------- Claude (through window.claude; on Cloudflare the shim proxies /api/claude) ---------- */
  function sample() { var c = window.claude; if (!c || !c.use) return Promise.resolve(null); return c.use("sample"); }
  function whyFailed(e) { return e && e.code === "not_granted" ? "AI use was declined" : e && e.code === "rate_limited" ? "Too many requests right now" : "Claude couldn't answer (" + ((e && (e.code || e.message)) || "error") + ")"; }

  /* ---------- Resource Navigator ---------- */
  var NEEDS = {
    shelter: "Shelter tonight", housing: "Housing", id: "State ID", ssn: "Social Security card", snap: "Food benefits (SNAP)",
    medicaid: "Health coverage (Medicaid)", phone: "Phone (Lifeline)", jobs: "Jobs", training: "Training", health: "Health care",
    treatment: "Substance use or mental health", legal: "Legal help", records: "Record clearing", bank: "Bank account", vote: "Voting rights"
  };
  /* fixed category order; each groups need keys the /api/resources route serves */
  var CATS = [
    { id: "housing", label: "Housing and shelter", needs: ["housing", "shelter"] },
    { id: "food", label: "Food and benefits", needs: ["snap", "medicaid"] },
    { id: "id", label: "ID and documents", needs: ["id", "ssn"] },
    { id: "jobs", label: "Jobs and training", needs: ["jobs", "training"] },
    { id: "health", label: "Health", needs: ["health", "treatment"] },
    { id: "legal", label: "Legal and records", needs: ["legal", "records", "vote"] },
    { id: "money", label: "Phone and banking", needs: ["phone", "bank"] }
  ];
  var ALL_NEEDS = Object.keys(NEEDS);
  /* one-sentence summary per row: first sentence of the source's own notes, else a fixed line per need (never AI) */
  var SUMMARY = {
    shelter: "Emergency shelter and a place to stay tonight.", housing: "Help finding and keeping a place to live.", id: "Get a state ID or driver's license.",
    ssn: "Replace a Social Security card for free.", snap: "Apply for monthly food benefits.", medicaid: "Free or low-cost health coverage.",
    phone: "A free or discounted phone plan.", jobs: "Job search help, listings and hiring programs.", training: "Job training and certificates.",
    health: "Primary care with fees based on income.", treatment: "Substance use and mental health treatment.", legal: "Free legal help for people with low income.",
    records: "Clear or seal a criminal record.", bank: "Low-cost bank accounts without overdraft fees.", vote: "Check and restore your right to vote."
  };
  function summaryOf(r) { var n = String(r.notes || "").trim(); if (n) { var m = n.match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : n; } return SUMMARY[r.need] || ""; }
  function catOf(need) { return CATS.find(function (c) { return c.needs.indexOf(need) >= 0; }) || CATS[CATS.length - 1]; }
  var TRUST = { official: 0, directory: 1, curated: 2 };
  var TRUST_L = { official: "Official", directory: "Directory", curated: "Curated" };
  var CITY_ZIP = { "Oakland": "94607", "San Francisco": "94103", "Hayward": "94541", "Richmond": "94804", "San Leandro": "94577", "Sacramento": "95814", "Fremont": "94538", "San Jose": "95113", "Stockton": "95202" };
  var RN = { cache: {}, loading: {}, err: {} };
  function zipOf(a) { if (!a.zip) { var c = (a.loc || "").split(",")[0].trim(); a.zip = CITY_ZIP[c] || null; } return a.zip; }
  function acts(a) { return (a.resourceActions = a.resourceActions || {}); }
  function hosted() { return !(window.claude && !window.claude.hosted); }
  /* every resource for the ZIP (plus anything pinned or saved earlier), minus hidden ones; pinned, then trust, then distance */
  function rank(a, items) {
    var A = acts(a), list = items.slice();
    Object.keys(A).forEach(function (id) { var x = A[id]; if ((x.pinnedBy || x.saved || x.used) && x.item && !list.some(function (r) { return r.id === id; })) list.push(x.item); });
    return list.filter(function (r) { return !(A[r.id] && A[r.id].hidden); }).map(function (r) { return Object.assign({}, r, { act: A[r.id] || {}, cat: catOf(r.need).id }); })
      .sort(function (p, q) {
        var pp = p.act.pinnedBy ? 0 : 1, qp = q.act.pinnedBy ? 0 : 1; if (pp !== qp) return pp - qp;
        var t = (TRUST[p.source.trust] || 3) - (TRUST[q.source.trust] || 3); if (t) return t;
        return (p.distanceMi == null ? 1e6 : p.distanceMi) - (q.distanceMi == null ? 1e6 : q.distanceMi);
      });
  }
  /* instant plain-text search: name, notes, category, need label, address */
  function searchRes(list, q) {
    var words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return list;
    return list.filter(function (r) {
      var hay = [r.name, r.notes, r.address, NEEDS[r.need], catOf(r.need).label, r.source && r.source.name].join(" ").toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }
  function resState(a) { zipOf(a); var k = a.zip || ""; return { data: RN.cache[k], loading: !!RN.loading[k], err: RN.err[k] }; }
  function loadResources(a, after) {
    zipOf(a); var k = a.zip;
    if (!k || RN.cache[k] || RN.loading[k]) { if (after) after(); return; }
    if (!hosted()) { RN.err[k] = "Live resources work on the hosted site only. This copy can't reach outside services."; if (after) after(); return; }
    RN.loading[k] = true; RN.err[k] = null;
    fetch("/api/resources?zip=" + encodeURIComponent(k) + "&needs=" + ALL_NEEDS.join(","))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); })
      .then(function (j) { RN.cache[k] = j; })
      .catch(function (e) { RN.err[k] = "Resources didn't load (" + (e.message || "network error") + "). Try again in a minute."; })
      .then(function () { RN.loading[k] = false; if (after) after(); });
  }
  function findRes(a, rid) { var st = resState(a), it = st.data && (st.data.items || []).find(function (r) { return r.id === rid; }); return it || (acts(a)[rid] && acts(a)[rid].item); }
  function resAct(a, rid, fn) { var A = acts(a), x = A[rid] = A[rid] || {}; if (!x.item) x.item = findRes(a, rid); fn(x); }
  var Res = {
    pin: function (a, rid) { resAct(a, rid, function (x) { if (x.pinnedBy) { x.pinnedBy = null; x.note = ""; } else { x.pinnedBy = actor(); x.pinnedAt = new Date().toISOString(); } }); },
    note: function (a, rid, t) { resAct(a, rid, function (x) { x.note = String(t || "").trim().slice(0, 200); }); },
    hide: function (a, rid) { resAct(a, rid, function (x) { x.hidden = true; }); },
    save: function (a, rid) { resAct(a, rid, function (x) { x.saved = !x.saved; }); },
    used: function (a, rid) { resAct(a, rid, function (x) { x.used = !x.used; x.usedAt = x.used ? today() : null; if (x.used && x.item) logPortal(a, "resource_used", "Used a resource: " + x.item.name, null, 0); }); },
    setZip: function (a, z) { z = String(z || "").trim(); if (!/^\d{5}$/.test(z)) return false; a.zip = z; return true; }
  };
  // briefing sources: what was recommended, saved or used becomes citable (R1, R2, ...)
  SOURCE_HOOKS.push(function (a, add) {
    var A = acts(a), n = 0;
    Object.keys(A).forEach(function (id) {
      var x = A[id]; if (!x.item || !(x.pinnedBy || x.saved || x.used)) return;
      var w = [x.pinnedBy ? "recommended by " + who(x.pinnedBy) + (x.note ? " (note: " + x.note + ")" : "") : "", x.saved ? "saved by the alumnus" : "", x.used ? "marked used by the alumnus" + (x.usedAt ? " on " + x.usedAt : "") : ""].filter(Boolean).join("; ");
      add("R" + (++n), "Resource R" + n, x.item.name + " (" + (NEEDS[x.item.need] || x.item.need) + ")" + (x.item.address ? ", " + x.item.address : "") + ": " + w + ". Source: " + x.item.source.name + ".");
    });
  });


  /* ---------- AI deep search (Nikhil's agent pipeline at /api/agent/step): profile adapter ----------
   * Only fields our sample record actually has are filled; the rest stay unset so the agents treat them as unknown. */
  var AG_HOUSING = { housed: "own_place", family: "family_or_friends", transitional: "transitional", shelter: "shelter", unhoused: "unhoused" };
  var AG_NEED = { housing: "housing", food_benefits: "snap", health: "health", jobs: "jobs", legal_id: "legal", family: "housing", clothing: "shelter" };
  function toAgentProfile(a, geo) {
    var sup = a.sup || {}, cond = String(sup.conditions || ""), t = String(sup.type || "").toLowerCase();
    var curfew = (cond.match(/curfew\s+([^;,.]+)/i) || [])[1], county = (cond.match(/stay in ([A-Za-z .'-]+?) County/i) || [])[1];
    var std = (a.tasks || []).filter(function (x) { return x.std; }), docs = [];
    if (std[0] && std[0].status === "done") docs.push("state_id");
    if (std[1] && std[1].status === "done") docs.push("ssn_card");
    var p = {
      id: a.id, display_name: a.name.split(" ")[0], city: (a.loc || "").split(",")[0].trim(),
      county: geo && geo.county ? String(geo.county).replace(/ County$/i, "") : null, zip: zipOf(a) || null,
      lat: geo && geo.lat != null ? geo.lat : null, lon: geo && geo.lon != null ? geo.lon : null,
      days_since_release: a.dayN,
      supervision: { type: ["parole", "probation", "pretrial", "none"].indexOf(t) >= 0 ? t : "unknown", gps: /\bgps\b/i.test(cond), curfew: curfew ? curfew.trim() : null, county_restriction: county ? county.trim() : null, notes: [sup.officer || "", sup.cadence ? "Check-ins: " + sup.cadence : "", cond].filter(Boolean).join(". ") || null },
      documents_held: docs, housing_status: AG_HOUSING[a.housing && a.housing.status] || "unknown",
      offense_categories: [], goals: (a.goals || []).slice(), barriers: (a.barriers || []).slice(),
      notes: [a.housing && a.housing.detail, a.emp ? "Employment: " + a.emp.status + (a.emp.detail ? ". " + a.emp.detail : "") : ""].filter(Boolean).join(" ")
    };
    Object.keys(p).forEach(function (k) { if (p[k] == null) delete p[k]; });
    return p;
  }
  /* which of our need keys an agent result belongs to: his category plus fixed keyword rules (no AI) */
  function agentNeed(c) {
    var t = String([c.name, c.description, c.category].join(" ")).toLowerCase(), k = c.category;
    if (k === "legal_id") return /\bssn\b|social security/.test(t) ? "ssn" : /\bid\b|i\.d\.|dmv|identification|birth certificate|driver/.test(t) ? "id" : /bank|checking|credit union|savings/.test(t) ? "bank" : /\bvot/.test(t) ? "vote" : /expunge|record|clean slate|pardon|1203/.test(t) ? "records" : "legal";
    if (k === "food_benefits") return /medi-?cal|medicaid|health coverage/.test(t) ? "medicaid" : "snap";
    if (k === "health") return /treatment|substance|recovery|mental|detox|sober/.test(t) ? "treatment" : "health";
    if (k === "jobs") return /training|certif|apprentice|course|class/.test(t) ? "training" : "jobs";
    if (k === "housing") return /shelter/.test(t) ? "shelter" : "housing";
    return AG_NEED[k] || "housing";
  }
  /* the plan regrouped into our 7 categories: each result keeps its section's urgency; categories sort most urgent first */
  var URG_ORDER = { today: 0, this_week: 1, this_month: 2 };
  function agentGroups(plan) {
    var by = {}, seen = {};
    ((plan && plan.sections) || []).forEach(function (s) {
      var urg = (s.need || {}).urgency || null;
      (s.recommendations || []).forEach(function (r) {
        var c = r.candidate || {}, it = agentItem(c), cat = catOf(it.need).id;
        if (seen[it.id]) return; seen[it.id] = 1;
        var g = by[cat] = by[cat] || { id: cat, items: [], urgency: null };
        g.items.push({ c: c, item: it, why: r.why_it_fits || "", bring: r.what_to_bring || [], urgency: urg });
        if (urg && (g.urgency == null || URG_ORDER[urg] < URG_ORDER[g.urgency])) g.urgency = urg;
      });
    });
    var cats = CATS.filter(function (c) { return by[c.id]; }).map(function (c) { return Object.assign({ label: c.label }, by[c.id]); });
    cats.sort(function (x, y) { var u = (URG_ORDER[x.urgency] != null ? URG_ORDER[x.urgency] : 3) - (URG_ORDER[y.urgency] != null ? URG_ORDER[y.urgency] : 3); return u || CATS.findIndex(function (c) { return c.id === x.id; }) - CATS.findIndex(function (c) { return c.id === y.id; }); });
    return { cats: cats, act_today: (plan && plan.act_today) || [], excluded: (plan && plan.excluded) || [], count: cats.reduce(function (n, c) { return n + c.items.length; }, 0) };
  }
  function agentMatch(e, q) {
    var words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean), hay = [e.c.name, e.c.description, e.why, e.item.address, NEEDS[e.item.need], catOf(e.item.need).label].join(" ").toLowerCase();
    return words.every(function (w) { return hay.indexOf(w) >= 0; });
  }
  /* turn an agent candidate into our resource item shape so it can be recommended like any other */
  function agentItem(c) {
    var key = String((c.name || "") + "|" + (c.address || "")).toLowerCase(), h = 0;
    for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return { id: "ai-" + (h >>> 0).toString(36), need: agentNeed(c), kind: "ai", name: c.name, address: [c.address, c.city].filter(function (x, i, arr) { return x && (i === 0 || String(arr[0] || "").indexOf(x) < 0); }).join(", ") || null,
      phone: c.phone || null, url: c.url || c.source_url || null, hours: c.hours || null, distanceMi: c.distance_miles != null ? c.distance_miles : null, notes: c.description || null,
      source: { name: c.source ? "AI search · " + c.source : "AI search", url: c.source_url || c.url || null, trust: "directory" } };
  }
  /* ---------- Benefits: CalFresh (SNAP) and Medi-Cal (Medicaid) ----------
   * Fixed content, no AI. Rules come from state and federal sources (see data/rules_ca.json); every phone number and
   * link was checked on 2026-11-12. County numbers are from the CDSS county contact list. */
  var STATEWIDE = { calfresh: { name: "CalFresh Info Line", phone: "1-877-847-3663" }, medi_cal: { name: "Medi-Cal Helpline", phone: "1-800-541-5555" } };
  var COUNTY_SS = {
    "Alameda": { name: "Alameda County Social Services", phone: "1-888-999-4772" },
    "Contra Costa": { name: "Contra Costa Social Services, Richmond office", phone: "(510) 412-3280" },
    "Sacramento": { name: "Sacramento County Human Assistance", phone: "(916) 874-3100" },
    "San Francisco": { name: "San Francisco Human Services Agency", phone: "(415) 558-1001" },
    "San Joaquin": { name: "San Joaquin County Human Services", phone: "(209) 468-1000" },
    "Santa Clara": { name: "Santa Clara County Social Services", phone: "1-877-962-3633" }
  };
  var CITY_COUNTY = { "Oakland": "Alameda", "Hayward": "Alameda", "San Leandro": "Alameda", "Fremont": "Alameda", "Berkeley": "Alameda", "Richmond": "Contra Costa",
    "Sacramento": "Sacramento", "San Francisco": "San Francisco", "San Jose": "Santa Clara", "Stockton": "San Joaquin" };
  /* the person's county social services office (it handles both CalFresh and Medi-Cal), or the statewide line */
  function benefitOffice(a, prog) {
    var county = CITY_COUNTY[(a.loc || "").split(",")[0].trim()];
    return county && COUNTY_SS[county] ? Object.assign({ county: county }, COUNTY_SS[county]) : STATEWIDE[prog];
  }
  var BENEFITS = {
    calfresh: {
      id: "calfresh", name: "CalFresh", plain: "Food money (SNAP)", tile: "food",
      get: "Up to $306 a month", getSub: "On an EBT card, for a household of 1.", alGet: "Money for food, every month", alGetSub: "Up to $306 a month on a card you use at stores.",
      alWho: "Most people leaving prison can get it. A drug conviction does not stop you in California.",
      rules: [
        { text: "Income under $2,660 a month before tax (1 person). California uses 200% of the poverty line.", src: "USDA FY2027 limits", url: "https://www.fns.usda.gov/snap/allotment/cola" },
        { text: "A drug felony does not disqualify anyone in California.", src: "W&I 18901.3", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=WIC&sectionNum=18901.3" },
        { text: "People on parole or probation must keep following their terms.", src: "W&I 18901.3", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=WIC&sectionNum=18901.3" }
      ],
      verdict: "Likely eligible", verdictNote: "Confirm income",
      bring: ["State ID", "proof of address", "release papers"],
      apply: { label: "Apply at GetCalFresh", alLabel: "Apply online", url: "https://www.getcalfresh.org/" },
      statuses: [["not_started", "Not started"], ["applied", "Applied"], ["interview_done", "Interview done"], ["approved", "Approved"], ["denied", "Denied"]],
      done: "approved"
    },
    medi_cal: {
      id: "medi_cal", name: "Medi-Cal", plain: "Free health care (Medicaid)", tile: "health",
      get: "Free health care", getSub: "Doctor visits, prescriptions, mental health and substance use care.", alGet: "Free health care", alGetSub: "Doctor visits, medicine, and help with mental health or drugs and alcohol.",
      alWho: "You may already have it. Prison often signs you up before you leave.",
      rules: [
        { text: "Ages 19–64 with income under $1,836 a month (1 person, 138% of the poverty line).", src: "2026 Medi-Cal chart", url: "https://stgenssa.sccgov.org/debs/program_handbooks/charts/assets/5MediCal/FPLMonthIncomeCompare.htm" },
        { text: "People leaving state prison are signed up before release (CalAIM). Look for a Reentry Care Plan in their release papers.", src: "CDCR CalAIM", url: "https://www.cdcr.ca.gov/bph/wp-content/uploads/sites/161/2025/10/pv-3.-Calaims-Justice-Involved-Reentry-Initiative-Implementation.pdf" },
        { text: "Work requirements start Jan 1, 2027. Anyone released in the last 3 months is exempt, so apply early.", src: "AAPD FAQ", url: "https://www.aapd.com/medicaid-work-requirements-faq/" }
      ],
      verdict: "Likely eligible", verdictNote: "Confirm income",
      bring: ["State ID", "release papers", "Social Security number"],
      apply: { label: "Apply at BenefitsCal", alLabel: "Apply online", url: "https://benefitscal.com/" },
      statuses: [["not_confirmed", "Not confirmed"], ["applied", "Applied"], ["enrolled", "Enrolled"], ["denied", "Denied"]],
      done: "enrolled"
    }
  };
  var BEN_ORDER = ["calfresh", "medi_cal"];
  function benefitOf(a, prog) { a.benefits = a.benefits || {}; return a.benefits[prog] || (a.benefits[prog] = { status: BENEFITS[prog].statuses[0][0], date: null }); }
  /* status tag: [tone, case manager label, alumnus label] */
  function benefitTag(a, prog) {
    var s = benefitOf(a, prog).status;
    return {
      not_started: ["pend", "Not started", "Not started"],
      not_confirmed: ["pend", "Not confirmed · may be enrolled", "Check if you have it"],
      applied: ["pend", "Applied · waiting", "Waiting to hear back"],
      interview_done: ["pend", "Interview done · result not recorded", "Waiting on a result"],
      approved: ["ok", "Approved", "Approved"],
      enrolled: ["ok", "Enrolled", "You have it"],
      denied: ["warn", "Denied", "Denied"]
    }[s] || ["pend", s, s];
  }
  /* tel: link: US 10-digit numbers get +1; short codes such as 311 or 211 stay as they are */
  function phoneHref(p) { var d = String(p).split(/ext|x|\(select/i)[0].replace(/[^\d]/g, ""); return "tel:" + (d.length === 10 ? "+1" + d : d.length === 11 && d[0] === "1" ? "+" + d : d); }
  /* the next steps for a program in its current status, in the shared step shape:
     { title, bullets, links: [{kind:'call'|'web'|'tile', label, href, prog}] } for "cm" (staff voice) or "me" (the person, as "you") */
  function benefitSteps(a, prog, view) {
    var B = BENEFITS[prog], b = benefitOf(a, prog), me = view === "me", first = a.name.split(" ")[0], off = benefitOffice(a, prog), sw = STATEWIDE[prog];
    var call = function (o, ask) { return { kind: "call", label: "Call " + o.phone, href: phoneHref(o.phone), note: ask || "" }; };
    var web = function (u, l) { return { kind: "web", label: l, href: u }; };
    var when = b.date ? fmShort(b.date) : null, out = [];
    if (prog === "calfresh") {
      if (b.status === "not_started") out.push({ title: me ? "Apply for CalFresh (food money)" : "Apply for CalFresh with " + first, bullets: me ? ["Takes about 10 minutes.", "Ask for the fast (expedited) option."] : ["About 10 minutes online.", "Ask for expedited (fast) benefits."], links: [web(B.apply.url, me ? B.apply.alLabel : B.apply.label), call(off)] });
      if (b.status === "applied") out.push({ title: me ? "Check on your CalFresh application" : "Check on " + first + "'s CalFresh application", bullets: me ? ["Ask: “When is my CalFresh interview?”"] : ["Ask the county when the interview is."], links: [call(off)] });
      if (b.status === "interview_done") out.push({ title: me ? "Find out if your CalFresh was approved" : "Get " + first + "'s CalFresh interview result", bullets: me ? ["Ask: “Was my CalFresh approved?”"] : [(when ? "Interview was " + when + ". " : "") + "No result on file."], links: [call(off)] });
      if (b.status === "denied") out.push({ title: me ? "Ask why your CalFresh was denied" : "Ask why " + first + "'s CalFresh was denied", bullets: me ? ["You can apply again or ask for a hearing."] : ["Get the reason in writing.", first + " can apply again or ask for a hearing."], links: [call(off), web(B.apply.url, me ? "Apply again" : "Apply again at GetCalFresh")] });
    } else {
      if (b.status === "not_confirmed") out.push({ title: me ? "Check if you already have Medi-Cal" : "Check if " + first + " already has Medi-Cal", bullets: me ? ["Look in your release papers for a Medi-Cal card.", "Or call and ask: “Am I enrolled in Medi-Cal?”"] : ["Prison usually signs people up before release (CalAIM).", "Ask who " + first + "'s care manager is."], links: [call(sw)] });
      if (b.status === "applied") out.push({ title: me ? "Check on your Medi-Cal application" : "Check on " + first + "'s Medi-Cal application", bullets: me ? ["Ask: “Is my Medi-Cal approved?”"] : ["Ask the county if it's approved."], links: [call(off)] });
      if (b.status === "denied") out.push({ title: me ? "Ask why your Medi-Cal was denied" : "Ask why " + first + "'s Medi-Cal was denied", bullets: me ? ["You can apply again or ask for a hearing."] : ["Get the reason in writing.", first + " can apply again or ask for a hearing."], links: [call(off), web(B.apply.url, me ? "Apply again" : "Apply again at BenefitsCal")] });
      if (b.status === "not_confirmed") out.push({ title: me ? "Don't have it? Apply online" : "Not enrolled? Apply", bullets: [], links: [web(B.apply.url, me ? B.apply.alLabel : B.apply.label), call(off)], followUp: true });
    }
    return out;
  }
  /* "Act today" steps that come from the tiles (not AI): the first open step of each program, linking to its tile */
  function benefitTodaySteps(a, view) {
    var out = [];
    BEN_ORDER.forEach(function (p) {
      var s = benefitSteps(a, p, view).filter(function (x) { return !x.followUp; })[0];
      if (s) out.push(Object.assign({ kind: "benefit", prog: p, what_to_bring: [] }, s, { links: s.links.slice(0, 1).concat([{ kind: "tile", label: "See " + BENEFITS[p].name, prog: p }]) }));
    });
    return out;
  }
  /* the case manager (or the person) updates a status; standard tasks 3 and 4 follow so the checklist agrees */
  function setBenefit(a, prog, status) {
    var B = BENEFITS[prog]; if (!B || !B.statuses.some(function (s) { return s[0] === status; })) return false;
    var b = benefitOf(a, prog); b.status = status; b.date = today(); b.by = actor();
    var t = (a.tasks || []).filter(function (x) { return x.std; })[prog === "calfresh" ? 2 : 3];
    if (t) setStatus(t, status === B.done ? "done" : status === "applied" || status === "interview_done" ? "in_progress" : "open", actor());
    S.ver++;
    return true;
  }
  /* any act-today step (fixed benefit step, new AI step, old AI step, shared step) in one shape for display */
  function normStep(x, view) {
    var me = view === "me";
    if (x.kind === "benefit") return { title: x.title, bullets: x.bullets || [], links: x.links || [], bring: x.what_to_bring || [], prog: x.prog, benefit: true };
    if (x.text != null) return { title: x.text, bullets: x.bullets || [], links: x.links || [], bring: x.bring || [], done: !!x.done, prog: x.prog || null, benefit: !!x.prog };
    if (x.title) {
      var links = [];
      if (x.how === "call" && x.phone) links.push({ kind: "call", label: "Call " + x.phone, href: phoneHref(x.phone) });
      if (x.url) links.push({ kind: "web", label: x.how === "apply_online" ? "Apply online" : "Open website", href: x.url });
      if (x.how !== "call" && x.phone) links.push({ kind: "call", label: "Call " + x.phone, href: phoneHref(x.phone) });
      if (x.how === "visit" && x.address) links.push({ kind: "map", label: "Map", href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(x.address) });
      return { title: me ? x.for_alumnus_title || x.title : x.title, bullets: (me ? x.for_alumnus_bullets : x.bullets) || [], links: links.slice(0, 2), bring: x.what_to_bring || [], missing: !!x.missing_contact || !links.length };
    }
    /* plans saved before the new format: one paragraph, no links */
    return { title: me ? x.for_alumnus || toYou(x.step) : x.step, bullets: [], links: [], bring: x.what_to_bring || [], legacy: true };
  }

  window.RXC = {
    S: S, R: R, iso: iso, esc: esc, fm: fm, fmShort: fmShort, fmDay: fmDay, ft: ft, initials: initials, days: days, today: today, ago: ago, hd: hd,
    byId: byId, cmById: cmById, mine: mine, myAlumnus: myAlumnus, actor: actor, stageOf: stageOf, who: who,
    lastTwoWay: lastTwoWay, sinceContact: sinceContact, openTasks: openTasks, overdue: overdue, nextEvents: nextEvents,
    HOUSING: HOUSING, EVT: EVT, EVT_TYPES: EVT_TYPES, EMP: EMP, KIND: KIND, SECTIONS: SECTIONS,
    facts: facts, recordChecks: recordChecks, logPortal: logPortal, setStatus: setStatus,
    snap: snap, restore: restore, addTask: addTask, addEventTo: addEventTo, addNote: addNote, handoff: handoff, toggleTask: toggleTask,
    sources: sources, briefPrompt: briefPrompt, validateBrief: validateBrief, digest: digest,
    diffPrompt: diffPrompt, validateDiff: validateDiff, applyChange: applyChange, sample: sample, whyFailed: whyFailed,
    priorities: priorities, toYou: toYou, toAgentProfile: toAgentProfile, agentItem: agentItem, agentNeed: agentNeed, agentGroups: agentGroups, agentMatch: agentMatch, AG_NEED: AG_NEED,
    BENEFITS: BENEFITS, BEN_ORDER: BEN_ORDER, benefitOf: benefitOf, benefitTag: benefitTag, benefitOffice: benefitOffice, benefitSteps: benefitSteps, benefitTodaySteps: benefitTodaySteps, setBenefit: setBenefit, normStep: normStep, phoneHref: phoneHref,
    NEEDS: NEEDS, CATS: CATS, catOf: catOf, summaryOf: summaryOf, TRUST_L: TRUST_L, zipOf: zipOf, rank: rank, searchRes: searchRes, resState: resState, loadResources: loadResources, Res: Res
  };
})();
