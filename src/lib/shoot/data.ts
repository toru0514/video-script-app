// ============================================================
// 撮影セクションのデータ層（サーバー専用）
// ------------------------------------------------------------
// lumiere から移植。Supabase クライアントは動画セクションと同じ
// service role クライアント（@/lib/supabase）に寄せている。
// 商品は vsg_products（T.products）を参照する。
// ============================================================

import { getSupabase, T } from "../supabase.ts";
import type { Product } from "../types.ts";
import type { Background, Draft, Material } from "./types.ts";

export interface DraftWithProduct extends Draft {
  product: Product | null;
  material: Material | null;
}

export async function getMaterials(): Promise<Material[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from(T.materials)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Material[];
}

export async function getBackgrounds(): Promise<Background[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from(T.backgrounds)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Background[];
}

/** 下書き詳細で背景素材名を表示するための取得。渡した順序を保つ。 */
export async function getBackgroundsByIds(ids: string[]): Promise<Background[]> {
  if (ids.length === 0) return [];
  const sb = getSupabase();
  const { data } = await sb.from(T.backgrounds).select("*").in("id", ids);
  const map = new Map((data ?? []).map((b) => [b.id, b as Background]));
  return ids.map((id) => map.get(id)).filter(Boolean) as Background[];
}

export async function getDrafts(): Promise<DraftWithProduct[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from(T.drafts)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const drafts = (data ?? []) as Draft[];

  const productIds = [
    ...new Set(drafts.map((d) => d.product_id).filter(Boolean)),
  ] as string[];
  const productMap = new Map<string, Product>();
  if (productIds.length > 0) {
    const { data: products } = await sb
      .from(T.products)
      .select("*")
      .in("id", productIds);
    for (const p of (products ?? []) as Product[]) productMap.set(p.id, p);
  }

  const materialIds = [
    ...new Set(drafts.map((d) => d.material_id).filter(Boolean)),
  ] as string[];
  const materialMap = new Map<string, Material>();
  if (materialIds.length > 0) {
    const { data: materials } = await sb
      .from(T.materials)
      .select("*")
      .in("id", materialIds);
    for (const m of (materials ?? []) as Material[]) materialMap.set(m.id, m);
  }

  return drafts.map((d) => ({
    ...d,
    product: d.product_id ? (productMap.get(d.product_id) ?? null) : null,
    material: d.material_id ? (materialMap.get(d.material_id) ?? null) : null,
  }));
}

export async function getDraft(id: string): Promise<DraftWithProduct | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from(T.drafts)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const draft = data as Draft;

  let product: Product | null = null;
  if (draft.product_id) {
    const { data: p } = await sb
      .from(T.products)
      .select("*")
      .eq("id", draft.product_id)
      .maybeSingle();
    product = (p as Product) ?? null;
  }

  let material: Material | null = null;
  if (draft.material_id) {
    const { data: m } = await sb
      .from(T.materials)
      .select("*")
      .eq("id", draft.material_id)
      .maybeSingle();
    material = (m as Material) ?? null;
  }
  return { ...draft, product, material };
}

/** 商品は動画セクションと共有。撮影プランでは有効な商品だけ使う。 */
export async function getActiveProducts(): Promise<Product[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from(T.products)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}
