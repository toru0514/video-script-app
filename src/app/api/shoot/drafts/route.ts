import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { getDraft, getDrafts } from "@/lib/shoot/data";

// GET /api/shoot/drafts         一覧（新しい順・商品/木材を同梱）
// GET /api/shoot/drafts?id=...  単一
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const draft = await getDraft(id);
      if (!draft) return fail("下書きが見つかりません。", 404);
      return ok(draft);
    }
    return ok(await getDrafts());
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// POST /api/shoot/drafts  生成結果を下書きとして保存
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const b = await req.json();
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.drafts)
      .insert({
        product_id: b.product_id || null,
        material_id: b.material_id || null,
        background_ids: Array.isArray(b.background_ids)
          ? b.background_ids
          : null,
        shoot_plan: b.shoot_plan ?? null,
        caption: b.caption ?? null,
        hashtags: Array.isArray(b.hashtags) ? b.hashtags : null,
        status: b.status === "posted" ? "posted" : "draft",
        theme: b.theme ?? null,
        goal: b.goal ?? null,
        format: b.format ?? null,
        hook: b.hook ?? null,
        cta: b.cta ?? null,
        carousel: b.carousel ?? null,
        reel: b.reel ?? null,
        plan_ref: b.plan_ref ?? null,
      })
      .select()
      .single();
    if (error) return fail(error.message, 500);
    return ok(data, 201);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// PATCH /api/shoot/drafts  { id, ...変更したい項目 }
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const b = await req.json();
    if (!b?.id) return fail("id は必須です");

    const patch: Record<string, unknown> = {};
    for (const key of [
      "caption",
      "hashtags",
      "hook",
      "cta",
      "status",
      "shoot_plan",
      "carousel",
      "reel",
    ] as const) {
      if (b[key] !== undefined) patch[key] = b[key];
    }
    if (Object.keys(patch).length === 0) return fail("変更する項目がありません");

    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.drafts)
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

// DELETE /api/shoot/drafts?id=...
export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id は必須です");
    const sb = getSupabase();
    const { error } = await sb.from(T.drafts).delete().eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
