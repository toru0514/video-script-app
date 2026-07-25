// ============================================================
// 撮影セクションの生成処理（サーバー専用）
// ------------------------------------------------------------
// lumiere から移植。ブランドルール違反を検出したら1度だけ書き直させる。
// 検査は brand.ts の findViolations（動画セクションの警告表示と同じルール表）。
// ============================================================

import { findViolations, violationInstruction } from "../brand.ts";
import { getClient, getModelName, toGeminiError } from "../gemini.ts";
import type { Product } from "../types.ts";
import { buildCaptionPrompt, buildPrompt } from "./prompts.ts";
import type { PlannedPost } from "./postPlan.ts";
import type {
  Background,
  CaptionResult,
  CarouselSlide,
  GenerateResult,
  Material,
  PostDesign,
  ReelScript,
} from "./types.ts";

// ------------------------------------------------------------
// パース
// ------------------------------------------------------------

/** JSON文字列（コードフェンス付きも可）を素のオブジェクトに戻す。 */
function parseJson(raw: string): Record<string, unknown> | null {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(s);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(raw);
  if (direct) return direct;

  // ```json ... ``` のようなフェンスを除去して再パース
  const stripped = raw
    .replace(/^[\s\S]*?```(?:json)?/i, "")
    .replace(/```[\s\S]*$/, "")
    .trim();
  const fenced = tryParse(stripped);
  if (fenced) return fenced;

  // 最初の { から最後の } までを抜き出して再パース
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return tryParse(raw.slice(start, end + 1));
  }
  return null;
}

function normalize(o: Record<string, unknown>): GenerateResult {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  let hashtags: string[] = [];
  if (Array.isArray(o.hashtags)) {
    hashtags = o.hashtags
      .map((h) => String(h).trim().replace(/^#+/, ""))
      .filter(Boolean);
  }

  let carousel: CarouselSlide[] | null = null;
  if (Array.isArray(o.carousel) && o.carousel.length > 0) {
    carousel = o.carousel
      .map((s) => {
        const slide = (s ?? {}) as Record<string, unknown>;
        return { visual: str(slide.visual), text: str(slide.text) };
      })
      .filter((s) => s.visual || s.text);
    if (carousel.length === 0) carousel = null;
  }

  let reel: ReelScript | null = null;
  if (o.reel && typeof o.reel === "object") {
    const r = o.reel as Record<string, unknown>;
    const cuts = Array.isArray(r.cuts)
      ? r.cuts.map((c) => String(c)).filter(Boolean)
      : [];
    const script = {
      hook: str(r.hook),
      cuts,
      overlay: str(r.overlay),
      audio: str(r.audio),
    };
    if (script.hook || cuts.length > 0) reel = script;
  }

  return {
    composition: str(o.composition),
    lighting: str(o.lighting),
    props_arrangement: str(o.props_arrangement),
    mood: str(o.mood),
    tips: str(o.tips),
    hook: str(o.hook),
    caption: str(o.caption),
    cta: str(o.cta),
    hashtags,
    carousel,
    reel,
  };
}

export function parseGenerateResult(raw: string): GenerateResult {
  const obj = parseJson(raw);
  if (!obj) throw new Error("Gemini の出力をJSONとして解釈できませんでした。");
  return normalize(obj);
}

export function parseCaptionResult(raw: string): CaptionResult {
  const obj = parseJson(raw);
  if (!obj) throw new Error("Gemini の出力をJSONとして解釈できませんでした。");
  const result = normalize(obj);
  return {
    photo_summary:
      typeof obj.photo_summary === "string" ? obj.photo_summary : "",
    hook: result.hook,
    caption: result.caption,
    cta: result.cta,
    hashtags: result.hashtags,
  };
}

// ------------------------------------------------------------
// 呼び出し
// ------------------------------------------------------------

type Contents = Parameters<
  ReturnType<typeof getClient>["models"]["generateContent"]
>[0]["contents"];

async function callGemini(contents: Contents): Promise<string> {
  try {
    const res = await getClient().models.generateContent({
      model: getModelName(),
      contents,
      config: { responseMimeType: "application/json", temperature: 0.9 },
    });
    const text = res.text ?? "";
    if (!text) throw new Error("Gemini から空のレスポンスが返りました。");
    return text;
  } catch (e) {
    throw toGeminiError(e);
  }
}

/** 違反箇所を指摘して書き直させる指示文。 */
function retryPrompt(previous: string, instruction: string): string {
  return `直前の出力に、ブランドの表現ルール違反があります。

# 直前の出力
${previous}

# 修正が必要な箇所
${instruction}

指摘箇所だけを修正し、他の内容とJSON構造は維持したまま、同じJSON形式で全体を再出力してください。前置き・説明・コードフェンスは付けないこと。`;
}

/** 表現ルール検査の対象になるテキストをすべて連結する。 */
function inspectableText(r: GenerateResult): string {
  return [
    r.hook,
    r.caption,
    r.cta,
    ...(r.carousel ?? []).flatMap((s) => [s.visual, s.text]),
    r.reel?.hook ?? "",
    ...(r.reel?.cuts ?? []),
    r.reel?.overlay ?? "",
  ].join("\n");
}

export async function generatePlan(
  product: Product,
  material: Material | null,
  backgrounds: Background[],
  design: PostDesign,
  planned?: PlannedPost | null,
): Promise<GenerateResult & { warnings: string[] }> {
  const prompt = buildPrompt(product, material, backgrounds, design, planned);

  let raw = await callGemini(prompt);
  let result = parseGenerateResult(raw);

  // 表現ルール違反はプロンプトだけでは防ぎきれないため、検出したら1度だけ書き直させる。
  const metalFree = product.metal_type === "none";
  let violations = findViolations(inspectableText(result), metalFree);
  if (violations.length > 0) {
    raw = await callGemini(retryPrompt(raw, violationInstruction(violations)));
    result = parseGenerateResult(raw);
    violations = findViolations(inspectableText(result), metalFree);
  }

  return {
    ...result,
    warnings: violations.map((v) => `「${v.matched}」${v.reason}`),
  };
}

// ------------------------------------------------------------
// 写真から投稿文を生成（画像入力）
// ------------------------------------------------------------

/** Gemini に渡す画像（base64）。 */
export interface CaptionImageInput {
  mimeType: string;
  data: string;
}

export async function generateCaptionFromImages(
  images: CaptionImageInput[],
  design: PostDesign,
  note?: string,
): Promise<CaptionResult & { warnings: string[] }> {
  if (images.length === 0) throw new Error("写真が添付されていません。");

  const parts = images.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.data },
  }));

  let raw = await callGemini([
    { text: buildCaptionPrompt(design, note) },
    ...parts,
  ]);
  let result = parseCaptionResult(raw);

  // 写真からの生成でも表現ルールは同じ。違反したら1度だけ書き直させる。
  // 商品が特定されないため金属ルールの免除はしない。
  const inspect = (r: CaptionResult) => [r.hook, r.caption, r.cta].join("\n");
  let violations = findViolations(inspect(result));
  if (violations.length > 0) {
    raw = await callGemini([
      { text: retryPrompt(raw, violationInstruction(violations)) },
      ...parts,
    ]);
    result = parseCaptionResult(raw);
    violations = findViolations(inspect(result));
  }

  return {
    ...result,
    warnings: violations.map((v) => `「${v.matched}」${v.reason}`),
  };
}
