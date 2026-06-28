# ナレーター向けページ 設計

作成日: 2026-06-28

## 目的

ナレーターに URL を送り、自分が担当する未収録の動画（台本）を確認してもらう
ためのページ。ナレーションを録り終えたら、その場で「収録完了」に更新できる。
進捗確認と進捗報告を兼ねる。

## スコープ

### 対象ステータス
- `narration_status != "done"`（未依頼・録り待ち）の動画のみ表示。
- video_status / publish_status は無視（ナレーターの関心外）。

### ナレーターができること
1. 自分の未収録動画の **タイトル・台本・ストーリー** を閲覧（コピー可）。
2. 各動画を「収録完了」に更新（`narration_status = "done"`）。更新後はリストから消える。

### スコープ外（YAGNI）
- 認証 / 限定公開リンク（社内利用前提の「一旦」版）。
- 収録完了の取り消し UI（必要なら管理者が `/videos/[id]` で戻す）。
- ステータス以外の絞り込み・検索。

## ルート / アクセス

- 新規ページ `/narrator`（クライアントコンポーネント、既存ページと同様）。
- 上部にナレーター選択ドロップダウン。選択するとその人の未収録動画を表示。
- `/narrator?id=<narrator_id>` のディープリンク対応。事前選択した URL を送れる。
  - `useSearchParams` は prerender 時に Suspense 境界が必要（Next 16）。
    ページの default export で内側コンポーネントを `<Suspense>` でラップする。
- NavBar に「ナレーター」リンクを追加。

## データ

### 新規エンドポイント `GET /api/narrator/videos?narrator_id=<id>`
- `vsg_videos` を `narrator_id` 一致 かつ `narration_status != "done"` で取得、
  `created_at` 降順。
- 各動画の台本/ストーリー/タイトル候補を、既存 `/api/videos?id=` と同じロジックで解決:
  - `generation_id` があれば `vsg_generations`（output_titles/script/story）。
  - 無ければ `script_id` から `vsg_scripts`（title/script/story）を同形に整形。
  - N+1 回避のため `generation_id` 群・`script_id` 群を `.in()` でまとめて取得してマップ。
- 返却: `NarratorTask[]`
  ```
  { id, title, narration_status, created_at,
    output_titles, output_script, output_story }
  ```

### 既存エンドポイントの流用
- ナレーター一覧: `GET /api/narrators`（有効なもののみ）。
- 収録完了更新: `PATCH /api/videos { id, narration_status: "done" }`。

### 型
- `src/lib/types.ts` に `NarratorTask` を追加。

## UI

- ナレーター未選択時: 選択を促す案内。
- 選択後・該当なし: 「未収録の動画はありません」。
- 各動画カード:
  - タイトル
  - 「収録完了にする」ボタン（primary）
  - 台本（whitespace-pre-wrap、コピーボタン付き）
  - ストーリー（参考、コピーボタン付き）
- 既存の `Card` / `Button` / `CopyButton` / `Spinner` / `ErrorBox` を流用。
