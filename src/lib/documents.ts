import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { putObject } from "@/lib/storage";
import { tarikh } from "@/lib/utils";

// P03 documents: PDF receipts and letters rendered server-side and stored in D02.

function renderPdf(render: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    render(doc);
    doc.end();
  });
}

export function nextReceiptNumber(mosqueCode: string, seq: number, year = new Date().getFullYear()) {
  const prefix = (mosqueCode.split("/").pop() ?? "MSQ").toUpperCase();
  return `${prefix}/${year}/R${String(seq).padStart(4, "0")}`;
}

type ReceiptInput = {
  mosqueId: string;
  issuedTo: string;
  email?: string | null;
  amountSen: number;
  purpose: string;
  method?: string | null;
  entryId?: string | null;
  donationId?: string | null;
};

export async function issueReceipt(input: ReceiptInput) {
  const mosque = await prisma.mosque.findUniqueOrThrow({ where: { id: input.mosqueId } });
  const count = await prisma.receipt.count({ where: { mosqueId: input.mosqueId } });
  const number = nextReceiptNumber(mosque.code, count + 1);
  const issuedAt = new Date();

  const pdf = await renderPdf((doc) => {
    doc.fillColor("#0c2f22").fontSize(9).font("Helvetica-Bold").text("SISTEM PENGURUSAN MASJID JOHOR", 56, 48);
    doc.fillColor("#8a8f8b").font("Helvetica").fontSize(8).text("Resit rasmi dijana oleh platform SPMJ", 56, 60);

    doc.moveDown(3);
    doc.fillColor("#0c2f22").font("Helvetica-Bold").fontSize(22).text("RESIT", 56, 105);
    doc.font("Helvetica").fontSize(9).fillColor("#555").text(`No. ${number}`, 56, 132);
    doc.text(`Tarikh: ${tarikh(issuedAt)}`, 56, 145);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0c2f22").text("Masjid", 56, 180);
    doc.font("Helvetica").fontSize(10).fillColor("#333").text(mosque.name, 56, 195);
    doc.fillColor("#666").fontSize(9).text(`${mosque.address ?? ""}`, 56, 209);
    doc.text(`Kod JAINJ: ${mosque.code}`, 56, 222);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0c2f22").text("Diterima daripada", 56, 255);
    doc.font("Helvetica").fontSize(10).fillColor("#333").text(input.issuedTo, 56, 270);
    if (input.email) doc.fontSize(9).fillColor("#666").text(input.email, 56, 284);

    doc.roundedRect(56, 315, 483, 92, 8).fill("#f6f4ee");
    doc.fillColor("#0c2f22").font("Helvetica-Bold").fontSize(9).text("TUJUAN", 76, 335);
    doc.font("Helvetica").fontSize(11).fillColor("#222").text(input.purpose, 76, 350, { width: 300 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0c2f22").text("JUMLAH", 400, 335, { width: 120, align: "right" });
    doc.fontSize(18).text(`RM ${(input.amountSen / 100).toFixed(2)}`, 340, 352, { width: 180, align: "right" });

    doc.fontSize(9).fillColor("#666").font("Helvetica").text(`Kaedah bayaran: ${input.method ?? "Tunai"}`, 56, 430);
    doc.text("Resit ini dijana secara automatik dan sah tanpa tandatangan basah.", 56, 444);

    doc.fontSize(8).fillColor("#999").text(
      "Dokumen ini adalah rekod simulator untuk tujuan demo. Tiada transaksi wang sebenar berlaku.",
      56,
      760,
      { width: 483 },
    );
  });

  const storageKey = await putObject({
    key: `receipts/${mosque.id}/${number.replaceAll("/", "-")}.pdf`,
    data: pdf,
    contentType: "application/pdf",
    originalName: `resit-${number.replaceAll("/", "-")}.pdf`,
  });

  const receipt = await prisma.receipt.create({
    data: {
      mosqueId: input.mosqueId,
      number,
      issuedTo: input.issuedTo,
      email: input.email ?? null,
      amountSen: input.amountSen,
      entryId: input.entryId ?? null,
      donationId: input.donationId ?? null,
      storageKey,
    },
  });

  await prisma.document.create({
    data: {
      mosqueId: input.mosqueId,
      type: "RESIT",
      refId: receipt.id,
      title: `Resit ${number} — ${input.issuedTo}`,
      storageKey,
    },
  });

  return receipt;
}

/** Simple letter/minutes PDF for the documents module. */
export async function renderLetter(input: {
  mosqueId: string;
  title: string;
  body: string;
  type?: "SURAT" | "LAPORAN" | "MINIT";
  refId?: string;
}) {
  const mosque = await prisma.mosque.findUniqueOrThrow({ where: { id: input.mosqueId } });
  const pdf = await renderPdf((doc) => {
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#0c2f22").text(mosque.name.toUpperCase(), { align: "center" });
    doc.font("Helvetica").fontSize(9).fillColor("#666").text(`${mosque.address ?? ""} · ${mosque.phone ?? ""}`, { align: "center" });
    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111").text(input.title);
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10).fillColor("#333").text(input.body, { lineGap: 4 });
    doc.moveDown(3);
    doc.fontSize(9).fillColor("#777").text(`Dijana: ${tarikh(new Date())}`);
  });
  const key = await putObject({
    key: `documents/${mosque.id}/${Date.now()}-${input.type ?? "SURAT"}.pdf`,
    data: pdf,
    contentType: "application/pdf",
    originalName: `${input.title}.pdf`,
  });
  return prisma.document.create({
    data: {
      mosqueId: input.mosqueId,
      type: input.type ?? "SURAT",
      refId: input.refId ?? null,
      title: input.title,
      storageKey: key,
    },
  });
}

