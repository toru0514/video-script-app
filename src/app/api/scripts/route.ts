import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import { SAMPLE_SCRIPTS } from "@/lib/sampleData";

// GET /api/scripts?narrator_id=...   お手本一覧（narrator_id で絞り込み可）
export async function GET(req: Request) {
  try {
    const narratorId = new URL(req.url).searchParams.get("narrator_id");

    const { role } = await getAuth();
    if (role !== "admin") {
      return ok(
        narratorId
          ? SAMPLE_SCRIPTS.filter((s) => s.narrator_id === narratorId)
          : SAMPLE_SCRIPTS,
      );
    }

    const sb = getSupabase();
    let query = sb
      .from(T.scripts)
      .select("*")
      .order("created_at", { ascending: false });
    if (narratorId) query = query.eq("narrator_id", narratorId);
    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// POST /api/scripts  { narrator_id, title, script, story, theme?, note? }
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b?.narrator_id) return fail("narrator_id は必須です");
    if (!b?.title?.trim() || !b?.script?.trim() || !b?.story?.trim())
      return fail("title / script / story は必須です");
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.scripts)
      .insert({
        narrator_id: b.narrator_id,
        title: b.title.trim(),
        script: b.script.trim(),
        story: b.story.trim(),
        theme: b.theme?.trim() || null,
        note: b.note?.trim() || null,
      })
      .select()
      .single();
    if (error) return fail(error.message, 500);
    return ok(data, 201);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// PATCH /api/scripts  { id, ...fields }
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    if (!b?.id) return fail("id は必須です");
    const patch: Record<string, unknown> = {};
    for (const k of ["title", "script", "story", "theme", "note", "narrator_id"]) {
      if (b[k] !== undefined) {
        const v = typeof b[k] === "string" ? b[k].trim() : b[k];
        patch[k] = v === "" ? null : v;
      }
    }
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.scripts)
      .update(patch)
      .eq("id", b.id)
      .select()
      .single();
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// DELETE /api/scripts?id=...
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id は必須です");
    const sb = getSupabase();
    const { error } = await sb.from(T.scripts).delete().eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
