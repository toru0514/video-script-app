# lumiere 統合 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `lumiere`（撮影プラン＆投稿文生成）を `video-script-app` に取り込み、二重管理されているブランドルールと商品マスタを1本化する。

**Architecture:** `video-script-app` を母艦とし、動画セクションと撮影セクションを分けたまま1アプリに統合する。共有するのは `src/lib/brand.ts` と `vsg_products` の2つだけ。ブランドルールは lumiere 側（新しく厳しい方）を正として統合し、VSA 側にしかない商品マスタ連動の機能を残す。4フェーズに分け、各フェーズの終わりにアプリが動く状態を保つ。

**Tech Stack:** Next.js 16.2.9 (App Router) / React 19.2.4 / TypeScript 5 / Tailwind CSS 4 / Supabase (Postgres, service role) / Gemini (`@google/genai`) / Vercel

**設計ドキュメント:** `docs/superpowers/specs/2026-07-25-lumiere-integration-design.md`

---

## 前提: このプロジェクトのテスト方針

**このリポジトリには既存のテストが1つもない。** テストランナーも設定されていない。
Node v25 は TypeScript を直接実行できるため、**依存追加ゼロ**で `node --test` が使える。
動作確認済み（`brand.ts` を直接 import して実行成功）。

- テストファイルは実装と同じ場所に `*.test.ts` で置く
- 相対 import には**必ず拡張子 `.ts` を付ける**（Node のネイティブ実行はパス補完をしない）
- `@/` エイリアスは Node では解決されないため、テストからは相対パスで import する
- 実行時に `MODULE_TYPELESS_PACKAGE_JSON` の警告が出るが無害。`package.json` に `"type": "module"` は**追加しない**（Next のビルドに影響するリスクを避ける）

テストを書けるのは純関数（`brand.ts` のルール検査・プロンプト組み立て）のみ。
DB・画面・Gemini 呼び出しは、SQL 検証クエリとブラウザでの手動確認で担保する。
各タスクにどちらで確認するかを明記してある。

**Task 1 で `npm test` を追加する。以降のタスクはそれを使う。**

---

## ファイル構成

### Phase 1 で触るファイル

| ファイル | 役割 |
|---|---|
| `src/lib/brand.ts` | ブランド定義とルール表の唯一の置き場。lumiere 側のルールを統合する |
| `src/lib/brand.test.ts` | 新規。ルール表の回帰テスト |
| `src/lib/brandCheck.ts` | 統合ルール表の上に載せ替える。画面警告用の出口 |
| `src/lib/brandCheck.test.ts` | 新規 |
| `package.json` | `test` スクリプトを追加 |

### Phase 2 で触るファイル

| ファイル | 役割 |
|---|---|
| `supabase/schema.sql` | `vsg_products` の定義を書き戻し、カラムを追加 |
| `supabase/migrations/2026-07-25_merge_products.sql` | 新規。データ移行 |
| `src/lib/types.ts` | `Product` に3カラム追加、`metal_type` を union 化 |
| `src/lib/brand.ts` | `METAL_TYPES` のキーを4値へ |
| `src/app/api/products/route.ts` | 新カラムの受け付け |
| `src/components/ProductsManager.tsx` | 入力欄追加 |

### Phase 3 で新設するファイル

| ファイル | 役割 |
|---|---|
| `src/lib/shoot/prompts.ts` | 撮影プラン・写真キャプションのプロンプト組み立て（lumiere `lib/gemini.ts` のプロンプト部分） |
| `src/lib/shoot/generate.ts` | Gemini 呼び出しと違反リトライ（lumiere `lib/gemini.ts` の実行部分） |
| `src/lib/shoot/postPlan.ts` | 投稿計画（lumiere `lib/postPlan.ts`） |
| `src/lib/shoot/data.ts` | 背景・木材・下書きの読み書き（lumiere `lib/data.ts`） |
| `src/lib/shoot/types.ts` | 撮影固有の型（`ShootPlan` / `Background` / `Material` / `Draft` / `PostDesign`） |
| `src/app/shoot/planner/page.tsx` | 撮影プランナー |
| `src/app/shoot/caption/page.tsx` | 写真から投稿文 |
| `src/app/shoot/drafts/page.tsx` `[id]/page.tsx` | 下書き一覧・詳細 |
| `src/app/api/shoot/plan/route.ts` | 撮影プラン生成 API |
| `src/app/api/shoot/caption/route.ts` | 写真キャプション生成 API |
| `src/app/api/shoot/drafts/route.ts` `[id]/route.ts` | 下書き CRUD |
| `src/app/api/shoot/backgrounds/route.ts` `[id]/route.ts` | 背景素材 CRUD |
| `src/app/api/shoot/materials/route.ts` `[id]/route.ts` | 木材 CRUD |
| `src/app/settings/backgrounds/page.tsx` | 背景素材マスタ |
| `src/app/settings/materials/page.tsx` | 木材マスタ |
| `src/components/shoot/*.tsx` | 撮影セクションの画面部品 |

`src/lib/shoot/` と `src/components/shoot/` にまとめることで、撮影セクションの境界を
ディレクトリで表現する。動画側から撮影側を import してはいけない（逆も同じ）。
唯一の共有点は `src/lib/brand.ts` と `src/lib/types.ts` の `Product`。

---

# Phase 1: `brand.ts` の1本化

**このフェーズだけで二重管理の痛みの大半が消える。** DB もコード構造も触らない。

## Task 1: テスト環境の用意と現状の固定

**Files:**
- Modify: `package.json`
- Create: `src/lib/brand.test.ts`

- [ ] **Step 1: `package.json` に test スクリプトを追加**

`scripts` を以下にする。

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "node --test 'src/**/*.test.ts'"
  },
```

- [ ] **Step 2: 現状の `NG_RULES` を固定するテストを書く**

統合で既存ルールを壊していないことを担保する。`src/lib/brand.test.ts` を新規作成。

```ts
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
  const ok = "木婚式の贈り物に、カリンの指輪はいかがでしょう。天然木のため、木目や色合いは一つずつ異なります。";
  assert.deepEqual(labelsFor(ok), []);
});
```

- [ ] **Step 3: テストを実行して全部通ることを確認**

Run: `npm test`
Expected: PASS 6件。ここで落ちるならテストの書き方が現状と合っていないので、
テスト側を現状に合わせて直す（`brand.ts` はまだ触らない）。

- [ ] **Step 4: コミット**

```bash
git add package.json src/lib/brand.test.ts
git commit -m "test: brand.ts の既存NGルールに回帰テストを追加"
```

---

## Task 2: 新しいルールを失敗するテストとして書く

lumiere から採用するルールを、**先にテストとして書く**。この時点では全部落ちる。

**Files:**
- Modify: `src/lib/brand.test.ts`

- [ ] **Step 1: 失敗するテストを追記**

`src/lib/brand.test.ts` の末尾に追加。

```ts
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
```

- [ ] **Step 2: テストを実行して落ちることを確認**

Run: `npm test`
Expected: FAIL 7件（新ルールのみ）。Task 1 の6件は PASS のまま。

- [ ] **Step 3: コミット**

```bash
git add src/lib/brand.test.ts
git commit -m "test: lumiere由来の新ルールを失敗テストとして追加"
```

---

## Task 3: `NG_RULES` を統合してテストを通す

**Files:**
- Modify: `src/lib/brand.ts:204-255`（`NgRule` 型と `NG_RULES`）

- [ ] **Step 1: `NgRule` 型を拡張**

2つの用途を1つのルール表で賄うため、`label`（画面警告用の短い名前）に加えて
`reason`（再生成指示用の説明文）を持たせる。

`src/lib/brand.ts` の `NgRule` 型を差し替える。

```ts
export type NgRule = {
  /** 検出用パターン */
  pattern: RegExp;
  /** 画面警告に出す短いラベル */
  label: string;
  /** 正しい言い換え（警告表示用） */
  replacement: string;
  /** 再生成をかけるときにLLMへ渡す説明。なぜ駄目で、どう直すか */
  reason: string;
  /** 商品が「金属不使用」と確定している場合はこのルールを免除する */
  exemptWhenMetalFree?: boolean;
};
```

- [ ] **Step 2: `NG_RULES` を統合版に差し替える**

`src/lib/brand.ts` の `NG_RULES` 配列全体を以下で置き換える。

```ts
export const NG_RULES: NgRule[] = [
  {
    pattern:
      /(すべて|全て|全商品|どれも)?一点もの|一点物|世界に(たった)?(ひとつ|一つ)|二つとない|同じものは二つと|唯一無二/,
    label: "「一点もの」系の表現",
    replacement: "天然木のため、木目や色合いは一つずつ異なります",
    reason:
      "同一デザインの商品があるため「一点もの」「世界に一つ」系の表現は使えません。「天然木のため、木目や色合いは一つずつ異なります」に置き換えてください。",
  },
  {
    pattern: /金属不使用|金属を(一切|まったく|全く)?使(用|って|わ)|メタルフリー|金属フリー/,
    label: "金属不使用の断定",
    replacement:
      "金属アレルギー対応（商品によって金属使用の有無が異なります／樹脂ピアスも選択できます）",
    reason:
      "ブランド全体で金属を使っていないと読める断定は禁止です（ネクタイピン・カフス・ネックレスは金属パーツを使用します）。「金属アレルギー対応」「商品によって金属使用の有無が異なります」「樹脂ピアスも選択できます」に置き換えてください。",
    exemptWhenMetalFree: true,
  },
  {
    pattern: /#cloud9(?![a-zA-Z0-9_])/i,
    label: "ハッシュタグ #cloud9（単体）",
    replacement: "#cloud9woodwork",
    reason:
      "「#cloud9」単体はeスポーツチームの投稿に埋没するため使いません。「#cloud9woodwork」に置き換えてください。",
  },
  {
    pattern: /Cloud9|クラウドナイン/,
    label: "ブランド名の誤表記",
    replacement: "木材工房cloud9",
    reason:
      "ブランド名の表記は「木材工房cloud9」です（ハッシュタグのみ cloud9woodwork）。「Cloud9」「クラウドナイン」とは書かないでください。",
  },
  {
    pattern: /【要確認】|¥X,XXX|X,XXX円|〇〇円|○○円/,
    label: "価格などの未確定プレースホルダ",
    replacement: "価格が確定していない商品では金額に触れない",
    reason:
      "価格が確定していない商品では金額に触れません。プレースホルダを含む一文を削除してください。",
  },
  {
    pattern: /https?:\/\/|cloud9woodwork\.com|\/woods|minne\.com|creema\.jp/i,
    label: "URL・パス表記",
    replacement: "「プロフィールのリンク（Creema）から」と書く",
    reason:
      "URL・ドメイン・パス表記は書きません（リンクはプロフィールにあるため）。「プロフィールのリンク（Creema）から」に置き換えてください。",
  },
  {
    pattern: /minne|ミンネ/i,
    label: "minne への言及",
    replacement: "Creema",
    reason:
      "Instagram の導線は Creema に統一しています（minne は併売のみで導線には出さない）。「Creema」に置き換えてください。",
  },
  {
    pattern: /送料無料|送料込み|送料は|送料を/,
    label: "送料への言及",
    replacement: "送料には触れない",
    reason:
      "送料は商品によって異なる（カリンの指輪のみ別途¥500）ため、投稿文では触れません。該当箇所を削除してください。",
  },
  {
    pattern: /ラッピング|のし(紙|袋|対応)|熨斗|ギフト包装/,
    label: "ラッピングへの言及",
    replacement: "贈り物の文脈では「ケース付き」で伝える",
    reason:
      "ギフトラッピングは現在承っていません。贈り物の文脈では「ケース付き」で伝えてください。",
  },
  {
    pattern: /即日発送|翌日発送|サイズ直し|サイズ調整|修理/,
    label: "発送・修理の断定",
    replacement: "発送は「ご注文（お支払い）後4日以内」（バングルは7日以内）",
    reason:
      "発送は「ご注文（お支払い）後4日以内」（バングルは7日以内）です。サイズ直し・修理の可否は未確認のため書けません。",
  },
  {
    pattern: /宝石|天然石|ダイヤ|ジュエル|パワーストーン/,
    label: "クリスタルを宝石として書く表現",
    replacement: "クリスタルガラス（宝石ではありません）",
    reason:
      "クリスタルウッドリングに使っているのはクリスタルガラスです。宝石・天然石とは書かず、触れる場合は「クリスタルガラス（宝石ではございません）」と明記してください。",
  },
  {
    pattern: /お手頃|リーズナブル|格安|お安く|プチプラ/,
    label: "安さの訴求",
    replacement: "価格は事実だけを書く（例:「¥4,000〜（税込）」）",
    reason:
      "安さの訴求は行いません。価格に触れる場合は「¥4,000〜（税込）」のように事実だけを書いてください。",
  },
  {
    pattern: /激安|今だけ|絶対に?お?買い得|大人気|完売間近|限定セール|お得/,
    label: "誇張・セール文句",
    replacement: "落ち着いた事実の記述",
    reason:
      "誇張・セール文句は使いません。落ち着いた事実の記述に置き換えてください。",
  },
  {
    pattern:
      /静かに佇む|そっと寄り添|安らぎをもたら|優しく浮かび上が|いかがですか|をあなたに|上質な|極上の|特別な(?!日)/,
    label: "情緒過多・広告調の表現",
    replacement: "作り手の言葉で、具体的な事実を書く",
    reason:
      "情緒過多・広告調の表現です。作り手の言葉で、具体的な事実に置き換えてください。",
  },
  {
    pattern: /愛知|名古屋|東海|豊田|岡崎|一宮/,
    label: "地域名",
    replacement: "（削除する）",
    reason: "地域名は使わない方針です。削除してください。",
  },
];
```

- [ ] **Step 3: テストを実行して全部通ることを確認**

Run: `npm test`
Expected: PASS 13件。

Task 1 の「正常な文はどのルールにも当たらない」が落ちる場合、新ルールが正常文を
誤検出している。その場合はテストの例文ではなく**正規表現の方を狭める**こと
（誤検出を許すと生成のたびに無駄なリトライが走る）。

- [ ] **Step 4: コミット**

```bash
git add src/lib/brand.ts src/lib/brand.test.ts
git commit -m "feat: NG_RULES に lumiere 側のルールを統合（送料・minne・地域名・情緒過多ほか）"
```

---

## Task 4: 事実情報と購入導線を新方針に合わせる

`NG_RULES` で送料と minne を禁止したのに、`FACTS` と購入導線の記述が
「送料無料と書いてよい」「minne に触れてよい」のままだと**プロンプトが自己矛盾する**。

**Files:**
- Modify: `src/lib/brand.ts:34-43`（`FACTS`）
- Modify: `src/lib/brand.ts:11-28`（`BRAND`）
- Modify: `src/lib/brand.ts:333-338`（`buildBrandBlock` 内の購入導線ブロック）

- [ ] **Step 1: 矛盾を検出するテストを追加**

`src/lib/brand.test.ts` に追記。

```ts
import { BRAND, FACTS, buildBrandBlock } from "./brand.ts";

test("FACTS に送料の記述が残っていない", () => {
  assert.equal(FACTS.some((f) => /送料/.test(f)), false);
});

test("プロンプトに minne を許す記述が残っていない", () => {
  const block = buildBrandBlock({ product: null, purpose: "profile" });
  assert.equal(/minne/i.test(block), false);
});

test("プロンプトに蜜蝋仕上げの記述がある", () => {
  const block = buildBrandBlock({ product: null, purpose: "save" });
  assert.match(block, /蜜蝋/);
});
```

- [ ] **Step 2: 実行して落ちることを確認**

Run: `npm test`
Expected: FAIL 3件。

- [ ] **Step 3: `FACTS` を差し替える**

送料の行を削除し、lumiere の `PRODUCT_SPEC` にあった蜜蝋仕上げを取り込む。

```ts
export const FACTS = [
  "発送：ご注文（お支払い）後4日以内に発送。バングルのみ7日以内",
  "付属品：指輪はケース・ポーチ・クロス付き。ネクタイピンはケース付き。それ以外の商品の付属品は不明のため書かない",
  "サイズ：指輪は3〜25号（それ以外も相談可）。イヤーカフは丸型S/M/L/XL・四角型S/M/L・三角型M/L。バングルはXS〜XLの5サイズ＋サイズオーダー（+¥1,000）",
  "仕上げ：無着色・蜜蝋仕上げ。ニス等の艶出し剤は使っていません",
  "お手入れ：生活防水。濡れたら乾いたタオルで拭き陰干し",
  "経年変化：使うほどに色が深まります。天然素材・手作業のため木目や色合いに個体差があり、強い衝撃で割れる恐れがあります",
  "クリスタル：各種クリスタルガラスを使用。宝石ではありません",
  "ギフトラッピングは現状お受けできません。贈り物の文脈では「ケース付き」で伝えます",
] as const;
```

- [ ] **Step 4: `BRAND` のコメントと `shopLine` 周辺を直す**

`BRAND` 直上のコメント（`src/lib/brand.ts:14-15`）から minne・BASE の記述を削除する。

```ts
export const BRAND = {
  account: "cloud9woodwork（木材工房cloud9）",
  what: "希少木材から手仕事で作る、木のアクセサリー（指輪・イヤーカフ・イヤリング・ピアス・バングル・ネクタイピン・カフス・ネックレス）",
  // 購入導線は Creema に一本化する。minne でも併売しているが導線には出さない
  // （選択肢を増やすとレビューが分散するため）。
  shopLine: "プロフィールのリンク（Creema）から",
  siteLine: "自社サイトの木材図鑑",
  audience:
    "購買層は25〜44歳の女性。加えて45歳以上の男性フォロワーが多く、彼らは「妻への記念日ギフト」の見込み客。どちらにも通じる落ち着いた大人向けの言葉で書く。",
  voice: [
    "作り手の一人称で、話し言葉に近い「です・ます」。淡々と、具体で語る",
    "木目・光・温もり・経年変化など五感の描写を使う",
    "情緒過多（「静かに佇む」「そっと寄り添う」）・広告調（「〜をあなたに」「〜はいかがですか」）は使わない",
    "誇張やセール文句（激安・今だけ・絶対・大人気・完売間近など）は使わない",
    "絵文字は0〜2個。使わなくてもよい",
    "「〜と嬉しいです」のような謙虚な締めがブランドらしさ",
  ],
} as const;
```

- [ ] **Step 5: `buildBrandBlock` の購入導線ブロックを直す**

`src/lib/brand.ts` の `■購入導線` セクションを以下に差し替える。

```
■購入導線
購入・在庫の案内は必ず「${BRAND.shopLine}」という言い方にする。
木材そのものの解説に触れる場合は${BRAND.siteLine}へ誘導してよい。
minne でも併売しているが、Instagram の導線には出さない（「minne」と書かない）。
URL・ドメイン・「/woods」のようなパス表記は書かない（リンクはプロフィールにあるため）。
```

- [ ] **Step 6: ハッシュタグの本数を3〜5個に絞る**

`buildBrandBlock` の `■ハッシュタグ` セクションを以下に差し替える。

```
■ハッシュタグ
- 合計3〜5個。関連度の高いものだけに絞る（数を増やさない運用方針）
- ブランド（1個必須）: ${HASHTAGS.brand.join(" ")}
- 商品系（2〜3個）: ${HASHTAGS.product.join(" ")}
- ギフト系（0〜1個・ギフト文脈のときのみ）: ${HASHTAGS.gift.join(" ")}
- コミュニティ系（0〜1個）: ${HASHTAGS.community.join(" ")}
- 「#cloud9」単体は絶対に使わない
- 地域名（都道府県・市区町村）はタグにしない
- 販路名（Creema・minne）はタグにしない
```

- [ ] **Step 7: テストを実行して全部通ることを確認**

Run: `npm test`
Expected: PASS 16件。

- [ ] **Step 8: コミット**

```bash
git add src/lib/brand.ts src/lib/brand.test.ts
git commit -m "feat: FACTS・購入導線・ハッシュタグ本数を新しい運用方針に合わせる"
```

---

## Task 5: 木材別の価格表を取り込む

lumiere にあった木材別の実額表を移す。商品マスタは商品カテゴリ単位のため、
木材まで特定した価格はこの定数でしか表現できない。

**Files:**
- Modify: `src/lib/brand.ts`

- [ ] **Step 1: テストを追加**

```ts
import { PRICE_GUIDE } from "./brand.ts";

test("木材別の価格表がプロンプトに含まれる", () => {
  const block = buildBrandBlock({ product: null, purpose: "profile" });
  assert.match(block, /カリン ¥4,000/);
});

test("PRICE_GUIDE に主要な木材が載っている", () => {
  for (const wood of ["カリン", "パープルハート", "ピンクアイボリー", "スネークウッド"]) {
    assert.ok(PRICE_GUIDE.includes(wood), `${wood} が PRICE_GUIDE にない`);
  }
});
```

- [ ] **Step 2: 実行して落ちることを確認**

Run: `npm test`
Expected: FAIL 2件。

- [ ] **Step 3: `PRICE_GUIDE` を追加**

`src/lib/brand.ts` の `priceLine` の直前に追加する。

```ts
// ------------------------------------------------------------
// 木材別の実売価格（税込）
// 商品マスタは商品カテゴリ単位のため、木材まで特定した価格はここにしかない。
// 出典: 商品マスタ_Creema_2026-07-25
// ------------------------------------------------------------
export const PRICE_GUIDE = `- 木の指輪: カリン ¥4,000 / パープルハート・メープル・ローズウッド 各 ¥6,000 / サティーネ ¥7,000 / ピンクアイボリー・スネークウッド 各 ¥16,000（受注生産）
- クリスタルウッドリング: カリン・エボニー・メープル 各 ¥8,000
- イヤーカフ: カリン・オリーブウッド 各 ¥2,500 / 金箔×エボニー ¥3,500
- バングル: 各 ¥11,000（サイズオーダー +¥1,000 / サイズ確認用 ¥600）
- ピアス: カリン・メープル・パープルハート 各 ¥3,000 / ピンクアイボリー ¥4,000 / クリスタル丸 ¥6,000 / 市松模様（寄木）¥8,000 / クジラ ¥2,500
- ネクタイピン・カフス: 単品 ¥3,500〜¥5,000 / ネクタイピン&カフスセット ¥6,000
- ネックレス: ¥5,000`;
```

- [ ] **Step 4: `buildBrandBlock` の `■価格` セクションに追記**

`priceRule` を出力している箇所の直後に以下を足す。

```
■木材別の価格（木材まで特定して価格に触れるときは、下限ではなくこの実額を使う）
${PRICE_GUIDE}
```

- [ ] **Step 5: テストを実行**

Run: `npm test`
Expected: PASS 18件。

- [ ] **Step 6: コミット**

```bash
git add src/lib/brand.ts src/lib/brand.test.ts
git commit -m "feat: 木材別の実売価格表を brand.ts に取り込む"
```

---

## Task 6: `findViolations` を追加して検査の出口を2つにする

撮影セクションが使う「違反を再生成指示に回す」出口を、統合ルール表の上に作る。
Phase 3 で使うが、ルール表と同じタイミングで作っておく。

**Files:**
- Modify: `src/lib/brand.ts`
- Modify: `src/lib/brand.test.ts`

- [ ] **Step 1: テストを書く**

```ts
import { findViolations, violationInstruction } from "./brand.ts";

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
```

- [ ] **Step 2: 実行して落ちることを確認**

Run: `npm test`
Expected: FAIL 4件。

- [ ] **Step 3: `findViolations` と `violationInstruction` を実装**

`src/lib/brand.ts` の `NG_RULES` の直後に追加する。

```ts
export type Violation = {
  /** 検出された表現 */
  matched: string;
  /** なぜ問題か・どう直すか（再生成の指示にそのまま渡す） */
  reason: string;
};

/**
 * 生成テキストが表現ルールに違反していないか検査する。
 * @param metalFree 対象商品の metal_type が "none" の場合 true（金属表現のルールを免除）
 */
export function findViolations(text: string, metalFree = false): Violation[] {
  const violations: Violation[] = [];
  for (const rule of NG_RULES) {
    if (metalFree && rule.exemptWhenMetalFree) continue;
    const m = text.match(rule.pattern);
    if (m) violations.push({ matched: m[0], reason: rule.reason });
  }
  return violations;
}

/** 違反リストを再生成用の指示文にする。 */
export function violationInstruction(violations: Violation[]): string {
  return violations.map((v) => `- 「${v.matched}」: ${v.reason}`).join("\n");
}
```

- [ ] **Step 4: テストを実行**

Run: `npm test`
Expected: PASS 22件。

- [ ] **Step 5: コミット**

```bash
git add src/lib/brand.ts src/lib/brand.test.ts
git commit -m "feat: findViolations を追加し、検査の出口を再生成用と警告用の2つにする"
```

---

## Task 7: `brandCheck.ts` を統合ルール表に載せ替える

`checkBrand` は `NgRule` の形が変わったので追随させる。固有の検査は残す。

**Files:**
- Modify: `src/lib/brandCheck.ts`
- Create: `src/lib/brandCheck.test.ts`

- [ ] **Step 1: `checkBrand` のテストを書く**

`src/lib/brandCheck.test.ts` を新規作成。

```ts
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
  } as GenerateResult;
}

const metalProduct = {
  id: "1",
  name: "木のネクタイピン",
  description: null,
  price_from: 3500,
  metal_type: "metal",
  sort_order: 1,
  is_active: true,
  created_at: "",
} as Product;

test("台本に新ルール違反があれば警告する", () => {
  const w = checkBrand({ result: result({ script: "愛知の工房から送料無料でお届けします" }) });
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

test("価格未登録の商品に金額が書かれていれば警告する", () => {
  const noPrice = { ...metalProduct, price_from: null } as Product;
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
  const w = checkBrand({ result: result({ sns: { x: "", tiktok: "", instagram: ig } }), purpose: "save" });
  assert.deepEqual(w, []);
});
```

- [ ] **Step 2: 実行して落ちることを確認**

Run: `npm test`
Expected: FAIL（`checkBrand` が新しいルール表に追随していないため）。

- [ ] **Step 3: `brandCheck.ts` の禁止表現ループを `findViolations` に置き換える**

`src/lib/brandCheck.ts` の「1. 禁止表現」ブロックを以下に差し替える。
商品の `metal_type` が `"none"` なら金属ルールを免除する（引数ではなく商品から導出）。

```ts
  // 1. 禁止表現（brand.ts の統合ルール表を使う）
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
```

- [ ] **Step 4: 金属チェックの分岐を4値に合わせる**

`src/lib/brandCheck.ts` の「2. 金属の言い方」ブロックの条件を直す。
`"unknown"` でも商品固有の断定はさせない。

```ts
  if (product?.metal_type && product.metal_type !== "none") {
```

を

```ts
  if (product?.metal_type && product.metal_type !== "none" && product.metal_type !== "unknown") {
```

に変える。

- [ ] **Step 5: テストを実行**

Run: `npm test`
Expected: PASS 26件。

「違反のない生成では警告が出ない」が落ちる場合、新ルールが正常な文言を誤検出している。
`NG_RULES` の正規表現を狭めること。

- [ ] **Step 6: 型チェックとビルド**

Run: `npx tsc --noEmit`
Expected: エラーなし

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/brandCheck.ts src/lib/brandCheck.test.ts
git commit -m "refactor: brandCheck を統合ルール表の上に載せ替える"
```

---

## Task 8: Phase 1 の受け入れ確認

**Files:** なし（動作確認のみ）

- [ ] **Step 1: 開発サーバを起動**

Run: `npm run dev`

- [ ] **Step 2: 生成を実行して警告の出方を確認**

`/generate` でナレーターと商品を選び、目的を4種それぞれで1回ずつ生成する。

確認すること:
- 生成が最後まで通る（プロンプトが壊れていない）
- Instagram 用投稿文のハッシュタグが3〜5個に収まっている
- 送料・minne・地域名・「一点もの」が出力に含まれない
- 商品の `metal_type` に応じた金属表現になっている
- 価格未登録の商品を選んだとき、金額がどこにも出ない

- [ ] **Step 3: 意図的に違反する生成で警告が出ることを確認**

`/history` から過去の生成を開き、警告表示が壊れていないことを確認する。

- [ ] **Step 4: main にマージ**

```bash
git checkout main
git merge --no-ff feat/lumiere-integration -m "Phase 1: brand.ts を1本化"
git checkout feat/lumiere-integration
```

---

# Phase 2: 商品マスタの統合

## Task 9: `vsg_products` の定義を `schema.sql` に書き戻す

`vsg_products` は本番DBにのみ存在し `schema.sql` に定義がない（意図的な drift）。
統合を機に解消する。

**Files:**
- Modify: `supabase/schema.sql:82-88`, `:111-113`

- [ ] **Step 1: drift 注記を削除し、正式な定義に置き換える**

`supabase/schema.sql` の `alter table public.vsg_products add column ...` の2行と、
その上のコメント、および `:111-113` の drift 注記を削除して、以下を入れる。

```sql
-- ============================================================
-- vsg_products（商品マスタ）
--   投稿文・台本で価格や金属に言及する際の唯一の根拠。
--   price_from: 最低価格（税込・円）。null の商品は金額を書かせない。
--   metal_type: none / resin_option / metal / unknown。商品ごとに言える表現が違う。
-- ============================================================
create table if not exists public.vsg_products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    text,
  material    text,
  size_range  text,
  price_from  int,
  metal_type  text not null default 'unknown',
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 既存DBへの追随（本番には create table 以前から存在するため）
alter table public.vsg_products add column if not exists category   text;
alter table public.vsg_products add column if not exists material   text;
alter table public.vsg_products add column if not exists size_range text;
alter table public.vsg_products add column if not exists price_from int;
alter table public.vsg_products add column if not exists metal_type text;
```

- [ ] **Step 2: コミット**

```bash
git add supabase/schema.sql
git commit -m "chore: vsg_products の定義を schema.sql に書き戻す"
```

---

## Task 10: 移行 SQL を書いて適用する

**Files:**
- Create: `supabase/migrations/2026-07-25_merge_products.sql`

- [ ] **Step 1: 移行 SQL を書く**

`supabase/migrations/2026-07-25_merge_products.sql` を新規作成。

```sql
-- lumiere_products を vsg_products に統合する。
-- 実データ突合（2026-07-25）の結果、価格・金属分類は全商品で一致していた。
-- 差分は商品名の揺れ2件と、vsg にのみ存在する「木のイヤリング」1件のみ。

begin;

-- 1. カラム追加（schema.sql と同内容）
alter table public.vsg_products add column if not exists category   text;
alter table public.vsg_products add column if not exists material   text;
alter table public.vsg_products add column if not exists size_range text;

-- 2. 金属分類を lumiere 側の4値に統一
update public.vsg_products set metal_type = 'resin_option' where metal_type = 'hypoallergenic';
update public.vsg_products set metal_type = 'unknown'      where metal_type is null;
alter table public.vsg_products alter column metal_type set default 'unknown';

-- 3. 商品名の揺れを解消（lumiere 側を vsg 側の表記に合わせる）
update public.lumiere_products set name = '木のカフス'       where name = 'カフス';
update public.lumiere_products set name = '木のネクタイピン' where name = 'ネクタイピン';

-- 4. lumiere にしかないカラムの値を移す
update public.vsg_products v
set category   = coalesce(v.category,   l.category),
    material   = coalesce(v.material,   l.material),
    size_range = coalesce(v.size_range, l.size_range)
from public.lumiere_products l
where v.name = l.name;

-- 5. vsg にのみ存在する商品のカテゴリを手当て
update public.vsg_products set category = 'earring' where name = '木のイヤリング' and category is null;

-- 6. lumiere_drafts の参照を vsg_products へ張り替え
alter table public.lumiere_drafts drop constraint if exists lumiere_drafts_product_id_fkey;

update public.lumiere_drafts d
set product_id = v.id
from public.lumiere_products l
join public.vsg_products v on v.name = l.name
where d.product_id = l.id;

alter table public.lumiere_drafts
  add constraint lumiere_drafts_product_id_fkey
  foreign key (product_id) references public.vsg_products(id) on delete set null;

commit;
```

- [ ] **Step 2: 適用前に現状を控える**

Supabase の SQL Editor で実行し、結果を手元に残す。

```sql
select count(*) from public.vsg_products;        -- 期待: 9
select count(*) from public.lumiere_products;    -- 期待: 8
select count(*) from public.lumiere_drafts where product_id is not null;
```

- [ ] **Step 3: 移行 SQL を適用**

`supabase/migrations/2026-07-25_merge_products.sql` を Supabase の SQL Editor で実行する。

- [ ] **Step 4: 検証クエリを実行（drop の前に必ず通す）**

```sql
-- (a) lumiere_products の全行が vsg_products に名前一致するか。期待: 0件
select l.name from public.lumiere_products l
left join public.vsg_products v on v.name = l.name
where v.id is null;

-- (b) 張り替え漏れがないか。期待: 0件
select d.id, d.product_id from public.lumiere_drafts d
left join public.vsg_products v on v.id = d.product_id
where d.product_id is not null and v.id is null;

-- (c) category が全行埋まっているか。期待: 0件
select name from public.vsg_products where category is null;

-- (d) metal_type が4値に収まっているか。期待: none/resin_option/metal/unknown のみ
select distinct metal_type from public.vsg_products;
```

**4つすべてが期待どおりでなければ、次のステップに進まないこと。**

- [ ] **Step 5: `lumiere_products` を drop**

```sql
drop table public.lumiere_products;
```

- [ ] **Step 6: コミット**

```bash
git add supabase/migrations/2026-07-25_merge_products.sql
git commit -m "feat: lumiere_products を vsg_products に統合する移行SQLを追加"
```

---

## Task 11: `Product` 型と `METAL_TYPES` を4値に合わせる

**Files:**
- Modify: `src/lib/types.ts:22-33`
- Modify: `src/lib/brand.ts:48-66`

- [ ] **Step 1: `Product` 型を更新**

`src/lib/types.ts` の `Product` を差し替える。

```ts
export type Product = {
  id: string;
  name: string;
  description: string | null;
  /** 商品カテゴリ（ring / crystal_ring / earcuff / earring / bangle / tiepin / cufflinks / necklace） */
  category: string | null;
  /** 主な木材（例: カリン）。特定されている場合のみ */
  material: string | null;
  /** サイズ表記（例: 3〜25号） */
  size_range: string | null;
  /** 最低価格（税込・円）。null なら投稿文に金額を書かせない */
  price_from: number | null;
  /** 金属使用の分類。unknown なら商品固有の断定をさせない */
  metal_type: MetalType | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};
```

`MetalType` は `brand.ts` からの再エクスポートにせず、`types.ts` で定義して
`brand.ts` が import する形にすると循環参照になる。**`brand.ts` で定義したものを
`types.ts` が import する**（現状 `brand.ts` が `types.ts` を型 import しているため
逆向きにすると循環する）。したがって `types.ts` の先頭に以下を足す。

```ts
import type { MetalType } from "./brand";
```

`brand.ts` 側の `import type { Product } from "./types";` は型のみの循環なので
TypeScript では問題ないが、Node のネイティブ実行でも型 import は消えるため実行にも影響しない。

- [ ] **Step 2: `METAL_TYPES` を4値に差し替え**

`src/lib/brand.ts` の該当箇所を置き換える。

```ts
export type MetalType = "none" | "resin_option" | "metal" | "unknown";

export const METAL_TYPES: Record<MetalType, { label: string; rule: string }> = {
  none: {
    label: "金属不使用",
    rule: "この商品は金属を使っていません。「金属不使用」と言い切って構いません。（該当：指輪・クリスタルウッドリング・バングル・イヤーカフ）",
  },
  resin_option: {
    label: "金属アレルギー対応パーツ（樹脂・イヤリング変更可）",
    rule: "この商品は金属アレルギー対応パーツを使っています。「金属不使用」とは書かないでください。「金属アレルギー対応パーツを使用しています。樹脂フックやイヤリングへの変更もできます」の範囲で書きます。（該当：ピアス・イヤリング）",
  },
  metal: {
    label: "金属パーツ使用",
    rule: "この商品は金具に金属（ゴールドまたはシルバーを選択可）を使っています。「金属不使用」「金属アレルギー対応」とは書かないでください。金具に触れる場合は「金具はゴールドとシルバーからお選びいただけます」のように選べる利点として書き、「金属アレルギーの方には向きません」のような否定的な注意書きは書きません。（該当：ネクタイピン・カフス・ネックレス）",
  },
  unknown: {
    label: "未確認",
    rule: "この商品の金属使用状況は未確認です。商品固有の断定は避け、ブランド全体の表現「金属アレルギー対応。商品によって金属使用の有無が異なります」に留めてください。",
  },
};
```

- [ ] **Step 3: `buildBrandBlock` の metal 分岐を整理**

`metal_type` が必ず値を持つようになったので、null 分岐を `unknown` にまとめる。

```ts
  const metal = METAL_TYPES[(product?.metal_type as MetalType) ?? "unknown"];
  const metalRule = product
    ? `この商品「${product.name}」の分類：${metal.label}\n${metal.rule}`
    : METAL_TYPES.unknown.rule;
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: `hypoallergenic` を参照している箇所がエラーになる。すべて `resin_option` に直す。
`grep -rn "hypoallergenic" src/` で残りがないことも確認する。

- [ ] **Step 5: テストとビルド**

Run: `npm test`
Expected: PASS（既存26件）

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/types.ts src/lib/brand.ts
git commit -m "feat: 金属分類を4値（none/resin_option/metal/unknown）に統一"
```

---

## Task 12: 商品マスタ画面と API に新カラムを通す

**Files:**
- Modify: `src/app/api/products/route.ts`
- Modify: `src/components/ProductsManager.tsx`
- Modify: `src/lib/sampleData.ts`

- [ ] **Step 1: API に3カラムを通す**

`src/app/api/products/route.ts` の POST / PATCH で `category` / `material` / `size_range` を
受け付ける。`parseMetalType` を4値に直す。

```ts
// 金属分類。未知の値は "unknown" に落とす（＝商品固有の断定をさせない）。
function parseMetalType(v: unknown): string {
  return v === "none" || v === "resin_option" || v === "metal" ? v : "unknown";
}

// 空文字は null に落とす（DB に空文字を入れない）。
function parseText(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
```

insert / update のオブジェクトに以下を足す。

```ts
        category:   parseText(body.category),
        material:   parseText(body.material),
        size_range: parseText(body.size_range),
```

- [ ] **Step 2: `sampleData.ts` の `SAMPLE_PRODUCTS` を新しい型に合わせる**

`category` / `material` / `size_range` を追加し、`hypoallergenic` を `resin_option` に直す。
型チェックが通ることが確認の基準。

- [ ] **Step 3: `ProductsManager.tsx` に入力欄を追加**

既存の入力欄（名前・説明・価格・金属分類）に並べて3つ足す。

- カテゴリ: select（`ring` / `crystal_ring` / `earcuff` / `earring` / `bangle` / `tiepin` / `cufflinks` / `necklace`）
- 木材: text（任意）
- サイズ: text（任意。例「3〜25号」）

金属分類の select の選択肢を4値に差し替える。ラベルは `METAL_TYPES[k].label` を使う。

- [ ] **Step 4: 型チェックとビルド**

Run: `npx tsc --noEmit && npm run build`
Expected: 成功

- [ ] **Step 5: ブラウザで確認**

Run: `npm run dev`

`/settings` の商品マスタで確認すること:
- 商品9件が表示され、カテゴリ・木材・サイズが正しく出ている
- 既存商品を編集して保存でき、リロード後も値が残る
- 新規商品を追加でき、カテゴリ未選択では保存できない
- 金属分類のラベルが4種出る

- [ ] **Step 6: コミット**

```bash
git add src/app/api/products/route.ts src/components/ProductsManager.tsx src/lib/sampleData.ts
git commit -m "feat: 商品マスタにカテゴリ・木材・サイズを追加"
```

---

## Task 13: Phase 2 の受け入れ確認

- [ ] **Step 1: 生成が従来どおり動くことを確認**

`/generate` で商品を選んで生成する。確認すること:
- 金属分類に応じた表現が出る（`metal` の商品で「金属不使用」が出ない）
- 価格が `price_from` のとおりに出る
- 価格未登録の商品では金額が出ない

- [ ] **Step 2: main にマージ**

```bash
git checkout main
git merge --no-ff feat/lumiere-integration -m "Phase 2: 商品マスタを統合"
git checkout feat/lumiere-integration
```

---

# Phase 3: 撮影機能の移植

**参照元:** `/Users/toru/code/lumiere`

このフェーズはコードの移動が主。**ロジックは変えない。** 変えるのは以下の4点だけ。

1. 商品のカラム名: `price_min` → `price_from`、`metal` → `metal_type`
2. `brand.ts` の import 元: lumiere の `lib/brand.ts` → VSA の `src/lib/brand.ts`
3. Supabase クライアント: `createServiceClient()` → `getSupabase()`
4. 認証: 各ページ・API に admin 判定を追加

## Task 14: 撮影セクションの型とデータ層を移す

**Files:**
- Create: `src/lib/shoot/types.ts`
- Create: `src/lib/shoot/data.ts`
- Create: `src/lib/shoot/postPlan.ts`
- Modify: `src/lib/supabase.ts:13-20`

- [ ] **Step 1: `T` に3テーブルを追加**

```ts
export const T = {
  narrators:   "vsg_narrators",
  scripts:     "vsg_scripts",
  patterns:    "vsg_patterns",
  generations: "vsg_generations",
  products:    "vsg_products",
  videos:      "vsg_videos",
  backgrounds: "lumiere_backgrounds",
  materials:   "lumiere_materials",
  drafts:      "lumiere_drafts",
} as const;
```

- [ ] **Step 2: `src/lib/shoot/types.ts` を作る**

lumiere の `types/index.ts` から、以下だけを移す。

- `ShootPlan` / `SHOOT_PLAN_KEYS` / `SHOOT_PLAN_LABELS`
- `Background` / `Material` / `Draft` / `DraftWithProduct` / `DraftStatus`
- `PostTheme` / `PostGoal` / `PostDesign` / `CarouselSlide` / `ReelScript`
- `GenerateResult` / `CaptionResult`

**移さないもの:**
- `Product` / `MetalUsage` / `METAL_OPTIONS` / `metalLabel`
  → VSA の `src/lib/types.ts` と `src/lib/brand.ts` にあるものを使う

`Product` を参照している箇所は `import type { Product } from "@/lib/types"` に書き換える。

- [ ] **Step 3: `src/lib/shoot/data.ts` を作る**

lumiere の `lib/data.ts` を移す。変更点:

- `import { createServiceClient } from "@/lib/supabase/server"` → `import { getSupabase, T } from "@/lib/supabase"`
- `createServiceClient()` の呼び出しを `getSupabase()` に
- テーブル名のリテラルを `T.backgrounds` / `T.materials` / `T.drafts` に
- `getProducts()` は**移さない**。VSA の `/api/products` 側に既にある

- [ ] **Step 4: `src/lib/shoot/postPlan.ts` を作る**

lumiere の `lib/postPlan.ts` をそのまま移す。import が `@/types` を指していれば
`@/lib/shoot/types` に直す。

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/lib/supabase.ts src/lib/shoot/
git commit -m "feat: 撮影セクションの型とデータ層を移植"
```

---

## Task 15: プロンプト組み立てを移す

**Files:**
- Create: `src/lib/shoot/prompts.ts`
- Create: `src/lib/shoot/prompts.test.ts`

- [ ] **Step 1: テストを先に書く**

商品カラム名の変更を取り違えると価格・金属の表現が壊れるため、ここはテストで固める。

`src/lib/shoot/prompts.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert";
import { buildPrompt } from "./prompts.ts";
import type { Product } from "../types.ts";

const ring = {
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
} as Product;

const design = { theme: "product", goal: "profile", format: "feed" } as const;

test("価格は price_from から作られる", () => {
  const p = buildPrompt(ring, null, [], design, null);
  assert.match(p, /¥4,000〜（税込）/);
});

test("金属不使用の商品では言い切ってよい指示が出る", () => {
  const p = buildPrompt(ring, null, [], design, null);
  assert.match(p, /金属不使用.*言い切/s);
});

test("価格未登録の商品では金額が出ない", () => {
  const noPrice = { ...ring, price_from: null } as Product;
  const p = buildPrompt(noPrice, null, [], design, null);
  assert.equal(/¥[\d,]+/.test(p), false);
});

test("ブランドルールがプロンプトに含まれる", () => {
  const p = buildPrompt(ring, null, [], design, null);
  assert.match(p, /天然木のため/);
});
```

- [ ] **Step 2: 実行して落ちることを確認**

Run: `npm test`
Expected: FAIL（`prompts.ts` が存在しない）

- [ ] **Step 3: `src/lib/shoot/prompts.ts` を作る**

lumiere の `lib/gemini.ts` から**プロンプト組み立て部分のみ**を移す。
対象: `productBlock` / `metalNote` / `backgroundBlock` / `materialBlock` / `designBlock` /
`CAPTION_SPEC` / `FORMAT_SPEC` / `buildPrompt` / `buildCaptionPrompt`

変更点:

- `priceLabel(product.category, product.price_min)` → VSA の `priceLine(product)` を使う
  （`brand.ts` にあり、`price_from` を見る。カテゴリ別フォールバックは廃止し、
  商品マスタに登録された価格だけを唯一の根拠にする）
- `metalNote(product.metal)` → `metalNote(product.metal_type)`。
  中身は `METAL_TYPES[metal_type].rule` を返すだけにして、**分岐の二重管理をやめる**
- `rulesBlock()` → VSA の `buildBrandBlock({ product, purpose })` に置き換える。
  `PostDesign.goal` は `PostPurpose` と同じ4値なので `purpose: design.goal` を渡す
- `THEME_GUIDES` / `GOAL_RULES` / `CTA_LIBRARY` / `HASHTAG_RULES` は
  `src/lib/shoot/prompts.ts` 内に持つ（撮影セクション固有のため `brand.ts` には置かない）。
  ただし `CTA_LIBRARY` は `brand.ts` の `PURPOSES[].ctas` と重複するため、
  **`brand.ts` の `PURPOSES` を参照する**形にして重複を作らない

- [ ] **Step 4: テストを実行**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/shoot/prompts.ts src/lib/shoot/prompts.test.ts
git commit -m "feat: 撮影プランのプロンプト組み立てを移植し brand.ts に接続"
```

---

## Task 16: Gemini 呼び出しを新SDKに統一する

VSA 側の `gemini.ts` は旧SDK（`@google/generative-ai`）、lumiere 側は新SDK（`@google/genai`）。
新SDKに寄せて旧SDKを削除する。

**Files:**
- Modify: `src/lib/gemini.ts`
- Create: `src/lib/shoot/generate.ts`
- Modify: `package.json`

- [ ] **Step 1: 新SDKを入れ、旧SDKを外す**

```bash
npm install @google/genai@^2.10.0
npm uninstall @google/generative-ai
```

- [ ] **Step 2: `src/lib/gemini.ts` を新SDKで書き直す**

外向きの API（`generateText` / `GeminiError`）は変えない。呼び出し側を壊さないため。

```ts
// Gemini API 呼び出し。SDK: @google/genai / 既定モデル: gemini-2.5-flash
// API Key は GEMINI_API_KEY（サーバー専用）から読み込む。
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiError("GEMINI_API_KEY が未設定です。環境変数を設定してください。", 500);
  }
  return key;
}

export function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

export function getModelName(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/** SDK の例外を GeminiError に正規化する。 */
export function toGeminiError(e: unknown): GeminiError {
  if (e instanceof GeminiError) return e;
  const msg = (e as Error).message || "";
  if (/\b429\b|rate limit|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return new GeminiError(
      "Gemini APIのレート制限（無料枠）に達しました。しばらく待ってから再試行してください。",
      429,
    );
  }
  if (/SAFETY|blocked/i.test(msg)) {
    return new GeminiError("生成がブロックされました。テーマや入力内容を見直してください。", 502);
  }
  return new GeminiError(`Gemini APIエラー: ${msg.slice(0, 500)}`, 502);
}

/**
 * Gemini にテキストプロンプトを投げ、生成テキストを返す。
 * レート制限(429)などはステータス付きで GeminiError を投げる。
 */
export async function generateText(
  prompt: string,
  opts?: { temperature?: number },
): Promise<string> {
  try {
    const res = await getClient().models.generateContent({
      model: getModelName(),
      contents: prompt,
      config: { temperature: opts?.temperature ?? 0.9 },
    });
    const text = res.text ?? "";
    if (!text.trim()) {
      throw new GeminiError(
        "Gemini APIから有効な応答が得られませんでした。テーマや入力を見直してください。",
        502,
      );
    }
    return text.trim();
  } catch (e) {
    throw toGeminiError(e);
  }
}
```

- [ ] **Step 3: `src/lib/shoot/generate.ts` を作る**

lumiere の `lib/gemini.ts` から**実行部分**を移す。
対象: `parseGenerateResult` / `parseJson` / `normalize` / `inspectableText` /
`callGemini` / `retryPrompt` / `generatePlan` / `parseCaptionResult` / `generateCaptionFromImages`

変更点:

- `client()` を消して `getClient()` / `getModelName()` を `@/lib/gemini` から使う
- `findViolations` / `violationInstruction` の import 元を `@/lib/brand` に
- `product.metal === "none"` → `product.metal_type === "none"`
- 例外は `toGeminiError` で正規化して投げる（動画側とエラー表示を揃える）

- [ ] **Step 4: 型チェックとビルド**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: すべて成功

Run: `grep -rn "@google/generative-ai" src/`
Expected: 出力なし

- [ ] **Step 5: 動画側の生成が壊れていないことを確認**

Run: `npm run dev`

`/generate` で1回生成し、SDK 差し替えで壊れていないことを確認する。
`/patterns` の型抽出も1回実行する（`generateText` の別の呼び出し口のため）。

- [ ] **Step 6: コミット**

```bash
git add package.json package-lock.json src/lib/gemini.ts src/lib/shoot/generate.ts
git commit -m "feat: Gemini SDK を @google/genai に統一し、撮影側の生成処理を移植"
```

---

## Task 17: 撮影セクションの API を作る

**Files:**
- Create: `src/app/api/shoot/plan/route.ts`
- Create: `src/app/api/shoot/caption/route.ts`
- Create: `src/app/api/shoot/drafts/route.ts`, `src/app/api/shoot/drafts/[id]/route.ts`
- Create: `src/app/api/shoot/backgrounds/route.ts`, `src/app/api/shoot/backgrounds/[id]/route.ts`
- Create: `src/app/api/shoot/materials/route.ts`, `src/app/api/shoot/materials/[id]/route.ts`

- [ ] **Step 1: admin ガードのヘルパを作る**

撮影セクションの API 全部で同じ判定をするため、1箇所にまとめる。
`src/lib/auth.ts` の末尾に追加。

```ts
/**
 * 撮影セクション（管理者専用）のガード。
 * 権限がなければ 403 のレスポンスを返す。null なら通過。
 */
export async function requireAdmin(): Promise<Response | null> {
  const { role } = await getAuth();
  if (role !== "admin") {
    return Response.json({ ok: false, error: "権限がありません" }, { status: 403 });
  }
  return null;
}
```

- [ ] **Step 2: 各 route を作る**

lumiere の `app/api/generate/route.ts` → `src/app/api/shoot/plan/route.ts`、
`app/api/caption/route.ts` → `src/app/api/shoot/caption/route.ts` に移す。

すべての route ハンドラの先頭に以下を入れる。

```ts
  const denied = await requireAdmin();
  if (denied) return denied;
```

下書き・背景素材・木材の CRUD は lumiere では Server Actions またはページ内で
直接データ層を叩いている箇所がある。VSA は `/api/*` + `ok()` / `fail()` の形に
統一されているので、**VSA の既存 route（例: `src/app/api/products/route.ts`）の形に合わせる**。

Next.js のルートハンドラの書き方はバージョンで異なる。
**実装前に `node_modules/next/dist/docs/` の該当ガイドを読むこと**（`AGENTS.md` の指示）。
特に動的セグメント（`[id]`）の params の受け取り方は要確認。

- [ ] **Step 3: 型チェックとビルド**

Run: `npx tsc --noEmit && npm run build`
Expected: 成功

- [ ] **Step 4: 権限を curl で確認**

Run: `npm run dev`

```bash
# 未ログイン → 403
curl -i http://localhost:3000/api/shoot/drafts | head -1
```
Expected: `HTTP/1.1 403 Forbidden`

ブラウザで narrator のパスワードでログインしたあと、同じ URL を開いて 403 になることも確認する。

- [ ] **Step 5: コミット**

```bash
git add src/lib/auth.ts src/app/api/shoot/
git commit -m "feat: 撮影セクションのAPIを追加（admin専用）"
```

---

## Task 18: 撮影セクションの画面を作る

**Files:**
- Create: `src/app/shoot/planner/page.tsx`
- Create: `src/app/shoot/caption/page.tsx`
- Create: `src/app/shoot/drafts/page.tsx`, `src/app/shoot/drafts/[id]/page.tsx`
- Create: `src/app/settings/backgrounds/page.tsx`
- Create: `src/app/settings/materials/page.tsx`
- Create: `src/components/shoot/*.tsx`

- [ ] **Step 1: `@tanstack/react-table` を入れる**

```bash
npm install @tanstack/react-table@^8.21.3
```

- [ ] **Step 2: 共通 UI 部品の差分だけ持ち込む**

VSA の `src/components/ui.tsx` には `CopyButton` / `Spinner` / `ErrorBox` / `Card` / `Button` がある。
lumiere にあって VSA にないものだけを `src/components/ui.tsx` に追記する。

- `Modal` / `EmptyState` / `PageHeader` / `SelectableCard` / `StatusBadge`

lumiere の `CopyButton` は VSA 側と重複するので**持ち込まない**。VSA 側を使う。

- [ ] **Step 3: 画面部品を `src/components/shoot/` に移す**

`Planner.tsx` / `CaptionFromPhoto.tsx` / `DraftCard.tsx` / `DraftDetail.tsx` /
`BackgroundTable.tsx` / `MaterialTable.tsx` を移す。

変更点:
- fetch 先を `/api/shoot/*` に
- 商品の `price_min` / `metal` を参照している箇所を `price_from` / `metal_type` に
- `metalLabel()` の呼び出しを `METAL_TYPES[metal_type].label` に
- VSA の `api` ヘルパ（`src/lib/api.ts`）に合わせる

`ProductTable.tsx` は**移さない**。VSA の `ProductsManager.tsx` を使う。

- [ ] **Step 4: ページを作る**

各ページの先頭で admin 判定を行い、権限がなければ `/login` にリダイレクトする。
判定の書き方は既存の `/editor` や `/narrator` のページに合わせる。

Next.js のリダイレクトと Server Component の書き方は
**`node_modules/next/dist/docs/` を確認してから書くこと**。

- [ ] **Step 5: 型チェックとビルド**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: すべて成功

- [ ] **Step 6: ブラウザで確認**

Run: `npm run dev`

admin でログインして確認すること:
- `/settings/materials` に木材14件が表示される
- `/settings/backgrounds` に背景素材7件が表示される
- `/shoot/drafts` に下書き12件が表示され、商品名が正しく紐づいている（Phase 2 の張り替えの検証）
- `/shoot/planner` で商品・木材・背景を選んで生成でき、結果が保存される
- `/shoot/caption` で写真をアップロードして投稿文が生成される
- 生成された投稿文に送料・minne・地域名・「一点もの」が含まれない

narrator / editor でログインして確認すること:
- `/shoot/*` と `/settings/*` にアクセスできない

- [ ] **Step 7: コミット**

```bash
git add package.json package-lock.json src/components/ src/app/shoot/ src/app/settings/
git commit -m "feat: 撮影セクションの画面を追加（admin専用）"
```

---

## Task 19: `@supabase/ssr` を持ち込んでいないことを確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 依存に混入していないことを確認**

Run: `grep -rn "@supabase/ssr" src/ package.json`
Expected: 出力なし

混入していれば `getSupabase()` に置き換え、`npm uninstall @supabase/ssr` する。

- [ ] **Step 2: main にマージ**

```bash
git checkout main
git merge --no-ff feat/lumiere-integration -m "Phase 3: 撮影機能を移植"
git checkout feat/lumiere-integration
```

---

# Phase 4: 仕上げ

## Task 20: ナビゲーションを3セクションに再編

**Files:**
- Modify: `src/components/NavBar.tsx:9-18`

- [ ] **Step 1: リンク定義を役割ごとに分ける**

```tsx
const videoLinks = [
  { href: "/", label: "動画" },
  { href: "/generate", label: "生成" },
  { href: "/scripts", label: "お手本" },
  { href: "/patterns", label: "型" },
  { href: "/history", label: "履歴" },
];

// 撮影セクションは管理者専用
const shootLinks = [
  { href: "/shoot/planner", label: "撮影プラン" },
  { href: "/shoot/caption", label: "写真から投稿文" },
  { href: "/shoot/drafts", label: "下書き" },
];

const otherLinks = [
  { href: "/narrator", label: "ナレーター" },
  { href: "/editor", label: "動画編集" },
  { href: "/settings", label: "設定" },
];
```

- [ ] **Step 2: role に応じて出し分ける**

`links` を組み立てる箇所を以下にする。

```tsx
  const links =
    role === "admin"
      ? [...videoLinks, ...shootLinks, ...otherLinks]
      : [...videoLinks, ...otherLinks];
```

タイトルの `🎬 動画マネージャー` は、撮影も扱うようになったので
`🎬 cloud9 コンテンツ` に変える。

- [ ] **Step 3: ブラウザで確認**

Run: `npm run dev`

- admin: 動画5＋撮影3＋その他3のリンクが出る
- narrator: 撮影リンクが出ない
- editor: 撮影リンクが出ない

- [ ] **Step 4: コミット**

```bash
git add src/components/NavBar.tsx
git commit -m "feat: ナビを動画・撮影・設定の3セクションに再編"
```

---

## Task 21: ドキュメントを更新

**Files:**
- Modify: `README.md`
- Modify: `.env.local.example`

- [ ] **Step 1: README に撮影セクションを追記**

以下を反映する。

- アプリの説明を「TikTok台本ジェネレーター」から、動画と撮影の両方を扱うものに変える
- 使い方に撮影セクションのフロー（撮影プラン → 下書き → 投稿）を追加
- ブランドルールの節に、ルールが `src/lib/brand.ts` の1ファイルに集約されていること、
  lumiere から統合したことを書く
- テストの実行方法（`npm test`）を書く。**このリポジトリで初めてテストが入るため、
  存在に気づいてもらう必要がある**
- 統合されたテーブル一覧（`lumiere_*` の3つを含む）を書く

- [ ] **Step 2: `.env.local.example` のコメントを直す**

`# Supabase（handmade-shipping-manager と同じプロジェクト / サーバー専用）` の記述は
そのままでよいが、lumiere との共用が解消されたことがわかるように整理する。

- [ ] **Step 3: コミット**

```bash
git add README.md .env.local.example
git commit -m "docs: 統合後の構成に README を更新"
```

---

## Task 22: lumiere の停止

**Files:** なし（外部操作）

**このタスクは取り消しが効かない操作を含む。前のタスクまでが本番で動いていることを
確認してから実行すること。**

- [ ] **Step 1: 統合後のアプリを本番にデプロイして動作確認**

Vercel の本番デプロイで、動画・撮影の両セクションが動くことを確認する。
特に撮影セクションは本番の Supabase を見るため、下書き12件が正しく出ることを確認する。

- [ ] **Step 2: lumiere の Vercel プロジェクトを削除**

Vercel ダッシュボードから削除する。**Step 1 が完了してから行う。**

- [ ] **Step 3: lumiere リポジトリをアーカイブ**

```bash
cd /Users/toru/code/lumiere
git checkout main
git commit --allow-empty -m "chore: video-script-app に統合したためアーカイブ"
```

GitHub 上のリポジトリを Archived にする。ローカルは残しておく（移植漏れの参照用）。

- [ ] **Step 4: main にマージ**

```bash
cd /Users/toru/code/video-script-app
git checkout main
git merge --no-ff feat/lumiere-integration -m "Phase 4: ナビ再編とドキュメント更新、lumiere を停止"
```

---

## 全体の受け入れ条件

- [ ] `npm test` が通る
- [ ] `npx tsc --noEmit` が通る
- [ ] `npm run build` が通る
- [ ] `grep -rn "@google/generative-ai\|@supabase/ssr\|hypoallergenic\|lumiere_products" src/` が空
- [ ] admin で動画・撮影の両セクションが使える
- [ ] narrator / editor で撮影セクションが見えない・叩けない
- [ ] 動画生成と撮影プラン生成の両方で、送料・minne・地域名・「一点もの」が出力に含まれない
- [ ] ブランドルールを変更するとき、直すファイルが `src/lib/brand.ts` の1つだけである
