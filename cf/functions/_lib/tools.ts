// Public resource APIs and the local California snapshot, for Pages Functions.
// Only public resource data (coordinates, city, ZIP, search words) is sent out. No alumni details.
const MAX = 15;
const UA = { "User-Agent": "tlm-reentry-agents/0.1 (nonprofit prototype)" };

export const NEIGHBORS: Record<string, string[]> = {
  Alameda: ["Contra Costa", "San Francisco", "Santa Clara", "San Joaquin"],
  "San Francisco": ["San Mateo", "Alameda", "Marin"],
  "Contra Costa": ["Alameda", "Solano"],
  "Los Angeles": ["Orange", "San Bernardino", "Ventura", "Kern"],
  Orange: ["Los Angeles", "Riverside", "San Diego"],
  "San Diego": ["Orange", "Riverside", "Imperial"],
  Riverside: ["San Bernardino", "Orange", "San Diego"],
  "San Bernardino": ["Riverside", "Los Angeles"],
  Sacramento: ["Placer", "Yolo", "San Joaquin", "El Dorado"],
  Fresno: ["Madera", "Tulare", "Kings"],
  Kern: ["Tulare", "Los Angeles", "San Bernardino"],
  "Santa Clara": ["San Mateo", "Alameda", "Santa Cruz"],
  "San Joaquin": ["Sacramento", "Stanislaus", "Alameda"],
};

export const slug = (c: string) => (c || "").replace(/ County$/i, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
const cleanCounty = (c?: string | null) => (c || "").replace(/ County$/i, "").trim();

async function getJson(url: string, init: RequestInit = {}, ms = 15000): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, headers: { ...UA, ...(init.headers || {}) }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function miles(lat1: any, lon1: any, lat2: any, lon2: any): number | null {
  const a = [lat1, lon1, lat2, lon2].map(Number);
  if (a.some((x) => Number.isNaN(x))) return null;
  const R = 3958.8, rad = (d: number) => (d * Math.PI) / 180;
  const dp = rad(a[2] - a[0]), dl = rad(a[3] - a[1]);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(a[2])) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export async function geocode(place: string): Promise<any> {
  place = (place || "").trim();
  try {
    if (/^\d{5}/.test(place)) {
      const d = await getJson(`https://api.zippopotam.us/us/${place.slice(0, 5)}`);
      const p = d.places[0];
      return { lat: +p.latitude, lon: +p.longitude, city: p["place name"], zip: place.slice(0, 5) };
    }
    const d = await getJson(`https://api.zippopotam.us/us/ca/${encodeURIComponent(place)}`);
    const p = d.places[0];
    return { lat: +p.latitude, lon: +p.longitude, city: place, zip: p["post code"] };
  } catch (e: any) {
    return { error: `geocode failed for ${place}: ${e.message}` };
  }
}

export async function findTreatment(lat: number, lon: number, mi = 10, keyword = ""): Promise<any> {
  try {
    const q = new URLSearchParams({ sAddr: `${lat},${lon}`, limitType: "2", limitValue: String(Math.round(mi * 1609.34)), pageSize: "25", page: "1" });
    const d = await getJson(`https://findtreatment.gov/locator/exportsAsJson/v2?${q}`);
    const kw = keyword.toLowerCase();
    return (d.rows || [])
      .filter((r: any) => !kw || JSON.stringify(r).toLowerCase().includes(kw))
      .slice(0, MAX)
      .map((r: any) => ({
        name: [r.name1, r.name2].filter(Boolean).join(" - "), category: "health",
        description: `Substance use / mental health treatment (${r.typeFacility || "facility"})`,
        address: [r.street1, r.street2].filter(Boolean).join(", "), city: r.city,
        phone: r.phone || r.intake1, url: r.website, distance_miles: r.miles,
        source: "findtreatment", source_url: "https://findtreatment.gov/",
      }));
  } catch (e: any) {
    return { error: `FindTreatment.gov failed: ${e.message}` };
  }
}

export async function hudCounselors(lat: number, lon: number, mi = 10): Promise<any> {
  try {
    const rows = await getJson(`https://data.hud.gov/Housing_Counselor/searchByLocation?Lat=${lat}&Long=${lon}&Distance=${mi}`);
    return (rows || [])
      .map((a: any) => ({
        name: String(a.nme || "").replace(/\w\S*/g, (w: string) => w[0] + w.slice(1).toLowerCase()), category: "housing",
        description: "HUD-approved housing counseling agency (rental help, homelessness prevention, finding housing)",
        address: [a.adr1, a.adr2].filter(Boolean).join(" "), city: a.city, phone: a.phone1, url: a.weburl,
        who_it_serves: a.languages ? `Languages: ${a.languages}` : undefined,
        distance_miles: miles(lat, lon, a.agc_ADDR_LATITUDE, a.agc_ADDR_LONGITUDE),
        source: "hud", source_url: "https://data.hud.gov/Housing_Counselor/",
      }))
      .sort((x: any, y: any) => (x.distance_miles ?? 99) - (y.distance_miles ?? 99))
      .slice(0, MAX);
  } catch (e: any) {
    return { error: `HUD housing counselor API failed: ${e.message}` };
  }
}

export async function fdicBranches(city: string): Promise<any> {
  try {
    const q = new URLSearchParams({ filters: `STALP:CA AND CITY:"${city}"`, fields: "NAME,ADDRESS,CITY,ZIP,OFFNAME", limit: "25" });
    const d = await getJson(`https://api.fdic.gov/banks/locations?${q}`);
    const seen = new Set<string>();
    const out: any[] = [];
    for (const { data: b } of d.data || []) {
      const k = `${b.NAME}|${b.ADDRESS}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        name: `${b.NAME} - ${b.OFFNAME || "branch"}`, category: "legal_id",
        description: "FDIC-insured bank branch (check for a second-chance or Bank On certified account)",
        address: b.ADDRESS, city: b.CITY, source: "fdic", source_url: "https://banks.data.fdic.gov/bankfind-suite/",
      });
    }
    return out.slice(0, MAX);
  } catch (e: any) {
    return { error: `FDIC BankFind failed: ${e.message}` };
  }
}

export async function careerOneStopAjc(env: any, location: string, radius = 25): Promise<any> {
  if (!env.CAREERONESTOP_USER_ID || !env.CAREERONESTOP_TOKEN) return { error: "CareerOneStop key not configured" };
  try {
    const d = await getJson(
      `https://api.careeronestop.org/v1/ajcfinder/${env.CAREERONESTOP_USER_ID}/${encodeURIComponent(location)}/${radius}/0/0/0/0/0/0/0/15`,
      { headers: { Authorization: `Bearer ${env.CAREERONESTOP_TOKEN}` } },
    );
    return (d.OneStopCenterList || []).slice(0, MAX).map((j: any) => ({
      name: j.Name, category: "jobs",
      description: "America's Job Center of California: job search help, training funds (WIOA), reentry services",
      address: j.Address1, city: j.City, phone: j.Phone, url: j.WebSiteUrl, distance_miles: Number(j.Distance) || undefined,
      source: "careeronestop", source_url: "https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx",
    }));
  } catch (e: any) {
    return { error: `CareerOneStop failed: ${e.message}` };
  }
}

// ------------------------------------------------------------ snapshot + rules (static assets)
export class Snapshot {
  private cache = new Map<string, any[]>();
  constructor(private assets: { fetch: (r: Request | string) => Promise<Response> }, private origin: string) {}

  private async file(name: string): Promise<any[]> {
    if (this.cache.has(name)) return this.cache.get(name)!;
    let rows: any[] = [];
    try {
      const r = await this.assets.fetch(new Request(new URL(`/data/${name}`, this.origin)));
      if (r.ok) rows = await r.json();
    } catch { rows = []; }
    this.cache.set(name, rows);
    return rows;
  }

  async search(category: string, county: string, keywords = ""): Promise<any[]> {
    const c = cleanCounty(county);
    const names = [c, ...(NEIGHBORS[c] || [])];
    const files = await Promise.all([this.file("snapshot/statewide.json"), ...names.map((n) => this.file(`snapshot/${slug(n)}.json`))]);
    const kws = keywords.toLowerCase().replace(/,/g, " ").split(/\s+/).filter((k) => k.length > 2);
    const scored: [number, any][] = [];
    files.forEach((rows, i) => {
      for (const rec of rows) {
        if (rec.category !== category) continue;
        const text = JSON.stringify(rec).toLowerCase();
        let score = kws.reduce((s, k) => s + (text.split(k).length - 1), 0);
        if (i === 1) score += 3; // the person's own county
        if (rec.tlm_network) score += 2;
        if (i === 0) score += 1; // statewide
        scored.push([score, rec]);
      }
    });
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, MAX).map(([, r]) => r);
  }

  async rule(topic: string): Promise<any> {
    const rules = await this.file("rules_ca.json");
    const words = topic.toLowerCase().replace(/_/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const hits = rules.filter((r: any) => words.some((w) => `${r.topic} ${r.rule}`.toLowerCase().includes(w)));
    if (!hits.length) return { note: `No stored rule for ${topic}. Look it up on an official page with web_search.`, topics: rules.map((r: any) => r.topic) };
    return hits.slice(0, 6);
  }
}
