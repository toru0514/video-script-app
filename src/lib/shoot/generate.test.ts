import { test } from "node:test";
import assert from "node:assert";
import { missingFields, parseGenerateResult } from "./generate.ts";
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
