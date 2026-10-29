"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { audit } from "@/lib/audit";
import { computeAllScores } from "@/lib/scoring";

const BASE = "/jainj/skor";

export async function recalculateScores(formData: FormData) {
  const user = await requirePageUser(["JAINJ"]);
  const requested = String(formData.get("bulan") ?? "").trim();
  const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : "";

  const results = await computeAllScores(0);
  const now = new Date();

  await audit({
    actor: user,
    action: "SYNC",
    entity: "ScoreSnapshot",
    after: {
      skop: "bulan semasa",
      bulan: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      count: results.length,
    },
  });

  revalidatePath(BASE);
  revalidatePath("/jainj");
  revalidatePath("/jainj/amaran");
  redirect(`${BASE}${bulan ? `?bulan=${bulan}&` : "?"}selesai=1`);
}
