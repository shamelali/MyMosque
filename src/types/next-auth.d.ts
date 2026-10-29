import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      mosqueId: string | null;
      mfaEnabled: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    mosqueId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    mosqueId?: string | null;
    mfaEnabled?: boolean;
  }
}
