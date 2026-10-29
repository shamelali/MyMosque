import { ChannelShell } from "@/components/channel-shell";
import { PORTAL_ROLES } from "@/lib/roles";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelShell channel="portal" roles={PORTAL_ROLES}>
      {children}
    </ChannelShell>
  );
}
