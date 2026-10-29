"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireTutor } from "../_lib";

const BASE = "/tutor/profil";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

function maklum(message: string): never {
  redirect(`${BASE}?maklum=${encodeURIComponent(message)}`);
}

export async function updateProfile(formData: FormData) {
  const { user, tutor } = await requireTutor();

  const bio = text(formData, "bio").slice(0, 1000);
  const rateRaw = text(formData, "hourlyRate").replace(",", ".");
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate < 10 || rate > 500) {
    fail("Kadar sejam mesti antara RM10.00 dan RM500.00.");
  }

  const status = text(formData, "status");
  if (status !== "AKTIF" && status !== "DIGANTUNG") {
    fail("Status tutor tidak sah.");
  }

  const hourlyRateSen = Math.round(rate * 100);

  await prisma.tutor.update({
    where: { id: tutor.id },
    data: {
      bio: bio.length > 0 ? bio : null,
      hourlyRateSen,
      status,
    },
  });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "Tutor",
    entityId: tutor.id,
    mosqueId: tutor.mosqueId,
    before: { bio: tutor.bio, hourlyRateSen: tutor.hourlyRateSen, status: tutor.status },
    after: { bio: bio.length > 0 ? bio : null, hourlyRateSen, status },
  });

  revalidatePath(BASE);
  revalidatePath("/tutor");
  revalidatePath("/jemaah/quran");
  revalidatePath("/portal/quran");
  maklum("Profil tutor anda telah dikemas kini.");
}
