/**
 * Demo seed: 6 mosques across Johor, 8 role accounts, and enough live data
 * to walk every workflow (approvals pending, slots open, orders awaiting payment).
 * Run: npm run db:reset
 */
import { PrismaClient } from "@prisma/client";
import { rm as removePath } from "node:fs/promises";
import { hashPassword } from "../src/lib/password";
import { issueReceipt } from "../src/lib/documents";
import { computeAllScores } from "../src/lib/scoring";

const prisma = new PrismaClient();
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";

const rm = (v: number) => Math.round(v * 100);
const day = 86_400_000;
const at = (offsetDays: number, hour = 10) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const monthStart = (offset: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
};
const year = new Date().getFullYear();
const month = new Date().getMonth() + 1;

async function wipe() {
  await removePath(".storage", { recursive: true, force: true });
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.document.deleteMany();
  await prisma.scoreSnapshot.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.quranBooking.deleteMany();
  await prisma.slotLock.deleteMany();
  await prisma.quranSlot.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.qurbanDistribution.deleteMany();
  await prisma.qurbanOrder.deleteMany();
  await prisma.qurbanProgram.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.kuliahProgram.deleteMany();
  await prisma.speaker.deleteMany();
  await prisma.projectExpense.deleteMany();
  await prisma.project.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.monthlyReport.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.committeeMember.deleteMany();
  await prisma.committeeTerm.deleteMany();
  await prisma.officer.deleteMany();
  await prisma.syncRun.deleteMany();
  await prisma.integrationConfig.deleteMany();
  await prisma.storedFile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.mosque.deleteMany();
}

type MosqueSeed = {
  id: string;
  code: string;
  name: string;
  district: string;
  address: string;
  capacity: number;
  phone: string;
  email: string;
  score: number;
};

const MOSQUES: MosqueSeed[] = [
  { id: "msq-jb-01", code: "JHR/JB/001", name: "Masjid Al-Falah", district: "Johor Bahru", address: "Jalan Dato Sulaiman, Taman Abad, 80250 Johor Bahru", capacity: 1200, phone: "07-332 1188", email: "info@alfalah.demo", score: 87 },
  { id: "msq-jb-02", code: "JHR/JB/002", name: "Masjid Sultan Ismail", district: "Johor Bahru", address: "Jalan Abu Bakar, 80000 Johor Bahru", capacity: 2500, phone: "07-223 4455", email: "info@sultanismail.demo", score: 81 },
  { id: "msq-klu-01", code: "JHR/KLU/001", name: "Masjid Jamek Bandar Kulai", district: "Kulai", address: "Jalan Besar, 81000 Kulai", capacity: 1800, phone: "07-662 7788", email: "info@jamekkulai.demo", score: 74 },
  { id: "msq-bp-01", code: "JHR/BP/001", name: "Masjid Al-Hidayah", district: "Batu Pahat", address: "Jalan Bukit Pasir, 83000 Batu Pahat", capacity: 900, phone: "07-431 9922", email: "info@alhidayah.demo", score: 69 },
  { id: "msq-mr-01", code: "JHR/MR/001", name: "Masjid Jamek Muar", district: "Muar", address: "Jalan Maharani, 84000 Muar", capacity: 1500, phone: "06-951 3344", email: "info@jamekmuar.demo", score: 78 },
  { id: "msq-klg-01", code: "JHR/KLG/001", name: "Masjid Kampung Melayu Kluang", district: "Kluang", address: "Jalan Kampung Melayu, 86000 Kluang", capacity: 700, phone: "07-772 5566", email: "info@kgmelayu.demo", score: 63 },
];

const TUTORS = [
  { id: "tut-1", name: "Ustazah Nur Aisyah binti Roslan", gender: "PEREMPUAN", tauliah: "TLH/JHR/2024/0187", rate: 50, verified: true, email: "tutor@masjid.demo" },
  { id: "tut-2", name: "Ustaz Hafiz bin Ibrahim", gender: "LELAKI", tauliah: "TLH/JHR/2023/0921", rate: 45, verified: true, email: null },
  { id: "tut-3", name: "Ustazah Zainab binti Omar", gender: "PEREMPUAN", tauliah: "TLH/JHR/2026/0032", rate: 40, verified: false, email: null },
];

async function main() {
  await wipe();
  const passwordHash = hashPassword(PASSWORD);

  await prisma.mosque.createMany({
    data: MOSQUES.map((m, i) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      district: m.district,
      address: m.address,
      phone: m.phone,
      email: m.email,
      capacity: m.capacity,
      status: i === 5 ? "PROJEK" : "AKTIF",
      jainjRef: `JAINJ-${m.code}`,
      latitude: 1.49 + i * 0.35,
      longitude: 103.75 - i * 0.1,
    })),
  });

  // ---------------------------------------------------------------- users
  const users = [
    { id: "usr-ketua", name: "Hj. Kamarudin bin Salleh", email: "ketua@masjid.demo", role: "KETUA", mosqueId: "msq-jb-01", phone: "012-773 4411", mfa: true },
    { id: "usr-suu", name: "Noraini binti Hashim", email: "setiausaha@masjid.demo", role: "SETIAUSAHA", mosqueId: "msq-jb-01", phone: "019-882 3344", mfa: true },
    { id: "usr-bdh", name: "Mohd Farid bin Osman", email: "bendahari@masjid.demo", role: "BENDAHARI", mosqueId: "msq-jb-01", phone: "017-221 9080", mfa: true },
    { id: "usr-ajk", name: "Siti Zubaidah binti Ahmad", email: "ajk@masjid.demo", role: "AJK", mosqueId: "msq-jb-01", phone: "013-455 6677", mfa: false },
    { id: "usr-jainj", name: "En. Rizal bin Hamzah", email: "pegawai@jainj.demo", role: "JAINJ", mosqueId: null, phone: "07-228 7711", mfa: true },
    { id: "usr-aud", name: "Puan Lim Mei Ling", email: "auditor@jainj.demo", role: "AUDITOR", mosqueId: null, phone: "07-228 7712", mfa: true },
    { id: "usr-tutor", name: "Ustazah Nur Aisyah binti Roslan", email: "tutor@masjid.demo", role: "TUTOR", mosqueId: "msq-jb-01", phone: "018-990 1122", mfa: false },
    { id: "usr-jemaah", name: "Ahmad Faiz bin Yusof", email: "jemaah@demo.my", role: "JEMAAH", mosqueId: "msq-jb-01", phone: "011-2233 4455", mfa: false },
    { id: "usr-jemaah2", name: "Salmah binti Khamis", email: "salmah@demo.my", role: "JEMAAH", mosqueId: "msq-jb-01", phone: "016-778 2233", mfa: false },
  ];

  await prisma.user.createMany({
    data: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      mosqueId: u.mosqueId,
      phone: u.phone,
      mfaEnabled: u.mfa,
      emailVerified: u.email.endsWith("@demo.my") ? new Date() : null,
    })),
  });

  // ---------------------------------------------------------------- registry
  const positions = ["PENGERUSI", "TIMBALAN", "SETIAUSAHA", "BENDAHARI", "AJK"];
  const officerNames = ["Hj. Kamarudin bin Salleh", "Hj. Roslan bin Awang", "Noraini binti Hashim", "Mohd Farid bin Osman", "Siti Zubaidah binti Ahmad"];
  for (const m of MOSQUES) {
    await prisma.officer.createMany({
      data: positions.map((position, i) => ({
        id: `off-${m.id}-${i}`,
        mosqueId: m.id,
        name: i === 0 && m.id === "msq-jb-01" ? officerNames[0] : `${officerNames[i]} ${m.district}`,
        position,
        phone: `01${i + 2}-3${i}4 55${i}0`,
        appointmentDate: new Date(year - 1, 0, 15),
        status: "AKTIF",
      })),
    });

    const term = await prisma.committeeTerm.create({
      data: {
        id: `term-${m.id}`,
        mosqueId: m.id,
        label: `Sesi ${year - 1}/${year + 1}`,
        startDate: new Date(year - 1, 0, 1),
        endDate: new Date(year + 1, 11, 31),
        status: "AKTIF",
      },
    });
    await prisma.committeeMember.createMany({
      data: positions.map((position, i) => ({
        termId: term.id,
        name: `${officerNames[i]}${m.id === "msq-jb-01" ? "" : " (" + m.district + ")"}`,
        position,
        phone: `01${i + 2}-3${i}4 55${i}0`,
        icNo: `7${i}0${i}1-14-${5500 + i}`,
        active: true,
      })),
    });
    await prisma.meeting.create({
      data: {
        mosqueId: m.id,
        title: `Mesyuarat AJK Bil. ${m.id === "msq-jb-01" ? 4 : 1}/${year}`,
        date: at(-10 - (m.id === "msq-jb-01" ? 0 : 3), 20),
        location: "Bilik Mesyuarat Masjid",
        agenda: "1. Pengesahan minit 2. Laporan kewangan 3. Selenggaraan 4. Program bulanan",
        decisions: "Laporan kewangan diterima. Baik pulih bumbung diluluskan tertakluk kepada sebut harga.",
        status: "SELESAI",
      },
    });
  }
  await prisma.meeting.create({
    data: {
      mosqueId: "msq-jb-01",
      title: `Mesyuarat AJK Khas Qurban ${year}`,
      date: at(5, 20),
      location: "Bilik Mesyuarat Masjid Al-Falah",
      agenda: "1. Status tempahan qurban 2. Agihan daging 3. Sukarelawan",
      status: "DIRANCANG",
    },
  });

  // ---------------------------------------------------------------- finance
  const ACCOUNTS = [
    { code: "100-001", name: "Tunai di Tangan", type: "ASET" },
    { code: "100-002", name: "Bank Muamalat", type: "ASET" },
    { code: "400-001", name: "Derma Umum", type: "HASIL" },
    { code: "400-002", name: "Infaq & Sedekah", type: "HASIL" },
    { code: "400-003", name: "Sumbangan Qurban", type: "HASIL" },
    { code: "500-001", name: "Utiliti", type: "PERBELANJAAN" },
    { code: "500-002", name: "Penyelenggaraan", type: "PERBELANJAAN" },
    { code: "500-003", name: "Upah & Honorarium", type: "PERBELANJAAN" },
    { code: "500-004", name: "Program & Kuliah", type: "PERBELANJAAN" },
  ];

  for (const m of MOSQUES) {
    await prisma.ledgerAccount.createMany({
      data: ACCOUNTS.map((a) => ({
        id: `acc-${m.id}-${a.code}`,
        mosqueId: m.id,
        code: a.code,
        name: a.name,
        type: a.type,
      })),
    });
  }

  const incomeTemplates = [
    { code: "400-001", desc: "Derma Jumaat", min: 450, max: 1400 },
    { code: "400-002", desc: "Infaq tabung am", min: 120, max: 600 },
    { code: "400-001", desc: "Sumbangan jemaah", min: 200, max: 900 },
  ];
  const expenseTemplates = [
    { code: "500-001", desc: "Bil elektrik TNB", min: 380, max: 1100 },
    { code: "500-001", desc: "Bil air SAJ", min: 90, max: 260 },
    { code: "500-002", desc: "Servis penghawa dingin", min: 150, max: 700 },
    { code: "500-003", desc: "Honorarium bilal & imam", min: 400, max: 1200 },
    { code: "500-004", desc: "Jamuan program kuliah", min: 100, max: 450 },
  ];

  const entries: {
    mosqueId: string; accountId: string; date: Date; description: string; category: string;
    type: string; amountSen: number; method: string; createdById: string | null;
  }[] = [];

  for (const [mi, m] of MOSQUES.entries()) {
    const richness = m.id === "msq-jb-01" ? 3 : 1;
    for (let back = 0; back < 4; back++) {
      for (let k = 0; k < 3 * richness; k++) {
        const t = incomeTemplates[(mi + k + back) % incomeTemplates.length];
        const amount = rm(t.min + ((mi * 37 + k * 53 + back * 71) % (t.max - t.min)));
        entries.push({
          mosqueId: m.id,
          accountId: `acc-${m.id}-${t.code}`,
          date: at(-back * 30 - k * 3, 12),
          description: t.desc,
          category: t.code === "400-001" ? "Derma" : "Infaq",
          type: "MASUK",
          amountSen: amount,
          method: k % 2 === 0 ? "TUNAI" : "QR",
          createdById: m.id === "msq-jb-01" ? "usr-bdh" : null,
        });
      }
      for (let k = 0; k < 3 * richness; k++) {
        const t = expenseTemplates[(mi + k + back) % expenseTemplates.length];
        const amount = rm(t.min + ((mi * 41 + k * 29 + back * 61) % (t.max - t.min)));
        entries.push({
          mosqueId: m.id,
          accountId: `acc-${m.id}-${t.code}`,
          date: at(-back * 30 - k * 4, 15),
          description: t.desc,
          category: t.code === "500-001" ? "Utiliti" : t.code === "500-002" ? "Selenggaraan" : "Operasi",
          type: "KELUAR",
          amountSen: amount,
          method: "BANK",
          createdById: m.id === "msq-jb-01" ? "usr-bdh" : null,
        });
      }
    }
  }
  await prisma.ledgerEntry.createMany({ data: entries });

  for (const [mi, m] of MOSQUES.entries()) {
    for (const offset of [-2, -1, 0]) {
      const start = monthStart(offset);
      const end = monthStart(offset + 1);
      const inMonth = entries.filter((e) => e.mosqueId === m.id && e.date >= start && e.date < end);
      const totalIn = inMonth.filter((e) => e.type === "MASUK").reduce((s, e) => s + e.amountSen, 0);
      const totalOut = inMonth.filter((e) => e.type === "KELUAR").reduce((s, e) => s + e.amountSen, 0);
      const isCurrent = offset === 0;
      if (isCurrent && m.id === "msq-klg-01") continue; // demo: overdue report triggers an alert
      const status = offset === -2
        ? "DILULUSKAN"
        : offset === -1
          ? (mi % 2 === 0 ? "DILULUSKAN" : "DIHANTAR")
          : (m.id === "msq-bp-01" ? "DRAF" : "DIHANTAR");
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      await prisma.monthlyReport.create({
        data: {
          mosqueId: m.id,
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          status,
          totalInSen: totalIn,
          totalOutSen: totalOut,
          notes: null,
          submittedAt: status !== "DRAF" ? new Date(start.getFullYear(), start.getMonth() + 1, 3) : null,
          reviewedAt: status === "DILULUSKAN" ? new Date(start.getFullYear(), start.getMonth() + 1, 6) : null,
          reviewerName: status === "DILULUSKAN" ? "En. Rizal bin Hamzah (JAINJ)" : null,
        },
      });
    }
  }

  // Receipts are issued through the real service so seeded PDFs are downloadable.
  const incomeForReceipts = entries
    .filter((e) => e.mosqueId === "msq-jb-01" && e.type === "MASUK")
    .slice(0, 6);
  const payers = ["Hj. Abdul Rahman", "Puan Hajah Salmah", "Encik Zulkifli", "Tan Sri Osman"];
  for (const [i, e] of incomeForReceipts.entries()) {
    await issueReceipt({
      mosqueId: "msq-jb-01",
      issuedTo: `${payers[i % payers.length]} (Jemaah)`,
      email: "jemaah@demo.my",
      amountSen: e.amountSen,
      purpose: e.description,
      method: e.method === "QR" ? "DuitNow QR (simulasi)" : "Tunai",
    });
  }

  // ---------------------------------------------------------------- maintenance
  const assetSeeds = [
    { name: "Penghawa Dingin Dewan Utama (x8)", category: "ELEKTRIK", location: "Dewan Solat Utama", value: 24000, condition: "BAIK" },
    { name: "Sistem Bunyi JBL", category: "AUDIO", location: "Dewan Solat", value: 8500, condition: "SEDERHANA" },
    { name: "Van Jenazah Toyota Hiace", category: "KENDERAAN", location: "Letak Kereta", value: 98000, condition: "BAIK" },
    { name: "Karpet Solat Saf Utama", category: "PERABOT", location: "Dewan Solat", value: 32000, condition: "SEDERHANA" },
    { name: "Bumbung Dewan Belajar", category: "BANGUNAN", location: "Blok B", value: 45000, condition: "ROSAK" },
    { name: "Projektor Kelas Agama", category: "ELEKTRIK", location: "Bilik Kuliah 1", value: 3200, condition: "BAIK" },
  ];
  for (const m of MOSQUES) {
    const count = m.id === "msq-jb-01" ? assetSeeds.length : 3;
    await prisma.asset.createMany({
      data: assetSeeds.slice(0, count).map((a, i) => ({
        id: `ast-${m.id}-${i}`,
        mosqueId: m.id,
        name: a.name,
        category: a.category,
        location: a.location,
        acquiredAt: new Date(year - 3 + i, i, 12),
        valueSen: rm(a.value),
        condition: m.id === "msq-jb-01" ? a.condition : i === 0 ? "BAIK" : "SEDERHANA",
        status: "AKTIF",
      })),
    });
  }
  await prisma.maintenanceRequest.createMany({
    data: [
      { id: "mr-1", mosqueId: "msq-jb-01", assetId: "ast-msq-jb-01-4", title: "Bocor bumbung Blok B selepas hujan lebat", description: "Air menitis di siling bilik kuliah 2. Perlu pemeriksaan kontraktor bumbung.", priority: "TINGGI", status: "DIHANTAR", reportedBy: "Siti Zubaidah binti Ahmad", createdAt: at(-2, 9) },
      { id: "mr-2", mosqueId: "msq-jb-01", assetId: "ast-msq-jb-01-0", title: "Servis berkala penghawa dingin dewan", description: "Servis tahunan 8 unit.", priority: "SEDERHANA", status: "DALAM_PROSES", reportedBy: "Siti Zubaidah binti Ahmad", assignee: "CoolTech Services", costSen: rm(680), createdAt: at(-12, 10) },
      { id: "mr-3", mosqueId: "msq-jb-01", assetId: "ast-msq-jb-01-2", title: "Tukar tayar van jenazah", description: "Dua tayar belakang haus.", priority: "SEDERHANA", status: "SELESAI", reportedBy: "Hj. Kamarudin bin Salleh", assignee: "Kedai Tayar Ah Seng", costSen: rm(420), createdAt: at(-30, 11), completedAt: at(-26, 16) },
      { id: "mr-4", mosqueId: "msq-jb-02", title: "Lampu koridor tingkat 2 rosak", priority: "RENDAH", status: "DIHANTAR", createdAt: at(-4, 9) },
      { id: "mr-5", mosqueId: "msq-klu-01", title: "Pagar pintu belakang longgar", priority: "TINGGI", status: "DALAM_PROSES", createdAt: at(-6, 9) },
      { id: "mr-6", mosqueId: "msq-bp-01", title: "Paip tandas lelaki tersumbat", priority: "TINGGI", status: "DILULUSKAN", createdAt: at(-3, 9) },
    ],
  });
  await prisma.inspection.createMany({
    data: [
      { mosqueId: "msq-jb-01", assetId: "ast-msq-jb-01-1", date: at(-20), inspector: "Jabatan Bomba & Penyelamat Johor", findings: "Pemeriksaan keselamatan kebakaran tahunan. Alat pemadam dalam keadaan baik.", result: "LULUS" },
      { mosqueId: "msq-jb-01", assetId: "ast-msq-jb-01-5", date: at(-8), inspector: "Siti Zubaidah binti Ahmad", findings: "Projektor bilik kuliah 1 tidak memaparkan imej. Kabel HDMI longgar.", result: "TINDAKAN" },
      { mosqueId: "msq-jb-02", date: at(-15), inspector: "Majlis Bandaraya Johor Bahru", findings: "Pemeriksaan kebersihan premis.", result: "LULUS" },
      ...MOSQUES.filter((m) => !["msq-jb-01", "msq-jb-02"].includes(m.id)).map((m) => ({
        mosqueId: m.id,
        date: at(-18),
        inspector: "Pegawai JAINJ Daerah",
        findings: "Pemeriksaan keselamatan dan kebersihan tahunan.",
        result: "LULUS",
      })),
    ],
  });

  // ---------------------------------------------------------------- projects
  await prisma.project.create({
    data: {
      id: "prj-1", mosqueId: "msq-jb-01", title: "Naik taraf ruang solat wanita", description: "Pemasangan penghawa dingin tambahan, karpet baharu dan bilik wuduk tambahan.",
      budgetSen: rm(120000), spentSen: rm(18500), contractor: "Rezeki Bina Sdn Bhd", startDate: at(-45), endDate: at(60), status: "DALAM_KERJA", approvedBy: "Hj. Kamarudin bin Salleh", createdAt: at(-70),
    },
  });
  await prisma.projectExpense.createMany({
    data: [
      { projectId: "prj-1", date: at(-40), description: "Bayaran muka kontraktor (15%)", amountSen: rm(18000) },
      { projectId: "prj-1", date: at(-32), description: "Pembelian bahan binaan", amountSen: rm(500) },
    ],
  });
  await prisma.project.create({
    data: {
      id: "prj-2", mosqueId: "msq-jb-01", title: "Pembaikan bumbung Blok B", description: "Ganti kepingan bumbung dan saliran. Cadangan untuk kelulusan AJK.",
      budgetSen: rm(38000), contractor: "Bina Jaya Enterprise", status: "DICADANG", createdAt: at(-5),
    },
  });
  await prisma.project.create({
    data: {
      id: "prj-3", mosqueId: "msq-jb-02", title: "Cat semula dewan solat", budgetSen: rm(26000), spentSen: rm(26000),
      contractor: "Warna Baru Enterprise", startDate: at(-120), endDate: at(-30), status: "SELESAI", approvedBy: "En. Rizal bin Hamzah", createdAt: at(-140),
    },
  });

  // ---------------------------------------------------------------- kuliah
  await Promise.all([
    prisma.speaker.create({ data: { id: "spk-1", name: "Ustaz Dr. Ahmad Zaki bin Ismail", tauliahNo: "TLH/JHR/2021/0045", tauliahExpiry: at(400), verified: true, verifiedBy: "JAINJ", district: "Johor Bahru" } }),
    prisma.speaker.create({ data: { id: "spk-2", name: "Ustaz Muhd Firdaus bin Ali", tauliahNo: "TLH/JHR/2022/0312", tauliahExpiry: at(200), verified: true, verifiedBy: "JAINJ", district: "Kulai" } }),
    prisma.speaker.create({ data: { id: "spk-3", name: "Ustazah Dr. Nurul Huda binti Salleh", tauliahNo: "TLH/JHR/2020/0088", tauliahExpiry: at(-15), verified: true, verifiedBy: "JAINJ", district: "Muar" } }),
    prisma.speaker.create({ data: { id: "spk-4", name: "Ustaz Kamal bin Hashim", tauliahNo: "TLH/JHR/2025/0771", tauliahExpiry: at(500), verified: false, district: "Batu Pahat" } }),
  ]);

  const programSeeds = [
    { id: "kul-1", mosqueId: "msq-jb-01", title: "Kuliah Maghrib: Adab Sesama Jiran", type: "KULIAH_MAGHRIB", speakerId: "spk-1", date: at(0, 18), start: "18:45", end: "19:30", location: "Dewan Solat Utama", status: "SAH" },
    { id: "kul-2", mosqueId: "msq-jb-01", title: "Kelas Tajwid Dewasa (Siri 4)", type: "KELAS_QURAN", speakerId: "spk-2", date: at(2, 20), start: "20:00", end: "21:30", location: "Bilik Kuliah 1", status: "SAH" },
    { id: "kul-3", mosqueId: "msq-jb-01", title: "Ceramah Maulidur Rasul", type: "CERAMAH", speakerId: "spk-3", date: at(9, 20), start: "20:15", end: "22:00", location: "Dewan Utama", status: "DIRANCANG" },
    { id: "kul-4", mosqueId: "msq-jb-01", title: "Kuliah Subuh: Tafsir Surah Al-Kahfi", type: "KULIAH_MAGHRIB", speakerId: "spk-1", date: at(-3, 5), start: "05:45", end: "06:15", location: "Dewan Solat Utama", status: "SELESAI" },
    { id: "kul-5", mosqueId: "msq-jb-02", title: "Kuliah Maghrib Mingguan", type: "KULIAH_MAGHRIB", speakerId: "spk-2", date: at(1, 18), start: "18:45", end: "19:30", location: "Dewan Utama", status: "SAH" },
    { id: "kul-6", mosqueId: "msq-klu-01", title: "Program Ihya Ramadan (persediaan)", type: "PROGRAM", speakerId: null, date: at(20, 20), start: "20:00", location: "Dewan Kulai", status: "DIRANCANG" },
  ];
  for (const p of programSeeds) {
    await prisma.kuliahProgram.create({
      data: {
        id: p.id, mosqueId: p.mosqueId, title: p.title, type: p.type, speakerId: p.speakerId,
        date: p.date, startTime: p.start, endTime: p.end, location: p.location, status: p.status,
        capacity: 150,
      },
    });
  }
  const extraPrograms = [] as { id: string; mosqueId: string; title: string; speakerId: string; date: Date; location: string }[];
  const nowDate = new Date();
  for (const m of MOSQUES) {
    if (m.id === "msq-jb-01") continue;
    for (let k = 0; k < 3; k++) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth(), Math.max(2, nowDate.getDate() - (k + 1) * 4), 18);
      extraPrograms.push({
        id: `kul-${m.id}-${k}`,
        mosqueId: m.id,
        title: ["Kuliah Maghrib Mingguan", "Kelas Tajwid Asas", "Kuliah Tafsir Al-Quran"][k],
        speakerId: "spk-2",
        date: d,
        location: "Dewan Solat Utama",
      });
    }
  }
  for (const p of extraPrograms) {
    await prisma.kuliahProgram.create({
      data: {
        id: p.id, mosqueId: p.mosqueId, title: p.title, type: "KULIAH_MAGHRIB", speakerId: p.speakerId,
        date: p.date, startTime: "18:45", endTime: "19:30", location: p.location, status: "SELESAI", capacity: 120,
      },
    });
  }

  const attendeeNames = ["Hj. Abdul Rahman", "Salmah binti Khamis", "Zulkifli bin Ahmad", "Fatimah binti Ali", "Ramasamy a/l Muthu", "Tan Ah Kow", "Nurul Izzah", "Hafiz bin Omar", "Aisyah binti Yusof", "Muhammad Danial"];
  await prisma.attendance.createMany({
    data: attendeeNames.map((name, i) => ({
      programId: "kul-4",
      name,
      phone: `01${i % 9}-3${i}4 21${i}0`,
      checkedIn: at(-3, 5),
    })),
  });
  await prisma.attendance.createMany({
    data: attendeeNames.slice(0, 6).map((name, i) => ({
      programId: "kul-1",
      name,
      phone: `01${i % 9}-3${i}4 21${i}0`,
      checkedIn: at(0, 18),
    })),
  });
  for (const [pi, p] of extraPrograms.entries()) {
    await prisma.attendance.createMany({
      data: attendeeNames.slice(0, 8 + (pi % 6)).map((name, i) => ({
        programId: p.id,
        name,
        phone: `01${i % 9}-3${i}4 21${i}0`,
        checkedIn: p.date,
      })),
    });
  }

  // ---------------------------------------------------------------- donations
  const campaigns = [
    { id: "cmp-1", mosqueId: "msq-jb-01", title: "Naik Taraf Ruang Solat Wanita", target: 150000, raised: 82450, status: "AKTIF", desc: "Menampung kerja naik taraf ruang solat wanita termasuk penghawa dingin dan bilik wuduk." },
    { id: "cmp-2", mosqueId: "msq-jb-01", title: "Tabung Pendidikan Anak Yatim", target: 50000, raised: 31200, status: "AKTIF", desc: "Bantuan persekolahan untuk 40 anak yatim di bawah jagaan masjid." },
    { id: "cmp-3", mosqueId: "msq-jb-01", title: "Pembaikan Bumbung Dewan Belajar", target: 80000, raised: 80000, status: "TAMAT", desc: "Kerja pembaikan bumbung Blok B telah selesai." },
    { id: "cmp-4", mosqueId: "msq-jb-02", title: "Tabung Kebajikan Jemaah", target: 60000, raised: 18400, status: "AKTIF", desc: "Bantuan makanan dan sewa untuk jemaah yang memerlukan." },
    { id: "cmp-5", mosqueId: "msq-klu-01", title: "Naik Taraf Perpustakaan Masjid", target: 40000, raised: 9800, status: "AKTIF", desc: "Koleksi buku dan rak baharu." },
  ];
  for (const c of campaigns) {
    await prisma.campaign.create({
      data: {
        id: c.id, mosqueId: c.mosqueId, title: c.title, description: c.desc,
        targetSen: rm(c.target), raisedSen: rm(c.raised), status: c.status,
        startDate: at(-90), endDate: at(120), qrPayload: `DUITNOW://pay?ref=${c.id}`,
      },
    });
  }

  const donorNames = ["Ahmad Faiz bin Yusof", "Salmah binti Khamis", "Hj. Abdul Rahman", "Tan Sri Osman", "Nurul Izzah", "Zulkifli bin Ahmad", "Fatimah binti Ali", "Kumar a/l Raju", "Anonymous"];
  const donationRows = [] as { id: string; mosqueId: string; campaignId: string; donorName: string; donorEmail: string; amountSen: number; status: string; paidAt: Date | null; gatewayRef: string | null; method: string; recurring: boolean; frequency: string | null; anonymous: boolean; tpmjSynced: boolean; tpmjRef: string | null }[];
  for (let i = 0; i < 24; i++) {
    const campaign = campaigns[i % 3];
    const status = i % 9 === 7 ? "MENUNGGU" : i % 11 === 5 ? "GAGAL" : "DIBAYAR";
    donationRows.push({
      id: `don-${i + 1}`,
      mosqueId: campaign.mosqueId,
      campaignId: campaign.id,
      donorName: donorNames[i % donorNames.length],
      donorEmail: i % 4 === 0 ? "jemaah@demo.my" : `penderma${i}@demo.my`,
      amountSen: rm([50, 100, 200, 500, 1000, 250][i % 6]),
      status,
      paidAt: status === "DIBAYAR" ? at(-(i % 28), 9) : null,
      gatewayRef: status === "DIBAYAR" ? `MOCK-${100000 + i}` : null,
      method: ["QR", "FPX", "KAD"][i % 3],
      recurring: i % 6 === 0,
      frequency: i % 6 === 0 ? "BULANAN" : null,
      anonymous: i % 7 === 0,
      tpmjSynced: status === "DIBAYAR" && i % 3 === 0,
      tpmjRef: status === "DIBAYAR" && i % 3 === 0 ? `TPMJ-${year}-${2200 + i}` : null,
    });
  }
  await prisma.donation.createMany({ data: donationRows });

  // ---------------------------------------------------------------- qurban
  await prisma.qurbanProgram.create({
    data: {
      id: "qb-2026-1", mosqueId: "msq-jb-01", year, animal: "LEMBU", pricePerShareSen: rm(700),
      totalShares: 35, availableShares: 23, permissionStatus: "DILULUSKAN", permissionRef: `JAINJ/QBN/${year}/0187`,
      distributionDate: at(40), status: "DIBUKA", providerName: "Ladang Qurban Kota Tinggi",
    },
  });
  await prisma.qurbanProgram.create({
    data: {
      id: "qb-2025-1", mosqueId: "msq-jb-01", year: year - 1, animal: "KAMBING", pricePerShareSen: rm(450),
      totalShares: 20, availableShares: 0, permissionStatus: "DILULUSKAN", permissionRef: `JAINJ/QBN/${year - 1}/0211`,
      distributionDate: at(-140), status: "SELESAI", providerName: "Ladang Qurban Kota Tinggi",
    },
  });
  await prisma.qurbanProgram.create({
    data: {
      id: "qb-2026-2", mosqueId: "msq-klu-01", year, animal: "LEMBU", pricePerShareSen: rm(750),
      totalShares: 21, availableShares: 21, permissionStatus: "MENUNGGU", status: "DIBUKA",
    },
  });

  const orders = [
    { id: "qo-1", no: `QB/${year}/0001`, programId: "qb-2026-1", name: "Ahmad Faiz bin Yusof", email: "jemaah@demo.my", shares: 1, status: "DIBAYAR" },
    { id: "qo-2", no: `QB/${year}/0002`, programId: "qb-2026-1", name: "Salmah binti Khamis", email: "salmah@demo.my", shares: 2, status: "DIBAYAR" },
    { id: "qo-3", no: `QB/${year}/0003`, programId: "qb-2026-1", name: "Zulkifli bin Ahmad", email: "zul@demo.my", shares: 1, status: "DIBAYAR" },
    { id: "qo-4", no: `QB/${year}/0004`, programId: "qb-2026-1", name: "Fatimah binti Ali", email: "fatimah@demo.my", shares: 4, status: "DIBAYAR" },
    { id: "qo-5", no: `QB/${year}/0005`, programId: "qb-2026-1", name: "Kumar a/l Raju", email: "kumar@demo.my", shares: 1, status: "MENUNGGU" },
    { id: "qo-6", no: `QB/${year}/0006`, programId: "qb-2026-1", name: "Nurul Izzah", email: "izzah@demo.my", shares: 3, status: "MENUNGGU" },
  ];
  for (const o of orders) {
    await prisma.qurbanOrder.create({
      data: {
        id: o.id, orderNo: o.no, programId: o.programId, customerName: o.name, email: o.email,
        phone: "012-345 6789", shares: o.shares, amountSen: rm(700 * o.shares), status: o.status,
        gatewayRef: o.status === "DIBAYAR" ? `MOCK-QB-${o.id}` : null,
        paidAt: o.status === "DIBAYAR" ? at(-20) : null,
      },
    });
  }
  for (let i = 1; i <= 10; i++) {
    await prisma.qurbanDistribution.create({
      data: {
        programId: "qb-2025-1",
        packNo: `PK/${year - 1}/${String(i).padStart(3, "0")}`,
        recipientName: ["Kampung Melayu", "Taman Abad", "Kampung Bakar Batu", "Flat Sri Perak"][i % 4] + ` #${i}`,
        recipientPhone: `012-9${i}0 11${i}2`,
        area: ["Taman Abad", "Bakar Batu", "Stulang", "Majidee"][i % 4],
        deliveredAt: at(-139, 10 + (i % 5)),
        deliveredBy: "Sukarelawan AJK",
      },
    });
  }

  // ---------------------------------------------------------------- quran booking
  for (const t of TUTORS) {
    await prisma.tutor.create({
      data: {
        id: t.id,
        userId: t.email ? "usr-tutor" : null,
        mosqueId: t.id === "tut-3" ? "msq-jb-02" : "msq-jb-01",
        name: t.name,
        gender: t.gender,
        tauliahNo: t.tauliah,
        tauliahExpiry: at(t.id === "tut-3" ? 300 : 500),
        verified: t.verified,
        verifiedBy: t.verified ? "JAINJ" : null,
        hourlyRateSen: rm(t.rate),
        bio: t.id === "tut-1"
          ? "Pengkhususan tajwid dan hafazan untuk kanak-kanak 6-12 tahun. 8 tahun pengalaman mengajar di masjid dan sekolah agama."
          : "Kelas Al-Quran dewasa dan kanak-kanak.",
        status: "AKTIF",
      },
    });
  }

  const slotTimes = ["09:00", "10:30", "14:00", "16:00", "20:00"];
  const slotRows: { id: string; tutorId: string; date: Date; startTime: string; endTime: string; status: string }[] = [];
  for (const t of TUTORS) {
    for (let d = 0; d < 10; d++) {
      for (const [ti, time] of slotTimes.entries()) {
        const date = at(d, Number(time.slice(0, 2)));
        date.setHours(0, 0, 0, 0);
        if (d === 0 && time === "09:00") continue;
        const booked = (d + ti) % 4 === 1;
        slotRows.push({
          id: `slot-${t.id}-${d}-${ti}`,
          tutorId: t.id,
          date,
          startTime: time,
          endTime: `${String(Number(time.slice(0, 2)) + 1).padStart(2, "0")}:${time.slice(3)}`,
          status: booked ? "DITEMPAH" : "TERBUKA",
        });
      }
    }
  }
  await prisma.quranSlot.createMany({ data: slotRows });

  const bookedSlots = slotRows.filter((s) => s.status === "DITEMPAH" && s.tutorId === "tut-1").slice(0, 5);
  let bookingNo = 1;
  for (const [i, s] of bookedSlots.entries()) {
    const hours = 1;
    const amount = 5000 * hours;
    await prisma.quranBooking.create({
      data: {
        id: `book-${i + 1}`,
        bookingNo: `QRN/${year}/${String(bookingNo++).padStart(4, "0")}`,
        slotId: s.id,
        tutorId: s.tutorId,
        parentUserId: i === 0 ? "usr-jemaah" : null,
        parentName: ["Ahmad Faiz bin Yusof", "Salmah binti Khamis", "Zulkifli bin Ahmad", "Fatimah binti Ali", "Nurul Izzah"][i],
        parentEmail: i === 0 ? "jemaah@demo.my" : `ibubapa${i}@demo.my`,
        parentPhone: `012-345 67${i}8`,
        studentName: ["Muhammad Danial", "Nur Alya", "Ahmad Zafran", "Siti Khadijah", "Muhammad Adam"][i],
        studentAge: 8 + i,
        studentCount: 1,
        hours,
        amountSen: amount,
        commissionSen: Math.round(amount * 0.15),
        guardianConsent: true,
        consentAt: at(-1),
        consentRef: `CONSENT-${1000 + i}`,
        status: i === 0 ? "DISAHKAN" : "DISAHKAN",
        gatewayRef: `MOCK-QRN-${100 + i}`,
        createdAt: at(-2),
      },
    });
    // one upcoming booking awaiting payment
  }

  const openSlot = slotRows.find((s) => s.tutorId === "tut-1" && s.status === "TERBUKA" && s.date > new Date());
  if (openSlot) {
    await prisma.quranSlot.update({ where: { id: openSlot.id }, data: { status: "DITEMPAH" } });
    await prisma.quranBooking.create({
      data: {
        id: "book-pending",
        bookingNo: `QRN/${year}/${String(bookingNo++).padStart(4, "0")}`,
        slotId: openSlot.id,
        tutorId: "tut-1",
        parentUserId: "usr-jemaah",
        parentName: "Ahmad Faiz bin Yusof",
        parentEmail: "jemaah@demo.my",
        parentPhone: "011-2233 4455",
        studentName: "Muhammad Danial",
        studentAge: 9,
        studentCount: 1,
        hours: 1,
        amountSen: rm(50),
        commissionSen: rm(7.5),
        guardianConsent: true,
        consentAt: at(-1),
        consentRef: "CONSENT-2001",
        status: "MENUNGGU_BAYARAN",
        createdAt: new Date(Date.now() - 5 * 60_000),
      },
    });
  }

  await prisma.payout.createMany({
    data: [
      { id: "pay-1", tutorId: "tut-1", mosqueId: "msq-jb-01", periodStart: monthStart(-1), periodEnd: monthStart(0), grossSen: rm(600), commissionSen: rm(90), netSen: rm(510), status: "DIBAYAR", paidAt: at(-5), reference: "MOCK-PAYOUT-0001" },
      { id: "pay-2", tutorId: "tut-1", mosqueId: "msq-jb-01", periodStart: monthStart(0), periodEnd: monthStart(1), grossSen: rm(250), commissionSen: rm(37.5), netSen: rm(212.5), status: "MENUNGGU" },
    ],
  });

  // ---------------------------------------------------------------- scoring
  for (const m of MOSQUES) {
    for (const offset of [-2, -1, 0]) {
      const d = monthStart(offset);
      const drift = offset === 0 ? 0 : offset === -1 ? -3 : -6;
      const total = Math.max(40, Math.min(98, m.score + drift));
      const financeScore = Math.min(100, total + 4);
      const registryScore = Math.min(100, total + 1);
      const maintenanceScore = Math.max(30, total - 8);
      const programScore = Math.min(100, total + 2);
      await prisma.scoreSnapshot.create({
        data: {
          mosqueId: m.id,
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          total,
          financeScore,
          registryScore,
          maintenanceScore,
          programScore,
          breakdown: JSON.stringify({
            kewangan: { skor: financeScore, berat: 30, nota: "Laporan bulanan dihantar tepat pada masa" },
            pendaftaran: { skor: registryScore, berat: 20, nota: "Profil dan AJK lengkap" },
            selenggaraan: { skor: maintenanceScore, berat: 25, nota: "Terdapat aduan tertunggak" },
            program: { skor: programScore, berat: 25, nota: "Kuliah mingguan konsisten" },
          }),
        },
      });
    }
  }

  // ---------------------------------------------------------------- platform
  await prisma.integrationConfig.createMany({
    data: [
      { key: "gateway", name: "Gerbang Pembayaran (DuitNow QR / FPX / Kad)", mode: "MOCK", enabled: true, config: JSON.stringify({ splitSettlement: true, commissionPct: 1.5, settlementTo: "mosque_or_tutor" }) },
      { key: "tpmj", name: "Tabung Pembangunan Masjid Johor (TPMJ)", mode: "MOCK", enabled: true, config: JSON.stringify({ reconciliation: "harian", channel: "dedicated" }) },
      { key: "jainj", name: "Data Induk JAINJ (masjid & tauliah)", mode: "MOCK", enabled: true, config: JSON.stringify({ schedule: "harian 02:00" }) },
      { key: "messaging", name: "Penyedia Mesej (SMS / WhatsApp)", mode: "MOCK", enabled: true, config: JSON.stringify({ sender: "SPMJ", whatsappTemplate: "utility" }) },
    ],
  });
  await prisma.syncRun.createMany({
    data: [
      { integration: "jainj", direction: "INBOUND", status: "BERJAYA", records: 6, log: "6 masjid disegerakkan; 4 pemegang tauliah dikemas kini.", startedAt: at(-1, 2), finishedAt: at(-1, 2) },
      { integration: "tpmj", direction: "OUTBOUND", status: "BERJAYA", records: 8, log: "8 derma dihantar ke TPMJ; 0 konflik.", startedAt: at(-1, 23), finishedAt: at(-1, 23) },
      { integration: "messaging", direction: "OUTBOUND", status: "BERJAYA", records: 14, log: "Resit dan peringatan dihantar.", startedAt: at(0, 8), finishedAt: at(0, 8) },
    ],
  });
  await prisma.notification.createMany({
    data: [
      { mosqueId: "msq-jb-01", userId: "usr-bdh", channel: "WHATSAPP", to: "017-221 9080", template: "laporan_menunggu", subject: "Laporan bulanan menunggu semakan", body: `Laporan kewangan ${month}/${year} Masjid Al-Falah telah dihantar untuk semakan JAINJ.`, status: "DIHANTAR", sentAt: at(-3, 9) },
      { mosqueId: "msq-jb-01", userId: "usr-jemaah", channel: "EMAIL", to: "jemaah@demo.my", template: "resit", subject: "Resit derma anda", body: "Terima kasih atas derma RM100.00 kepada Tabung Pendidikan Anak Yatim.", status: "DIHANTAR", sentAt: at(-4, 10) },
      { mosqueId: "msq-jb-01", channel: "SMS", to: "012-773 4411", template: "peringatan_qurban", subject: null, body: `Peringatan: Mesyuarat AJK Khas Qurban ${year} pada 5 hari lagi.`, status: "BERGILIR", payload: JSON.stringify({ when: "5 hari" }) },
      { mosqueId: "msq-jb-01", channel: "INAP", to: "usr-ajk", template: "aduan_baru", subject: "Aduan selenggaraan baharu", body: "Bocor bumbung Blok B dilaporkan dan memerlukan kelulusan.", status: "DIHANTAR", sentAt: at(-2, 9) },
      { mosqueId: "msq-klu-01", channel: "SMS", to: "07-662 7788", template: "skor", subject: null, body: "Skor prestasi bulanan masjid anda: 74/100.", status: "DIHANTAR", sentAt: at(-1, 8) },
      { mosqueId: "msq-jb-01", userId: "usr-tutor", channel: "WHATSAPP", to: "018-990 1122", template: "tempahan_baharu", subject: null, body: "Tempahan baharu: Muhammad Danial, 1 jam pada slot akan datang.", status: "BERGILIR" },
    ],
  });

  const auditRows = [
    { actorId: "usr-bdh", actorEmail: "bendahari@masjid.demo", actorRole: "BENDAHARI", action: "CREATE", entity: "LedgerEntry", entityId: "seed-1", mosqueId: "msq-jb-01", after: JSON.stringify({ description: "Bil elektrik TNB", amountSen: rm(880) }) },
    { actorId: "usr-bdh", actorEmail: "bendahari@masjid.demo", actorRole: "BENDAHARI", action: "APPROVE", entity: "MonthlyReport", entityId: "seed-2", mosqueId: "msq-jb-01", after: JSON.stringify({ status: "DIHANTAR" }) },
    { actorId: "usr-jainj", actorEmail: "pegawai@jainj.demo", actorRole: "JAINJ", action: "APPROVE", entity: "MonthlyReport", entityId: "seed-3", mosqueId: "msq-jb-02", after: JSON.stringify({ status: "DILULUSKAN" }) },
    { actorId: "usr-ajk", actorEmail: "ajk@masjid.demo", actorRole: "AJK", action: "CREATE", entity: "MaintenanceRequest", entityId: "mr-1", mosqueId: "msq-jb-01", after: JSON.stringify({ title: "Bocor bumbung Blok B" }) },
    { actorId: "usr-ketua", actorEmail: "ketua@masjid.demo", actorRole: "KETUA", action: "APPROVE", entity: "Project", entityId: "prj-1", mosqueId: "msq-jb-01", after: JSON.stringify({ status: "DALAM_KERJA" }) },
    { actorId: "usr-jainj", actorEmail: "pegawai@jainj.demo", actorRole: "JAINJ", action: "SYNC", entity: "SyncRun", entityId: "sync-1", mosqueId: null, after: JSON.stringify({ integration: "jainj", records: 6 }) },
    { actorId: "usr-tutor", actorEmail: "tutor@masjid.demo", actorRole: "TUTOR", action: "UPDATE", entity: "Tutor", entityId: "tut-1", mosqueId: "msq-jb-01", after: JSON.stringify({ hourlyRateSen: rm(50) }) },
    { actorId: "usr-jemaah", actorEmail: "jemaah@demo.my", actorRole: "JEMAAH", action: "PAY", entity: "Donation", entityId: "don-1", mosqueId: "msq-jb-01", after: JSON.stringify({ amountSen: rm(100), status: "DIBAYAR" }) },
    { actorId: "usr-jemaah", actorEmail: "jemaah@demo.my", actorRole: "JEMAAH", action: "CREATE", entity: "QuranBooking", entityId: "book-pending", mosqueId: "msq-jb-01", after: JSON.stringify({ student: "Muhammad Danial", guardianConsent: true }) },
    { actorId: "usr-aud", actorEmail: "auditor@jainj.demo", actorRole: "AUDITOR", action: "EXPORT", entity: "MonthlyReport", entityId: "seed-4", mosqueId: "msq-jb-01", after: JSON.stringify({ format: "PDF", month }) },
  ];
  for (const [i, a] of auditRows.entries()) {
    await prisma.auditLog.create({ data: { ...a, ip: "10.0.0." + (10 + i), at: at(-i * 0.4, 9 + (i % 6)) } });
  }

  // Align seeded snapshots with what the scoring engine actually computes.
  for (const back of [2, 1, 0]) await computeAllScores(back);

  const counts = {
    mosques: await prisma.mosque.count(),
    users: await prisma.user.count(),
    ledgerEntries: await prisma.ledgerEntry.count(),
    campaigns: await prisma.campaign.count(),
    donations: await prisma.donation.count(),
    slots: await prisma.quranSlot.count(),
    bookings: await prisma.quranBooking.count(),
    scores: await prisma.scoreSnapshot.count(),
  };
  console.log("Seed selesai:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
