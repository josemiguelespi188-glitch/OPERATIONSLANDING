import { HomePageClient } from "@/components/HomePageClient";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Which cards show on the homepage can be toggled from the admin Form
// Builder (request_types.is_active) — always fetch the latest state
// instead of caching a build-time snapshot.
export const dynamic = "force-dynamic";

async function getInactiveSlugs(): Promise<string[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase.from("request_types").select("slug").eq("is_active", false);
    return (data ?? []).map((row) => row.slug);
  } catch {
    // A missing Supabase config or a network hiccup should never hide a
    // live form — fall back to showing every card.
    return [];
  }
}

export default async function HomePage() {
  const inactiveSlugs = await getInactiveSlugs();
  return <HomePageClient inactiveSlugs={inactiveSlugs} />;
}
