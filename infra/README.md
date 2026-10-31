# Infrastruktur SPMJ (demo)

Dokumen ringkas memetakan komponen hosting H01–H08 kepada konfigurasi dalam
repo. **Status: demo.** Konfigurasi Docker/Compose belum diuji pada mesin demo
(Docker tidak disediakan); jalankan `docker compose config` sebelum digunakan.
Aplikasi masih menggunakan SQLite; PostgreSQL ialah sasaran produksi.

## Seni bina sasaran (REGION: malaysia)

| Kod | Komponen | Sasaran produksi | Fasa |
| --- | --- | --- | --- |
| H01 | Kluster aplikasi | 3–12 pod autoscaling, wilayah Malaysia (Johor) — `autoscaling.yaml` | 1 |
| H02 | Pangkalan data utama | PostgreSQL 16, penyulitan AES-256, sandaran harian | 1 |
| H03 | Pangkalan data siap sedia | Replika zon B, failover automatik, sasaran lag <5s | 2 |
| H04 | Storan objek | S3-compatible, versioning, wilayah Malaysia | 1 |
| H05 | CI/CD | GitHub Actions: typecheck, seed, build | 1 |
| H06 | Pemantauan | Metrik, log, amaran dan uptime — SLO 99.5% di `AVAILABILITY.md` | 1 |
| H07 | WAF & DDoS | WAF OWASP CRS dan perlindungan DDoS di tepi | 1 |
| H08 | Tapak pemulihan bencana | Wilayah kedua Malaysia, RPO 15 min, RTO 4 jam | 2 |

Semua data operasi di `/system/ops` dan `/system/keselamatan` ialah data demo.
Tiada pemindahan data rentas sempadan dalam reka bentuk sasaran.

## Prisma: SQLite → PostgreSQL

Demo menggunakan `provider = "sqlite"` dalam `prisma/schema.prisma`.
Untuk produksi:

1. Tukar datasource kepada `provider = "postgresql"`.
2. Tetapkan `DATABASE_URL="postgresql://spmj:…@postgres:5432/spmj?schema=public"`.
3. Jalankan `npx prisma generate`.
4. Jalankan `npx prisma db push` (demo) atau `npx prisma migrate deploy` (produksi).
5. Jalankan `npm run db:seed` untuk data demo.

Perubahan provider **tidak** dibuat dalam repo demo ini. Servis `postgres`
dalam Compose berada di profil `prod` dan tidak disambungkan secara automatik.

## Bina dan jalankan bekas

```bash
docker build -t spmj-app:demo .

docker volume create spmj-data
docker volume create spmj-storage

# Sekali sahaja: sediakan skema dan data demo dalam volum /data.
docker run --rm -e DATABASE_URL=file:/data/dev.db -e DEMO_PASSWORD=demo1234 \
  -v spmj-data:/data spmj-app:demo \
  sh -c "npx prisma db push && npm run db:seed"

docker run --rm -p 3000:3000 \
  -e AUTH_SECRET="tukar-secret-ini" \
  -e DATABASE_URL=file:/data/dev.db \
  -v spmj-data:/data -v spmj-storage:/app/.storage \
  spmj-app:demo
```

Atau dengan Compose:

```bash
docker compose build
docker compose run --rm app sh -c "npx prisma db push && npm run db:seed"
docker compose up -d
docker compose --profile prod up -d postgres redis
```

Runner menggunakan salinan `.next` penuh (bukan `output: "standalone"` kerana
`next.config.mjs` tidak menetapkannya) dan menjalankan `npx next start -p 3000`.
Imej turut menyalin `src/` supaya `npm run db:seed` boleh dijalankan di dalam bekas.

## CI

`.github/workflows/ci.yml` berjalan pada setiap push/PR:

- Node.js 22, `npm ci`, `npx prisma generate`
- `npx prisma db push --skip-generate` dengan `DATABASE_URL=file:./ci.db`
- `npm run db:seed`, `npm run typecheck`, `npm run build`

`AUTH_SECRET` dummy disediakan pada peringkat job. CI tidak membina imej Docker
pada masa ini.

## Beban puncak, beku perubahan dan SLO

- `/api/health` — liveness (sentiasa 200); `/api/health?deep=1` —
  readiness (ping DB + kira `Job` PENDING; 503 jika `degraded`).
  Dipakai oleh probe dalam `autoscaling.yaml` dan `setup()` k6.
- `autoscaling.yaml` — HPA `spmj-app` 3–12 pod (CPU 60%, memori 75%),
  PodDisruptionBudget `minAvailable: 2`, Deployment dengan rolling
  `maxUnavailable: 0`, dan ScaledObject KEDA (trigger barisan PostgreSQL).
- `load/k6-peak.js` — senario `normal` (50 VU), `sahur` (200 VU),
  `raya` (350 VU), `payday` (150 VU); ambang kontrak: p95 < 400 ms,
  p99 < 1200 ms, pemeriksaan > 99%. Jalankan:
  `k6 run -e SCENARIO=raya infra/load/k6-peak.js` (perlu `K6_BASE_URL`).
- `CHANGE_FREEZE.md` — tingkap beku Ramadan/Aidilfitri/gaji dan proses
  deploy kecemasan dua kelulusan.
- `AVAILABILITY.md` — SLO 99.5% (belanjawan ralat 216 minit/bulan),
  jadual ambang amaran/warn-kritikal dan peta H01–H08.

Nota: konfigurasi K8s/KEDA/k6 adalah reka bentuk sasaran; belum
dijalankan pada kluster demo.

## Pemulihan bencana (DR)

- RPO 15 minit, RTO 4 jam; tapak kedua di wilayah Malaysia Timur.
- Produksi: PostgreSQL primary + replika, storan objek direplikasi, sandaran
  harian dan latihan pemulihan setiap suku tahun.
- Demo: satu fail SQLite; tiada HA. Jangan anggap DR demo sebagai diuji.

## Langkah seterusnya

- Migrasi ke PostgreSQL dengan `prisma migrate` dan ujian pemulihan.
- Sambungkan storan objek sebenar dan KMS/HSM di wilayah Malaysia.
- Aktifkan Redis/BullMQ untuk barisan mesej dan kerja latar.
- Dapatkan kelayakan penyedia pembayaran/mesej sebelum menukar mod LIVE.
- Jalankan pen test, PIA PDPA dan latihan DR sebelum pelancaran.
- Pasang `autoscaling.yaml` pada kluster Malaysia dan sahkan dengan
  senario k6 `sahur`/`raya` sebelum Ramadan pertama.
- Sambungkan pembekal amaran sebenar kepada ambang `AVAILABILITY.md`
  dan aktifkan pintu beku perubahan dalam CI.
