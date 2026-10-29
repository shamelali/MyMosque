import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRole, ROLE_HOME, type Role } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import {
  CHANNEL_META,
  JEMAAH_NAV,
  JAINJ_NAV,
  PORTAL_NAV,
  TUTOR_NAV,
  type Channel,
} from "@/lib/nav";

const NAV = {
  portal: PORTAL_NAV,
  jainj: JAINJ_NAV,
  tutor: TUTOR_NAV,
  jemaah: JEMAAH_NAV,
} satisfies Record<Channel, unknown>;

export async function requirePageUser(roles?: Role[]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;
  if (roles && !roles.includes(role)) redirect(isRole(role) ? ROLE_HOME[role] : "/jemaah");
  return session.user;
}

export async function ChannelShell({
  channel,
  roles,
  children,
}: {
  channel: Channel;
  roles?: Role[];
  children: React.ReactNode;
}) {
  const user = await requirePageUser(roles);
  const mosque = user.mosqueId
    ? await prisma.mosque.findUnique({
        where: { id: user.mosqueId },
        select: { name: true, district: true },
      })
    : null;

  return (
    <AppShell
      channel={channel}
      nav={NAV[channel] as typeof PORTAL_NAV}
      user={{
        name: user.name ?? user.email ?? "Pengguna",
        email: user.email ?? "",
        role: user.role,
        mosqueName: mosque?.name ?? CHANNEL_META[channel].subtitle,
      }}
    >
      {children}
    </AppShell>
  );
}

export async function currentMosque() {
  const user = await requirePageUser();
  if (!user.mosqueId) throw new Error("Akaun ini tidak dikaitkan dengan masjid");
  return prisma.mosque.findUniqueOrThrow({ where: { id: user.mosqueId } });
}
