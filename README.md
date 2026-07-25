# cloud9 コンテンツマネージャー

木材工房cloud9（cloud9woodwork）の SNS 運用アプリ。**動画**と**撮影**の2セクションからなる。

| セクション | できること | 権限 |
|---|---|---|
| **動画** | 過去のTikTok動画をお手本に、タイトル・台本・ストーリー・各SNSの投稿文をナレーター単位で生成。制作進行も管理 | admin / narrator / editor |
| **撮影** | 商品×木材×背景素材から撮影プラン（構図・ライティング）と投稿文を生成。写真から投稿文を作る逆方向フローも | **admin のみ** |

両セクションは**商品マスタとブランドルールだけを共有**し、機能は分けている。

- ナレーターは登録制（設定画面で追加・編集・並び替え・無効化）。動画ごとに1人を選ぶ
- ナレーターごとに型抽出・生成を行い、他のナレーターと混ぜない
- LLM は Gemini API（無料枠 Flash 系）。**API Key はサーバーサイドのみ**で使用
- ストーリーは Flow 等の AI 動画生成への入力用

> 撮影セクションは 2026-07-25 に別リポジトリ `lumiere` から統合した。
> 設計と経緯は [`docs/superpowers/specs/2026-07-25-lumiere-integration-design.md`](./docs/superpowers/specs/2026-07-25-lumiere-integration-design.md) を参照。

## 技術スタック

| 領域 | 採用 |
|---|---|
| フロント / API | Next.js 16（App Router） |
| DB | Supabase（Postgres） |
| ホスティング | Vercel |
| LLM | Gemini API（gemini-2.0-flash 等） |

## セットアップ

### 1. Supabase

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. SQL Editor で [`supabase/schema.sql`](./supabase/schema.sql) を実行（テーブル作成 + 初期ナレーター2人投入）
3. Project Settings → API から `URL` と `service_role` キーを取得

### 2. Gemini API

1. [Google AI Studio](https://aistudio.google.com/app/apikey) で API キーを取得（無料枠）

### 3. 環境変数

`.env.local.example` を `.env.local` にコピーして値を設定：

```bash
cp .env.local.example .env.local
```

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash   # 任意
```

### 4. 起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開く。

### 5. テスト

```bash
npm test
```

`node --test` を使う（テストランナーの依存追加はなし）。Node 22 以上が必要。
対象は純関数のみ（`src/lib/**/*.test.ts`）で、ブランドルールの検査とプロンプト組み立てを守っている。

> `src/lib/` 配下は Node から直接実行するため、相対 import に `.ts` 拡張子を付ける。
> `@/` エイリアスは Node が解決できないので使わない（画面側では使ってよい）。

## 使い方

### 動画

1. **設定** … ナレーターと商品を追加・編集
2. **お手本** … ナレーターを選び、過去動画の タイトル / 台本 / ストーリー を登録
3. **型** … ナレーターごとに「型」を抽出（任意。本数が増えたら推奨。トークン節約＆一貫性向上）
4. **生成** … ナレーター・商品・投稿の目的を選び、テーマを入力 or 提案 → 生成
5. **履歴** … 過去の生成を確認・お気に入り・削除

> 型が未抽出の場合は、お手本全件を直接プロンプトに渡して生成します。

### 撮影（admin のみ）

1. **設定** … 商品・木材・背景素材を登録
2. **撮影プラン** … 投稿設計（テーマ / 目的 / 形式）→ 商品 → 木材 → 背景素材 を選んで生成。結果は未投稿の下書きとして保存される
3. **下書き** … 投稿文とハッシュタグを編集、投稿済みに切り替え、まとめてコピー
4. **写真から投稿文** … 撮り終えた写真をアップロードして投稿文だけを作る（逆方向フロー）

## ブランドルール（cloud9woodwork）

ナレーターの「型」とは別に、**ブランド側のルール**を全生成に注入している。定義は [`src/lib/brand.ts`](./src/lib/brand.ts) の1ファイルに集約してあり、Instagram改善レポートの確定事項が変わったらここだけを直す。

**動画・撮影の両セクションがこの1ファイルを見る。** 以前は lumiere 側に別のルール定義があり、送料・minne・ハッシュタグ数などで食い違っていた。統合時に厳しい側（lumiere）へ寄せて1本化した。

検査の出口は2つあるが、ルール表 `NG_RULES` は共通。

| 関数 | 使う場面 |
|---|---|
| `findViolations()` | 撮影セクション。違反を検出したら Gemini に1度だけ書き直させる |
| `checkBrand()` | 動画セクション。生成結果の画面に警告として出す |

- **投稿の目的**（保存 / シェア（送信） / プロフィールアクセス / 非フォロワーリーチ）… 生成画面で選ぶ。台本の狙い・公式CTA・テーマ候補の柱がまとめて切り替わる
- **公式CTA**… 目的ごとに決まった文言を一字一句そのまま使わせる
- **検索キーワード**… Instagramキャプションの1行目に必ず入れる（検索面対策）
- **ハッシュタグ**… ブランド／商品／ギフト／コミュニティの4群から本数指定。`#cloud9` 単体は禁止
- **禁止表現**… 「一点もの」「全商品が金属不使用」「誇張・セール文句」「URL・パス表記」「ラッピング」「クリスタルを宝石と書く」など。正しい言い換えとセットで定義
- **確定した事実**（`FACTS`）… 納期・送料・付属品・サイズ・お手入れ。**ここに無いことは書かせない**
- **価格**… 商品マスタの `price_from`（最低価格・税込）がある商品だけ「¥4,000〜（税込）」形式で書かせる。未登録なら金額に触れさせない
- **金属の分類**… 商品マスタの `metal_type` で商品ごとに言えることが変わる（下表）
- **リール構成**… ストーリー欄は `0-3秒 / 3-15秒 / 15-25秒 / 締め` の秒数区切りで、各区間にテキストオーバーレイを指定させる

| `metal_type` | 該当商品 | 書いてよい表現 |
|---|---|---|
| `none` | 指輪・クリスタルウッドリング・バングル・イヤーカフ | 「金属不使用」と言い切ってよい |
| `hypoallergenic` | ピアス・イヤリング | 「金属アレルギー対応パーツを使用。樹脂フックやイヤリングへの変更もできます」 |
| `metal` | ネクタイピン・カフス・ネックレス | 「金属不使用」「金属アレルギー対応」は書けない |

生成結果は [`src/lib/brandCheck.ts`](./src/lib/brandCheck.ts) で機械的に検査し、違反を生成画面に警告として表示する（生成自体は止めない）。

> **販路について**: Instagram のプロフィールに貼るリンクは**自社サイトと Creema の2つ**。誘導先は Creema に寄せるが、minne・BASE でも販売しているため投稿文で触れても警告にはならない。

## API

| エンドポイント | メソッド | 役割 |
|---|---|---|
| `/api/narrators` | GET / POST / PATCH / DELETE | ナレーターの一覧・追加・編集・無効化 |
| `/api/scripts` | GET / POST / PATCH / DELETE | お手本の取得・登録・編集・削除（`?narrator_id=` で絞り込み） |
| `/api/patterns` | GET | ナレーターの最新の型 |
| `/api/patterns/extract` | POST | `{ narrator_id }` で型抽出・保存 |
| `/api/themes/suggest` | POST | `{ narrator_id }` でテーマ候補 |
| `/api/generate` | POST | `{ narrator_id, theme }` で生成 |
| `/api/generations` | GET / PATCH / DELETE | 生成履歴・お気に入り・削除 |
| `/api/products` | GET / POST / PATCH / DELETE | 商品マスタ（動画・撮影で共有） |
| `/api/shoot/plan` | POST | 撮影プラン＋投稿文を生成 |
| `/api/shoot/caption` | POST | 写真から投稿文を生成（画像入力） |
| `/api/shoot/drafts` | GET / POST / PATCH / DELETE | 下書き（`?id=` で単一・削除） |
| `/api/shoot/backgrounds` | GET / POST / PATCH / DELETE | 背景素材マスタ |
| `/api/shoot/materials` | GET / POST / PATCH / DELETE | 木材マスタ |

`/api/shoot/*` はすべて `requireAdmin()` で管理者のみに制限している。
すべて Gemini / Supabase の鍵はサーバーサイドのみで使用。

## テーブル

| テーブル | 用途 |
|---|---|
| `vsg_narrators` / `vsg_scripts` / `vsg_patterns` / `vsg_generations` / `vsg_videos` | 動画セクション |
| `vsg_products` | 商品マスタ（**両セクションで共有**） |
| `lumiere_backgrounds` / `lumiere_materials` / `lumiere_drafts` | 撮影セクション |

`lumiere_*` は統合元のテーブル名をそのまま使っている（リネームは移行事故のリスクだけ増えるため）。
同じ Supabase プロジェクトを他アプリと共有しているので、テーブル名の接頭辞で分離している。

## デプロイ（Vercel）

1. リポジトリを Vercel に接続
2. 環境変数（`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `GEMINI_API_KEY` / `GEMINI_MODEL`）を登録
3. デプロイ

## 留意点

- ナレーター同士は最後まで混ぜない（DB絞り込み→型→プロンプト→生成まで `narrator_id` で一貫分岐）
- 動画と撮影は混ぜない。共有するのは商品マスタと `brand.ts` だけ（`src/lib/shoot/` から動画側を参照しない。逆も同じ）
- 権限は proxy（`src/proxy.ts`）と各 route handler の二重で担保する。片方だけに頼らない
- Gemini 無料枠のレート制限に注意（429 はエラー表示してリトライを促す）
- 現行のレート制限・無料枠条件は運用前に公式で確認
