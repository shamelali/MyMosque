// SPMJ — peak load test (H01).
//
// Targets the daily + festival peaks the platform must absorb. Run against a
// staging deploy with seeded demo data; never against production.
//
//   k6 run --env BASE_URL=https://staging.spmj.example infra/load/k6-peak.js
//   k6 run --env BASE_URL=http://localhost:3100 --env SCENARIO=sahur infra/load/k6-peak.js
//
// Scenarios:
//   normal   — weekday baseline (maghrib traffic, jemaah browsing)
//   sahur    — pre-dawn peak, donation burst (Ramadan)
//   raya     — aidiladha / qurban peak
//   payday   — zakat fitrah + monthly donation wave
//
// Each VU hits read-only pages plus the /api/health deep probe so the
// autoscaler's readiness signal is exercised alongside user traffic.

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE = (__ENV.BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const SCENARIO = __ENV.SCENARIO || "normal";
const SESSION = __env_session();

const pageViews = new Counter("spmj_page_views");
const apiErrors = new Counter("spmj_api_errors");
const latency = new Trend("spmj_latency", true);

function __env_session() {
  // Demo jemaah cookie. In CI we'd POST /api/auth/callback/credentials and
  // pass the session cookie through — for the demo we keep traffic
  // unauthenticated and exercise public surfaces.
  return {};
}

const VUS = {
  normal: 50,
  sahur: 200,
  raya: 350,
  payday: 150,
}[SCENARIO];

const DURATION = {
  normal: "5m",
  sahur: "3m",
  raya: "10m",
  payday: "4m",
}[SCENARIO];

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ["p(95)<400", "p(99)<1200"],
    spmj_latency: ["p(95)<400"],
    spmj_api_errors: ["count<50"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  const res = http.get(`${BASE}/api/health?deep=1`);
  if (res.status !== 200) {
    throw new Error(`Target ${BASE} is not ready (status ${res.status}).`);
  }
  return { startedAt: Date.now() };
}

export default function () {
  visit("/");
  visit("/jemaah");
  visit("/jemaah/derma");
  visit("/jemaah/qurban");
  visit("/jemaah/quran");
  visit("/jemaah/kedai");
  visit("/api/health?deep=1");
  sleep(Math.random() * 2 + 1);
}

function visit(path) {
  const res = http.get(`${BASE}${path}`, { headers: { Accept: "text/html" } });
  pageViews.add(1);
  latency.add(res.timings.duration);
  const ok = check(res, {
    "2xx or 3xx": (r) => r.status >= 200 && r.status < 400,
    "fast (< 2s)": (r) => r.timings.duration < 2000,
  });
  if (!ok) apiErrors.add(1);
}
