// ============================================================
// 撮影セクションのマスタ（背景素材・木材）用の CRUD ハンドラ生成
// ------------------------------------------------------------
// 2つのマスタは name + 任意テキスト数個という同じ形なので、
// route ごとに同じコードを書かず、扱うテーブルと項目だけを渡す。
// ============================================================

import { getSupabase } from "../supabase.ts";
import { ok, fail } from "../http.ts";
import { requireAdmin } from "../auth.ts";

/** 空文字は null に落とす（DBに空文字を入れない）。 */
function parseText(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function createMasterRoute(config: {
  /** 対象テーブル（T.backgrounds など） */
  table: string;
  /** name 以外に受け付ける任意テキスト項目 */
  optionalFields: readonly string[];
  /** エラー文言に使う日本語名 */
  label: string;
}) {
  const { table, optionalFields, label } = config;

  async function GET() {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
      const { data, error } = await getSupabase()
        .from(table)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return fail(error.message, 500);
      return ok(data ?? []);
    } catch (e) {
      return fail((e as Error).message, 500);
    }
  }

  async function POST(req: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
      const b = await req.json();
      const name = parseText(b?.name);
      if (!name) return fail(`${label}の名前は必須です`);

      const row: Record<string, unknown> = { name };
      for (const f of optionalFields) row[f] = parseText(b?.[f]);

      const { data, error } = await getSupabase()
        .from(table)
        .insert(row)
        .select()
        .single();
      if (error) return fail(error.message, 500);
      return ok(data, 201);
    } catch (e) {
      return fail((e as Error).message, 500);
    }
  }

  async function PATCH(req: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
      const b = await req.json();
      if (!b?.id) return fail("id は必須です");

      const patch: Record<string, unknown> = {};
      if (b.name !== undefined) {
        const name = parseText(b.name);
        if (!name) return fail(`${label}の名前は必須です`);
        patch.name = name;
      }
      for (const f of optionalFields) {
        if (b[f] !== undefined) patch[f] = parseText(b[f]);
      }
      if (Object.keys(patch).length === 0)
        return fail("変更する項目がありません");

      const { data, error } = await getSupabase()
        .from(table)
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

  async function DELETE(req: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return fail("id は必須です");
      const { error } = await getSupabase().from(table).delete().eq("id", id);
      if (error) return fail(error.message, 500);
      return ok({ id });
    } catch (e) {
      return fail((e as Error).message, 500);
    }
  }

  return { GET, POST, PATCH, DELETE };
}
