// The agent pipeline for the hub site (source of truth; app/ holds the Python reference version). Lines marked "TLM demo:" are hub-specific.
// POST /api/agent/step  {stage: "intake"|"orchestrator"|"finder"|"judge"|"ranker", ...inputs}
// Streams activity events as server-sent events and ends with {type: "result", data} (or {type: "step_error"}).
import Anthropic from "@anthropic-ai/sdk";
import { Counters } from "../../_agent/agent";
import { Snapshot } from "../../_agent/tools";
import { find, intake, judge, orchestrate, rank } from "../../_agent/stages";

interface Env {
  ANTHROPIC_API_KEY: string;
  CAREERONESTOP_USER_ID?: string;
  CAREERONESTOP_TOKEN?: string;
  ASSETS: { fetch: (r: Request | string) => Promise<Response> };
}

const STAGES: Record<string, (ctx: any, body: any) => Promise<any>> = {
  intake, orchestrator: orchestrate, finder: find, judge, ranker: rank,
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  // TLM demo: cap request size, and only accept a structured profile at intake (no free text), so the
  // password-protected site can't be used to run arbitrary prompts. Sample data only.
  const raw = await request.text();
  if (raw.length > 400000) return Response.json({ error: "request too large" }, { status: 413 });
  let body: any;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  if (body?.stage === "intake" && (!body.profile || typeof body.profile !== "object")) return Response.json({ error: "intake needs a structured profile" }, { status: 400 });
  if (body?.stage !== "intake" && (!body?.profile || typeof body.profile !== "object")) return Response.json({ error: "missing profile" }, { status: 400 });
  const handler = STAGES[body?.stage];
  if (!handler) return Response.json({ error: "unknown stage" }, { status: 400 });
  if (!env.ANTHROPIC_API_KEY) return Response.json({ error: "ANTHROPIC_API_KEY is not set for this Pages project" }, { status: 500 });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = async (ev: unknown) => { try { await writer.write(enc.encode(`data: ${JSON.stringify(ev)}\n\n`)); } catch { /* client left */ } };

  const counters: Counters = { programs_checked: 0, sources_searched: 0 };
  const ctx = {
    client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 }),
    emit: send, counters, env,
    snapshot: new Snapshot(env.ASSETS, new URL(request.url).origin),
  };
  // Keep-alive comments so proxies don't drop a quiet stream while an agent thinks.
  const ping = setInterval(() => { writer.write(enc.encode(`: ping\n\n`)).catch(() => {}); }, 10000);

  const work = (async () => {
    try {
      const data = await handler(ctx, body);
      await send({ type: "result", data, counters });
    } catch (e: any) {
      await send({ type: "step_error", agent: body.stage, message: String(e?.message ?? e).slice(0, 300) });
    } finally {
      clearInterval(ping);
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();
  waitUntil(work);

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
};
