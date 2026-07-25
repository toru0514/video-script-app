import type { CarouselSlide, ReelScript } from "./types.ts";

/** ハッシュタグ配列を編集用テキスト（# 付き・スペース区切り）に変換。 */
export function hashtagsToText(hashtags: string[]): string {
  return hashtags.map((h) => `#${h.replace(/^#+/, "")}`).join(" ");
}

/** 編集テキストからハッシュタグ配列へ。# や区切り（空白・改行・カンマ・読点）を吸収。 */
export function textToHashtags(text: string): string[] {
  return text
    .split(/[\s,、　]+/)
    .map((t) => t.trim().replace(/^#+/, ""))
    .filter(Boolean);
}

/** キャプション＋ハッシュタグを結合してコピー用文字列にする。 */
export function buildCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags.map((h) => `#${h.replace(/^#+/, "")}`).join(" ");
  return tags ? `${caption.trim()}\n\n${tags}` : caption.trim();
}

/** カルーセル構成を、そのまま作図に持っていけるテキストにする。 */
export function buildCarouselText(slides: CarouselSlide[]): string {
  return slides
    .map((s, i) => `${i + 1}枚目\n  文字：${s.text}\n  ビジュアル：${s.visual}`)
    .join("\n\n");
}

/** リール台本をコピー用テキストにする。 */
export function buildReelText(reel: ReelScript): string {
  const cuts = reel.cuts.map((c, i) => `  ${i + 1}. ${c}`).join("\n");
  return [
    `【0-3秒フック】${reel.hook}`,
    `【カット】\n${cuts}`,
    `【テキスト】${reel.overlay}`,
    `【音・尺】${reel.audio}`,
  ].join("\n\n");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
