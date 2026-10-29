import { ChannelShell } from "@/components/channel-shell";
import { OVERSIGHT_ROLES } from "@/lib/roles";

export default function JainjLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelShell channel="jainj" roles={OVERSIGHT_ROLES}>
      {children}
    </ChannelShell>
  );
}
