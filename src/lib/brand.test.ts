import { test } from "node:test";
import assert from "node:assert";
import {
  BRAND,
  FACTS,
  NG_RULES,
  PRICE_GUIDE,
  buildBrandBlock,
  findViolations,
  violationInstruction,
} from "./brand.ts";

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

// ---- プロンプトがルールと矛盾していないこと ----

test("FACTS に送料の記述が残っていない", () => {
  assert.equal(
    FACTS.some((f) => /送料/.test(f)),
    false,
  );
});

test("プロンプトに販路名を許す記述が残っていない", () => {
  const block = buildBrandBlock({ product: null, purpose: "profile" });
  // 禁止リストに「minne への言及」が並ぶのは正しい（LLMに禁止を伝えるため）。
  // 消したいのは「触れても構わない」という許可の記述の方。
  assert.equal(/触れても構わない|併売しているため/.test(block), false);
  assert.match(block, /販路名を書かない/);
});

test("プロンプトに蜜蝋仕上げの記述がある", () => {
  const block = buildBrandBlock({ product: null, purpose: "save" });
  assert.match(block, /蜜蝋/);
});

test("ハッシュタグは合計3〜5個の指示になっている", () => {
  const block = buildBrandBlock({ product: null, purpose: "save" });
  assert.match(block, /合計3〜5個/);
});

test("BRAND.voice が情緒過多・広告調の禁止を含む", () => {
  assert.ok(BRAND.voice.some((v) => /情緒過多|広告調/.test(v)));
});

// ---- 木材別の価格表 ----

test("木材別の価格表がプロンプトに含まれる", () => {
  const block = buildBrandBlock({ product: null, purpose: "profile" });
  assert.match(block, /カリン ¥4,000/);
});

test("価格未登録の商品では価格表を出さない", () => {
  // 「金額をどこにも書かないでください」と指示する以上、価格表を並べてはいけない。
  const noPrice = {
    id: "1",
    name: "試作品",
    description: null,
    price_from: null,
    metal_type: null,
    sort_order: 1,
    is_active: true,
    created_at: "",
  };
  const block = buildBrandBlock({ product: noPrice, purpose: "profile" });
  assert.equal(block.includes(PRICE_GUIDE), false);
  assert.equal(/木材別の価格/.test(block), false);
});

test("金属不使用の商品では金属の禁止行を出さない", () => {
  // 直下の金属セクションで「言い切って構いません」と書く以上、
  // 禁止リストに「金属不使用の断定は使わない」を並べてはいけない。
  const none = {
    id: "1",
    name: "木の指輪",
    description: null,
    price_from: 4000,
    metal_type: "none",
    sort_order: 1,
    is_active: true,
    created_at: "",
  };
  const block = buildBrandBlock({ product: none, purpose: "profile" });
  assert.equal(/金属不使用の断定 は使わない/.test(block), false);

  // 金属を使う商品では従来どおり禁止行を出す
  const metal = { ...none, name: "木のネクタイピン", metal_type: "metal" };
  const metalBlock = buildBrandBlock({ product: metal, purpose: "profile" });
  assert.match(metalBlock, /金属不使用の断定 は使わない/);
});

test("価格が確定している商品には価格表を出す", () => {
  const priced = {
    id: "1",
    name: "木の指輪",
    description: null,
    price_from: 4000,
    metal_type: "none",
    sort_order: 1,
    is_active: true,
    created_at: "",
  };
  const block = buildBrandBlock({ product: priced, purpose: "profile" });
  assert.ok(block.includes(PRICE_GUIDE));
});

test("PRICE_GUIDE に主要な木材が載っている", () => {
  for (const wood of ["カリン", "パープルハート", "ピンクアイボリー", "スネークウッド"]) {
    assert.ok(PRICE_GUIDE.includes(wood), `${wood} が PRICE_GUIDE にない`);
  }
});

// ---- 再生成用の検査（撮影セクションが使う出口） ----

test("findViolations は違反と理由を返す", () => {
  const v = findViolations("愛知の工房から、送料無料でお届けします");
  assert.equal(v.length, 2);
  assert.ok(v.every((x) => x.reason.length > 0));
});

test("findViolations は正常な文で空を返す", () => {
  assert.deepEqual(findViolations("天然木のため、木目や色合いは一つずつ異なります。"), []);
});

test("金属不使用の商品では金属ルールを免除する", () => {
  const text = "この指輪は金属不使用です。";
  assert.ok(findViolations(text, false).length > 0);
  assert.deepEqual(findViolations(text, true), []);
});

test("violationInstruction は再生成用の指示文を作る", () => {
  const v = findViolations("名古屋の工房です");
  const s = violationInstruction(v);
  assert.match(s, /名古屋/);
  assert.match(s, /地域名/);
});
