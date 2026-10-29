import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { isRole, ROLE_HOME } from "@/lib/roles";

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const providers: NextAuthConfig["providers"] = [];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

providers.push(
  Credentials({
    name: "Demo",
    credentials: {
      email: { label: "E-mel", type: "email" },
      password: { label: "Kata laluan", type: "password" },
    },
    async authorize(raw) {
      const parsed = z
        .object({ email: z.string().email(), password: z.string().min(1) })
        .safeParse(raw);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
);

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers,
  callbacks: {
    async jwt({ token, user, trigger }) {
      const email = (user?.email ?? token.email)?.toLowerCase();
      if (!email) return token;
      if (user?.id || trigger === "update" || !token.role) {
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.mosqueId = dbUser.mosqueId ?? null;
          token.mfaEnabled = dbUser.mfaEnabled;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.uid === "string" ? token.uid : (token.sub ?? "");
        session.user.role = isRole(token.role as string) ? (token.role as never) : "JEMAAH";
        session.user.mosqueId = typeof token.mosqueId === "string" ? token.mosqueId : null;
        session.user.mfaEnabled = Boolean(token.mfaEnabled);
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.email) return;
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { id: true, role: true, mosqueId: true },
      });
      if (!dbUser) return;
      await prisma.auditLog.create({
        data: {
          actorId: dbUser.id,
          actorEmail: user.email,
          actorRole: dbUser.role,
          action: "LOGIN",
          entity: "Session",
          mosqueId: dbUser.mosqueId,
          after: JSON.stringify({ provider: "spmj" }),
        },
      });
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { googleEnabled };

/** Post-login destination for a role. */
export function homeFor(role: string | null | undefined) {
  return isRole(role) ? ROLE_HOME[role] : "/jemaah";
}
