"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { renderLetter } from "@/lib/documents";
import { putObject } from "@/lib/storage";
import type { Role } from "@/lib/roles";

const BASE = "/portal/dokumen";
const MANAGERS: Role[] = ["SETIAUSAHA", "BENDAHARI", "KETUA"];
const LETTER_TYPES = ["SURAT", "MINIT", "LAPORAN"] as const;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

export async function createLetter(formData: FormData) {
  const user = await requirePageUser(MANAGERS);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const title = text(formData, "title");
  const body = text(formData, "body");
  const typeRaw = text(formData, "type");

  if (!title) fail("Tajuk dokumen wajib diisi.");
  if (title.length > 160) fail("Tajuk dokumen terlalu panjang (maksimum 160 aksara).");
  if (body.length < 10) fail("Kandungan dokumen sekurang-kurangnya 10 aksara.");
  if (body.length > 20000) fail("Kandungan dokumen terlalu panjang (maksimum 20,000 aksara).");
  if (!LETTER_TYPES.includes(typeRaw as (typeof LETTER_TYPES)[number])) {
    fail("Jenis dokumen tidak sah.");
  }
  const type = typeRaw as (typeof LETTER_TYPES)[number];

  let document: Awaited<ReturnType<typeof renderLetter>> | null = null;
  try {
    document = await renderLetter({
      mosqueId: user.mosqueId,
      title,
      body,
      type,
    });
  } catch (error) {
    console.error("[dokumen] gagal menjana dokumen", error);
    fail("Dokumen gagal dijana. Sila cuba semula.");
  }
  if (!document) fail("Dokumen gagal dijana. Sila cuba semula.");

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Document",
    entityId: document.id,
    mosqueId: user.mosqueId,
    after: { title, type, storageKey: document.storageKey },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(`${BASE}?selesai=surat`);
}

export async function uploadDocument(formData: FormData) {
  const user = await requirePageUser(MANAGERS);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const file = formData.get("file");
  const title = text(formData, "title");
  const typeRaw = text(formData, "type");

  if (!(file instanceof File)) fail("Fail tidak dijumpai.");
  if (!title) fail("Tajuk wajib diisi.");
  if (title.length > 160) fail("Tajuk terlalu panjang (maksimum 160 aksara).");

  const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    fail("Jenis fail tidak dibenarkan (PDF, PNG, JPG, WEBP sahaja).");
  }

  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) fail("Fail terlalu besar (maksimum 10 MB).");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const key = await putObject({
    data: buffer,
    contentType: file.type,
    originalName: file.name,
  });

  const document = await prisma.document.create({
    data: {
      mosqueId: user.mosqueId,
      type: typeRaw || "SURAT",
      title,
      storageKey: key,
      createdById: user.id,
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Document",
    entityId: document.id,
    mosqueId: user.mosqueId,
    after: { title, type: document.type, storageKey: key },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(`${BASE}?selesai=muatnaik`);
}
