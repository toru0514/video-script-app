// ============================================================
// 生成結果のブランドルール検査
// ------------------------------------------------------------
// プロンプトだけでは必ず漏れるため、最後の砦として機械的に検査する。
// 生成は止めず、画面に警告として出す。
// ============================================================

import {
  NG_RULES,
  HASHTAGS,
  SEARCH_KEYWORDS,
  METAL_TYPES,
  findPurpose,
  priceLine,
  type MetalType,
  type PostPurpose,
} from "./brand.ts";
import type { GenerateResult, Product } from "./types";

export type BrandWarning = {
  /** どこで見つかったか（台本 / Instagram用投稿文 など） */
  where: string;
  message: string;
};

/** 検索キーワードを語単位に分解（「木婚式 プレゼント」→ ["木婚式","プレゼント"]） */
const KEYWORD_TOKENS = Array.from(
  new Set(SEARCH_KEYWORDS.flatMap((k) => k.split(/\s+/)).filter(Boolean)),
);

export function checkBrand(args: {
  result: GenerateResult;
  product?: Product | null;
  purpose?: PostPurpose | null;
}): BrandWarning[] {
  const { result, product, purpose } = args;
  const warnings: BrandWarning[] = [];

  const targets: { where: string; text: string }[] = [
    { where: "タイトル", text: result.titles.join("\n") },
    { where: "台本", text: result.script },
    { where: "ストーリー", text: result.story },
    { where: "X用投稿文", text: result.sns.x },
    { where: "TikTok用投稿文", text: result.sns.tiktok },
    { where: "Instagram用投稿文", text: result.sns.instagram },
  ];

  // 1. 禁止表現（brand.ts の統合ルール表を使う）
  // 金属不使用と確定している商品では、金属表現のルールを免除する。
  const metalFree = product?.metal_type === "none";
  for (const t of targets) {
    if (!t.text) continue;
    for (const rule of NG_RULES) {
      if (metalFree && rule.exemptWhenMetalFree) continue;
      const m = t.text.match(rule.pattern);
      if (m) {
        warnings.push({
          where: t.where,
          message: `${rule.label}「${m[0]}」が含まれています → 「${rule.replacement}」に直してください`,
        });
      }
    }
  }

  // 2. 金属の言い方：商品の分類と矛盾していないか
  // "unknown" は商品固有の断定をさせないだけで、矛盾の検出対象にはしない。
  if (
    product?.metal_type &&
    product.metal_type !== "none" &&
    product.metal_type !== "unknown"
  ) {
    const label = METAL_TYPES[product.metal_type as MetalType]?.label ?? "";
    for (const t of targets) {
      if (!t.text) continue;
      if (/金属(を)?(一切)?(不使用|使っていません|使用していません)/.test(t.text)) {
        warnings.push({
          where: t.where,
          message: `「${product.name}」は${label}なのに「金属不使用」と書かれています`,
        });
      }
      if (product.metal_type === "metal" && /金属アレルギー対応/.test(t.text)) {
        warnings.push({
          where: t.where,
          message: `「${product.name}」は金属パーツを使うため「金属アレルギー対応」と書けません`,
        });
      }
    }
  }

  // 3. 価格：未登録商品なのに金額が書かれている
  const price = priceLine(product);
  const moneyRe = /[¥￥]\s?[\d,]+|[\d,]{3,}\s?円/;
  for (const t of targets) {
    if (!t.text) continue;
    const m = t.text.match(moneyRe);
    if (!m) continue;
    if (!price) {
      warnings.push({
        where: t.where,
        message: `価格未登録の商品なのに金額「${m[0]}」が書かれています（AIの創作の可能性）。設定で価格を登録するか、金額を削除してください`,
      });
    } else if (!t.text.includes(price)) {
      warnings.push({
        where: t.where,
        message: `金額「${m[0]}」が登録価格「${price}」と一致しません`,
      });
    }
  }

  const ig = result.sns.instagram ?? "";
  if (ig) {
    // 4. Instagramキャプション1行目に検索キーワードが入っているか
    const firstLine = ig.split("\n").find((l) => l.trim().length > 0) ?? "";
    if (!KEYWORD_TOKENS.some((k) => firstLine.includes(k))) {
      warnings.push({
        where: "Instagram用投稿文",
        message: "1行目に検索キーワードが含まれていません（検索面に載りません）",
      });
    }

    // 5. ブランドハッシュタグ
    if (!HASHTAGS.brand.some((h) => ig.includes(h))) {
      warnings.push({
        where: "Instagram用投稿文",
        message: `ブランドタグがありません（${HASHTAGS.brand.join(" / ")} のどちらかを必ず入れる）`,
      });
    }

    // 6. 公式CTAが使われているか
    const p = findPurpose(purpose);
    if (p && !p.ctas.some((c) => ig.includes(c))) {
      warnings.push({
        where: "Instagram用投稿文",
        message: `目的「${p.label}」の公式CTAが使われていません（改変せずそのまま入れる）`,
      });
    }
  }

  // 重複除去（同じ指摘が複数回出ることがある）
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = `${w.where}|${w.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
