// GET /api/geo?zip=94607 -> { zip, city, state, stateName, lat, lon, county, countyFips }
import { zipLookup } from "../../lib/geo.js";
export async function onRequestGet({ request }) {
  const zip = new URL(request.url).searchParams.get("zip") || "";
  try { return new Response(JSON.stringify(await zipLookup(zip)), { headers: { "content-type": "application/json", "cache-control": "public, max-age=604800" } }); }
  catch (e) { return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 400, headers: { "content-type": "application/json" } }); }
}
