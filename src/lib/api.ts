import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type ApiUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
  mosqueId: string | null;
};

export async function requireApiUser(roles?: Role[]): Promise<ApiUser> {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "Sesi tamat. Sila log masuk semula.");
  const user = session.user as ApiUser;
  if (roles?.length && !roles.includes(user.role)) {
    throw new HttpError(403, "Anda tiada kebenaran untuk tindakan ini.");
  }
  return user;
}

/** Mutating requests must originate from this app (basic CSRF defence on top of SameSite cookies). */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  const expected = new URL(origin).host;
  if (host && expected !== host) throw new HttpError(403, "Permintaan dari sumber tidak sah.");
}

export function handleApiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Data tidak sah.", issues: error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  console.error("[api]", error);
  return NextResponse.json({ error: "Ralat dalaman pelayan." }, { status: 500 });
}

/** Mosques a portal user may act on. KETUA/AJK/SETIAUSAHA/BENDAHARI are scoped to their mosque. */
export function scopedMosqueId(user: ApiUser, requested?: string | null) {
  if (user.role === "JAINJ" || user.role === "AUDITOR") {
    if (!requested) throw new HttpError(400, "mosqueId diperlukan.");
    return requested;
  }
  if (!user.mosqueId) throw new HttpError(403, "Akaun anda belum dikaitkan dengan masjid.");
  return user.mosqueId;
}
