# SPMJ — Sistem Pengurusan Masjid Johor

Demo platform for mosque governance in Johor: a **web + mobile PWA** (one Next.js codebase, Bahasa Melayu first) covering all 34 components in the architecture workbook — registry, finance, maintenance, projects, kuliah, donations, qurban, Quran booking, scoring, oversight, platform services, integrations and operations.

> Demo only: payments, messaging and JAINJ/TPMJ integrations are simulated. No real money moves and no real mosque data is used.

## Quick start

```bash
npm install
cp .env.example .env        # then edit values
npm run db:reset            # create SQLite DB + seed 6 Johor mosques
npm run dev                 # http://localhost:3000
```

`npm run build && npm start` for a production build.

## Demo accounts

Password for every account: `demo1234` (or `DEMO_PASSWORD` in `.env`).

| Role | E-mail | Lands on |
| --- | --- | --- |
| Pengerusi (KETUA) | `ketua@masjid.demo` | `/portal` |
| Setiausaha | `setiausaha@masjid.demo` | `/portal` |
| Bendahari | `bendahari@masjid.demo` | `/portal` |
| AJK | `ajk@masjid.demo` | `/portal` |
| Pegawai JAINJ | `pegawai@jainj.demo` | `/jainj` |
| Auditor | `auditor@jainj.demo` | `/jainj` |
| Tutor | `tutor@masjid.demo` | `/tutor` |
| Jemaah | `jemaah@demo.my` | `/jemaah` |

## Google sign-in

1. Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console.
2. Authorised redirect URI: `http://localhost:3000/api/auth/callback/google` (add your production URL too).
3. Put the credentials in `.env`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

The Google button is enabled automatically when both values exist; without them the demo credentials form still works. New Google users sign in as `JEMAAH`. Map them to a staff role by updating `User.role`/`User.mosqueId` (Prisma Studio: `npm run db:studio`).

## Workflow walkthrough (demo)

**Bendahari → JAINJ (finance cycle)**
1. `/portal/kewangan` — record an income entry, tick “Jana resit”; receipt PDF appears under Resit and `/portal/dokumen`.
2. `/portal/kewangan/laporan` — generate the current month, submit it (`DIHANTAR`).
3. Log in as `pegawai@jainj.demo` → `/jainj/laporan` — approve (`DILULUSKAN`) or reject with notes.
4. `/jainj/skor` — recompute scores; finance timeliness feeds the monthly score.

**AJK → Ketua (maintenance & projects)**
1. `/portal/selenggaraan` — log a complaint; Ketua approves, work starts, completion records cost.
2. `/portal/projek` — propose a renovation, Ketua approves, expenses update budget vs actual.

**Jemaah (donation → receipt)**
1. `/jemaah/derma` — donate RM100 → redirected to the mock checkout.
2. Confirm payment: donation becomes `DIBAYAR`, campaign total rises, PDF receipt is issued, email notification is logged, TPMJ flag remains for reconciliation.
3. `/portal/derma` → “Reconcile TPMJ” marks pending donations synced.

**Ibu bapa (Quran booking with slot lock)**
1. `/jemaah/quran` → choose a verified tutor and slot.
2. Enter student details + guardian consent (required under 18). The slot is locked for 10 minutes while paying; the price is hourly rate × hours, tiered 1 student ×1.0, 2 ×1.5, 3+ ×1.8.
3. Pay → booking `DISAHKAN`, slot `DITEMPAH`, 15% platform commission recorded.
4. Tutor `/tutor/tempahan` marks the class complete; `/tutor/bayaran` requests a payout (split settlement: funds go to the tutor, commission deducted at source).

**Qurban**
`/jemaah/qurban` order shares → pay → `/portal/qurban` verifies JAINJ permission, records distribution packs.

**Auditor**
`/jainj/*` and `/system/*` are read-only; every mutation appears in `/portal/audit` and `/jainj/audit` with actor, before/after and IP.

## Architecture map

| Workbook layer | Implementation |
| --- | --- |
| Channels (4) | `/portal`, `/jemaah`, `/tutor`, `/jainj` — role-scoped shells, mobile bottom nav, PWA |
| Edge (E01) | Auth.js (Google + demo credentials), JWT sessions, role guards in layouts/actions/APIs, origin check on mutating APIs |
| Application services (8) | Registry, Finance, Maintenance, Projects, Kuliah, Donations, Qurban, Quran booking — Prisma models + server actions |
| Platform services (4) | Notifications (queued + adapter), Documents (pdfkit PDFs), Audit (append-only), Scoring (reads services, writes analytics only) |
| Data (4) | Prisma/PostgreSQL-ready schema, local object storage adapter, analytics tables, DB-backed job queue stand-in |
| External (4) | `src/lib/payments.ts` (split settlement), `src/lib/integrations.ts` (TPMJ, JAINJ, messaging) — all mock adapters, real call sites |
| Hosting (8) | `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`, `infra/README.md`, `/system/ops` console |
| Security (SEC1) | MFA flag for officers, RBAC, PDPA-facing copy, audit integrity, `/system/keselamatan` |

Key decisions kept from the workbook: modular monolith, one identity model, scoring isolated from operational data, split settlement (platform never holds funds), slot locking, BM-first, Malaysian data residency target.

## Background jobs

```bash
npm run jobs:notifications   # deliver queued messages
npm run jobs:scoring         # monthly score run
npm run jobs:tpmj            # donation reconciliation
npm run jobs:jainj           # master data sync
npx tsx scripts/run-queue.ts quran   # release stale locks/payments
```

In production these map to BullMQ workers on Redis.

## Notes and limitations

- Local DB is SQLite for zero-setup demo. To move to PostgreSQL (architecture target), change `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`, set `DATABASE_URL`, then `npm run db:reset`.
- Payments, SMS/WhatsApp, TPMJ and JAINJ sync are deterministic mocks behind real interfaces.
- No file upload UI yet; receipts and letters are generated server-side into `.storage/`.
- Prisma Accelerate is **not** wired in: it does not support SQLite and is being retired on 1 Dec 2026. For production, use the managed Postgres pooler from the chosen Malaysian region (or Prisma Postgres); caching can be added at the query layer if profiling justifies it. See `infra/README.md`.
