"use server";

import { requirePageUser } from "@/components/channel-shell";
import { signOut } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function logout() {
  const user = await requirePageUser();
  await audit({
    actor: user,
    action: "LOGOUT",
    entity: "User",
    entityId: user.id,
    mosqueId: user.mosqueId,
  });
  await signOut({ redirectTo: "/login" });
}
