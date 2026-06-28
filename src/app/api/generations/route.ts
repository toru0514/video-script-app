import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import { SAMPLE_GENERATIONS } from "@/lib/sampleData";

// GET /api/generations?narrator_id=...&favorite=1   生成履歴
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const narratorId = url.searchParams.get("narrator_id");
    const favOnly = url.searchParams.get("favorite") === "1";

    const { role } = await getAuth();
    if (role !== "admin") {
      let s = SAMPLE_GENERATIONS;
      if (narratorId) s = s.filter((g) => g.narrator_id === narratorId);
      if (favOnly) s = s.filter((g) => g.is_favorite);
      return ok(s);
    }

    const sb = getSupabase();
    let query = sb
      .from(T.generations)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (narratorId) query = query.eq("narrator_id", narratorId);
    if (favOnly) query = query.eq("is_favorite", true);
    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// PATCH /api/generations  { id, is_favorite }
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    if (!b?.id) return fail("id は必須です");
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.generations)
      .update({ is_favorite: !!b.is_favorite })
      .eq("id", b.id)
      .select()
      .single();
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// DELETE /api/generations?id=...
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id は必須です");
    const sb = getSupabase();
    const { error } = await sb.from(T.generations).delete().eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
