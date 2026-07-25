import { test } from "node:test";
import assert from "node:assert";
import { checkBrand } from "./brandCheck.ts";
import type { GenerateResult, Product } from "./types.ts";

function result(over: Partial<GenerateResult> = {}): GenerateResult {
  return {
    titles: [],
    script: "",
    story: "",
    sns: { x: "", tiktok: "", instagram: "" },
    ...over,
  };
}

const metalProduct: Product = {
  id: "1",
  name: "木のネクタイピン",
  description: null,
  category: "tiepin",
  material: null,
  size_range: null,
  price_from: 3500,
  metal_type: "metal",
  sort_order: 1,
  is_active: true,
  created_at: "",
};

test("台本に新ルール違反があれば警告する", () => {
  const w = checkBrand({
    result: result({ script: "愛知の工房から送料無料でお届けします" }),
  });
  assert.ok(w.length >= 2);
  assert.ok(w.every((x) => x.where === "台本"));
});

test("金属パーツ商品に「金属不使用」があれば警告する", () => {
  const w = checkBrand({
    result: result({ script: "この商品は金属不使用です" }),
    product: metalProduct,
  });
  assert.ok(w.some((x) => x.message.includes("金属不使用")));
});

test("金属不使用の商品では金属ルールを免除する", () => {
  const noneProduct: Product = {
    ...metalProduct,
    name: "木の指輪",
    metal_type: "none",
    price_from: 4000,
  };
  const w = checkBrand({
    result: result({ script: "この指輪は金属不使用です" }),
    product: noneProduct,
  });
  assert.deepEqual(w, []);
});

test("価格未登録の商品に金額が書かれていれば警告する", () => {
  const noPrice: Product = { ...metalProduct, price_from: null };
  const w = checkBrand({
    result: result({ sns: { x: "", tiktok: "", instagram: "¥3,500です" } }),
    product: noPrice,
  });
  assert.ok(w.some((x) => x.message.includes("価格未登録")));
});

test("違反のない生成では警告が出ない", () => {
  const ig = [
    "木の指輪 ハンドメイドの作り方をまとめました",
    "天然木のため、木目や色合いは一つずつ異なります。",
    "木材選びで迷った際に、見返していただけると嬉しいです。",
    "#cloud9woodwork #木の指輪",
  ].join("\n");
  const w = checkBrand({
    result: result({ sns: { x: "", tiktok: "", instagram: ig } }),
    purpose: "save",
  });
  assert.deepEqual(w, []);
});
