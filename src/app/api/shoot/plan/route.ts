import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { GeminiError } from "@/lib/gemini";
import { generatePlan } from "@/lib/shoot/generate";
import { findPlannedPost } from "@/lib/shoot/postPlan";
import { parseDesign } from "@/lib/shoot/types";
import type { Background, Material } from "@/lib/shoot/types";
import type { Product } from "@/lib/types";

export const maxDuration = 60;

// POST /api/shoot/plan  { productId, materialId?, backgroundIds?, theme?, goal?, format?, planRef?, note? }
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const productId: string | undefined = body?.productId;
    const materialId: string | undefined = body?.materialId || undefined;
    const backgroundIds: string[] = Array.isArray(body?.backgroundIds)
      ? body.backgroundIds
      : [];
    const design = parseDesign(body ?? {});
    const planned = findPlannedPost(
      typeof body?.planRef === "string" ? body.planRef : null,
    );
    const note = typeof body?.note === "string" ? body.note : undefined;

    if (!productId) return fail("商品が選択されていません。");

    const sb = getSupabase();

    const { data: product, error: pErr } = await sb
      .from(T.products)
      .select("*")
      .eq("id", productId)
      .single<Product>();
    if (pErr || !product) return fail("商品が見つかりません。", 404);

    let material: Material | null = null;
    if (materialId) {
      const { data: m } = await sb
        .from(T.materials)
        .select("*")
        .eq("id", materialId)
        .maybeSingle();
      material = (m as Material) ?? null;
    }

    let backgrounds: Background[] = [];
    if (backgroundIds.length > 0) {
      const { data: bgs } = await sb
        .from(T.backgrounds)
        .select("*")
        .in("id", backgroundIds);
      // 選択順を維持する
      const map = new Map((bgs ?? []).map((b) => [b.id, b as Background]));
      backgrounds = backgroundIds
        .map((id) => map.get(id))
        .filter(Boolean) as Background[];
    }

    const result = await generatePlan(
      product,
      material,
      backgrounds,
      design,
      planned,
      note,
    );
    return ok({ ...result, ...design });
  } catch (e) {
    if (e instanceof GeminiError) return fail(e.message, e.status);
    return fail((e as Error).message || "生成に失敗しました。", 500);
  }
}
