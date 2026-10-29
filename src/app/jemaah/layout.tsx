import { ChannelShell } from "@/components/channel-shell";

export default function JemaahLayout({ children }: { children: React.ReactNode }) {
  return <ChannelShell channel="jemaah">{children}</ChannelShell>;
}
