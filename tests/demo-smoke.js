// jsdom smoke test for the standalone demo (built output in site/public), with mocked /api/resources and Claude.
// Run: cd site && node build.js && cd .. && NODE_PATH=<dir with jsdom>/node_modules node tests/demo-smoke.js
const { JSDOM, requestInterceptor, VirtualConsole } = require("jsdom");
const path = require("path"), fs = require("fs");
const errors = []; const vc = new VirtualConsole();
vc.on("jsdomError", (e) => { if (!/Not implemented/.test(String(e.message))) errors.push(String(e.detail || e.message || e).slice(0, 300)); });
const block = requestInterceptor((req) => (req.url.startsWith("file:") ? undefined : new Response("", { status: 200 })));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const item = (id, need, name, d, trust) => ({ id, need, kind: d == null ? "link" : "office", name, address: d == null ? null : "1 Main St, Oakland, CA", phone: "510-555-0100", url: "https://example.gov/" + id, distanceMi: d, notes: null, source: { name: "Test source", url: "https://example.gov", trust: trust || "official" } });
const ITEMS = [item("pha-1", "housing", "Oakland Housing Authority", 1.0), item("hc-1", "housing", "East Bay Counseling", 3.2), item("state-CA-snap", "snap", "Apply for food benefits (SNAP) in California", null, "curated"), item("nat-ajc", "jobs", "American Job Center near you", null), item("nat-bankon", "bank", "Bank On certified accounts", null, "directory"), item("nat-vote", "vote", "Voting rights after a conviction", null, "directory"), item("nat-rrp", "records", "Record clearing rules", null, "directory"), item("ssa-1", "ssn", "Social Security office", 1.1)];
const requests = []; let claudeMode = "ok";
// mocked /api/agent/step (Nikhil's agent pipeline): SSE built from his sample plan (tests/fixtures-agent-plan.json)
const PLAN = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures-agent-plan.json"), "utf8")).plan;
const agentCalls = []; let agentSlow = 0, agentFailFinder = "";
const ALLC = PLAN.sections.flatMap((x) => x.recommendations.map((r) => r.candidate)).concat(PLAN.excluded);
function sse(events, signal) {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({ async start(ctl) {
    for (const ev of events) { if (agentSlow) await new Promise((r) => setTimeout(r, agentSlow)); if (signal && signal.aborted) { ctl.error(new Error("aborted")); return; } ctl.enqueue(enc.encode("data: " + JSON.stringify(ev) + "\n\n")); }
    ctl.close(); } }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
function agentStep(b, signal) {
  agentCalls.push(b);
  const start = { type: "agent_start", agent: b.stage, message: "Working on " + b.stage };
  const res = (data) => sse([start, { type: "result", data, counters: { programs_checked: 3, sources_searched: 2 } }], signal);
  if (b.stage === "intake") return res({ profile: b.profile });
  if (b.stage === "orchestrator") return res({ needs: PLAN.sections.map((x) => x.need), briefs: ["housing", "health", "food_benefits", "jobs", "legal_id"].map((f) => ({ finder: f, focus: f, constraints: [] })) });
  if (b.stage === "finder") { if (b.brief.finder === agentFailFinder) return sse([start, { type: "step_error", agent: "finder", message: "search failed" }], signal); return res({ candidates: ALLC.filter((c) => c.category === b.brief.finder) }); }
  if (b.stage === "judge") return res({ judged: b.candidates });
  if (b.stage === "ranker") return res({ sections: b.focus ? PLAN.sections.filter((x) => b.focus.finders.includes(x.need.category)) : PLAN.sections, act_today: PLAN.act_today });
  return new Response("{}", { status: 400 });
}

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, "..", "site", "public", "index.html"), { runScripts: "dangerously", resources: { interceptors: [block] }, pretendToBeVisual: true, virtualConsole: vc, url: "file://" + path.join(__dirname, "..", "site", "public", "index.html"), beforeParse(w) {
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new w.Event("close")); };
    w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder;
    w.fetch = async (u, o) => { u = String(u); requests.push(u);
      if (u === "/api/agent/step") return agentStep(JSON.parse(o.body), o.signal);
      if (!u.startsWith("/api/resources")) return new Response("{}", { status: 404 });
      const q = new URL(u, "http://x"), zip = q.searchParams.get("zip"), needs = q.searchParams.get("needs").split(",");
      const items = ITEMS.filter((i) => needs.includes(i.need) || (i.need === "ssn" && needs.includes("id")));
      return new Response(JSON.stringify({ geo: zip === "77002" ? { zip, city: "Houston", state: "TX", county: "Harris County" } : { zip, city: "Oakland", state: "CA", county: "Alameda County", lat: 37.8, lon: -122.27 }, items, errors: [], generatedAt: new Date().toISOString() }), { status: 200 }); };
    const sample = async () => ({ text: "" });
    sample.json = async (prompt) => {
      if (claudeMode === "fail") throw { code: "unavailable" };
      if (/pre-call briefing/.test(prompt)) return { snapshot: [{ text: "Marcus is on day 26, staying with his sister, waiting on Hope House.", cites: ["PROFILE", "HOUSING"] }], since_last_contact: [{ text: "He applied to 2 jobs.", cites: ["PORTAL"] }], open_needs: [{ text: "SNAP interview outcome is unknown.", cites: ["T3"] }], coming_up: [{ text: "Invented 99 item.", cites: ["NOPE"] }], suggested_topics: [{ text: "Ask how the job search feels.", cites: ["EMPLOYMENT"] }, { text: "Ask about Hope House.", cites: ["HOUSING"] }], check_before_call: [{ text: "Curfew: 10pm on the conditions sheet, 9pm per his officer.", cites: ["SUPERVISION", "N3"] }, { text: "Confirm the Hope House bed.", cites: ["HOUSING"] }] };
      if (/call notes into a draft/.test(prompt)) return { summary: "Housing confirmed.", changes: [{ kind: "housing.status", value: "transitional", evidence: "moved into Hope House" }, { kind: "phone", value: "(510) 555-0111", evidence: "new number is 555-9999" }] };
      return ["records", "legal"];
    };
    w.claude = { use: async (n) => (n === "sample" ? sample : null), hosted: "test" };
  } });
  const w = dom.window, d = w.document, ev = (s) => w.eval(s), txt = () => d.getElementById("app").textContent;
  const go = async (h) => { w.location.hash = h; await sleep(60); };
  await sleep(300);

  console.log("sign-in");
  ok(/Sign in as a case manager/.test(txt()) && /John Doe/.test(txt()) && /Marcus Johnson/.test(txt()), "sign-in lists the case managers and Marcus");
  ok(!ev("typeof RX_API") || ev("typeof RX_API") === "undefined", "the old hub code is not loaded");
  ev("RXV.signIn('john')"); await sleep(80);
  ok(/Today/.test(d.querySelector(".ltitle").textContent) && /Next call/.test(txt()) && /Needs you today/.test(txt()) && !/Recent notes/.test(txt()) && !d.querySelector("#app .cite-badge"), "John lands on Today: next call and who needs him, no notes feed or record IDs");
  { const needs = [...d.querySelectorAll(".row.need .ttl")].map((x) => x.textContent);
    ok(needs.length > 0 && needs.length <= 5 && /Anthony Ruiz/.test(needs[0] + d.querySelector(".next-call").textContent) && d.querySelectorAll("#app .btn.pri").length === 1, "at most five people, Anthony (unhoused, urgent note) at the top, one primary button");
    ok(ev("RXC.priorities(RXC.byId('a-anthony')).some(r=>r.kind==='housing') && RXC.priorities(RXC.byId('a-anthony'))[0].w >= 50"), "priorities come from fixed record rules with weights"); }
  ok(/John Doe/.test(d.querySelector(".side .profile").textContent) && d.querySelector(".side .nav[aria-current=page]").textContent.includes("Today"), "sidebar shows the profile card and the active page");
  ok(d.querySelectorAll(".side .navlist .nav").length === 4 && d.querySelectorAll(".tabs .nav").length === 5, "sidebar has 4 places (with Resources); phone tab bar adds Sign out");

  console.log("alumni and calendar");
  await go("#/alumni");
  const mine = ev("RXC.mine().length");
  ok(d.querySelectorAll("#alist tbody tr").length === mine && d.querySelectorAll("#alist thead th").length === 8 && d.querySelector('#alist th[aria-sort="descending"]').textContent.startsWith("Needs"), "caseload table shows all " + mine + " of John's alumni, most in need first");
  ev("RXV.sortBy('name')"); ok([...d.querySelectorAll("#alist tbody .nm")].map((x) => x.textContent).join() === [...d.querySelectorAll("#alist tbody .nm")].map((x) => x.textContent).sort().join() && d.querySelector('#alist th[aria-sort="ascending"]').textContent.startsWith("Name"), "sorting by name works and says so"); ev("RXV.sortBy('needs')");
  ev("RXV.search('marcus')"); ok(d.querySelectorAll("#alist tbody tr").length === 1, "search narrows the list");
  ev("RXV.search('zzz')"); ok(/No one matches/.test(d.getElementById("alist").textContent), "empty search says so");
  ev("RXV.search('')"); ev("RXV.setStage('stable')"); await sleep(20); ok(d.querySelectorAll("#alist tbody tr").length === ev("RXC.mine().filter(a=>a.stage==='stable').length"), "stage filter works");
  ev("RXV.setStage('all')");
  await go("#/calendar"); ok(/Calendar/.test(txt()) && d.querySelectorAll(".group .row").length > 0, "calendar groups events by day");

  console.log("case page and resources");
  await go("#/case/a-marcus"); await sleep(120);
  ok(/Marcus Johnson/.test(d.querySelector(".ltitle").textContent) && /Housing/.test(txt()) && /Supervision/.test(txt()) && /Tasks/.test(txt()) && /Notes/.test(txt()) && !/\bStatus\b/.test(d.getElementById("p-profile").textContent) && !d.querySelector("#p-tasks > .gh:first-child"), "case page has the profile facts, tasks and notes, with no heading repeating its tab name");
  ok(d.querySelector('#t-overview[aria-selected="true"]') && !d.getElementById("p-overview").hidden && /Resource plan/.test(d.getElementById("agov-a-marcus").textContent) && /Build plan/.test(d.getElementById("agov-a-marcus").textContent), "case opens on Overview, led by the resource plan card");
  d.getElementById("t-overview").dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  ok(d.querySelector('#t-resources[aria-selected="true"]') && d.activeElement === d.getElementById("t-resources") && !d.getElementById("p-resources").hidden, "arrow keys move between tabs");
  ev("RXV.tab('a-marcus','overview')");
  ok(d.querySelector(".back") && /Calendar/.test(d.querySelector(".back").textContent), "back button returns to where you came from");
  const addNote = [...d.querySelectorAll(".row.add")].find((b) => /Add call notes/.test(b.textContent));
  ok(addNote && addNote.closest(".group").previousElementSibling.textContent.includes("Notes") && addNote === addNote.parentNode.firstElementChild, "Notes section starts with an Add call notes row");
  addNote.click(); await sleep(30);
  ok(d.getElementById("sheet").hasAttribute("open") && d.getElementById("sheetTitle").textContent === "Call notes", "it opens the call notes sheet");
  ev("RXV.close()"); await sleep(10);
  const rq = requests.filter((u) => u.startsWith("/api/resources"));
  ok(rq.length === 1 && rq[0].includes("zip=94607") && ev("RXC.CATS.every(c=>c.needs.every(n=>" + JSON.stringify(rq[0]) + ".includes(n)))") && rq.every((u) => !/Marcus|Johnson|curfew/i.test(u)), "one resources request with the ZIP and every category, no names");
  ev("RXV.tab('a-marcus','resources')"); /* the case page opens on Overview; resources live in their own tab */
  ok(!d.getElementById("p-resources").hidden && d.getElementById("p-overview").hidden && d.querySelector('#t-resources[aria-selected="true"]'), "the Resources tab shows the resources panel");
  const R0 = "#res-a-marcus ";
  ok(d.querySelectorAll(R0 + ".row.cat").length === 7 && !d.querySelector(R0 + ".res") && !d.querySelector(R0 + ".needs"), "resources start as 7 closed categories, nothing chosen automatically");
  const housingBtn = () => [...d.querySelectorAll(R0 + ".row.cat")].find((b) => /Housing and shelter/.test(b.textContent));
  ok(/2/.test(housingBtn().querySelector(".trail").textContent), "each category shows its count");
  housingBtn().click(); await sleep(20);
  ok(housingBtn().getAttribute("aria-expanded") === "true" && d.querySelectorAll(R0 + ".catbody .res").length === 2, "tapping a category opens its local resources");
  const row = d.querySelector(R0 + ".catbody .res");
  ok(row.querySelector(".nm a[target=_blank] .ext") && row.querySelector(".sum") && /[.!?]$/.test(row.querySelector(".sum").textContent) && row.querySelectorAll(".ln").length === 2 && row.querySelector('.ln a[href^="tel:"]'), "a resource row is title link with arrow, one sentence, address, phone");
  ok(!/\bmi\b|Official|Directory|Curated|Test source/.test(row.textContent.replace(row.querySelector(".tas").textContent, "")), "rows leave out distance, trust and source");
  ok(row.querySelector(".tas .ta") && /Recommend to Marcus/.test(row.querySelector(".tas").textContent) && /Not relevant/.test(row.querySelector(".tas").textContent), "case manager actions are one line of text actions");
  housingBtn().click(); await sleep(20);
  ok(!d.querySelector(R0 + ".catbody"), "tapping again closes it");
  const q = d.getElementById("rq-a-marcus"); q.focus(); q.value = "housing authority"; q.dispatchEvent(new w.Event("input")); await sleep(20);
  ok(d.querySelectorAll(R0 + ".res").length === 1 && /Oakland Housing Authority/.test(d.querySelector(R0 + ".res").textContent) && d.querySelectorAll(R0 + ".row.cat").length === 1, "search shows only matches, under their open category");
  ok(d.activeElement === d.getElementById("rq-a-marcus"), "search box keeps focus while typing");
  q.value = "glasses"; q.dispatchEvent(new w.Event("input")); await sleep(20);
  ok(/Nothing matches “glasses”/.test(d.getElementById("rl-a-marcus").textContent), "no match says so and offers the categories");
  q.value = ""; q.dispatchEvent(new w.Event("input")); await sleep(20);
  ok(!d.querySelector(R0 + ".res") && d.querySelectorAll(R0 + ".row.cat").length === 7, "clearing the search returns to closed categories");
  ev("RXV.res('pin','a-marcus','nat-bankon')"); await sleep(20);
  ok(/Your recommendations/.test(d.getElementById("rl-a-marcus").textContent) && /Bank On certified accounts/.test(d.querySelector(R0 + ".res.pinned").textContent), "recommending adds it to a group above the categories");

  console.log("pre-call briefing");
  ev("RXV.brief('a-marcus')"); await sleep(150);
  ok(w.location.hash === "#/briefing/a-marcus" && d.querySelector(".bar .back").getAttribute("href") === "#/case/a-marcus" && /Back to Marcus Johnson/.test(d.querySelector(".bar .back").textContent), "briefing is its own page with a back link to the case");
  ok(/day 26, staying with his sister/.test(d.getElementById("bSnap").textContent), "snapshot sentence is the large line");
  ok(/Drafted by Claude/.test(d.getElementById("bStatus").textContent) && /need a check|needs a check/.test(d.getElementById("bStatus").textContent), "status says AI draft and counts lines to check");
  ok(/No source/.test(d.getElementById("bBody").textContent), "a line citing a missing source is marked No source");
  ok(/He applied to 2 jobs/.test(d.getElementById("bBody").textContent), "a line with a number found in its source passes");
  const cite = d.querySelector("#bBody .cite"); cite.click(); await sleep(10);
  ok(d.querySelector("#bBody .srcbox") && cite.getAttribute("aria-expanded") === "true", "tapping a source shows its exact text");
  const fb = d.querySelector(".flagbtn"); fb.click(); ok(fb.getAttribute("aria-pressed") === "true" && /1 line flagged/.test(d.getElementById("bFlags").textContent), "flag as wrong is counted");
  ok(/Resource R1/.test(ev("RXC.sources(RXC.byId('a-marcus')).map(s=>s.label).join('|')")), "recommended resource becomes a briefing source (R1)");
  claudeMode = "fail"; ev("RXV.regen('a-marcus')"); await sleep(150);
  ok(/Auto-digest from the record \(no AI\)/.test(d.getElementById("bStatus").textContent) && d.querySelectorAll("#bBody .bl").length > 2, "if Claude fails, a no-AI digest is shown and labeled");
  claudeMode = "ok"; ev("RXV.regen('a-marcus')"); await sleep(150);
  ok(/Talk about/.test(d.getElementById("bBody").textContent) && d.querySelector("#bBody .num"), "talking points are numbered");
  const start = [...d.querySelectorAll("a.btn")].find((x) => /Start call/.test(x.textContent));
  ok(start && start.getAttribute("href") === "tel:5105550200", "Start call dials the alumnus");
  ev("RXV.startCall('a-marcus')"); await sleep(20);
  ok(d.getElementById("sheet").hasAttribute("open") && d.getElementById("sheetTitle").textContent === "Call notes", "Start call also opens call notes");
  ev("RXV.close()"); let printed = 0; w.print = () => printed++; ev("RXV.print()");
  ok(printed === 1, "Print sheet prints");
  ev("RXV.corrections('a-marcus')"); await sleep(10);
  const cf = d.querySelector("#sheetBody .flagbtn"); cf.click();
  ok(/Flag corrections/.test(d.getElementById("sheetTitle").textContent) && /line(s)? flagged/.test(d.getElementById("cfCount").textContent), "Flag corrections lists every line with a Wrong? toggle");
  ev("RXV.close()");

  console.log("call notes");
  ev("RXV.notes('a-marcus')"); d.getElementById("nt").value = "Talked with Marcus. He moved into Hope House on Monday."; ev("RXV.draft('a-marcus')"); await sleep(120);
  const checks = [...d.querySelectorAll("#nd .check")];
  ok(checks.length === 2 && checks[0].getAttribute("aria-checked") === "true" && checks[1].getAttribute("aria-checked") === "false", "change with a real quote is checked; one with a made-up quote is unchecked");
  ok(/Approve 1 change/.test(d.getElementById("approveBtn").textContent), "approve button counts checked changes");
  const notesBefore = ev("RXC.byId('a-marcus').notes.length");
  ev("RXV.approve('a-marcus')"); await sleep(40);
  ok(ev("RXC.byId('a-marcus').housing.status") === "transitional" && ev("RXC.byId('a-marcus').phone") === "(510) 555-0200" && ev("RXC.byId('a-marcus').notes.length") === notesBefore + 1, "only the checked change is saved, with the note");
  d.querySelector("#toast button").click(); await sleep(20);
  ok(ev("RXC.byId('a-marcus').housing.status") === "family" && ev("RXC.byId('a-marcus').notes.length") === notesBefore, "Undo restores the record");

  console.log("tasks across both sign-ins");
  await go("#/case/a-marcus"); ev("RXV.assign('a-marcus')"); d.getElementById("tt").value = "Bring pay stubs to Hope House"; ev("RXV.assignGo()"); await sleep(30);
  ok(/Bring pay stubs to Hope House/.test(txt()), "assigned task shows on the case");
  ev("RXV.signOut()"); await sleep(30); ok(/Sign in as/.test(txt()), "sign out returns to sign-in");
  ev("RXV.signIn('alumnus')"); await sleep(60);
  ok(/Hi, Marcus/.test(txt()) && /1 task to do|tasks to do/.test(txt()), "Marcus's home shows his tasks");
  ok(d.querySelector(".next-step") && /Your next step/.test(d.querySelector(".next-step").textContent) && /Hope House/.test(d.querySelector(".next-step .ns-t").textContent) && /This week/.test(txt()) && d.querySelector('a[href^="mailto:"]'), "home leads with one next step, then this week and a way to email John");
  ok(d.querySelector('.side .nav[href="#/me/tasks"] .count'), "Tasks nav shows a count");
  await go("#/me/tasks");
  const tid = ev("RXC.byId('a-marcus').tasks.find(t=>t.title==='Bring pay stubs to Hope House').id");
  ev("RXV.toggle('a-marcus','" + tid + "')"); await sleep(20);
  ok(ev("RXC.byId('a-marcus').tasks.find(t=>t.id==='" + tid + "').doneBy") === "alumnus", "Marcus marks it done");
  await go("#/me/resources"); await sleep(80);
  ok(/Recommended by John Doe/.test(txt()) && d.querySelector(".res").classList.contains("pinned"), "Marcus sees John's recommendation first");
  ok(/Recommended for you/.test(txt()) && d.querySelectorAll(".row.cat").length === 7, "Marcus sees recommendations on top, then closed categories");
  ev("RXV.res('save','a-marcus','pha-1')"); await sleep(10);
  [...d.querySelectorAll(".row.cat")].find((b) => /Housing/.test(b.textContent)).click(); await sleep(20);
  const pr = [...d.querySelectorAll(".catbody .res")].find((e) => /Oakland Housing Authority/.test(e.textContent));
  ok(/✓ Saved/.test(pr.querySelector(".tas").textContent) && /I used this/.test(pr.querySelector(".tas").textContent) && !pr.querySelector(".st"), "Save turns into ✓ Saved; alumni see no status line");
  ev("RXV.res('used','a-marcus','pha-1')"); await sleep(10);
  ok(ev("RXC.byId('a-marcus').resourceActions['pha-1'].used") === true, "Marcus can save and mark a resource used");
  ev("RXV.signOut()"); ev("RXV.signIn('john')"); await go("#/case/a-marcus"); await sleep(60);
  ok(/done by Marcus/.test(txt()), "John sees the task done by Marcus");
  [...d.querySelectorAll("#res-a-marcus .row.cat")].find((b) => /Housing/.test(b.textContent)).click(); await sleep(20);
  ok(/Marcus used this/.test(d.getElementById("rl-a-marcus").textContent), "John sees which resource Marcus used");
  const before = requests.length; ev("RXC.Res.setZip(RXC.byId('a-marcus'),'77002'); RXC.loadResources(RXC.byId('a-marcus'))"); await sleep(40);
  ok(requests.length === before + 1 && requests[requests.length - 1].includes("zip=77002") && ev("RXC.rank(RXC.byId('a-marcus'), RXC.resState(RXC.byId('a-marcus')).data.items).some(r=>r.id==='nat-bankon'&&r.act.pinnedBy)"), "a new ZIP refetches and keeps the recommendation");
  ev("RXC.Res.setZip(RXC.byId('a-marcus'),'94607')");

  console.log("handoff");
  const other = ev("RXC.mine().find(a=>a.id!=='a-marcus').id");
  ev("RXV.handoff('" + other + "')"); d.getElementById("ht").value = "jane"; d.getElementById("hn").value = "Prefers texts. Court date next week."; ev("RXV.handoffGo('" + other + "')"); await sleep(60);
  ok(!ev("RXC.mine().some(a=>a.id==='" + other + "')"), "handed-off case leaves John's caseload");
  ev("RXV.signOut()"); ev("RXV.signIn('jane')"); await sleep(30);
  ok(ev("RXC.mine().some(a=>a.id==='" + other + "')") && /Handoff from John Doe to Jane Doe/.test(ev("RXC.byId('" + other + "').notes.slice(-1)[0].text")), "Jane has the case with the handoff note");


  console.log("new controls");
  ev("RXV.signOut()"); ev("RXV.signIn('john')"); await sleep(40);
  await go("#/briefing/a-marcus"); await sleep(150);
  ok(/0 of 2 ready/.test(d.getElementById("bBody").textContent), "check before the call starts at 0 of 2 ready");
  { const hs = [...d.querySelectorAll("#bBody .gh h2, #bBody details.ctx summary .ttl")].map((x) => x.textContent);
    ok(hs[0] === "Resolve before the call" && hs.indexOf("Talk about") > 0 && hs[hs.length - 1] === "Context" && !d.querySelector("#bBody details.ctx").open && /Record checks/.test(d.querySelector(".brief-side").textContent) && /At a glance/.test(d.querySelector(".brief-side").textContent), "briefing reads resolve → talk about → collapsed context, with at-a-glance facts and record checks in the side rail"); }
  d.querySelector("#bBody .check.sq").click(); await sleep(5);
  ok(/1 of 2 ready/.test(d.getElementById("ckCount").textContent), "ticking an item updates the count");
  await go("#/today");
  ev("RXV.assign()"); await sleep(10);
  ok(d.getElementById("pk") && d.getElementById("pk").tagName === "SELECT", "Assign task from Today asks which alumnus");
  d.getElementById("pk").value = "a-darnell"; d.getElementById("pk").dispatchEvent(new w.Event("change")); await sleep(10);
  d.getElementById("tt").value = "Bring your forklift card"; ev("RXV.assignGo()"); await sleep(20);
  ok(ev("RXC.byId('a-darnell').tasks.some(t=>t.title==='Bring your forklift card')"), "the task goes to the alumnus picked");
  ev("RXV.notes()"); await sleep(10); d.getElementById("nt").value = "Draft words"; d.getElementById("nt").dispatchEvent(new w.Event("input")); ev("RXV.close()"); await sleep(10);
  ok(/Draft saved/.test(txt()), "Today shows a saved draft on Add call notes");
  ev("RXV.notes('" + ev("RXC.mine()[0].id") + "')"); await sleep(10);
  ok(d.getElementById("nt").value === "Draft words" && /Draft restored/.test(d.getElementById("draftState").textContent), "reopening restores the draft");
  ev("RXV.discard('" + ev("RXC.mine()[0].id") + "')"); await sleep(10);
  ev("RXV.account()"); await sleep(10);
  ok(/Account/.test(d.getElementById("sheetTitle").textContent) && /\d+ alumni/.test(d.getElementById("sheetBody").textContent), "profile card opens the account sheet");
  ev("RXV.close()");
  await go("#/calendar"); await sleep(20);
  ok(!d.querySelector(".week") && !d.querySelector("#content .cite-badge") && !d.querySelector("#content .row.add") && d.querySelectorAll(".agenda .dayh").length > 0 && [...d.querySelectorAll(".agenda .dayh")].map((x) => x.id).join() === [...d.querySelectorAll(".agenda .dayh")].map((x) => x.id).sort().join(), "calendar is one agenda grouped by day, in date order: no week strip, per-day add rows or record IDs");
  ok([...d.querySelectorAll(".cal-row")].every((r) => !r.querySelector(".btn") || /Briefing/.test(r.querySelector(".btn").textContent)) && d.querySelectorAll(".cal-row .btn").length < d.querySelectorAll(".cal-row").length, "Briefing shows only on calls in the next 48 hours");
  const allRows = d.querySelectorAll(".cal-row").length; ev("RXV.calFilter('calls')"); await sleep(10);
  ok(d.querySelectorAll(".cal-row").length < allRows && [...d.querySelectorAll(".cal-row")].every((x) => /Check-in call/.test(x.textContent)), "Check-in calls filter narrows the list");
  ev("RXV.calFilter('all')"); await sleep(10);
  [...d.querySelectorAll("#content .btn")].find((b) => /New event/.test(b.textContent)).click(); await sleep(10);
  ok(d.getElementById("pk") && d.getElementById("pk").tagName === "SELECT" && /^\d{4}-\d{2}-\d{2}$/.test(d.getElementById("ed").value), "New event asks which alumnus and suggests a date");
  ev("RXV.close()");
  await go("#/resources"); await sleep(60);
  ok(d.getElementById("rfor") && d.getElementById("rfor").value === "a-marcus", "Resources page picks the last case opened");
  ok(!d.querySelector(".res-index") && d.querySelector(".forbar #rfor") && d.querySelectorAll(".bar .t").length === 0, "Resources page: one column, no category index repeating the list, no title repeated in the top bar");
  d.getElementById("rfor").value = "a-darnell"; d.getElementById("rfor").dispatchEvent(new w.Event("change")); await sleep(60);
  [...d.querySelectorAll("#res-a-darnell .row.cat")].find((b) => /Housing/.test(b.textContent)).click(); await sleep(10);
  ok(/Recommend to Darnell/.test(d.getElementById("res-a-darnell").textContent), "changing the picker switches who you recommend for");
  ev("RXV.res('pin','a-darnell','hc-1')"); await sleep(10);
  const rp = [...d.querySelectorAll(".res.pinned .ta")].find((x) => /Remove pin/.test(x.textContent));
  ok(!!rp, "a recommendation shows Remove pin"); rp.click(); await sleep(10);
  ok(!ev("(RXC.byId('a-darnell').resourceActions['hc-1']||{}).pinnedBy"), "Remove pin unpins it");


  console.log("appearance");
  const root = d.documentElement, tb = () => d.querySelector(".bar .iconbtn");
  ok(!root.hasAttribute("data-theme") && /dark mode/.test(tb().getAttribute("aria-label")), "starts by following the device, with a switch-to-dark button");
  tb().click(); await sleep(10);
  ok(root.getAttribute("data-theme") === "dark" && /light mode/.test(tb().getAttribute("aria-label")) && /Dark mode on/.test(d.getElementById("toast").textContent), "the top-bar button switches to dark");
  tb().click(); await sleep(10);
  ok(root.getAttribute("data-theme") === "light", "and back to light");
  ev("RXV.account()"); await sleep(10);
  const sys = [...d.querySelectorAll('#sheet .seg[aria-label="Appearance"] button')].find((b) => b.textContent === "System"); sys.click(); await sleep(10);
  ok(!root.hasAttribute("data-theme") && d.querySelector('#sheet .seg[aria-label="Appearance"] [aria-pressed=true]').textContent === "System", "Account › Appearance can go back to System");
  ev("RXV.close()"); ev("RXV.signOut()"); await sleep(20);
  ok(d.querySelector(".signin-theme"), "the sign-in screen has the switch too");
  ev("RXV.signIn('john')"); await sleep(30);
  const css2 = fs.readFileSync(path.join(__dirname, "..", "demo", "app.css"), "utf8");
  ok(/:root\[data-theme="dark"\]\s*\{[^}]*--bg:\s*#0C0A09/.test(css2) && /:root:not\(\[data-theme="light"\]\)/.test(css2), "dark styles apply when forced, and follow the device unless light is forced");


  console.log("AI deep search (Nikhil's agents, mocked)");
  const prof = ev("JSON.stringify(RXC.toAgentProfile(RXC.byId('a-marcus'), {county:'Alameda County', lat:37.8, lon:-122.27}))"), P = JSON.parse(prof);
  ok(P.county === "Alameda" && P.supervision.type === "parole" && P.supervision.curfew === "10pm" && P.supervision.county_restriction === "Alameda" && P.housing_status === "family_or_friends" && P.days_since_release === 26, "profile adapter maps Marcus's record");
  ok(!("monthly_income" in P) && !("gender" in P) && !("household_size" in P) && P.offense_categories.length === 0, "fields our record doesn't have are left unset, never guessed");
  ok(["housing", "health", "food_benefits", "jobs", "legal_id", "family", "clothing"].every((c) => ev("RXC.AG_NEED")[c]), "every agent category maps to one of our needs");
  ev("RXV.signOut()"); ev("RXV.signIn('alumnus')"); await go("#/me/resources"); await sleep(60);
  ok(!d.getElementById("ag-a-marcus"), "alumni never see the AI search");
  ev("RXV.signOut()"); ev("RXV.signIn('john')"); await go("#/case/a-marcus"); await sleep(80);
  const agBtn = () => [...d.querySelectorAll("#ag-a-marcus button")].find((b) => /Build plan/.test(b.textContent));
  ok(agBtn() && !agBtn().disabled, "the case page offers Build plan for a California ZIP");
  agBtn().click(); await sleep(10);
  ok(d.getElementById("sheet").hasAttribute("open") && /90 seconds/.test(d.getElementById("sheetBody").textContent) && /Nothing is saved/.test(d.getElementById("sheetBody").textContent), "it asks first, saying how long it takes and that nothing is saved");
  agentSlow = 40; ev("RXV.agentRun('a-marcus')"); await sleep(30);
  ok(/AI plan/.test(d.getElementById("ag-a-marcus").textContent) && /searching/.test(d.getElementById("ag-a-marcus").textContent) && /Reading the record/.test(d.getElementById("ag-a-marcus").textContent), "progress panel shows the stages");
  [...d.querySelectorAll("#ag-a-marcus button")].find((b) => b.textContent === "Cancel").click(); await sleep(150);
  ok(agBtn() && ev("RXV.agent['a-marcus'].status") === "idle", "Cancel stops the run");
  agentSlow = 0; agentFailFinder = "health"; agentCalls.length = 0;
  ev("RXV.agentRun('a-marcus')"); await sleep(400);
  const agTxt = () => d.getElementById("ag-a-marcus").textContent;
  ok(ev("RXV.agent['a-marcus'].status") === "done" && /AI plan/.test(agTxt()) && /Act today/.test(agTxt()), "the plan renders with Act today");
  ok(/Act today/.test(d.getElementById("agov-a-marcus").textContent) && d.querySelectorAll("#agov-a-marcus .pick").length > 0 && /Open full plan/.test(d.getElementById("agov-a-marcus").textContent), "Overview summarises the plan: Act today and a top pick per need");
  const aiRows = () => [...d.querySelectorAll("#ag-a-marcus .row.cat")].map((b) => b.querySelector(".ttl").textContent);
  ok(JSON.stringify(aiRows()) === JSON.stringify(["Act today", "Housing and shelter", "ID and documents", "Legal and records", "Phone and banking", "Food and benefits", "Health", "Jobs and training", "Not eligible"]), "AI results sit in our categories, most urgent first: " + aiRows().join(", "));
  ok(d.querySelectorAll("#ag-a-marcus .catbody").length === 1 && d.querySelector("#ag-a-marcus .catbody.steps") && /Today/.test(d.querySelector("#ag-a-marcus .row.cat:nth-of-type(2)").textContent), "Act today starts open; the categories start closed, with urgency tags");
  ok(/California DMV no-fee ID/.test(ev("JSON.stringify(RXC.agentGroups(RXV.agent['a-marcus'].plan).cats.find(c=>c.id==='id').items.map(e=>e.c.name))")) && /Bank On/.test(ev("JSON.stringify(RXC.agentGroups(RXV.agent['a-marcus'].plan).cats.find(c=>c.id==='money').items.map(e=>e.c.name))")), "keyword rules put the DMV ID in ID and documents and Bank On in Phone and banking");
  const aiOpen = (label) => [...d.querySelectorAll("#ag-a-marcus .row.cat")].find((b) => b.querySelector(".ttl").textContent === label).click();
  { const st = [...d.querySelectorAll("#ag-a-marcus .catbody.steps .step")], titles = st.map((x) => x.querySelector(".st").textContent);
    ok(st.length === 4 && /CalFresh/.test(titles[0]) && titles.slice(1).every((t) => !/CalFresh|Medi-Cal/i.test(t)), "Act today: the open CalFresh step from the tile first, then the 3 AI steps: " + titles.join(" | "));
    ok(st.every((x) => x.querySelector('.acts a[href^="tel:"], .acts a[href^="https:"], .acts a[href^="http:"]')), "every step has a number to call or a link to open");
    ok(!titles.some((t) => /CalFresh/i.test(t) && /Medi-Cal/i.test(t)) && titles.every((t) => t.split(/\s+/).length <= 8), "one action per step (CalFresh and Medi-Cal never together), titles 8 words or fewer");
    ok(st[0].querySelector('a[href="tel:+18889994772"]') && [...st[0].querySelectorAll(".acts button")].some((b) => /See CalFresh/.test(b.textContent)), "the CalFresh step calls Alameda County and opens the CalFresh tile");
    ok(st[2].querySelector('a[href="tel:211"]'), "short numbers like 211 dial as they are"); }
  aiOpen("Act today"); await sleep(10);
  ok(!d.querySelector("#ag-a-marcus .catbody.steps"), "Act today closes on tap");
  aiOpen("Housing and shelter"); await sleep(10);
  ok(d.querySelectorAll("#ag-a-marcus .catbody .res").length === 3, "opening a category shows its AI results");
  ok(/General resources/.test(d.getElementById("rl-a-marcus").textContent) && d.querySelectorAll("#rl-a-marcus > .group .row.cat").length >= 7, "instant resources sit under General resources");
  ok(agentCalls.filter((c) => c.stage === "finder").length === 5 && agentCalls[0].stage === "intake" && agentCalls[0].profile.display_name === "Marcus" && !JSON.stringify(agentCalls[0]).includes("Johnson"), "runs intake, orchestrator, 5 finders, judges and ranker, sending the first name only");
  ok(/health search \(search failed\)/.test(agTxt()), "a finder that fails is reported and the rest carry on");
  ok(/Likely eligible|Worth applying/.test(agTxt()) && /Bring:/.test(agTxt()), "results show eligibility and what to bring (case manager)");
  { const card = d.querySelector("#ag-a-marcus .res.ai"); ok(card && card.querySelector(".nm .tag") && card.querySelector("details.more") && !card.querySelector("details.more").open && /Bring:/.test(card.querySelector("details.more").textContent), "AI cards show name, verdict and why; Bring, rule and source sit behind Details"); }
  const exBtn = [...d.querySelectorAll("#ag-a-marcus .row.cat")].find((b) => /Not eligible/.test(b.textContent)); exBtn.click(); await sleep(10);
  ok(/Not eligible/.test(agTxt()) && d.querySelector("#ag-a-marcus .catbody"), "not-eligible results open with their reasons");
  const rec = [...d.querySelectorAll("#ag-a-marcus .ta")].find((b) => /Recommend to Marcus/.test(b.textContent)), recName = rec.closest(".res").querySelector(".nm").textContent.replace(" (opens in a new tab)", "").trim();
  rec.click(); await sleep(20);
  ok(/Recommended to Marcus/.test(d.getElementById("toast").textContent) && /Your recommendations/.test(d.getElementById("rl-a-marcus").textContent), "recommending an AI result adds it to the recommendations");
  ok(/AI search/.test(ev("RXC.sources(RXC.byId('a-marcus')).filter(s=>/^R\\d/.test(s.id)).map(s=>s.text).join('|')")), "it becomes a briefing source too");
  ev("RXV.signOut()"); ev("RXV.signIn('alumnus')"); await go("#/me/resources"); await sleep(60);
  ok(d.getElementById("content").textContent.includes(recName.slice(0, 20)), "Marcus sees the AI result John recommended");
  ok(!/From John Doe/.test(d.getElementById("content").textContent) && !/General resources/.test(d.getElementById("content").textContent), "before sharing, Marcus has no AI section and his page is unchanged");
  ev("RXV.signOut()"); ev("RXV.signIn('john')"); await go("#/case/a-marcus"); await sleep(60);
  [...d.querySelectorAll("#ag-a-marcus button")].find((b) => /Share with Marcus/.test(b.textContent)).click(); await sleep(20);
  const nSteps = ev("RXV.agent['a-marcus'].plan.act_today.length"), tas = [...d.querySelectorAll('#sheetBody textarea[id^="st"]')], dets = [...d.querySelectorAll('#sheetBody textarea[id^="sl"]')];
  ok(d.getElementById("sheet").hasAttribute("open") && /Share with Marcus/.test(d.getElementById("sheetTitle").textContent) && tas.length === nSteps && dets.length === nSteps && tas.concat(dets).every((t) => !/\b(he|his|him)\b/i.test(t.value)) && tas.every((t) => t.value), "Share opens a review of each step (title and details), written to Marcus (you), before anything is shared");
  ok(/CalFresh and Medi-Cal steps come first/.test(d.getElementById("sheetBody").textContent) && /Call 211/.test(d.getElementById("sheetBody").textContent), "the share sheet says the benefit steps come first and shows each step's link");
  tas[0].value = "Call Hope House today and ask if your bed is confirmed."; if (nSteps > 1) d.getElementById("so1").checked = false;
  d.querySelector("#sheetFoot .btn.pri").click(); await sleep(20);
  ok(/Shared with Marcus/.test(d.getElementById("toast").textContent) && /Unshare/.test(d.getElementById("ag-a-marcus").textContent) && /Edit steps/.test(d.getElementById("ag-a-marcus").textContent), "John shares the reviewed steps, and can edit them later");
  ok(ev("RXC.byId('a-marcus').aiShared.steps.length") === Math.max(1, nSteps - 1) && ev("RXC.byId('a-marcus').aiShared.steps[0].text") === "Call Hope House today and ask if your bed is confirmed.", "his edit and the step he left out are kept");
  ev("RXV.signOut()"); ev("RXV.signIn('alumnus')"); await go("#/me"); await sleep(20);
  ok(/resources found for you by AI/.test(txt()), "Marcus's home says AI results were shared");
  ok(/Call Hope House today and ask if your bed is confirmed\./.test(d.querySelector(".next-step .ns-t").textContent) && /Step 1 of/.test(d.querySelector(".next-step").textContent), "Marcus's next step is the first step from John's plan");
  [...d.querySelectorAll(".next-step button")].find((b) => /Mark done/.test(b.textContent)).click(); await sleep(20);
  ok(ev("RXC.byId('a-marcus').aiShared.steps[0].done") === true && !/Call Hope House today and ask/.test(d.querySelector(".next-step .ns-t").textContent), "marking it done moves him to the next step");
  await go("#/me/resources"); await sleep(60);
  const mTxt = () => d.getElementById("content").textContent;
  ok(/From John Doe/.test(mTxt()) && /found by AI/.test(mTxt()) && /General resources/.test(mTxt()), "Marcus sees From John Doe above General resources");
  ok(/Your steps/.test(mTxt()) && mTxt().indexOf("Your steps") < mTxt().indexOf("From John Doe"), "his Resources page starts with his steps, in order");
  const mRows = [...d.querySelectorAll(".row.cat")].map((b) => b.querySelector(".ttl").textContent);
  ok(mRows.indexOf("Act today") < 0 && mRows.indexOf("Not eligible") < 0 && mRows.filter((x) => x === "Housing and shelter").length === 2, "same categories for Marcus, without the staff-voiced Act today or the Not eligible list");
  [...d.querySelectorAll(".row.cat")].find((b) => b.querySelector(".ttl").textContent === "Housing and shelter").click(); await sleep(10);
  const mBody = d.querySelector(".catbody").textContent;
  ok(/Bring:/.test(mBody) && !/Likely eligible|Worth applying|Confirm:|Rule:/.test(mBody), "Marcus sees what to bring, not eligibility notes");
  ok(![...d.querySelectorAll(".catbody .ln")].some((l) => /^Bring:.*\b(his|her)\b/i.test(l.textContent)), "what to bring is written to Marcus (your), not about him");
  const sv = [...d.querySelectorAll(".catbody .ta")].find((b) => b.textContent === "Save"); sv.click(); await sleep(10);
  ok(/Saved/.test(d.getElementById("toast").textContent), "Marcus can save an AI result");
  ev("RXV.signOut()"); ev("RXV.signIn('john')"); await go("#/case/a-marcus"); await sleep(60);
  const hb = [...d.querySelectorAll("#ag-a-marcus .row.cat")].find((b) => b.querySelector(".ttl").textContent === "Housing and shelter"); if (hb.getAttribute("aria-expanded") !== "true") hb.click(); await sleep(10);
  ok(/Saved by Marcus/.test(d.getElementById("ag-a-marcus").textContent), "John sees what Marcus saved");
  [...d.querySelectorAll("#ag-a-marcus button")].find((b) => b.textContent === "Unshare").click(); await sleep(20);
  ok(!ev("!!RXC.byId('a-marcus').aiShared"), "Unshare removes it from Marcus's view");
  d.querySelector("#toast button").click(); await sleep(20);
  ok(ev("!!RXC.byId('a-marcus').aiShared"), "Undo puts it back");
  ev("RXV.agentRun('a-marcus')"); await sleep(400);
  ok(/Share this new plan/.test(d.getElementById("ag-a-marcus").textContent), "after a new run, John can share the new plan");
  ev("RXV.signOut()"); ev("RXV.signIn('john')"); await go("#/case/a-marcus"); await sleep(60);
  ev("RXC.Res.setZip(RXC.byId('a-marcus'),'77002'); RXV.agent['a-marcus']={status:'idle'}; RXC.loadResources(RXC.byId('a-marcus'), function(){})"); await sleep(40); await go("#/today"); await go("#/case/a-marcus"); await sleep(60);
  ok(agBtn() && agBtn().disabled && /California only/.test(d.getElementById("ag-a-marcus").textContent), "outside California the button is disabled with the reason");
  ev("RXC.Res.setZip(RXC.byId('a-marcus'),'94607')");

  console.log("benefits tiles and steps");
  ev("RXV.signOut()"); ev("RXV.signIn('john')"); await go("#/case/a-marcus"); ev("RXV.tab('a-marcus','resources')"); await sleep(60);
  const tiles = () => [...d.querySelectorAll("#rl-a-marcus .btile")];
  ok(tiles().length === 2 && /CalFresh/.test(tiles()[0].textContent) && /Medi-Cal/.test(tiles()[1].textContent), "Resources shows the CalFresh and Medi-Cal tiles");
  ok(/Interview done · result not recorded/.test(tiles()[0].textContent) && /Enrolled/.test(tiles()[1].textContent), "status comes from the record: interview result missing, Medi-Cal enrolled (task 4 done)");
  ok(d.getElementById("rl-a-marcus").textContent.indexOf("Benefits") < d.getElementById("rl-a-marcus").textContent.indexOf("AI plan"), "Benefits sit above the AI plan");
  tiles()[0].click(); await sleep(20);
  { const sb = () => d.getElementById("sheetBody").textContent;
    ok(d.getElementById("sheet").hasAttribute("open") && /CalFresh/.test(d.getElementById("sheetTitle").textContent) && /Likely eligible/.test(sb()) && /\$306/.test(sb()) && /\$2,660/.test(sb()) && d.querySelector('#sheetBody select'), "case manager sheet: status picker, what he can get, eligibility");
    ok([...d.querySelectorAll("#sheetBody .elig a")].length === 3 && [...d.querySelectorAll("#sheetBody .elig a")].every((a) => /^https:/.test(a.getAttribute("href")) && a.target === "_blank"), "each eligibility rule links to its source in a new tab");
    ok(d.querySelector('#sheetBody a[href="tel:+18889994772"]') && /Alameda County Social Services/.test(sb()), "next step calls Marcus's county office"); }
  ev("RXV.setBen('a-marcus','calfresh','approved')"); await sleep(20);
  ok(ev("RXC.byId('a-marcus').benefits.calfresh.status") === "approved" && ev("RXC.byId('a-marcus').tasks.filter(t=>t.std)[2].status") === "done" && /CalFresh: Approved/.test(d.getElementById("toast").textContent), "updating the status marks task 3 done too");
  ok(/Nothing to do right now/.test(d.getElementById("sheetBody").textContent) && /Approved/.test(tiles()[0].textContent), "the sheet and tile update in place");
  d.querySelector("#toast button").click(); await sleep(20);
  ok(ev("RXC.byId('a-marcus').benefits.calfresh.status") === "interview_done" && ev("RXC.byId('a-marcus').tasks.filter(t=>t.std)[2].status") === "in_progress", "Undo puts the status and the task back");
  ev("RXV.close()");
  /* Anthony: nothing started, so both programs get their own step */
  const an = ev("JSON.stringify(RXC.benefitTodaySteps(RXC.byId('a-anthony'),'cm'))"), AN = JSON.parse(an);
  ok(AN.length === 2 && /Apply for CalFresh/.test(AN[0].title) && /Medi-Cal/.test(AN[1].title) && !/Medi-Cal/.test(AN[0].title) && AN[0].links[0].href === "https://www.getcalfresh.org/" && AN[1].links[0].href === "tel:+18005415555", "Anthony gets separate CalFresh (apply online) and Medi-Cal (check enrollment) steps: " + AN.map((x) => x.title).join(" | "));
  ok(ev("RXC.benefitOffice(RXC.byId('a-anthony'),'calfresh').phone") === "(415) 558-1001" && ev("RXC.benefitOffice(RXC.byId('a-isaiah'),'calfresh').phone") === "(510) 412-3280" && ev("RXC.benefitOffice({loc:'Fresno, CA'},'medi_cal').phone") === "1-800-541-5555", "county office by city (SF, Richmond), statewide line when the county isn't mapped");
  /* ticking task 3 in the checklist keeps the tile in step */
  ev("RXC.toggleTask(RXC.byId('a-anthony'), RXC.byId('a-anthony').tasks.filter(t=>t.std)[2])");
  ok(ev("RXC.byId('a-anthony').benefits.calfresh.status") === "approved", "marking the CalFresh task done marks CalFresh approved");
  ev("RXC.toggleTask(RXC.byId('a-anthony'), RXC.byId('a-anthony').tasks.filter(t=>t.std)[2])");
  ok(ev("RXC.byId('a-anthony').benefits.calfresh.status") === "applied", "reopening it moves CalFresh back to applied");
  /* a step with no phone or link warns the case manager; an old one-paragraph step still shows */
  ok(ev("RXC.normStep({title:'Visit the clinic',how:'visit',bullets:[],missing_contact:true},'cm').missing") === true, "a step with no contact is flagged");
  ok(ev("RXC.normStep({step:'Sit with Marcus and apply.',for_alumnus:'Apply today.'},'me').title") === "Apply today." && ev("RXC.normStep({step:'x'},'cm').legacy") === true, "plans saved in the old format still show");
  ok(ev("RXC.phoneHref('311')") === "tel:311" && ev("RXC.phoneHref('(510) 649-1930')") === "tel:+15106491930", "tel: links for short codes and US numbers");
  /* the alumnus sees the same tiles, plain words, no verdicts */
  ev("RXV.signOut()"); ev("RXV.signIn('alumnus')"); await go("#/me/resources"); await sleep(60);
  { const at = [...d.querySelectorAll("#content .btile")];
    ok(at.length === 2 && /Waiting on a result/.test(at[0].textContent) && /You have it/.test(at[1].textContent), "Marcus sees both tiles in plain words");
    at[0].click(); await sleep(20);
    const sb = d.getElementById("sheetBody").textContent;
    ok(/Money for food/.test(sb) && /Was my CalFresh approved\?/.test(sb) && d.querySelector('#sheetBody a[href^="tel:"]') && !/Likely eligible|Confirm income|W&I|Eligibility|Update/.test(sb) && !d.querySelector("#sheetBody select"), "his sheet has steps and a number to call, with no verdicts, rules or status picker");
    ev("RXV.close()"); }
  { const ys = [...d.querySelectorAll("#content .step")].map((x) => x.querySelector(".st").textContent);
    ok(/Find out if your CalFresh was approved/.test(ys[0]) && ys.length >= 2, "his steps start with the live CalFresh step, then the shared ones: " + ys.join(" | ")); }
  ev("RXV.signOut()"); ev("RXV.signIn('john')");

  console.log("choosing what to search");
  agentFailFinder = ""; ev("RXV.signOut()"); ev("RXV.signIn('john')"); await go("#/case/a-marcus"); ev("RXV.tab('a-marcus','resources')"); await sleep(60);
  ev("delete RXC.byId('a-marcus').aiFocus; RXV.agent['a-marcus'] = {status:'idle'}");
  const boxes = () => [...d.querySelectorAll('#sheetBody input[id^="fc-"]')], fcCount = () => d.getElementById("fcCount").textContent;
  const tick = (ids) => { boxes().forEach((b) => { b.checked = ids.includes(b.value); }); ev("RXV.focusChange()"); };
  ev("RXV.agentAsk('a-marcus')"); await sleep(20);
  ok(boxes().length === 7 && boxes().every((b) => b.checked) && /5 of 5 searches/.test(fcCount()) && /What to search/.test(d.getElementById("sheetBody").textContent), "first plan: all 7 categories ticked, 5 searches");
  tick([]);
  ok(d.getElementById("fcGo").disabled && /Tick at least one category/.test(fcCount()), "with nothing ticked, Run search is disabled and says why");
  tick(["id", "legal", "money"]);
  ok(/1 of 5 searches/.test(fcCount()) && ev("RXC.focusFinders(['id','legal','money']).join()") === "legal_id", "ID, legal and banking together are one search");
  tick(["housing", "food", "id", "jobs", "health", "legal", "money"]); agentCalls.length = 0;
  d.getElementById("fcGo").click(); await sleep(400);
  ok(ev("RXV.agent['a-marcus'].status") === "done" && agentCalls.filter((c) => c.stage === "finder").length === 5 && !agentCalls.find((c) => c.stage === "orchestrator").focus, "a full search runs all 5 finders and sends no focus");
  /* pretend that full search happened on Oct 30, then re-run only Housing and Jobs */
  ev("RXV.agent['a-marcus'].plan.sections.forEach(function (s) { s.searched_at = '2026-10-30'; })");
  ev("RXV.agentAsk('a-marcus')"); await sleep(20); tick(["housing", "jobs"]);
  ok(/2 of 5 searches · fewer searches cost less/.test(fcCount()) && /keep their earlier results/.test(d.getElementById("sheetBody").textContent), "Housing and Jobs is 2 of 5 searches; the sheet says the rest are kept");
  agentCalls.length = 0; d.getElementById("fcGo").click(); await sleep(400);
  { const fs = agentCalls.filter((c) => c.stage === "finder").map((c) => c.brief.finder).sort(), oc = agentCalls.find((c) => c.stage === "orchestrator");
    ok(JSON.stringify(fs) === '["housing","jobs"]' && oc.focus && oc.focus.finders.join() === "housing,jobs", "only Housing and Jobs are searched, though the orchestrator returned all 5 briefs: " + fs.join(", ")); }
  ok(ev("RXC.byId('a-marcus').aiFocus.cats.join()") === "housing,jobs", "the choice is saved on Marcus's record");
  { const rows = [...d.querySelectorAll("#ag-a-marcus .row.cat")], txt = (l) => (rows.find((r) => r.querySelector(".ttl").textContent === l) || { textContent: "" }).textContent;
    const secs = ev("JSON.stringify(RXV.agent['a-marcus'].plan.sections.map(function (s) { return s.need.category + ':' + s.searched_at; }))");
    ok(/housing:2\d{3}-\d\d-\d\d/.test(secs) && secs.indexOf("health:2026-10-30") >= 0 && secs.indexOf("legal_id:2026-10-30") >= 0 && secs.indexOf("housing:2026-10-30") < 0, "Housing and Jobs are replaced; Health, Food and Legal are kept from Oct 30: " + secs);
    ok(!/Searched/.test(txt("Housing and shelter")) && rows.some((r) => /Searched Oct 30/.test(r.textContent)), "kept categories say “Searched Oct 30”; fresh ones don't"); }
  ok(/Last search: housing and jobs/.test(d.getElementById("agov-a-marcus").textContent), "the Overview card says what was searched last");
  ev("RXV.agentAsk('a-marcus')"); await sleep(20);
  ok(JSON.stringify(boxes().filter((b) => b.checked).map((b) => b.value)) === '["housing","jobs"]' && /last time's picks/.test(d.getElementById("sheetBody").textContent), "reopening the sheet starts from last time's picks");
  ev("RXV.close()");
  /* the merge on its own: no earlier plan, or everything searched, gives just the new plan */
  ok(ev("RXC.mergePlan(null, {sections:[{need:{category:'housing'}}]}, ['housing'], '2026-11-12').sections.length") === 1 &&
     ev("RXC.mergePlan({sections:[{need:{category:'jobs'}}]}, {sections:[{need:{category:'housing'}}]}, RXC.FINDERS, '2026-11-12').sections.length") === 1 &&
     ev("RXC.mergePlan({sections:[{need:{category:'jobs'}}],excluded:[{category:'jobs'},{category:'housing'}]}, {sections:[{need:{category:'housing'}}],excluded:[]}, ['housing'], 'd').excluded.length") === 1, "merge: new plan alone when nothing to keep; kept not-eligible entries follow their category");
  ev("RXV.agent['a-marcus'] = {status:'idle'}; delete RXC.byId('a-marcus').aiFocus"); /* back to the state the control crawl below expects */

  console.log("every control goes somewhere");
  const BAD = [], routes = ["#/today", "#/alumni", "#/calendar", "#/resources", "#/case/a-marcus", "#/briefing/a-marcus"];
  function snapState() { return [w.location.hash, [...d.querySelectorAll(".tabp:not([hidden])")].map((p) => p.id).join(), d.getElementById("sheet").hasAttribute("open"), d.getElementById("app").innerHTML.length, d.getElementById("sheet").innerHTML.length, d.getElementById("toast").textContent, d.getElementById("app").innerHTML.split("aria-").length, d.getElementById("app").innerHTML.split("true").length].join("|"); }
  function checkStatic(where) {
    d.querySelectorAll("#app a, #sheet a").forEach((x) => { const h = x.getAttribute("href") || ""; if (!/^(#\/|tel:|mailto:|https?:)/.test(h)) BAD.push(where + " link “" + x.textContent.trim().slice(0, 30) + "” → " + (h || "(none)")); });
    d.querySelectorAll("#app button, #sheet button").forEach((x) => { if (!x.getAttribute("onclick") && x.type !== "submit" && !x.disabled && x.getAttribute("aria-disabled") !== "true") BAD.push(where + " button “" + x.textContent.trim().slice(0, 30) + "” has no action"); if (x.disabled && !(x.title || x.textContent.trim())) BAD.push(where + " disabled button without a reason"); });
  }
  async function crawl(signin, list) {
    for (const r of list) {
      ev("RXV.signOut()"); ev("RXV.signIn('" + signin + "')"); await go(r); await sleep(r.includes("briefing") ? 150 : 60);
      checkStatic(r);
      const SEL = "#app button:not([disabled]):not([aria-disabled=true])", n = d.querySelectorAll(SEL).length;
      for (let i = 0; i < n; i++) {
        ev("RXV.close()"); if (w.location.hash !== r || !w.cur) { if (!w.cur) ev("RXV.signIn('" + signin + "')"); await go(r); await sleep(r.includes("briefing") ? 150 : 40); }
        const b = d.querySelectorAll(SEL)[i]; if (!b) continue;
        if (b.closest(".seg") && b.getAttribute("aria-pressed") === "true") continue; /* already-selected filter: nothing to change */
        if (b.getAttribute("role") === "tab" && b.getAttribute("aria-selected") === "true") continue; /* the tab already showing */
        if (/RXV\.print/.test(b.getAttribute("onclick") || "")) continue; /* opens the print dialog; checked above */
        const label = b.textContent.trim().slice(0, 30) || b.getAttribute("aria-label"), before = snapState(), errs = errors.length;
        b.click(); await sleep(30);
        if (d.getElementById("sheet").hasAttribute("open")) checkStatic(r + " › sheet “" + d.getElementById("sheetTitle").textContent + "”");
        if (errors.length > errs) BAD.push(r + " button “" + label + "” threw: " + errors.slice(errs).join(" "));
        else if (snapState() === before) BAD.push(r + " button “" + label + "” did nothing visible");
      }
    }
  }
  await crawl("john", routes);
  await crawl("alumnus", ["#/me", "#/me/tasks", "#/me/resources"]);
  ok(!BAD.length, "every link has a real destination and every button does something" + (BAD.length ? ":\n    " + BAD.slice(0, 15).join("\n    ") + (BAD.length > 15 ? "\n    …" + (BAD.length - 15) + " more" : "") : ""));

  console.log("type scale");
  const css = fs.readFileSync(path.join(__dirname, "..", "demo", "app.css"), "utf8");
  const small = [...css.replace(/\.tlm-tile \{[^}]*\}/g, "") /* the TLM logo mark is decorative (aria-hidden), not text */.matchAll(/(?:font-size|--fs-[a-z]+):\s*([\d.]+)(px|rem|em)/g)].filter((m) => (m[2] === "px" ? +m[1] < 12 : +m[1] < 0.75));
  ok(!small.length, "no font size under 12px (0.75rem) in app.css" + (small.length ? ": " + small.map((m) => m[0]).join(", ") : ""));
  ok(/@media \(max-width: 760px\) \{\s*input, select, textarea \{ font-size: 16px; \}/.test(css), "inputs are 16px on phones, so iOS doesn't zoom");
  const js = fs.readFileSync(path.join(__dirname, "..", "demo", "app.js"), "utf8");
  ok(!/font-size:\s*([0-9]|1[01])px/.test(js), "no inline font sizes under 12px in app.js");

  ok(!errors.length, "no script errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  console.log(`\ndemo smoke: ${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
