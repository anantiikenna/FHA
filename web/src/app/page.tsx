import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";

export default async function Home() {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
