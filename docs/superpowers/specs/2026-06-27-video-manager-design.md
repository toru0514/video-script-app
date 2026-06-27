# 台本ジェネレーター → 動画マネージャー 設計仕様

- 日付: 2026-06-27
- ステータス: 承認済み（実装計画待ち）

## 背景と目的

現状アプリは「TikTok台本ジェネレーター」で、トップページ(`/`)が台本生成フォームになっている。これを **動画の管理アプリ** に作り替える。台本生成は管理アプリの一機能という位置づけに変える。

トップページを **動画のTODOリスト** にし、各動画の制作進行を3つの軸（ナレーション・動画生成・動画公開）で管理する。生成をきっかけに動画が自動でTODOに追加される。

## スコープ

### 含むもの
- 新テーブル `vsg_videos` の追加
- 生成成功時に動画レコードを自動作成
- 新トップページ（動画TODOリスト）
- 動画詳細ページ `/videos/[id]`
- 動画CRUD用APIルート
- 既存の生成フォームを `/generate` へ移動、ナビ再編

### 含まないもの（YAGNI）
- 動画の手動作成（生成経由のみ）— 将来 `vsg_videos` 独立により拡張可能
- 1生成から複数動画の作成
- 新しいテスト基盤の導入（本リポジトリに既存のテスト基盤が無いため踏襲）
- 動画背景の新規生成機能（「動画背景」＝既存の story フィールドを指すため不要）

## ドメインモデル

### ステータス構造
動画1件は3種類の独立したステータスを持つ。順序は目安だが**強制しない**（独立して変更可能）。

| 軸 | コード値 | 日本語ラベル |
|---|---|---|
| ナレーション (narration_status) | `not_requested` / `recording` / `done` | 未依頼 / 録り待ち / 完了 |
| 動画生成 (video_status) | `not_requested` / `rendering` / `done` | 未依頼 / 待ち / 完了 |
| 動画公開 (publish_status) | `unpublished` / `published` | 未公開 / 公開済み |

**「未着手」は派生状態**であり保存しない。3ステータスすべてが初期値
（`narration_status='not_requested'` かつ `video_status='not_requested'` かつ `publish_status='unpublished'`）
のとき、UI上で「未着手」バッジを表示する。

各ステータスは初期値（デフォルト）の状態から、ユーザーが任意のタイミングで個別に変更できる。前段の完了を前提とするロック等は設けない。

## データモデル

### 新規テーブル `vsg_videos`

```sql
create table if not exists public.vsg_videos (
  id               uuid primary key default gen_random_uuid(),
  generation_id    uuid references public.vsg_generations(id) on delete set null,
  narrator_id      uuid references public.vsg_narrators(id) on delete set null,
  product_id       uuid references public.vsg_products(id) on delete set null,
  title            text not null,
  narration_status text not null default 'not_requested'
                   check (narration_status in ('not_requested','recording','done')),
  video_status     text not null default 'not_requested'
                   check (video_status in ('not_requested','rendering','done')),
  publish_status   text not null default 'unpublished'
                   check (publish_status in ('unpublished','published')),
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_vsg_videos_publish_status on public.vsg_videos(publish_status);
create index if not exists idx_vsg_videos_created_at on public.vsg_videos(created_at);
```

- DB列は既存慣習（英語列名・英語コード値）に合わせる。日本語ラベルへの変換はフロント側で行う。
- `generation_id` を辿れば台本・ストーリー・タイトル候補（`vsg_generations.output_titles` など）を参照できる。動画レコード自体は採用済みの `title` のみ持つ。
- `updated_at` は PATCH 時にアプリ側で `now()` を設定する。

### TypeScript 型（`src/lib/types.ts` に追加）

```ts
export type NarrationStatus = "not_requested" | "recording" | "done";
export type VideoStatus = "not_requested" | "rendering" | "done";
export type PublishStatus = "unpublished" | "published";

export type Video = {
  id: string;
  generation_id: string | null;
  narrator_id: string | null;
  product_id: string | null;
  title: string;
  narration_status: NarrationStatus;
  video_status: VideoStatus;
  publish_status: PublishStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};
```

ラベル定義・選択肢・派生「未着手」判定（`isUntouched(video)`）はフロント側の定数モジュール（例: `src/lib/videoStatus.ts`）にまとめる。

## API 設計

### `GET /api/videos`
- 動画一覧を返す。新しい順（`created_at desc`）。
- ナレーター名・商品名はクライアントで解決（既存 history ページと同じパターン）か、API側で join して返す。実装計画でどちらかに統一する。既存パターン（クライアント解決）に合わせるのを推奨。

### `PATCH /api/videos`
- body: `{ id, title?, narration_status?, video_status?, publish_status?, note? }`
- 指定フィールドのみ更新し、`updated_at = now()` を設定。
- ステータス値は CHECK 制約に沿った値のみ許可（不正値はエラー）。

### `DELETE /api/videos?id=<uuid>`
- 動画レコードを削除（`vsg_generations` の履歴は削除しない）。

### 作成
- 専用の POST は設けず、`/api/generate` 内で生成成功後に作成する。

## 生成フローの変更

`/api/generate`（既存）の処理に追記:
1. 既存どおり Gemini 生成 → `vsg_generations` に履歴保存。
2. 続けて `vsg_videos` を1件作成する。
   - `generation_id` = 作成した generation の id
   - `narrator_id` / `product_id` = リクエスト値
   - `title` = 生成タイトル候補の第1候補（デフォルト採用）
   - 各ステータス = デフォルト（= 未着手）
3. レスポンスに `video_id` を追加して返す。

`/generate` ページ（旧トップ `/` を移動）:
- 生成結果画面でタイトル候補を**ラジオ選択**でき、選ぶと `PATCH /api/videos` で動画の `title` を更新する（「候補から1つ選ぶ」の実現）。
- 「動画リストで見る」リンク（`/` または `/videos/[id]`）を表示。

## 画面・ナビ構成

ナビ（`src/components/NavBar.tsx`）を再編。アプリ名を「🎬 動画マネージャー」に変更。

| パス | ラベル | 内容 |
|---|---|---|
| `/` | 動画 | 新トップ＝動画TODOリスト |
| `/generate` | 生成 | 旧トップ `/` の生成フォームを移動 |
| `/scripts` | お手本 | 既存 |
| `/patterns` | 型 | 既存 |
| `/history` | 履歴 | 既存（生成の生ログ） |
| `/settings` | 設定 | 既存 |

### トップページ `/`（動画TODOリスト）
- **進行中エリア（上部）**: `publish_status != 'published'` の動画。`created_at desc`。
- **公開済みエリア（下部）**: `publish_status == 'published'` の動画を、折りたたみ可能なセクションとして分離表示。
- 各カードの表示:
  - 採用タイトル
  - ナレーター名・商品名（あれば）・作成日
  - 3つのステータスを `<select>` で個別に変更（既存UIの select スタイルに合わせる）。変更時に `PATCH /api/videos` を呼ぶ。
  - 3ステータスすべて初期値なら「未着手」バッジを表示。
  - 詳細ページ `/videos/[id]` へのリンク。
- 動画が0件のときは空状態メッセージ（生成ページへの誘導）。

### 動画詳細ページ `/videos/[id]`
- 採用タイトルの選び直し（`generation_id` 経由でタイトル候補を取得しラジオ選択）。
- 台本 / ストーリー(Flow用) の閲覧とコピー（既存 CopyButton 利用）。
- メモ編集。
- 3ステータスの変更。
- 削除（確認ダイアログ後 `DELETE /api/videos`）。

## マイグレーション

- `supabase/schema.sql` に `vsg_videos` の定義（上記SQL）を追記。
- 既存 Supabase プロジェクトへの適用は別途実行（MCP の `apply_migration` または SQL 実行）。`generation_id` 等の外部キーは既存テーブルを参照するため、適用順は既存テーブルの後。

## エラーハンドリング

- API は既存 `ok` / `fail`（`src/lib/http.ts`）を踏襲。
- 生成時の動画作成に失敗しても、生成自体（履歴保存）は成功扱いとし、`video_id: null` を返してUIで警告を出す（生成結果は失わない）。
- 不正なステータス値の PATCH は `fail(...)` で 400 系を返す。

## 検証

本リポジトリにテスト基盤が無いため、新規導入はしない（既存慣習踏襲）。検証は以下:
- `tsc` 型チェックが通る
- `next build` が通る
- 手動動作確認:
  - 生成 → 動画が「未着手」でトップに出る
  - タイトル選択が反映される
  - 各ステータスを変更でき、公開済みにすると下部エリアへ移る
  - 詳細ページで台本/ストーリー閲覧・メモ編集・削除ができる
  - 履歴ページが従来どおり動く

## 影響を受けるファイル（概算）

- 追加: `supabase/schema.sql`（追記）, `src/lib/videoStatus.ts`, `src/app/videos/[id]/page.tsx`, `src/app/api/videos/route.ts`
- 変更: `src/lib/types.ts`, `src/lib/supabase.ts`（`T.videos` 追加）, `src/components/NavBar.tsx`, `src/app/api/generate/route.ts`
- 移動: 旧 `src/app/page.tsx`（生成フォーム）→ `src/app/generate/page.tsx`、新 `src/app/page.tsx`（動画リスト）
