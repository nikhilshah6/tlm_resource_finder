// Live government sources that need no key. Each returns normalized items:
// { id, need, kind, name, address, phone, url, hours, distanceMi, lat, lon, notes, source:{name, url, trust}, retrievedAt }
import { milesBetween } from "../geo.js";
const UA = { "User-Agent": "TLM-reentry-hub-prototype/0.1" };
const now = () => new Date().toISOString();
// tidy ALL-CAPS names from government files ("WEST OAKLAND HEALTH CENTER.." -> "West Oakland Health Center")
export const tidy = (n) => { let t = String(n || "").trim().replace(/\.{2,}$/, "").replace(/\s{2,}/g, " "); if (t && t === t.toUpperCase()) t = t.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Of|And|For|The|In)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase()); return t; };
const arcgis = (base, geo, miles, n) => `${base}/query?geometry=${geo.lon},${geo.lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=${miles}&units=esriSRUnit_StatuteMile&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=${n}`;
// join address parts, trimming padded fields and fixing ALL CAPS street lines
const addr = (parts) => parts.map((x) => tidy(String(x == null ? "" : x).trim())).filter(Boolean).join(", ").replace(/, ([a-z]{2}),/i, (m, st) => ", " + st.toUpperCase() + ",") || null;
const phoneFmt = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p || null; };

// Social Security field offices (Esri-hosted copy of SSA's office data, refreshed by Esri; checked live Nov 5, 2026)
export async function ssaOffices(geo, fetchFn = fetch) {
  const base = "https://services2.arcgis.com/cPVqgcKAQtE6xCja/arcgis/rest/services/SSA_Field_Offices/FeatureServer/0";
  const j = await (await fetchFn(arcgis(base, geo, 40, 6), { headers: UA })).json();
  if (j.error) throw new Error("SSA offices: " + j.error.message);
  return (j.features || []).map((f) => {
    const a = f.attributes, pt = { lat: f.geometry.y, lon: f.geometry.x };
    const address = addr([a.ADDRESS_LINE_3 || a.ADDRESS_LINE_2, a.CITY, a.STATE, a.ZIP_CODE]);
    return { id: "ssa-" + a.OFFICE_CODE, need: "ssn", kind: "office", name: "Social Security office (" + (a.OFFICE_NAME || "").replace(/\s+[A-Z]{2}$/, "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) + ")", address: address, phone: a.PHONE, url: "https://www.ssa.gov/number-card/replace-card", hours: a.MONDAY_OPEN_TIME ? `Mon–Fri ${a.MONDAY_OPEN_TIME}–${a.MONDAY_CLOSE_TIME}` : null, lat: pt.lat, lon: pt.lon, distanceMi: milesBetween(geo, pt), notes: "Replacement Social Security cards are free.", source: { name: "SSA field offices (Esri map service of SSA data)", url: "https://www.ssa.gov/locator/", trust: "official" }, retrievedAt: now() };
  }).sort((x, y) => x.distanceMi - y.distanceMi).slice(0, 3);
}

// Public housing authorities (HUD open data, ArcGIS)
export async function housingAuthorities(geo, fetchFn = fetch) {
  const base = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Public_Housing_Authorities/FeatureServer/0";
  const j = await (await fetchFn(arcgis(base, geo, 25, 8), { headers: UA })).json();
  if (j.error) throw new Error("HUD housing authorities: " + j.error.message);
  return (j.features || []).map((f) => {
    const a = f.attributes, pt = { lat: f.geometry.y, lon: f.geometry.x };
    return { id: "pha-" + a.PARTICIPANT_CODE, need: "housing", kind: "housing-authority", name: tidy(a.FORMAL_PARTICIPANT_NAME), address: addr([a.STD_ADDR || a.LOCATION_ADDRESS, a.STD_CITY, a.STD_ST, a.STD_ZIP5]), phone: phoneFmt(a.HA_PHN_NUM), url: null, hours: null, lat: pt.lat, lon: pt.lon, distanceMi: milesBetween(geo, pt), notes: "Public housing and Housing Choice Vouchers. Ask about waitlists and their policy on past convictions.", source: { name: "HUD Public Housing Authorities (HUD open data)", url: "https://hudgis-hud.opendata.arcgis.com/datasets/HUD::public-housing-authorities", trust: "official" }, retrievedAt: now() };
  }).sort((x, y) => x.distanceMi - y.distanceMi).slice(0, 3);
}

// HUD-approved housing counseling agencies (rental and homelessness counseling)
export async function housingCounselors(geo, fetchFn = fetch) {
  const j = await (await fetchFn(`https://data.hud.gov/Housing_Counselor/searchByLocation?Lat=${geo.lat}&Long=${geo.lon}&Distance=25`, { headers: UA })).json();
  if (!Array.isArray(j)) throw new Error("HUD housing counseling: unexpected response");
  return j.map((a) => {
    const pt = { lat: Number(a.agc_ADDR_LATITUDE), lon: Number(a.agc_ADDR_LONGITUDE) };
    return { id: "hc-" + a.agcid, need: "housing", kind: "housing-counseling", name: tidy(a.nme), address: [a.adr1, a.city, a.statecd, a.zipcd].filter(Boolean).join(", "), phone: a.phone1, url: a.weburl ? (/^https?:/.test(a.weburl) ? a.weburl : "http://" + a.weburl) : null, hours: null, lat: pt.lat, lon: pt.lon, distanceMi: milesBetween(geo, pt), notes: "HUD-approved housing counseling: rental help, avoiding eviction, homelessness resources.", source: { name: "HUD housing counseling agencies (HUD API)", url: "https://data.hud.gov/housing_counseling.html", trust: "official" }, retrievedAt: now() };
  }).sort((x, y) => x.distanceMi - y.distanceMi).slice(0, 3);
}

// SAMHSA FindTreatment.gov: substance use and mental health treatment
export async function treatment(geo, fetchFn = fetch) {
  const u = `https://findtreatment.gov/locator/exportsAsJson/v2?sAddr=${geo.lat},${geo.lon}&limitType=2&limitValue=40234&pageSize=5&page=1&sort=0`;
  const j = await (await fetchFn(u, { headers: UA })).json();
  return (j.rows || []).map((r, i) => ({ id: "tx-" + (r.name1 || i).toString().toLowerCase().replace(/\W+/g, "-").slice(0, 40) + "-" + r.zip, need: "treatment", kind: "treatment", name: tidy(r.name1), address: [r.street1, r.city, r.state, r.zip].filter(Boolean).join(", "), phone: r.phone, url: r.website || null, hours: null, lat: Number(r.latitude), lon: Number(r.longitude), distanceMi: r.miles != null ? Number(r.miles) : milesBetween(geo, { lat: Number(r.latitude), lon: Number(r.longitude) }), notes: ((r.services || []).find((s) => s.f2 === "TC") || {}).f3 || null, source: { name: "SAMHSA FindTreatment.gov", url: "https://findtreatment.gov", trust: "official" }, retrievedAt: now() })).slice(0, 3);
}

// HRSA health centers (sliding-fee primary care): bulk file preloaded per state by build.js, served as a static asset
export async function healthCenters(geo, env) {
  if (!env || !env.ASSETS) throw new Error("health centers: static data not available");
  const r = await env.ASSETS.fetch(new Request("https://assets.local/data/hrsa/" + geo.state + ".json"));
  if (!r.ok) return [];
  const rows = await r.json();
  return rows.map((s) => ({ id: "hrsa-" + s.i, need: "health", kind: "health-center", name: tidy(s.n), address: s.a, phone: s.p, url: s.w ? (/^https?:/.test(s.w) ? s.w : "https://" + s.w) : null, hours: s.h ? s.h + " hours a week" : null, lat: s.y, lon: s.x, distanceMi: milesBetween(geo, { lat: s.y, lon: s.x }), notes: "Federally funded health center: care on a sliding fee scale, and help enrolling in Medicaid.", source: { name: "HRSA health center sites (data.hrsa.gov)", url: "https://data.hrsa.gov/data/download", trust: "official" }, retrievedAt: rows.asOf || null }))
    .sort((x, y) => x.distanceMi - y.distanceMi).slice(0, 3);
}
