import { ChannelShell } from "@/components/channel-shell";

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChannelShell channel="tutor" roles={["TUTOR"]}>
      {children}
    </ChannelShell>
  );
}
