// ZIP -> place lookup (no keys): zippopotam.us for city/state/lat-lon, FCC Area API for county.
// Only the ZIP leaves the server; nothing about the person is sent.
const UA = { "User-Agent": "TLM-reentry-hub-prototype/0.1" };

export async function zipLookup(zip, fetchFn = fetch) {
  if (!/^\d{5}$/.test(String(zip || ""))) throw new Error("ZIP must be 5 digits");
  const r = await fetchFn("https://api.zippopotam.us/us/" + zip, { headers: UA });
  if (!r.ok) throw new Error("ZIP not found");
  const j = await r.json();
  const p = (j.places || [])[0];
  if (!p) throw new Error("ZIP not found");
  const geo = { zip: String(zip), city: p["place name"], state: p["state abbreviation"], stateName: p.state, lat: Number(p.latitude), lon: Number(p.longitude), county: null, countyFips: null };
  try {
    const c = await fetchFn(`https://geo.fcc.gov/api/census/area?lat=${geo.lat}&lon=${geo.lon}&format=json`, { headers: UA });
    if (c.ok) { const cj = await c.json(); const res = (cj.results || [])[0]; if (res) { geo.county = res.county_name; geo.countyFips = res.county_fips; } }
  } catch (e) { /* county is optional */ }
  return geo;
}

export function milesBetween(a, b) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
