// Password gate for the whole site (page, scripts, data and every /api route).
// Uses the browser's built-in sign-in box (HTTP Basic auth). Any username works; the password must match
// the SITE_PASSWORD secret (or DEMO_USER + DEMO_PASSWORD), set with: npx wrangler pages secret put SITE_PASSWORD --project-name tlm-reentry-agents
// Fails closed: if the secret is missing, nobody gets in.
const REALM = 'Basic realm="TLM Reentry Hub (prototype)", charset="UTF-8"';

function deny(status, msg) {
  return new Response(msg, { status, headers: { "WWW-Authenticate": REALM, "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
}

async function same(a, b) {
  // hash both so lengths match, then compare in constant time
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(x, y) : Buffer.from(x).equals(Buffer.from(y));
}

export async function onRequest(context) {
  // SITE_PASSWORD (any username) is this project's secret. A Pages project set up for the agents-only prototype
  // has DEMO_PASSWORD (and DEMO_USER) instead; accept those, and require the username when DEMO_USER is set.
  const env = context.env, want = env.SITE_PASSWORD || env.DEMO_PASSWORD, wantUser = env.SITE_PASSWORD ? "" : env.DEMO_USER || "";
  if (!want) return new Response("Site password is not set up yet.", { status: 503, headers: { "Cache-Control": "no-store" } });
  const h = context.request.headers.get("Authorization") || "";
  if (h.startsWith("Basic ")) {
    let pass = "", user = "";
    try { const raw = atob(h.slice(6)); user = raw.slice(0, raw.indexOf(":")); pass = raw.slice(raw.indexOf(":") + 1); } catch (e) {}
    if ((await same(pass, want)) && (!wantUser || (await same(user, wantUser)))) return context.next();
  }
  return deny(401, "Password required.");
}
