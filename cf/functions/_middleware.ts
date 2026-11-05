// Sign-in gate so a public URL can't spend the Anthropic key.
// A plain HTML sign-in form (works in every browser, unlike Basic-auth dialogs) sets an HttpOnly cookie.
// Set DEMO_USER and DEMO_PASSWORD as Pages secrets. If DEMO_PASSWORD is unset, the gate is off.
interface Env { DEMO_USER?: string; DEMO_PASSWORD?: string }

const COOKIE = "tlm_demo";

async function token(env: Env): Promise<string> {
  const data = new TextEncoder().encode(`tlm-reentry-agents|${env.DEMO_USER || ""}|${env.DEMO_PASSWORD}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function page(error = ""): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in · Reentry Resource Agents</title>
<style>
:root{--bg:#f6f7f5;--card:#fff;--ink:#1c2420;--muted:#5b665f;--accent:#1f6b4f;--line:#d9ded9;--err:#a33a2b}
@media (prefers-color-scheme:dark){:root{--bg:#121614;--card:#1b211e;--ink:#e8ede9;--muted:#a3ada6;--accent:#6fcaa2;--line:#2d3631;--err:#f08a7a}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:18px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px}
form{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px;width:100%;max-width:380px}
h1{font-size:22px;margin:0 0 4px}p{margin:0 0 20px;color:var(--muted);font-size:16px}
label{display:block;font-size:15px;font-weight:600;margin:12px 0 6px}
input{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink)}
input:focus{outline:3px solid var(--accent);outline-offset:1px}
button{margin-top:20px;width:100%;font:inherit;font-weight:600;padding:11px;border:0;border-radius:8px;background:var(--accent);color:var(--bg);cursor:pointer}
.err{color:var(--err);font-size:15px;margin-top:12px}
</style></head><body>
<form method="post" action="/__login">
<h1>Reentry Resource Agents</h1><p>The Last Mile · prototype with fictional profiles</p>
<label for="u">Username</label><input id="u" name="user" autocomplete="username" required>
<label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Sign in</button>${error ? `<div class="err" role="alert">${error}</div>` : ""}
</form></body></html>`;
  return new Response(html, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  if (!env.DEMO_PASSWORD) return next();
  const url = new URL(request.url);
  const expected = await token(env);

  if (url.pathname === "/__login" && request.method === "POST") {
    const form = await request.formData();
    const okUser = !env.DEMO_USER || form.get("user") === env.DEMO_USER;
    if (okUser && form.get("password") === env.DEMO_PASSWORD) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
        },
      });
    }
    return page("That username or password didn't match.");
  }

  const cookies = request.headers.get("Cookie") || "";
  const has = cookies.split(/;\s*/).some((c) => c === `${COOKIE}=${expected}`);
  if (has) return next();
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/data/")) {
    return Response.json({ error: "Sign in first" }, { status: 401 });
  }
  return page();
};
