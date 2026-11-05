// Password gate (HTTP Basic auth) so a public URL can't spend the Anthropic key.
// Set DEMO_USER and DEMO_PASSWORD as Pages secrets. If DEMO_PASSWORD is unset, the gate is off.
export const onRequest: PagesFunction<{ DEMO_USER?: string; DEMO_PASSWORD?: string }> = async ({ request, env, next }) => {
  if (!env.DEMO_PASSWORD) return next();
  const header = request.headers.get("Authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const [user, ...rest] = atob(header.slice(6)).split(":");
      if ((!env.DEMO_USER || user === env.DEMO_USER) && rest.join(":") === env.DEMO_PASSWORD) return next();
    } catch { /* fall through */ }
  }
  return new Response("Sign in to use the reentry agents demo.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="TLM reentry agents", charset="UTF-8"' },
  });
};
