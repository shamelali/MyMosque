"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const BASE = "/jainj/tauliah";

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

export async function setVerification(formData: FormData) {
  const user = await requirePageUser(["JAINJ"]);
  const id = String(formData.get("id") ?? "").trim();
  const verified = String(formData.get("verified") ?? "") === "1";
  if (!id) fail("Rekod pemegang tauliah tidak sah.");

  const speaker = await prisma.speaker.findUnique({ where: { id } });
  if (!speaker) fail("Pemegang tauliah tidak dijumpai.");

  const updated = await prisma.speaker.update({
    where: { id: speaker.id },
    data: {
      verified,
      verifiedBy: verified ? user.name ?? user.email ?? "Pegawai JAINJ" : null,
    },
  });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "Speaker",
    entityId: speaker.id,
    before: { verified: speaker.verified, verifiedBy: speaker.verifiedBy },
    after: { verified: updated.verified, verifiedBy: updated.verifiedBy },
  });

  revalidatePath(BASE);
  revalidatePath("/jainj");
  revalidatePath("/jainj/amaran");
  redirect(`${BASE}?selesai=${verified ? "sah" : "nyah"}`);
}
