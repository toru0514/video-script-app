-- TikTok台本ジェネレーター スキーマ
-- handmade-shipping-manager と同じ Supabase プロジェクトを共有するため、
-- テーブルは vsg_ プレフィックスで名前空間化している。

-- 拡張（uuid生成用）
create extension if not exists "pgcrypto";

-- ============================================================
-- vsg_narrators（ナレーター登録）
-- ============================================================
create table if not exists public.vsg_narrators (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  password    text,  -- ナレーター本人用ログインパスワード（/narrator）
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
-- 既存テーブルへの後付け（再実行時の安全策）
alter table public.vsg_narrators add column if not exists password text;
create unique index if not exists vsg_narrators_password_key
  on public.vsg_narrators (password) where password is not null;

-- ============================================================
-- vsg_scripts（過去動画＝お手本）
-- ============================================================
create table if not exists public.vsg_scripts (
  id          uuid primary key default gen_random_uuid(),
  narrator_id uuid not null references public.vsg_narrators(id) on delete cascade,
  title       text not null,
  script      text not null,
  story       text not null,
  theme       text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_vsg_scripts_narrator_id on public.vsg_scripts(narrator_id);

-- ============================================================
-- vsg_patterns（抽出した「型」・ナレーター別）
-- ============================================================
create table if not exists public.vsg_patterns (
  id             uuid primary key default gen_random_uuid(),
  narrator_id    uuid not null references public.vsg_narrators(id) on delete cascade,
  title_pattern  text,
  script_pattern text,
  story_pattern  text,
  source_count   int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_vsg_patterns_narrator_id on public.vsg_patterns(narrator_id);

-- ============================================================
-- vsg_generations（生成履歴）
-- ============================================================
create table if not exists public.vsg_generations (
  id            uuid primary key default gen_random_uuid(),
  narrator_id   uuid references public.vsg_narrators(id) on delete set null,
  input_theme   text,
  output_titles text,
  output_script text,
  output_story  text,
  -- SNS投稿用の文章（媒体別）
  output_post_x         text,
  output_post_tiktok    text,
  output_post_instagram text,
  is_favorite   boolean not null default false,
  created_at    timestamptz not null default now()
);

-- 既存テーブルへの後付け（再実行時の安全策）
alter table public.vsg_generations add column if not exists output_post_x text;
alter table public.vsg_generations add column if not exists output_post_tiktok text;
alter table public.vsg_generations add column if not exists output_post_instagram text;

create index if not exists idx_vsg_generations_narrator_id on public.vsg_generations(narrator_id);

-- ============================================================
-- 初期データ（ナレーター2人）
-- ============================================================
insert into public.vsg_narrators (name, description, sort_order)
select 'ナレーターA', '落ち着いた語り口', 1
where not exists (select 1 from public.vsg_narrators);

insert into public.vsg_narrators (name, description, sort_order)
select 'ナレーターB', 'テンポの速い元気な語り口', 2
where (select count(*) from public.vsg_narrators) = 1;

-- ============================================================
-- vsg_videos（動画管理＝TODO）
-- ============================================================
create table if not exists public.vsg_videos (
  id               uuid primary key default gen_random_uuid(),
  generation_id    uuid references public.vsg_generations(id) on delete set null,
  -- script_id: お手本(vsg_scripts)から取り込んだ動画の参照元。生成由来なら null。
  script_id        uuid references public.vsg_scripts(id) on delete set null,
  narrator_id      uuid references public.vsg_narrators(id) on delete set null,
  -- vsg_products は本番DBにのみ存在する既存テーブル（意図的なスキーマdrift）。
  -- このファイルには定義しないため、schema.sql をゼロから実行するには
  -- 事前に vsg_products が存在している必要がある（バグではない）。
  product_id       uuid references public.vsg_products(id) on delete set null,
  title            text not null,
  narration_status text not null default 'not_requested'
                   check (narration_status in ('not_requested','recording','done')),
  video_status     text not null default 'not_requested'
                   check (video_status in ('not_requested','rendering','done')),
  publish_status   text not null default 'unpublished'
                   check (publish_status in ('unpublished','published')),
  note             text,
  -- storage_url: 完成動画の保存先（Google Drive リンク等）。動画編集者が入力する。
  storage_url      text,
  created_at       timestamptz not null default now(),
  -- updated_at はAPI層（PATCHハンドラ）で更新する。DBトリガーは無い。
  updated_at       timestamptz not null default now()
);

create index if not exists idx_vsg_videos_publish_status on public.vsg_videos(publish_status);
create index if not exists idx_vsg_videos_created_at on public.vsg_videos(created_at);
create index if not exists idx_vsg_videos_script_id on public.vsg_videos(script_id);
