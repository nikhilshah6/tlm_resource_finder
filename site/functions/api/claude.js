// POST /api/claude: server-side proxy to the Claude Messages API so no key ever reaches the browser.
// The hub's existing code (and cf-shim.js) sends Messages API bodies here. Only sample data is used in this prototype.
import Anthropic from "@anthropic-ai/sdk";

// Models the prototype may call. claude-sonnet-4-6 is what the hub's original features name.
const ALLOWED = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-sonnet-4-6"];
const MAX_TOKENS = 16000;
const KEEP = ["model", "max_tokens", "system", "messages", "tools", "tool_choice", "thinking", "output_config", "metadata", "stop_sequences"];

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return err(500, "config_error", "The server has no ANTHROPIC_API_KEY secret set.");
  let body;
  try { body = await request.json(); } catch (e) { return err(400, "invalid_request_error", "Body must be JSON."); }
  if (!body || !Array.isArray(body.messages)) return err(400, "invalid_request_error", "messages is required.");
  const params = {};
  KEEP.forEach((k) => { if (body[k] !== undefined) params[k] = body[k]; });
  if (!ALLOWED.includes(params.model)) params.model = "claude-opus-5-5";
  params.max_tokens = Math.min(Number(params.max_tokens) || 4096, MAX_TOKENS);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const msg = await client.messages.create(params);
    return new Response(JSON.stringify(msg), { headers: { "content-type": "application/json" } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return err(429, "rate_limit_error", "Too many requests to Claude right now. Try again in a minute.");
    if (e instanceof Anthropic.BadRequestError) return err(400, "invalid_request_error", e.message);
    if (e instanceof Anthropic.APIError) return err(e.status || 502, "api_error", e.message);
    return err(502, "api_error", "Couldn't reach Claude.");
  }
}
function err(status, type, message) { return new Response(JSON.stringify({ type: "error", error: { type, message } }), { status, headers: { "content-type": "application/json" } }); }
