// Browser-side runner for the Cloudflare deploy: runs each agent as its own /api/step call
// (so no single function call exceeds Cloudflare's limits) and replays their events into the UI
// exactly like the Python server's /api/run stream. app.js calls window.runStepwise when present.
(function () {
  "use strict";

  async function readSSE(stream, onEvent) {
    const reader = stream.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const flush = (block) => {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
      if (!data) return;
      try { onEvent(JSON.parse(data)); } catch (_) { /* ignore */ }
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let m;
      while ((m = buf.match(/\r?\n\r?\n/))) { flush(buf.slice(0, m.index)); buf = buf.slice(m.index + m[0].length); }
    }
    if (buf.trim()) flush(buf);
  }

  async function step(payload, emit, totals) {
    const resp = await fetch("/api/step", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok || !resp.body) {
      let msg = "Server responded " + resp.status;
      try { msg = (await resp.json()).error || msg; } catch (_) { /* keep */ }
      throw new Error(msg);
    }
    let result = null, failure = null;
    const base = { p: totals.programs_checked, s: totals.sources_searched };
    await readSSE(resp.body, (ev) => {
      if (ev.type === "result") {
        result = ev.data;
        if (ev.counters) {
          totals.programs_checked = base.p + ev.counters.programs_checked;
          totals.sources_searched = base.s + ev.counters.sources_searched;
          totals.flush();
        }
      } else if (ev.type === "step_error") {
        failure = ev.message || "step failed";
      } else if (ev.type === "stats") {
        // Per-call counters: add them on top of the running totals of finished and parallel calls.
        totals.live[payload.stage + (payload.brief ? payload.brief.finder : payload.finder || "")] = ev;
        totals.flush();
      } else {
        emit(ev);
      }
    });
    delete totals.live[payload.stage + (payload.brief ? payload.brief.finder : payload.finder || "")];
    if (failure) throw new Error(failure);
    if (!result) throw new Error("The " + payload.stage + " step ended early");
    return result;
  }

  window.runStepwise = async function (body, emit) {
    const t0 = performance.now();
    const totals = {
      programs_checked: 0, sources_searched: 0, live: {},
      flush() {
        let p = this.programs_checked, s = this.sources_searched;
        for (const k in this.live) { p += this.live[k].programs_checked || 0; s += this.live[k].sources_searched || 0; }
        emit({ type: "stats", programs_checked: p, sources_searched: s });
      },
    };

    let request = body;
    if (body.preset_id) {
      const presets = await (await fetch("/data/presets.json")).json();
      const match = presets.find((p) => p.id === body.preset_id);
      if (!match) throw new Error("Unknown preset");
      request = { profile: match.profile };
    }

    const { profile } = await step({ stage: "intake", ...request }, emit, totals);
    const orch = await step({ stage: "orchestrator", profile }, emit, totals);

    // Each finder's results go to the eligibility judge as soon as that finder is done.
    const judgedLists = await Promise.all(orch.briefs.map(async (brief) => {
      let candidates = [];
      try {
        candidates = (await step({ stage: "finder", profile, brief }, emit, totals)).candidates || [];
      } catch (e) {
        emit({ type: "error", agent: brief.finder, message: "Finder stopped: " + e.message });
        return [];
      }
      if (!candidates.length) return [];
      try {
        return (await step({ stage: "judge", profile, finder: brief.finder, candidates }, emit, totals)).judged || [];
      } catch (e) {
        emit({ type: "error", agent: "eligibility", message: "Eligibility check failed; kept as worth applying: " + e.message });
        return candidates.map((c) => ({ ...c, verdict: "worth_applying", reason: "Eligibility not checked; confirm with the program.", confirm_question: "Am I eligible?" }));
      }
    }));
    const judged = judgedLists.flat();

    const ranked = await step({ stage: "ranker", profile, needs: orch.needs, judged }, emit, totals);
    const plan = {
      profile,
      sections: ranked.sections,
      act_today: ranked.act_today,
      excluded: judged.filter((j) => j.verdict === "not_eligible"),
      stats: {
        programs_checked: totals.programs_checked,
        sources_searched: totals.sources_searched,
        est_minutes_saved: totals.sources_searched * 3,
        seconds: Math.round((performance.now() - t0) / 100) / 10,
        candidates_judged: judged.length,
      },
    };
    emit({ type: "done", plan });
  };
})();
