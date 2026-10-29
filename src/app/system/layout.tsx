import { ChannelShell } from "@/components/channel-shell";
import { OVERSIGHT_ROLES } from "@/lib/roles";

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelShell channel="jainj" roles={OVERSIGHT_ROLES}>
      {children}
    </ChannelShell>
  );
}
