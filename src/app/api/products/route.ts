import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import { SAMPLE_PRODUCTS } from "@/lib/sampleData";

// GET /api/products?all=1   有効な商品一覧（all=1で無効も含む）
export async function GET(req: Request) {
  try {
    const { role } = await getAuth();
    if (role !== "admin") return ok(SAMPLE_PRODUCTS);

    const includeAll = new URL(req.url).searchParams.get("all") === "1";
    const sb = getSupabase();
    let query = sb
      .from(T.products)
      .select("*")
      .order("sort_order", { ascending: true });
    if (!includeAll) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// POST /api/products  { name, description?, sort_order? }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.name?.trim()) return fail("name は必須です");
    const sb = getSupabase();
    let sortOrder = body.sort_order;
    if (sortOrder == null) {
      const { data: last } = await sb
        .from(T.products)
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      sortOrder = (last?.sort_order ?? 0) + 1;
    }
    const { data, error } = await sb
      .from(T.products)
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        sort_order: sortOrder,
      })
      .select()
      .single();
    if (error) return fail(error.message, 500);
    return ok(data, 201);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// PATCH /api/products  { id, name?, description?, sort_order?, is_active? }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return fail("id は必須です");
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.description !== undefined)
      patch.description = body.description?.trim() || null;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.products)
      .update(patch)
      .eq("id", body.id)
      .select()
      .single();
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// DELETE /api/products?id=...&hard=1  既定は無効化、hard=1で物理削除
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const hard = url.searchParams.get("hard") === "1";
    if (!id) return fail("id は必須です");
    const sb = getSupabase();
    if (hard) {
      const { error } = await sb.from(T.products).delete().eq("id", id);
      if (error) return fail(error.message, 500);
    } else {
      const { error } = await sb
        .from(T.products)
        .update({ is_active: false })
        .eq("id", id);
      if (error) return fail(error.message, 500);
    }
    return ok({ id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
