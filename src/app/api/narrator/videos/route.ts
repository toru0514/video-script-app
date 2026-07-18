import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { getAuth, type Auth } from "@/lib/auth";
import type { NarratorTask, Video } from "@/lib/types";

// 対象ナレーターを決定する。
// ナレーターは Cookie で本人に固定（URLパラメータは無視＝他人を見られない）。
// 管理者はプレビュー用に ?narrator_id= を指定できる。
async function resolveTarget(
  auth: Auth,
  paramId: string | null,
): Promise<
  | { ok: true; id: string; name: string | null }
  | { ok: false; status: number; message: string }
> {
  if (auth.role === "narrator") {
    return { ok: true, id: auth.narrator.id, name: auth.narrator.name };
  }
  if (auth.role === "admin") {
    if (!paramId) return { ok: false, status: 400, message: "narrator_id を指定してください" };
    const sb = getSupabase();
    const { data } = await sb
      .from(T.narrators)
      .select("name")
      .eq("id", paramId)
      .maybeSingle<{ name: string }>();
    return { ok: true, id: paramId, name: data?.name ?? null };
  }
  return { ok: false, status: 401, message: "認証が必要です" };
}

// GET /api/narrator/videos
// ログイン中ナレーターの未収録動画を、台本/ストーリー付きで返す。
// 管理者は全ナレーターの未収録を横断で閲覧できる（?narrator_id= で個別に絞り込みも可）。
// 返却: { role, narrator: {id,name}|null, tasks: NarratorTask[] }
export async function GET(req: Request) {
  try {
    const paramId = new URL(req.url).searchParams.get("narrator_id");
    const auth = await getAuth();

    const sb = getSupabase();

    // 対象の未収録動画を取得。管理者かつ narrator_id 未指定なら全ナレーター横断。
    let narrator: { id: string; name: string } | null;
    let query = sb
      .from(T.videos)
      .select("*")
      .neq("narration_status", "done")
      .order("created_at", { ascending: false });

    if (auth.role === "admin" && !paramId) {
      narrator = null; // 全ナレーター横断
    } else {
      const target = await resolveTarget(auth, paramId);
      if (!target.ok) return fail(target.message, target.status);
      query = query.eq("narrator_id", target.id);
      narrator = { id: target.id, name: target.name ?? "" };
    }

    const { data: videos, error } = await query.returns<Video[]>();
    if (error) return fail(error.message, 500);

    const role = auth.role;
    const list = videos ?? [];
    if (list.length === 0) return ok({ role, narrator, tasks: [] });

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

    const tasks: NarratorTask[] = list.map((v) => {
      const content =
        (v.generation_id ? genMap.get(v.generation_id) : null) ??
        (v.script_id ? scriptMap.get(v.script_id) : null) ??
        null;
      return {
        id: v.id,
        title: v.title,
        narration_status: v.narration_status,
        created_at: v.created_at,
        output_titles: content?.output_titles ?? null,
        output_script: content?.output_script ?? null,
        output_story: content?.output_story ?? null,
      };
    });

    return ok({ role, narrator, tasks });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// PATCH /api/narrator/videos  { id }
// 「収録完了」にする。ナレーターは本人の動画のみ、管理者は任意の動画を対象にできる。
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id) return fail("id は必須です");

    const auth = await getAuth();

    const sb = getSupabase();
    let update = sb
      .from(T.videos)
      .update({
        narration_status: "done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id);

    // ナレーターは本人の動画に限定（他人の動画を触れない）
    if (auth.role !== "admin") {
      const target = await resolveTarget(auth, body?.narrator_id ?? null);
      if (!target.ok) return fail(target.message, target.status);
      update = update.eq("narrator_id", target.id);
    }

    const { data, error } = await update.select().maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data) return fail("対象の動画が見つかりません", 404);
    return ok({ id: body.id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
