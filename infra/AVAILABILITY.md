# Ketersediaan & Pemantauan (SLO 99.5%) — SPMJ

Sasaran: **99.5% ketersediaan** untuk laluan jemaah (halaman + API
kesihatan), bersamaan **<= 3.6 jam downtime sebulan** (30 hari).

## Definisi ketersediaan

- Satu minit dianggap *tidak tersedia* jika >= 50% pemeriksaan hitam
  terhadap `/api/health?deep=1` dalam minit itu gagal (HTTP != 200
  atau latensi > 2s).
- SLO boleh diterima (error budget): 0.5% x 43,200 minit = **216 minit/bulan**.
- Baki belanjawan ralat dipantau; jika < 25% tinggal, tingkap beku
  sukarela mula dan hanya hotfix dibenarkan.

## Metrik dan ambang amaran

| Isyarat | Sumber | Amaran (warn) | Kritikal (page) |
| --- | --- | --- | --- |
| Kadar ralat 5xx | `/api/health`, log ingress | > 1% / 5 min | > 5% / 5 min |
| Latensi p95 | metrik ingress | > 400 ms / 10 min | > 800 ms / 10 min |
| Latensi p99 | metrik ingress | > 1200 ms / 10 min | > 2500 ms / 10 min |
| Kedalaman barisan | `Job` status PENDING (`?deep=1`) | > 300 selama 10 min | > 1000 selama 10 min |
| DB ping | `/api/health?deep=1` `checks.db` | > 250 ms | gagal 3 x berturutan |
| Lag replika (H03) | metrik PostgreSQL | > 5 s | > 30 s |
| Ruang storan (H06) | metrik node/DB | > 75% | > 90% |
| Pod Ready | K8s HPA `spmj-app` | < 3 pod | < 2 pod (PDB) |

## Pemeriksaan kesihatan

- `GET /api/health` — liveness; sentiasa 200 selagi proses hidup.
  Dipakai oleh `livenessProbe`.
- `GET /api/health?deep=1` — readiness; ping DB (`SELECT 1`) dan kira
  barisan `Job` PENDING; 503 (`degraded`) jika semakan dalam gagal.
  Dipakai oleh `readinessProbe`, pemantau hitam, dan `setup()` k6.

## Peta kepada komponen hosting

| Kod | Sumbangan kepada SLO |
| --- | --- |
| H01 | 3–12 pod, `maxUnavailable: 0` semasa rolling update |
| H02 | sandaran harian; pemulihan titik-RPO 24 jam |
| H03 | replika zon B + failover automatik (sasaran lag <5s) |
| H06 | pemantauan metrik/log/amaran (halaman `/system/ops`) |
| H07 | WAF + DDoS di tepi — kurangkan gangguan luar |
| H08 | tapak DR: RPO 15 min, RTO 4 jam (sepadan belanjawan 216 min/bulan) |

## Ujian

- LARI k6 senario `sahur` dan `raya` pra-tilikan sebarang perubahan
  autoskala; ambang dalam `load/k6-peak.js` ialah kontrak SLO.
- Latihan DR suku tahunan mengesahkan RTO 4 jam < belanjawan downtime
  dua bulan (432 minit).

## Langkah seterusnya (belum dilakukan)

- Sambungkan pembekal amaran sebenar (PagerDuty/Opsgenie/Slack) kepada
  ambang di atas; data `/system/ops` masih demo.
- Tambahkan eksport metrik Prometheus (`/api/health/metrics`) jika
  dipantau oleh stacks luar.
