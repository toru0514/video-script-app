import { test } from "node:test";
import assert from "node:assert";
import { NG_RULES } from "./brand.ts";

/** テキストに違反があれば、そのラベルを返す。 */
function labelsFor(text: string): string[] {
  return NG_RULES.filter((r) => r.pattern.test(text)).map((r) => r.label);
}

test("既存ルール: 一点もの系を検出する", () => {
  assert.ok(labelsFor("世界にひとつだけの指輪です").length > 0);
  assert.ok(labelsFor("一点ものの木の指輪").length > 0);
});

test("既存ルール: #cloud9 単体を検出する", () => {
  assert.ok(labelsFor("#cloud9 #木の指輪").length > 0);
  assert.equal(labelsFor("#cloud9woodwork").length, 0);
});

test("既存ルール: URL・パス表記を検出する", () => {
  assert.ok(labelsFor("https://example.com からどうぞ").length > 0);
  assert.ok(labelsFor("creema.jp で販売中").length > 0);
});

test("既存ルール: 宝石表記を検出する", () => {
  assert.ok(labelsFor("天然石をあしらった指輪").length > 0);
});

test("既存ルール: 誇張・セール文句を検出する", () => {
  assert.ok(labelsFor("今だけ大人気の商品です").length > 0);
});

test("正常な文はどのルールにも当たらない", () => {
  const ok =
    "木婚式の贈り物に、カリンの指輪はいかがでしょう。天然木のため、木目や色合いは一つずつ異なります。";
  assert.deepEqual(labelsFor(ok), []);
});

// ---- lumiere から採用する新ルール ----

test("新ルール: 送料への言及を検出する", () => {
  assert.ok(labelsFor("全国送料無料でお届けします").length > 0);
  assert.ok(labelsFor("送料は当店が負担します").length > 0);
});

test("新ルール: minne への言及を検出する", () => {
  assert.ok(labelsFor("minne でも販売しています").length > 0);
  assert.ok(labelsFor("ミンネからもどうぞ").length > 0);
});

test("新ルール: 地域名を検出する", () => {
  assert.ok(labelsFor("愛知の小さな工房から").length > 0);
  assert.ok(labelsFor("名古屋で作っています").length > 0);
});

test("新ルール: 情緒過多・広告調を検出する", () => {
  assert.ok(labelsFor("静かに佇む木の指輪").length > 0);
  assert.ok(labelsFor("上質なひとときをあなたに").length > 0);
  assert.ok(labelsFor("木の指輪はいかがですか").length > 0);
});

test("新ルール: 安さ訴求を検出する", () => {
  assert.ok(labelsFor("お手頃な価格で").length > 0);
  assert.ok(labelsFor("リーズナブルにお求めいただけます").length > 0);
});

test("新ルール: ブランド名の誤表記を検出する", () => {
  assert.ok(labelsFor("Cloud9 の木の指輪").length > 0);
  assert.ok(labelsFor("クラウドナインです").length > 0);
  assert.equal(labelsFor("木材工房cloud9 です").length, 0);
});

test("新ルール: 発送・修理の断定を検出する", () => {
  assert.ok(labelsFor("即日発送します").length > 0);
  assert.ok(labelsFor("サイズ直しも承ります").length > 0);
});
