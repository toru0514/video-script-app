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
