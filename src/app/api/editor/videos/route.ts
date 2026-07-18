import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import type { EditorTask, Video } from "@/lib/types";

// GET /api/editor/videos
// 動画生成が「依頼中」（video_status = rendering）の動画を、台本/ストーリー付きで返す。
// 動画編集者(editor) 本人と管理者(admin) のみ閲覧できる。
// 返却: { tasks: EditorTask[] }
export async function GET() {
  try {
    const { role } = await getAuth();
    if (role !== "admin" && role !== "editor") {
      return fail("認証が必要です", 401);
    }

    const sb = getSupabase();
    const { data: videos, error } = await sb
      .from(T.videos)
      .select("*")
      .eq("video_status", "rendering")
      .order("created_at", { ascending: false })
      .returns<Video[]>();
    if (error) return fail(error.message, 500);

    const list = videos ?? [];
    if (list.length === 0) return ok({ tasks: [] });

    // 台本/ストーリーは generation 由来か script(お手本) 由来。N+1 を避けてまとめて取得。
    const genIds = [
      ...new Set(list.map((v) => v.generation_id).filter(Boolean)),
    ] as string[];
    const scriptIds = [
      ...new Set(list.map((v) => v.script_id).filter(Boolean)),
    ] as string[];

    type Content = {
      output_titles: string | null;
      output_script: string | null;
      output_story: string | null;
    };

    const genMap = new Map<string, Content>();
    if (genIds.length > 0) {
      const { data } = await sb
        .from(T.generations)
        .select("id, output_titles, output_script, output_story")
        .in("id", genIds);
      for (const g of data ?? []) {
        genMap.set(g.id, {
          output_titles: g.output_titles,
          output_script: g.output_script,
          output_story: g.output_story,
        });
      }
    }

    const scriptMap = new Map<string, Content>();
    if (scriptIds.length > 0) {
      const { data } = await sb
        .from(T.scripts)
        .select("id, title, script, story")
        .in("id", scriptIds);
      for (const s of data ?? []) {
        scriptMap.set(s.id, {
          output_titles: s.title,
          output_script: s.script,
          output_story: s.story,
        });
      }
    }

    const tasks: EditorTask[] = list.map((v) => {
      const content =
        (v.generation_id ? genMap.get(v.generation_id) : null) ??
        (v.script_id ? scriptMap.get(v.script_id) : null) ??
        null;
      return {
        id: v.id,
        title: v.title,
        video_status: v.video_status,
        created_at: v.created_at,
        output_titles: content?.output_titles ?? null,
        output_script: content?.output_script ?? null,
        output_story: content?.output_story ?? null,
        storage_url: v.storage_url,
      };
    });

    return ok({ tasks });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// PATCH /api/editor/videos
// { id, storage_url? } : storage_url を指定すると保存先を更新する。
// { id }               : 動画生成ステータスを「完了」にする。
// いずれも管理者のみ。
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return fail("id は必須です");

    const { role } = await getAuth();
    if (role !== "admin" && role !== "editor")
      return fail("認証が必要です", 401);

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.storage_url !== undefined) {
      // 保存先の更新（Google Drive リンク等）
      if (body.storage_url !== null && typeof body.storage_url !== "string")
        return fail("storage_url が不正です");
      const trimmed =
        typeof body.storage_url === "string" ? body.storage_url.trim() : "";
      update.storage_url = trimmed || null;
    } else {
      // 保存先の指定がなければ「編集完了」として扱う
      update.video_status = "done";
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.videos)
      .update(update)
      .eq("id", body.id)
      .select()
      .maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data) return fail("対象の動画が見つかりません", 404);
    return ok({ id: body.id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
