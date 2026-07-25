# TikTok台本ジェネレーター

過去の自分のTikTok動画（タイトル・台本・ストーリー）を**お手本**にして、新テーマに対して「同じ流れ・雰囲気」を踏襲した新しい**タイトル・台本・ストーリー**を、**ナレーター単位**で生成するアプリ。

- ナレーターは登録制（設定画面で追加・編集・並び替え・無効化）。動画ごとに1人を選ぶ
- ナレーターごとに型抽出・生成を行い、他のナレーターと混ぜない
- LLM は Gemini API（無料枠 Flash 系）。**API Key はサーバーサイドのみ**で使用
- ストーリーは Flow 等の AI 動画生成への入力用

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

## 使い方（推奨フロー）

1. **設定** … ナレーターを追加・編集（初期2人あり）
2. **お手本** … ナレーターを選び、過去動画の タイトル / 台本 / ストーリー を登録
3. **型** … ナレーターごとに「型」を抽出（任意。本数が増えたら推奨。トークン節約＆一貫性向上）
4. **生成** … ナレーターを選び、テーマを「自分で入力」or「提案してもらう」→ 生成。3ブロック（タイトル / 台本 / ストーリー）をコピー
5. **履歴** … 過去の生成を確認・お気に入り・削除

> 型が未抽出の場合は、お手本全件を直接プロンプトに渡して生成します（Phase 3 相当）。

## ブランドルール（cloud9woodwork）

ナレーターの「型」とは別に、**ブランド側のルール**を全生成に注入している。定義は [`src/lib/brand.ts`](./src/lib/brand.ts) の1ファイルに集約してあり、Instagram改善レポートの確定事項が変わったらここだけを直す。

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

すべて Gemini / Supabase の鍵はサーバーサイドのみで使用。

## デプロイ（Vercel）

1. リポジトリを Vercel に接続
2. 環境変数（`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `GEMINI_API_KEY` / `GEMINI_MODEL`）を登録
3. デプロイ

## 留意点

- ナレーター同士は最後まで混ぜない（DB絞り込み→型→プロンプト→生成まで `narrator_id` で一貫分岐）
- Gemini 無料枠のレート制限に注意（429 はエラー表示してリトライを促す）
- 現行のレート制限・無料枠条件は運用前に公式で確認
