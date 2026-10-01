"use server";

import { redirect } from "next/navigation";
import { signInAdmin, signOutAdmin } from "@/lib/admin";

export type SignInState = { error?: string };

export async function adminSignIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const ok = await signInAdmin(String(formData.get("password") ?? ""));
  if (!ok) return { error: "That password isn't right." };
  redirect("/admin");
}

export async function adminSignOut() {
  await signOutAdmin();
  redirect("/admin");
}
