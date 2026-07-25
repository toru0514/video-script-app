import { ok, fail } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { GeminiError } from "@/lib/gemini";
import {
  generateCaptionFromImages,
  type CaptionImageInput,
} from "@/lib/shoot/generate";
import { parseDesign } from "@/lib/shoot/types";

export const maxDuration = 60;

/** 受け付ける画像枚数の上限（Instagram のカルーセルを想定しつつ負荷を抑える）。 */
const MAX_IMAGES = 6;
/** 1枚あたりの base64 サイズ上限（およそ 6MB 相当）。クライアントで圧縮済み前提。 */
const MAX_BASE64_LENGTH = 8_000_000;

// POST /api/shoot/caption  { images: [{ mimeType, data }], note?, theme?, goal? }
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const rawImages = Array.isArray(body?.images) ? body.images : [];
    const note: string | undefined =
      typeof body?.note === "string" ? body.note : undefined;
    // 写真からの生成は単写真フィード固定。テーマ・目的だけ受け取る。
    const design = { ...parseDesign(body ?? {}), format: "feed" as const };

    if (rawImages.length === 0) return fail("写真を1枚以上添付してください。");
    if (rawImages.length > MAX_IMAGES)
      return fail(`写真は最大${MAX_IMAGES}枚までです。`);

    const images: CaptionImageInput[] = [];
    for (const img of rawImages) {
      const mimeType = typeof img?.mimeType === "string" ? img.mimeType : "";
      const data = typeof img?.data === "string" ? img.data : "";
      if (!mimeType.startsWith("image/") || !data) {
        return fail("画像データが不正です。");
      }
      if (data.length > MAX_BASE64_LENGTH) {
        return fail("画像サイズが大きすぎます。もう一度お試しください。", 413);
      }
      images.push({ mimeType, data });
    }

    const result = await generateCaptionFromImages(images, design, note);
    return ok({ ...result, theme: design.theme, goal: design.goal });
  } catch (e) {
    if (e instanceof GeminiError) return fail(e.message, e.status);
    return fail((e as Error).message || "生成に失敗しました。", 500);
  }
}
