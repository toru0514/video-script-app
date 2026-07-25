import { test } from "node:test";
import assert from "node:assert";
import { buildPrompt, buildCaptionPrompt } from "./prompts.ts";
import type { PostDesign } from "./types.ts";
import type { Product } from "../types.ts";

function ring(over: Partial<Product> = {}): Product {
  return {
    id: "1",
    name: "木の指輪",
    description: null,
    category: "ring",
    material: "カリン",
    size_range: "3〜25号",
    price_from: 4000,
    metal_type: "none",
    sort_order: 1,
    is_active: true,
    created_at: "",
    ...over,
  };
}

const design: PostDesign = { theme: "product", goal: "profile", format: "feed" };

test("価格は price_from から作られる", () => {
  const p = buildPrompt(ring(), null, [], design, null);
  assert.match(p, /¥4,000〜（税込）/);
});

test("金属不使用の商品では言い切ってよい指示が出る", () => {
  const p = buildPrompt(ring(), null, [], design, null);
  assert.match(p, /金属不使用/);
  assert.match(p, /言い切/);
});

test("金属パーツ商品では言い切らせない", () => {
  const p = buildPrompt(
    ring({ name: "木のネクタイピン", metal_type: "metal", category: "tiepin" }),
    null,
    [],
    design,
    null,
  );
  assert.match(p, /「金属不使用」.*とは書かないでください/);
  assert.match(p, /金属パーツ使用/);
});

test("価格未登録の商品では金額を書かせない", () => {
  const p = buildPrompt(ring({ price_from: null }), null, [], design, null);
  assert.match(p, /どこにも金額を書かないでください/);
});

test("ブランドルールがプロンプトに含まれる", () => {
  const p = buildPrompt(ring(), null, [], design, null);
  assert.match(p, /天然木のため/);
  assert.match(p, /地域名/);
});

test("フォーマットごとに出力指示が変わる", () => {
  const feed = buildPrompt(ring(), null, [], design, null);
  assert.match(feed, /carousel と reel は null/);

  const carousel = buildPrompt(ring(), null, [], { ...design, format: "carousel" }, null);
  assert.match(carousel, /6〜8枚分/);

  const reel = buildPrompt(ring(), null, [], { ...design, format: "reel" }, null);
  assert.match(reel, /0〜3秒/);
});

test("写真からのキャプション生成にもブランドルールが入る", () => {
  const p = buildCaptionPrompt(design);
  assert.match(p, /天然木のため/);
  assert.match(p, /photo_summary/);
});

test("CTA は目的に応じた公式CTAが渡される", () => {
  const p = buildPrompt(ring(), null, [], { ...design, goal: "save" }, null);
  assert.match(p, /木材選びで迷った際に、見返していただけると嬉しいです。/);
});
