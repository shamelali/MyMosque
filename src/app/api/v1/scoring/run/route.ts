import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertSameOrigin, handleApiError, requireApiUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { computeAllScores } from "@/lib/scoring";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(["JAINJ"]);
    assertSameOrigin(request);

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

    revalidatePath("/jainj");
    revalidatePath("/jainj/skor");
    revalidatePath("/jainj/amaran");

    return NextResponse.json({ ok: true, count: results.length });
  } catch (error) {
    return handleApiError(error);
  }
}
