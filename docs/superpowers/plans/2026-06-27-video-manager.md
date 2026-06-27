# 動画マネージャー化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 台本ジェネレーターを、トップが動画TODOリストになる動画管理アプリへ拡張する（台本生成は一機能化）。

**Architecture:** 新テーブル `vsg_videos` を追加し、生成成功時に動画レコードを自動作成。トップ(`/`)を動画TODOリスト、旧生成フォームを `/generate` へ移動。動画は3つの独立ステータス（ナレーション/動画生成/公開）を持ち、全て初期値なら「未着手」と表示。

**Tech Stack:** Next.js 16.2.9 (App Router), Supabase (service role, Route Handler 経由), Gemini, TypeScript, Tailwind。

**検証方針:** 本リポジトリにテスト基盤は無く、仕様で新規導入しない方針。各タスクは単体テストの代わりに **型チェック（`npx tsc --noEmit`）+ ビルド（`npm run build`）+ 手動確認** で検証する。

**仕様書:** `docs/superpowers/specs/2026-06-27-video-manager-design.md`

**前提:** 作業ブランチ `feature/video-manager` 上で実施。

---

## ステータスのコード値（全タスク共通）

| 軸 | コード値 → ラベル |
|---|---|
| narration_status | `not_requested`=未依頼 / `recording`=録り待ち / `done`=完了 |
| video_status | `not_requested`=未依頼 / `rendering`=待ち / `done`=完了 |
| publish_status | `unpublished`=未公開 / `published`=公開済み |

「未着手」= 3つすべてが初期値（`not_requested` / `not_requested` / `unpublished`）。派生表示で保存しない。

---

## ファイル構成

- 追加: `src/lib/videoStatus.ts`（ラベル・選択肢・`isUntouched`）
- 追加: `src/app/api/videos/route.ts`（GET一覧 / GET単一 / PATCH / DELETE）
- 追加: `src/app/generate/page.tsx`（旧トップの生成フォームを移動）
- 追加: `src/app/videos/[id]/page.tsx`（動画詳細）
- 変更: `supabase/schema.sql`（`vsg_videos` 追記）
- 変更: `src/lib/types.ts`（`Video` と各ステータス型）
- 変更: `src/lib/supabase.ts`（`T.videos`）
- 変更: `src/app/api/generate/route.ts`（生成後に動画を自動作成）
- 変更: `src/components/NavBar.tsx`（ナビ再編・アプリ名）
- 置換: `src/app/page.tsx`（生成フォーム → 動画TODOリスト）

---

## Task 1: スキーマ・型・ステータスヘルパー

**Files:**
- Modify: `supabase/schema.sql`（末尾に追記）
- Modify: `src/lib/types.ts`
- Modify: `src/lib/supabase.ts:13-19`
- Create: `src/lib/videoStatus.ts`

- [ ] **Step 1: `supabase/schema.sql` の末尾に `vsg_videos` を追記**

```sql
-- ============================================================
-- vsg_videos（動画管理＝TODO）
-- ============================================================
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

> 注: `vsg_products` がライブDBにのみ存在し schema.sql 未記載の既知driftがある（仕様書参照）。`vsg_videos` の `product_id` FK はライブDBの `vsg_products` を参照する前提。

- [ ] **Step 2: ライブDBにマイグレーションを適用**

Supabase MCP の `apply_migration`（name: `add_vsg_videos`、query: 上記SQL）で共有Supabaseプロジェクトに適用する。
**注意: 共有本番DBを変更する。** `create table if not exists` なので再実行は安全。適用後 `list_tables` で `vsg_videos` の存在を確認する。

- [ ] **Step 3: `src/lib/types.ts` に型を追加（ファイル末尾）**

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

// 詳細ページ用：生成元の台本等を同梱した形
export type VideoDetail = Video & {
  generation: {
    output_titles: string | null;
    output_script: string | null;
    output_story: string | null;
  } | null;
};
```

- [ ] **Step 4: `src/lib/supabase.ts` の `T` に `videos` を追加**

`src/lib/supabase.ts:13-19` の `T` オブジェクトに1行追加:

```ts
export const T = {
  narrators: "vsg_narrators",
  scripts: "vsg_scripts",
  patterns: "vsg_patterns",
  generations: "vsg_generations",
  products: "vsg_products",
  videos: "vsg_videos",
} as const;
```

- [ ] **Step 5: `src/lib/videoStatus.ts` を新規作成**

```ts
import type {
  NarrationStatus,
  VideoStatus,
  PublishStatus,
  Video,
} from "./types";

export const NARRATION_OPTIONS: { value: NarrationStatus; label: string }[] = [
  { value: "not_requested", label: "未依頼" },
  { value: "recording", label: "録り待ち" },
  { value: "done", label: "完了" },
];

export const VIDEO_OPTIONS: { value: VideoStatus; label: string }[] = [
  { value: "not_requested", label: "未依頼" },
  { value: "rendering", label: "待ち" },
  { value: "done", label: "完了" },
];

export const PUBLISH_OPTIONS: { value: PublishStatus; label: string }[] = [
  { value: "unpublished", label: "未公開" },
  { value: "published", label: "公開済み" },
];

// API バリデーション用の値配列
export const NARRATION_VALUES = NARRATION_OPTIONS.map((o) => o.value);
export const VIDEO_VALUES = VIDEO_OPTIONS.map((o) => o.value);
export const PUBLISH_VALUES = PUBLISH_OPTIONS.map((o) => o.value);

type StatusFields = Pick<
  Video,
  "narration_status" | "video_status" | "publish_status"
>;

// 3ステータスすべて初期値なら「未着手」
export function isUntouched(v: StatusFields): boolean {
  return (
    v.narration_status === "not_requested" &&
    v.video_status === "not_requested" &&
    v.publish_status === "unpublished"
  );
}
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（新規 export は未使用でもエラーにならない）。

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql src/lib/types.ts src/lib/supabase.ts src/lib/videoStatus.ts
git commit -m "動画テーブル(vsg_videos)・型・ステータスヘルパーを追加"
```

---

## Task 2: 動画API（`/api/videos`）

**Files:**
- Create: `src/app/api/videos/route.ts`

参照パターン: `src/app/api/generations/route.ts`（ok/fail・getSupabase・try/catch の書き方）。

- [ ] **Step 1: `src/app/api/videos/route.ts` を新規作成**

```ts
import { getSupabase, T } from "@/lib/supabase";
import { ok, fail } from "@/lib/http";
import type { Video } from "@/lib/types";
import {
  NARRATION_VALUES,
  VIDEO_VALUES,
  PUBLISH_VALUES,
} from "@/lib/videoStatus";

// GET /api/videos        一覧（新しい順）
// GET /api/videos?id=...  単一（生成元の台本/ストーリー/タイトル候補を同梱）
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const sb = getSupabase();

    if (id) {
      const { data: video, error } = await sb
        .from(T.videos)
        .select("*")
        .eq("id", id)
        .maybeSingle<Video>();
      if (error) return fail(error.message, 500);
      if (!video) return fail("動画が見つかりません", 404);

      let generation = null;
      if (video.generation_id) {
        const { data } = await sb
          .from(T.generations)
          .select("output_titles, output_script, output_story")
          .eq("id", video.generation_id)
          .maybeSingle();
        generation = data ?? null;
      }
      return ok({ ...video, generation });
    }

    const { data, error } = await sb
      .from(T.videos)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// PATCH /api/videos
// { id, title?, narration_status?, video_status?, publish_status?, note? }
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    if (!b?.id) return fail("id は必須です");

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (b.title !== undefined) {
      if (typeof b.title !== "string" || !b.title.trim())
        return fail("title は空にできません");
      update.title = b.title.trim();
    }
    if (b.narration_status !== undefined) {
      if (!NARRATION_VALUES.includes(b.narration_status))
        return fail("narration_status が不正です");
      update.narration_status = b.narration_status;
    }
    if (b.video_status !== undefined) {
      if (!VIDEO_VALUES.includes(b.video_status))
        return fail("video_status が不正です");
      update.video_status = b.video_status;
    }
    if (b.publish_status !== undefined) {
      if (!PUBLISH_VALUES.includes(b.publish_status))
        return fail("publish_status が不正です");
      update.publish_status = b.publish_status;
    }
    if (b.note !== undefined) {
      update.note = b.note === null ? null : String(b.note);
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from(T.videos)
      .update(update)
      .eq("id", b.id)
      .select()
      .single();
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

// DELETE /api/videos?id=...
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id は必須です");
    const sb = getSupabase();
    const { error } = await sb.from(T.videos).delete().eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
```

> `NARRATION_VALUES.includes(b.narration_status)` は型エラーになり得る（`string[]` に対する未知文字列）。ならない場合はそのまま。型エラーが出たら配列を `(NARRATION_VALUES as string[]).includes(...)` とする。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/videos/route.ts
git commit -m "動画CRUD API (/api/videos) を追加"
```

---

## Task 3: 生成時に動画を自動作成

**Files:**
- Modify: `src/app/api/generate/route.ts:94-113`

- [ ] **Step 1: 生成履歴 insert（`gen`）の直後に動画作成を追加**

`src/app/api/generate/route.ts` の `const { data: gen } = await sb.from(T.generations).insert(...)...single();` の後、`return ok({...})` の前に以下を挿入:

```ts
    // 生成をきっかけに動画(TODO)を自動作成。タイトルは第1候補をデフォルト採用。
    let videoId: string | null = null;
    if (gen?.id) {
      const firstTitle =
        result.titles[0]?.trim() || (theme ?? "").trim() || "無題の動画";
      const { data: video } = await sb
        .from(T.videos)
        .insert({
          generation_id: gen.id,
          narrator_id,
          product_id: product?.id ?? null,
          title: firstTitle,
        })
        .select("id")
        .single();
      videoId = video?.id ?? null;
    }
```

- [ ] **Step 2: レスポンスに `video_id` を追加**

同ファイルの `return ok({ ... })` を次のように変更（`video_id` を追加）:

```ts
    return ok({
      ...result,
      raw: text,
      generation_id: gen?.id ?? null,
      video_id: videoId,
      used_pattern: !!pattern,
    });
```

> 動画作成に失敗しても生成自体は成功扱い（`video_id: null` を返す）。生成結果は失わない。

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "生成成功時に動画(vsg_videos)を自動作成しvideo_idを返す"
```

---

## Task 4: 生成フォームを `/generate` へ移動・タイトル採用・ナビ再編

**Files:**
- Create: `src/app/generate/page.tsx`（旧 `src/app/page.tsx` の内容を移植・拡張）
- Modify: `src/components/NavBar.tsx`

> 旧 `src/app/page.tsx` は Task 5 で動画リストに置き換えるため、本タスクでは内容を `/generate` へコピーする（移動）。Task 5 で `page.tsx` を上書きする。

- [ ] **Step 1: `src/app/generate/page.tsx` を作成（現 `src/app/page.tsx` をベースに）**

現 `src/app/page.tsx` の内容をそのままコピーした上で、以下を変更する。

(a) `GenResponse` 型に `video_id` を追加:

```ts
type GenResponse = GenerateResult & {
  raw: string;
  generation_id: string | null;
  video_id: string | null;
  used_pattern: boolean;
};
```

(b) 採用タイトルの state を追加（`const [result, setResult] = ...` の近く）:

```ts
  const [chosenTitle, setChosenTitle] = useState<string | null>(null);
```

(c) `generate()` 成功時、第1候補を初期採用にする。`setResult(r);` の直後に:

```ts
      setChosenTitle(r.titles[0] ?? null);
```

(d) タイトル採用関数を追加（コンポーネント内）:

```ts
  async function chooseTitle(t: string) {
    setChosenTitle(t);
    if (result?.video_id) {
      try {
        await api.patch("/api/videos", { id: result.video_id, title: t });
      } catch {
        /* 採用の保存失敗は致命的でないため握りつぶす */
      }
    }
  }
```

(e) 結果表示の「タイトル」ブロック（現 `ResultBlock title="タイトル"` の `<ol>`）を、ラジオ選択で採用できるUIに差し替え:

```tsx
          <ResultBlock title="タイトル（採用を選択）" copyText={result.titles.join("\n")}>
            <ul className="space-y-1">
              {result.titles.map((t, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2 text-[15px] cursor-pointer">
                    <input
                      type="radio"
                      name="chosen-title"
                      className="mt-1.5"
                      checked={chosenTitle === t}
                      onChange={() => chooseTitle(t)}
                    />
                    <span>{t}</span>
                  </label>
                </li>
              ))}
            </ul>
          </ResultBlock>
```

(f) 結果ブロック群の先頭（`{result && (` 直後）に、動画化された旨と動画リストへの導線を表示:

```tsx
          {result.video_id ? (
            <Card className="p-3 text-sm bg-green-50 border-green-200">
              「未着手」の動画として追加しました。
              <Link href="/" className="text-blue-600 underline ml-1">
                動画リストで見る
              </Link>
            </Card>
          ) : (
            <p className="text-xs text-amber-600">
              ※ 動画リストへの追加に失敗しました（生成結果は保持されています）。
            </p>
          )}
```

`Link` は既に import 済み。

- [ ] **Step 2: `src/components/NavBar.tsx` を更新**

`links` 配列とアプリ名を変更:

```tsx
const links = [
  { href: "/", label: "動画" },
  { href: "/generate", label: "生成" },
  { href: "/scripts", label: "お手本" },
  { href: "/patterns", label: "型" },
  { href: "/history", label: "履歴" },
  { href: "/settings", label: "設定" },
];
```

アプリ名のリンク文言を変更:

```tsx
          <Link href="/" className="font-bold text-sm shrink-0">
            🎬 動画マネージャー
          </Link>
```

> `/generate` の active 判定は既存ロジック（`pathname.startsWith(l.href)`）で動作する。

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 4: Commit**

```bash
git add src/app/generate/page.tsx src/components/NavBar.tsx
git commit -m "生成フォームを/generateへ移動・タイトル採用UI・ナビ再編"
```

---

## Task 5: トップページを動画TODOリストに置き換え

**Files:**
- Modify (上書き): `src/app/page.tsx`

参照パターン: `src/app/history/page.tsx`（一覧取得・ナレーター名解決・Card表示）。

- [ ] **Step 1: `src/app/page.tsx` を以下で全置換**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Narrator, Product, Video } from "@/lib/types";
import { Card, ErrorBox, Spinner } from "@/components/ui";
import {
  NARRATION_OPTIONS,
  VIDEO_OPTIONS,
  PUBLISH_OPTIONS,
  isUntouched,
} from "@/lib/videoStatus";

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [narrators, setNarrators] = useState<Narrator[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showPublished, setShowPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Video[]>("/api/videos");
      setVideos(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<Narrator[]>("/api/narrators?all=1").then(setNarrators).catch(() => {});
    api.get<Product[]>("/api/products").then(setProducts).catch(() => {});
  }, []);

  async function updateStatus(v: Video, patch: Partial<Video>) {
    // 楽観更新
    setVideos((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, ...patch } : x)),
    );
    try {
      await api.patch("/api/videos", { id: v.id, ...patch });
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  }

  const narratorName = (id: string | null) =>
    narrators.find((n) => n.id === id)?.name ?? null;
  const productName = (id: string | null) =>
    products.find((p) => p.id === id)?.name ?? null;

  const active = videos.filter((v) => v.publish_status !== "published");
  const published = videos.filter((v) => v.publish_status === "published");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">動画</h1>
        <Link
          href="/generate"
          className="text-sm px-3 py-1.5 rounded-full bg-neutral-900 text-white"
        >
          ＋ 生成して追加
        </Link>
      </div>

      <ErrorBox message={error} />

      {loading ? (
        <Spinner label="読み込み中…" />
      ) : videos.length === 0 ? (
        <p className="text-sm text-neutral-500">
          まだ動画がありません。
          <Link href="/generate" className="text-blue-600 underline ml-1">
            生成
          </Link>
          すると未着手の動画として追加されます。
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {active.length === 0 ? (
              <p className="text-sm text-neutral-500">進行中の動画はありません。</p>
            ) : (
              active.map((v) => (
                <VideoCard
                  key={v.id}
                  v={v}
                  narratorName={narratorName(v.narrator_id)}
                  productName={productName(v.product_id)}
                  onChange={updateStatus}
                />
              ))
            )}
          </div>

          {published.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowPublished((s) => !s)}
                className="text-sm text-neutral-500 flex items-center gap-1"
              >
                {showPublished ? "▼" : "▶"} 公開済み（{published.length}）
              </button>
              {showPublished && (
                <div className="space-y-3 mt-3 opacity-80">
                  {published.map((v) => (
                    <VideoCard
                      key={v.id}
                      v={v}
                      narratorName={narratorName(v.narrator_id)}
                      productName={productName(v.product_id)}
                      onChange={updateStatus}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VideoCard({
  v,
  narratorName,
  productName,
  onChange,
}: {
  v: Video;
  narratorName: string | null;
  productName: string | null;
  onChange: (v: Video, patch: Partial<Video>) => void;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/videos/${v.id}`} className="font-medium hover:underline">
            {v.title}
          </Link>
          <div className="text-xs text-neutral-500">
            {[narratorName, productName].filter(Boolean).join(" ・ ")}
            {(narratorName || productName) && " ・ "}
            {new Date(v.created_at).toLocaleDateString("ja-JP")}
          </div>
        </div>
        {isUntouched(v) && (
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600">
            未着手
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatusSelect
          label="ナレーション"
          value={v.narration_status}
          options={NARRATION_OPTIONS}
          onChange={(val) => onChange(v, { narration_status: val as Video["narration_status"] })}
        />
        <StatusSelect
          label="動画生成"
          value={v.video_status}
          options={VIDEO_OPTIONS}
          onChange={(val) => onChange(v, { video_status: val as Video["video_status"] })}
        />
        <StatusSelect
          label="公開"
          value={v.publish_status}
          options={PUBLISH_OPTIONS}
          onChange={(val) => onChange(v, { publish_status: val as Video["publish_status"] })}
        />
      </div>
    </Card>
  );
}

function StatusSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

> `/api/narrators?all=1` と `/api/products` は既存（history/generate ページが利用）。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "トップページを動画TODOリストに置き換え"
```

---

## Task 6: 動画詳細ページ `/videos/[id]`

**Files:**
- Create: `src/app/videos/[id]/page.tsx`

> Next.js 16 では動的ルートの `params` は Promise。クライアントコンポーネントなので `next/navigation` の `useParams()` で `id` を取得する（`params` prop を直接使わない）。

- [ ] **Step 1: `src/app/videos/[id]/page.tsx` を新規作成**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { VideoDetail, Video } from "@/lib/types";
import { Button, Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";
import {
  NARRATION_OPTIONS,
  VIDEO_OPTIONS,
  PUBLISH_OPTIONS,
} from "@/lib/videoStatus";

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const v = await api.get<VideoDetail>(`/api/videos?id=${id}`);
      setVideo(v);
      setNote(v.note ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(p: Partial<Video>) {
    if (!video) return;
    setVideo({ ...video, ...p });
    try {
      await api.patch("/api/videos", { id: video.id, ...p });
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  }

  async function remove() {
    if (!video) return;
    if (!confirm("この動画を削除しますか？")) return;
    await api.del(`/api/videos?id=${video.id}`);
    router.push("/");
  }

  if (loading) return <Spinner label="読み込み中…" />;
  if (!video)
    return (
      <div className="space-y-3">
        <ErrorBox message={error ?? "動画が見つかりません"} />
        <Link href="/" className="text-blue-600 underline text-sm">
          ← 動画リストへ
        </Link>
      </div>
    );

  const titleCandidates = (video.generation?.output_titles ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      <Link href="/" className="text-blue-600 underline text-sm">
        ← 動画リストへ
      </Link>

      <h1 className="text-lg font-bold">{video.title}</h1>

      <ErrorBox message={error} />

      {/* ステータス */}
      <Card className="p-4 grid grid-cols-3 gap-2">
        <StatusSelect label="ナレーション" value={video.narration_status} options={NARRATION_OPTIONS} onChange={(val) => patch({ narration_status: val as Video["narration_status"] })} />
        <StatusSelect label="動画生成" value={video.video_status} options={VIDEO_OPTIONS} onChange={(val) => patch({ video_status: val as Video["video_status"] })} />
        <StatusSelect label="公開" value={video.publish_status} options={PUBLISH_OPTIONS} onChange={(val) => patch({ publish_status: val as Video["publish_status"] })} />
      </Card>

      {/* タイトル採用 */}
      {titleCandidates.length > 0 ? (
        <Card className="p-4 space-y-2">
          <h2 className="font-bold text-sm">採用タイトル</h2>
          <ul className="space-y-1">
            {titleCandidates.map((t, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 text-[15px] cursor-pointer">
                  <input
                    type="radio"
                    name="title"
                    className="mt-1.5"
                    checked={video.title === t}
                    onChange={() => patch({ title: t })}
                  />
                  <span>{t}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-4 space-y-2">
          <h2 className="font-bold text-sm">タイトル</h2>
          <input
            value={video.title}
            onChange={(e) => setVideo({ ...video, title: e.target.value })}
            onBlur={() => video.title.trim() && patch({ title: video.title.trim() })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base"
          />
          <p className="text-xs text-neutral-400">
            生成元が削除されているため候補はありません。手動で編集できます。
          </p>
        </Card>
      )}

      {/* 台本・ストーリー */}
      {video.generation?.output_script && (
        <DetailBlock title="台本" text={video.generation.output_script} />
      )}
      {video.generation?.output_story && (
        <DetailBlock title="ストーリー（Flow用）" text={video.generation.output_story} />
      )}

      {/* メモ */}
      <Card className="p-4 space-y-2">
        <h2 className="font-bold text-sm">メモ</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => patch({ note: note.trim() || null })}
          rows={3}
          placeholder="制作メモ・依頼先など"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base resize-y"
        />
      </Card>

      <Button
        variant="secondary"
        onClick={remove}
        className="w-full text-red-600 border-red-200"
      >
        この動画を削除
      </Button>
    </div>
  );
}

function StatusSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">{title}</h2>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700">
        {text}
      </p>
    </Card>
  );
}
```

> `Button` の `variant="secondary"` と `CopyButton` は `src/components/ui.tsx` に存在することを前提（generate/history ページで使用済み）。存在しない props があれば ui.tsx を確認して合わせる。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add "src/app/videos/[id]/page.tsx"
git commit -m "動画詳細ページ /videos/[id] を追加"
```

---

## Task 7: 総合検証

- [ ] **Step 1: ビルド**

Run: `npm run build`
Expected: 成功（型エラー・lintエラーなし）。エラーが出たら該当タスクに戻って修正。

- [ ] **Step 2: 手動動作確認（`npm run dev`）**

以下を確認:
- [ ] `/generate` で生成 → 完了後「未着手の動画として追加」表示と「動画リストで見る」リンク
- [ ] `/`（トップ）に新しい動画が「未着手」バッジ付きで表示される
- [ ] 生成結果でタイトルのラジオを変更 → トップの動画タイトルが変わる
- [ ] トップの各 select でステータス変更が保存される（リロードしても保持）
- [ ] 公開を「公開済み」にすると進行中から消え、下部「公開済み」エリアに移動
- [ ] 動画タイトルから詳細ページへ遷移、台本/ストーリー閲覧・コピー、メモ編集、削除ができる
- [ ] ナビが「動画 / 生成 / お手本 / 型 / 履歴 / 設定」になっている
- [ ] `/history`（履歴）が従来どおり動作する

- [ ] **Step 3: 最終コミット（必要な微修正があれば）**

```bash
git add -A
git commit -m "動画マネージャー化の総合検証と微修正"
```

---

## 完了条件

- 生成すると未着手の動画がトップTODOに追加される
- 3ステータスを独立して変更でき、公開済みは下部エリアに分離表示
- 詳細ページで台本閲覧・タイトル採用・メモ・削除ができる
- 履歴ページは従来どおり残る
- `npm run build` が通る
