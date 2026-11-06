// Unit test for site/functions/_middleware.js (password gate). Run: node tests/password-gate.mjs
import { onRequest } from "../site/functions/_middleware.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const PW = "test-only-pw";
const req = (auth) => new Request("https://x.test/", { headers: auth ? { Authorization: auth } : {} });
const b64 = (s) => "Basic " + btoa(s);
const run = async (env, auth) => onRequest({ env, request: req(auth), next: async () => new Response("page", { status: 200 }) });

let r = await run({}, b64("a:" + PW)); ok(r.status === 503, "missing secret fails closed");
r = await run({ SITE_PASSWORD: PW }); ok(r.status === 401, "no header -> 401");
ok((r.headers.get("WWW-Authenticate") || "").startsWith("Basic"), "asks for basic auth");
r = await run({ SITE_PASSWORD: PW }, b64("a:wrong")); ok(r.status === 401, "wrong password -> 401");
r = await run({ SITE_PASSWORD: PW }, b64("anyone:" + PW)); ok(r.status === 200, "right password -> page");
r = await run({ SITE_PASSWORD: PW }, b64(":" + PW)); ok(r.status === 200, "empty username ok");
r = await run({ SITE_PASSWORD: "a:b" }, b64("u:a:b")); ok(r.status === 200, "password containing a colon");
r = await run({ SITE_PASSWORD: PW }, "Basic !!!notbase64"); ok(r.status === 401, "garbage header -> 401");
r = await run({ SITE_PASSWORD: PW }, "Bearer " + PW); ok(r.status === 401, "other scheme -> 401");
r = await run({ DEMO_PASSWORD: PW, DEMO_USER: "nik" }, b64("nik:" + PW)); ok(r.status === 200, "DEMO_USER + DEMO_PASSWORD (agents project secrets) -> page");
r = await run({ DEMO_PASSWORD: PW, DEMO_USER: "nik" }, b64("someone:" + PW)); ok(r.status === 401, "DEMO_USER set: wrong username -> 401");
r = await run({ DEMO_PASSWORD: PW }, b64("anyone:" + PW)); ok(r.status === 200, "DEMO_PASSWORD without DEMO_USER: any username");
r = await run({ SITE_PASSWORD: PW, DEMO_USER: "nik", DEMO_PASSWORD: "other" }, b64("anyone:" + PW)); ok(r.status === 200, "SITE_PASSWORD wins when both are set");
console.log(`password gate: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
