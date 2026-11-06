// Unit tests for the resource sources with a mocked network. Run: node tests/navigator-unit.mjs
import { findResources, NEEDS } from "../site/lib/resources.js";
import { tidy } from "../site/lib/sources/live.js";
import { stateLinks } from "../site/lib/sources/curated.js";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const calls = [];
const J = (o) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
function mockFetch(fail = {}) {
  return async (url) => {
    url = String(url); calls.push(url);
    if (url.includes("zippopotam")) return J({ places: [{ "place name": "Oakland", "state abbreviation": "CA", state: "California", latitude: "37.8071", longitude: "-122.2851" }] });
    if (url.includes("geo.fcc.gov")) return J({ results: [{ county_name: "Alameda County", county_fips: "06001" }] });
    if (url.includes("SSA_Field_Offices")) { if (fail.ssa) return J({ error: { message: "Token Required" } }); return J({ features: [{ attributes: { OFFICE_CODE: "953", OFFICE_NAME: "OAKLAND DT CA", ADDRESS_LINE_3: "360 22ND ST", CITY: "OAKLAND", STATE: "CA", ZIP_CODE: 94612, PHONE: "(866) 964-7420", MONDAY_OPEN_TIME: "9:00 AM", MONDAY_CLOSE_TIME: "4:00 PM" }, geometry: { x: -122.268, y: 37.811 } }] }); }
    if (url.includes("Public_Housing_Authorities")) return J({ features: [{ attributes: { PARTICIPANT_CODE: "CA003", FORMAL_PARTICIPANT_NAME: "OAKLAND HOUSING AUTHORITY", HA_PHN_NUM: "5108741500", EXEC_DIR_EMAIL: "person@example.org" }, geometry: { x: -122.27, y: 37.80 } }] });
    if (url.includes("Housing_Counselor")) return J([{ agcid: "1", nme: "EAST BAY COUNSELING", adr1: "1 Main St", city: "Oakland", statecd: "CA", zipcd: "94607", phone1: "510-555-0100", weburl: "example.org", agc_ADDR_LATITUDE: "37.80", agc_ADDR_LONGITUDE: "-122.28" }]);
    if (url.includes("findtreatment")) return J({ rows: [{ name1: "WEST OAKLAND HEALTH COUNCIL", street1: "700 Adeline", city: "Oakland", state: "CA", zip: "94607", phone: "510-555-0101", latitude: "37.80", longitude: "-122.29", miles: 0.3, services: [{ f2: "TC", f3: "Substance use treatment" }] }] });
    throw new Error("unexpected " + url);
  };
}
const env = { ASSETS: { fetch: async () => new Response(JSON.stringify([{ i: "x1", n: "WEST OAKLAND HEALTH CENTER..", a: "700 Adeline St, Oakland, CA, 94607", p: "510-555-0102", w: "wohc.org", h: 40, x: -122.29, y: 37.80 }])) } };
const links = { states: { CA: { id: { url: "https://www.dmv.ca.gov/", label: "California DMV →" }, snap: { url: "https://www.getcalfresh.org/", label: "Apply for CalFresh →" }, medicaid: { url: "https://www.coveredca.com/", label: "Covered California →" }, expunge: { url: "https://www.rootandrebound.org/", label: "Root & Rebound →" } } }, national: { id: { url: "https://www.usa.gov/motor-vehicle-services", label: "Find Your State DMV →" }, snap: { url: "https://www.fns.usda.gov/snap/state-directory", label: "Apply for SNAP →" }, medicaid: { url: "https://www.medicaid.gov/", label: "Medicaid →" }, expunge: { url: "https://www.rootandrebound.org/", label: "Expungement →" } } };

console.log("aggregation");
const r = await findResources({ zip: "94607", needs: NEEDS, env, fetchFn: mockFetch(), links });
ok(r.geo.county === "Alameda County" && r.geo.state === "CA", "ZIP resolves to state and county");
ok(NEEDS.every((n) => r.items.some((i) => i.need === n)), "every need area has at least one item");
ok(r.items.every((i) => i.source && i.source.name && i.source.trust && i.name), "every item has a name and a source with a trust level");
ok(r.items.filter((i) => i.distanceMi != null).every((i) => i.distanceMi >= 0 && i.distanceMi < 50), "located items carry a distance");
ok(!JSON.stringify(r).includes("person@example.org"), "personal contact fields from source data are not passed through");
ok(calls.every((u) => !/Marcus|Johnson/i.test(u)), "outgoing requests contain no names");
const hc = r.items.find((i) => i.kind === "health-center");
ok(hc && hc.name === "West Oakland Health Center" && hc.url === "https://wohc.org", "health center names are tidied and links get a scheme");
console.log("failure handling and filtering");
const r2 = await findResources({ zip: "94607", needs: ["ssn", "housing"], env, fetchFn: mockFetch({ ssa: true }), links });
ok(r2.errors.length === 1 && r2.errors[0].source === "ssa" && r2.items.some((i) => i.need === "housing"), "one failing source is reported, the rest still return");
ok(r2.items.every((i) => ["ssn", "housing"].includes(i.need)), "only the needs asked for come back");
let threw = false; try { await findResources({ zip: "9460", needs: ["id"], env, fetchFn: mockFetch(), links }); } catch (e) { threw = /5 digits/.test(e.message); } ok(threw, "bad ZIP is rejected");
console.log("state links");
const wy = stateLinks({ state: "WY", stateName: "Wyoming" }, links);
ok(wy.length === 4 && wy.every((i) => /find your state/.test(i.name) && i.source.trust === "official"), "a state with no curated links falls back to national pages");
const ca = stateLinks({ state: "CA", stateName: "California" }, links);
ok(ca.find((i) => i.need === "snap").url === "https://www.getcalfresh.org/" && /in California/.test(ca[0].name), "a curated state uses its own links");
ok(tidy("CITY OF ALAMEDA HOUSING AUTHORITY") === "City of Alameda Housing Authority" && tidy("WellSpace Health") === "WellSpace Health", "tidy fixes ALL CAPS but leaves mixed case alone");
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
