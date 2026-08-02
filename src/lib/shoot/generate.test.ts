import { test } from "node:test";
import assert from "node:assert";
import { hookProblem, missingFields, parseGenerateResult } from "./generate.ts";
import type { GenerateResult } from "./types.ts";

function result(over: Partial<GenerateResult> = {}): GenerateResult {
  return {
    composition: "中央に配置",
    lighting: "斜め上から",
    props_arrangement: "布の上",
    mood: "落ち着いた",
    tips: "反射に注意",
    hook: "木の指輪をお探しの方へ",
    caption: "木の指輪をお探しの方へ\n\n本文\n\nCTA",
    cta: "価格と在庫は、プロフィールのリンク（Creema）からご確認いただけます。",
    hashtags: ["cloud9woodwork", "木の指輪"],
    carousel: null,
    reel: null,
    ...over,
  };
}

test("揃っていれば欠けなし", () => {
  assert.deepEqual(missingFields(result(), "feed"), []);
});

test("撮影プランだけ返ってきたら欠けを検出する", () => {
  // 実際に起きた壊れ方: composition 等はあるが投稿文が空
  const broken = result({ hook: "", caption: "", cta: "", hashtags: [] });
  const missing = missingFields(broken, "feed");
  assert.ok(missing.includes("caption"));
  assert.ok(missing.includes("hook"));
  assert.ok(missing.includes("hashtags"));
});

test("カルーセルなのに carousel が空なら欠けとする", () => {
  assert.deepEqual(missingFields(result(), "carousel"), ["carousel"]);
  const ok = result({ carousel: [{ visual: "表紙", text: "木の指輪" }] });
  assert.deepEqual(missingFields(ok, "carousel"), []);
});

test("リールなのに reel が無ければ欠けとする", () => {
  assert.deepEqual(missingFields(result(), "reel"), ["reel"]);
  const ok = result({
    reel: { hook: "フック", cuts: ["カット1"], overlay: "文字", audio: "作業音" },
  });
  assert.deepEqual(missingFields(ok, "reel"), []);
});

test("空白だけの本文は欠けとみなす", () => {
  assert.ok(missingFields(result({ caption: "   \n " }), "feed").includes("caption"));
});

test("撮影プランが空でも欠けとする", () => {
  assert.ok(missingFields(result({ composition: "" }), "feed").includes("composition"));
});

// ---- 1行目に購入導線を書かせない ----

test("1行目の購入導線を検出する", () => {
  // 実際に生成された、CTAと重複していた1行目
  for (const hook of [
    "木製のネクタイピン。価格と在庫はプロフィールのリンクへ。",
    "木のイヤーカフは軽くて痛くない着け心地。価格と在庫はここで分かります。",
    "木のバングルは、サイズと在庫をCreemaで確認できます。",
    "ピンクアイボリーの木の指輪。価格と在庫はここで分かります。",
  ]) {
    assert.ok(hookProblem(hook), `検出できていない: ${hook}`);
  }
});

test("良い1行目は問題なしとする", () => {
  for (const hook of [
    "木の指輪をお探しの方へ。金属アレルギー対応のハンドメイド品です。",
    "金属アレルギーで、イヤリング選びを諦めていませんか？",
    "大人の装いを引き立てる、エボニーの木のネクタイピン。",
    "木の指輪 ハンドメイド。メープルのクリスタルウッドリングは¥8,000〜（税込）でご案内しています。",
  ]) {
    assert.equal(hookProblem(hook), null, `誤検出: ${hook}`);
  }
});

test("実際に返ってきた欠損JSONをパースすると空になる", () => {
  // 投稿文のキーごと落ちた応答（本番で発生した形）
  const raw = JSON.stringify({
    composition: "中央に配置",
    lighting: "斜め上から",
    props_arrangement: "布の上",
    mood: "落ち着いた",
    tips: "反射に注意",
  });
  const parsed = parseGenerateResult(raw);
  assert.equal(parsed.caption, "");
  assert.ok(missingFields(parsed, "feed").length > 0);
});
