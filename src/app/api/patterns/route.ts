import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import { SAMPLE_PATTERNS } from "@/lib/sampleData";

// GET /api/patterns?narrator_id=...   そのナレーターの最新の型1件
export async function GET(req: Request) {
  try {
    const narratorId = new URL(req.url).searchParams.get("narrator_id");
    if (!narratorId) return fail("narrator_id は必須です");

    const { role } = await getAuth();
    if (role !== "admin") {
      return ok(SAMPLE_PATTERNS.find((p) => p.narrator_id === narratorId) ?? null);
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.patterns)
      .select("*")
      .eq("narrator_id", narratorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
