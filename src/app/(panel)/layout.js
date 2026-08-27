import { redirect } from "next/navigation";

import { PanelShell } from "@/components/layout/panel-shell";
import { createClient } from "@/lib/supabase/server";

export default async function PanelLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <PanelShell>{children}</PanelShell>;
}
