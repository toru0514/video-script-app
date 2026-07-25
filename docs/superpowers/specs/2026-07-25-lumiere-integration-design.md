# lumiere 統合 設計

作成日: 2026-07-25

## 1. 背景と目的

`video-script-app`（動画台本ジェネレーター）と `lumiere`（撮影プラン＆投稿文生成）は、どちらも
木材工房cloud9（cloud9woodwork）の Instagram 運用を支えるアプリで、同じブランドルールを参照する。
そのルールが2つのリポジトリに別々のコードとして存在するため、運用方針が変わるたびに
2箇所を別の書き方で直す必要があり、実際にすでに食い違っている。

**目的は二重管理の解消。** 動画と撮影という機能の分離は維持したまま、1つのアプリに統合する。

### 1.1 現時点で矛盾しているルール

同じ出典（フェーズ3確定版・商品マスタ_Creema_2026-07-25）から分岐したにもかかわらず、以下が食い違う。

| 項目 | video-script-app | lumiere |
|---|---|---|
| 送料 | 「送料無料（価格に含みます）」と書いてよい事実（`src/lib/brand.ts:36`） | 「送料には触れない」＋ `/送料無料｜送料込み/` を違反として検出（`lib/brand.ts:228`） |
| minne | 「触れても構わない」（`src/lib/brand.ts:337`） | `/minne｜ミンネ/` を違反として検出（`lib/brand.ts:243`） |
| ハッシュタグ数 | 最大7個（ブランド1＋商品2-3＋ギフト0-2＋コミュニティ0-1） | 3〜5個「数を増やさない運用方針」 |
| 地域名（愛知） | ルールなし | 禁止（`lib/brand.ts:260`） |
| 情緒過多・広告調 | ルールなし | 禁止（`lib/brand.ts:96`） |
| ブランド名表記 | ルールなし | 「Cloud9」「クラウドナイン」禁止（`lib/brand.ts:256`） |
| 価格の粒度 | 商品マスタの `price_from` のみ。未登録なら金額禁止 | 木材別の実額表をハードコード |
| 金属分類の値 | `none` / `hypoallergenic` / `metal` | `none` / `resin_option` / `metal` / `unknown` |

同一の生成文が、片方では合格し片方では違反になる状態にある。

### 1.2 決定事項

- **母艦は `video-script-app`。** `lumiere` を機能として取り込み、リポジトリはアーカイブする。
- **撮影セクションは admin 専用。** ナレーター・編集者には見せない。
- **ブランドルールは lumiere 側を正とする。** コミット履歴上そちらが新しく、かつ厳しい側に寄せるほうが安全。

### 1.3 スコープ外

- 動画と撮影の機能的な統合（下書きと動画管理を1つの「投稿」概念にまとめる等）。分けたまま維持する。
- 撮影セクションへの権限分け（admin 専用と決まったため不要）。
- `vsg_backgrounds` 等へのテーブル名リネーム。移行事故のリスクだけ増えて得がない。

## 2. 現状の把握

### 2.1 共通している前提

| | video-script-app | lumiere |
|---|---|---|
| Next.js / React | 16.2.9 / 19.2.4 | 同じ |
| Supabase プロジェクト | `fyuegurlchnrdtyvonxx` | 同一（`vsg_` / `lumiere_` で分離） |
| Gemini | 同一キー | 同一キー |
| Tailwind | v4 | v4 |
| コード規模 | 42ファイル / 5,712行 | 42ファイル / 4,282行 |

同一 Supabase プロジェクトを既に共有しているため、データ統合にプロジェクト間移送は発生しない。
また `lumiere` は画像機能を撤去済み（`d356255 refactor: remove image handling entirely`）で
Supabase Storage への参照がゼロのため、移行対象はテキストデータのみ。

### 2.2 テーブル現況（本番実測）

| テーブル | 行数 | 統合後 |
|---|---|---|
| `vsg_narrators` | 2 | そのまま |
| `vsg_scripts` | 27 | そのまま |
| `vsg_patterns` | 2 | そのまま |
| `vsg_generations` | 24 | そのまま |
| `vsg_videos` | 46 | そのまま |
| `vsg_products` | 9 | **統合先（正）** |
| `lumiere_products` | 8 | `vsg_products` へ移行後 drop |
| `lumiere_backgrounds` | 7 | 名前そのまま流用 |
| `lumiere_materials` | 14 | 名前そのまま流用 |
| `lumiere_drafts` | 12 | 名前そのまま流用（`product_id` を張り替え） |

**注意:** `vsg_products` は `supabase/schema.sql` に定義がなく本番DBにのみ存在する意図的な
スキーマ drift（`supabase/schema.sql:82-88`, `:111-113` に注記あり）。統合を機に定義を
`schema.sql` へ書き戻す。

### 2.3 商品マスタの突合結果

2つの商品マスタは中身がほぼ同一だった。価格と金属分類は**全商品で一致**し、
差分は商品名の揺れ2件と VSA のみに存在する1件だけ。

| 商品名（vsg） | 商品名（lumiere） | 価格 | 金属 |
|---|---|---|---|
| 木の指輪 | 木の指輪 | 4,000 | none |
| クリスタルウッドリング | クリスタルウッドリング | 8,000 | none |
| 木のイヤーカフ | 木のイヤーカフ | 2,500 | none |
| 木のバングル | 木のバングル | 11,000 | none |
| 木のピアス | 木のピアス | 2,500 | hypoallergenic ↔ resin_option |
| 木のネックレス | 木のネックレス | 5,000 | metal |
| 木のカフス | **カフス** | 3,500 | metal |
| 木のネクタイピン | **ネクタイピン** | 3,500 | metal |
| 木のイヤリング | （なし） | 2,500 | hypoallergenic |

`hypoallergenic` と `resin_option` は同じ概念の呼称違い。商品名でマッピングでき、
名前の揺れ2件のみ手当てすれば移行できる。

## 3. 統合後の構成

### 3.1 ナビゲーション

動画と撮影は混ぜない。共有するのは商品マスタと `brand.ts` の2つだけ。

| セクション | 画面 | 権限 |
|---|---|---|
| **動画** | 生成 / 履歴 / お手本 / 型 / 動画一覧 | admin・narrator・editor（現状維持） |
| **撮影** | 撮影プラン / 写真から投稿文 / 下書き | admin のみ |
| **設定** | 商品 / 背景素材 / 木材 / ナレーター | admin のみ |

### 3.2 認証

既存の仕組みをそのまま使う。撮影セクションの各ページと API で `getAuth()` の
`role !== "admin"` を弾く。新しいロールは作らない。

`lumiere` は `@supabase/ssr` に依存しているが、実際の使い方はサーバー専用であり
VSA の service role クライアント（`src/lib/supabase.ts`）で置き換えられる。依存ごと削除する。

### 3.3 デプロイ

Vercel プロジェクトは `video-script-app` の1つに畳む。`lumiere` のプロジェクトは
統合完了を確認したのちに削除する。

## 4. データ設計

### 4.1 `vsg_products` の拡張

lumiere 側のカラムを吸収する。

```sql
alter table public.vsg_products
  add column if not exists category text,
  add column if not exists material text,
  add column if not exists size_range text;
```

`category` は `lumiere_products` では NOT NULL だが、`vsg_products` では
既存9行に値がないため nullable とする。移行時に埋めたうえで、
アプリ側の商品登録フォームでは必須入力にする。

### 4.2 金属分類の統一

lumiere 側の4値を正とする。

| 値 | 意味 | 対象商品 |
|---|---|---|
| `none` | 金属不使用。「金属不使用」と言い切ってよい | 指輪・クリスタルウッドリング・バングル・イヤーカフ |
| `resin_option` | 金属アレルギー対応パーツ使用。樹脂フック／イヤリング変更可 | ピアス・イヤリング |
| `metal` | 金属パーツ使用。「金属不使用」と書かない | ネクタイピン・カフス・ネックレス |
| `unknown` | 未確認。商品固有の断定をさせない | — |

```sql
update public.vsg_products set metal_type = 'resin_option' where metal_type = 'hypoallergenic';
update public.vsg_products set metal_type = 'unknown' where metal_type is null;
alter table public.vsg_products alter column metal_type set default 'unknown';
```

TypeScript 側の `MetalType` も `"none" | "resin_option" | "metal" | "unknown"` に変更する。
`METAL_TYPES` の `hypoallergenic` キーをリネームし、`unknown` を追加する。

### 4.3 商品データの移行

商品名でマッピングする。名前の揺れ2件は lumiere 側の名前を vsg 側に合わせてから突合する。

```sql
-- 1. 名前の揺れを解消
update public.lumiere_products set name = '木のカフス'       where name = 'カフス';
update public.lumiere_products set name = '木のネクタイピン' where name = 'ネクタイピン';

-- 2. vsg_products に不足カラムの値を移す
update public.vsg_products v
set category   = l.category,
    material   = coalesce(v.material, l.material),
    size_range = coalesce(v.size_range, l.size_range)
from public.lumiere_products l
where v.name = l.name;

-- 3. lumiere_drafts の参照を張り替え
alter table public.lumiere_drafts drop constraint if exists lumiere_drafts_product_id_fkey;
update public.lumiere_drafts d
set product_id = v.id
from public.lumiere_products l
join public.vsg_products v on v.name = l.name
where d.product_id = l.id;
alter table public.lumiere_drafts
  add constraint lumiere_drafts_product_id_fkey
  foreign key (product_id) references public.vsg_products(id) on delete set null;
```

**検証（drop の前に必ず実行する）:**

- `lumiere_products` の全8行が `vsg_products` に名前一致すること
- 張り替え後、`lumiere_drafts` に `vsg_products` を参照しない `product_id` が残っていないこと
- `vsg_products` の `category` が9行すべて埋まっていること（「木のイヤリング」は手動で `earring` を設定）

検証を通ってから `drop table public.lumiere_products;` を実行する。

### 4.4 流用するテーブル

`lumiere_backgrounds` / `lumiere_materials` / `lumiere_drafts` は名前も定義も変更しない。
`src/lib/supabase.ts` の `T` に追記する。

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

## 5. `brand.ts` の1本化

統合の中核。`src/lib/brand.ts` を唯一の定義とし、`lumiere/lib/brand.ts` は廃止する。

### 5.1 lumiere から採用するもの（＝新しい運用方針）

- 送料に触れない（VSA の `FACTS` から送料の行を削除し、NGルールに追加）
- minne を導線に出さない（VSA の購入導線の記述を修正し、NGルールに追加）
- 地域名（愛知・名古屋等）を使わない
- 情緒過多・広告調の禁止（「静かに佇む」「上質な」「〜をあなたに」等）
- ブランド名表記の統一（「Cloud9」「クラウドナイン」不可、「木材工房cloud9」に統一）
- 安さ訴求の禁止（「お手頃」「リーズナブル」等）
- 発送・サイズ直し・修理に関する断定の禁止
- ハッシュタグは3〜5個
- 木材別の実額表（`PRICE_GUIDE`）

### 5.2 VSA から残すもの（＝lumiere にない機能）

- 商品マスタ連動の金属分類（`METAL_TYPES` + `buildBrandBlock`）。商品ごとに書けることが変わる
- 商品連動の価格制御（`priceLine`）。`price_from` 未登録なら金額を一切書かせない
- 検索キーワードのキャプション1行目強制（`SEARCH_KEYWORDS`）
- 目的別の公式CTA
- コンテンツ5本柱（`PILLARS`）

### 5.3 CTA と目的の統合

両者のキーは `save` / `share` / `profile` / `reach` で一致しており、CTA の文面もほぼ同一。
以下の対応で1つにまとめる。

| VSA | lumiere | 統合後 |
|---|---|---|
| `PURPOSES[].aim` | `GOAL_RULES` | `PURPOSES[].aim` に lumiere の情報制約（価格に触れる／触れない）を追記 |
| `PURPOSES[].ctas` | `CTA_LIBRARY` | 和集合。表記が違う2件（`reach` の「制作の様子は〜」）は lumiere 側に統一 |

lumiere の `THEME_GUIDES`（テーマ別の書き方ガイド）は撮影セクション固有のため、
`brand.ts` ではなく撮影側のプロンプトモジュールに置く。

### 5.4 価格の扱い

商品マスタの `price_from` を第一の根拠とする。木材まで特定して価格に触れる場合のみ
`PRICE_GUIDE`（木材別の実額表）を参照させる。この表は商品マスタの粒度（商品カテゴリ単位）
では表現できないため、当面テキスト定数として残す。

### 5.5 検査ロジックの統合

両アプリに違反検出があるが、**同じルール表を別々の用途で使っているだけ**。
ルール表を1つにし、出口を2つ用意する。

```
NG_RULES（統合したルール表）
  ├─ findViolations(text, metalFree) → 再生成の指示文に回す（撮影側の既存フロー）
  └─ checkBrand({result, product, purpose}) → 画面に警告表示（動画側の既存フロー）
```

`checkBrand` が固有に持つ検査（金属分類との矛盾、価格の一致、1行目の検索キーワード、
ブランドタグ、公式CTAの使用）はそのまま残す。
`findViolations` の `exemptWhenMetalFree`（商品が金属不使用なら金属表現を免除）は、
商品マスタの `metal_type === "none"` から自動判定できるようになるため、引数ではなく
商品オブジェクトから導出する形に変える。

### 5.6 媒体差

ハッシュタグ本数などのルールは全媒体に lumiere 基準を適用する。
ただしリール構成ルール（`REEL_RULE`：秒数区切り・テキストオーバーレイ）は動画生成にのみ注入する。
これは媒体差ではなく機能差。

## 6. 移植する機能

`lumiere` から持ち込むもの。

| 機能 | 元ファイル | 移植先 |
|---|---|---|
| 撮影プランナー | `components/Planner.tsx`, `app/api/generate` | `src/app/shoot/planner`, `src/app/api/shoot/plan` |
| 写真から投稿文 | `components/CaptionFromPhoto.tsx`, `app/api/caption` | `src/app/shoot/caption`, `src/app/api/shoot/caption` |
| 下書き一覧・詳細 | `app/drafts`, `components/DraftCard.tsx`, `DraftDetail.tsx` | `src/app/shoot/drafts` |
| 背景素材マスタ | `app/settings/backgrounds`, `components/BackgroundTable.tsx` | `src/app/settings/backgrounds` |
| 木材マスタ | `app/settings/materials`, `components/MaterialTable.tsx` | `src/app/settings/materials` |
| 投稿設計ロジック | `lib/postPlan.ts` | `src/lib/postPlan.ts` |

商品マスタ画面は VSA 側の `ProductsManager.tsx` を残し、lumiere の `ProductTable.tsx` は破棄する。
ただし `category` / `material` / `size_range` の入力欄を `ProductsManager` に追加する。

共通 UI（`Modal`, `CopyButton`, `EmptyState`, `PageHeader`, `SelectableCard`, `StatusBadge`）は
VSA の `src/components/ui.tsx` と重複を確認したうえで、不足分だけ持ち込む。

## 7. 依存の整理

| パッケージ | 対応 |
|---|---|
| `@google/genai` (^2.10.0) | **これに統一。** lumiere 側の新SDK |
| `@google/generative-ai` (^0.21.0) | 削除。VSA の `src/lib/gemini.ts` を新SDKへ書き換える |
| `@supabase/ssr` (^0.12.0) | 削除。service role クライアントに寄せる |
| `@tanstack/react-table` (^8.21.3) | 追加。撮影側マスタ画面が使用 |
| `eslint` / `eslint-config-next` | 追加。lumiere 側にのみ設定があるため取り込む |

`next` / `react` / `react-dom` / `tailwindcss` はバージョンが一致しており作業不要。

## 8. 移行の順序

各段階の終わりにアプリが動く状態を保つ。段階ごとにブランチを切り、動作確認してから main へマージする。

### Phase 1: `brand.ts` の1本化

VSA 単体で完結する。ここだけで二重管理の痛みの大半が消える。

1. lumiere のルールを `src/lib/brand.ts` に取り込む（5.1〜5.4）
2. `NG_RULES` を統合し、`findViolations` を追加（5.5）
3. `checkBrand` を新しいルール表の上に載せ替える
4. 既存の生成を数件流し、警告の出方が意図どおりか確認する

**確認:** 送料・minne・地域名・情緒過多の表現が警告として検出されること。既存の生成が壊れないこと。

### Phase 2: 商品マスタの統合

1. `vsg_products` にカラム追加（4.1）
2. `metal_type` を4値へ変更、アプリ側の型も変更（4.2）
3. データ移行と検証、`lumiere_products` の drop（4.3）
4. `vsg_products` の定義を `supabase/schema.sql` へ書き戻す（2.2 の drift 解消）
5. `ProductsManager` に `category` / `material` / `size_range` の入力欄を追加

**確認:** 商品9件が正しく表示・編集できること。動画生成の金属・価格ルールが従来どおり効くこと。

### Phase 3: 撮影機能の移植

1. `T` に3テーブルを追加（4.4）
2. `src/app/shoot/` 以下に画面と API を移植（第6章）
3. 各ページ・API に admin 判定を入れる（3.2）
4. Gemini SDK を `@google/genai` へ統一、`@supabase/ssr` を削除（第7章）

**確認:** 撮影プラン生成・写真から投稿文・下書き12件の表示が動くこと。narrator / editor でログインして撮影セクションが見えないこと。

### Phase 4: 仕上げ

1. ナビを3セクションに再編（3.1）
2. README を統合後の内容に更新
3. `lumiere` の Vercel プロジェクトを削除、リポジトリをアーカイブ

**確認:** 動画・撮影の両セクションが1つのデプロイで動くこと。

## 9. リスクと対策

| リスク | 対策 |
|---|---|
| 商品データ移行でドラフトの参照が切れる | 4.3 の検証3項目を drop 前に必ず実行。drop は最後 |
| `metal_type` のリネーム漏れで金属表現が誤る | 型を union に絞り、`METAL_TYPES` のキーと DB の値を一致させる。TypeScript のコンパイルエラーで検出させる |
| ブランドルール統合で既存の生成品質が落ちる | Phase 1 完了時点で既存の生成を数件流し、警告の出方を目視確認する |
| `vsg_products` のスキーマ drift | Phase 2 で `schema.sql` に定義を書き戻す |
| Gemini SDK 移行で生成が壊れる | Phase 3 で SDK 移行と機能移植を同じブランチで行い、両方の生成を通してから main へ入れる |

## 10. 実装時の注意

このプロジェクトの Next.js は既知のバージョンと API が異なる可能性がある。
コードを書く前に `node_modules/next/dist/docs/` の該当ガイドを読むこと（`AGENTS.md` の指示）。
