# CLAUDE.md: Reentry Specialist View for The Last Mile (Turn 2 U)

> **Where things live now (Nov 6, 2026):** this repo (`nikhilshah6/tlm_resource_finder`) is the main repo. It holds the hub site (`demo/` UI, `site/` Cloudflare Pages build and functions, deployed as **tlm-reentry-agents.pages.dev**), the agent pipeline (`site/functions/_agent/`, with the Python reference in `app/`), the data build (`scripts/build_snapshot.py` → `data/`, `scripts/build_agent_data.py` → `site/data/agent/`), evals and tests. Sections 3–4 below describe the original claude.ai artifact the work started from; that history and the older artifact files stay in `nikhilshah6/cc-basecamp-ptype`. Section 11's "copied from tlm_resource_finder" notes no longer apply: the agent code here is the source.

Context file for anyone (human or Claude) picking this project up. Last updated Wed Nov 4, 2026, ~3:50pm PT.

## 1. What this is

Owen Duffy and Nikhil Shah (Claude Corps Basecamp fellows) are extending The Last Mile's (TLM, host org "Turn 2 U, Inc.") existing **Reentry Hub + Career Platform** prototype with a **case manager (reentry specialist) view**. It is an **internal proof of concept** with **dummy data only**.

- **Deadline:** Day 5 panel on **Friday Nov 6, 2026**. 10 minutes to present, 5 for panel feedback. Plan is to work most of Thursday Nov 5.
- **Demo perspective:** a case manager's. The centerpiece is the **pre-call briefing**.
- **Audience for the prototype:** staff only. Alumni data is sensitive; no real data exists or is approved.

## 2. Source documents (shared Drive folder "Turn 2 U, Inc.")

| Doc | Drive ID |
|---|---|
| PRD - Turn 2 U, Inc. | 1LiumQmqk5xgPUefBxd2wmHfcjSWeM_qNdfI8uxsnQ3c |
| Problem statement and prioritization | 1MxPGKAX4UZ0_mFHKeBw-ZUXZ8oUXH22JI7t1qIgu4NU |
| Discovery conversation | 1GLtStbiN_UugWw8x8Hn-QTs7ZnGI85I2ASCBDt_xqqo |
| Panel presentation (blank template) | 1nALuD9ygMC-hCixR6FThTnvBkjHXIzKKzsuPKT1GT3E |
| Problem statement first draft | 1cVFpaxC7AyI6MBHg-zqfqskf8JXYndG4gpwOGoBkMuA (not read) |
| Fellow packet PDF | 185u5eJ3N9BjNx-MCMACUGFfnKRRex99v (not read) |

Folder ID: 1AUUs_IpxtKge-sgz2r6AH26xT6fsT2Zl. Read these before changing scope.

### Problem statement (word for word, from the PRD)
> Reentry specialists need to build a strong, personal relationship with every alumnus after release, but the manual work behind their needs takes time away from that relationship. As caseloads grow, alumni get less of the individual support that keeps them on track.

### PRD essentials
- **Goal:** reduce recidivism. Host numbers: ~1,000 alumni, 1,587 students served last year, 75% employment, recidivism target 8%.
- **Chosen idea:** pre-call briefing, fed by call notes turned into a structured record. Briefing is one page, readable in about 2 minutes: history, open needs, last contact, suggested topics. It is connected to alumni data inside the dashboard.
- **Journey to demo ("With your solution"):**
  1. Specialist opens the alumni record.
  2. Reads the one-page briefing.
  3. Has a relationship-focused call.
  4. Pastes call notes; Claude drafts a structured record.
  5. Specialist reviews and approves.
  6. Context improves over time. A colleague can pick up an alumnus without starting from zero.
- **Question the prototype answers:** "Can a specialist skip manual prep without errors they can't catch?"
- **Guardrails:** no unreviewed AI output enters an alumni record or reaches an alumnus; only dummy data goes to Claude; staff only; target 0 hallucinations per briefing.
- **Out of scope:** real alumni data (until privacy sign-off), alumni-facing chatbot, public database integration.
- **Roadmap:** Crawl = this prototype. Walk = briefings and notes against approved real records. Run = resource matcher with approval (211 dataset, public sources) and outcomes dashboard.
- **Panel format:** demo walks the "With your solution" journey end to end with realistic sample data, and must say what is not real.

## 3. The artifact we are editing

- **Title:** The Last Mile — Reentry Hub + Career Platform (created by Nikhil, shared with Owen with **edit** access).
- **URL:** https://claude.ai/code/artifact/11198929-6fd2-4eae-a909-54f463188459
- **Version when we started:** `1793834233-11e9`. Single HTML page, ~900 KB, 564 lines (several lines are 35K–370K characters long). No supporting files. No runtime capabilities declared.
- **Decision:** we edit his version directly (Nikhil knows), collaboratively.

### How collaboration works
Not Google Docs and not full GitHub. Each publish replaces the whole page as a new version at the same URL. If the other person published since you last read, your publish is refused and you get their live version back; merge on top and publish again. There is an overwrite option that discards their version; do not use it without agreeing. Editors can see version history; comment threads exist.

Working agreement:
1. Back up before the first change (done, see section 7).
2. Re-read the live artifact before every publish; build the republish from that read, not from an old copy.
3. Say in chat before publishing; give each publish a short label.
4. Put our code in **separate published files** (`files` map) and touch Nikhil's HTML in only a few places (script tags plus small hooks). Files left out of a publish are kept.
5. Do not change his content (claims, copy) without agreeing; flag it instead.

## 4. Map of the existing prototype (what we learned)

All findings are from reading the saved HTML. Nothing below was run in a browser.

- **State:** one in-memory `users` array (`let users=JSON.parse(JSON.stringify(DEFAULT_PERSONAS))`). `cur` is the signed-in user. `DEFAULT_PERSONAS` holds only **Marcus Johnson** (participant, Oakland, San Quentin SQRC, target "Warehouse Operations Supervisor"). Persistence is browser-local only (`window.storage` and `localStorage`, keys such as `tlm_gate_leads_v1`, `tlm_link_audit_v2`, `tlm_f30_done_v1`).
- **John, Jane and Tom Doe** exist only in `CASE_MANAGERS` (bookable people for the booking modal), **not** as users.
- **Roles and nav:** each user has `u.role` and `u.nav` (array of page ids). `NAV_CFG` gives each id a label, icon and section (`main`, `career`, `tools`). `PAGE_TITLES` sets the top-bar title. `buildSb()` renders the sidebar from `u.nav` (and silently adds `book`).
- **Pages:** `<div class="page" id="page-X">` elements inside `#pageWrap`. `goPage(id)` activates one and runs a few renderers. `launchApp()` always lands on `dashboard`. `renderAppAll()` renders every page for the current user.
- **Role creation:** `createAccount()` has `rm` (role labels: participant, staff, employer) and `nb` (nav per role). Staff nav is only dashboard, profile, book, calendar, resources. The staff dashboard is a generic welcome plus the user's own meetings. No caseload, participant records, or outcomes views exist.
- **Events:** each user has `u.events` (`{id,title,date,time,type,format,loc,contact,email,notes}`). Types and colors live in `DOTC` and labels in `TLAB` (interview, mock, coach, case-manager, job-fair, recruiter). Marcus already has event id 1 (Amazon interview) and id 2 (check-in).
- **First 30 Days:** `FIRST_30` / `buildFirst30()` hold 8 tasks in three phases (Days 1–10, 11–20, 21–30). Completion is stored in `localStorage` on the public page only. The participant app has no tasks page.
- **Theme:** everything is inside `<div class="tlm-platform">`. Variables: `--bg --bg2 --bg3 --text --text2 --text3 --border --border2 --accent --accent2 --ok --inf --purp`. Light mode adds `html.light-theme`. Reusable classes: `.card .btn .btn.pri .btn.sm .btn.ghost .ptag .sec-h .hero-app .stat .g2 .ev .av`. Modals: `.pov` plus `.pmodal` (`openPov/closePov`). Toast: `pToast(msg)`.
- **Persona switcher:** `switchPersona(id)` and the dropdown (`buildPdd`) switch to any user client-side with no auth. `exportGateLeads()` (downloads `hub-signups.csv` of gate emails) is reachable from that dropdown. The link-verification audit (`runAudit`) is also ungated.
- **Existing AI calls** (coach chat, link audit, F30 enhancement) use `fetch("https://api.anthropic.com/v1/messages")` directly with `MODEL="claude-sonnet-4-6"`. A published artifact's CSP likely blocks that; this is **unverified**. For our features use the `sample` capability instead (section 5).

## 5. Decisions made (from the conversation)

- Edit Nikhil's version directly; collaborate as above.
- New role: **Case Manager** (the specialists who support alumni through reentry). Each sees **only their own caseload**.
- **Alumni = the people reentering and needing support.** "Current cases" = alumni with an active case. Cases continue past the first 30 days; what that looks like is unknown, so later stages are assumptions and must be labeled as such in the UI.
- Demo is from the case manager's perspective; **pre-call briefing is implemented**, plus call notes to structured record, **task assignment**, and coverage handoff.
- **Task assignment is in scope.** Specialist assigns tasks (standard 8 and custom with due date, free text); the alumnus sees them; **either** the alumnus or the specialist can mark them complete. Custom tasks: yes.
- Fields: **supervision terms** (type, officer, check-in cadence, conditions, end date) and **housing status** (housed, with family, transitional, shelter, unhoused).
- Events: all kinds (interviews, check-ins, court dates, parole/probation appointments, housing deadlines, other appointments).
- Briefing generation: **live Claude generation** from the record, with source citations. Dummy notes are our best guess (real note format does not exist or isn't available).
- Salesforce: TLM uses it; access may come later. Shape dummy data like Salesforce objects (Contact = alumnus, Case or program engagement, Task, Event) so mapping later is easy.
- Access control: "don't worry for now" (eventually TLM staff). Prototype only.
- Repo: **keep everything local for now**; eventually move to a shared repo (the PRD names this as the mitigation for siloed codebases).

## 6. Planned design (NOT yet built unless noted)

**Files to publish beside the page:** `reentry-data.js` (built), `reentry.js` (not started; also injects its own CSS so we don't depend on a stylesheet file), and two `<script src>` tags added before `</body>` in Nikhil's HTML.

**Role and nav:** push three users `cm-john`, `cm-jane`, `cm-tom` (role "Case Manager"; titles Senior Reentry Case Manager / Employment & Career Coach / Peer Support Specialist) with the same shape `createAccount` builds. CM nav: `caseload`, `alumni`, `events`, `resources`. Participants (Marcus) get a new `tasks` ("My Tasks") page. Wrap `launchApp` (send CMs to `caseload`), `goPage` (titles and renderers), and optionally `buildSb` (badge for open assigned tasks). Add event types `court`, `parole`, `housing`, `appt` to `DOTC`/`TLAB`.

**Views (CM):**
- *Caseload* (home): KPI strip (active cases, calls this week, overdue tasks, no contact 14+ days), upcoming calls with a **Pre-call briefing** button, caseload table with stage filter and search.
- *Alumni directory:* all of my alumni (active and stable), searchable.
- *Events:* aggregate across my alumni, grouped by date, filter by type.
- *Case detail:* header with actions (Pre-call briefing, Add call notes, Assign task, Add event, Hand off, Preview as alumnus); overview cards (supervision, housing, employment, goals, barriers); tabs for tasks, notes, events.
- Visible **"Sample data"** banner everywhere (answers "what's not real").

**Pre-call briefing:** modal, one page. Built from a source table (ids N1.. for notes, T1.. tasks, E1.. events, plus HOUSING, SUPERVISION, EMPLOYMENT, PROFILE, BARRIERS, FACTS for computed dates and counts). Call `sample.json(...)` (tier "quick" or default) with the instructions, record and a JSON schema (snapshot, since last contact, open needs, coming up, suggested topics, check-before-call). Every statement must cite source ids; chips on each line show the exact source text. Automatic checks: every cited id exists; every number in a statement appears in a cited source or FACTS (otherwise "check" badge). Per-line "flag as wrong" counter (feeds the PRD measure "errors per briefing"). Separate **automatic record checks** that don't use AI (missing phone or supervision end date, 14+ days since last contact, overdue custom tasks, events in the next 3 days). **Fallback:** if `sample` is unavailable or the viewer declines, show a deterministic record digest labeled "Auto-digest (no AI)".

**Call notes to record:** paste notes, Claude returns a JSON diff limited to whitelisted fields (housing status/detail, supervision next check-in, employment status/detail, phone, add barrier, task status updates, new tasks, new events), each with an `evidence` quote. Show as a checklist banner "AI draft, not saved". Evidence not found in the pasted notes is flagged and unchecked. Nothing is written until **Approve**. Without `sample`: save the raw note only.

**Tasks:** alumnus record holds the 8 standard tasks (names and phases match the existing First 30 screen) plus custom tasks `{title, detail, due, status, assignedBy, doneBy}`. "Preview as alumnus" builds or reuses a participant user for that record so the demo can show assign, switch, see, complete, switch back. New events for a linked alumnus are also pushed to that user's calendar.

**Handoff:** reassign `cm` to a colleague with a note; the case leaves the first manager's caseload and shows in the colleague's (supports "colleague can pick up without starting from zero").

**Publishing note:** the `sample` capability must be declared at publish (`capabilities: {sample: {}}`), which shows a consent prompt to viewers on first use and spends the viewer's Claude usage. Tell Nikhil. Load the `artifact-capabilities` and `artifact-design` skills first, as the tool requires.

**Testing plan:** smoke-test in jsdom (mock `window.claude.use("sample")`): sign in as each CM, visit each page, assign a task, switch to Marcus and check it appears, run the notes diff, run the handoff, confirm the participant view still works. Then one accuracy pass: generate a briefing for every dummy alumnus and score statements against the record (this also gives the PRD's blank "First test run" a number).

## 7. Status as of this file

**Done**
- Backed up the original artifact HTML: `/tmp/claude-0/-home-claude/a8dc2e85-b727-5c73-8fa9-67f90789fce3/scratchpad/backup/tlm-original-1793834233-11e9.html`. A working copy is in `.../scratchpad/work/index.html`. These are session scratch files; **copy them into your repo or a permanent folder** before the session ends.
- Mapped the prototype (section 4).
- Wrote `.../scratchpad/work/reentry-data.js`: 18 fictional alumni (6 per case manager), the standard task list, case manager records, relative dates, helper `window.RX_DATA`. **Not yet loaded or tested.**

**Not started:** `reentry.js` (role, views, briefing, notes flow, tasks, handoff), editing the HTML to load the new files, testing, publishing.

**Nothing has been published.** Nikhil's artifact is unchanged.

### Traps built into the dummy data (for the accuracy test)
- **Marcus Johnson:** record says curfew 10pm but a note says 9pm for the first 60 days (he is on day 26); housing deadline moved from "end of November" to Nov 20 in the latest note; SNAP interview outcome never recorded; Hope House bed not confirmed.
- **Keisha Brown:** last two-way contact 19 days ago; two missed supervision check-ins reported by her officer.
- **Tasha Williams:** no phone number and no probation end date on file.
- **Luis Ramirez:** only one note (briefing should stay short, not invent history).
- **Devon Carter:** interviewed, no offer yet (briefing must not say he got the job).
- **Anthony Ruiz:** unhoused, urgent housing and GPS charging.

## 8. Open issues and risks

- **Inconsistencies in the docs:** Pete Blumenthal is "executive director" in the problem statement but "VP of Engineering" in discovery and the PRD (PRD also names Kevin as CEO). Alumni counts differ: ~1,000 (discovery), 1,587 served last year (problem statement), 1,600+ since 2010 (public page).
- **Unsourced claims in the prototype:** the gate and sidebar say "<5% recidivism" and "61% nationally" while the host's stated figure is a target of 8%. Decide with Nikhil whether to label or remove before showing TLM leadership.
- **Existing AI features probably do not work when published** (direct `fetch` to the API). Unverified.
- **Where case managers keep notes today is still unknown** (PRD open question), so our dummy note format is a guess. Post-30-day case stages are assumptions.
- **GitHub is not linked** in this session (repo listing failed). No repo exists yet for Pete's team.
- The persona switcher and export tool are ungated; fine for dummy data, not for real data.
- Per-session state is in memory, so reloading resets our demo data (by design for now).

## 9. Future work (after the Nov 6 panel)

- **Walk:** run briefings and structured notes against approved real records once privacy sign-off exists; alumni consent for recording their data.
- **Salesforce:** map the data model (Contact, Case or program engagement, Task, Event) and integrate once access is granted; confirm whether TLM uses the Nonprofit Success Pack.
- **Real access control:** TLM staff authentication, role provisioning, per-specialist scoping, audit log, records and consent policy; remove or gate the persona switcher and export tool.
- **Shared state:** if multiple viewers need the same cases and tasks before a real backend exists, evaluate the artifact `db` capability.
- **Run:** resource matcher with specialist approval (211 dataset and other public sources, once a usable API is confirmed), alumni experience and outcomes dashboard, draft follow-ups, "today" queue, coverage brief.
- **Measurement:** establish baselines (prep time per call, alumni per specialist, briefing accuracy) with Pete and specialists; fill in the PRD measurement table and "first test run".
- **Codebase:** move to a shared repo; plan how the two existing TLM codebases get merged; confirm where the prototype ultimately lives (Pete, Javier, Sierra).
- Interview real specialists to replace guessed workflows, note formats and post-30-day stages.

## 10. Rules of the road

- Dummy data only goes to Claude. No real alumni data, ever, until sign-off.
- No AI output is saved to a record without a human approving it.
- Every briefing claim shows its source; unknowns are stated as unknown, never guessed.
- Re-read the live artifact before each publish; never overwrite someone else's version.
- Keep changes to Nikhil's HTML small and put our code in our own files.

## 11. AI deep search (Nikhil's agent pipeline), added Nov 6, 2026

- **Source:** `site/functions/_agent/*.ts` and `site/functions/api/agent/step.ts` were copied from **nikhilshah6/tlm_resource_finder@691c8dc** (`cf/`). So were `site/data/agent/` (the California directory snapshot for 58 counties plus statewide, and `rules_ca.json`). Edits are marked "TLM demo:":
  - data paths changed to `/data/agent/`
  - the route needs a structured profile (no free-text intake)
  - requests over 400 KB are refused

  Later fixes in his repo must be copied again by hand. His `scripts/build_cf_assets.py` isn't in his repo, so the snapshot can't be rebuilt from source.
- **What it does:** `POST /api/agent/step` runs one stage per call: intake, orchestrator, finder ×5, judge, ranker. It streams events and returns a ranked plan. The browser driver is `V.agentRun` in `demo/app.js`. `RXC.toAgentProfile` maps our sample record to his profile, filling only fields we have.
- **Cost:** about 25–50 Claude calls (Opus 5.5 and Sonnet 5.5, with web search) and about 90 s per run. California only.
- **Keys:** runs use the site's existing `ANTHROPIC_API_KEY` (Owen's). CareerOneStop job-centre lookups need `CAREERONESTOP_USER_ID` / `CAREERONESTOP_TOKEN`; Nikhil sets them with `wrangler pages secret put` if wanted. Without them, that one tool reports "not configured".
- **Rules kept:**
  - Only sample data goes to Claude: the profile carries the first name and record fields.
  - The plan is a draft and is never written to the record.
  - Only a result the case manager recommends is stored, with Undo.
  - Alumni never see the AI search.
- **The existing UI is the source of truth.** A pixel comparison of all 40 screen and theme combinations showed the only change is the new block inside Resources.
- **Saved demo plans:** `site/data/agent/demo-plans/a-marcus.json` and `a-anthony.json` were recorded from live runs on Nov 5 and load on the case Overview so the panel doesn't wait 90 seconds. Re-record them after agent changes by running the search and saving `RXV.agent[id].plan`.
- **Sharing (added Nov 6):**
  - AI results reach the alumnus only when the case manager presses **Share with Marcus**, which stores a snapshot in `a.aiShared` (with Undo).
  - The alumnus sees results and "Bring", never eligibility verdicts or notes.
  - Both views sort AI results into our 7 categories with urgency tags. Instant results now sit under "General resources".
