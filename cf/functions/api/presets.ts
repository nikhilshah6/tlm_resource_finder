// GET /api/presets -> [{id, label, summary}] from the static presets file.
export const onRequestGet: PagesFunction<{ ASSETS: { fetch: (r: Request) => Promise<Response> } }> = async ({ request, env }) => {
  const r = await env.ASSETS.fetch(new Request(new URL("/data/presets.json", request.url)));
  const presets: any[] = r.ok ? await r.json() : [];
  return Response.json(presets.map((p) => ({ id: p.id, label: p.label, summary: p.summary })));
};
