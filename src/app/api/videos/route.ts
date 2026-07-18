import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import { SAMPLE_VIDEOS, sampleVideoDetail } from "@/lib/sampleData";
import type { Video } from "@/lib/types";
import {
  NARRATION_VALUES,
  VIDEO_VALUES,
  PUBLISH_VALUES,
} from "@/lib/videoStatus";

// GET /api/videos        一覧（新しい順）
// GET /api/videos?id=...  単一（生成元の台本/ストーリー/タイトル候補を同梱）
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");

    // ゲスト（管理者以外）にはサンプルデータのみ返す
    const { role } = await getAuth();
    if (role !== "admin") {
      return ok(id ? sampleVideoDetail(id) : SAMPLE_VIDEOS);
    }

    const sb = getSupabase();

    if (id) {
      const { data: video, error } = await sb
        .from(T.videos)
        .select("*")
        .eq("id", id)
        .maybeSingle<Video>();
      if (error) return fail(error.message, 500);
      if (!video) return fail("動画が見つかりません", 404);

      // 生成元(generation)があればそれを、無ければお手本(script)を
      // 同じ {output_titles, output_script, output_story} 形に揃えて返す。
      let generation = null;
      if (video.generation_id) {
        const { data } = await sb
          .from(T.generations)
          .select(
            "output_titles, output_script, output_story, output_post_x, output_post_tiktok, output_post_instagram",
          )
          .eq("id", video.generation_id)
          .maybeSingle();
        generation = data ?? null;
      } else if (video.script_id) {
        const { data: script } = await sb
          .from(T.scripts)
          .select("title, script, story")
          .eq("id", video.script_id)
          .maybeSingle<{ title: string; script: string; story: string }>();
        if (script) {
          // お手本(vsg_scripts)由来の動画にはSNS投稿文は無いため null で揃える
          generation = {
            output_titles: script.title,
            output_script: script.script,
            output_story: script.story,
            output_post_x: null,
            output_post_tiktok: null,
            output_post_instagram: null,
          };
        }
      }
      return ok({ ...video, generation });
    }

    const { data, error } = await sb
      .from(T.videos)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// PATCH /api/videos
// { id, title?, narration_status?, video_status?, publish_status?, note?,
//   output_script?, output_story? }
// output_script / output_story は生成元(generation もしくは お手本 script)へ
// 書き戻す。
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    if (!b?.id) return fail("id は必須です");

    const sb = getSupabase();

    // 台本／ストーリーの編集は生成元テーブルへ書き戻す
    const editScript = b.output_script !== undefined;
    const editStory = b.output_story !== undefined;
    if (editScript || editStory) {
      if (editScript && typeof b.output_script !== "string")
        return fail("output_script が不正です");
      if (editStory && typeof b.output_story !== "string")
        return fail("output_story が不正です");

      const { data: v, error: vErr } = await sb
        .from(T.videos)
        .select("generation_id, script_id")
        .eq("id", b.id)
        .maybeSingle<{ generation_id: string | null; script_id: string | null }>();
      if (vErr) return fail(vErr.message, 500);
      if (!v) return fail("動画が見つかりません", 404);

      if (v.generation_id) {
        const gUpd: Record<string, unknown> = {};
        if (editScript) gUpd.output_script = b.output_script;
        if (editStory) gUpd.output_story = b.output_story;
        const { error } = await sb
          .from(T.generations)
          .update(gUpd)
          .eq("id", v.generation_id);
        if (error) return fail(error.message, 500);
      } else if (v.script_id) {
        const sUpd: Record<string, unknown> = {};
        if (editScript) sUpd.script = b.output_script;
        if (editStory) sUpd.story = b.output_story;
        const { error } = await sb
          .from(T.scripts)
          .update(sUpd)
          .eq("id", v.script_id);
        if (error) return fail(error.message, 500);
      } else {
        return fail("編集できる生成元がありません", 400);
      }
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (b.title !== undefined) {
      if (typeof b.title !== "string" || !b.title.trim())
        return fail("title は空にできません");
      update.title = b.title.trim();
    }
    if (b.narration_status !== undefined) {
      if (!NARRATION_VALUES.includes(b.narration_status))
        return fail("narration_status が不正です");
      update.narration_status = b.narration_status;
    }
    if (b.video_status !== undefined) {
      if (!VIDEO_VALUES.includes(b.video_status))
        return fail("video_status が不正です");
      update.video_status = b.video_status;
    }
    if (b.publish_status !== undefined) {
      if (!PUBLISH_VALUES.includes(b.publish_status))
        return fail("publish_status が不正です");
      update.publish_status = b.publish_status;
    }
    if (b.note !== undefined) {
      if (b.note !== null && typeof b.note !== "string")
        return fail("note が不正です");
      update.note = b.note;
    }

    const { data, error } = await sb
      .from(T.videos)
      .update(update)
      .eq("id", b.id)
      .select()
      .maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data) return fail("動画が見つかりません", 404);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// DELETE /api/videos?id=...
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id は必須です");
    const sb = getSupabase();
    const { error } = await sb.from(T.videos).delete().eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
