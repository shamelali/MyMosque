# Perubahan Beku (Change Freeze) — SPMJ

Tujuan: memastikan platform stabil dan cukup kapasiti pada waktu puncak
penggunaan jemaah. Dalam tempoh beku, hanya pembaikan kritikal boleh
dikeluarkan ke produksi.

## Kalendar beku (anggaran tahunan, ikut kalendar Hijri)

| Tingkap | Bila | Kenapa |
| --- | --- | --- |
| Ramadan – awal | Malam pertama Ramadan (saat tarawih, pendaftaran quran) | Puncak daftar kelas dan derma |
| Ramadan – pertengahan | 10 malam terakhir (Lailatul Qadar) | Puncak derma dan qurban awal |
| Ramadan – hujung | 3 hari terakhir sebelum Aidilfitri | Fitrah, qurban, derma raya |
| Aidilfitri | Hari Raya + 2 hari berikutnya | Semakan resit dan laporan oleh jawatankuasa |
| Gaji bulanan | 25th–5th setiap bulan | Puncak bayaran yuran kelas dan derma berulang |
| Sahur harian (Ramadan) | 03:30–06:00 setiap hari Ramadan | Penggunaan skrin semak dan bayaran tinggi |

## Peraturan dalam tempoh beku

1. **Diblok:** ciri baru, refactor besar, migrasi skema, pertukaran
   konfigurasi infrastruktur (HPA, imagelimit, salinan DB), dan
   pertukaran penyedia gerbang/mesej.
2. **Dibenarkan:** hotfix keselamatan (CVSS ≥ 7.0), kecacatan P1
   (sistem tidak boleh bayar/sandi), dan penambahan kapasiti
   (scale-up, naik taraf storan).
3. Deploy biasa (CI/CD hijau) disambung semula selewat-lewatnya
   **3 hari selepas** tingkap beku tamat, selepas penerbitan dilanggar
   pada mod SANDBOX dan k6 senario puncak lulus.

## Proses deploy kecemasan semasa beku

1. RAISE amaran P1 di saluran operasi; kenal pasti kos if-tak-dibetulkan.
2. Dapatkan kelulusan **dua orang**: ketua teknologi DAN setiausaha
   masjid / pentadbir kanan (rekod dalam audit log, tindakan `DEPLOY`).
3. Sediakan patch terkecil mungkin; sahkan pada branch `hotfix/*`
   dengan `npm run typecheck && npm run build` dan ujian E2E bayaran.
4. Catat rollback plan sebelum deploy (imej tag sebelumnya).
5. Deploy; pantau `/api/health?deep=1`, kadar ralat, dan latensi p95
   selama 30 minit.
6. Selepas beku tamat: tulis post-mortem dalam 5 hari bekerja
   (sebab, tindakan, pencegahan).

## Pintu CI cadangan

Aliran `ci.yml` boleh menyemak tarikh terhadap kalendar beku dan
menolak deploy automatik (bukan build) dalam tingkap beku, kecuali
label `hotfix` pada PR. (Belum diaktifkan — lihat README infra.)

## Kapasiti sasaran semasa puncak (rujuk `load/k6-peak.js`)

- Senario `raya`: 350 VU, 10 minit — kelajuan 99.5% kejayaan.
- p95 < 400 ms, p99 < 1200 ms pada laluan jemaah dan `/api/health?deep=1`.
- Autoskala HPA 3→12 pod mesti mengikut dalam < 3 minit (scaleUp
  stabilization 30s); sandaran: scale manual melalui `kubectl scale`.
