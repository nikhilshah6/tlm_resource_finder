// Curated links: state application pages (from the hub's existing STATE_F30 list, extracted at build time)
// and national programs that have no API. Every item carries its source and the date it was checked.
const ASOF = "2026-11-05";
const C = (o) => Object.assign({ kind: "link", address: null, phone: null, hours: null, lat: null, lon: null, distanceMi: null, retrievedAt: ASOF }, o);

export const NATIONAL = [
  C({ id: "nat-lifeline", need: "phone", name: "Lifeline phone or internet discount", url: "https://www.lifelinesupport.org/companies-near-me/", notes: "Find Lifeline companies that serve your ZIP. You can qualify through SNAP or Medicaid.", source: { name: "Universal Service Administrative Co. (Lifeline)", url: "https://www.lifelinesupport.org/", trust: "official" } }),
  C({ id: "nat-bankon", need: "bank", name: "Bank On certified accounts", url: "https://joinbankon.org/accounts/", notes: "Low-cost checking accounts with no overdraft fees, listed by Bank On.", source: { name: "Bank On (Cities for Financial Empowerment Fund)", url: "https://joinbankon.org/", trust: "directory" } }),
  C({ id: "nat-ajc", need: "jobs", name: "American Job Center near you", url: "https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx", notes: "Free job search help, training funds and reentry services, run with the U.S. Department of Labor.", source: { name: "CareerOneStop (U.S. Department of Labor)", url: "https://www.careeronestop.org/", trust: "official" } }),
  C({ id: "nat-bonding", need: "jobs", name: "Federal Bonding Program", url: "https://bonds4jobs.com/our-services/directory", notes: "Free fidelity bonds that cover an employer for the first six months, for job seekers with records. Find your state coordinator.", source: { name: "Federal Bonding Program (U.S. Department of Labor)", url: "https://bonds4jobs.com/", trust: "official" } }),
  C({ id: "nat-training", need: "training", name: "Training programs and certificates near you", url: "https://www.careeronestop.org/FindTraining/find-training.aspx", notes: "Search local training programs and how long they take.", source: { name: "CareerOneStop (U.S. Department of Labor)", url: "https://www.careeronestop.org/", trust: "official" } }),
  C({ id: "nat-211", need: "shelter", name: "Call or text 211 for shelter tonight", phone: "211", url: "https://www.211.org/", notes: "Free, 24/7 line that connects to local shelters, food and emergency help.", source: { name: "211 (United Way Worldwide)", url: "https://www.211.org/", trust: "directory" } }),
  C({ id: "nat-legal", need: "legal", name: "Find free legal aid", url: "https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help", notes: "Locate the legal aid office for your address (housing, benefits, record clearing).", source: { name: "Legal Services Corporation", url: "https://www.lsc.gov/", trust: "official" } }),
  C({ id: "nat-rrp", need: "records", name: "Your state's rules on record clearing and restoring rights", url: "https://ccresourcecenter.org/restoration-2/", notes: "State-by-state guide to expungement, sealing, pardons, voting and licensing.", source: { name: "Restoration of Rights Project (Collateral Consequences Resource Center)", url: "https://ccresourcecenter.org/restoration-2/", trust: "directory" } }),
  C({ id: "nat-vote", need: "vote", name: "Voting rights after a conviction, by state", url: "https://ccresourcecenter.org/restoration-2/", notes: "Check when voting rights come back in your state, then register at vote.gov.", source: { name: "Restoration of Rights Project", url: "https://ccresourcecenter.org/restoration-2/", trust: "directory" } }),
  C({ id: "nat-samhsa", need: "treatment", name: "SAMHSA National Helpline", phone: "1-800-662-4357", url: "https://www.samhsa.gov/find-help/helplines/national-helpline", notes: "Free, confidential, 24/7 treatment referral and information.", source: { name: "SAMHSA", url: "https://www.samhsa.gov/", trust: "official" } }),
  C({ id: "nat-988", need: "health", name: "988 Suicide and Crisis Lifeline", phone: "988", url: "https://988lifeline.org/", notes: "Call or text 988 any time.", source: { name: "988 Lifeline", url: "https://988lifeline.org/", trust: "official" } })
];

const LABEL = { id: "State ID or driver's license", snap: "Apply for food benefits (SNAP)", medicaid: "Apply for health coverage (Medicaid)", expunge: "Record clearing help" };
const NEED = { id: "id", snap: "snap", medicaid: "medicaid", expunge: "records" };

// links = { states: {CA:{id:{url,label},...}}, national: {id:{url,label},...}, source }
export function stateLinks(geo, links) {
  const st = (links.states || {})[geo.state], nat = links.national || {};
  return ["id", "snap", "medicaid", "expunge"].map((k) => {
    const L = (st && st[k]) || nat[k]; if (!L) return null;
    const local = !!(st && st[k]);
    return C({ id: "state-" + geo.state + "-" + k, need: NEED[k], name: local ? LABEL[k] + " in " + (geo.stateName || geo.state) : LABEL[k] + " (find your state)", url: L.url, notes: (L.label || "").replace(/\s*→\s*$/, ""), source: { name: local ? "TLM hub state links (checked list, re-verify yearly)" : "National fallback link", url: L.url, trust: local ? "curated" : "official" } });
  }).filter(Boolean);
}
