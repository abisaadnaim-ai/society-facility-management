import { createClient } from "@/lib/supabase/server";
import { getPpmPlans, isoToday } from "@/lib/queries/ppm";
import { PpmScheduleView } from "@/components/facility/ppm-schedule-view";

export default async function PpmSchedulePage() {
  const supabase = await createClient();
  // Reuse the existing PPM plans query (active plans only). The next_due_date it
  // returns is produced by the database scheduling engine; this view only groups by it.
  const plans = await getPpmPlans(supabase, { status: "active" });

  return <PpmScheduleView plans={plans} today={isoToday()} />;
}
