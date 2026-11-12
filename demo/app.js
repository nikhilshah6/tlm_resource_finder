/* app.js: views for the standalone TLM demo (case manager + alumnus). SAMPLE DATA ONLY.
 * Hash routes: #/ sign-in, #/today, #/alumni, #/calendar, #/resources, #/case/<id>, #/briefing/<id>, #/me, #/me/tasks, #/me/resources.
 * All record changes go through act() so every one has an Undo toast. AI drafts are never saved without approval.
 */
var cur = null; // signed-in user: {id, kind:"cm"|"alumnus", cm?, alumnusId?, name, title?}
(function () {
  "use strict";
  var C = window.RXC, R = C.R, esc = C.esc;
  var V = window.RXV = { q: "", stage: "all", from: "#/today", brief: {}, flags: {}, diff: null, open: {}, suggest: {}, stats: { briefings: 0, lines: 0, flagged: 0 } };
  var $ = function (id) { return document.getElementById(id); };
  var app = $("app"), dlg = $("sheet"), toastEl = $("toast");
  var MARCUS = "a-marcus";

  /* ---------- icons (Tabler outline) ---------- */
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>"; }
  var I = {
    today: ic('<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13a20 20 0 0 0 18 0"/>'),
    alumni: ic('<path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>'),
    calendar: ic('<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M16 3v4M8 3v4M4 11h16"/>'),
    home: ic('<path d="M5 12H3l9-9l9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>'),
    tasks: ic('<path d="M9.6 20H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/><path d="M14 19l2 2l4-4M9 8h4M9 12h2"/>'),
    pin: ic('<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0"/><path d="M17.66 16.66L13.41 20.9a2 2 0 0 1-2.83 0l-4.24-4.24a8 8 0 1 1 11.32 0z"/>'),
    out: ic('<path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M9 12h12l-3-3M18 15l3-3"/>'),
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6"/></svg>',
    back: ic('<path d="M15 6l-6 6l6 6"/>'),
    x: ic('<path d="M18 6L6 18M6 6l12 12"/>'),
    shield: ic('<path d="M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z"/>'),
    target: ic('<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0"/>'),
    flag: ic('<path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1-7 0a5 5 0 0 0-7 0V5zM5 21v-7"/>'),
    spark: ic('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>'),
    plus: ic('<path d="M12 5v14M5 12h14"/>'),
    phone: ic('<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
    moon: ic('<path d="M12 3a6 6 0 0 0 9 9a9 9 0 1 1-9-9z"/>'),
    sun: ic('<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0"/><path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7l-.7.7m0 11.4l.7.7m-12.1-.7l-.7.7"/>'),
    print: ic('<path d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2"/><path d="M17 9V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4"/><path d="M7 13h10v8H7z"/>'),
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
  };

  /* ---------- toast with Undo ---------- */
  var tT = null;
  function say(msg, undo) {
    clearTimeout(tT); toastEl.textContent = "";
    var s = document.createElement("span"); s.textContent = msg; toastEl.appendChild(s);
    if (undo) { var b = document.createElement("button"); b.type = "button"; b.textContent = "Undo"; b.onclick = function () { clearTimeout(tT); toastEl.classList.remove("show"); undo(); }; toastEl.appendChild(b); }
    toastEl.classList.add("show"); tT = setTimeout(function () { toastEl.classList.remove("show"); }, undo ? 6500 : 3200);
  }
  /* run a change on one record with a snapshot and an Undo toast */
  function act(a, msg, fn) { var sn = C.snap(a); fn(); C.S.ver++; render(); say(msg, function () { C.restore(sn); render(); say("Undone"); }); }

  /* ---------- sheets ---------- */
  var lastFocus = null;
  function sheet(o) {
    if (!dlg.open) lastFocus = document.activeElement;
    dlg.className = "sheet" + (o.wide ? " wide" : "");
    /* One layout for every modal: title left, close (✕) right; body; footer with Cancel/Close, then any secondary actions, then the one primary. */
    var pri = o.right ? o.right.replace("btn sm pri", "btn pri") : "", closeLbl = o.leftLabel || (pri || o.foot ? "Cancel" : "Close");
    dlg.innerHTML = '<div class="sh"><h2 id="sheetTitle">' + esc(o.title) + '</h2><button type="button" class="iconbtn sh-x" onclick="RXV.close()" aria-label="Close">' + I.x + "</button></div>" +
      '<div class="sb" id="sheetBody">' + (o.body || "") + "</div>" +
      '<div class="sbf" id="sheetFoot"><button type="button" class="btn" onclick="RXV.close()">' + closeLbl + "</button>" + (o.foot || "") + pri + "</div>";
    if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); } document.body.classList.add("sheet-open"); }
    /* focus the first field when there is one, otherwise the sheet title (so the Close button doesn't get a focus ring) */
    var f = dlg.querySelector("[autofocus]") || $("sheetTitle"); if (f === $("sheetTitle")) f.setAttribute("tabindex", "-1"); if (f && f.focus) f.focus();
  }
  V.close = function () { V.briefTok = (V.briefTok || 0) + 1; if (dlg.open) { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); } };
  dlg.addEventListener("close", function () { document.body.classList.remove("sheet-open"); if (cur && route() === "/today") { var tr = document.querySelector("#todayNotes .draftflag"), dr = C.mine().some(function (x) { return hasDraft(x.id); }); if (tr) tr.textContent = dr ? "Draft saved" : ""; } if (lastFocus && document.contains(lastFocus) && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) V.close(); });

  /* ---------- small builders ---------- */
  function gh(title, right) { return '<div class="gh"><h2>' + esc(title) + "</h2>" + (right ? '<span class="muted">' + right + "</span>" : "") + "</div>"; }
  function group(rows, empty) { return '<div class="group">' + (rows || '<div class="row empty">' + esc(empty || "Nothing here yet.") + "</div>") + "</div>"; }
  function av(name) { return '<span class="av" aria-hidden="true">' + esc(C.initials(name)) + "</span>"; }
  function stageTag(a) { var s = C.stageOf(a); return '<span class="tag' + (a.stage === "first30" ? " accent" : "") + '">' + esc(s.label) + "</span>"; }
  function skel(n) { var w = [92, 78, 86, 64, 90, 70], h = '<div aria-busy="true" aria-label="Loading">'; for (var i = 0; i < n; i++) h += '<span class="sk" style="width:' + w[i % w.length] + '%"></span>'; return h + "</div>"; }
  function onlyIf(c, s) { return c ? s : ""; }
  function caseRow(a, sec) { return '<a class="row inset" href="#/case/' + a.id + '">' + av(a.name) + '<div class="body"><div class="ttl">' + esc(a.name) + '</div><div class="sec">' + sec + "</div></div>" + I.chev + "</a>"; }
  function contactText(a) { var s = C.sinceContact(a); return s == null ? "No contact on record" : "Last contact " + C.ago(s); }


  /* ---------- appearance: System / Light / Dark (kept in this browser only) ---------- */
  var THEME_KEY = "tlm-theme";
  function sysDark() { try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch (e) { return false; } }
  function savedTheme() { try { var t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "system"; } catch (e) { return "system"; } }
  function applyTheme(t) { V.theme = t; if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }
  function isDark() { return V.theme === "dark" || (V.theme === "system" && sysDark()); }
  function themeBtn(cls) { var d = isDark(); return '<button type="button" class="iconbtn' + (cls ? " " + cls : "") + '" onclick="RXV.toggleTheme()" aria-label="Switch to ' + (d ? "light" : "dark") + ' mode" title="Switch to ' + (d ? "light" : "dark") + ' mode">' + (d ? I.sun : I.moon) + "</button>"; }
  function themeSeg() { return '<div class="seg" role="group" aria-label="Appearance">' + [["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(function (o) { return '<button type="button" aria-pressed="' + (V.theme === o[0]) + '" onclick="RXV.setTheme(\'' + o[0] + '\')">' + o[1] + "</button>"; }).join("") + "</div>"; }
  function refreshTheme() {
    document.querySelectorAll(".iconbtn[onclick='RXV.toggleTheme()']").forEach(function (b) { var tmp = document.createElement("div"); tmp.innerHTML = themeBtn(b.classList.contains("signin-theme") ? "signin-theme" : ""); b.replaceWith(tmp.firstChild); });
    var seg = document.querySelector('#sheet .seg[aria-label="Appearance"]'); if (seg) seg.outerHTML = themeSeg();
  }
  V.setTheme = function (t) { applyTheme(t); try { if (t === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch (e) {} refreshTheme(); say(t === "system" ? "Following your device's appearance" : t === "dark" ? "Dark mode on" : "Light mode on"); };
  V.toggleTheme = function () { V.setTheme(isDark() ? "light" : "dark"); };
  applyTheme(savedTheme());
  try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (V.theme === "system") refreshTheme(); }); } catch (e) {}

  /* ---------- router ---------- */
  function route() { return (location.hash || "#/").replace(/^#/, ""); }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  V.go = go;
  window.addEventListener("hashchange", function () { if (dlg.open) V.close(); render(); window.scrollTo(0, 0); });

  function render() {
    var r = route(), p = r.split("/").filter(Boolean);
    if (!cur) { if (r !== "/") { history.replaceState(null, "", "#/"); } return renderSignin(); }
    var cm = cur.kind === "cm";
    if (cm) {
      if (p[0] === "case" && C.byId(p[1])) { V.lastCase = p[1]; return shell("case", renderCase(C.byId(p[1]))); }
      if (p[0] === "briefing" && C.byId(p[1])) { V.lastCase = p[1]; return shell("briefing", renderBriefing(C.byId(p[1]))); }
      if (p[0] === "alumni") return shell("alumni", renderAlumni());
      if (p[0] === "calendar") return shell("calendar", renderCalendar());
      if (p[0] === "resources") return shell("resources", renderCmResources());
      return shell("today", renderToday());
    }
    var a = C.myAlumnus();
    if (p[1] === "tasks") return shell("mytasks", renderMyTasks(a));
    if (p[1] === "resources") return shell("myres", renderMyResources(a));
    return shell("home", renderHome(a));
  }
  V.render = render;

  /* ---------- sign-in ---------- */
  function renderSignin() {
    document.title = "Sign in · TLM Reentry";
    app.innerHTML = themeBtn("signin-theme") + '<main class="signin"><div class="signin-in"><div class="logo-row"><span class="tlm-tile" aria-hidden="true">TLM</span><div><h1 class="mark">TLM Reentry</h1><div class="muted">Casework portal</div></div></div>' +
      '<p class="lede">A prototype for reentry case managers and the alumni they support. Every person, note and date is sample data.</p>' +
      gh("Sign in as a case manager") + group(R.CMS.map(function (c) { var n = C.S.alumni.filter(function (a) { return a.cm === c.id; }).length; return '<button type="button" class="row inset" onclick="RXV.signIn(\'' + c.id + '\')">' + av(c.name) + '<div class="body"><div class="ttl">' + esc(c.name) + '</div><div class="sec">' + esc(c.title) + " · " + n + " alumni</div></div>" + I.chev + "</button>"; }).join("")) +
      gh("Sign in as an alumnus") + group('<button type="button" class="row inset" onclick="RXV.signIn(\'alumnus\')">' + av("Marcus Johnson") + '<div class="body"><div class="ttl">Marcus Johnson</div><div class="sec">Day ' + C.byId(MARCUS).dayN + " since release · Oakland</div></div>" + I.chev + "</button>") +
      "</div></main>";
  }
  V.signIn = function (who) {
    if (who === "alumnus") {
      var a = C.byId(MARCUS); cur = { id: "marcus", kind: "alumnus", alumnusId: a.id, name: a.name };
      if (!a.portal.log.some(function (e) { return e.kind === "login" && e.date === C.today(); })) C.logPortal(a, "login", "Signed in to the portal", "logins", 1);
      go("#/me");
    } else { var c = C.cmById(who); cur = { id: c.userId, kind: "cm", cm: c.id, name: c.name, title: c.title }; V.q = ""; V.stage = "all"; V.lastCase = null; V.resFor = null; go("#/today"); }
  };
  V.signOut = function () { if (dlg.open) V.close(); clearTimeout(tT); toastEl.classList.remove("show"); /* an Undo toast never carries over to the next person */ cur = null; go("#/"); };

  /* ---------- shell: sidebar (logo, profile card, nav, sample-data note), top bar, phone tab bar ---------- */
  function navItems() {
    if (cur.kind === "cm") return [["today", "Today", "#/today", I.today], ["alumni", "Alumni", "#/alumni", I.alumni], ["calendar", "Calendar", "#/calendar", I.calendar], ["resources", "Resources", "#/resources", I.pin]];
    var a = C.myAlumnus(), n = C.openTasks(a).filter(function (t) { return !t.std; }).length;
    return [["home", "Home", "#/me", I.home], ["mytasks", "Tasks", "#/me/tasks", I.tasks, n], ["myres", "Resources", "#/me/resources", I.pin]];
  }
  function shell(page, v) {
    var items = navItems(), home = cur.kind === "cm" ? "#/today" : "#/me";
    var active = page === "case" || page === "briefing" ? (V.from.indexOf("alumni") >= 0 ? "alumni" : V.from.indexOf("calendar") >= 0 ? "calendar" : V.from.indexOf("resources") >= 0 ? "resources" : "today") : page;
    function link(it) { return '<a class="nav" href="' + it[2] + '"' + (it[0] === active ? ' aria-current="page"' : "") + ">" + it[3] + "<span>" + it[1] + "</span>" + (it[4] ? '<span class="count" aria-label="' + it[4] + ' open">' + it[4] + "</span>" : "") + "</a>"; }
    var who = cur.title || "Alumnus";
    document.title = v.title + " · TLM Reentry";
    /* Sidebar (Rox / ElevenLabs pattern): logo, one labelled nav group, account switcher at the bottom. Sign out lives in the account sheet. */
    app.innerHTML = '<div class="shell"><nav class="side" aria-label="Main"><div class="side-top">' +
      '<a class="logo-row" href="' + home + '"><span class="tlm-tile" aria-hidden="true">TLM</span><span><b>TLM Reentry</b></span></a>' +
      '<p class="side-label">' + (cur.kind === "cm" ? "Casework" : "My reentry") + "</p>" +
      '<div class="navlist">' + items.map(link).join("") + "</div></div>" +
      '<div class="side-foot"><button type="button" class="profile" onclick="RXV.account()" aria-label="Account: ' + esc(cur.name) + '">' + av(cur.name) + '<span class="pmeta"><b>' + esc(cur.name) + '</b><span class="muted">' + esc(who) + '</span></span><svg class="updown" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg></button></div></nav>' +
      '<div class="main"><header class="bar" id="bar"><div class="bar-l">' + (v.back ? '<a class="back" href="' + v.back[1] + '">' + I.back + esc(v.back[0]) + "</a>" : "") + "</div>" +
      '<div class="bar-r">' + (v.barRight || '<span class="pill">Sample data</span>') + themeBtn() + '<button type="button" class="av av-btn" onclick="RXV.account()" aria-label="Account">' + esc(C.initials(cur.name)) + "</button></div></header>" +
      '<main class="content' + (v.wide ? " wide" : "") + '" id="content">' + v.html + "</main></div>" +
      '<nav class="tabs" aria-label="Main">' + items.map(link).join("") + '<button type="button" class="nav signout" onclick="RXV.signOut()">' + I.out + "<span>Sign out</span></button></nav></div>";
    if (page !== "case" && page !== "briefing") V.from = "#" + route();
    onScroll();
    if (v.after) v.after();
  }
  V.back = function () { go(V.from || "#/today"); };
  function onScroll() { var b = $("bar"); if (b) b.classList.toggle("scrolled", window.scrollY > 4); }
  window.addEventListener("scroll", onScroll, { passive: true });
  V.account = function () {
    var cm = cur.kind === "cm", a = cm ? null : C.myAlumnus();
    sheet({ title: "Account", leftLabel: "Close",
      body: '<div class="group"><div class="row">' + av(cur.name) + '<div class="body"><div class="ttl">' + esc(cur.name) + '</div><div class="sec">' + esc(cur.title || "Alumnus") + "</div></div></div>" +
        '<div class="row"><div class="body"><div class="sec">' + (cm ? "Caseload" : "Case manager") + '</div><div class="ttl">' + (cm ? C.mine().length + " alumni" : esc(C.who(a.cm))) + "</div></div></div></div>" +
        gh("Appearance") + '<div class="group"><div class="field">' + themeSeg() + '</div></div>' + '<p class="gf">Sample data only. Nothing here is a real person or connected to real records.</p>',
      foot: '<button type="button" class="btn pri" onclick="RXV.signOut()">Sign out</button>' });
  };

  /* caseload pickers: sheets opened from Today, Calendar or Resources ask which alumnus */
  function picker(id, sel, onchange) { return '<div class="field"><label for="' + id + '">Alumnus</label><select id="' + id + '"' + (onchange ? ' onchange="' + onchange + '"' : "") + ">" + C.mine().map(function (a) { return '<option value="' + a.id + '"' + (a.id === sel ? " selected" : "") + ">" + esc(a.name) + "</option>"; }).join("") + "</select></div>"; }

  /* ---------- case manager: Today ---------- */
  function hasDraft(aid) { if (V.drafts && V.drafts[aid] != null) return !!V.drafts[aid]; try { return !!sessionStorage.getItem("tlm-draft-" + aid); } catch (e) { return false; } }
  function renderToday() {
    /* Today answers "who needs me, and what do I do?": the next call, then a short ranked list with one reason and one action each,
       then the rest of the week's calls (collapsed). Notes and the full task list live on each case. */
    var m = C.mine(), t = C.today(), calls = [], draft = m.some(function (a) { return hasDraft(a.id); });
    m.forEach(function (a) { a.events.forEach(function (e) { if (e.type === "case-manager" && !e.done && e.date >= t && C.days(t, e.date) <= 7) calls.push({ a: a, e: e }); }); });
    calls.sort(function (x, y) { return (x.e.date + x.e.time) < (y.e.date + y.e.time) ? -1 : 1; });
    function when(e) { var d = C.days(t, e.date); return (d === 0 ? "Today" : d === 1 ? "Tomorrow" : C.fmShort(e.date)) + (e.time ? ", " + C.ft(e.time) : ""); }
    var h = '<div class="page-head"><div><h1 class="ltitle">Today</h1><p class="subtitle">' + esc(C.fmDay(t)) + "</p></div>" +
      '<div class="actions"><button type="button" class="btn" id="todayNotes" onclick="RXV.notes()">' + I.plus + 'Add call notes<span class="draftflag">' + (draft ? "Draft saved" : "") + '</span></button><button type="button" class="btn" onclick="RXV.assign()">' + I.plus + "Assign task</button></div></div>";
    /* 1. next call */
    var nx = calls[0];
    if (nx) {
      var why = C.priorities(nx.a).filter(function (r) { return r.kind !== "call"; })[0];
      h += '<section class="next-call" aria-labelledby="nc-h"><div class="nc-l"><div class="nc-k" id="nc-h">Next call · ' + esc(when(nx.e)) + '</div><a class="nc-n" href="#/case/' + nx.a.id + '">' + av(nx.a.name) + esc(nx.a.name) + "</a>" +
        '<div class="nc-s">' + esc(nx.e.title) + " · day " + nx.a.dayN + onlyIf(why, ' · <span class="' + (why && why.w >= 45 ? "warntext" : "") + '">' + esc(why ? why.text : "") + "</span>") + "</div></div>" +
        '<div class="nc-a"><a class="btn" href="#/case/' + nx.a.id + '">Open case</a><a class="btn pri" href="#/briefing/' + nx.a.id + '">Pre-call briefing</a></div></section>';
    }
    /* 2. needs you today: ranked by the record rules, one reason + one action */
    var ranked = m.map(function (a) { var r = C.priorities(a); return { a: a, r: r, score: r.reduce(function (n, x) { return n + x.w; }, 0) }; })
      .filter(function (x) { return x.r.length && (!nx || x.a.id !== nx.a.id); }) /* the next call already has its own card */
      .sort(function (x, y) { return y.score - x.score; }).slice(0, 5);
    h += gh("Needs you today", "ranked by the record, no AI") + group(ranked.map(function (x) {
      var top = x.r[0], more = x.r.slice(1, 2).map(function (y) { return y.text; }), call = x.r.some(function (y) { return y.kind === "call"; });
      return '<div class="row need"><span class="dot ' + (top.w >= 45 ? "warn" : top.w >= 30 ? "chk" : "info") + '" aria-hidden="true"></span><a class="body" href="#/case/' + x.a.id + '"><div class="ttl">' + esc(x.a.name) + ' <span class="when">day ' + x.a.dayN + "</span></div>" +
        '<div class="sec">' + esc(top.text) + (more.length ? ' <span class="muted">· ' + esc(more.join(" · ")) + "</span>" : "") + "</div></a>" +
        (call ? '<a class="btn sm" href="#/briefing/' + x.a.id + '">Prep call</a>' : '<a class="btn sm" href="#/case/' + x.a.id + '">Open case</a>') + "</div>";
    }).join(""), "Nobody on your caseload needs anything urgent today.");
    /* 3. the rest of the week's calls, collapsed */
    var rest = calls.slice(1);
    if (rest.length) h += '<details class="ctx group week-calls"><summary><span class="ttl">' + rest.length + " more call" + (rest.length === 1 ? "" : "s") + ' this week</span><span class="muted">' + esc(rest.map(function (x) { return x.a.name.split(" ")[0]; }).join(", ")) + "</span>" + I.chev + "</summary>" +
      rest.map(function (x) { return '<div class="row"><span class="time">' + esc(when(x.e)) + '</span><a class="body" href="#/case/' + x.a.id + '"><div class="ttl">' + esc(x.a.name) + '</div><div class="sec">' + esc(x.e.title) + '</div></a><a class="btn sm" href="#/briefing/' + x.a.id + '">Briefing</a></div>'; }).join("") + "</details>";
    else if (!nx) h += '<p class="gf">No calls scheduled in the next 7 days.</p>';
    return { title: "Today", html: h };
  }


  /* ---------- case manager: Alumni ---------- */
  function renderAlumni() {
    var stages = [["all", "All"]].concat(R.STAGES.map(function (s) { return [s.id, s.label]; })).concat([["flagged", "Needs review"]]);
    var h = '<h1 class="ltitle">Alumni</h1><p class="subtitle">Everyone on your caseload, most in need first. Stabilizing and Stable are assumed stages, not TLM definitions.</p>' +
      '<div class="tools"><div class="seg" role="group" aria-label="Stage">' + stages.map(function (s) { return '<button type="button" aria-pressed="' + (V.stage === s[0]) + '" onclick="RXV.setStage(\'' + s[0] + '\')">' + esc(s[1]) + "</button>"; }).join("") + '</div><input class="search" id="q" type="search" placeholder="Search by name or city" aria-label="Search alumni" value="' + esc(V.q) + '" oninput="RXV.search(this.value)"></div><div id="alist"></div>';
    return { title: "Alumni", html: h, after: drawAlumni, wide: true };
  }
  /* Caseload table: one 40px row per person, sortable. Default order is "needs you" (the Today priority rules, no AI). */
  V.sort = { k: "needs", dir: -1 };
  var ACOLS = [["name", "Name"], ["stage", "Stage"], ["day", "Day"], ["housing", "Housing"], ["next", "Next contact"], ["tasks", "Open tasks"], ["last", "Last contact"], ["needs", "Needs"]];
  function aRow(a) {
    var t = C.today(), nx = C.nextEvents(a, 1)[0], since = C.sinceContact(a), open = C.openTasks(a), od = open.filter(function (x) { return x.due && x.due < t; }).length;
    var pr = C.priorities(a), score = pr.reduce(function (n, x) { return n + x.w; }, 0), last = a.handoffs.length ? a.handoffs[a.handoffs.length - 1] : null;
    return { a: a, name: a.name, stage: C.stageOf(a).label, day: a.dayN, housing: C.HOUSING[a.housing.status], next: nx ? nx.date + (nx.time || "") : "9999", nx: nx, tasks: open.length, od: od, last: since == null ? 9999 : since, since: since, needs: score, pr: pr, from: last && last.to === a.cm ? last.from : null };
  }
  function drawAlumni() {
    var q = V.q.toLowerCase(), k = V.sort.k, dir = V.sort.dir;
    var list = C.mine().filter(function (a) { return (V.stage === "all" || a.stage === V.stage || (V.stage === "flagged" && C.recordChecks(a).some(function (c) { return c.sev === "warn"; }))) && (!q || (a.name + " " + a.loc).toLowerCase().indexOf(q) >= 0); })
      .map(aRow).sort(function (x, y) { var p = x[k], r = y[k]; return (p < r ? -1 : p > r ? 1 : 0) * dir || (x.name < y.name ? -1 : 1); });
    if (!list.length) { $("alist").innerHTML = group("", q ? "No one matches “" + V.q + "”." : V.stage === "flagged" ? "No one has a record flag right now." : "No alumni in this stage."); return; }
    var head = ACOLS.map(function (c) {
      var on = c[0] === k;
      return '<th scope="col" class="c-' + c[0] + '"' + (on ? ' aria-sort="' + (dir > 0 ? "ascending" : "descending") + '"' : "") + '><button type="button" onclick="RXV.sortBy(\'' + c[0] + '\')">' + esc(c[1]) + '<span class="sa" aria-hidden="true">' + (on ? (dir > 0 ? "↑" : "↓") : "") + "</span></button></th>";
    }).join("");
    var rows = list.map(function (x) {
      var a = x.a, top = x.pr[0];
      return '<tr data-id="' + a.id + '" onclick="if(!event.target.closest(\'a,button\'))location.hash=\'#/case/' + a.id + '\'">' +
        '<td class="c-name"><a href="#/case/' + a.id + '">' + av(a.name) + '<span><span class="nm">' + esc(a.name) + "</span>" + onlyIf(x.from, '<span class="muted">from ' + esc(C.who(x.from)) + "</span>") + "</span></a></td>" +
        '<td class="c-stage">' + stageTag(a) + "</td>" +
        '<td class="c-day num">' + x.day + "</td>" +
        '<td class="c-housing' + (a.housing.status === "unhoused" ? " warntext" : a.housing.status === "shelter" ? " chktext" : "") + '">' + esc(x.housing) + "</td>" +
        '<td class="c-next">' + (x.nx ? '<span class="num">' + esc(C.fmShort(x.nx.date)) + onlyIf(x.nx.time, ", " + esc(C.ft(x.nx.time))) + '</span><span class="muted">' + esc(x.nx.title) + "</span>" : '<span class="muted">None</span>') + "</td>" +
        '<td class="c-tasks num">' + x.tasks + onlyIf(x.od, ' <span class="chktext">· ' + x.od + " overdue</span>") + "</td>" +
        '<td class="c-last' + (x.since == null || x.since >= 14 ? " warntext" : "") + '">' + esc(x.since == null ? "None" : C.ago(x.since)) + "</td>" +
        '<td class="c-needs">' + (top ? '<span class="dot ' + (top.w >= 45 ? "warn" : top.w >= 30 ? "chk" : "info") + '" aria-hidden="true"></span><span class="nd" title="' + esc(x.pr.map(function (y) { return y.text; }).join("\n")) + '">' + esc(top.text) + "</span>" : '<span class="muted">—</span>') + "</td></tr>";
    }).join("");
    $("alist").innerHTML = '<div class="tbl"><table class="caseload"><caption class="sr">Caseload, ' + list.length + " people, sorted by " + esc((ACOLS.filter(function (c) { return c[0] === k; })[0] || [0, k])[1]) + "</caption><thead><tr>" + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }
  V.sortBy = function (k) { V.sort = { k: k, dir: V.sort.k === k ? -V.sort.dir : (k === "name" || k === "stage" || k === "next" ? 1 : -1) }; drawAlumni(); };
  V.search = function (v) { V.q = v; drawAlumni(); };
  V.setStage = function (s) { V.stage = s; render(); };

  /* ---------- case manager: Calendar (week strip, filters, day groups) ---------- */
  var EDOT = { court: "warn", parole: "chk", housing: "chk", interview: "ok", appt: "info", "case-manager": "" };
  var CALF = [["all", "All"], ["calls", "Check-in calls"], ["deadlines", "Deadlines and mandates"]];
  V.calF = "all";
  function calMatch(e) { return V.calF === "all" || (V.calF === "calls" ? e.type === "case-manager" : ["court", "parole", "housing"].indexOf(e.type) >= 0); }
  function renderCalendar() {
    /* One agenda: the next 30 days across the caseload, grouped by day inside a single list. Briefing only for calls in the next 48 hours. */
    var t = C.today(), all = [], byDay = {};
    C.mine().forEach(function (a) { a.events.forEach(function (e) { if (!e.done && e.date >= t && C.days(t, e.date) <= 30 && calMatch(e)) all.push({ a: a, e: e }); }); });
    all.sort(function (x, y) { return (x.e.date + (x.e.time || "")) < (y.e.date + (y.e.time || "")) ? -1 : 1; });
    all.forEach(function (x) { (byDay[x.e.date] = byDay[x.e.date] || []).push(x); });
    var days = Object.keys(byDay).sort();
    var h = '<div class="page-head"><div><h1 class="ltitle">Calendar</h1><p class="subtitle">Next 30 days across your caseload · ' + all.length + " event" + (all.length === 1 ? "" : "s") + "</p></div>" +
      '<div class="actions"><div class="seg" role="group" aria-label="Show">' + CALF.map(function (f) { return '<button type="button" aria-pressed="' + (V.calF === f[0]) + '" onclick="RXV.calFilter(\'' + f[0] + '\')">' + f[1] + "</button>"; }).join("") + '</div><button type="button" class="btn pri" onclick="RXV.addEvent()">' + I.plus + "New event</button></div></div>";
    if (!days.length) return { title: "Calendar", html: h + group("", "Nothing scheduled in the next 30 days for this filter.") };
    h += '<div class="group agenda">' + days.map(function (d) {
      var evs = byDay[d], dd = C.days(t, d);
      return '<div class="sub dayh" id="d-' + d + '"><span>' + (dd === 0 ? "Today · " : dd === 1 ? "Tomorrow · " : "") + esc(new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })) + '</span><span class="muted">' + evs.length + "</span></div>" + evs.map(function (x) {
        var e = x.e, soon = e.type === "case-manager" && C.days(t, e.date) <= 1;
        return '<div class="row cal-row"><span class="time' + (EDOT[e.type] === "warn" ? " warntext" : "") + '">' + esc(C.ft(e.time) || "All day") + '</span><span class="dot ' + (EDOT[e.type] || "") + '" aria-hidden="true"></span><a class="body" href="#/case/' + x.a.id + '"><div class="ttl">' + esc(x.a.name) + ' <span class="when">' + esc(e.title) + '</span></div>' + (function () { var bits = [C.EVT[e.type] && C.EVT[e.type] !== e.title ? C.EVT[e.type] : "", e.loc || ""].filter(Boolean); return bits.length ? '<div class="sec">' + esc(bits.join(" · ")) + "</div>" : ""; })() + "</a>" +
          (soon ? '<a class="btn sm" href="#/briefing/' + x.a.id + '">Briefing</a>' : "") + "</div>";
      }).join("");
    }).join("") + "</div>";
    return { title: "Calendar", html: h };
  }
  V.calFilter = function (f) { V.calF = f; render(); };

  /* ---------- case manager: Case ---------- */
  function renderCase(a) {
    /* Case page: header + tabs. Overview answers "what's the plan for this person?" first (the AI resource plan),
       then what needs attention; the full record sits in the other tabs. Every panel is rendered (inactive ones hidden),
       so ids such as #res-<id> and #ag-<id> always exist. */
    var s = a.sup, checks = C.recordChecks(a), first = a.name.split(" ")[0], back = V.from.indexOf("alumni") >= 0 ? "Alumni" : V.from.indexOf("calendar") >= 0 ? "Calendar" : V.from.indexOf("resources") >= 0 ? "Resources" : "Today";
    var tab = (V.caseTab[a.id] = V.caseTab[a.id] || "overview");
    var cu = a.tasks.filter(function (t) { return !t.std; }), su = a.tasks.filter(function (t) { return t.std; }), done = su.filter(function (t) { return t.status === "done"; }).length;
    var open = C.openTasks(a), ev = C.nextEvents(a, 6);
    var notes = a.notes.slice().sort(function (x, y) { return x.date < y.date || (x.date === y.date && (x.ts || 0) < (y.ts || 0)) ? 1 : -1; });
    var h = '<div class="page-head case-head"><div><h1 class="ltitle">' + esc(a.name) + '</h1><p class="subtitle">' + stageTag(a) + "&nbsp; Day " + a.dayN + " since release · " + esc(a.loc) + " · " + esc(a.facility) + "</p></div>" +
      '<div class="actions"><button type="button" class="btn" onclick="RXV.notes(\'' + a.id + '\')">Add call notes</button><button type="button" class="btn" onclick="RXV.handoff(\'' + a.id + '\')">Hand off</button><a class="btn pri" href="#/briefing/' + a.id + '">Pre-call briefing</a></div></div>';
    var TABS = [["overview", "Overview"], ["resources", "Resources"], ["tasks", "Tasks", open.length], ["activity", "Activity", a.notes.length], ["profile", "Profile"]];
    h += '<div class="tabbar" role="tablist" aria-label="Case sections">' + TABS.map(function (t) {
      var on = t[0] === tab;
      return '<button type="button" role="tab" id="t-' + t[0] + '" data-k="' + t[0] + '" aria-controls="p-' + t[0] + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" onclick="RXV.tab(\'' + a.id + "','" + t[0] + '\')" onkeydown="RXV.tabKey(event,\'' + a.id + '\')">' + t[1] + (t[2] ? '<span class="tc">' + t[2] + "</span>" : "") + "</button>";
    }).join("") + "</div>";
    function panel(k, html) { return '<section class="tabp" role="tabpanel" id="p-' + k + '" aria-labelledby="t-' + k + '"' + (k === tab ? "" : " hidden") + ">" + html + "</section>"; }

    /* ---- Overview ---- */
    var nx = ev[0], since = C.sinceContact(a);
    var ov = '<div class="stats">' +
      stat("Housing", esc(C.HOUSING[a.housing.status]), a.housing.status === "unhoused" || a.housing.status === "shelter" ? "warn" : "") +
      stat("Supervision", esc(String(s.type || "None").replace(/^./, function (c) { return c.toUpperCase(); })) + onlyIf(s.conditions && /curfew/i.test(s.conditions), " · curfew " + esc((s.conditions.match(/curfew\s+([^;,.]+)/i) || [])[1] || "")), "") +
      stat("Next on calendar", nx ? esc(C.fmShort(nx.date)) + onlyIf(nx.time, ", " + esc(C.ft(nx.time))) : "Nothing scheduled", "", nx ? esc(nx.title) : "") +
      stat("Last contact", since == null ? "None on record" : esc(C.ago(since)), since != null && since > 13 ? "warn" : "") + "</div>";
    ov += '<div id="agov-' + a.id + '">' + planCard(a) + "</div>";
    var warn = checks.filter(function (c) { return c.sev === "warn"; }).concat(checks.filter(function (c) { return c.sev !== "warn"; }));
    if (warn.length) ov += gh(checks.some(function (c) { return c.sev === "warn"; }) ? "Needs attention" : "Record checks", "no AI") + group(warn.map(function (c) { return '<div class="row"><span class="dot ' + (c.sev === "warn" ? "warn" : "info") + '" aria-hidden="true"></span><div class="body">' + esc(c.text) + "</div></div>"; }).join(""));
    var top = cu.filter(function (t) { return t.status !== "done"; }).concat(su.filter(function (t) { return t.status !== "done"; })).slice(0, 4);
    ov += gh("Open tasks", '<button type="button" class="linkbtn" onclick="RXV.tab(\'' + a.id + '\',\'tasks\')">All tasks</button>') + group(top.map(function (t) { return taskRow(a, t); }).join(""), "No open tasks.");
    if (notes[0]) ov += gh("Latest note", '<button type="button" class="linkbtn" onclick="RXV.tab(\'' + a.id + '\',\'activity\')">All activity</button>') + group(noteRow(notes[0]));

    /* ---- the other tabs: the full record ---- */
    var rs = '<p class="tabnote">' + esc(first) + " sees the general resources and anything you share.</p>" + '<div id="res-' + a.id + '">' + resourcesHtml(a, "cm") + "</div>";
    var tk = '<div class="group">' + (cu.length ? '<div class="sub">Assigned</div>' + cu.map(function (t) { return taskRow(a, t); }).join("") : "") +
      '<div class="sub">First 30 Days, ' + done + " of " + su.length + " done</div>" + su.map(function (t) { return taskRow(a, t); }).join("") +
      '<button type="button" class="row add" onclick="RXV.assign(\'' + a.id + '\')">' + I.plus + "Assign task</button></div>";
    var ac = gh("Coming up") + '<div class="group">' + (ev.length ? ev.map(function (e) { return '<div class="row"><span class="dot ' + (EDOT[e.type] || "") + '" aria-hidden="true"></span><div class="body"><div class="ttl">' + esc(e.title) + '</div><div class="sec">' + esc(C.fmShort(e.date)) + onlyIf(e.time, ", " + esc(C.ft(e.time))) + " · " + esc(C.EVT[e.type] || e.type) + onlyIf(e.loc, " · " + esc(e.loc)) + "</div></div></div>"; }).join("") : '<div class="row empty">Nothing scheduled.</div>') +
      '<button type="button" class="row add" onclick="RXV.addEvent(\'' + a.id + '\')">' + I.plus + "Add event</button></div>" +
      gh("Notes", a.notes.length + " on file") + '<div class="group"><button type="button" class="row add" onclick="RXV.notes(\'' + a.id + '\')">' + I.plus + "Add call notes</button>" + (notes.length ? notes.map(noteRow).join("") : '<div class="row empty">No call notes yet.</div>') + "</div>";
    /* Profile: a fact list with icons, two columns on wide screens; no box */
    function fact(icon, label, value, detail) { return '<div class="fact"><span class="fi" aria-hidden="true">' + icon + '</span><div><div class="fl">' + esc(label) + '</div><div class="fv">' + value + "</div>" + onlyIf(detail, '<div class="fd">' + detail + "</div>") + "</div></div>"; }
    function list(xs, none) { return xs.length ? '<ul class="fu">' + xs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<span class="muted">' + none + "</span>"; }
    var pr = '<div class="facts">' +
      fact(I.home, "Housing", esc(C.HOUSING[a.housing.status]), esc(a.housing.detail || "")) +
      fact(I.shield, "Supervision", esc(String(s.type || "None").replace(/^./, function (c) { return c.toUpperCase(); })) + onlyIf(s.officer, " · " + esc(s.officer)),
        [s.cadence ? "Check-ins " + esc(s.cadence.toLowerCase()) : "", s.nextCheckin ? "next " + esc(C.fmShort(s.nextCheckin)) : "", "ends " + (s.endDate ? esc(C.fmShort(s.endDate)) : '<span class="warntext">not on file</span>')].filter(Boolean).join(" · ") + onlyIf(s.conditions, "<br>" + esc(s.conditions))) +
      fact(I.today, "Employment", esc(a.emp.status), esc(a.emp.detail || "")) +
      fact(I.phone, "Contact", a.phone ? '<a href="tel:' + esc(a.phone.replace(/[^\d+]/g, "")) + '">' + esc(a.phone) + "</a>" : '<span class="warntext">No phone on file</span>', a.email ? '<a href="mailto:' + esc(a.email) + '">' + esc(a.email) + "</a>" : "") +
      fact(I.target, "Goals", list(a.goals, "No goals recorded"), "") +
      fact(I.flag, "Barriers", list(a.barriers, "No barriers recorded"), "") +
      fact(I.calendar, "Release", "Released " + esc(C.fmShort(a.releaseDate)) + " · day " + a.dayN, esc(a.facility || "")) +
      "</div>";
    h += panel("overview", ov) + panel("resources", rs) + panel("tasks", tk) + panel("activity", ac) + panel("profile", pr);
    return { title: a.name, back: [back, V.from || "#/today"], html: h, after: function () { loadRes(a); if (SAVED_MODE) loadDemoPlan(a); } };
  }
  function stat(label, value, tone, sub) { return '<div class="stat"><div class="sl">' + esc(label) + '</div><div class="sv' + (tone ? " " + tone + "text" : "") + '">' + value + "</div>" + onlyIf(sub, '<div class="ss">' + sub + "</div>") + "</div>"; }
  function noteRow(n) { return '<div class="row"><div class="body"><div class="sec">' + esc(C.fmShort(n.date)) + " · " + esc(n.kind) + " · " + esc(C.who(n.by)) + (n.twoWay ? "" : " · not reached") + '</div><div>' + esc(n.text) + "</div></div></div>"; }
  V.caseTab = {}; V.ctxOpen = {};
  V.tab = function (aid, k) {
    V.caseTab[aid] = k;
    document.querySelectorAll('.tabbar [role="tab"]').forEach(function (b) { var on = b.getAttribute("data-k") === k; b.setAttribute("aria-selected", String(on)); b.setAttribute("tabindex", on ? "0" : "-1"); });
    document.querySelectorAll(".tabp").forEach(function (p) { p.hidden = p.id !== "p-" + k; });
  };
  /* tablist keys (APG): Left/Right move and select, Home/End jump */
  V.tabKey = function (e, aid) {
    var tabs = [].slice.call(document.querySelectorAll('.tabbar [role="tab"]')), i = tabs.indexOf(e.target), n = tabs.length, j = null;
    if (e.key === "ArrowRight") j = (i + 1) % n; else if (e.key === "ArrowLeft") j = (i - 1 + n) % n; else if (e.key === "Home") j = 0; else if (e.key === "End") j = n - 1;
    if (j == null) return; e.preventDefault(); V.tab(aid, tabs[j].getAttribute("data-k")); tabs[j].focus();
  };
  function taskRow(a, t) {
    var d = t.status === "done", od = !t.std && !d && t.due && t.due < C.today();
    var sec = [t.std ? t.phase : "", t.due ? (od ? '<span class="warntext">Overdue, due ' + esc(C.fmShort(t.due)) + "</span>" : "Due " + esc(C.fmShort(t.due))) : "", t.assignedBy && !t.std ? "from " + esc(C.who(t.assignedBy)) : "", d && t.doneBy ? "done by " + esc(t.doneBy !== "alumnus" ? C.who(t.doneBy) : C.actor() === "alumnus" ? "you" : a.name.split(" ")[0]) : "", t.status === "in_progress" ? "In progress" : "", (function () { var m = t.std && !d && /(\d+)\D+(\d+)/.exec(t.phase || ""); return m && a.dayN > +m[2] ? '<span class="chktext">Past day ' + m[2] + "</span>" : ""; })()].filter(Boolean).join(" · ");
    return '<div class="row' + (d ? " done" : "") + '"><button type="button" class="check" role="checkbox" aria-checked="' + d + '" aria-label="' + esc((d ? "Reopen " : "Mark done: ") + t.title) + '" onclick="RXV.toggle(\'' + a.id + "','" + t.id + '\')">' + I.tick + '</button><div class="body"><div class="ttl">' + esc(t.title) + "</div>" + onlyIf(t.detail, '<div class="sec">' + esc(t.detail) + "</div>") + onlyIf(sec, '<div class="sec">' + sec + "</div>") + "</div></div>";
  }
  V.toggle = function (aid, tid) { var a = C.byId(aid), t = a.tasks.find(function (x) { return x.id === tid; }), was = t.status === "done"; act(a, was ? "Task reopened" : "Task done", function () { C.toggleTask(a, t); }); };

  /* ---------- assign task / add event / hand off (id null = choose the alumnus in the sheet) ---------- */
  V.assign = function (id, aid) {
    var pick = !id; id = id || aid || V.lastCase || (C.mine()[0] || {}).id;
    var a = C.byId(id), open = a.tasks.filter(function (t) { return t.std && t.status !== "done"; });
    sheet({ title: "Assign task", right: '<button type="button" class="btn sm pri" onclick="RXV.assignGo()">Assign</button>',
      body: '<p class="sdesc">' + esc(a.name.split(" ")[0]) + " sees it under Tasks, and either of you can mark it done.</p>" + '<div class="group">' + (pick ? picker("pk", id, "RXV.assign(null,this.value)") : '<input type="hidden" id="pk" value="' + id + '">') +
        '<div class="field"><label for="tk">Task</label><select id="tk" onchange="document.getElementById(\'tkCustom\').hidden=this.value!==\'custom\'"><option value="custom">New task</option>' + open.map(function (t) { return '<option value="' + t.id + '">' + esc(t.title) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field" id="tkCustom"><label for="tt">Title</label><input id="tt" autofocus maxlength="120" placeholder="Bring pay stubs to the housing appointment"></div>' +
        '<div class="field"><label for="td">Details (optional)</label><input id="td" maxlength="200"></div>' +
        '<div class="field"><label for="tdue">Due</label><input type="date" id="tdue" value="' + C.iso(7) + '"></div></div>' });
  };
  V.assignGo = function () {
    var a = C.byId($("pk").value), v = $("tk").value, due = $("tdue").value || null, det = $("td").value.trim(), title = $("tt").value.trim();
    if (v === "custom" && !title) { $("tt").focus(); say("Add a title for the task"); return; }
    V.close();
    act(a, "Task assigned to " + a.name.split(" ")[0], function () {
      if (v === "custom") C.addTask(a, { title: title, due: due, detail: det });
      else { var t = a.tasks.find(function (x) { return x.id === v; }); t.due = due; if (det) t.detail = det; t.assignedBy = C.actor(); }
    });
  };
  V.addEvent = function (id, date) {
    var pick = !id; id = id || V.lastCase || (C.mine()[0] || {}).id;
    sheet({ title: "Add event", right: '<button type="button" class="btn sm pri" onclick="RXV.eventGo()">Add</button>',
      body: '<div class="group">' + (pick ? picker("pk", id) : '<input type="hidden" id="pk" value="' + id + '">') + '<div class="field"><label for="et">Title</label><input id="et" autofocus maxlength="120"></div>' +
        '<div class="field"><label for="ey">Type</label><select id="ey">' + C.EVT_TYPES.map(function (k) { return '<option value="' + k + '">' + esc(C.EVT[k]) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label for="ed">Date</label><input type="date" id="ed" value="' + (date || C.iso(3)) + '"></div><div class="field"><label for="etm">Time</label><input type="time" id="etm" value="10:00"></div>' +
        '<div class="field"><label for="el">Location</label><input id="el" maxlength="120"></div></div>' });
  };
  V.eventGo = function () {
    var a = C.byId($("pk").value), t = $("et").value.trim(), d = $("ed").value; if (!t || !d) { say("Add a title and a date"); return; }
    var e = { title: t, date: d, time: $("etm").value, type: $("ey").value, loc: $("el").value.trim() };
    V.close(); act(a, "Event added for " + a.name.split(" ")[0], function () { C.addEventTo(a, e); });
  };
  V.handoff = function (id) {
    var a = C.byId(id);
    sheet({ title: "Hand off " + a.name.split(" ")[0], right: '<button type="button" class="btn sm pri" onclick="RXV.handoffGo(\'' + id + '\')">Hand off</button>',
      body: '<p class="sdesc">The case moves to your colleague. Your note goes on the record so they can pick up without starting from zero.</p><div class="group">' +
        '<div class="field"><label for="ht">Hand off to</label><select id="ht">' + R.CMS.filter(function (c) { return c.id !== a.cm; }).map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + ", " + esc(c.title) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label for="hn">Handoff note</label><textarea id="hn" autofocus placeholder="Open items, what to be careful about, how ' + esc(a.name.split(" ")[0]) + ' likes to be contacted."></textarea></div></div>' });
  };
  V.handoffGo = function (id) {
    var a = C.byId(id), to = $("ht").value, note = $("hn").value.trim(); if (!note) { $("hn").focus(); say("Add a handoff note first"); return; }
    V.close(); go("#/today");
    act(a, a.name + " handed off to " + C.who(to), function () { C.handoff(a, to, note); });
  };

  /* ---------- pre-call briefing: its own page (#/briefing/<id>) ---------- */
  V.brief = function (id) { go("#/briefing/" + id); };
  V.regen = function (id) { delete V.brief[id]; V.ck[id] = {}; render(); };
  V.ck = {};
  function callBtn(a, label, cls) {
    return a.phone ? '<a class="btn' + (cls || "") + '" href="tel:' + esc(a.phone.replace(/[^\d+]/g, "")) + '" onclick="RXV.startCall(\'' + a.id + '\')">' + I.phone + esc(label) + "</a>"
      : '<button type="button" class="btn' + (cls || "") + '" disabled title="No phone on file">' + I.phone + "No phone on file</button>";
  }
  /* dial out and open call notes so they can be taken during the call */
  V.startCall = function (id) { setTimeout(function () { V.notes(id); }, 0); };
  V.print = function () { window.print(); };
  function renderBriefing(a) {
    /* A one-page document: a plain header, the snapshot as a lede, then the work (resolve, talk about) in the main column,
       with the facts that don't need AI (at a glance, record checks, what the draft drew on) in a right rail. */
    var first = a.name.split(" ")[0], checks = C.recordChecks(a), s = a.sup, t = C.today();
    var call = a.events.filter(function (e) { return e.type === "case-manager" && !e.done && e.date >= t; }).sort(function (x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; })[0];
    var since = C.sinceContact(a), port = a.portal ? a.portal.length : 0;
    function glance(k, v, tone) { return '<div class="gl"><dt>' + esc(k) + '</dt><dd' + (tone ? ' class="' + tone + 'text"' : "") + ">" + v + "</dd></div>"; }
    var side = '<aside class="brief-side" aria-label="At a glance">' +
      '<div class="bs-h">At a glance</div><dl class="glance">' +
      glance("Housing", esc(C.HOUSING[a.housing.status]), a.housing.status === "unhoused" ? "warn" : a.housing.status === "shelter" ? "chk" : "") +
      glance("Supervision", esc(String(s.type || "None").replace(/^./, function (c) { return c.toUpperCase(); })) + onlyIf(s.conditions && /curfew/i.test(s.conditions), ", curfew " + esc((s.conditions.match(/curfew\s+([^;,.]+)/i) || [])[1] || ""))) +
      glance("Employment", esc(a.emp.status)) +
      glance("Last contact", esc(since == null ? "None on record" : C.ago(since)), since == null || since >= 14 ? "warn" : "") +
      glance("Phone", a.phone ? '<a href="tel:' + esc(a.phone.replace(/[^\d+]/g, "")) + '">' + esc(a.phone) + "</a>" : "Not on file", a.phone ? "" : "warn") + "</dl>" +
      '<div class="bs-h">Record checks <span class="muted">no AI</span></div>' + (checks.length ? '<ul class="bs-checks">' + checks.map(function (c) { return '<li><span class="dot ' + (c.sev === "warn" ? "warn" : "info") + '" aria-hidden="true"></span>' + esc(c.text) + "</li>"; }).join("") + "</ul>" : '<p class="muted">No record flags.</p>') +
      '<div class="bs-h">Drawn from</div><p class="bs-src">' + a.notes.length + " notes · " + a.tasks.length + " tasks · " + a.events.length + " events" + (port ? " · " + port + " app actions" : "") + "</p></aside>";
    var h = '<header class="bh"><p class="bh-k">Pre-call briefing' + (call ? " · " + esc(C.EVT[call.type] || "Call") + " " + esc(C.fmShort(call.date)) + onlyIf(call.time, ", " + esc(C.ft(call.time))) : "") + "</p>" +
      '<h1 class="ltitle">' + esc(a.name) + '</h1><p class="bh-m">' + stageTag(a) + "&nbsp; Day " + a.dayN + " since release · " + esc(a.loc) + "</p></header>" +
      '<div class="brief-grid"><div class="brief-main">' +
      '<section class="snap" aria-label="Snapshot"><p class="brief-snap" id="bSnap"><span class="sk" style="width:92%;height:22px"></span><span class="sk" style="width:64%;height:22px"></span></p><div class="tx" id="bSnapSrc"></div></section>' +
      '<p class="bstatus" id="bStatus" role="status">Drafting from the record. This can take up to a minute.</p>' +
      '<div id="bBody">' + skel(6) + "</div>" +
      '<div class="brief-foot"><span class="muted" id="bGen">Sample data</span><div class="brief-acts"><button type="button" class="btn" onclick="RXV.regen(\'' + a.id + '\')">Regenerate</button><button type="button" class="btn" onclick="RXV.corrections(\'' + a.id + '\')">Flag corrections</button>' + callBtn(a, "Start call with " + first, " pri") + "</div></div>" +
      "</div>" + side + "</div>";
    return { title: "Briefing: " + a.name, back: ["Back to " + a.name + "'s case", "#/case/" + a.id], html: h, wide: true,
      barRight: '<button type="button" class="btn sm" onclick="RXV.print()">' + I.print + "Print sheet</button>",
      after: function () { if (V.brief[a.id]) drawBrief(a); else genBrief(a); } };
  }

  function genBrief(a) {
    var src = C.sources(a), tok = V.briefTok = (V.briefTok || 0) + 1;
    function show(b, label, ai) { if (tok !== V.briefTok) return; V.brief[a.id] = { b: b, src: src, label: label, ai: ai, at: new Date() }; V.stats.briefings++; if ($("bBody")) drawBrief(a); }
    C.sample().then(function (s) {
      if (!s) { show(C.digest(a, src), "Auto-digest from the record (no AI): Claude isn't available here.", false); return; }
      return s.json(C.briefPrompt(a, src), { model: "claude-haiku-5-5", modelTier: "quick", effort: "low" }).then(function (raw) { show(C.validateBrief(raw, src), "Drafted by Claude from the record.", true); });
    }).catch(function (e) { show(C.digest(a, src), "Auto-digest from the record (no AI): " + C.whyFailed(e) + ".", false); });
  }
  function badge(it) { return it.flag ? '<span class="badge ' + it.flag + '" title="' + esc(it.why) + '">' + (it.flag === "nosource" ? "No source" : "Check") + "</span>" : ""; }
  function flagBtn(k) { var on = !!V.flags[k]; return '<button type="button" class="flagbtn" data-flag="' + k + '" aria-pressed="' + on + '" aria-label="Flag this line as wrong" title="Flag this line as wrong" onclick="RXV.flag(\'' + k + '\')">' + I.flag + '<span class="fl">Flagged</span></button>'; }
  /* every briefing line with a stable key, in page order (used by the page and the corrections sheet) */
  function briefLines(a) {
    var b = V.brief[a.id].b, out = [], n = 0;
    C.SECTIONS.forEach(function (sec) { (b[sec[0]] || []).forEach(function (it) { out.push({ sec: sec[0], label: sec[1], it: it, k: a.id + ":" + (n++) }); }); });
    return out;
  }
  function drawBrief(a) {
    var d = V.brief[a.id], b = d.b, lines = briefLines(a), snap = lines.find(function (l) { return l.sec === "snapshot"; }), ck = V.ck[a.id] = V.ck[a.id] || {};
    $("bSnap").innerHTML = snap ? esc(snap.it.text) + badge(snap.it) : esc(a.name) + ", day " + a.dayN + ".";
    $("bSnapSrc").innerHTML = snap ? '<div class="snap-src"><span class="muted">Sources</span> ' + cites(a, snap.it) + '</div><div class="srcwrap"></div>' : "";
    $("bStatus").className = "bstatus" + (b._bad ? " warn" : d.ai ? " ok" : "");
    $("bStatus").innerHTML = "<b>" + esc(d.label) + "</b> Not saved to the record. " + (b._bad ? '<span class="warntext">' + b._bad + " line" + (b._bad === 1 ? " needs" : "s need") + " a check against its source.</span>" : "Every line cites a source; check them before you rely on them.");
    $("bGen").textContent = "Briefing generated at " + d.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + " · sample data";
    /* Read in the order a case manager needs it: what to resolve before dialling, what to talk about, then context (collapsed). */
    var h = "", L = C.lastTwoWay(a), checks = C.recordChecks(a), SUB = { since_last_contact: L ? esc(C.fmShort(L.date)) + " · " + C.ago(C.days(L.date, C.today())) : "no contact on record" };
    function of(k) { return lines.filter(function (l) { return l.sec === k; }); }
    function line(l, lead) { return '<div class="bl">' + (lead || "") + '<div class="tx"><div>' + esc(l.it.text) + badge(l.it) + " " + cites(a, l.it) + '</div><div class="srcwrap"></div></div>' + flagBtn(l.k) + "</div>"; }
    var res = of("check_before_call");
    if (res.length) {
      var done = res.filter(function (l, i) { return ck[i]; }).length;
      h += gh("Resolve before the call", '<span id="ckCount">' + done + " of " + res.length + " ready</span>") + '<div class="group brief-resolve">' + res.map(function (l, i) {
        return line(l, '<button type="button" class="check sq" role="checkbox" aria-checked="' + !!ck[i] + '" aria-label="Ready: ' + esc(l.it.text) + '" onclick="RXV.ckToggle(this,\'' + a.id + "'," + i + "," + res.length + ')">' + I.tick + "</button>");
      }).join("") + "</div>";
    }
    var tp = of("suggested_topics");
    if (tp.length) h += gh("Talk about", "in priority order") + '<div class="group">' + tp.map(function (l, i) { return line(l, '<span class="num" aria-hidden="true">' + (i + 1) + "</span>"); }).join("") + "</div>";
    var ctxN = 0, ctx = "";
    [["since_last_contact", "Since last contact"], ["open_needs", "Open needs"], ["coming_up", "Coming up"]].forEach(function (sec) {
      var items = of(sec[0]); if (!items.length) return; ctxN += items.length;
      ctx += '<div class="sub">' + esc(sec[1]) + onlyIf(SUB[sec[0]], ' <span class="muted">· ' + SUB[sec[0]] + "</span>") + "</div>" + items.map(function (l) { return line(l); }).join("");
    });
    h += '<details class="ctx group"' + (V.ctxOpen[a.id] ? " open" : "") + ' ontoggle="RXV.ctxOpen[\'' + a.id + '\']=this.open"><summary><span class="ttl">Context</span><span class="muted">Since last contact, open needs, coming up · ' + ctxN + " lines</span>" + I.chev + "</summary>" + ctx + "</details>";
    if (!lines.length) h += group("", "Not enough on file to brief.");
    V.stats.lines += lines.length;
    h += '<p class="gf">References point to record entries: N notes, T tasks, E events, R resources, P portal activity. Select one to see its text. Numbers not found in a cited source are marked Check. <span id="bFlags"></span></p>';
    $("bBody").innerHTML = h; flagCount(a.id);
  }
  V.ckToggle = function (btn, aid, i, n) { var ck = V.ck[aid] = V.ck[aid] || {}; ck[i] = !ck[i]; btn.setAttribute("aria-checked", String(ck[i])); var c = $("ckCount"), done = 0; for (var j = 0; j < n; j++) if (ck[j]) done++; if (c) c.textContent = done + " of " + n + " ready"; };
  function cites(a, it) { return '<span class="refs">' + (it.cites.length ? it.cites.map(function (c) { return '<button type="button" class="cite" aria-expanded="false" aria-label="Source ' + esc(c === "FACTS" ? "computed from the record" : c) + '" onclick="RXV.src(this,\'' + a.id + "','" + c + '\')">' + esc(c === "FACTS" ? "calc" : c) + "</button>"; }).join("") : '<span class="muted">no source</span>') + "</span>"; }
  V.src = function (btn, aid, id) {
    var tx = btn.closest(".tx"), wrap = tx.querySelector(".srcwrap"), open = btn.getAttribute("aria-expanded") === "true";
    tx.querySelectorAll(".cite").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    if (open) { wrap.innerHTML = ""; return; }
    var s = (V.brief[aid] ? V.brief[aid].src : C.sources(C.byId(aid))).find(function (x) { return x.id === id; });
    wrap.innerHTML = s ? '<div class="srcbox"><b>' + esc(id === "FACTS" ? "Computed from the record" : s.id + ", " + s.label) + "</b>" + esc(s.text) + "</div>" : "";
    btn.setAttribute("aria-expanded", "true");
  };
  V.flag = function (k) {
    V.flags[k] = !V.flags[k];
    document.querySelectorAll('[data-flag="' + k + '"]').forEach(function (b) { b.setAttribute("aria-pressed", String(V.flags[k])); });
    flagCount(k.split(":")[0]);
  };
  function flagCount(id) {
    var f = Object.keys(V.flags).filter(function (k) { return k.indexOf(id + ":") === 0 && V.flags[k]; }).length; V.stats.flagged = Object.keys(V.flags).filter(function (k) { return V.flags[k]; }).length;
    document.querySelectorAll("#bFlags, #cfCount").forEach(function (el) { el.textContent = f ? f + " line" + (f === 1 ? "" : "s") + " flagged as wrong." : el.id === "cfCount" ? "No lines flagged yet." : ""; });
  }
  /* review every line in one list and flag the wrong ones (feeds the errors-per-briefing measure) */
  V.corrections = function (id) {
    var a = C.byId(id); if (!V.brief[id]) { say("Wait for the briefing to finish"); return; }
    var lines = briefLines(a), last = "";
    sheet({ title: "Flag corrections", leftLabel: "Done", wide: true,
      body: '<p class="sdesc">Mark every line that is wrong or unsupported. The count feeds the measure "errors per briefing". <span id="cfCount"></span></p>' +
        lines.map(function (l) { var hd = l.label !== last ? (last ? "</div>" : "") + gh(l.label) + '<div class="group">' : ""; last = l.label; return hd + '<div class="bl"><div class="tx">' + esc(l.it.text) + badge(l.it) + "</div>" + flagBtn(l.k) + "</div>"; }).join("") + (lines.length ? "</div>" : "") });
    flagCount(id);
  };

  /* ---------- call notes -> draft changes -> approve (drafts autosave per alumnus) ---------- */
  function draftKey(id) { return "tlm-draft-" + id; }
  /* kept in memory, and in sessionStorage when the browser allows it (survives a reload) */
  V.drafts = {};
  function getDraft(id) { if (V.drafts[id] != null) return V.drafts[id]; try { return sessionStorage.getItem(draftKey(id)) || ""; } catch (e) { return ""; } }
  function setDraft(id, v) { V.drafts[id] = v || ""; try { if (v) sessionStorage.setItem(draftKey(id), v); else sessionStorage.removeItem(draftKey(id)); } catch (e) {} }
  V.saveDraft = function (id, v) { setDraft(id, v.trim() ? v : ""); var s = $("draftState"); if (s) s.textContent = v.trim() ? "Draft saved" : ""; };
  V.notes = function (id, aid) {
    var pick = !id; id = id || aid || V.lastCase || (C.mine()[0] || {}).id;
    var a = C.byId(id), first = a.name.split(" ")[0], d = getDraft(id); V.diff = null;
    sheet({ title: "Call notes", wide: true,
      body: '<p class="sdesc">Paste your notes. Claude drafts record changes for you to review; nothing is saved until you approve.</p><div class="group">' + (pick ? picker("pk", id, "RXV.notes(null,this.value)") : "") +
        '<div class="field"><span class="lbl">Contact</span><div class="seg" role="group" aria-label="Contact type" id="nk">' + ["call", "visit", "text"].map(function (k, i) { return '<button type="button" data-v="' + k + '" aria-pressed="' + (i === 0) + '" onclick="RXV.seg(this)">' + k[0].toUpperCase() + k.slice(1) + "</button>"; }).join("") + "</div></div>" +
        '<div class="field"><label><input type="checkbox" id="n2" checked>Spoke with ' + esc(first) + "</label></div>" +
        '<div class="field"><label for="nt">Notes <span class="muted" id="draftState">' + (d ? "Draft restored" : "") + '</span></label><textarea id="nt" autofocus placeholder="Talked with ' + esc(first) + ' about…" oninput="RXV.saveDraft(\'' + id + '\',this.value)">' + esc(d) + "</textarea></div></div><div id=\"nd\"></div>",
      foot: '<button type="button" class="btn" onclick="RXV.saveRaw(\'' + id + '\')">Save note only</button><button type="button" class="btn pri" id="draftBtn" onclick="RXV.draft(\'' + id + '\')">Draft changes</button>' });
  };
  V.seg = function (b) { b.parentNode.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); };
  function noteOpts() { var k = document.querySelector("#nk [aria-pressed=true]"); return { kind: k ? k.getAttribute("data-v") : "call", twoWay: $("n2") ? $("n2").checked : true }; }
  V.saveRaw = function (id) { var a = C.byId(id), t = $("nt").value.trim(); if (!t) { $("nt").focus(); say("Paste the call notes first"); return; } var o = noteOpts(); setDraft(id, ""); V.close(); act(a, "Note saved", function () { C.addNote(a, t, o); }); };
  V.draft = function (id) {
    var a = C.byId(id), text = $("nt").value.trim(), box = $("nd"); if (!text) { $("nt").focus(); say("Paste the call notes first"); return; }
    V.noteOpts = noteOpts();
    box.innerHTML = '<div class="note" role="status" style="margin-top:16px">Drafting record changes from your notes…</div>' + skel(4);
    function noAi(msg) { box.innerHTML = '<div class="note err" style="margin-top:16px">' + esc(msg) + ". Your notes are still here: save them as a note, or try again.</div>"; }
    C.sample().then(function (s) {
      if (!s) { noAi("Claude isn't available here"); return; }
      return s.json(C.diffPrompt(a, text), { modelTier: "default" }).then(function (raw) { V.diff = C.validateDiff(raw, a, text); V.diff.text = text; drawDiff(a); });
    }).catch(function (e) { noAi(C.whyFailed(e)); });
  };
  function drawDiff(a) {
    var d = V.diff, h = gh("Review changes", "AI draft, not saved") + (d.summary ? '<p class="muted" style="margin:0 4px 10px">' + esc(d.summary) + "</p>" : "");
    h += group(d.changes.map(function (x, i) {
      var isNew = x.kind === "barrier.add" || x.kind === "task.new" || x.kind === "event.new";
      return '<div class="row" style="align-items:flex-start"><button type="button" class="check" role="checkbox" aria-checked="' + x.checked + '" aria-label="Include: ' + esc(C.KIND[x.kind] + " " + x.after) + '" onclick="RXV.chk(this,' + i + ')">' + I.tick + '</button><div class="body"><div class="sec">' + esc(C.KIND[x.kind]) + '</div><div class="ttl">' + esc(x.after) + "</div>" +
        (isNew ? "" : '<div class="sec">Was: ' + esc(x.before) + "</div>") + '<div class="sec">From your notes: “' + esc(x.evidence || "no quote given") + "”</div>" + (x.evOk ? "" : '<div class="sec warntext">That quote isn\'t in your notes, so this change starts unchecked.</div>') + "</div></div>";
    }).join(""), "No record changes found in these notes. You can still save the note.");
    $("nd").innerHTML = h;
    $("sheetFoot").innerHTML = '<button type="button" class="btn" onclick="RXV.discard(\'' + a.id + '\')">Discard</button><button type="button" class="btn pri" id="approveBtn" onclick="RXV.approve(\'' + a.id + '\')"></button>';
    approveLabel();
    var top = $("nd"); if (top && top.scrollIntoView) top.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  V.discard = function (id) { setDraft(id, ""); V.diff = null; V.close(); say("Draft discarded"); };
  function approveLabel() { var n = V.diff.changes.filter(function (x) { return x.checked; }).length, b = $("approveBtn"); if (b) b.textContent = n ? "Approve " + n + " change" + (n === 1 ? "" : "s") + " and save note" : "Save note"; }
  V.chk = function (btn, i) { var x = V.diff.changes[i]; x.checked = !x.checked; btn.setAttribute("aria-checked", String(x.checked)); approveLabel(); };
  V.approve = function (id) {
    var a = C.byId(id), d = V.diff; if (!d) return;
    var n = d.changes.filter(function (x) { return x.checked; }).length, o = V.noteOpts || {}; V.diff = null; setDraft(id, ""); V.close();
    act(a, n ? n + " change" + (n === 1 ? "" : "s") + " saved with your note" : "Note saved", function () {
      d.changes.forEach(function (x) { if (x.checked) C.applyChange(a, x); });
      C.addNote(a, d.text, { kind: o.kind, twoWay: o.twoWay, approvedChanges: n });
    });
  };

  /* ---------- resources: search + expanding categories (same component for both views) ---------- */
  var CI = {
    housing: ic('<path d="M5 12H3l9-9l9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M10 12h4v4h-4z"/>'),
    food: ic('<path d="M3 11h18l-2 9H5z"/><path d="M8 11l4-7l4 7"/>'),
    id: ic('<path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M7 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M15 8h2M15 12h2M7 16h10"/>'),
    jobs: ic('<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13a20 20 0 0 0 18 0"/>'),
    health: ic('<path d="M19.5 12.57L12 20l-7.5-7.43A5 5 0 1 1 12 6.01a5 5 0 1 1 7.5 6.57"/><path d="M8 12h2l1.5-2l1.5 4l1.5-2h1.5"/>'),
    legal: ic('<path d="M7 20h10M6 6l6-1l6 1M12 3v17"/><path d="M9 12l-3-6l-3 6a3 3 0 0 0 6 0M21 12l-3-6l-3 6a3 3 0 0 0 6 0"/>'),
    money: ic('<path d="M3 21h18M3 10h18M5 6l7-3l7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>')
  };
  V.resQ = {}; V.openCats = {};
  function resourcesHtml(a, view) {
    var q = V.resQ[a.id] || "";
    return '<div class="rsearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M21 21l-6-6"/></svg>' +
      '<input type="search" id="rq-' + a.id + '" placeholder="Search resources" aria-label="Search resources" autocomplete="off" value="' + esc(q) + '" oninput="RXV.resSearch(\'' + a.id + '\',this.value)"></div>' +
      '<div id="rl-' + a.id + '">' + resList(a, view) + "</div>";
  }
  function resList(a, view) {
    var cm = view === "cm", st = C.resState(a), first = a.name.split(" ")[0], geo = st.data && st.data.geo, q = (V.resQ[a.id] || "").trim();
    var place = geo ? esc(geo.city) + ", " + esc(geo.state) + " " + esc(geo.zip) : a.zip ? "ZIP " + esc(a.zip) : "no ZIP on file";
    var h = '<div class="rplace"><span class="muted">Near ' + place + '</span><button type="button" class="linkbtn" onclick="RXV.zip(\'' + a.id + '\')">' + (cm ? "Change ZIP" : "I moved") + "</button></div>";
    if (!q) h += benefitsBlock(a, cm);
    if (st.err) return h + (cm ? agentBlock(a, q) : sharedBlock(a, q)) + '<div class="note err">' + esc(st.err) + "</div>";
    if (!a.zip) return h + '<p class="gf">Add a ZIP code to see what\'s nearby.</p>';
    var list = st.data ? C.rank(a, st.data.items || []) : [], ai = cm ? agentBlock(a, q) : sharedBlock(a, q), split = cm || !!a.aiShared;
    if (q) {
      var hits = C.searchRes(list, q), aiHas = ai && ai.indexOf("row cat") >= 0;
      if (!hits.length && !aiHas) return h + (cm ? agentBlock(a, "") : "") + group("", "Nothing matches “" + q + "” near " + (geo ? geo.zip : a.zip) + ". Try a category below.") + (split ? gh("General resources") : "") + catGroup(a, list, cm, first, !st.data, false);
      return h + ai + (hits.length ? (split ? gh("General resources") : "") + '<p class="gf rcount">' + hits.length + " result" + (hits.length === 1 ? "" : "s") + " for “" + esc(q) + "”</p>" + catGroup(a, hits, cm, first, false, true) : "");
    }
    var pins = list.filter(function (r) { return r.act.pinnedBy; });
    if (pins.length) h += gh(cm ? "Your recommendations" : "Recommended for you") + '<div class="group">' + pins.map(function (r) { return resRow(a, r, cm, first, true); }).join("") + "</div>";
    h += ai;
    h += split ? gh("General resources") : pins.length ? gh("All resources") : "";
    h += catGroup(a, list, cm, first, !st.data, false);
    if (st.data) {
      if ((st.data.errors || []).length) h += '<p class="gf">Some sources didn\'t answer (' + esc(st.data.errors.map(function (e) { return e.source; }).join(", ")) + "), so a few results may be missing.</p>";
      h += '<p class="gf">Public data from government and nonprofit sources, fetched ' + esc(new Date(st.data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) + ". Hours and rules change, so call ahead.</p>";
    }
    return h;
  }
  /* one group: a row per category; open ones show their resources right under the row */
  function catGroup(a, list, cm, first, loading, searching) {
    var open = V.openCats[okey(a.id)] || {}, h = '<div class="group">';
    C.CATS.forEach(function (c) {
      var items = list.filter(function (r) { return r.cat === c.id; });
      if (searching && !items.length) return;
      var isOpen = searching || !!open[c.id], n = items.length, can = !loading && n > 0;
      h += '<button type="button" class="row cat" id="gc-' + a.id + "-" + c.id + '" aria-expanded="' + (can && isOpen) + '"' + (can && !searching ? ' onclick="RXV.cat(\'' + a.id + "','" + c.id + '\')"' : can ? ' aria-disabled="true" tabindex="-1"' : " disabled") + '><span class="ctile c-' + c.id + '" aria-hidden="true">' + CI[c.id] + '</span><span class="body ttl">' + esc(c.label) + '</span><span class="trail">' + (loading ? '<span class="sk sk-n"></span>' : n ? n : "None nearby") + "</span>" + (can ? I.chev : "") + "</button>";
      if (can && isOpen) h += '<div class="catbody' + (V.justOpened === a.id + ":" + c.id ? " in" : "") + '">' + items.map(function (r) { return resRow(a, r, cm, first, false); }).join("") + "</div>";
    });
    V.justOpened = null;
    return h + "</div>";
  }
  /* resource row: title link, one-sentence summary, address, phone, then one quiet line of text actions */
  var EXT = '<svg class="ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>';
  function resRow(a, r, cm, first, inPins) {
    var x = r.act || {}, pinned = !!x.pinnedBy, rid = esc(r.id).replace(/'/g, "");
    function act(kind, on, offLabel, onLabel) { return '<button type="button" class="ta" aria-pressed="' + on + '" onclick="RXV.res(\'' + kind + "','" + a.id + "','" + rid + '\')">' + (on ? "✓ " + onLabel : offLabel) + "</button>"; }
    var acts = cm ? act("pin", pinned, "Recommend to " + esc(first), "Recommended") + onlyIf(pinned, '<span class="dotsep" aria-hidden="true">·</span><button type="button" class="ta muted-ta" onclick="RXV.res(\'pin\',\'' + a.id + "','" + rid + '\')">Remove pin</button>') + onlyIf(!pinned, '<span class="dotsep" aria-hidden="true">·</span><button type="button" class="ta" onclick="RXV.res(\'hide\',\'' + a.id + "','" + rid + '\')">Not relevant</button>')
      : act("save", !!x.saved, "Save", "Saved") + '<span class="dotsep" aria-hidden="true">·</span>' + act("used", !!x.used, "I used this", "Used");
    var status = cm ? (x.used ? esc(first) + " used this" + (x.usedAt ? " " + esc(C.fmShort(x.usedAt)) : "") : x.saved ? "Saved by " + esc(first) : "") : "";
    var h = '<article class="res' + (inPins ? " pinned" : "") + '">' + onlyIf(inPins, '<div class="rec">Recommended by ' + esc(C.who(x.pinnedBy)) + (x.note ? ": “" + esc(x.note) + "”" : "") + "</div>") +
      '<div class="nm">' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.name) + EXT + '<span class="sr"> (opens in a new tab)</span></a>' : esc(r.name)) + "</div>" +
      '<div class="sum">' + esc(C.summaryOf(r)) + "</div>" +
      onlyIf(r.address, '<div class="ln">' + esc(r.address) + "</div>") +
      onlyIf(r.phone, '<div class="ln"><a href="tel:' + esc(String(r.phone).replace(/[^\d+]/g, "")) + '">' + esc(r.phone) + "</a></div>") +
      onlyIf(status, '<div class="st">' + status + "</div>") +
      '<div class="tas">' + acts + "</div>";
    if (cm && pinned && inPins) h += '<form onsubmit="RXV.resNote(\'' + a.id + "','" + rid + '\',this.elements.n.value);return false"><input name="n" aria-label="Note for ' + esc(first) + '" maxlength="200" placeholder="Add a note for ' + esc(first) + '" value="' + esc(x.note || "") + '"><button type="submit" class="btn sm">Save note</button></form>';
    return h + "</article>";
  }
  function drawRes(a) { var el = $("rl-" + a.id); if (el) el.innerHTML = resList(a, cur && cur.kind === "cm" ? "cm" : "me"); }
  function loadRes(a) { C.loadResources(a, function () { drawRes(a); }); }
  V.resSearch = function (aid, q) { V.resQ[aid] = q; drawRes(C.byId(aid)); };
  function okey(aid) { return (cur ? cur.id : "") + ":" + aid; } /* open categories are remembered per signed-in person */
  V.cat = function (aid, cid) { var k = okey(aid), o = V.openCats[k] = V.openCats[k] || {}; o[cid] = !o[cid]; if (o[cid]) V.justOpened = aid + ":" + cid; drawRes(C.byId(aid)); };
  var RES_MSG = { pin: ["Recommended to {f}", "Recommendation removed"], hide: ["Hidden for {f}"], save: ["Saved", "Removed from saved"], used: ["Marked as used. Your case manager will see it.", "Unmarked"] };
  V.res = function (kind, aid, rid) {
    if (/^ai-/.test(rid)) ensureAgentItem(C.byId(aid), rid);
    var a = C.byId(aid), x = (a.resourceActions || {})[rid] || {}, on = kind === "pin" ? !x.pinnedBy : kind === "save" ? !x.saved : kind === "used" ? !x.used : true;
    C.Res[kind](a, rid); drawRes(a);
    var m = RES_MSG[kind]; say((on ? m[0] : m[1] || m[0]).replace("{f}", a.name.split(" ")[0]));
  };
  V.resNote = function (aid, rid, t) { var a = C.byId(aid); C.Res.note(a, rid, t); drawRes(a); say("Note saved"); };
  V.zip = function (aid) {
    var a = C.byId(aid), cm = cur.kind === "cm";
    sheet({ title: cm ? "Change ZIP" : "I moved", right: '<button type="button" class="btn sm pri" onclick="RXV.zipGo(\'' + aid + '\')">Update</button>',
      body: '<p class="sdesc">' + (cm ? "Resources update for the new area. Works anywhere in the US." : "Tell us your new ZIP code and the list updates for where you live now.") + '</p><div class="group"><div class="field"><label for="zp">ZIP code</label><input id="zp" autofocus inputmode="numeric" maxlength="5" value="' + esc(a.zip || "") + '" onkeydown="if(event.key===\'Enter\')RXV.zipGo(\'' + aid + '\')"></div></div>' });
  };
  V.zipGo = function (aid) { var a = C.byId(aid), z = $("zp").value; if (!C.Res.setZip(a, z)) { $("zp").focus(); say("Enter a 5-digit ZIP code"); return; } V.close(); drawRes(a); loadRes(a); say("Showing resources near " + a.zip); };

  /* ---------- case manager: Resources page (pick who you're recommending for) ---------- */
  function renderCmResources() {
    var mine = C.mine(), id = V.resFor && mine.some(function (x) { return x.id === V.resFor; }) ? V.resFor : V.lastCase && mine.some(function (x) { return x.id === V.lastCase; }) ? V.lastCase : (mine[0] || {}).id;
    if (!id) return { title: "Resources", html: '<h1 class="ltitle">Resources</h1>' + group("", "No alumni on your caseload.") };
    var a = C.byId(id); V.resFor = id;
    var h = '<div class="page-head"><div><h1 class="ltitle">Resources</h1><p class="subtitle">What you recommend shows first on the alumnus\'s own Resources page.</p></div></div>' +
      '<div class="forbar"><label for="rfor">For</label><select id="rfor" onchange="RXV.setResFor(this.value)">' + mine.map(function (x) { return '<option value="' + x.id + '"' + (x.id === id ? " selected" : "") + ">" + esc(x.name) + " · " + esc(x.loc) + "</option>"; }).join("") + '</select><a class="linkbtn" href="#/case/' + a.id + '">Open case</a></div>' +
      '<div id="res-' + a.id + '">' + resourcesHtml(a, "cm") + "</div>";
    return { title: "Resources", html: h, after: function () { loadRes(a); if (SAVED_MODE) loadDemoPlan(a); } };
  }


  V.setResFor = function (id) { V.resFor = id; render(); };

  /* ---------- one step (Act today, Your steps, benefit sheets): bold title, short bullets, one or two action links, Bring ----------
   * n is a step from C.normStep. Links: call (tel:), web (new tab), map, or tile (opens a benefit sheet). */
  function stepLinks(a, n) {
    return (n.links || []).map(function (l, k) {
      if (l.kind === "tile") return '<button type="button" class="act sec2" onclick="RXV.benefit(\'' + a.id + "','" + l.prog + '\')">' + esc(l.label) + "</button>";
      var ext = l.kind !== "call";
      return '<a class="act' + (k ? " sec2" : "") + '" href="' + esc(l.href) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + (l.kind === "call" ? I.phone : "") + esc(l.label) + (ext ? EXT + '<span class="sr"> (opens in a new tab)</span>' : "") + "</a>";
    }).join("");
  }
  function stepInner(a, n, view) {
    var links = stepLinks(a, n);
    return '<div class="st' + (n.legacy ? " legacy" : "") + '">' + esc(n.title) + "</div>" +
      onlyIf((n.bullets || []).length, "<ul>" + (n.bullets || []).map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>") +
      onlyIf(links, '<div class="acts">' + links + "</div>") +
      onlyIf(view === "cm" && n.missing, '<div class="warnline">No phone number or link on record. Check before sharing.</div>') +
      onlyIf((n.bring || []).length, '<div class="bring">Bring: ' + esc((n.bring || []).join(", ")) + "</div>");
  }
  function stepHtml(a, n, i, view) { return '<div class="step"><span class="num" aria-hidden="true">' + (i + 1) + '</span><div class="tx">' + stepInner(a, n, view) + "</div></div>"; }
  /* Act today for the case manager: fixed benefit steps first (from the tiles), then the AI plan's steps */
  function todaySteps(a, plan, view) {
    return C.benefitTodaySteps(a, view).concat((plan && plan.act_today) || []).map(function (x) { return C.normStep(x, view); });
  }

  /* ---------- Benefits: CalFresh and Medi-Cal tiles (both views), each opening a sheet. Fixed rules, no AI. ---------- */
  function benefitsBlock(a, cm) {
    return gh("Benefits", cm ? "Rules from state sources · no AI" : "") + '<div class="btiles">' + C.BEN_ORDER.map(function (p) {
      var B = C.BENEFITS[p], tg = C.benefitTag(a, p);
      return '<button type="button" class="btile" aria-haspopup="dialog" onclick="RXV.benefit(\'' + a.id + "','" + p + '\')"><span class="ctile c-' + B.tile + '" aria-hidden="true">' + CI[B.tile] + '</span>' +
        '<span class="body"><span class="ttl">' + esc(B.name) + '</span><span class="sec">' + esc(B.plain) + '</span><span class="tag ' + tg[0] + '">' + esc(cm ? tg[1] : tg[2]) + "</span></span>" + I.chev + "</button>";
    }).join("") + "</div>";
  }
  function benefitBody(a, p, cm) {
    var B = C.BENEFITS[p], b = C.benefitOf(a, p), tg = C.benefitTag(a, p), first = a.name.split(" ")[0], off = C.benefitOffice(a, p);
    var steps = C.benefitSteps(a, p, cm ? "cm" : "me").map(function (x) { return C.normStep(Object.assign({ kind: "benefit", prog: p }, x), cm ? "cm" : "me"); });
    var done = b.status === B.done;
    var stepsHtml = steps.length ? '<div class="group">' + steps.map(function (n, i) { return stepHtml(a, n, i, cm ? "cm" : "me"); }).join("") + "</div>"
      : '<p class="bnote">' + (cm ? "Nothing to do right now. Benefits need renewing: watch for mail from the county." : "Nothing to do right now. Watch your mail: the county will send renewal forms.") + "</p>";
    var bring = '<div class="bring">Bring: ' + esc(B.bring.join(", ")) + "</div>";
    if (cm) {
      return '<div class="bsh"><h3>Status</h3><div class="statusrow"><span class="tag ' + tg[0] + '">' + esc(tg[1]) + '</span><label class="muted">Update <select aria-label="' + esc(B.name) + ' status" onchange="RXV.setBen(\'' + a.id + "','" + p + '\',this.value)">' +
          B.statuses.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === b.status ? " selected" : "") + ">" + esc(s[1]) + "</option>"; }).join("") + "</select></label></div>" +
          onlyIf(b.date, '<p class="bnote">' + (p === "calfresh" && b.status === "interview_done" ? "Interview was " : "Updated ") + esc(C.fmShort(b.date)) + (b.by ? " by " + esc(C.who(b.by)) : "") + ".</p>") +
        "<h3>What " + esc(first) + " can get</h3><div class=\"big\">" + esc(B.get) + '</div><div class="bnote">' + esc(B.getSub) + "</div>" +
        "<h3>Eligibility" + (done ? "" : ' <span class="tag ok">' + esc(B.verdict) + '</span> <span class="tag">' + esc(B.verdictNote) + "</span>") + '</h3><ul class="elig">' +
          B.rules.map(function (r) { return "<li>" + esc(r.text) + ' <a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.src) + EXT + '<span class="sr"> (opens in a new tab)</span></a></li>'; }).join("") + "</ul>" +
        "<h3>Next steps</h3>" + stepsHtml + (done ? "" : bring) +
        '<p class="src">County office: ' + esc(off.name) + ", " + esc(off.phone) + ". Statewide: " + esc(p === "calfresh" ? "CalFresh Info Line 1-877-847-3663" : "Medi-Cal Helpline 1-800-541-5555") + ". Numbers checked Nov 12, 2026.</p></div>";
    }
    return '<div class="bsh"><div class="big">' + esc(B.alGet) + '</div><p>' + esc(B.alGetSub) + "</p>" + (done ? "" : "<p>" + esc(B.alWho) + "</p>") +
      "<h3>" + (done ? "You're all set" : "What to do") + "</h3>" + stepsHtml + (done ? "" : bring) + "</div>";
  }
  V.benefit = function (aid, p) {
    var a = C.byId(aid), cm = cur.kind === "cm", B = C.BENEFITS[p]; if (!a || !B) return;
    sheet({ title: B.name + " · " + (p === "calfresh" ? "food money" : "health care"), body: benefitBody(a, p, cm) });
  };
  V.setBen = function (aid, p, status) {
    var a = C.byId(aid), B = C.BENEFITS[p], label = (B.statuses.filter(function (s) { return s[0] === status; })[0] || [])[1];
    act(a, B.name + ": " + label, function () { C.setBenefit(a, p, status); });
    var dlg = $("sheet"); if (dlg && dlg.open) $("sheetBody").innerHTML = benefitBody(a, p, true);
  };

  /* ---------- AI deep search: runs Nikhil's agent pipeline (/api/agent/step) and shows its plan here ----------
   * Case-manager only. Draft output: nothing is saved to the record unless a result is recommended (with Undo).
   * Built only from existing components (groups, rows, dots, tags, banner, text actions). */
  V.agent = {};
  var AG_STAGES = [["intake", "Reading the record"], ["orchestrator", "Naming needs and urgency"], ["finders", "Searching housing, health, food, jobs, legal"], ["judge", "Checking eligibility"], ["ranker", "Ranking a plan"]];
  var AG_URG = { today: "Today", this_week: "This week", this_month: "This month" };
  var AG_VERDICT = { likely: ["ok", "Likely eligible"], worth_applying: ["accent", "Worth applying"], not_eligible: ["warn", "Not eligible"] };
  var AG_CAT = { housing: "Housing", health: "Health", food_benefits: "Food and benefits", jobs: "Jobs and training", legal_id: "Legal, ID and records", family: "Family", clothing: "Clothing" };
  function agState(aid) { return V.agent[aid] || (V.agent[aid] = { status: "idle" }); }
  function urgTag(u) { return u ? '<span class="tag' + (u === "today" ? " warn" : u === "this_week" ? " accent" : "") + '">' + esc(AG_URG[u] || u) + "</span>" : ""; }
  /* AI results as collapsible categories (same rows as General resources), for the case manager ("cm") or the alumnus ("me") */
  function aiCats(a, plan, view, q) {
    var cm = view === "cm", G = C.agentGroups(plan), open = V.openCats[okey(a.id)] || {}, h = '<div class="group">', any = false;
    function row(key, tile, label, extra, n, isOpen, searching) {
      return '<button type="button" class="row cat" id="aic-' + a.id + "-" + key + '" aria-expanded="' + isOpen + '"' + (searching ? ' aria-disabled="true" tabindex="-1"' : ' onclick="RXV.aiCat(\'' + a.id + "','" + key + '\')"') + ">" + tile + '<span class="body ttl">' + esc(label) + "</span>" + extra + '<span class="trail">' + n + "</span>" + I.chev + "</button>";
    }
    var TS = cm && !q ? todaySteps(a, plan, "cm") : [];
    if (TS.length) { /* written for staff ("ask his parole agent…"), so alumni see only what's shared */
      var ao = open["ai:act"] !== false; any = true; /* open by default: it's the first thing to do */
      h += row("act", "", "Act today", "", TS.length, ao, false);
      if (ao) h += '<div class="catbody steps">' + TS.map(function (n, i) { return stepHtml(a, n, i, "cm"); }).join("") + "</div>";
    }
    G.cats.forEach(function (c) {
      var items = (q ? c.items.filter(function (e) { return C.agentMatch(e, q); }) : c.items).filter(function (e) { var x = (a.resourceActions || {})[e.item.id]; return cm || !(x && x.pinnedBy); }); /* alumni: already under Recommended */
      if (!items.length) return; any = true;
      var isOpen = !!q || !!open["ai:" + c.id];
      h += row(c.id, '<span class="ctile c-' + c.id + '" aria-hidden="true">' + CI[c.id] + "</span>", c.label, urgTag(c.urgency), items.length, isOpen, !!q);
      if (isOpen) h += '<div class="catbody">' + items.map(function (e) { return cm ? agentRow(a, e.c, e.why, e.bring) : aiAlumRow(a, e); }).join("") + "</div>";
    });
    if (cm && !q && G.excluded.length) {
      var eo = !!open["ai:excluded"]; any = true;
      h += row("excluded", "", "Not eligible", "", G.excluded.length, eo, false);
      if (eo) h += '<div class="catbody">' + G.excluded.map(function (c) { return agentRow(a, c, null, null); }).join("") + "</div>";
    }
    return any ? h + "</div>" : q ? "" : group("", "The agents didn't return any programs.");
  }
  /* what an alumnus sees for a shared AI result: the normal row plus "Bring", no eligibility verdicts */
  function aiAlumRow(a, e) {
    var it = e.item, x = (a.resourceActions || {})[it.id] || {}, rid = it.id;
    function t(kind, on, off, onL) { return '<button type="button" class="ta" aria-pressed="' + on + '" onclick="RXV.res(\'' + kind + "','" + a.id + "','" + rid + '\')">' + (on ? "✓ " + onL : off) + "</button>"; }
    return '<article class="res"><div class="nm">' + (it.url ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.name) + EXT + '<span class="sr"> (opens in a new tab)</span></a>' : esc(it.name)) + "</div>" +
      '<div class="sum">' + esc(C.summaryOf(it)) + "</div>" + onlyIf(it.address, '<div class="ln">' + esc(it.address) + "</div>") +
      onlyIf(it.phone, '<div class="ln"><a href="tel:' + esc(String(it.phone).replace(/[^\d+]/g, "")) + '">' + esc(it.phone) + "</a></div>") +
      onlyIf(e.bring.length, '<div class="ln">Bring: ' + esc(e.bring.map(function (b) { return b.replace(/\b(his|her)\b/g, "your").replace(/\b(His|Her)\b/g, "Your"); }).join(", ")) + "</div>") +
      '<div class="tas">' + t("save", !!x.saved, "Save", "Saved") + '<span class="dotsep" aria-hidden="true">·</span>' + t("used", !!x.used, "I used this", "Used") + "</div></article>";
  }
  V.aiCat = function (aid, key) { var k = okey(aid), o = V.openCats[k] = V.openCats[k] || {}; o["ai:" + key] = key === "act" ? o["ai:act"] === false : !o["ai:" + key]; drawRes(C.byId(aid)); };
  /* the AI section for the case manager: idle / running / error / plan in categories, with sharing */
  function agentBlock(a, q) {
    var g = agState(a.id), first = a.name.split(" ")[0], st = C.resState(a), geo = st.data && st.data.geo;
    var h = '<div id="ag-' + a.id + '" class="ag">';
    if (g.status === "idle") {
      if (q) return h + "</div>";
      var ca = geo && geo.state === "CA", why = !st.data ? "Checking the location…" : ca ? "A team of Claude agents checks eligibility and builds a plan for " + esc(first) + ". About 90 seconds." : "AI search covers California only.";
      h += gh("AI plan") + group('<div class="row"><div class="body"><div class="sec">' + why + '</div></div>' +
        (ca ? '<button type="button" class="btn sm pri" onclick="RXV.agentAsk(\'' + a.id + '\')">' + I.spark + 'Build plan</button>' : '<button type="button" class="btn sm" disabled title="' + (st.data ? "AI search covers California only" : "Checking the location") + '">Build plan</button>') + "</div>");
    } else if (g.status === "running") {
      var secs = Math.round((Date.now() - g.t0) / 1000);
      h += gh("AI plan", "searching · " + secs + " s") + '<div class="group">' + AG_STAGES.map(function (s) {
        var v = g.stages[s[0]] || "", dot = v === "done" ? "ok" : v === "error" ? "warn" : v === "running" ? "info" : "";
        return '<div class="row"><span class="dot ' + dot + '" aria-hidden="true"></span><div class="body"><div class="ttl">' + s[1] + '</div>' + (g.notes[s[0]] ? '<div class="sec">' + esc(g.notes[s[0]]) + "</div>" : "") + "</div>" + (v === "done" ? '<span class="trail oktext">Done</span>' : v === "running" ? '<span class="trail">Working…</span>' : "") + "</div>";
      }).join("") + '<div class="row"><div class="body"><div class="sec">' + g.programs + " programs checked · " + g.sources + " sources searched" + (g.last ? " · " + esc(g.last) : "") + '</div></div><button type="button" class="btn sm" onclick="RXV.agentCancel(\'' + a.id + '\')">Cancel</button></div></div>';
    } else if (g.status === "error") {
      h += gh("AI plan") + '<div class="note err">' + esc(g.err) + '</div><p class="gf"><button type="button" class="linkbtn" onclick="RXV.agentAsk(\'' + a.id + '\')">Try again</button> · <button type="button" class="linkbtn" onclick="RXV.useSaved(\'' + a.id + '\')">Use saved run</button></p>';
    } else if (g.status === "done") {
      var cats = aiCats(a, g.plan, "cm", q), sh = a.aiShared, cur2 = sh && sh.runId === g.runId;
      if (q && !cats) return h + "</div>";
      h += gh("AI plan");
      if (!q) {
        /* one quiet line about where it came from, then one line about sharing (no tinted banner, no boxed row) */
        h += '<p class="bstatus ok">Built by Claude agents from ' + esc(first) + "'s sample record and public sources" + (g.saved ? " (saved run from " + esc(g.saved) + ")" : "") + ". Not saved to the record." + (g.errors.length ? ' <span class="warntext">' + g.errors.length + " step" + (g.errors.length === 1 ? "" : "s") + " had trouble: " + esc(g.errors.join("; ")) + "</span>" : "") + "</p>";
        h += '<div class="sharebar"><div class="body"><span class="ttl">' + (sh ? (cur2 ? "Shared with " + esc(first) : "An earlier plan is shared with " + esc(first)) : "Not shared with " + esc(first)) + '</span> <span class="muted">' + (sh ? "since " + esc(C.fmShort(sh.at)) + ". " + esc(first) + " sees results and what to bring, not eligibility notes." : esc(first) + " sees results and what to bring once you share, never the eligibility notes.") + "</span></div>" +
          (sh && cur2 ? '<div class="pc-a"><button type="button" class="btn sm" onclick="RXV.agentShare(\'' + a.id + '\')">Edit steps</button><button type="button" class="btn sm" onclick="RXV.agentUnshare(\'' + a.id + '\')">Unshare</button></div>' : '<button type="button" class="btn sm pri" onclick="RXV.agentShare(\'' + a.id + '\')">' + (sh ? "Share this new plan" : "Share with " + esc(first)) + "</button>") + "</div>";
      }
      h += cats;
      var stt = g.plan.stats || {};
      if (!q) h += '<p class="gf">' + (stt.programs_checked || 0) + " programs checked · " + (stt.sources_searched || 0) + " sources searched · " + (stt.seconds || 0) + ' s. <button type="button" class="linkbtn" onclick="RXV.agentAsk(\'' + a.id + '\')">Run again</button></p>';
    }
    return h + "</div>";
  }
  /* the shared plan on the alumnus's own Resources page */
  /* a shared step on the alumnus's page: same layout as Act today, with a check to mark it done (n = shown number) */
  function stepRow(a, x, i, n) {
    var s = C.normStep(x, "me");
    return '<div class="step' + (s.done ? " done" : "") + '"><button type="button" class="check" role="checkbox" aria-checked="' + !!s.done + '" aria-label="' + esc((s.done ? "Reopen: " : "Mark done: ") + s.title) + '" onclick="RXV.stepDone(\'' + a.id + "'," + i + ')">' + I.tick + '</button><div class="tx">' + stepInner(a, s, "me") + "</div></div>";
  }
  function sharedBlock(a, q) {
    var sh = a.aiShared; if (!sh) return "";
    var cats = aiCats(a, sh.plan, "me", q); if (q && !cats) return "";
    /* benefit steps are live (they follow the tile status, no AI), so they come first and aren't part of the shared snapshot */
    var ben = C.benefitTodaySteps(a, "me").map(function (x) { return C.normStep(x, "me"); }), k = ben.length;
    var steps = !q && (k || (sh.steps && sh.steps.length)) ? gh("Your steps", "from " + esc(C.who(sh.by).split(" ")[0]) + ", in order") +
      group(ben.map(function (n, i) { return stepHtml(a, n, i, "me"); }).join("") + (sh.steps || []).map(function (x, i) { return stepRow(a, x, i, k + i + 1); }).join("")) : "";
    return steps + gh("From " + C.who(sh.by), "found by AI") + (q ? "" : '<p class="gf">Shared ' + esc(C.fmShort(sh.at)) + ". Call ahead: details can change.</p>") + cats;
  }
  function agentRow(a, c, why, bring) {
    /* AI result for the case manager: name + verdict, one "why it fits" line, phone and address on one line,
       the question to confirm (for gray areas), then everything else behind Details. */
    var it = C.agentItem(c), x = (a.resourceActions || {})[it.id] || {}, pinned = !!x.pinnedBy, v = AG_VERDICT[c.verdict], first = a.name.split(" ")[0];
    var status = x.used ? esc(first) + " used this" + (x.usedAt ? " " + esc(C.fmShort(x.usedAt)) : "") : x.saved ? "Saved by " + esc(first) : "";
    var meta = [it.phone ? '<a href="tel:' + esc(String(it.phone).replace(/[^\d+]/g, "")) + '">' + esc(it.phone) + "</a>" : "", it.address ? esc(it.address) : ""].filter(Boolean);
    var more = [
      why && c.reason ? '<div class="ln">' + esc(c.reason) + "</div>" : "",
      (bring || []).length ? '<div class="ln">Bring: ' + esc((bring || []).join(", ")) + "</div>" : "",
      c.rule_cited ? '<div class="ln">' + (c.verdict === "not_eligible" ? "Rule" : "Based on") + ": " + (c.rule_url ? '<a href="' + esc(c.rule_url) + '" target="_blank" rel="noopener">' + esc(c.rule_cited) + "</a>" : esc(c.rule_cited)) + "</div>" : "",
      c.source_url && c.source_url !== it.url ? '<div class="ln">Source: <a href="' + esc(c.source_url) + '" target="_blank" rel="noopener">' + esc(c.source || "link") + "</a></div>" : ""
    ].join("");
    var h = '<article class="res ai"><div class="nm">' + (it.url ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.name) + EXT + '<span class="sr"> (opens in a new tab)</span></a>' : esc(it.name)) + (v ? ' <span class="tag ' + v[0] + '">' + v[1] + "</span>" : "") + "</div>" +
      '<div class="sum">' + esc(why || c.reason || C.summaryOf(it)) + "</div>" +
      onlyIf(meta.length, '<div class="meta">' + meta.join('<span class="dotsep" aria-hidden="true"> · </span>') + "</div>") +
      onlyIf(c.verdict === "worth_applying" && c.confirm_question, '<div class="ask">Confirm: ' + esc(c.confirm_question) + "</div>") +
      onlyIf(status, '<div class="st">' + status + "</div>");
    var acts = c.verdict !== "not_eligible" ? '<button type="button" class="ta" aria-pressed="' + pinned + '" onclick="RXV.agentPin(\'' + a.id + "','" + it.id + '\')">' + (pinned ? "✓ Recommended" : "Recommend to " + esc(first)) + "</button>" + onlyIf(pinned, '<span class="dotsep" aria-hidden="true">·</span><button type="button" class="ta muted-ta" onclick="RXV.agentPin(\'' + a.id + "','" + it.id + '\')">Remove pin</button>') : "";
    h += '<div class="tas">' + acts + onlyIf(more, '<details class="more"><summary>Details</summary>' + more + "</details>") + "</div>";
    return h + "</article>";
  }

  function drawAgent(aid) {
    var el = $("ag-" + aid), a = C.byId(aid); if (el && a) el.outerHTML = agentBlock(a, (V.resQ[aid] || "").trim());
    var ov = $("agov-" + aid); if (ov && a) ov.innerHTML = planCard(a);
  }
  /* Case › Overview: the AI resource plan, summarised. The full plan (every result, verdicts, sharing) is in the Resources tab. */
  function planCard(a) {
    var g = agState(a.id), first = a.name.split(" ")[0], st = C.resState(a), geo = st.data && st.data.geo, ca = !geo || geo.state === "CA";
    var toTab = '<button type="button" class="btn" onclick="RXV.tab(\'' + a.id + '\',\'resources\')">';
    var h = '<section class="plan-card" aria-labelledby="pc-' + a.id + '"><div class="pc-h"><div class="pc-t"><h2 id="pc-' + a.id + '">Resource plan</h2>';
    if (g.status === "done") {
      var G = C.agentGroups(g.plan), sh = a.aiShared, cur2 = sh && sh.runId === g.runId;
      h += '<p class="sec">' + (g.saved ? "Saved run from " + esc(g.saved) + ". " : "") + G.count + " programs from public sources and the web. Draft: check before use.</p></div>" +
        '<div class="pc-a">' + (cur2 ? '<span class="tag ok">Shared with ' + esc(first) + "</span>" : '<button type="button" class="btn" onclick="RXV.agentShare(\'' + a.id + '\')">Share with ' + esc(first) + "</button>") + toTab + "Open full plan</button></div></div>";
      var TS = todaySteps(a, g.plan, "cm");
      if (TS.length) h += '<div class="pc-sub">Act today</div><div class="pc-steps">' + TS.map(function (n, i) { return stepHtml(a, n, i, "cm"); }).join("") + "</div>";
      if (G.cats.length) h += '<div class="pc-sub">Top pick per need</div><div class="pc-picks">' + G.cats.map(function (c) {
        var e = c.items[0], v = AG_VERDICT[e.c.verdict];
        return '<button type="button" class="pick" onclick="RXV.openPlanCat(\'' + a.id + "','" + c.id + '\')"><span class="ctile c-' + c.id + '" aria-hidden="true">' + CI[c.id] + '</span><span class="body"><span class="pl">' + esc(c.label) + (c.items.length > 1 ? " · " + c.items.length + " options" : "") + '</span><span class="pn">' + esc(e.item.name) + "</span></span>" + (v ? '<span class="tag ' + v[0] + '">' + v[1] + "</span>" : "") + urgTag(c.urgency) + I.chev + "</button>";
      }).join("") + "</div>";
    } else if (g.status === "running") {
      var secs = Math.round((Date.now() - g.t0) / 1000), now = AG_STAGES.filter(function (x) { return g.stages[x[0]] === "running"; })[0];
      h += '<p class="sec" role="status">Searching for ' + esc(first) + " · " + secs + " s" + (now ? " · " + esc(now[1]) : "") + "</p></div><div class=\"pc-a\">" + toTab + "View progress</button></div></div>";
    } else if (g.status === "error") {
      h += '<p class="sec warntext">' + esc(g.err) + '</p></div><div class="pc-a"><button type="button" class="btn" onclick="RXV.useSaved(\'' + a.id + '\')">Use saved run</button><button type="button" class="btn" onclick="RXV.agentAsk(\'' + a.id + '\')">Try again</button></div></div>';
    } else {
      h += '<p class="sec">' + (ca ? "Claude agents find programs that fit " + esc(first) + "'s situation, check eligibility and rank a plan. About 90 seconds." : "AI search covers California only.") + "</p></div>" +
        '<div class="pc-a"><button type="button" class="btn"' + (ca ? ' onclick="RXV.agentAsk(\'' + a.id + '\')"' : " disabled") + ">" + I.spark + "Build plan</button></div></div>";
    }
    return h + "</section>";
  }
  V.openPlanCat = function (aid, cid) { var k = okey(aid), o = V.openCats[k] = V.openCats[k] || {}; o["ai:" + cid] = true; drawRes(C.byId(aid)); V.tab(aid, "resources"); var el = $("ag-" + aid); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); };
  /* Saved runs per demo alumnus (site/data/agent/demo-plans/<id>.json). The AI search is started by hand for the demo;
     a saved run loads only on request: from "Use saved run" when a live run fails, or for every case with ?saved in the URL. */
  var SAVED_MODE = /[?&]saved\b/.test(location.search), demoTried = {};
  function loadDemoPlan(a, force) {
    if ((!force && demoTried[a.id]) || (!force && agState(a.id).status !== "idle") || !window.fetch) return; demoTried[a.id] = 1;
    try {
      fetch("/data/agent/demo-plans/" + a.id + ".json").then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
        var g = agState(a.id);
        if (!p || !p.plan || !p.plan.sections) { if (force) say("No saved run for " + a.name.split(" ")[0]); return; }
        if (!force && g.status !== "idle") return;
        V.agent[a.id] = { status: "done", plan: p.plan, saved: p.savedAt || "an earlier run", runId: "saved-" + a.id, errors: [], stages: {}, notes: {}, programs: (p.plan.stats || {}).programs_checked || 0, sources: (p.plan.stats || {}).sources_searched || 0 };
        drawAgent(a.id); if (force) say("Showing the saved run from " + (p.savedAt || "earlier"));
      }).catch(function () { if (force) say("No saved run for " + a.name.split(" ")[0]); });
    } catch (e) {}
  }
  V.useSaved = function (aid) { loadDemoPlan(C.byId(aid), true); };
  /* keep an AI result's details on the record's resource actions, so pin / save / used work like any other resource */
  function ensureAgentItem(a, rid) {
    var acts = a.resourceActions = a.resourceActions || {}, x = acts[rid] = acts[rid] || {};
    if (x.item) return true;
    var plans = [agState(a.id).plan, a.aiShared && a.aiShared.plan].filter(Boolean), c = null;
    plans.forEach(function (p) { (p.sections || []).forEach(function (s) { (s.recommendations || []).forEach(function (r) { if (!c && r.candidate && C.agentItem(r.candidate).id === rid) c = r.candidate; }); }); });
    if (c) x.item = C.agentItem(c);
    return !!c;
  }
  /* recommend an AI result: stored as a normal resource item so it shows in the alumnus's Recommended list and the briefing */
  V.agentPin = function (aid, rid) {
    var a = C.byId(aid); if (!ensureAgentItem(a, rid)) return;
    var on = !a.resourceActions[rid].pinnedBy; C.Res.pin(a, rid); drawRes(a); say(on ? "Recommended to " + a.name.split(" ")[0] : "Recommendation removed");
  };
  /* Share = review first. The case manager sees each step as the alumnus will read it ("you"), can reword it or leave it out,
     and only then shares. Nothing AI-written reaches an alumnus without this review (PRD guardrail). */
  function draftSteps(a) {
    var g = agState(a.id), sh = a.aiShared;
    if (sh && sh.runId === g.runId && sh.steps) return sh.steps.map(function (x) { return { text: x.text, bullets: x.bullets || [], links: x.links || [], bring: x.bring || [], on: true, done: !!x.done }; });
    /* the alumnus version of each AI step; a step with no phone or link starts unticked so it gets checked first */
    return ((g.plan && g.plan.act_today) || []).map(function (x) { var n = C.normStep(x, "me"); return { text: n.title, bullets: n.bullets, links: n.links, bring: n.bring.map(C.toYou), on: !n.missing || !!n.legacy, missing: !!n.missing && !n.legacy, done: false }; });
  }
  V.agentShare = function (aid) {
    var a = C.byId(aid), g = agState(aid), first = a.name.split(" ")[0], steps = draftSteps(a), again = a.aiShared && a.aiShared.runId === g.runId; if (!g.plan) return;
    sheet({ title: (again ? "Edit steps for " : "Share with ") + first, wide: true,
      right: '<button type="button" class="btn sm pri" onclick="RXV.agentShareGo(\'' + aid + '\')">' + (again ? "Save steps" : "Share with " + esc(first)) + "</button>",
      body: '<p class="sdesc">' + esc(first) + " sees these steps in this order on the Home and Resources pages, with the programs the agents found (never the eligibility notes). Reword anything that doesn't sound right, or leave a step out.</p>" +
        (C.benefitTodaySteps(a, "me").length ? '<p class="sdesc">CalFresh and Medi-Cal steps come first. They follow the benefits tiles, so they aren\'t edited here.</p>' : "") +
        (steps.length ? steps.map(function (x, i) {
          return '<div class="stepedit"><label class="se-on"><input type="checkbox" id="so' + i + '"' + (x.on ? " checked" : "") + "> Step " + (i + 1) + '</label><div class="field"><label for="st' + i + '" class="sr">Step ' + (i + 1) + ' title</label><textarea id="st' + i + '" rows="2" maxlength="160">' + esc(x.text) + "</textarea></div>" +
            '<div class="field"><label for="sl' + i + '">Details <span class="muted">one per line, 3 at most</span></label><textarea id="sl' + i + '" rows="3" maxlength="400">' + esc((x.bullets || []).join("\n")) + "</textarea></div>" +
            '<div class="field"><label for="sb' + i + '">Bring <span class="muted">comma-separated</span></label><input id="sb' + i + '" maxlength="200" value="' + esc(x.bring.join(", ")) + '"></div>' +
            ((x.links || []).length ? '<p class="se-links muted">' + esc(x.links.map(function (l) { return l.label; }).join(" · ")) + "</p>" : x.missing ? '<p class="se-links warntext">No phone number or link on record. Add one to the details, or leave this step out.</p>' : "") + "</div>";
        }).join("") : '<p class="muted">This plan has no steps for today. ' + esc(first) + " will see the programs only.</p>") });
    V.shareN = steps.length; V.shareDone = steps.map(function (x) { return x.done; }); V.shareLinks = steps.map(function (x) { return x.links || []; });
  };
  V.agentShareGo = function (aid) {
    var a = C.byId(aid), g = agState(aid), first = a.name.split(" ")[0], again = a.aiShared && a.aiShared.runId === g.runId, steps = [];
    for (var i = 0; i < V.shareN; i++) {
      var on = $("so" + i).checked, t = $("st" + i).value.trim();
      if (on && t) steps.push({ text: t, bullets: $("sl" + i).value.split("\n").map(function (b) { return b.trim(); }).filter(Boolean).slice(0, 3), links: V.shareLinks[i] || [],
        bring: $("sb" + i).value.split(",").map(function (b) { return b.trim(); }).filter(Boolean), done: !!V.shareDone[i] });
    }
    V.close();
    act(a, again ? "Steps updated for " + first : "Shared with " + first, function () { a.aiShared = { plan: JSON.parse(JSON.stringify(g.plan)), by: C.actor(), at: C.today(), runId: g.runId, steps: steps }; });
  };
  V.agentUnshare = function (aid) { var a = C.byId(aid); act(a, "No longer shared with " + a.name.split(" ")[0], function () { delete a.aiShared; }); };
  /* the alumnus ticks a shared step off (either side can undo, like tasks) */
  V.stepDone = function (aid, i) { var a = C.byId(aid), st = a.aiShared && a.aiShared.steps && a.aiShared.steps[i]; if (!st) return; act(a, st.done ? "Step reopened" : "Step done", function () { st.done = !st.done; }); };
  V.agentAsk = function (aid) {
    var a = C.byId(aid), first = a.name.split(" ")[0];
    sheet({ title: "Build a resource plan for " + first, right: '<button type="button" class="btn sm pri" onclick="RXV.agentRun(\'' + aid + '\')">Run search</button>',
      body: '<p class="sdesc">A team of Claude agents reads ' + esc(first) + "'s sample record, searches public sources and the web, checks eligibility and ranks a plan. It takes about 90 seconds and covers California only.</p>" +
        '<p class="sdesc">The plan is a draft. Nothing is saved to the record unless you recommend a result, and only sample data is sent to Claude.</p>' });
  };
  V.agentCancel = function (aid) { var g = agState(aid); if (g.ctl) g.ctl.abort(); g.status = "idle"; clearInterval(g.tick); drawAgent(aid); say("AI search stopped"); };
  function readSSE(body, onEvent) {
    var reader = body.getReader(), dec = new TextDecoder(), buf = "";
    function flush(block) { var data = block.split(/\r?\n/).filter(function (l) { return l.indexOf("data:") === 0; }).map(function (l) { return l.slice(5).replace(/^ /, ""); }).join("\n"); if (data) { try { onEvent(JSON.parse(data)); } catch (e) {} } }
    function pump() { return reader.read().then(function (r) { if (r.done) { if (buf.trim()) flush(buf); return; } buf += dec.decode(r.value, { stream: true }); var m; while ((m = buf.match(/\r?\n\r?\n/))) { flush(buf.slice(0, m.index)); buf = buf.slice(m.index + m[0].length); } return pump(); }); }
    return pump();
  }
  /* one stage = one POST; progress events update the panel; resolves with the stage's result */
  function agStep(aid, payload, live) {
    var g = agState(aid);
    return fetch("/api/agent/step", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify(payload), signal: g.ctl.signal }).then(function (resp) {
      if (!resp.ok || !resp.body) return resp.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || "Server responded " + resp.status); });
      var result = null, failure = null;
      return readSSE(resp.body, function (ev) {
        if (ev.type === "result") { result = ev.data; if (ev.counters) { g.programs += ev.counters.programs_checked || 0; g.sources += ev.counters.sources_searched || 0; } }
        else if (ev.type === "step_error") failure = ev.message || "step failed";
        else if (ev.message && g.status === "running") { g.last = ev.message; if (live) g.notes[live] = ev.message; }
      }).then(function () { if (failure) throw new Error(failure); if (!result) throw new Error("The " + payload.stage + " step ended early"); return result; });
    });
  }
  V.agentRun = function (aid) {
    V.close();
    var a = C.byId(aid), st = C.resState(a), g = V.agent[aid] = { status: "running", t0: Date.now(), stages: {}, notes: {}, programs: 0, sources: 0, errors: [], ctl: new AbortController() };
    g.tick = setInterval(function () { if (g.status === "running" && V.agent[aid] === g) drawAgent(aid); else clearInterval(g.tick); }, 1000);
    function mark(s, v, note) { g.stages[s] = v; if (note) g.notes[s] = note; drawAgent(aid); }
    function alive() { return V.agent[aid] === g && g.status === "running"; }
    drawAgent(aid);
    var profile0 = C.toAgentProfile(a, st.data && st.data.geo), profile, orch;
    mark("intake", "running");
    agStep(aid, { stage: "intake", profile: profile0 }, "intake").then(function (r) {
      profile = r.profile; mark("intake", "done", "Read " + a.name.split(" ")[0] + "'s record"); mark("orchestrator", "running");
      return agStep(aid, { stage: "orchestrator", profile: profile }, "orchestrator");
    }).then(function (o) {
      orch = o; mark("orchestrator", "done", (o.needs || []).length + " needs named"); mark("finders", "running"); mark("judge", "running");
      var left = (o.briefs || []).length;
      return Promise.all((o.briefs || []).map(function (brief) {
        return agStep(aid, { stage: "finder", profile: profile, brief: brief }, "finders").then(function (f) {
          var cands = f.candidates || []; if (!cands.length) return [];
          return agStep(aid, { stage: "judge", profile: profile, finder: brief.finder, candidates: cands }, "judge").then(function (j) { return j.judged || []; }, function (e) {
            if (!alive()) throw e; g.errors.push("eligibility check for " + brief.finder + " (" + e.message + ")");
            return cands.map(function (c) { return Object.assign({}, c, { verdict: "worth_applying", reason: "Eligibility not checked; confirm with the program.", confirm_question: "Am I eligible?" }); });
          });
        }, function (e) { if (!alive()) throw e; g.errors.push(brief.finder + " search (" + e.message + ")"); return []; }).then(function (r) { left--; g.notes.finders = (o.briefs.length - left) + " of " + o.briefs.length + " searches finished"; drawAgent(aid); return r; });
      }));
    }).then(function (lists) {
      var judged = [].concat.apply([], lists); mark("finders", "done"); mark("judge", "done", judged.length + " programs checked for eligibility"); mark("ranker", "running");
      return agStep(aid, { stage: "ranker", profile: profile, needs: orch.needs, judged: judged }, "ranker").then(function (rk) {
        if (!alive()) return;
        clearInterval(g.tick); g.status = "done"; g.runId = g.t0;
        g.plan = { profile: profile, sections: rk.sections, act_today: rk.act_today, excluded: judged.filter(function (j) { return j.verdict === "not_eligible"; }), stats: { programs_checked: g.programs, sources_searched: g.sources, seconds: Math.round((Date.now() - g.t0) / 100) / 10 } };
        drawAgent(aid); say("AI plan ready for " + a.name.split(" ")[0]);
      });
    }).catch(function (e) {
      if (!alive()) return; clearInterval(g.tick);
      g.status = "error"; g.err = "The AI search stopped: " + (e && e.message || "error") + ". Nothing was saved. The resource list below still works."; drawAgent(aid);
    });
  };

  /* ---------- alumnus ---------- */
  function renderHome(a) {
    /* The alumnus's home, phone first: one next step, this week, what John shared, how to reach John. */
    var first = a.name.split(" ")[0], cm = C.cmById(a.cm), cmFirst = cm.name.split(" ")[0], t = C.today();
    var mine = a.tasks.filter(function (x) { return !x.std && x.status !== "done"; }).sort(function (x, y) { return String(x.due || "9999").localeCompare(String(y.due || "9999")); });
    var su = a.tasks.filter(function (x) { return x.std; }), done = su.filter(function (x) { return x.status === "done"; }).length;
    var steps = a.aiShared && a.aiShared.steps || [], si = steps.findIndex(function (x) { return !x.done; });
    var next = si >= 0 ? { plan: true, i: si, title: steps[si].text, link: (steps[si].links || [])[0] || null, detail: [(steps[si].bullets || [])[0] || "", (steps[si].bring || []).length ? "Bring: " + steps[si].bring.join(", ") : ""].filter(Boolean).join(" · "), phase: "Step " + (si + 1) + " of " + steps.length + " in " + C.who(a.aiShared.by).split(" ")[0] + "'s plan" } : mine[0] || su.filter(function (x) { return x.status !== "done"; })[0];
    var recs = Object.keys(a.resourceActions || {}).map(function (k) { return a.resourceActions[k]; }).filter(function (x) { return x.pinnedBy && x.item; });
    var h = '<h1 class="ltitle">Hi, ' + esc(first) + '</h1><p class="subtitle">Day ' + a.dayN + " since release · First 30 Days: " + done + " of " + su.length + " done</p>";
    if (next) h += '<section class="next-step" aria-labelledby="ns-h"><div class="nc-k" id="ns-h">Your next step' + (mine.length ? " · " + mine.length + " task" + (mine.length === 1 ? "" : "s") + " to do from " + esc(cmFirst) : "") + "</div>" +
      '<div class="ns-t">' + esc(next.title) + "</div>" + onlyIf(next.detail, '<div class="ns-d">' + esc(next.detail) + "</div>") +
      '<div class="ns-m">' + (next.due ? (next.due < t ? '<span class="warntext">Was due ' + esc(C.fmShort(next.due)) + "</span>" : "Due " + esc(C.fmShort(next.due))) : esc(next.phase || "")) + "</div>" +
      '<div class="nc-a"><button type="button" class="btn pri" onclick="' + (next.plan ? "RXV.stepDone('" + a.id + "'," + next.i + ")" : "RXV.toggle('" + a.id + "','" + next.id + "')") + '">' + I.tick + "Mark done</button>" + (next.plan && next.link && next.link.href ? '<a class="btn" href="' + esc(next.link.href) + '"' + (next.link.kind === "call" ? "" : ' target="_blank" rel="noopener"') + ">" + esc(next.link.label) + "</a>" : "") + (next.plan ? '<a class="btn" href="#/me/resources">All steps</a>' : '<a class="btn" href="#/me/tasks">All tasks</a>') + "</div></section>";
    else h += '<section class="next-step"><div class="nc-k">Your next step</div><div class="ns-t">You\'re caught up.</div><div class="ns-d">' + esc(cmFirst) + " will add anything new here.</div></section>";
    /* this week: appointments and due tasks, by day */
    var items = C.nextEvents(a, 12).filter(function (e) { return C.days(t, e.date) <= 7; }).map(function (e) { return { d: e.date, tm: e.time, t: e.title, s: e.loc, dot: EDOT[e.type] || "" }; })
      .concat(mine.filter(function (x) { return x.due && C.days(t, x.due) <= 7; }).map(function (x) { return { d: x.due, tm: "", t: x.title, s: "Task from " + cmFirst, dot: "acc" }; }))
      .sort(function (x, y) { return (x.d + (x.tm || "99")) < (y.d + (y.tm || "99")) ? -1 : 1; });
    h += gh("This week") + group(items.map(function (x) { var dd = C.days(t, x.d); return '<div class="row wk"><span class="wk-d">' + (dd <= 0 ? "Today" : dd === 1 ? "Tomorrow" : esc(new Date(x.d + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }))) + onlyIf(x.tm, "<br><span class=\"muted\">" + esc(C.ft(x.tm)) + "</span>") + '</span><span class="dot ' + x.dot + '" aria-hidden="true"></span><div class="body"><div class="ttl">' + esc(x.t) + "</div>" + onlyIf(x.s, '<div class="sec">' + esc(x.s) + "</div>") + "</div></div>"; }).join(""), "Nothing this week.");
    /* from the case manager: what was shared */
    var shared = "";
    if (a.aiShared) {
      var G = C.agentGroups(a.aiShared.plan);
      shared += '<a class="row" href="#/me/resources"><div class="body"><div class="ttl">' + G.count + ' resources found for you by AI</div><div class="sec">Shared by ' + esc(C.who(a.aiShared.by)) + " " + esc(C.fmShort(a.aiShared.at)) + "</div></div>" + I.chev + "</a>" +
        G.cats.slice(0, 3).map(function (c) { return '<a class="row inset" href="#/me/resources"><span class="ctile c-' + c.id + '" aria-hidden="true">' + CI[c.id] + '</span><div class="body"><div class="sec">' + esc(c.label) + '</div><div class="ttl">' + esc(c.items[0].item.name) + "</div></div>" + I.chev + "</a>"; }).join("");
    }
    if (recs.length) shared += '<a class="row" href="#/me/resources"><div class="body"><div class="ttl">' + recs.length + " recommended resource" + (recs.length === 1 ? "" : "s") + '</div><div class="sec">' + esc(recs[0].item.name) + "</div></div>" + I.chev + "</a>";
    if (!shared) shared = '<a class="row" href="#/me/resources"><div class="body"><div class="ttl">Resources near you</div><div class="sec">Local places and programs, by category</div></div>' + I.chev + "</a>";
    h += gh("From " + cm.name) + group(shared);
    h += gh("Your case manager") + '<div class="group"><div class="row">' + av(cm.name) + '<div class="body"><div class="ttl">' + esc(cm.name) + '</div><div class="sec">' + esc(cm.title) + '</div></div><a class="btn sm" href="mailto:' + esc(cm.email) + '">Email ' + esc(cmFirst) + "</a></div></div>";
    return { title: "Home", html: h };
  }
  function renderMyTasks(a) {
    var cu = a.tasks.filter(function (t) { return !t.std; }), su = a.tasks.filter(function (t) { return t.std; }), cm = C.cmById(a.cm), done = su.filter(function (t) { return t.status === "done"; }).length;
    var h = '<h1 class="ltitle">Tasks</h1><p class="subtitle">You or ' + esc(cm.name.split(" ")[0]) + " can mark them done.</p>";
    h += gh("From " + cm.name.split(" ")[0]) + group(cu.map(function (t) { return taskRow(a, t); }).join(""), "Nothing assigned right now.");
    h += gh("First 30 Days", done + " of " + su.length + " done") + '<div class="progress" role="img" aria-label="' + done + " of " + su.length + ' done"><span style="width:' + Math.round(done / Math.max(1, su.length) * 100) + '%"></span></div>' + group(su.map(function (t) { return taskRow(a, t); }).join(""));
    return { title: "Tasks", html: h };
  }
  function renderMyResources(a) {
    var h = '<h1 class="ltitle">Resources</h1><p class="subtitle">Local places and programs, sorted by category.</p>' + '<div id="res-' + a.id + '">' + resourcesHtml(a, "me") + "</div>";
    return { title: "Resources", html: h, after: function () { loadRes(a); } };
  }

  render();
})();
