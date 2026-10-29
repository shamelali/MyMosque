"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { homeFor } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function demoSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const provided = String(formData.get("password") ?? "");
  const password = provided || process.env.DEMO_PASSWORD || "demo1234";

  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (!user) redirect("/login?ralat=akaun");

  try {
    await signIn("credentials", { email, password, redirectTo: homeFor(user.role) });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?ralat=kelayakan");
    throw error;
  }
}

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/jemaah" });
}
