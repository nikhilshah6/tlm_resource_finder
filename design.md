# Design: TLM Reentry demo

How the standalone demo in `demo/` looks and behaves, and the rules for changing it. Nikhil's hub (`the-last-mile-hub.html` and its add-ons) has its own styles and is not covered here.

Sources it draws on: Owen's **Google Stitch** screens (Today, Briefing, Calendar, Resources; layout and look), Emil Kowalski's *apple-design* skill (response, motion, materials, type) and the *taste-skill* (one system, hover and press on everything, no decoration for its own sake). Where they disagree with this file, this file wins.

## What this is for

The project brief (`CLAUDE.md`, section 2, taken from the PRD) is the source of truth for purpose. The README covers setup, the agent pipeline and deploys.

- **Problem (PRD, word for word):** "Reentry specialists need to build a strong, personal relationship with every alumnus after release, but the manual work behind their needs takes time away from that relationship. As caseloads grow, alumni get less of the individual support that keeps them on track."
- **Goal:** reduce recidivism.
- **Question the prototype answers:** "Can a specialist skip manual prep without errors they can't catch?"
- **Chosen idea:** a pre-call briefing, fed by call notes turned into a structured record. It's one page, readable in about two minutes.
- **Guardrails** (these drive several design rules below):
  - no unreviewed AI output enters an alumni record or reaches an alumnus
  - only sample data goes to Claude
  - staff only
  - target zero hallucinations per briefing
- **Audience:** Day 5 panel, Friday Nov 6, 2026, shown from a case manager's point of view.

### What leads

The PRD's chosen idea is the **pre-call briefing**, so it carries the most weight in the design:
- It is the gold filled button on every case page and on every call on Today.
- It is the only screen with a large type moment.
- Everything else (status, tasks, resources, notes) is quiet and feeds it as citable sources.

The **call notes → approved record** flow comes second; it's the loop that keeps the briefing accurate.

### The product's shape

The data, not a page template, sets the layout.

| Data (`reentry-data.js` → `demo/core.js`) | Shape | How the UI follows it |
|---|---|---|
| A caseload: each case manager's alumni (`cm` field), 6 each | A list | Today and Alumni are lists of people |
| A case record per alumnus: housing, supervision, employment, goals, barriers, tasks (T1…), notes (N1…), events (E1…), portal activity (P1…) | A record with dated, numbered entries, shaped like Salesforce Contact / Case / Task / Event | The case page is the record, one grouped section per part. The IDs are what the briefing cites. |
| Events across the caseload | A timeline | Calendar is one agenda list grouped by day |
| Briefing (`SECTIONS`): snapshot, since last contact, open needs, coming up, suggested topics, check before the call | A short ordered document | One sheet, read top to bottom, each line with its sources |
| Call notes → whitelisted changes (`validateDiff` kinds), each with an evidence quote | A diff to approve | A checklist of before/after changes; unsupported ones start unchecked |
| Resources from `/api/resources`, grouped by `CATS` | A catalog | Search, then categories that expand |

## Critical files

| File | What it holds |
|---|---|
| `demo/index.html` | Page shell: loads `reentry-data.js`, `core.js`, `app.js`, `app.css` |
| `demo/app.css` | Every design token and component style in this document |
| `demo/app.js` | Views, router, sheets, toasts (all UI) |
| `demo/core.js` | Logic with no UI: record checks, briefing sources, prompt and validation, the no-AI digest, call-notes diff, tasks, handoff, resource categories, ranking and search |
| `reentry-data.js` | The 18 sample alumni, 3 case managers, standard First 30 Days tasks, stages |
| `site/` | Cloudflare build (`build.js`), password gate (`functions/_middleware.js`), Claude proxy (`functions/api/claude.js`), resource sources (`lib/`), browser shim (`src/cf-shim.js`) |
| `tests/demo-smoke.js` | End-to-end checks for the demo, including the 12px type floor |
| `CLAUDE.md` | Project brief, decisions and rules (the source of truth for purpose and scope) |

## Principles

1. **Simplicity first.** Remove things before adding them. If a line of text, a tag or a border doesn't help someone act, it goes.
2. **One structural pattern.** Lists are flat: rows separated by hairlines under a section heading, no box around them. Rows are inset 8px and the list is pulled out 8px, so text lines up with the heading and hover highlights get room. Boxes are kept only for a few feature blocks (stat strip, resource plan, next call, next step) and the caseload table. No gradients.
3. **One bold moment.** The pre-call briefing's snapshot sentence is the only large, heavy text inside the app. Everything else stays quiet.
4. **Every AI line shows its source.** Briefing lines cite record entries; nothing AI-drafted is saved without approval; anything not from AI says so ("no AI").
5. **Say what's not real.** Sample data is labelled in the top bar and on sign-in. Mocked or missing services say so in plain words.
6. **Respond on press.** Every button and row reacts the moment it's pressed, and every change can be undone.
7. **Every control goes somewhere.** Each link points to a real route, `tel:`, `mailto:` or outside page (never `#`), and each button does something visible: navigates, opens a sheet, changes the page or shows a toast. A control that can't work right now is disabled with its reason ("No phone on file"). `tests/demo-smoke.js` clicks every button on every screen to enforce this.

## Tokens

All tokens live at the top of `demo/app.css`. By default they follow the device (`prefers-color-scheme`). The moon/sun button in the top bar (and on sign-in) forces light or dark, and Account › Appearance offers System, Light or Dark. The choice sets `<html data-theme>` and is remembered in this browser only. Dark styles are written once under `:root:not([data-theme="light"])` (inside the media query) and again under `:root[data-theme="dark"]`.

### Colour

A warm neutral ramp (stone) and one accent, TLM gold. Status colours mean status only and always sit next to words. Every text pair below is WCAG AA on both `--bg` and `--surface`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0C0A09` | Page (white, like the references; groups are separated by borders and space, not a grey page) |
| `--surface` | `#FFFFFF` | `#1C1917` | Groups, sheets |
| `--surface2` | `#FAFAF9` | `#252220` | Hover, open rows |
| `--label` | `#1C1917` | `#FAFAF9` | Primary text |
| `--secondary` | `#6B6661` | `#A8A29E` | Secondary text, metadata (5.6:1 on white) |
| `--tertiary` | `#78716C` | `#8A847F` | Muted text, chevrons (4.6:1 on `--bg`) |
| `--separator` | `#EEECEA` | `#2A2624` | Group borders and hairlines (`--line-strong` `#E2DFDC` for buttons and inputs) |
| `--accent` | `#8A6510` | `#E8B838` | TLM gold: links, the active nav item (as a tint), avatars. Not used for buttons |
| `--ink` | `#1C1917` | `#FAFAF9` | The one filled (primary) button per screen or sheet |
| `--ok` / `--warn` / `--check` / `--info` | `#15803D` / `#B91C1C` / `#B45309` / `#1D4ED8` | `#4ADE80` / `#F87171` / `#FBBF24` / `#60A5FA` | Dots, tags and short text only, never large fills |

- Light-mode gold keeps white text on it and gold text on white above 4.5:1.
- No violet or lavender anywhere.
- Category icon tiles each get one hue (`--h`) at 15% tint behind the icon. That's the only multi-colour element.

### Type

Inter (variable, from Google Fonts) with the system stack as fallback. Sizes are tokens in `rem`, so the reader's browser setting still applies. Hierarchy comes from size, weight and spacing, never from colour.

| Token | Size | Use |
|---|---|---|
| `--fs-xl` | 22px | Page title (600, −0.02em) |
| — | 20px | Briefing snapshot, the one large moment (600) |
| `--fs-lg` | 18px | Calendar day numbers |
| `--fs-md` | 15px | Sheet titles, calendar day headers (600) |
| `--fs-base` | 14px | Body, rows, nav, group headers (group headers 600) |
| `--fs-sm` | 13px | Secondary text, metadata, small buttons |
| `--fs-xs` | 12px | Tags, counts, source badges, pills |

**Floor: nothing renders under 12px.** On phones (≤760px) inputs are 16px so iOS doesn't zoom. The smoke test checks both.

### Shape and space

- **Radius scale:** 6px (`--r-s`: badges, tags, the logo tile), 7px (`--r-ctl`: buttons, inputs, nav items), 12px (`--r-group`: groups, cards, banners, the account switcher), 14px (`--r-sheet`: sheets).
- **Surfaces:** lists have no border or background (hairlines only); the few feature cards have a 1px `--separator` border, a flat `--surface` background and no shadow; buttons get a 1px shadow (`--btn-shadow`); sheets use `--sheet-shadow`.
- **Rows and controls (desktop):** rows are at least 42px tall with 14px side padding. Buttons are 28px tall with 13px text, small buttons 24px. Search and inputs are 32px. Icons are 14–16px with a 1.75 stroke.
- **Touch screens (`pointer: coarse`):** buttons grow to 40px (small 36px), rows to 48px and checks to 24px.
- **Content column:** max 780px for now (wider layouts come with the per-screen redesign). Page gutters are 24px on desktop and 16px on phones. Sidebar 224px, top bar 48px.

### Motion

- **Easing:** `--ease: cubic-bezier(.32,.72,0,1)`, a critically damped spring feel.
- **Durations:**
  - Press: `scale(.97)`, 100ms.
  - Sheets: ~400ms in, leaving the way they came.
  - Category open: 280ms fade and 6px drop.
  - Toast: 350ms.
- **Only user actions trigger motion.** No entrance animations, no scroll reveals, no parallax, no loops.
- **Accessibility settings:**
  - `prefers-reduced-motion`: everything becomes a short cross-fade or nothing.
  - `prefers-reduced-transparency`: blur is removed and bars go solid.
  - `prefers-contrast: more`: borders are added.

## Layout

- **Desktop sidebar (232px, `--side`, hairline on the right):** the TLM tile and "TLM Reentry" (links home), a small "Casework" (or "My reentry") label, the nav (grey 16px icons; the current page is a gold tint with a gold icon), and at the bottom an **account switcher** (avatar, name, role) that opens the Account sheet, where Sign out lives.
- **Top bar (48px, `--bar`, hairline below):** no page title (the h1 and the sidebar already say where you are). It holds a back link on pushed pages, page actions such as Print sheet on the briefing, the "Sample data" pill and the theme switch. The avatar button shows only on phones, where the sidebar's account switcher is hidden.
- **Phone (≤760px):** the sidebar becomes a bottom tab bar (places plus Sign out), the pill hides, and sheets slide up from the bottom.
- **Case manager:** Today, Alumni, Calendar, Resources, plus the Case page and the Briefing page (both pushed, with back).
- **Alumnus:** Home, Tasks, Resources.

## Components

| Component | Rules |
|---|---|
| **Group** | A flat list of rows under a group header (h2), with an optional right-side note in secondary text ("5 open", "no AI"). Hairlines between rows, inset 8px on both sides; no outer box. An optional footnote below uses `.gf`. |
| **Row** | Optional leading avatar, dot, icon tile or check circle, then title and secondary line, then optional trailing text and chevron. Rows that navigate are links with a chevron. Hairlines are indented to the text edge. |
| **Add row** | "+ Assign task", "+ Add event", "+ Add call notes": accent text with a plus icon, inside the group it adds to. Add rows sit at the bottom, except Notes, where it's on top because notes are newest-first. |
| **Buttons** | One pair only: **filled ink** (`.btn.pri`) for the main action on a screen or sheet, and **outlined white** (`.btn`) for everything else. Small size (`.sm`) inside rows. Minor inline actions are **text links** (`.linkbtn`). |
| **Text actions** | Inside resource rows, actions are one line of accent text (`.ta`) separated by a middle dot: `Save · I used this`. When on: `✓ Saved` in green, with `aria-pressed="true"`. |
| **Sheet** | One layout for every modal (`sheet()` in `app.js`): a `<dialog>` 520px wide (680px for `wide`), title on the left and a ✕ close button on the right; an optional description line (`.sdesc`); fields as a plain form (no box): a 13px label above a 32px bordered input; a footer on a light grey strip with **Cancel** (or **Close** when there's nothing to submit), then any secondary actions, then the one ink primary. Focus goes to the first field, or else the title. |
| **Toast** | A dark pill at the bottom centre. Every record change gets one, with **Undo**. Its wording matches the button ("Assign" → "Task assigned to Marcus"). |
| **Segmented control** | For 2–4 mutually exclusive filters (stage, contact type). |
| **Check circle** | Round, fills gold with a tick when done. Used for tasks and for accepting AI-drafted changes. |
| **Tag** | Small 8px-radius label for stage ("First 30 days"). Use sparingly; not used in resource rows. |
| **Dot** | 10px status dot: warn red, `chk` amber, info blue, ok green. Always next to text that says the same thing. (The amber class is `.dot.chk`, not `.check`, which is the check circle.) |
| **Source badge** | `.cite-badge`: 6px radius, `--badge` fill, hairline border, the record ID (N4, T9, E2, computed). As a button it expands the exact source text. |
| **Profile card / avatar button** | Open the Account sheet (name, role, caseload size, Sign out). |
| **Picker** | Sheets opened outside a case (Assign task and Add call notes from Today, New event from Calendar) start with an "Alumnus" select. The Resources page has a "Recommending for" select. |
| **Banner** | Full-width tinted note under the briefing snapshot: gold tint by default, green when Claude drafted it with no checks, amber when lines need a check. |

### Alumnus (`#/me`, phone first)

- **Home:**
  1. "Hi, Marcus", day count and First 30 Days progress.
  2. **Your next step:** one card with the earliest open task from the case manager (or the next First 30 Days step), its detail, its due date, **Mark done** (the one ink button) and **All tasks**.
  3. **This week:** appointments and due tasks merged by day.
  4. **From John Doe:** the shared AI plan as a count and the top pick for three needs, plus recommended resources.
  5. **Your case manager:** name, role and **Email John**.
- **Tasks:** "From John" first, then First 30 Days with a progress bar. A step past its window says "Past day 10" in amber (case managers see it too); done steps say "done by you".
- **Resources:** recommended items first, then the shared plan. Items already recommended aren't repeated in it, and "Bring" lines are rewritten to "your" (the agents write them about the person). No eligibility verdicts, no Act today.

### Today (`#/today`)

Answers "who needs me, and what do I do?" in one screen:
1. **Header:** date and call counts; **Add call notes** (shows "Draft saved" when a draft exists) and **Assign task**, both of which ask which alumnus.
2. **Next call card:** when, name (links to the case), the call type and day count plus the top reason from the record; **Open case** and the one ink **Pre-call briefing**.
3. **Needs you today:** at most five people, ranked by `RXC.priorities(a)`, fixed record rules with weights, no AI. These cover unhoused or shelter status, a recent note starting "Urgent", overdue or soon-due tasks, a call in the next 48 hours, 14+ days without contact and a parole check-in in the next 3 days. Each row shows the top reason and one more, with one action: **Prep call** when a call is within 48 hours, otherwise **Open case**. The person in the next-call card isn't repeated.
4. **N more calls this week**, collapsed.

The notes feed and the caseload task list moved to each case (Activity and Tasks); record IDs no longer appear on Today.

### Alumni (`#/alumni`): the caseload table

- A wide page (`v.wide`, max 1120px) with the stage filter and search above one table.
- **Columns:** Name (avatar, "from Jane" after a handoff), Stage, Day, Housing (red when unhoused, amber in a shelter), Next contact (date, time, type), Open tasks (with overdue count), Last contact (red at 14+ days), Needs (the top `RXC.priorities` reason, one line; all reasons on hover and on the case).
- **Sorting:** every header is a button; the sorted column carries `aria-sort` and an arrow. Default is **Needs**, most in need first. Clicking a row (or the name link) opens the case.
- **Narrow screens:** Stage and Next contact drop below 900px; Housing, Open tasks and Last contact drop below 760px, and names wrap, so the table fits a phone with no sideways scroll.

### Calendar (`#/calendar`): one agenda

- Header: "Next 30 days across your caseload · N events", the filter (All / Check-in calls / Deadlines and mandates) and **New event** (asks which alumnus).
- One bordered list from today on, with a grey day header ("Today · Thu, Nov 5", count) before each day's rows. Each row: time, a type dot, the person and the event (links to the case), then type and place when they add something.
- **Briefing** appears only on check-in calls in the next 48 hours. No week strip, per-day add rows or record IDs.

### Case page (`#/case/<id>`)

- **Header:** name, stage tag and "Day N since release · city · facility" on the left; **Add call notes**, **Hand off** and the ink **Pre-call briefing** on the right.
- **Tabs** (`role="tablist"`, arrow keys move between them; every panel is rendered and the inactive ones are `hidden`):
  - **Overview** (default), in order:
    1. a 4-cell stat strip: Housing, Supervision (with curfew), Next on calendar, Last contact
    2. the **Resource plan** card: the AI plan summarised as Act today plus a top pick per need (verdict and urgency tags); a pick opens that category in the Resources tab. With no plan yet it offers **Build plan**; while running it shows the time and stage.
    3. **Needs attention** (or **Record checks** when nothing is a warning): the no-AI record checks
    4. **Open tasks**: the first four, with a link to all of them
    5. **Latest note**, with a link to Activity
  - **Resources:** the full AI plan (verdicts, sharing, Run again) above the general directory.
  - **Tasks** (open count) and **Activity** (Coming up and Notes; note count).
  - **Profile:** an icon fact list, two columns on wide screens (Housing, Supervision, Employment, Contact, Goals, Barriers, Release), each with a 16px grey icon, a small label, the value and a detail line. No box.
- **Saved demo plans:** `site/data/agent/demo-plans/<id>.json` (Marcus and Anthony, recorded from live runs on Nov 5) are a fallback, not the default: the case opens with **Build plan**, which runs the search live. If a live run fails, **Use saved run** loads the saved one, labelled "Saved run from Nov 5". Adding `?saved` to the URL loads saved runs on every case for rehearsal.

### Resources

- **Order on the page:** search bar, then the "Near Oakland, CA 94607" line with "I moved" / "Change ZIP", then **Recommended** (only if the case manager pinned something), then **All resources**: seven fixed categories, all closed.
- **Category row:** icon tile, name, count, chevron that turns down when open. Tap to open in place; tap again to close. Open state is remembered per signed-in person.
- **Search:** filters instantly as you type, as plain text with no AI. Matching categories open automatically, and an empty result says so and keeps the categories visible.
- **Resource row anatomy (nothing else):**
  ```
  Oakland Housing Authority ↗          title, links out in a new tab
  Public housing and Housing Choice…   one sentence (source notes, else a fixed line per need)
  1619 Harrison St… · (510) 874-1500   address and phone on one line (tap to call)
  Save · I used this                   text actions
  ```
  - The case manager's actions are `Recommend to Marcus · Not relevant`.
  - The case manager also sees one green status line when it applies ("Marcus used this Nov 5").
  - Distance, hours, category, trust level and the data source are left out of rows on purpose. The page footer says where the data comes from and when it was fetched.

### Resources page (`#/resources`)

One column: the title, a single **For [alumnus] · Open case** line, then the same resource list as the case's Resources tab (search, AI plan, general categories). There is no separate category index; the categories are the list.

### Resources: AI search results and General resources

- **Order on the case manager's Resources** (case page and Resources page):
  1. search
  2. "Near …"
  3. **Recommended**
  4. **AI search results**
  5. **General resources** (the instant categories)

  The search filters both sections.
- **AI search results (case manager):**
  - **No run yet:** one line saying what the agents do, with **Build plan** (the same label as the Overview card). Outside California it's disabled with the reason.
  - **Running:** a progress group (one row per stage with a dot, live counts, Cancel).
  - **Done, in this order:**
    - the draft banner
    - a share row: **Share with Marcus**, "Shared with Marcus · Unshare", or **Share this new plan** after a re-run
    - **Act today (N)**
    - the 7 categories as collapsible rows, each with an urgency tag (Today in red, This week in gold, This month in grey), most urgent first
    - **Not eligible (N)**
    - counts and **Run again**
  - **Results (case manager):** name with its verdict tag, one "why it fits" line, phone · address, and for *Worth applying* a tinted "Confirm: …" question; then Recommend / Remove pin and **Details ▸**, which holds the agents' reason, Bring, the rule ("Rule" only for *Not eligible*, otherwise "Based on") and the source.
- **Categories:** AI results go into our 7 categories by the agents' category plus fixed keyword rules (`agentNeed`: a DMV ID goes to ID and documents, Bank On to Phone and banking). Categories start closed, and open state is remembered per person.
- **Sharing is a review:** **Share with Marcus** opens a sheet with each Act today step written to the alumnus ("you"; the ranker's `for_alumnus`, or a best-effort rewrite for older plans), plus what to bring. The case manager can reword a step, change what to bring, or untick it to leave it out, then shares. After sharing, **Edit steps** reopens it; **Unshare** removes it.
- **Alumnus steps:** the shared steps appear in order as "Your steps" at the top of the alumnus's Resources page, each with a check. The first open step is the **Your next step** card on Home ("Step 1 of 3 in John's plan"); marking it done moves to the next. With nothing shared, the next step is the earliest task from the case manager.
- **Alumnus view:** shown only after the case manager shares; the PRD guardrail means no unreviewed AI output reaches an alumnus.
  - The section is "From John Doe · found by AI", then "Shared <date>. Call ahead…", then Act today and the same categories.
  - Rows show title ↗, summary, address, phone and **Bring**, with Save · I used this.
  - **No** eligibility tags, reasons, confirm questions, rules or not-eligible list.
  - Home gets a "N resources found for you by AI" row.
  - With nothing shared, the alumnus page is exactly as before (no AI section, no "General resources" header).
- **Storage:** the share is a snapshot on the record (`a.aiShared`), so re-running doesn't change what the alumnus sees until it's shared again. Share and Unshare have Undo.
- **Styling:** built only from existing components.

### Pre-call briefing (its own page, `#/briefing/<id>`)

- **Top bar:** "‹ Back to Marcus Johnson's case", then **Print sheet** (prints the briefing only) and **Start call** (`tel:` link that also opens Add call notes; disabled with "No phone on file" when there's no number).
- **Order** (what to do before dialling first, reference last):
  1. a plain header: "Pre-call briefing · Check-in call Nov 6, 10:30 AM", the name, stage and day, then a hairline; the **snapshot** as a 20px lede (no card), with its sources
  2. a one-line **status** with a small coloured dot (green: Claude draft, amber: lines need a check, grey: no-AI digest)
  3. **Resolve before the call:** the conflicts Claude found between sources, with square checkboxes and an "N of M ready" count; the group has an amber-tinted border
  4. **Talk about:** numbered, in the priority Claude gives
  5. **Context**, collapsed (`<details>`): Since last contact, Open needs, Coming up, with a line count on the summary
  - **Right rail** (sticky, from 1100px; below the content on narrower screens): **At a glance** (housing, supervision with curfew, employment, last contact, phone), **Record checks** (no AI) and **Drawn from** (how many notes, tasks, events and app actions the draft could use).
- **Footer:** when it was generated, Regenerate, Flag corrections (a sheet with every line and its flag), Start call.
- **Honesty:** the banner reports what the automatic checks found ("2 lines need a check against its source"). It never claims there are no hallucinations.
- **Each line:**
  - The text, then its **references** inline: small dotted-underline ids (N4, T3, calc); select one to see the exact entry below the line.
  - A *Check* or *No source* badge from the automatic checks.
  - A **flag** icon (shown on hover or keyboard focus, always on touch screens, and labelled "Flagged" once pressed) that counts toward errors per briefing.
- **Fallback:** if Claude is unavailable, it shows a labelled auto-digest instead. Never a blank page.

## Copy

- Sentence case everywhere. No all-caps labels, no tracked-out eyebrows, no emoji as icons, and no "→" stuck onto text (arrows are icons, like the ↗ on outside links).
- Never claim what wasn't checked: no "Verified" unless a check ran, no "Sync active" when nothing syncs.
- Buttons are verb plus object: "Assign task", "Add call notes", "Draft changes", "Approve 2 changes and save note".
- Toasts repeat the action's words, and every change toast offers Undo.
- Empty states say what to do next: "No call notes yet." sits directly under the "+ Add call notes" row.
- Errors say what happened and what to do, without apologising: "Too many requests right now. Your notes are still here: save them as a note, or try again."
- Speak to alumni as "you"; speak about them to case managers by first name.

## Accessibility

- Visible focus ring on keyboard focus only: 3px blue outline on buttons and links; form fields get a gold border plus a 3px gold tint ring (5.3:1 against white).
- Toggles use `aria-pressed`, category rows `aria-expanded`, and task and change checks `role="checkbox"` with `aria-checked`.
- Outside links carry hidden text "(opens in a new tab)".
- Dots and colours always come with words.
- Text never goes under 12px, and inputs are 16px on phones. Desktop controls are 28–32px (above the 24px WCAG 2.5.8 minimum); on touch screens they grow to 36–48px. Text actions are smaller, so give them spacing.

## Do / don't

| Do | Don't |
|---|---|
| Group related rows in one inset group | Put cards inside cards or groups inside groups |
| Use one filled ink button per screen or sheet | Add new button styles or colours |
| Hide details until someone asks (expand, tap a source) | Show every field "just in case" |
| Animate in response to a tap | Animate on page load or scroll |
| Keep real public resource details (addresses, phones) | Put real alumni data anywhere: sample data only |
| Label anything mocked, assumed or computed | Let AI text look like a saved record |

## Checking a change

1. Run the tests:
   ```bash
   cd site && node build.js && cd ..
   NODE_PATH=<jsdom>/node_modules node tests/demo-smoke.js
   ```
2. Look at the change in light and dark mode at 1440, 1024, 768 and 390px wide. Check for no sideways scroll, aligned edges, and the 12px floor.
3. Deploy with `npm run deploy` from `site/` (builds, then deploys to the `tlm-reentry-agents` Pages project). Every deployment runs the same password gate.
