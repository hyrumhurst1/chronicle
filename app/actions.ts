"use server";

import { redirect } from "next/navigation";
import { parseRepoInput } from "@/lib/parseRepo";

export async function submitRepo(formData: FormData): Promise<void> {
  const raw = String(formData.get("repo") ?? "");
  const ref = parseRepoInput(raw);
  if (!ref) {
    redirect(`/?error=invalid&input=${encodeURIComponent(raw)}`);
  }
  redirect(`/r/${ref.owner}/${ref.repo}`);
}
