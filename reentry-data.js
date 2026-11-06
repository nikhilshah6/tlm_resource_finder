/* reentry-data.js — FICTIONAL sample data for the case manager view. No real people.
 * Shaped like Salesforce objects so a later mapping is easy:
 *   alumnus            -> Contact
 *   alumnus.stage/cm   -> Case / Program Engagement (owner = case manager)
 *   alumnus.tasks      -> Task
 *   alumnus.events     -> Event
 *   alumnus.notes      -> Task (type Call) / ContentNote
 * Dates are stored as day offsets from today and turned into ISO dates at load.
 */
(function () {
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(n) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function D(n) { // short human date, e.g. "Nov 20"
    return new Date(iso(n) + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function dow(n) { return new Date(iso(n) + "T12:00").toLocaleDateString("en-US", { weekday: "long" }); }

  var STD_TASKS = [
    { name: "Get Your State ID or Driver's License", phase: "Days 1–10" },
    { name: "Get Your Social Security Card", phase: "Days 1–10" },
    { name: "Apply for Food Benefits (SNAP / CalFresh)", phase: "Days 1–10" },
    { name: "Enroll in Free Health Insurance (Medicaid)", phase: "Days 11–20" },
    { name: "Get a Cell Phone Through Lifeline", phase: "Days 11–20" },
    { name: "Open a Bank Account (Second Chance Banking)", phase: "Days 11–20" },
    { name: "Register to Vote", phase: "Days 21–30" },
    { name: "Start Clearing Your Record (Expungement)", phase: "Days 21–30" }
  ];

  // Stages after the first 30 days are ASSUMPTIONS (real case lifecycle unknown). Labeled in the UI.
  var STAGES = [
    { id: "first30", label: "First 30 days", assumed: false },
    { id: "stabilizing", label: "Stabilizing", assumed: true },
    { id: "stable", label: "Stable", assumed: true }
  ];

  var CMS = [
    { id: "john", userId: "cm-john", name: "John Doe", title: "Senior Reentry Case Manager", color: "#1a4a8a", email: "john.doe@thelastmile.org" },
    { id: "jane", userId: "cm-jane", name: "Jane Doe", title: "Employment & Career Coach", color: "#b8891a", email: "jane.doe@thelastmile.org" },
    { id: "tom", userId: "cm-tom", name: "Tom Doe", title: "Peer Support Specialist", color: "#1a6b2e", email: "tom.doe@thelastmile.org" }
  ];

  // note kinds: call | visit | text | voicemail | collateral (officer, family, employer). twoWay = alumnus actually spoke with us.
  var RAW = [
    /* ---------------- JOHN ---------------- */
    { id: "a-marcus", linkedUser: "marcus", name: "Marcus Johnson", cm: "john", rel: 25, stage: "first30", phone: "(510) 555-0200", email: "marcus.j@email.com", loc: "Oakland, CA", facility: "San Quentin SQRC",
      housing: { status: "family", detail: "Staying with his sister in Oakland; applied to Hope House (transitional). Bed not confirmed." },
      sup: { type: "Parole", officer: "Officer D. Alvarez", cadence: "Weekly, in person", conditions: "Curfew 10pm; stay in Alameda County; no travel without approval", end: 340 },
      emp: { status: "Job searching", detail: "Interview with Amazon warehouse; target: Warehouse Operations Supervisor" },
      goals: ["Warehouse supervisor role", "Own place by January"], barriers: ["Transportation", "Housing timeline"],
      std: "ddiddinn",
      custom: [{ title: "Bring ID and pay stubs to Hope House intake", detail: "Hope House needs a decision on the bed.", due: 3, status: "open", by: "john" }],
      notes: [
        { d: -24, by: "john", kind: "call", twoWay: true, text: "Intake call. Released from San Quentin 25 days ago. Staying with his sister in Oakland for now. Wants warehouse or logistics work, has FedEx and city volunteer experience. State ID done, Social Security card applied for. Motivated, easy to talk to." },
        { d: -18, by: "john", kind: "call", twoWay: true, text: "Call. SNAP interview is scheduled for " + D(-13) + ". Reminded him to bring ID and proof of address. Said his sister's place works only until the end of November. Applied to Hope House for a transitional bed." },
        { d: -9, by: "john", kind: "collateral", twoWay: false, text: "Spoke with Officer Alvarez. Marcus is complying. Officer says curfew is 9pm for the first 60 days, then goes back to 10pm per the conditions sheet. Weekly check-ins are on time." },
        { d: -3, by: "john", kind: "call", twoWay: true, text: "Call with Marcus. Hope House says a bed will likely open but nothing confirmed; they need his decision. His sister now says he needs to be out by " + D(15) + ". Amazon interview is in 4 days, talked through what to say about the gap. Ran out of time to follow up on other items." }
      ],
      events: [
        { title: "Parole check-in", d: 2, time: "09:00", type: "parole", loc: "Alameda County Parole Office", notes: "Weekly" },
        { title: "Interview – Amazon Warehouse", d: 4, time: "10:00", type: "interview", loc: "Oakland Fulfillment Center", notes: "Bring resume. Arrive 15 min early." },
        { title: "Case Manager Check-in", d: 10, time: "14:00", type: "case-manager", loc: "TLM Oakland Office", notes: "Monthly review" }
      ] },
    { id: "a-anthony", name: "Anthony Ruiz", cm: "john", rel: 12, stage: "first30", phone: "(415) 555-0131", email: "", loc: "San Francisco, CA", facility: "Folsom",
      housing: { status: "unhoused", detail: "Sleeping in his car or at a friend's couch. No bed lined up." },
      sup: { type: "Parole", officer: "Officer R. Kim", cadence: "Twice weekly", conditions: "GPS monitor (needs daily charging); curfew 8pm", end: 500 },
      emp: { status: "Not working", detail: "Wants construction or day labor" },
      goals: ["Stable housing", "Any steady work"], barriers: ["Unhoused", "GPS charging access", "No ID yet"],
      std: "nnnnnnnn",
      custom: [{ title: "Find a place to charge GPS monitor daily", detail: "Ask the shelter or library about outlets.", due: 1, status: "open", by: "john" }],
      notes: [
        { d: -11, by: "john", kind: "call", twoWay: true, text: "Intake. Released 12 days ago, no housing. Sleeping in his car most nights. GPS monitor battery keeps dying and he is scared of a violation. No ID, lost paperwork at release." },
        { d: -6, by: "john", kind: "call", twoWay: true, text: "Urgent: GPS battery died overnight, officer notified. Referred him to a drop-in center that has outlets. Still no shelter bed. Waitlist call made." },
        { d: -2, by: "john", kind: "text", twoWay: true, text: "Texted. He says the friend's couch is available this weekend only. Still needs a bed and a charger plan." }
      ],
      events: [{ title: "Parole check-in", d: 1, time: "08:30", type: "parole", loc: "SF Parole Office", notes: "" }] },
    { id: "a-darnell", name: "Darnell Price", cm: "john", rel: 70, stage: "stabilizing", phone: "(510) 555-0144", email: "darnell.p@email.com", loc: "Hayward, CA", facility: "San Quentin SQRC",
      housing: { status: "transitional", detail: "Sober living house, paid through January." },
      sup: { type: "Probation", officer: "Officer L. Grant", cadence: "Monthly", conditions: "Drug testing; no alcohol", end: 420 },
      emp: { status: "Employed", detail: "Forklift operator, part time, started 3 weeks ago" },
      goals: ["Full-time hours", "Get driver's license back"], barriers: ["License suspended"],
      std: "dddddddi",
      custom: [],
      notes: [
        { d: -20, by: "john", kind: "call", twoWay: true, text: "Got the forklift job. Part time for now. Boss says full time possible after 90 days." },
        { d: -8, by: "john", kind: "call", twoWay: true, text: "Check-in. Clean drug tests, house manager happy. Wants to start the license reinstatement process." }
      ],
      events: [{ title: "Probation meeting", d: 6, time: "13:00", type: "parole", loc: "Hayward Probation", notes: "" }] },
    { id: "a-rosa", name: "Rosa Medina", cm: "john", rel: 140, stage: "stable", phone: "(510) 555-0155", email: "rosa.m@email.com", loc: "Oakland, CA", facility: "CCWF",
      housing: { status: "housed", detail: "Own apartment, lease through next June." },
      sup: { type: "Parole", officer: "Officer T. Huang", cadence: "Monthly", conditions: "Standard conditions", end: 200 },
      emp: { status: "Employed", detail: "Dental office front desk, full time" },
      goals: ["Reunite with her kids on weekends", "Start expungement paperwork"], barriers: ["Childcare cost"],
      std: "dddddddd",
      custom: [{ title: "Gather documents for expungement petition", detail: "Court records and parole discharge letter.", due: 14, status: "open", by: "john" }],
      notes: [
        { d: -30, by: "john", kind: "call", twoWay: true, text: "Doing well. Seeing her kids every other weekend. Asked about expungement." },
        { d: -10, by: "john", kind: "call", twoWay: true, text: "Quick check-in. Work is going great, boss offered a raise at 6 months." }
      ],
      events: [] },
    { id: "a-isaiah", name: "Isaiah Brooks", cm: "john", rel: 33, stage: "stabilizing", phone: "(925) 555-0166", email: "isaiah.b@email.com", loc: "Richmond, CA", facility: "San Quentin SQRC",
      housing: { status: "shelter", detail: "Emergency shelter, 90 day limit, day 30." },
      sup: { type: "Parole", officer: "Officer D. Alvarez", cadence: "Weekly", conditions: "Curfew 10pm", end: 380 },
      emp: { status: "Job searching", detail: "Wants warehouse or delivery" },
      goals: ["Stable room by month 3"], barriers: ["Shelter time limit", "No car"],
      std: "ddddidni",
      custom: [],
      notes: [
        { d: -14, by: "john", kind: "call", twoWay: true, text: "Settled in the shelter. Phone through Lifeline in progress. Applying to warehouse jobs on his phone." },
        { d: -4, by: "john", kind: "call", twoWay: true, text: "Check-in. Two applications out. Interested in housing programs that take people with his offense type." }
      ],
      events: [] },
    { id: "a-monica", name: "Monica Reyes", cm: "john", rel: 18, stage: "first30", phone: "(510) 555-0177", email: "monica.r@email.com", loc: "San Leandro, CA", facility: "CCWF",
      housing: { status: "family", detail: "With her mother in San Leandro." },
      sup: { type: "Parole", officer: "Officer T. Huang", cadence: "Weekly", conditions: "Curfew 9pm", end: 450 },
      emp: { status: "Not working", detail: "Interested in medical billing training" },
      goals: ["Medical billing certificate"], barriers: ["Needs ID", "Childcare"],
      std: "idiinnnn",
      custom: [],
      notes: [
        { d: -17, by: "john", kind: "call", twoWay: true, text: "Intake. Staying with her mother. State ID appointment booked at DMV." },
        { d: -5, by: "john", kind: "call", twoWay: true, text: "ID appointment went well, card in the mail. Social Security card not started yet. Asked about training programs." }
      ],
      events: [{ title: "Parole check-in", d: 3, time: "10:00", type: "parole", loc: "Alameda County Parole Office", notes: "" }] },

    /* ---------------- JANE ---------------- */
    { id: "a-devon", name: "Devon Carter", cm: "jane", rel: 48, stage: "stabilizing", phone: "(510) 555-0211", email: "devon.c@email.com", loc: "Oakland, CA", facility: "San Quentin SQRC",
      housing: { status: "transitional", detail: "Transitional house, month 2 of 6." },
      sup: { type: "Parole", officer: "Officer S. Patel", cadence: "Every two weeks", conditions: "Curfew 10pm", end: 360 },
      emp: { status: "Interviewed", detail: "Interviewed for an IT help desk role. No offer yet." },
      goals: ["IT support job", "CompTIA A+ certification"], barriers: ["Gap in work history"],
      std: "dddddddi",
      custom: [{ title: "Send thank-you email after help desk interview", detail: "Short and specific.", due: -2, status: "open", by: "jane" }],
      notes: [
        { d: -12, by: "jane", kind: "call", twoWay: true, text: "Resume reviewed, focused on his certificate and tech volunteering. Applied to 6 help desk jobs." },
        { d: -6, by: "jane", kind: "call", twoWay: true, text: "He got an interview with a regional IT services firm. Practiced answers about the gap in his history." },
        { d: -2, by: "jane", kind: "call", twoWay: true, text: "Interview went well in his view, they said they would decide by next week. No offer yet. Sent him a thank-you template." }
      ],
      events: [{ title: "Parole meeting", d: 5, time: "11:00", type: "parole", loc: "Oakland Parole", notes: "" }] },
    { id: "a-tasha", name: "Tasha Williams", cm: "jane", rel: 22, stage: "first30", phone: "", email: "tasha.w@email.com", loc: "Sacramento, CA", facility: "CCWF",
      housing: { status: "shelter", detail: "Women's shelter in Sacramento." },
      sup: { type: "Probation", officer: "Officer J. Cole", cadence: "Weekly", conditions: "Check in weekly; no new charges", end: null },
      emp: { status: "Job searching", detail: "Retail or food service" },
      goals: ["First job within a month"], barriers: ["No phone", "Transportation"],
      std: "dddiinnn",
      custom: [],
      notes: [
        { d: -20, by: "jane", kind: "visit", twoWay: true, text: "Met in person at the shelter. Interested in retail or food service. Needs a phone to receive job callbacks." },
        { d: -8, by: "jane", kind: "visit", twoWay: true, text: "Lifeline phone application started at the shelter office. Practiced interviews. Probation officer is J. Cole." },
        { d: -3, by: "jane", kind: "collateral", twoWay: false, text: "Shelter staff say she is doing well and attends every workshop." }
      ],
      events: [{ title: "Probation check-in", d: 4, time: "10:30", type: "parole", loc: "Sacramento Probation", notes: "" }] },
    { id: "a-brian", name: "Brian Okafor", cm: "jane", rel: 95, stage: "stabilizing", phone: "(510) 555-0222", email: "brian.o@email.com", loc: "Oakland, CA", facility: "San Quentin SQRC",
      housing: { status: "housed", detail: "Rents a room in a shared house." },
      sup: { type: "Parole", officer: "Officer S. Patel", cadence: "Monthly", conditions: "Standard conditions", end: 260 },
      emp: { status: "Employed", detail: "Warehouse associate, wants to move into IT" },
      goals: ["Move from warehouse into IT support"], barriers: ["Long commute"],
      std: "dddddddd",
      custom: [{ title: "Enroll in Google IT Support course", detail: "Free through TLM skills training.", due: 7, status: "open", by: "jane" }],
      notes: [
        { d: -25, by: "jane", kind: "call", twoWay: true, text: "Started warehouse job. Interested in IT long term." },
        { d: -9, by: "jane", kind: "call", twoWay: true, text: "Check-in. Likes the job but the commute is two hours. Wants to start a certificate course." }
      ],
      events: [] },
    { id: "a-maya", name: "Maya Thompson", cm: "jane", rel: 160, stage: "stable", phone: "(916) 555-0233", email: "maya.t@email.com", loc: "Sacramento, CA", facility: "CCWF",
      housing: { status: "housed", detail: "Apartment with a roommate." },
      sup: { type: "Probation", officer: "Officer J. Cole", cadence: "Quarterly", conditions: "Standard conditions", end: 120 },
      emp: { status: "Employed", detail: "Medical assistant, full time" },
      goals: ["Finish probation", "Move to nursing prerequisites"], barriers: [],
      std: "dddddddd",
      custom: [],
      notes: [
        { d: -35, by: "jane", kind: "call", twoWay: true, text: "Doing well. Passed her probation review." },
        { d: -15, by: "jane", kind: "call", twoWay: true, text: "Asked about nursing programs that accept people with a record." }
      ],
      events: [] },
    { id: "a-gregory", name: "Gregory Hall", cm: "jane", rel: 29, stage: "first30", phone: "(510) 555-0244", email: "greg.h@email.com", loc: "Fremont, CA", facility: "Folsom",
      housing: { status: "family", detail: "With his brother in Fremont." },
      sup: { type: "Parole", officer: "Officer R. Kim", cadence: "Weekly", conditions: "Curfew 10pm", end: 400 },
      emp: { status: "Not working", detail: "Electrician apprenticeship interest" },
      goals: ["Electrician apprenticeship"], barriers: ["Age, apprenticeship age limits"],
      std: "dddddiid",
      custom: [],
      notes: [
        { d: -27, by: "jane", kind: "call", twoWay: true, text: "Intake. Worked as an electrician's helper before prison. Wants to get back into the trade." },
        { d: -10, by: "jane", kind: "call", twoWay: true, text: "Found an apprenticeship info session. Needs a bank account for direct deposit." }
      ],
      events: [{ title: "Apprenticeship info session", d: 7, time: "17:00", type: "appt", loc: "IBEW Local 595", notes: "Bring ID" }] },
    { id: "a-andre", name: "Andre Wilson", cm: "jane", rel: 55, stage: "stabilizing", phone: "(408) 555-0255", email: "andre.w@email.com", loc: "San Jose, CA", facility: "San Quentin SQRC",
      housing: { status: "transitional", detail: "Transitional house, month 2 of 6." },
      sup: { type: "Parole", officer: "Officer M. Diaz", cadence: "Every two weeks", conditions: "Curfew 10pm", end: 330 },
      emp: { status: "Job searching", detail: "Wants logistics or dispatch" },
      goals: ["Dispatcher job"], barriers: ["No driver's license"],
      std: "dddddidd",
      custom: [],
      notes: [
        { d: -15, by: "jane", kind: "call", twoWay: true, text: "Resume done. Applying to dispatcher and logistics jobs." },
        { d: -5, by: "jane", kind: "call", twoWay: true, text: "Has two phone screens next week. Practiced short answers." }
      ],
      events: [{ title: "Phone screen – freight dispatch", d: 3, time: "15:00", type: "interview", loc: "Phone", notes: "" }] },

    /* ---------------- TOM ---------------- */
    { id: "a-keisha", name: "Keisha Brown", cm: "tom", rel: 60, stage: "stabilizing", phone: "(510) 555-0311", email: "keisha.b@email.com", loc: "Oakland, CA", facility: "CCWF",
      housing: { status: "transitional", detail: "Transitional program for women." },
      sup: { type: "Parole", officer: "Officer T. Huang", cadence: "Weekly", conditions: "Curfew 9pm", end: 300 },
      emp: { status: "Not working", detail: "Was looking at childcare work" },
      goals: ["Rebuild contact with her daughter", "Childcare job"], barriers: ["Missed check-ins", "Stress"],
      std: "ddddddii",
      custom: [],
      notes: [
        { d: -30, by: "tom", kind: "call", twoWay: true, text: "Good talk. She wants to be around for her daughter's school year. Feeling hopeful." },
        { d: -19, by: "tom", kind: "call", twoWay: true, text: "Last time we spoke. She sounded tired, said things were hard at the program but did not want to get into it." },
        { d: -14, by: "tom", kind: "voicemail", twoWay: false, text: "Left a voicemail. No answer." },
        { d: -8, by: "tom", kind: "text", twoWay: false, text: "Texted to check in. No reply." },
        { d: -4, by: "tom", kind: "collateral", twoWay: false, text: "Officer Huang reports two missed supervision check-ins in the last two weeks." }
      ],
      events: [{ title: "Parole check-in", d: 1, time: "10:00", type: "parole", loc: "Oakland Parole", notes: "" }] },
    { id: "a-luis", name: "Luis Ramirez", cm: "tom", rel: 6, stage: "first30", phone: "(209) 555-0322", email: "", loc: "Stockton, CA", facility: "Folsom",
      housing: { status: "family", detail: "With his parents in Stockton." },
      sup: { type: "Parole", officer: "Officer B. Ortiz", cadence: "Weekly", conditions: "Curfew 10pm", end: 600 },
      emp: { status: "Not working", detail: "" },
      goals: [], barriers: [],
      std: "nnnnnnnn",
      custom: [],
      notes: [
        { d: -5, by: "tom", kind: "call", twoWay: true, text: "Intake call. Released 6 days ago. Staying with his parents. Quiet but willing. Will call again next week." }
      ],
      events: [] },
    { id: "a-terrence", name: "Terrence Moore", cm: "tom", rel: 120, stage: "stable", phone: "(510) 555-0333", email: "terrence.m@email.com", loc: "Oakland, CA", facility: "San Quentin SQRC",
      housing: { status: "housed", detail: "Own studio apartment." },
      sup: { type: "Parole", officer: "Officer D. Alvarez", cadence: "Monthly", conditions: "Standard conditions", end: 180 },
      emp: { status: "Employed", detail: "Peer mentor assistant, part time" },
      goals: ["Become a certified peer mentor"], barriers: [],
      std: "dddddddd",
      custom: [],
      notes: [
        { d: -22, by: "tom", kind: "visit", twoWay: true, text: "Coffee meeting. He is mentoring two newly released men informally." },
        { d: -7, by: "tom", kind: "call", twoWay: true, text: "Signed up for the peer mentor certification." }
      ],
      events: [] },
    { id: "a-angela", name: "Angela Nguyen", cm: "tom", rel: 38, stage: "stabilizing", phone: "(408) 555-0344", email: "angela.n@email.com", loc: "San Jose, CA", facility: "CCWF",
      housing: { status: "family", detail: "With her sister." },
      sup: { type: "Probation", officer: "Officer M. Diaz", cadence: "Every two weeks", conditions: "Counseling attendance", end: 280 },
      emp: { status: "Job searching", detail: "Wants office admin work" },
      goals: ["Office admin job"], barriers: ["Anxiety in interviews"],
      std: "dddddddi",
      custom: [{ title: "Complete two practice interviews with Jane", detail: "Build confidence.", due: 9, status: "open", by: "tom" }],
      notes: [
        { d: -16, by: "tom", kind: "call", twoWay: true, text: "Talked about interview nerves. Referred her to Jane for practice interviews." },
        { d: -6, by: "tom", kind: "call", twoWay: true, text: "Attending counseling weekly. Applied to 4 admin jobs." }
      ],
      events: [{ title: "Counseling session", d: 2, time: "16:00", type: "appt", loc: "Valley Counseling", notes: "" }] },
    { id: "a-jamal", name: "Jamal Rivers", cm: "tom", rel: 15, stage: "first30", phone: "(510) 555-0355", email: "jamal.r@email.com", loc: "Oakland, CA", facility: "San Quentin SQRC",
      housing: { status: "shelter", detail: "Shelter, 90 day limit." },
      sup: { type: "Parole", officer: "Officer D. Alvarez", cadence: "Weekly", conditions: "Curfew 10pm", end: 450 },
      emp: { status: "Not working", detail: "Interested in culinary work" },
      goals: ["Kitchen job"], barriers: ["Needs ID"],
      std: "idinnnnn",
      custom: [],
      notes: [
        { d: -14, by: "tom", kind: "call", twoWay: true, text: "Intake. Strong cooking background from the prison kitchen." },
        { d: -4, by: "tom", kind: "call", twoWay: true, text: "ID in progress. Social Security card next. Excited about a culinary training program." }
      ],
      events: [{ title: "Culinary program info call", d: 5, time: "11:30", type: "appt", loc: "Phone", notes: "" }] },
    { id: "a-carlos", name: "Carlos Mendez", cm: "tom", rel: 200, stage: "stable", phone: "(510) 555-0366", email: "carlos.m@email.com", loc: "Hayward, CA", facility: "Folsom",
      housing: { status: "housed", detail: "Rents an apartment with his partner." },
      sup: { type: "None", officer: "", cadence: "", conditions: "Parole completed", end: null },
      emp: { status: "Employed", detail: "Journeyman electrician, full time" },
      goals: ["Save for a down payment"], barriers: [],
      std: "dddddddd",
      custom: [],
      notes: [
        { d: -40, by: "tom", kind: "call", twoWay: true, text: "Finished parole. Celebrated. Working full time." },
        { d: -12, by: "tom", kind: "text", twoWay: true, text: "Thanked us and offered to speak at a TLM event." }
      ],
      events: [] }
  ];

  /* ---------- Portal activity seeds (self-reported: what the alumnus did in the participant app) ----------
   * Each alumnus gets r.portal = [{d, kind, text, metric, delta, value, skill}] (d = day offset, like notes),
   * r.pb = starting values before the log window {skills: avg %, apps: count, resume: % or null},
   * r.dd = {stdTaskNumber: dayOffset} for standard tasks finished on a known day (doneDate).
   * Kinds: login | task_done | skill_progress | skill_done | application | resume_scan | assessment.
   * Stories: Marcus active since the last call; Keisha silent 19+ days; Anthony no portal use (no phone);
   * Devon many applications; everyone else light. */
  function L(d) { return { d: d, kind: "login", text: "Signed in to the portal", metric: "logins", delta: 1 }; }
  function S(d, name, from, to) { return { d: d, kind: to >= 100 ? "skill_done" : "skill_progress", text: to >= 100 ? "Completed " + name + " (" + from + "% → 100%)" : name + " " + from + "% → " + to + "%", metric: "skills", delta: to - from, skill: name }; }
  function J(d, title, via) { return { d: d, kind: "application", text: (via ? "Job Agent applied to " : "Applied to ") + title, metric: "apps", delta: 1 }; }
  function RS(d, from, to) { return { d: d, kind: "resume_scan", text: "Resume scan " + from + "% → " + to + "%", metric: "resume", delta: to - from, value: to }; }
  function AS(d, text) { return { d: d, kind: "assessment", text: "Assessment: " + text, metric: null, delta: 0 }; }
  function TD(d, n) { return { d: d, kind: "task_done", text: "Marked done: " + STD_TASKS[n - 1].name, metric: "first30", delta: 1, std: n }; }
  var PORTAL_SEED = {
    "a-marcus": { pb: { skills: 0, apps: 0, resume: 62 }, dd: { 5: -1 }, portal: [L(-22), AS(-21, "Career interests (logistics and operations)"), S(-20, "Resume Writing", 85, 100), L(-16), RS(-16, 62, 70), L(-12), S(-10, "Communication", 77, 92), L(-6), L(-2), S(-2, "Interview Skills", 70, 85), RS(-2, 70, 85), J(-2, "Warehouse Associate, Amazon (Oakland)", true), L(-1), J(-1, "Shift Lead, Sysco Oakland"), TD(-1, 5), S(-1, "Digital Literacy", 63, 78), L(0)] },
    "a-anthony": { pb: { skills: 0, apps: 0, resume: null }, portal: [] },
    "a-darnell": { pb: { skills: 45, apps: 1, resume: 70 }, portal: [L(-15), L(-5), S(-5, "Forklift Safety Refresher", 50, 75)] },
    "a-rosa": { pb: { skills: 80, apps: 0, resume: 88 }, portal: [L(-12), AS(-12, "Monthly budget check-up")] },
    "a-isaiah": { pb: { skills: 20, apps: 2, resume: 60 }, portal: [L(-10), L(-3), J(-3, "Warehouse Associate, Target DC"), L(-1), J(-1, "Delivery Helper, UPS Richmond")] },
    "a-monica": { pb: { skills: 10, apps: 0, resume: null }, portal: [L(-4), AS(-4, "Career interests (healthcare admin)")] },
    "a-devon": { pb: { skills: 55, apps: 2, resume: 58 }, portal: [L(-16), RS(-13, 58, 79), L(-14), J(-14, "Help Desk Technician, Kaiser"), J(-14, "IT Support Specialist, Oakland USD"), L(-13), J(-13, "Service Desk Analyst, Clorox"), J(-13, "Desktop Support, Alameda County"), L(-12), J(-12, "IT Help Desk, Bay Tech Partners"), J(-12, "Tech Support Rep, Comcast"), L(-7), S(-7, "Interview Skills", 60, 80), L(-1), J(-1, "IT Support Technician, East Bay Health", true), L(0), J(0, "Help Desk Analyst, Peralta Colleges", true)] },
    "a-tasha": { pb: { skills: 5, apps: 0, resume: null }, portal: [L(-7), L(-2), S(-2, "Customer Service Basics", 0, 25)] },
    "a-brian": { pb: { skills: 30, apps: 0, resume: 72 }, portal: [L(-20), L(-8), L(-3), S(-3, "Google IT Support (intro)", 0, 15)] },
    "a-maya": { pb: { skills: 90, apps: 0, resume: 90 }, portal: [L(-18)] },
    "a-gregory": { pb: { skills: 25, apps: 0, resume: 58 }, portal: [L(-9), RS(-9, 58, 65), L(-4), J(-4, "Pre-apprentice, IBEW Local 595")] },
    "a-andre": { pb: { skills: 35, apps: 3, resume: 66 }, portal: [L(-12), RS(-12, 66, 81), L(-6), J(-6, "Dispatcher, Bay Freight"), L(-3), J(-3, "Logistics Coordinator, XPO")] },
    "a-keisha": { pb: { skills: 20, apps: 0, resume: 55 }, portal: [L(-40), L(-33), AS(-33, "Career interests (childcare)"), RS(-33, 55, 64), L(-27), S(-27, "Childcare Basics", 20, 40), L(-24), J(-24, "Assistant Teacher, Bright Start Daycare"), L(-21), L(-19)] },
    "a-luis": { pb: { skills: 0, apps: 0, resume: null }, portal: [L(-2)] },
    "a-terrence": { pb: { skills: 70, apps: 0, resume: 80 }, portal: [L(-6), S(-6, "Peer Mentoring Foundations", 30, 55)] },
    "a-angela": { pb: { skills: 40, apps: 0, resume: 74 }, portal: [L(-10), J(-8, "Office Assistant, Valley Medical"), J(-8, "Receptionist, San Jose Library"), L(-7), J(-7, "Admin Clerk, Santa Clara County"), J(-7, "Front Desk, Hilton San Jose"), L(-2), S(-2, "Interview Skills", 40, 55), J(-2, "Office Assistant, City of San Jose")] },
    "a-jamal": { pb: { skills: 10, apps: 0, resume: null }, portal: [L(-3), AS(-3, "Work style quiz")] },
    "a-carlos": { pb: { skills: 95, apps: 0, resume: 92 }, portal: [L(-20)] }
  };
  RAW.forEach(function (r) { var p = PORTAL_SEED[r.id]; if (p) { r.portal = p.portal; r.pb = p.pb; r.dd = p.dd || {}; } });

  function build(r) {
    var a = JSON.parse(JSON.stringify(r));
    a.releaseDate = iso(-r.rel);
    a.dayN = r.rel + 1; // day number since release
    a.sup.endDate = r.sup.end == null ? null : iso(r.sup.end);
    var tn = 0, lastTw = -1;
    r.notes.forEach(function (n) { if (n.twoWay && (lastTw === -1 || n.d > lastTw)) lastTw = n.d; });
    a.tasks = STD_TASKS.map(function (t, i) {
      tn++;
      var c = r.std[i], dd = r.dd && r.dd[i + 1] != null ? r.dd[i + 1] : Math.max(-r.rel, Math.min(-r.rel + 2 + 2 * i, lastTw - 1));
      return { id: "T" + tn, std: true, title: t.name, phase: t.phase, status: c === "d" ? "done" : c === "i" ? "in_progress" : "open", due: null, detail: "", assignedBy: "john", doneBy: c === "d" ? "alumnus" : null, doneDate: c === "d" ? iso(dd) : null };
    });
    (r.custom || []).forEach(function (t) {
      tn++;
      a.tasks.push({ id: "T" + tn, std: false, title: t.title, phase: "", status: t.status, due: iso(t.due), detail: t.detail, assignedBy: t.by, doneBy: t.status === "done" ? "alumnus" : null, doneDate: t.status === "done" && t.doneD != null ? iso(t.doneD) : null });
    });
    a.notes = r.notes.map(function (n, i) { return { id: "N" + (i + 1), date: iso(n.d), by: n.by, kind: n.kind, twoWay: !!n.twoWay, text: n.text }; });
    a.events = r.events.map(function (e, i) { return { id: "E" + (i + 1), title: e.title, date: iso(e.d), time: e.time, type: e.type, loc: e.loc || "", notes: e.notes || "" }; });
    var CALLS = { "a-marcus": [1, "10:30"], "a-anthony": [0, "15:00"], "a-darnell": [2, "09:30"], "a-isaiah": [1, "13:00"], "a-monica": [3, "11:00"], "a-devon": [1, "14:00"], "a-tasha": [0, "11:30"], "a-gregory": [4, "10:00"], "a-andre": [2, "16:00"], "a-keisha": [1, "12:00"], "a-luis": [2, "10:30"], "a-angela": [3, "15:30"], "a-jamal": [5, "09:00"], "a-brian": [8, "12:30"] };
    if (CALLS[r.id]) a.events.push({ id: "E" + (a.events.length + 1), title: "Check-in call", date: iso(CALLS[r.id][0]), time: CALLS[r.id][1], type: "case-manager", loc: "Phone", notes: "" });
    a.handoffs = [];
    // portal activity log, oldest first, ids P1.. (self-reported by the alumnus in the app)
    var pl = (r.portal || []).map(function (p, i) { return { p: p, i: i }; }).sort(function (x, y) { return x.p.d - y.p.d || x.i - y.i; });
    a.portal = { base: r.pb || { skills: 0, apps: 0, resume: null }, log: pl.map(function (x, i) { var p = x.p, e = { id: "P" + (i + 1), date: iso(p.d), kind: p.kind, text: p.text, metric: p.metric || null, delta: p.delta || 0 }; if (p.value != null) e.value = p.value; if (p.skill) e.skill = p.skill; if (p.std) e.std = p.std; return e; }), lastLogin: null };
    a.portal.log.forEach(function (e) { if (e.kind === "login") a.portal.lastLogin = e.date; });
    delete a.pb; delete a.dd;
    // standard tasks were assigned by the owning case manager
    a.tasks.forEach(function (t) { t.assignedBy = r.cm; });
    return a;
  }

  window.RX_DATA = {
    iso: iso, D: D, STD_TASKS: STD_TASKS, STAGES: STAGES, CMS: CMS,
    build: function () { return RAW.map(build); }
  };
})();
