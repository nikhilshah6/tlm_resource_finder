// The agent pipeline for the hub site (source of truth; app/ holds the Python reference version). Lines marked "TLM demo:" are hub-specific.
// Async agent loop over the Messages API for Cloudflare Pages Functions.
// Mirrors app/agents/base.py: every API/web call is reported to the live feed, and each agent
// ends by calling a `submit` tool whose input is its structured result.
import Anthropic from "@anthropic-ai/sdk";

export const OPUS = "claude-opus-5-5";
export const SONNET = "claude-sonnet-5-5";

export type Emit = (ev: Record<string, unknown>) => Promise<void>;

export interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  fn: (input: any) => Promise<unknown> | unknown;
  label?: (input: any) => string;
  countsAsSource?: boolean;
}

export interface Counters {
  programs_checked: number;
  sources_searched: number;
}

export function webTools(city: string | undefined, searchUses = 5, fetchUses = 3): any[] {
  const loc: Record<string, string> = { type: "approximate", region: "California", country: "US", timezone: "America/Los_Angeles" };
  if (city) loc.city = city;
  return [
    { type: "web_search_20260209", name: "web_search", max_uses: searchUses, user_location: loc },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: fetchUses },
  ];
}

let useFallbacks = true;

async function create(client: Anthropic, params: any): Promise<any> {
  if (useFallbacks) {
    try {
      return await (client.beta.messages as any)
        .stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
        .finalMessage();
    } catch (e: any) {
      if (!(e instanceof Anthropic.BadRequestError) || !String(e.message).toLowerCase().includes("fallback")) throw e;
      useFallbacks = false;
    }
  }
  return await client.messages.stream(params).finalMessage();
}

// Models occasionally send an array/object field as a JSON string; decode it.
function decodeFields(input: any): any {
  if (!input || typeof input !== "object") return input;
  const out: any = Array.isArray(input) ? [] : {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string" && /^\s*[\[{]/.test(v)) {
      try { out[k] = JSON.parse(v); continue; } catch { /* keep string */ }
    }
    out[k] = v;
  }
  return out;
}

function jsonFromText(text: string): any | null {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

export async function runAgent(opts: {
  client: Anthropic;
  agent: string;
  model: string;
  system: string;
  user: string;
  submitSchema: Record<string, unknown>;
  submitDescription: string;
  emit: Emit;
  counters: Counters;
  tools?: Tool[];
  serverTools?: any[];
  effort?: "low" | "medium" | "high";
  maxTurns?: number;
}): Promise<any> {
  const { client, agent, emit, counters } = opts;
  const tools = opts.tools ?? [];
  const byName = new Map(tools.map((t) => [t.name, t]));
  const toolSpecs = [
    ...tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    ...(opts.serverTools ?? []),
    { name: "submit", description: opts.submitDescription, input_schema: opts.submitSchema },
  ];
  const messages: any[] = [{ role: "user", content: opts.user }];
  const reported = new Set<string>();
  let nudged = false;

  for (let turn = 0; turn < (opts.maxTurns ?? 12); turn++) {
    const resp = await create(opts.client, {
      model: opts.model, max_tokens: 32000, system: opts.system, messages, tools: toolSpecs,
      thinking: { type: "adaptive" }, output_config: { effort: opts.effort ?? "medium" },
    });

    for (const b of resp.content) {
      if (b.type === "server_tool_use" && (b.name === "web_search" || b.name === "web_fetch")) {
        const inp = (b.input ?? {}) as any;
        const key = b.name + JSON.stringify(inp);
        if (reported.has(b.id) || reported.has(key)) continue;
        reported.add(b.id); reported.add(key);
        counters.sources_searched += 1;
        await emit(b.name === "web_search"
          ? { type: "tool_call", agent, tool: "web_search", message: `Web search: ${inp.query ?? ""}` }
          : { type: "tool_call", agent, tool: "web_fetch", message: `Reading ${inp.url ?? ""}` });
      } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        counters.programs_checked += b.content.length;
      }
    }
    await emit({ type: "stats", programs_checked: counters.programs_checked, sources_searched: counters.sources_searched });

    messages.push({ role: "assistant", content: resp.content });
    if (resp.stop_reason === "pause_turn") continue;
    if (resp.stop_reason === "refusal") throw new Error(`${agent} agent declined the request`);

    const uses = resp.content.filter((b: any) => b.type === "tool_use");
    if (!uses.length) {
      const text = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      const parsed = jsonFromText(text);
      if (parsed) return decodeFields(parsed);
      if (nudged) throw new Error(`${agent} agent finished without submitting results`);
      nudged = true;
      messages.push({ role: "user", content: "Call the submit tool now with your final results." });
      continue;
    }

    let submitted: any = null;
    const results: any[] = [];
    const calls = uses.filter((u: any) => u.name !== "submit" && byName.has(u.name));
    for (const u of uses) {
      if (u.name === "submit") {
        submitted = decodeFields(u.input);
        results.push({ type: "tool_result", tool_use_id: u.id, content: "Received." });
      } else if (!byName.has(u.name)) {
        results.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: `Unknown tool ${u.name}` });
      }
    }
    const outs = await Promise.all(calls.map((u: any) => callTool(byName.get(u.name)!, u.input ?? {}, agent, emit, counters)));
    calls.forEach((u: any, i: number) => results.push({ type: "tool_result", tool_use_id: u.id, content: outs[i] }));
    if (submitted) return submitted;
    messages.push({ role: "user", content: results });
  }
  throw new Error(`${agent} agent ran out of turns`);
}

async function callTool(t: Tool, input: any, agent: string, emit: Emit, counters: Counters): Promise<string> {
  try {
    const label = t.label?.(input);
    if (label) await emit({ type: "tool_call", agent, tool: t.name, message: label });
  } catch { /* label is cosmetic */ }
  let out: any;
  try {
    out = await Promise.race([
      Promise.resolve(t.fn(input)),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), 20000)),
    ]);
  } catch (e: any) {
    out = { error: `${t.name} failed: ${e?.message ?? e}` };
  }
  if (t.countsAsSource !== false) counters.sources_searched += 1;
  if (Array.isArray(out)) counters.programs_checked += out.length;
  else if (out && out.error) await emit({ type: "error", agent, message: out.error });
  return JSON.stringify(out).slice(0, 60000);
}
