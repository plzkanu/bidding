import { DashboardHome } from "@/components/dashboard-home";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function DashboardPage() {
  const configured = isSupabaseConfigured();

  return configured ? <DashboardHome /> : <SupabaseConfigAlert />;
}
