import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
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
    const sb = getSupabase();

    if (id) {
      const { data: video, error } = await sb
        .from(T.videos)
        .select("*")
        .eq("id", id)
        .maybeSingle<Video>();
      if (error) return fail(error.message, 500);
      if (!video) return fail("動画が見つかりません", 404);

      let generation = null;
      if (video.generation_id) {
        const { data } = await sb
          .from(T.generations)
          .select("output_titles, output_script, output_story")
          .eq("id", video.generation_id)
          .maybeSingle();
        generation = data ?? null;
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
// { id, title?, narration_status?, video_status?, publish_status?, note? }
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    if (!b?.id) return fail("id は必須です");

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
      update.note = b.note === null ? null : String(b.note);
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.videos)
      .update(update)
      .eq("id", b.id)
      .select()
      .single();
    if (error) return fail(error.message, 500);
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
